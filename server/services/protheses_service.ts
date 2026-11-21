import fs from 'fs';
import path from 'path';
import { ProtheseItem } from '../types';
import {
  fetchProthesesFromFirestoreWithStatus,
  saveProthesisToFirestore,
  updateProthesisStatusInFirestore,
  deleteProthesisFromFirestore,
} from './protheses_sync';
import {
  loadSyncRegistryFile,
  persistSyncRegistryFile,
  reconcileBidirectionalSync,
  SyncStateSets,
} from './firestore_sync';
import { resolveWritableDataDir } from '../path_utils';

const DATA_DIR = resolveWritableDataDir(import.meta.url);
const DATA_FILE = path.join(DATA_DIR, 'protheses.json');
const DELETED_FILE = path.join(DATA_DIR, 'deleted_protheses.json');

// STOCKAGE LOCAL ET REGISTRE DE SYNCHRONISATION
function ensureStorage(): ProtheseItem[] {
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
    console.error('Erreur lecture protheses.json:', error);
    return [];
  }
}

function persistStorage(items: ProtheseItem[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), 'utf-8');
  } catch (error) {
    console.error('Erreur ecriture protheses.json:', error);
  }
}

const rawInitialProtheses = ensureStorage();
const { registry: initialRegistry, existed: registryExisted } = loadSyncRegistryFile(
  DELETED_FILE,
  rawInitialProtheses.map((item) => item.id)
);
const syncState: SyncStateSets = {
  deletedIds: new Set<string>(initialRegistry.deletedIds),
  pendingDeletes: new Set<string>(initialRegistry.pendingDeletes),
  pendingSaves: new Set<string>(initialRegistry.pendingSaves),
  syncedIds: new Set<string>(initialRegistry.syncedIds),
};
let inMemoryProtheses: ProtheseItem[] = rawInitialProtheses.filter(
  (item) => !syncState.deletedIds.has(item.id)
);
if (!registryExisted) {
  persistSyncRegistryFile(DELETED_FILE, DATA_DIR, syncState);
}

let activeSyncPromise: Promise<boolean> | null = null;
const pendingMutations = new Set<string>();
const pendingMutationCounts = new Map<string, number>();
const prothesisOpQueues = new Map<string, Promise<unknown>>();
let mutationGeneration = 0;

function beginProthesisMutation(prothesisId: string): void {
  const count = (pendingMutationCounts.get(prothesisId) || 0) + 1;
  pendingMutationCounts.set(prothesisId, count);
  pendingMutations.add(prothesisId);
}

function endProthesisMutation(prothesisId: string): void {
  const count = (pendingMutationCounts.get(prothesisId) || 1) - 1;
  if (count <= 0) {
    pendingMutationCounts.delete(prothesisId);
    pendingMutations.delete(prothesisId);
  } else {
    pendingMutationCounts.set(prothesisId, count);
  }
}

function enqueueProthesisOp<T>(prothesisId: string, task: () => Promise<T>): Promise<T> {
  const previous = prothesisOpQueues.get(prothesisId) || Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  const tracked = next.finally(() => {
    if (prothesisOpQueues.get(prothesisId) === tracked) {
      prothesisOpQueues.delete(prothesisId);
    }
  });
  prothesisOpQueues.set(prothesisId, tracked);
  return next;
}

function markLocalSavePending(id: string): void {
  if (!id || syncState.pendingSaves.has(id)) return;
  syncState.pendingSaves.add(id);
  persistSyncRegistryFile(DELETED_FILE, DATA_DIR, syncState);
}

function markLocalSaveConfirmed(id: string, snapshotUpdatedAt?: string): void {
  const current = inMemoryProtheses.find((item) => item.id === id);
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
    const ok = await enqueueProthesisOp(id, () => deleteProthesisFromFirestore(id));
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

// SYNCHRONISATION BIDIRECTIONNELLE PROTHESES DENTAIRES AVEC FIRESTORE
async function syncProthesesWithFirestore(): Promise<boolean> {
  if (activeSyncPromise) {
    return activeSyncPromise;
  }
  activeSyncPromise = (async () => {
    try {
      await flushPendingFirestoreDeletes();
      const syncStartGen = mutationGeneration;
      const { ok, protheses: firestoreProtheses } =
        await fetchProthesesFromFirestoreWithStatus();
      if (!ok || mutationGeneration !== syncStartGen) {
        return false;
      }

      const result = reconcileBidirectionalSync<ProtheseItem>({
        localItems: inMemoryProtheses,
        firestoreItems: firestoreProtheses,
        state: syncState,
        pendingMutations,
        opQueues: prothesisOpQueues,
        getTimestamp: (item) => Date.parse(item.updatedAt || item.createdAt || '') || 0,
      });

      if (mutationGeneration !== syncStartGen) {
        return false;
      }

      inMemoryProtheses = result.mergedItems;
      persistStorage(inMemoryProtheses);
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
        const localItem = inMemoryProtheses.find((item) => item.id === pushId);
        if (!localItem) {
          if (syncState.pendingSaves.delete(pushId)) {
            pushRegistryChanged = true;
          }
          continue;
        }
        const snapshotUpdatedAt = localItem.updatedAt;
        const saved = await enqueueProthesisOp(pushId, () => saveProthesisToFirestore(localItem));
        if (saved) {
          const latest = inMemoryProtheses.find((item) => item.id === pushId);
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
          enqueueProthesisOp(ghostId, () => deleteProthesisFromFirestore(ghostId)).then(
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
      console.error('Erreur synchronisation protheses Firestore:', error);
      return false;
    } finally {
      activeSyncPromise = null;
    }
  })();
  return activeSyncPromise;
}

syncProthesesWithFirestore();

export interface CreateProtheseInput {
  id?: string;
  cabinetDentaire: string;
  patientNomPrenom: string;
  patientContact?: string;
  numeroDentaire: string;
  typeProthese: string;
  teinteProthese?: string;
  nomLaboratoire: string;
  nomCreateurProthese?: string;
  dateEnvoi: string;
  dateLivraison?: string;
  montant: string;
  etatTraitement?: string;
  deleted?: boolean;
  deletedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

function validateProtheseInput(input: CreateProtheseInput): {
  cabinetDentaire: string;
  patientNomPrenom: string;
  patientContact: string;
  numeroDentaire: string;
  typeProthese: string;
  teinteProthese: string;
  nomLaboratoire: string;
  nomCreateurProthese: string;
  dateEnvoi: string;
  dateLivraison: string;
  montant: string;
} {
  const cabinetDentaire = String(input.cabinetDentaire || '').trim();
  const patientNomPrenom = String(input.patientNomPrenom || '').trim();
  const patientContact = String(input.patientContact || '').trim();
  const numeroDentaire = String(input.numeroDentaire || '').trim();
  const typeProthese = String(input.typeProthese || '').trim();
  const teinteProthese = String(input.teinteProthese || '').trim();
  const nomLaboratoire = String(input.nomLaboratoire || '').trim();
  const nomCreateurProthese = String(input.nomCreateurProthese || '').trim();
  const dateEnvoi = String(input.dateEnvoi || '').trim();
  const dateLivraison = String(input.dateLivraison || '').trim();
  const montant = String(input.montant || '').trim();

  if (!cabinetDentaire || cabinetDentaire.length > 100) {
    throw new Error('Le cabinet dentaire est obligatoire.');
  }
  if (!patientNomPrenom || patientNomPrenom.length > 200) {
    throw new Error('Le nom et prénom du patient sont obligatoires.');
  }
  if (!numeroDentaire || numeroDentaire.length > 100) {
    throw new Error('Le numéro dentaire est obligatoire.');
  }
  if (!typeProthese || typeProthese.length > 150) {
    throw new Error('Le type de prothèse est obligatoire.');
  }
  if (!nomLaboratoire || nomLaboratoire.length > 150) {
    throw new Error('Le nom du laboratoire est obligatoire.');
  }
  if (!dateEnvoi || dateEnvoi.length > 20) {
    throw new Error("La date d'envoi est obligatoire.");
  }
  if (!montant || montant.length > 50) {
    throw new Error('Le montant est obligatoire.');
  }

  return {
    cabinetDentaire,
    patientNomPrenom,
    patientContact: patientContact.slice(0, 100),
    numeroDentaire,
    typeProthese,
    teinteProthese: teinteProthese.slice(0, 50),
    nomLaboratoire,
    nomCreateurProthese: nomCreateurProthese.slice(0, 150),
    dateEnvoi,
    dateLivraison: dateLivraison.slice(0, 20),
    montant,
  };
}

export const ProthesesService = {
  syncNow(): Promise<boolean> {
    return syncProthesesWithFirestore();
  },

  async getAllProtheses(inTrash = false): Promise<ProtheseItem[]> {
    await syncProthesesWithFirestore();
    const filtered = inTrash
      ? inMemoryProtheses.filter((item) => Boolean(item.deleted))
      : inMemoryProtheses.filter((item) => !item.deleted);
    return filtered.sort((a, b) => {
      const tA = Date.parse((inTrash ? a.deletedAt : a.createdAt) || a.createdAt || '') || 0;
      const tB = Date.parse((inTrash ? b.deletedAt : b.createdAt) || b.createdAt || '') || 0;
      return tB - tA;
    });
  },

  async createProthesis(input: CreateProtheseInput): Promise<ProtheseItem> {
    await syncProthesesWithFirestore().catch(() => undefined);

    const validated = validateProtheseInput(input);
    const requestedId =
      typeof input.id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(input.id.trim())
        ? input.id.trim()
        : '';

    if (requestedId) {
      const existing = inMemoryProtheses.find((item) => item.id === requestedId);
      if (existing) {
        const saved = await enqueueProthesisOp(existing.id, () =>
          saveProthesisToFirestore(existing)
        ).catch(() => false);
        if (saved) {
          markLocalSaveConfirmed(existing.id, existing.updatedAt);
        }
        return existing;
      }
      if (syncState.deletedIds.has(requestedId)) {
        throw new Error('Cette prothèse a déjà été supprimée définitivement.');
      }
    }

    const now = new Date().toISOString();
    const newItem: ProtheseItem = {
      id: requestedId || `proth_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ...validated,
      etatTraitement: input.etatTraitement === 'Terminer' ? 'Terminer' : 'En cours',
      deleted: Boolean(input.deleted),
      deletedAt: input.deleted && input.deletedAt ? String(input.deletedAt) : undefined,
      createdAt:
        typeof input.createdAt === 'string' && input.createdAt.trim()
          ? input.createdAt.trim().slice(0, 40)
          : now,
      updatedAt:
        typeof input.updatedAt === 'string' && input.updatedAt.trim()
          ? input.updatedAt.trim().slice(0, 40)
          : now,
    };

    mutationGeneration++;
    beginProthesisMutation(newItem.id);
    inMemoryProtheses.unshift(newItem);
    persistStorage(inMemoryProtheses);
    markLocalSavePending(newItem.id);

    try {
      const saved = await enqueueProthesisOp(newItem.id, () =>
        saveProthesisToFirestore(newItem)
      );
      if (saved) {
        markLocalSaveConfirmed(newItem.id, newItem.updatedAt);
      }
    } finally {
      endProthesisMutation(newItem.id);
    }

    return newItem;
  },

  async updateProthesisStatus(
    id: string,
    etatTraitement: string
  ): Promise<ProtheseItem> {
    if (etatTraitement !== 'En cours' && etatTraitement !== 'Terminer') {
      throw new Error("L'état de traitement doit être 'En cours' ou 'Terminer'.");
    }
    const index = inMemoryProtheses.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error(`Prothèse avec l'ID ${id} introuvable.`);
    }

    const now = new Date().toISOString();
    const updated: ProtheseItem = {
      ...inMemoryProtheses[index],
      etatTraitement,
      updatedAt: now,
    };

    mutationGeneration++;
    beginProthesisMutation(id);
    inMemoryProtheses[index] = updated;
    persistStorage(inMemoryProtheses);
    markLocalSavePending(id);

    try {
      const saved = await enqueueProthesisOp(id, () =>
        updateProthesisStatusInFirestore(id, etatTraitement, now, updated)
      );
      if (saved) {
        markLocalSaveConfirmed(id, now);
      }
    } finally {
      endProthesisMutation(id);
    }

    return updated;
  },

  async updateProthesis(id: string, input: CreateProtheseInput): Promise<ProtheseItem> {
    await syncProthesesWithFirestore().catch(() => undefined);

    const index = inMemoryProtheses.findIndex((item) => item.id === id && !item.deleted);
    if (index === -1) {
      throw new Error(`Prothèse avec l'ID ${id} introuvable.`);
    }

    const validated = validateProtheseInput(input);
    const existing = inMemoryProtheses[index];
    const now = new Date().toISOString();
    const updated: ProtheseItem = {
      ...existing,
      ...validated,
      updatedAt: now,
    };

    mutationGeneration++;
    beginProthesisMutation(id);
    inMemoryProtheses[index] = updated;
    persistStorage(inMemoryProtheses);
    markLocalSavePending(id);

    try {
      const saved = await enqueueProthesisOp(id, () => saveProthesisToFirestore(updated));
      if (saved) {
        markLocalSaveConfirmed(id, now);
      }
    } finally {
      endProthesisMutation(id);
    }

    return updated;
  },

  async moveToTrash(id: string): Promise<ProtheseItem> {
    const index = inMemoryProtheses.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error(`Prothèse avec l'ID ${id} introuvable.`);
    }
    const now = new Date().toISOString();
    const updated: ProtheseItem = {
      ...inMemoryProtheses[index],
      deleted: true,
      deletedAt: now,
      updatedAt: now,
    };

    mutationGeneration++;
    beginProthesisMutation(id);
    inMemoryProtheses[index] = updated;
    persistStorage(inMemoryProtheses);
    markLocalSavePending(id);

    try {
      const saved = await enqueueProthesisOp(id, () => saveProthesisToFirestore(updated));
      if (saved) {
        markLocalSaveConfirmed(id, now);
      }
    } finally {
      endProthesisMutation(id);
    }

    return updated;
  },

  async restoreFromTrash(id: string): Promise<ProtheseItem> {
    const index = inMemoryProtheses.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error(`Prothèse avec l'ID ${id} introuvable.`);
    }
    const target = inMemoryProtheses[index];
    const now = new Date().toISOString();
    const updated: ProtheseItem = {
      ...target,
      deleted: false,
      updatedAt: now,
    };
    delete updated.deletedAt;

    mutationGeneration++;
    beginProthesisMutation(id);
    inMemoryProtheses[index] = updated;
    persistStorage(inMemoryProtheses);
    markLocalSavePending(id);

    try {
      const saved = await enqueueProthesisOp(id, () => saveProthesisToFirestore(updated));
      if (saved) {
        markLocalSaveConfirmed(id, now);
      }
    } finally {
      endProthesisMutation(id);
    }

    return updated;
  },

  async deleteProthesisPermanently(id: string): Promise<boolean> {
    const existed = inMemoryProtheses.some((item) => item.id === id);
    mutationGeneration++;
    beginProthesisMutation(id);
    markPermanentlyDeleted([id]);
    inMemoryProtheses = inMemoryProtheses.filter((item) => item.id !== id);
    persistStorage(inMemoryProtheses);

    try {
      const ok = await enqueueProthesisOp(id, () => deleteProthesisFromFirestore(id));
      if (ok && syncState.pendingDeletes.delete(id)) {
        persistSyncRegistryFile(DELETED_FILE, DATA_DIR, syncState);
      }
      return existed || ok;
    } finally {
      endProthesisMutation(id);
    }
  },

  async emptyTrash(): Promise<number> {
    const toDelete = inMemoryProtheses.filter((item) => item.deleted === true);
    const deleteIds = toDelete.map((item) => item.id);
    mutationGeneration++;
    for (const id of deleteIds) {
      beginProthesisMutation(id);
    }
    markPermanentlyDeleted(deleteIds);
    inMemoryProtheses = inMemoryProtheses.filter((item) => !item.deleted);
    persistStorage(inMemoryProtheses);

    await Promise.all(
      deleteIds.map(async (id) => {
        try {
          const ok = await enqueueProthesisOp(id, () => deleteProthesisFromFirestore(id));
          if (ok) {
            syncState.pendingDeletes.delete(id);
          }
        } finally {
          endProthesisMutation(id);
        }
      })
    );
    persistSyncRegistryFile(DELETED_FILE, DATA_DIR, syncState);
    return toDelete.length;
  },
};
