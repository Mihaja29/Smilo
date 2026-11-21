import fs from 'fs';
import path from 'path';
import { AssuranceItem } from '../types';
import {
  fetchAssurancesFromFirestoreWithStatus,
  saveAssuranceToFirestore,
  updateAssuranceTrashInFirestore,
  deleteAssuranceFromFirestore,
  loadSyncRegistryFile,
  persistSyncRegistryFile,
  reconcileBidirectionalSync,
  SyncStateSets,
} from './firestore_sync';
import { resolveWritableDataDir } from '../path_utils';

export type { AssuranceItem };

const DATA_DIR = resolveWritableDataDir(import.meta.url);
const DATA_FILE = path.join(DATA_DIR, 'assurances.json');
const DELETED_FILE = path.join(DATA_DIR, 'deleted_assurances.json');

// STOCKAGE LOCAL ET REGISTRE DE SYNCHRONISATION
function ensureStorage(): AssuranceItem[] {
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
    console.error('Erreur lecture assurances.json:', error);
    return [];
  }
}

function persistStorage(items: AssuranceItem[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), 'utf-8');
  } catch (error) {
    console.error('Erreur ecriture assurances.json:', error);
  }
}

const rawInitialAssurances = ensureStorage();
const { registry: initialRegistry, existed: registryExisted } = loadSyncRegistryFile(
  DELETED_FILE,
  rawInitialAssurances.map((item) => item.id)
);
const syncState: SyncStateSets = {
  deletedIds: new Set<string>(initialRegistry.deletedIds),
  pendingDeletes: new Set<string>(initialRegistry.pendingDeletes),
  pendingSaves: new Set<string>(initialRegistry.pendingSaves),
  syncedIds: new Set<string>(initialRegistry.syncedIds),
};
let inMemoryAssurances: AssuranceItem[] = rawInitialAssurances.filter(
  (item) => !syncState.deletedIds.has(item.id)
);
if (!registryExisted) {
  persistSyncRegistryFile(DELETED_FILE, DATA_DIR, syncState);
}

let activeSyncPromise: Promise<boolean> | null = null;
const pendingMutations = new Set<string>();
const pendingMutationCounts = new Map<string, number>();
const assuranceOpQueues = new Map<string, Promise<unknown>>();
let mutationGeneration = 0;

function beginAssuranceMutation(assuranceId: string): void {
  const count = (pendingMutationCounts.get(assuranceId) || 0) + 1;
  pendingMutationCounts.set(assuranceId, count);
  pendingMutations.add(assuranceId);
}

function endAssuranceMutation(assuranceId: string): void {
  const count = (pendingMutationCounts.get(assuranceId) || 1) - 1;
  if (count <= 0) {
    pendingMutationCounts.delete(assuranceId);
    pendingMutations.delete(assuranceId);
  } else {
    pendingMutationCounts.set(assuranceId, count);
  }
}

function enqueueAssuranceOp<T>(assuranceId: string, task: () => Promise<T>): Promise<T> {
  const previous = assuranceOpQueues.get(assuranceId) || Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  const tracked = next.finally(() => {
    if (assuranceOpQueues.get(assuranceId) === tracked) {
      assuranceOpQueues.delete(assuranceId);
    }
  });
  assuranceOpQueues.set(assuranceId, tracked);
  return next;
}

function markLocalSavePending(id: string): void {
  if (!id || syncState.pendingSaves.has(id)) return;
  syncState.pendingSaves.add(id);
  persistSyncRegistryFile(DELETED_FILE, DATA_DIR, syncState);
}

function markLocalSaveConfirmed(id: string, snapshotUpdatedAt?: string): void {
  const current = inMemoryAssurances.find((item) => item.id === id);
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
    const ok = await enqueueAssuranceOp(id, () => deleteAssuranceFromFirestore(id));
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

// SYNCHRONISATION BIDIRECTIONNELLE AVEC FIRESTORE (/assurances)
async function syncAssurancesWithFirestore(): Promise<boolean> {
  if (activeSyncPromise) {
    return activeSyncPromise;
  }
  activeSyncPromise = (async () => {
    try {
      await flushPendingFirestoreDeletes();
      const syncStartGen = mutationGeneration;
      const { ok, assurances: firestoreAssurances } =
        await fetchAssurancesFromFirestoreWithStatus();
      if (!ok || mutationGeneration !== syncStartGen) {
        return false;
      }

      const result = reconcileBidirectionalSync<AssuranceItem>({
        localItems: inMemoryAssurances,
        firestoreItems: firestoreAssurances,
        state: syncState,
        pendingMutations,
        opQueues: assuranceOpQueues,
        getTimestamp: (item) => Date.parse(item.updatedAt || item.createdAt || '') || 0,
      });

      if (mutationGeneration !== syncStartGen) {
        return false;
      }

      inMemoryAssurances = result.mergedItems;
      persistStorage(inMemoryAssurances);
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
        const localItem = inMemoryAssurances.find((item) => item.id === pushId);
        if (!localItem) {
          if (syncState.pendingSaves.delete(pushId)) {
            pushRegistryChanged = true;
          }
          continue;
        }
        const snapshotUpdatedAt = localItem.updatedAt;
        const saved = await enqueueAssuranceOp(pushId, () => saveAssuranceToFirestore(localItem));
        if (saved) {
          const latest = inMemoryAssurances.find((item) => item.id === pushId);
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
          enqueueAssuranceOp(ghostId, () => deleteAssuranceFromFirestore(ghostId)).then(
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
      console.error('Erreur synchronisation assurances Firestore:', error);
      return false;
    } finally {
      activeSyncPromise = null;
    }
  })();
  return activeSyncPromise;
}

syncAssurancesWithFirestore();

export const AssurancesService = {
  syncNow(): Promise<boolean> {
    return syncAssurancesWithFirestore();
  },

  async getAllAssurances(inTrash = false): Promise<AssuranceItem[]> {
    await syncAssurancesWithFirestore();
    if (inTrash) {
      return inMemoryAssurances.filter((item) => Boolean(item.deleted));
    }
    return inMemoryAssurances.filter((item) => !item.deleted);
  },

  async createAssurance(input: {
    label: string;
    description?: string;
  }): Promise<AssuranceItem> {
    const cleanLabel = input.label?.trim();
    if (!cleanLabel) {
      throw new Error("Le nom de l'assurance est obligatoire.");
    }
    if (cleanLabel.length > 120) {
      throw new Error("Le nom de l'assurance ne doit pas dépasser 120 caractères.");
    }
    const cleanDescription = input.description?.trim() || '';
    if (cleanDescription.length > 500) {
      throw new Error('La description ne doit pas dépasser 500 caractères.');
    }

    const normalized = cleanLabel.toLowerCase();
    const exists = inMemoryAssurances.some(
      (item) =>
        item.label.trim().toLowerCase() === normalized ||
        item.displayLabel.trim().toLowerCase() === normalized
    );
    if (exists) {
      throw new Error('Cette assurance existe déjà.');
    }

    const now = new Date().toISOString();
    const newItem: AssuranceItem = {
      id: `ass_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      label: cleanLabel,
      displayLabel: cleanLabel,
      description: cleanDescription,
      isDefault: false,
      deleted: false,
      createdAt: now,
      updatedAt: now,
    };

    mutationGeneration++;
    beginAssuranceMutation(newItem.id);
    inMemoryAssurances.push(newItem);
    persistStorage(inMemoryAssurances);
    markLocalSavePending(newItem.id);

    enqueueAssuranceOp(newItem.id, () => saveAssuranceToFirestore(newItem))
      .then((saved) => {
        if (saved) {
          markLocalSaveConfirmed(newItem.id, newItem.updatedAt);
        }
      })
      .finally(() => {
        endAssuranceMutation(newItem.id);
      });

    return newItem;
  },

  async moveToTrash(id: string): Promise<AssuranceItem> {
    const index = inMemoryAssurances.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error(`Assurance avec l'ID ${id} non trouvée.`);
    }
    const now = new Date().toISOString();
    const updated: AssuranceItem = {
      ...inMemoryAssurances[index],
      deleted: true,
      deletedAt: now,
      updatedAt: now,
    };
    mutationGeneration++;
    beginAssuranceMutation(id);
    inMemoryAssurances[index] = updated;
    persistStorage(inMemoryAssurances);
    markLocalSavePending(id);

    enqueueAssuranceOp(id, () =>
      updateAssuranceTrashInFirestore(id, true, now, now, updated)
    )
      .then((saved) => {
        if (saved) {
          markLocalSaveConfirmed(id, now);
        }
      })
      .finally(() => {
        endAssuranceMutation(id);
      });

    return updated;
  },

  async restoreFromTrash(id: string): Promise<AssuranceItem> {
    const index = inMemoryAssurances.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error(`Assurance avec l'ID ${id} non trouvée.`);
    }
    const now = new Date().toISOString();
    const updated: AssuranceItem = {
      ...inMemoryAssurances[index],
      deleted: false,
      updatedAt: now,
    };
    delete updated.deletedAt;

    mutationGeneration++;
    beginAssuranceMutation(id);
    inMemoryAssurances[index] = updated;
    persistStorage(inMemoryAssurances);
    markLocalSavePending(id);

    enqueueAssuranceOp(id, () =>
      updateAssuranceTrashInFirestore(id, false, undefined, now, updated)
    )
      .then((saved) => {
        if (saved) {
          markLocalSaveConfirmed(id, now);
        }
      })
      .finally(() => {
        endAssuranceMutation(id);
      });

    return updated;
  },

  async deleteAssurancePermanently(id: string): Promise<boolean> {
    const existed = inMemoryAssurances.some((item) => item.id === id);
    mutationGeneration++;
    beginAssuranceMutation(id);
    markPermanentlyDeleted([id]);
    inMemoryAssurances = inMemoryAssurances.filter((item) => item.id !== id);
    persistStorage(inMemoryAssurances);

    try {
      const ok = await enqueueAssuranceOp(id, () => deleteAssuranceFromFirestore(id));
      if (ok && syncState.pendingDeletes.delete(id)) {
        persistSyncRegistryFile(DELETED_FILE, DATA_DIR, syncState);
      }
      return existed || ok;
    } finally {
      endAssuranceMutation(id);
    }
  },

  async emptyTrash(): Promise<number> {
    const toDelete = inMemoryAssurances.filter((item) => item.deleted === true);
    const deleteIds = toDelete.map((item) => item.id);
    mutationGeneration++;
    for (const id of deleteIds) {
      beginAssuranceMutation(id);
    }
    markPermanentlyDeleted(deleteIds);
    inMemoryAssurances = inMemoryAssurances.filter((item) => !item.deleted);
    persistStorage(inMemoryAssurances);

    await Promise.all(
      deleteIds.map(async (id) => {
        try {
          const ok = await enqueueAssuranceOp(id, () => deleteAssuranceFromFirestore(id));
          if (ok) {
            syncState.pendingDeletes.delete(id);
          }
        } finally {
          endAssuranceMutation(id);
        }
      })
    );
    persistSyncRegistryFile(DELETED_FILE, DATA_DIR, syncState);
    return toDelete.length;
  },
};
