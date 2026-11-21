import fs from 'fs';
import path from 'path';
import {
  PatientRecord,
  CreatePatientInput,
  AddCareInput,
  CareHistoryItem,
} from '../types';
import {
  fetchPatientsFromFirestoreWithStatus,
  savePatientToFirestore,
  updateTrashStatusInFirestore,
  updateCareHistoryInFirestore,
  deletePatientFromFirestore,
  loadSyncRegistryFile,
  persistSyncRegistryFile,
  reconcileBidirectionalSync,
  SyncStateSets,
} from './firestore_sync';
import { CabinetsService, getCabinetCode } from './cabinets_service';
import { resolveWritableDataDir } from '../path_utils';

const DATA_DIR = resolveWritableDataDir(import.meta.url);
const DATA_FILE = path.join(DATA_DIR, 'patients.json');
const DELETED_FILE = path.join(DATA_DIR, 'deleted_patients.json');

// STOCKAGE LOCAL ET REGISTRE DE SYNCHRONISATION
function ensureStorage(): PatientRecord[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf-8');
      return [];
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    if (!raw || !raw.trim()) {
      fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf-8');
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Erreur lecture patients.json:', error);
    return [];
  }
}

function persistStorage(patients: PatientRecord[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(patients, null, 2), 'utf-8');
  } catch (error) {
    console.error('Erreur ecriture patients.json:', error);
  }
}

const rawInitialPatients = ensureStorage();
const { registry: initialRegistry, existed: registryExisted } = loadSyncRegistryFile(
  DELETED_FILE,
  rawInitialPatients.map((p) => p.id)
);
const syncState: SyncStateSets = {
  deletedIds: new Set<string>(initialRegistry.deletedIds),
  pendingDeletes: new Set<string>(initialRegistry.pendingDeletes),
  pendingSaves: new Set<string>(initialRegistry.pendingSaves),
  syncedIds: new Set<string>(initialRegistry.syncedIds),
};
let inMemoryPatients: PatientRecord[] = rawInitialPatients.filter(
  (p) => !syncState.deletedIds.has(p.id)
);
if (!registryExisted) {
  persistSyncRegistryFile(DELETED_FILE, DATA_DIR, syncState);
}

let activeSyncPromise: Promise<boolean> | null = null;
const pendingMutations = new Set<string>();
const pendingMutationCounts = new Map<string, number>();
const patientOpQueues = new Map<string, Promise<unknown>>();
let mutationGeneration = 0;

function beginPatientMutation(patientId: string): void {
  const count = (pendingMutationCounts.get(patientId) || 0) + 1;
  pendingMutationCounts.set(patientId, count);
  pendingMutations.add(patientId);
}

function endPatientMutation(patientId: string): void {
  const count = (pendingMutationCounts.get(patientId) || 1) - 1;
  if (count <= 0) {
    pendingMutationCounts.delete(patientId);
    pendingMutations.delete(patientId);
  } else {
    pendingMutationCounts.set(patientId, count);
  }
}

function enqueuePatientOp<T>(patientId: string, task: () => Promise<T>): Promise<T> {
  const previous = patientOpQueues.get(patientId) || Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  const tracked = next.finally(() => {
    if (patientOpQueues.get(patientId) === tracked) {
      patientOpQueues.delete(patientId);
    }
  });
  patientOpQueues.set(patientId, tracked);
  return next;
}

function markLocalSavePending(ids: string[]): void {
  let changed = false;
  for (const id of ids) {
    if (!id) continue;
    if (!syncState.pendingSaves.has(id)) {
      syncState.pendingSaves.add(id);
      changed = true;
    }
  }
  if (changed) {
    persistSyncRegistryFile(DELETED_FILE, DATA_DIR, syncState);
  }
}

function markLocalSaveConfirmed(id: string, snapshotUpdatedAt?: string): void {
  const current = inMemoryPatients.find((p) => p.id === id);
  if (!current) return;
  if (snapshotUpdatedAt && current.updatedAt && current.updatedAt !== snapshotUpdatedAt) {
    return;
  }
  let changed = false;
  if (syncState.pendingSaves.delete(id)) {
    changed = true;
  }
  if (!syncState.syncedIds.has(id)) {
    syncState.syncedIds.add(id);
    changed = true;
  }
  if (changed) {
    persistSyncRegistryFile(DELETED_FILE, DATA_DIR, syncState);
  }
}

async function flushPendingFirestoreDeletes(): Promise<void> {
  if (syncState.pendingDeletes.size === 0) return;
  const ids = Array.from(syncState.pendingDeletes);
  let changed = false;
  for (const id of ids) {
    const ok = await enqueuePatientOp(id, () => deletePatientFromFirestore(id));
    if (ok) {
      syncState.pendingDeletes.delete(id);
      changed = true;
    }
  }
  if (changed) {
    persistSyncRegistryFile(DELETED_FILE, DATA_DIR, syncState);
  }
}

function markPermanentlyDeleted(ids: string[]): void {
  let added = false;
  for (const id of ids) {
    if (!id) continue;
    if (syncState.pendingSaves.delete(id)) {
      added = true;
    }
    if (syncState.syncedIds.delete(id)) {
      added = true;
    }
    if (!syncState.deletedIds.has(id)) {
      syncState.deletedIds.add(id);
      added = true;
    }
    if (!syncState.pendingDeletes.has(id)) {
      syncState.pendingDeletes.add(id);
      added = true;
    }
  }
  if (added) {
    persistSyncRegistryFile(DELETED_FILE, DATA_DIR, syncState);
  }
}

// SYNCHRONISATION BIDIRECTIONNELLE PATIENTS FIRESTORE / LOCAL
async function syncWithFirestore(): Promise<boolean> {
  if (activeSyncPromise) {
    return activeSyncPromise;
  }
  activeSyncPromise = (async () => {
    try {
      await flushPendingFirestoreDeletes();
      const syncStartGen = mutationGeneration;
      const { ok, patients: firestorePatients } = await fetchPatientsFromFirestoreWithStatus();
      if (!ok || mutationGeneration !== syncStartGen) {
        return false;
      }

      const result = reconcileBidirectionalSync<PatientRecord>({
        localItems: inMemoryPatients,
        firestoreItems: firestorePatients,
        state: syncState,
        pendingMutations,
        opQueues: patientOpQueues,
        getTimestamp: (p) => Date.parse(p.updatedAt || p.createdAt || '') || 0,
      });

      if (mutationGeneration !== syncStartGen) {
        return false;
      }

      inMemoryPatients = result.mergedItems;
      persistStorage(inMemoryPatients);
      if (result.registryChanged) {
        persistSyncRegistryFile(DELETED_FILE, DATA_DIR, syncState);
      }

      let pushRegistryChanged = false;
      for (const pushId of result.idsToPush) {
        if (
          syncState.deletedIds.has(pushId) ||
          syncState.pendingDeletes.has(pushId) ||
          pendingMutations.has(pushId)
        ) {
          continue;
        }
        const localItem = inMemoryPatients.find((p) => p.id === pushId);
        if (!localItem) {
          if (syncState.pendingSaves.delete(pushId)) {
            pushRegistryChanged = true;
          }
          continue;
        }
        const snapshotUpdatedAt = localItem.updatedAt;
        const saved = await enqueuePatientOp(pushId, () => savePatientToFirestore(localItem));
        if (saved) {
          const latest = inMemoryPatients.find((p) => p.id === pushId);
          if (latest && latest.updatedAt === snapshotUpdatedAt) {
            if (syncState.pendingSaves.delete(pushId)) {
              pushRegistryChanged = true;
            }
            if (!syncState.syncedIds.has(pushId)) {
              syncState.syncedIds.add(pushId);
              pushRegistryChanged = true;
            }
          }
        }
      }
      if (pushRegistryChanged) {
        persistSyncRegistryFile(DELETED_FILE, DATA_DIR, syncState);
      }

      if (result.ghostIdsToDelete.length > 0) {
        for (const ghostId of result.ghostIdsToDelete) {
          enqueuePatientOp(ghostId, () => deletePatientFromFirestore(ghostId)).then((deleted) => {
            if (deleted && syncState.pendingDeletes.delete(ghostId)) {
              persistSyncRegistryFile(DELETED_FILE, DATA_DIR, syncState);
            }
          });
        }
      }
      return true;
    } catch (error) {
      console.error('Erreur synchronisation Firestore:', error);
      return false;
    } finally {
      activeSyncPromise = null;
    }
  })();
  return activeSyncPromise;
}

syncWithFirestore();

export const PatientsService = {
  syncNow(): Promise<boolean> {
    return syncWithFirestore();
  },

  // Liste tous les patients avec filtres optionnels
  async getAllPatients(options?: {
    search?: string;
    cabinet?: string;
    inTrash?: boolean;
  }): Promise<PatientRecord[]> {
    await syncWithFirestore();
    let list = [...inMemoryPatients];

    if (options?.inTrash) {
      list = list.filter((p) => Boolean(p.deleted));
    } else {
      list = list.filter((p) => !p.deleted);
    }

    if (options?.cabinet && options.cabinet !== 'Tous') {
      list = list.filter(
        (p) => p.cabinet.toLowerCase() === options.cabinet?.toLowerCase()
      );
    }

    if (options?.search) {
      const normalize = (val?: string) =>
        (val || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .trim();
      const tokens = normalize(options.search).split(/\s+/).filter(Boolean);
      if (tokens.length > 0) {
        list = list.filter((p) => {
          const searchable = normalize(
            `${p.nom || ''} ${p.prenom || ''} ${p.nom || ''} ${p.identifiant || ''} ${p.telephone || ''} ${p.cabinet || ''}`
          );
          return tokens.every((token) => searchable.includes(token));
        });
      }
    }

    // Tri par date de création descendante
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  // Récupère un patient par son ID unique
  async getPatientById(id: string): Promise<PatientRecord | null> {
    const patient = inMemoryPatients.find((p) => p.id === id);
    return patient || null;
  },

  // Génère le prochain identifiant valide pour un cabinet donné
  async getNextRecordId(cabinet: string): Promise<string> {
    const code = getCabinetCode(cabinet);
    if (!code) {
      throw new Error(`Cabinet non reconnu: ${cabinet}`);
    }

    const prefix = `CAB-${code}-`;
    let maxSeq = 0;

    for (const p of inMemoryPatients) {
      if (p.identifiant && p.identifiant.startsWith(prefix)) {
        const numPart = p.identifiant.substring(prefix.length);
        const parsed = parseInt(numPart, 10);
        if (!isNaN(parsed) && parsed > maxSeq) {
          maxSeq = parsed;
        }
      }
    }

    const nextSeq = maxSeq + 1;
    const padded = String(nextSeq).padStart(6, '0');
    return `${prefix}${padded}`;
  },

  // Création d'une nouvelle fiche patient avec validation serveur
  async createPatient(input: CreatePatientInput): Promise<PatientRecord> {
    // Validation des champs obligatoires
    if (!input.nom?.trim()) {
      throw new Error('Le nom de famille est obligatoire.');
    }
    if (!input.prenom?.trim()) {
      throw new Error('Le prénom est obligatoire.');
    }
    if (!input.sexe?.trim()) {
      throw new Error('Le sexe est obligatoire.');
    }
    if (!input.dateNaissance?.trim()) {
      throw new Error('La date de naissance est obligatoire.');
    }
    if (!input.adresse?.trim()) {
      throw new Error("L'adresse est obligatoire.");
    }
    if (!input.telephone?.trim()) {
      throw new Error('Le numéro de téléphone est obligatoire.');
    }
    const cleanCabinet = input.cabinet?.trim();
    if (!cleanCabinet || cleanCabinet.length > 100) {
      throw new Error('Un cabinet de rattachement valide est obligatoire.');
    }

    // Génération automatique de l'identifiant serveur si non fourni
    let identifiant = input.identifiant?.trim();
    if (!identifiant) {
      identifiant = await this.getNextRecordId(input.cabinet);
    } else {
      // Vérification d'unicité
      const exists = inMemoryPatients.some((p) => p.identifiant === identifiant);
      if (exists) {
        identifiant = await this.getNextRecordId(input.cabinet);
      }
    }

    const now = new Date().toISOString();
    const newRecord: PatientRecord = {
      id: `pat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      identifiant,
      nom: input.nom.trim().toUpperCase(),
      prenom: input.prenom.trim(),
      sexe: input.sexe.trim(),
      dateNaissance: input.dateNaissance.trim(),
      adresse: input.adresse.trim(),
      telephone: input.telephone.trim(),
      email: input.email?.trim() || '',
      cabinet: input.cabinet.trim(),
      profession: input.profession?.trim() || '',
      assurance: input.assurance?.trim() || '',
      allergies: Array.isArray(input.allergies) ? input.allergies : [],
      antecedents: Array.isArray(input.antecedents) ? input.antecedents : [],
      traitements: Array.isArray(input.traitements) ? input.traitements : [],
      grossesseAllaitement:
        input.sexe === 'Féminin' && Array.isArray(input.grossesseAllaitement)
          ? input.grossesseAllaitement
          : [],
      historiqueSoins: [],
      deleted: false,
      createdAt: now,
      updatedAt: now,
    };

    mutationGeneration++;
    beginPatientMutation(newRecord.id);
    inMemoryPatients.unshift(newRecord);
    persistStorage(inMemoryPatients);
    markLocalSavePending([newRecord.id]);
    enqueuePatientOp(newRecord.id, () => savePatientToFirestore(newRecord))
      .then((saved) => {
        if (saved) {
          markLocalSaveConfirmed(newRecord.id, newRecord.updatedAt);
        }
      })
      .catch((err) => {
        console.error('Erreur sauvegarde patient Firestore:', err);
      })
      .finally(() => {
        endPatientMutation(newRecord.id);
      });
    return newRecord;
  },

  // Mise a jour des informations d un patient
  async updatePatient(
    id: string,
    updates: Partial<PatientRecord>
  ): Promise<PatientRecord> {
    const index = inMemoryPatients.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new Error(`Patient avec l'ID ${id} non trouvé.`);
    }

    const current = inMemoryPatients[index];
    const nextSexe = (updates.sexe ?? current.sexe).trim();
    const updated: PatientRecord = {
      ...current,
      ...updates,
      id: current.id,
      identifiant: updates.identifiant || current.identifiant,
      nom: (updates.nom ?? current.nom).trim().toUpperCase(),
      prenom: (updates.prenom ?? current.prenom).trim(),
      sexe: nextSexe,
      dateNaissance: (updates.dateNaissance ?? current.dateNaissance).trim(),
      adresse: (updates.adresse ?? current.adresse).trim(),
      telephone: (updates.telephone ?? current.telephone).trim(),
      email: (updates.email ?? current.email ?? '').trim(),
      cabinet: (updates.cabinet ?? current.cabinet).trim(),
      profession: (updates.profession ?? current.profession ?? '').trim(),
      assurance: (updates.assurance ?? current.assurance ?? '').trim(),
      grossesseAllaitement:
        nextSexe === 'Féminin'
          ? (updates.grossesseAllaitement ?? current.grossesseAllaitement ?? [])
          : [],
      updatedAt: new Date().toISOString(),
    };

    mutationGeneration++;
    beginPatientMutation(current.id);
    inMemoryPatients[index] = updated;
    persistStorage(inMemoryPatients);
    markLocalSavePending([current.id]);
    try {
      const saved = await enqueuePatientOp(current.id, () => savePatientToFirestore(updated));
      if (saved) {
        markLocalSaveConfirmed(current.id, updated.updatedAt);
      }
    } finally {
      endPatientMutation(current.id);
      mutationGeneration++;
    }
    return updated;
  },

  // Deplacement d un patient vers la corbeille
  async moveToTrash(id: string): Promise<PatientRecord> {
    let index = inMemoryPatients.findIndex((p) => p.id === id);
    if (index === -1) {
      index = inMemoryPatients.findIndex((p) => p.identifiant === id);
    }
    if (index === -1) {
      throw new Error(`Patient avec l'ID ${id} non trouvé.`);
    }
    const current = inMemoryPatients[index];
    const now = new Date().toISOString();
    const updated: PatientRecord = {
      ...current,
      deleted: true,
      deletedAt: now,
      updatedAt: now,
    };
    mutationGeneration++;
    beginPatientMutation(current.id);
    inMemoryPatients[index] = updated;
    persistStorage(inMemoryPatients);
    markLocalSavePending([current.id]);
    try {
      const saved = await enqueuePatientOp(current.id, () =>
        updateTrashStatusInFirestore(current.id, true, updated.deletedAt, now, updated)
      );
      if (saved) {
        markLocalSaveConfirmed(current.id, updated.updatedAt);
      }
    } finally {
      endPatientMutation(current.id);
      mutationGeneration++;
    }
    return updated;
  },

  // Restauration d un patient depuis la corbeille
  async restoreFromTrash(id: string): Promise<PatientRecord> {
    let index = inMemoryPatients.findIndex((p) => p.id === id);
    if (index === -1) {
      index = inMemoryPatients.findIndex((p) => p.identifiant === id);
    }
    if (index === -1) {
      throw new Error(`Patient avec l'ID ${id} non trouvé.`);
    }
    const current = inMemoryPatients[index];
    const now = new Date().toISOString();
    const updated: PatientRecord = {
      ...current,
      deleted: false,
      updatedAt: now,
    };
    delete updated.deletedAt;
    mutationGeneration++;
    beginPatientMutation(current.id);
    inMemoryPatients[index] = updated;
    persistStorage(inMemoryPatients);
    markLocalSavePending([current.id]);
    try {
      const saved = await enqueuePatientOp(current.id, () =>
        updateTrashStatusInFirestore(current.id, false, undefined, now, updated)
      );
      if (saved) {
        markLocalSaveConfirmed(current.id, updated.updatedAt);
      }
    } finally {
      endPatientMutation(current.id);
      mutationGeneration++;
    }
    return updated;
  },

  // Suppression d'un patient (mis en corbeille)
  async deletePatient(id: string): Promise<boolean> {
    try {
      await this.moveToTrash(id);
      return true;
    } catch {
      return false;
    }
  },

  // Suppression definitive d'un patient
  async deletePatientPermanently(id: string): Promise<boolean> {
    let targetIndex = inMemoryPatients.findIndex((p) => p.id === id);
    if (targetIndex === -1) {
      targetIndex = inMemoryPatients.findIndex((p) => p.identifiant === id);
    }
    const target = targetIndex !== -1 ? inMemoryPatients[targetIndex] : undefined;
    const targetId = target ? target.id : id;

    mutationGeneration++;
    if (targetIndex !== -1) {
      inMemoryPatients.splice(targetIndex, 1);
      persistStorage(inMemoryPatients);
    }
    markPermanentlyDeleted([targetId]);
    beginPatientMutation(targetId);
    try {
      const deletedInFirestore = await enqueuePatientOp(targetId, () =>
        deletePatientFromFirestore(targetId)
      );
      if (deletedInFirestore && syncState.pendingDeletes.delete(targetId)) {
        persistSyncRegistryFile(DELETED_FILE, DATA_DIR, syncState);
      }
      return Boolean(target) || deletedInFirestore;
    } finally {
      endPatientMutation(targetId);
      mutationGeneration++;
    }
  },

  // Vider completement la corbeille
  async emptyTrash(): Promise<number> {
    const toDelete = inMemoryPatients.filter((p) => p.deleted === true);
    const deleteIds = toDelete.map((p) => p.id);
    mutationGeneration++;
    inMemoryPatients = inMemoryPatients.filter((p) => !p.deleted);
    persistStorage(inMemoryPatients);
    markPermanentlyDeleted(deleteIds);

    for (const id of deleteIds) {
      beginPatientMutation(id);
    }
    try {
      let registryChanged = false;
      for (const patient of toDelete) {
        const deletedInFirestore = await enqueuePatientOp(patient.id, () =>
          deletePatientFromFirestore(patient.id)
        );
        if (deletedInFirestore && syncState.pendingDeletes.delete(patient.id)) {
          registryChanged = true;
        }
      }
      if (registryChanged) {
        persistSyncRegistryFile(DELETED_FILE, DATA_DIR, syncState);
      }
    } finally {
      for (const id of deleteIds) {
        endPatientMutation(id);
      }
      mutationGeneration++;
    }
    return toDelete.length;
  },

  // Suppression de tous les patients
  async clearAllPatients(): Promise<void> {
    const deleteIds = inMemoryPatients.map((p) => p.id);
    mutationGeneration++;
    inMemoryPatients = [];
    persistStorage(inMemoryPatients);
    markPermanentlyDeleted(deleteIds);
    for (const id of deleteIds) {
      beginPatientMutation(id);
    }
    try {
      let registryChanged = false;
      for (const id of deleteIds) {
        const deletedInFirestore = await enqueuePatientOp(id, () =>
          deletePatientFromFirestore(id)
        );
        if (deletedInFirestore && syncState.pendingDeletes.delete(id)) {
          registryChanged = true;
        }
      }
      if (registryChanged) {
        persistSyncRegistryFile(DELETED_FILE, DATA_DIR, syncState);
      }
    } finally {
      for (const id of deleteIds) {
        endPatientMutation(id);
      }
      mutationGeneration++;
    }
  },

  // Ajout d'un acte / soin à l'historique
  async addCareItem(
    patientId: string,
    careInput: AddCareInput
  ): Promise<CareHistoryItem> {
    const patient = inMemoryPatients.find((p) => p.id === patientId);
    if (!patient) {
      throw new Error(`Patient avec l'ID ${patientId} non trouvé.`);
    }

    if (!careInput.date?.trim()) {
      throw new Error('La date du soin est obligatoire.');
    }
    if (!careInput.actesProduitsMedicaments?.trim()) {
      throw new Error('Les actes, produits ou médicaments sont obligatoires.');
    }

    const careItem: CareHistoryItem = {
      id: `care_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      date: careInput.date.trim(),
      actesProduitsMedicaments: careInput.actesProduitsMedicaments.trim(),
      observations: careInput.observations?.trim() || '',
      montant: careInput.montant?.trim() || '0 Ar',
    };

    if (!patient.historiqueSoins) {
      patient.historiqueSoins = [];
    }
    patient.historiqueSoins.unshift(careItem);
    const snapshotUpdatedAt = new Date().toISOString();
    patient.updatedAt = snapshotUpdatedAt;

    mutationGeneration++;
    persistStorage(inMemoryPatients);
    markLocalSavePending([patientId]);
    if (patient.historiqueSoins) {
      beginPatientMutation(patientId);
      enqueuePatientOp(patientId, () =>
        updateCareHistoryInFirestore(patientId, patient.historiqueSoins || [], patient)
      )
        .then((saved) => {
          if (saved) {
            markLocalSaveConfirmed(patientId, snapshotUpdatedAt);
          }
        })
        .catch((err) => {
          console.error('Erreur sauvegarde soin Firestore:', err);
        })
        .finally(() => {
          endPatientMutation(patientId);
        });
    }
    return careItem;
  },

  // Mise a jour d un soin existant dans l historique
  async updateCareItem(
    patientId: string,
    careId: string,
    careInput: AddCareInput
  ): Promise<PatientRecord> {
    const patient = inMemoryPatients.find((p) => p.id === patientId);
    if (!patient) {
      throw new Error(`Patient avec l'ID ${patientId} non trouvé.`);
    }
    if (!patient.historiqueSoins) {
      throw new Error('Soin introuvable.');
    }
    const careIndex = patient.historiqueSoins.findIndex((c) => c.id === careId);
    if (careIndex === -1) {
      throw new Error(`Soin avec l'ID ${careId} non trouvé.`);
    }
    if (!careInput.date?.trim()) {
      throw new Error('La date du soin est obligatoire.');
    }
    if (!careInput.actesProduitsMedicaments?.trim()) {
      throw new Error('Les actes, produits ou médicaments sont obligatoires.');
    }

    const updatedItem: CareHistoryItem = {
      ...patient.historiqueSoins[careIndex],
      date: careInput.date.trim(),
      actesProduitsMedicaments: careInput.actesProduitsMedicaments.trim(),
      observations: careInput.observations?.trim() || '',
      montant: careInput.montant?.trim() || '0 Ar',
    };

    const snapshotUpdatedAt = new Date().toISOString();
    patient.historiqueSoins[careIndex] = updatedItem;
    patient.updatedAt = snapshotUpdatedAt;

    mutationGeneration++;
    persistStorage(inMemoryPatients);
    markLocalSavePending([patientId]);
    beginPatientMutation(patientId);
    try {
      const saved = await enqueuePatientOp(patientId, () =>
        updateCareHistoryInFirestore(patientId, patient.historiqueSoins || [], patient)
      );
      if (saved) {
        markLocalSaveConfirmed(patientId, snapshotUpdatedAt);
      }
    } finally {
      endPatientMutation(patientId);
      mutationGeneration++;
    }
    return patient;
  },

  // Suppression d un soin de l historique
  async deleteCareItem(patientId: string, careId: string): Promise<boolean> {
    const patient = inMemoryPatients.find((p) => p.id === patientId);
    if (!patient || !patient.historiqueSoins) {
      return false;
    }

    const initialLen = patient.historiqueSoins.length;
    patient.historiqueSoins = patient.historiqueSoins.filter((c) => c.id !== careId);
    if (patient.historiqueSoins.length !== initialLen) {
      const snapshotUpdatedAt = new Date().toISOString();
      patient.updatedAt = snapshotUpdatedAt;
      mutationGeneration++;
      persistStorage(inMemoryPatients);
      markLocalSavePending([patientId]);
      if (patient.historiqueSoins) {
        beginPatientMutation(patientId);
        enqueuePatientOp(patientId, () =>
          updateCareHistoryInFirestore(patientId, patient.historiqueSoins || [], patient)
        )
          .then((saved) => {
            if (saved) {
              markLocalSaveConfirmed(patientId, snapshotUpdatedAt);
            }
          })
          .catch((err) => {
            console.error('Erreur suppression soin Firestore:', err);
          })
          .finally(() => {
            endPatientMutation(patientId);
          });
      }
      return true;
    }
    return false;
  },

  // Statistiques du cabinet
  async getStats() {
    const totalPatients = inMemoryPatients.filter((p) => !p.deleted).length;
    const byCabinet: Record<string, number> = {};
    for (const name of CabinetsService.getCabinetNames()) {
      byCabinet[name] = 0;
    }
    let totalCares = 0;

    for (const p of inMemoryPatients) {
      if (!p.deleted) {
        if (p.cabinet) {
          byCabinet[p.cabinet] = (byCabinet[p.cabinet] || 0) + 1;
        }
        totalCares += p.historiqueSoins?.length || 0;
      }
    }

    return {
      totalPatients,
      byCabinet,
      totalCares,
      serverTime: new Date().toISOString(),
    };
  },

  // Réaffectation globale des patients d'un cabinet source vers un cabinet destinataire
  async transferCabinetPatients(
    sourceCabinet: string,
    targetCabinet: string
  ): Promise<{
    sourceCabinet: string;
    targetCabinet: string;
    transferredCount: number;
    activeTransferredCount: number;
  }> {
    await syncWithFirestore();
    const sourceLower = sourceCabinet.trim().toLowerCase();
    const targetName = targetCabinet.trim();
    const now = new Date().toISOString();

    const affected: PatientRecord[] = [];
    let activeTransferredCount = 0;

    mutationGeneration++;
    inMemoryPatients = inMemoryPatients.map((patient) => {
      if ((patient.cabinet || '').trim().toLowerCase() !== sourceLower) {
        return patient;
      }
      const updated: PatientRecord = {
        ...patient,
        cabinet: targetName,
        updatedAt: now,
      };
      affected.push(updated);
      if (!updated.deleted) {
        activeTransferredCount++;
      }
      return updated;
    });

    if (affected.length === 0) {
      return {
        sourceCabinet: sourceCabinet.trim(),
        targetCabinet: targetName,
        transferredCount: 0,
        activeTransferredCount: 0,
      };
    }

    persistStorage(inMemoryPatients);
    markLocalSavePending(affected.map((p) => p.id));

    for (const patient of affected) {
      beginPatientMutation(patient.id);
    }

    try {
      await Promise.allSettled(
        affected.map(async (patient) => {
          const saved = await enqueuePatientOp(patient.id, () =>
            savePatientToFirestore(patient)
          );
          if (saved) {
            markLocalSaveConfirmed(patient.id, patient.updatedAt);
          }
        })
      );
    } finally {
      for (const patient of affected) {
        endPatientMutation(patient.id);
      }
      mutationGeneration++;
    }

    return {
      sourceCabinet: sourceCabinet.trim(),
      targetCabinet: targetName,
      transferredCount: affected.length,
      activeTransferredCount,
    };
  },
};
