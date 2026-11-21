import fs from 'fs';
import path from 'path';
import { PriseEnChargeItem } from '../types';
import {
  fetchCoveragesFromFirestoreWithStatus,
  saveCoverageToFirestore,
  updateCoverageStatusInFirestore,
  deleteCoverageFromFirestore,
} from './coverages_sync';
import {
  loadSyncRegistryFile,
  persistSyncRegistryFile,
  reconcileBidirectionalSync,
  SyncStateSets,
} from './firestore_sync';
import { resolveWritableDataDir } from '../path_utils';

const DATA_DIR = resolveWritableDataDir(import.meta.url);
const DATA_FILE = path.join(DATA_DIR, 'prises_en_charge.json');
const DELETED_FILE = path.join(DATA_DIR, 'deleted_coverages.json');

// STOCKAGE LOCAL ET REGISTRE DE SYNCHRONISATION
function ensureStorage(): PriseEnChargeItem[] {
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
    console.error('Erreur lecture prises_en_charge.json:', error);
    return [];
  }
}

function persistStorage(items: PriseEnChargeItem[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), 'utf-8');
  } catch (error) {
    console.error('Erreur ecriture prises_en_charge.json:', error);
  }
}

const rawInitialCoverages = ensureStorage();
const { registry: initialRegistry, existed: registryExisted } = loadSyncRegistryFile(
  DELETED_FILE,
  rawInitialCoverages.map((item) => item.id)
);
const syncState: SyncStateSets = {
  deletedIds: new Set<string>(initialRegistry.deletedIds),
  pendingDeletes: new Set<string>(initialRegistry.pendingDeletes),
  pendingSaves: new Set<string>(initialRegistry.pendingSaves),
  syncedIds: new Set<string>(initialRegistry.syncedIds),
};
let inMemoryCoverages: PriseEnChargeItem[] = rawInitialCoverages.filter(
  (item) => !syncState.deletedIds.has(item.id)
);
if (!registryExisted) {
  persistSyncRegistryFile(DELETED_FILE, DATA_DIR, syncState);
}

let activeSyncPromise: Promise<boolean> | null = null;
const pendingMutations = new Set<string>();
const pendingMutationCounts = new Map<string, number>();
const coverageOpQueues = new Map<string, Promise<unknown>>();
let mutationGeneration = 0;

function beginCoverageMutation(coverageId: string): void {
  const count = (pendingMutationCounts.get(coverageId) || 0) + 1;
  pendingMutationCounts.set(coverageId, count);
  pendingMutations.add(coverageId);
}

function endCoverageMutation(coverageId: string): void {
  const count = (pendingMutationCounts.get(coverageId) || 1) - 1;
  if (count <= 0) {
    pendingMutationCounts.delete(coverageId);
    pendingMutations.delete(coverageId);
  } else {
    pendingMutationCounts.set(coverageId, count);
  }
}

function enqueueCoverageOp<T>(coverageId: string, task: () => Promise<T>): Promise<T> {
  const previous = coverageOpQueues.get(coverageId) || Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  const tracked = next.finally(() => {
    if (coverageOpQueues.get(coverageId) === tracked) {
      coverageOpQueues.delete(coverageId);
    }
  });
  coverageOpQueues.set(coverageId, tracked);
  return next;
}

function markLocalSavePending(id: string): void {
  if (!id || syncState.pendingSaves.has(id)) return;
  syncState.pendingSaves.add(id);
  persistSyncRegistryFile(DELETED_FILE, DATA_DIR, syncState);
}

function markLocalSaveConfirmed(id: string, snapshotUpdatedAt?: string): void {
  const current = inMemoryCoverages.find((item) => item.id === id);
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
    const ok = await enqueueCoverageOp(id, () => deleteCoverageFromFirestore(id));
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

// SYNCHRONISATION BIDIRECTIONNELLE PRISES EN CHARGE AVEC FIRESTORE
async function syncCoveragesWithFirestore(): Promise<boolean> {
  if (activeSyncPromise) {
    return activeSyncPromise;
  }
  activeSyncPromise = (async () => {
    try {
      await flushPendingFirestoreDeletes();
      const syncStartGen = mutationGeneration;
      const { ok, coverages: firestoreCoverages } =
        await fetchCoveragesFromFirestoreWithStatus();
      if (!ok || mutationGeneration !== syncStartGen) {
        return false;
      }

      const result = reconcileBidirectionalSync<PriseEnChargeItem>({
        localItems: inMemoryCoverages,
        firestoreItems: firestoreCoverages,
        state: syncState,
        pendingMutations,
        opQueues: coverageOpQueues,
        getTimestamp: (item) => Date.parse(item.updatedAt || item.createdAt || '') || 0,
      });

      if (mutationGeneration !== syncStartGen) {
        return false;
      }

      inMemoryCoverages = result.mergedItems;
      persistStorage(inMemoryCoverages);
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
        const localItem = inMemoryCoverages.find((item) => item.id === pushId);
        if (!localItem) {
          if (syncState.pendingSaves.delete(pushId)) {
            pushRegistryChanged = true;
          }
          continue;
        }
        const snapshotUpdatedAt = localItem.updatedAt;
        const saved = await enqueueCoverageOp(pushId, () => saveCoverageToFirestore(localItem));
        if (saved) {
          const latest = inMemoryCoverages.find((item) => item.id === pushId);
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
          enqueueCoverageOp(ghostId, () => deleteCoverageFromFirestore(ghostId)).then(
            (deleted) => {
              if (deleted && syncState.pendingDeletes.delete(ghostId)) {
                persistSyncRegistryFile(DELETED_FILE, DATA_DIR, syncState);
              }
            }
          );
        }
      }
      return true;
    } catch (error) {
      console.error('Erreur synchronisation prises en charge Firestore:', error);
      return false;
    } finally {
      activeSyncPromise = null;
    }
  })();
  return activeSyncPromise;
}

syncCoveragesWithFirestore();

export interface CreatePriseEnChargeInput {
  cabinetDentaire: string;
  numeroFacture: string;
  montantProposeAriary: string;
  montantAssuranceAriary: string;
  patientNomPrenom: string;
  nomSociete: string;
  agence: string;
  numeroPriseEnCharge: string;
  dateAttestation?: string;
  createursPriseEnCharge?: string;
  dateEnvoi?: string;
}

function normalizeInvoiceNumber(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const cleaned = trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '/')
    .replace(/^\/+|\/+$/g, '');
  if (!cleaned) {
    return trimmed.toLowerCase();
  }
  return cleaned
    .split('/')
    .map((part) => (/^\d+$/.test(part) ? part.replace(/^0+/, '') || '0' : part))
    .join('/');
}

export const CoveragesService = {
  syncNow(): Promise<boolean> {
    return syncCoveragesWithFirestore();
  },

  async getAllCoverages(inTrash = false): Promise<PriseEnChargeItem[]> {
    await syncCoveragesWithFirestore();
    const filtered = inTrash
      ? inMemoryCoverages.filter((item) => Boolean(item.deleted))
      : inMemoryCoverages.filter((item) => !item.deleted);
    return filtered.sort((a, b) => {
      const tA = Date.parse((inTrash ? a.deletedAt : a.createdAt) || a.createdAt || '') || 0;
      const tB = Date.parse((inTrash ? b.deletedAt : b.createdAt) || b.createdAt || '') || 0;
      return tB - tA;
    });
  },

  async createCoverage(input: CreatePriseEnChargeInput): Promise<PriseEnChargeItem> {
    await syncCoveragesWithFirestore().catch(() => undefined);

    const cabinetDentaire = String(input.cabinetDentaire || '').trim();
    const numeroFacture = String(input.numeroFacture || '').trim();
    const montantProposeAriary = String(input.montantProposeAriary || '').trim();
    const montantAssuranceAriary = String(input.montantAssuranceAriary || '').trim();
    const patientNomPrenom = String(input.patientNomPrenom || '').trim();
    const nomSociete = String(input.nomSociete || '').trim();
    const agence = String(input.agence || '').trim();
    const numeroPriseEnCharge = String(input.numeroPriseEnCharge || '').trim();

    if (!cabinetDentaire) {
      throw new Error('Le cabinet dentaire est obligatoire.');
    }
    if (!numeroFacture) {
      throw new Error('Le numéro de facture est obligatoire.');
    }
    if (numeroFacture.length > 100) {
      throw new Error('Le numéro de facture ne doit pas dépasser 100 caractères.');
    }

    const normalizedInvoice = normalizeInvoiceNumber(numeroFacture);
    const duplicateInvoice = inMemoryCoverages.some(
      (item) =>
        !item.deleted &&
        normalizeInvoiceNumber(item.numeroFacture || '') === normalizedInvoice
    );
    if (duplicateInvoice) {
      throw new Error('Ce numéro de facture existe déjà. Chaque numéro de facture doit être unique.');
    }

    if (!montantProposeAriary || Number.isNaN(Number(montantProposeAriary))) {
      throw new Error('Le montant proposé est obligatoire.');
    }
    if (!montantAssuranceAriary || Number.isNaN(Number(montantAssuranceAriary))) {
      throw new Error("Le montant donné par l'assurance est obligatoire.");
    }
    if (!patientNomPrenom) {
      throw new Error('Le nom et prénom du patient sont obligatoires.');
    }
    if (!nomSociete) {
      throw new Error('Le nom de la société est obligatoire.');
    }
    if (!agence) {
      throw new Error("L'agence est obligatoire.");
    }
    if (!numeroPriseEnCharge) {
      throw new Error('Le numéro de prise en charge est obligatoire.');
    }

    const now = new Date().toISOString();
    const newItem: PriseEnChargeItem = {
      id: `pec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      cabinetDentaire,
      numeroFacture,
      montantProposeAriary,
      montantAssuranceAriary,
      patientNomPrenom,
      nomSociete,
      agence,
      numeroPriseEnCharge,
      dateAttestation: String(input.dateAttestation || '').trim(),
      createursPriseEnCharge: String(input.createursPriseEnCharge || '').trim(),
      dateEnvoi: String(input.dateEnvoi || '').trim(),
      etatTraitement: 'En cours',
      dateObtentionCheque: '',
      deleted: false,
      createdAt: now,
      updatedAt: now,
    };

    mutationGeneration++;
    beginCoverageMutation(newItem.id);
    inMemoryCoverages.unshift(newItem);
    persistStorage(inMemoryCoverages);
    markLocalSavePending(newItem.id);

    enqueueCoverageOp(newItem.id, () => saveCoverageToFirestore(newItem))
      .then((saved) => {
        if (saved) {
          markLocalSaveConfirmed(newItem.id, newItem.updatedAt);
        }
      })
      .finally(() => {
        endCoverageMutation(newItem.id);
      });

    return newItem;
  },

  async updateCoverageStatus(
    id: string,
    etatTraitement: string,
    dateObtentionCheque?: string
  ): Promise<PriseEnChargeItem> {
    if (etatTraitement !== 'En cours' && etatTraitement !== 'Reçu') {
      throw new Error("L'état de traitement doit être 'En cours' ou 'Reçu'.");
    }
    const cleanDateObtentionCheque = String(dateObtentionCheque || '').trim();
    if (cleanDateObtentionCheque.length > 20) {
      throw new Error("La date d'obtention de chèque est invalide.");
    }
    const index = inMemoryCoverages.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error(`Prise en charge avec l'ID ${id} introuvable.`);
    }

    const now = new Date().toISOString();
    const updated: PriseEnChargeItem = {
      ...inMemoryCoverages[index],
      etatTraitement,
      dateObtentionCheque: cleanDateObtentionCheque,
      updatedAt: now,
    };

    mutationGeneration++;
    beginCoverageMutation(id);
    inMemoryCoverages[index] = updated;
    persistStorage(inMemoryCoverages);
    markLocalSavePending(id);

    enqueueCoverageOp(id, () =>
      updateCoverageStatusInFirestore(
        id,
        etatTraitement,
        cleanDateObtentionCheque,
        now,
        updated
      )
    )
      .then((saved) => {
        if (saved) {
          markLocalSaveConfirmed(id, now);
        }
      })
      .finally(() => {
        endCoverageMutation(id);
      });

    return updated;
  },

  async updateCoverage(
    id: string,
    input: CreatePriseEnChargeInput
  ): Promise<PriseEnChargeItem> {
    await syncCoveragesWithFirestore().catch(() => undefined);

    const index = inMemoryCoverages.findIndex((item) => item.id === id && !item.deleted);
    if (index === -1) {
      throw new Error(`Prise en charge avec l'ID ${id} introuvable.`);
    }

    const cabinetDentaire = String(input.cabinetDentaire || '').trim();
    const numeroFacture = String(input.numeroFacture || '').trim();
    const montantProposeAriary = String(input.montantProposeAriary || '').trim();
    const montantAssuranceAriary = String(input.montantAssuranceAriary || '').trim();
    const patientNomPrenom = String(input.patientNomPrenom || '').trim();
    const nomSociete = String(input.nomSociete || '').trim();
    const agence = String(input.agence || '').trim();
    const numeroPriseEnCharge = String(input.numeroPriseEnCharge || '').trim();

    if (!cabinetDentaire) {
      throw new Error('Le cabinet dentaire est obligatoire.');
    }
    if (!numeroFacture) {
      throw new Error('Le numéro de facture est obligatoire.');
    }
    if (numeroFacture.length > 100) {
      throw new Error('Le numéro de facture ne doit pas dépasser 100 caractères.');
    }

    const normalizedInvoice = normalizeInvoiceNumber(numeroFacture);
    const duplicateInvoice = inMemoryCoverages.some(
      (item) =>
        item.id !== id &&
        !item.deleted &&
        normalizeInvoiceNumber(item.numeroFacture || '') === normalizedInvoice
    );
    if (duplicateInvoice) {
      throw new Error('Ce numéro de facture existe déjà. Chaque numéro de facture doit être unique.');
    }

    if (!montantProposeAriary || Number.isNaN(Number(montantProposeAriary))) {
      throw new Error('Le montant proposé est obligatoire.');
    }
    if (!montantAssuranceAriary || Number.isNaN(Number(montantAssuranceAriary))) {
      throw new Error("Le montant donné par l'assurance est obligatoire.");
    }
    if (!patientNomPrenom) {
      throw new Error('Le nom et prénom du patient sont obligatoires.');
    }
    if (!nomSociete) {
      throw new Error('Le nom de la société est obligatoire.');
    }
    if (!agence) {
      throw new Error("L'agence est obligatoire.");
    }
    if (!numeroPriseEnCharge) {
      throw new Error('Le numéro de prise en charge est obligatoire.');
    }

    const existing = inMemoryCoverages[index];
    const now = new Date().toISOString();
    const updated: PriseEnChargeItem = {
      ...existing,
      cabinetDentaire,
      numeroFacture,
      montantProposeAriary,
      montantAssuranceAriary,
      patientNomPrenom,
      nomSociete,
      agence,
      numeroPriseEnCharge,
      dateAttestation: String(input.dateAttestation || '').trim(),
      createursPriseEnCharge: String(input.createursPriseEnCharge || '').trim(),
      dateEnvoi: String(input.dateEnvoi || '').trim(),
      updatedAt: now,
    };

    mutationGeneration++;
    beginCoverageMutation(id);
    inMemoryCoverages[index] = updated;
    persistStorage(inMemoryCoverages);
    markLocalSavePending(id);

    enqueueCoverageOp(id, () => saveCoverageToFirestore(updated))
      .then((saved) => {
        if (saved) {
          markLocalSaveConfirmed(id, now);
        }
      })
      .finally(() => {
        endCoverageMutation(id);
      });

    return updated;
  },

  async moveToTrash(id: string): Promise<PriseEnChargeItem> {
    const index = inMemoryCoverages.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error(`Prise en charge avec l'ID ${id} introuvable.`);
    }
    const now = new Date().toISOString();
    const updated: PriseEnChargeItem = {
      ...inMemoryCoverages[index],
      deleted: true,
      deletedAt: now,
      updatedAt: now,
    };

    mutationGeneration++;
    beginCoverageMutation(id);
    inMemoryCoverages[index] = updated;
    persistStorage(inMemoryCoverages);
    markLocalSavePending(id);

    enqueueCoverageOp(id, () => saveCoverageToFirestore(updated))
      .then((saved) => {
        if (saved) {
          markLocalSaveConfirmed(id, now);
        }
      })
      .finally(() => {
        endCoverageMutation(id);
      });

    return updated;
  },

  async restoreFromTrash(id: string): Promise<PriseEnChargeItem> {
    const index = inMemoryCoverages.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error(`Prise en charge avec l'ID ${id} introuvable.`);
    }

    const target = inMemoryCoverages[index];
    const normalizedInvoice = normalizeInvoiceNumber(target.numeroFacture || '');
    if (normalizedInvoice) {
      const duplicateInvoice = inMemoryCoverages.some(
        (item) =>
          item.id !== id &&
          !item.deleted &&
          normalizeInvoiceNumber(item.numeroFacture || '') === normalizedInvoice
      );
      if (duplicateInvoice) {
        throw new Error(
          `Impossible de restaurer : le numéro de facture ${target.numeroFacture} est déjà utilisé par une prise en charge active.`
        );
      }
    }

    const now = new Date().toISOString();
    const updated: PriseEnChargeItem = {
      ...target,
      deleted: false,
      updatedAt: now,
    };
    delete updated.deletedAt;

    mutationGeneration++;
    beginCoverageMutation(id);
    inMemoryCoverages[index] = updated;
    persistStorage(inMemoryCoverages);
    markLocalSavePending(id);

    enqueueCoverageOp(id, () => saveCoverageToFirestore(updated))
      .then((saved) => {
        if (saved) {
          markLocalSaveConfirmed(id, now);
        }
      })
      .finally(() => {
        endCoverageMutation(id);
      });

    return updated;
  },

  async deleteCoveragePermanently(id: string): Promise<boolean> {
    const existed = inMemoryCoverages.some((item) => item.id === id);
    mutationGeneration++;
    beginCoverageMutation(id);
    markPermanentlyDeleted([id]);
    inMemoryCoverages = inMemoryCoverages.filter((item) => item.id !== id);
    persistStorage(inMemoryCoverages);

    try {
      const ok = await enqueueCoverageOp(id, () => deleteCoverageFromFirestore(id));
      if (ok && syncState.pendingDeletes.delete(id)) {
        persistSyncRegistryFile(DELETED_FILE, DATA_DIR, syncState);
      }
      return existed || ok;
    } finally {
      endCoverageMutation(id);
    }
  },

  async emptyTrash(): Promise<number> {
    const toDelete = inMemoryCoverages.filter((item) => item.deleted === true);
    const deleteIds = toDelete.map((item) => item.id);
    mutationGeneration++;
    for (const id of deleteIds) {
      beginCoverageMutation(id);
    }
    markPermanentlyDeleted(deleteIds);
    inMemoryCoverages = inMemoryCoverages.filter((item) => !item.deleted);
    persistStorage(inMemoryCoverages);

    await Promise.all(
      deleteIds.map(async (id) => {
        try {
          const ok = await enqueueCoverageOp(id, () => deleteCoverageFromFirestore(id));
          if (ok) {
            syncState.pendingDeletes.delete(id);
          }
        } finally {
          endCoverageMutation(id);
        }
      })
    );
    persistSyncRegistryFile(DELETED_FILE, DATA_DIR, syncState);
    return toDelete.length;
  },
};
