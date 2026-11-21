import fs from 'fs';
import path from 'path';
import { CabinetItem } from '../types';
import {
  fetchCabinetsFromFirestoreWithStatus,
  saveCabinetToFirestore,
  deleteCabinetFromFirestore,
} from './cabinets_sync';
import {
  loadSyncRegistryFile,
  persistSyncRegistryFile,
  reconcileBidirectionalSync,
  SyncStateSets,
} from './firestore_sync';
import { resolveWritableDataDir } from '../path_utils';

export type { CabinetItem };

const DATA_DIR = resolveWritableDataDir(import.meta.url);
const DATA_FILE = path.join(DATA_DIR, 'cabinets.json');
const DELETED_FILE = path.join(DATA_DIR, 'deleted_cabinets.json');

const KNOWN_CABINET_CODES: Record<string, string> = {
  anjanahary: 'ANJ',
  ambohitrimanjaka: 'AMB',
  antanimena: 'ANT',
};

export function normalizeCabinetCode(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .slice(0, 6);
}

export function suggestCabinetCode(cabinet: string): string {
  const trimmed = (cabinet || '').trim();
  if (!trimmed) return '';
  const normalizedKey = trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (KNOWN_CABINET_CODES[normalizedKey]) {
    return KNOWN_CABINET_CODES[normalizedKey];
  }
  const lettersOnly = normalizedKey.replace(/[^a-z]/g, '').toUpperCase();
  if (lettersOnly.length >= 2) {
    return lettersOnly.slice(0, 3);
  }
  if (lettersOnly.length === 1) {
    return `${lettersOnly}CB`;
  }
  return 'CAB';
}

export function getCabinetCode(cabinet: string): string {
  const trimmed = (cabinet || '').trim();
  if (!trimmed) return '';
  const matched = inMemoryCabinets.find(
    (item) => !item.deleted && item.name.trim().toLowerCase() === trimmed.toLowerCase()
  );
  if (matched?.code) {
    const normalized = normalizeCabinetCode(matched.code);
    if (normalized.length >= 2) {
      return normalized;
    }
  }
  return suggestCabinetCode(trimmed);
}

function withResolvedCabinetCode(item: CabinetItem): CabinetItem {
  const resolved = item.code ? normalizeCabinetCode(item.code) : '';
  return {
    ...item,
    code: resolved.length >= 2 ? resolved : suggestCabinetCode(item.name),
  };
}

const DEFAULT_CABINETS: CabinetItem[] = [
  {
    id: 'anj',
    name: 'Anjanahary',
    code: 'ANJ',
    description: 'Cabinet dentaire Smilo',
    isDefault: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'amb',
    name: 'Ambohitrimanjaka',
    code: 'AMB',
    description: 'Cabinet dentaire Smilo',
    isDefault: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ant',
    name: 'Antanimena',
    code: 'ANT',
    description: 'Cabinet dentaire Smilo',
    isDefault: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

// STOCKAGE LOCAL ET REGISTRE DE SYNCHRONISATION
function ensureStorage(): CabinetItem[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_CABINETS, null, 2), 'utf-8');
      return [...DEFAULT_CABINETS];
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    if (!raw || !raw.trim()) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_CABINETS, null, 2), 'utf-8');
      return [...DEFAULT_CABINETS];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [...DEFAULT_CABINETS];
  } catch (error) {
    console.error('Erreur lecture cabinets.json:', error);
    return [...DEFAULT_CABINETS];
  }
}

function persistStorage(items: CabinetItem[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), 'utf-8');
  } catch (error) {
    console.error('Erreur ecriture cabinets.json:', error);
  }
}

const rawInitialCabinets = ensureStorage();
const { registry: initialRegistry, existed: registryExisted } = loadSyncRegistryFile(
  DELETED_FILE,
  rawInitialCabinets.map((c) => c.id)
);
const syncState: SyncStateSets = {
  deletedIds: new Set<string>(initialRegistry.deletedIds),
  pendingDeletes: new Set<string>(initialRegistry.pendingDeletes),
  pendingSaves: new Set<string>(
    registryExisted
      ? initialRegistry.pendingSaves
      : rawInitialCabinets.map((c) => c.id)
  ),
  syncedIds: new Set<string>(initialRegistry.syncedIds),
};
let inMemoryCabinets: CabinetItem[] = rawInitialCabinets
  .filter((item) => !item.deleted && !syncState.deletedIds.has(item.id))
  .map(withResolvedCabinetCode);

if (!registryExisted) {
  persistSyncRegistryFile(DELETED_FILE, DATA_DIR, syncState);
}

let activeSyncPromise: Promise<boolean> | null = null;
const pendingMutations = new Set<string>();
const pendingMutationCounts = new Map<string, number>();
const cabinetOpQueues = new Map<string, Promise<unknown>>();
let mutationGeneration = 0;

function beginCabinetMutation(cabinetId: string): void {
  const count = (pendingMutationCounts.get(cabinetId) || 0) + 1;
  pendingMutationCounts.set(cabinetId, count);
  pendingMutations.add(cabinetId);
}

function endCabinetMutation(cabinetId: string): void {
  const count = (pendingMutationCounts.get(cabinetId) || 1) - 1;
  if (count <= 0) {
    pendingMutationCounts.delete(cabinetId);
    pendingMutations.delete(cabinetId);
  } else {
    pendingMutationCounts.set(cabinetId, count);
  }
}

function enqueueCabinetOp<T>(cabinetId: string, task: () => Promise<T>): Promise<T> {
  const previous = cabinetOpQueues.get(cabinetId) || Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  const tracked = next.finally(() => {
    if (cabinetOpQueues.get(cabinetId) === tracked) {
      cabinetOpQueues.delete(cabinetId);
    }
  });
  cabinetOpQueues.set(cabinetId, tracked);
  return next;
}

function markLocalSaveConfirmed(id: string, snapshotUpdatedAt?: string): void {
  const current = inMemoryCabinets.find((item) => item.id === id);
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
    const ok = await enqueueCabinetOp(id, () => deleteCabinetFromFirestore(id));
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

// SYNCHRONISATION BIDIRECTIONNELLE DES CABINETS AVEC FIRESTORE
async function syncCabinetsWithFirestore(): Promise<boolean> {
  if (activeSyncPromise) {
    return activeSyncPromise;
  }
  activeSyncPromise = (async () => {
    try {
      await flushPendingFirestoreDeletes();
      const syncStartGen = mutationGeneration;
      const { ok, cabinets: firestoreCabinets } = await fetchCabinetsFromFirestoreWithStatus();
      if (!ok || mutationGeneration !== syncStartGen) {
        return false;
      }

      const result = reconcileBidirectionalSync<CabinetItem>({
        localItems: inMemoryCabinets,
        firestoreItems: firestoreCabinets,
        state: syncState,
        pendingMutations,
        opQueues: cabinetOpQueues,
        getTimestamp: (item) => Date.parse(item.updatedAt || item.createdAt || '') || 0,
        isTombstonedLocal: (item) => Boolean(item.deleted),
        isTombstonedRemote: (item) => Boolean(item.deleted),
        mergeItems: (local, remote) =>
          withResolvedCabinetCode({
            ...remote,
            code: remote.code || local?.code,
          }),
      });

      if (mutationGeneration !== syncStartGen) {
        return false;
      }

      inMemoryCabinets = result.mergedItems.map(withResolvedCabinetCode);
      persistStorage(inMemoryCabinets);
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
        const localItem = inMemoryCabinets.find((item) => item.id === pushId);
        if (!localItem) {
          if (syncState.pendingSaves.delete(pushId)) {
            pushRegistryChanged = true;
          }
          continue;
        }
        const snapshotUpdatedAt = localItem.updatedAt;
        const saved = await enqueueCabinetOp(pushId, () => saveCabinetToFirestore(localItem));
        if (saved) {
          const latest = inMemoryCabinets.find((item) => item.id === pushId);
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
          enqueueCabinetOp(ghostId, () => deleteCabinetFromFirestore(ghostId)).then((deleted) => {
            if (deleted && syncState.pendingDeletes.delete(ghostId)) {
              persistSyncRegistryFile(DELETED_FILE, DATA_DIR, syncState);
            }
          });
        }
      }
      return true;
    } catch (error) {
      console.error('Erreur synchronisation cabinets Firestore:', error);
      return false;
    } finally {
      activeSyncPromise = null;
    }
  })();
  return activeSyncPromise;
}

syncCabinetsWithFirestore();

// SERVICE DE GESTION DES CABINETS DENTAIRES
export const CabinetsService = {
  syncNow(): Promise<boolean> {
    return syncCabinetsWithFirestore();
  },

  getCabinetNames(): string[] {
    return inMemoryCabinets.filter((item) => !item.deleted).map((item) => item.name);
  },

  async getAllCabinets(): Promise<CabinetItem[]> {
    await syncCabinetsWithFirestore();
    return [...inMemoryCabinets]
      .filter((item) => !item.deleted)
      .map(withResolvedCabinetCode);
  },

  async createCabinet(input: {
    name?: unknown;
    code?: unknown;
    description?: unknown;
  }): Promise<CabinetItem> {
    await syncCabinetsWithFirestore().catch(() => undefined);

    const rawName = typeof input.name === 'string' ? input.name.trim() : '';
    if (!rawName) {
      throw new Error('Le nom du cabinet est requis');
    }
    if (rawName.length > 100) {
      throw new Error('Le nom du cabinet ne doit pas dépasser 100 caractères');
    }

    const exists = inMemoryCabinets.some(
      (item) => !item.deleted && item.name.trim().toLowerCase() === rawName.toLowerCase()
    );
    if (exists) {
      throw new Error('Ce cabinet existe déjà');
    }

    const providedCode =
      typeof input.code === 'string' && input.code.trim()
        ? normalizeCabinetCode(input.code)
        : '';
    const resolvedCode = providedCode || suggestCabinetCode(rawName);
    if (!/^[A-Z]{2,6}$/.test(resolvedCode)) {
      throw new Error(
        'Le code du cabinet doit contenir entre 2 et 6 lettres majuscules'
      );
    }

    const codeExists = inMemoryCabinets.some(
      (item) => !item.deleted && getCabinetCode(item.name) === resolvedCode
    );
    if (codeExists) {
      throw new Error(`Le code ${resolvedCode} est déjà utilisé par un autre cabinet`);
    }

    const description =
      typeof input.description === 'string' && input.description.trim()
        ? input.description.trim().slice(0, 255)
        : 'Cabinet dentaire Smilo';

    const slug = rawName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80);

    const now = new Date().toISOString();
    const created: CabinetItem = {
      id: `${slug || 'cabinet'}_${Date.now()}`.slice(0, 120),
      name: rawName,
      code: resolvedCode,
      description,
      isDefault: false,
      deleted: false,
      createdAt: now,
      updatedAt: now,
    };

    mutationGeneration++;
    beginCabinetMutation(created.id);
    inMemoryCabinets = [...inMemoryCabinets, created];
    persistStorage(inMemoryCabinets);
    syncState.pendingSaves.add(created.id);
    persistSyncRegistryFile(DELETED_FILE, DATA_DIR, syncState);

    try {
      const saved = await enqueueCabinetOp(created.id, () => saveCabinetToFirestore(created));
      if (saved) {
        markLocalSaveConfirmed(created.id, created.updatedAt);
      }
    } finally {
      endCabinetMutation(created.id);
    }

    return created;
  },

  async updateCabinet(
    id: string,
    input: {
      name?: unknown;
      code?: unknown;
      description?: unknown;
    }
  ): Promise<{ cabinet: CabinetItem; previousName: string } | null> {
    await syncCabinetsWithFirestore().catch(() => undefined);

    const existing = inMemoryCabinets.find((item) => item.id === id && !item.deleted);
    if (!existing) {
      return null;
    }

    const rawName = typeof input.name === 'string' ? input.name.trim() : '';
    if (!rawName) {
      throw new Error('Le nom du cabinet est requis');
    }
    if (rawName.length > 100) {
      throw new Error('Le nom du cabinet ne doit pas dépasser 100 caractères');
    }

    const duplicateName = inMemoryCabinets.some(
      (item) =>
        !item.deleted &&
        item.id !== id &&
        item.name.trim().toLowerCase() === rawName.toLowerCase()
    );
    if (duplicateName) {
      throw new Error('Ce cabinet existe déjà');
    }

    const providedCode =
      typeof input.code === 'string' && input.code.trim()
        ? normalizeCabinetCode(input.code)
        : '';
    const resolvedCode =
      providedCode ||
      (existing.code ? normalizeCabinetCode(existing.code) : '') ||
      suggestCabinetCode(rawName);
    if (!/^[A-Z]{2,6}$/.test(resolvedCode)) {
      throw new Error(
        'Le code du cabinet doit contenir entre 2 et 6 lettres majuscules'
      );
    }

    const duplicateCode = inMemoryCabinets.some(
      (item) =>
        !item.deleted &&
        item.id !== id &&
        getCabinetCode(item.name) === resolvedCode
    );
    if (duplicateCode) {
      throw new Error(`Le code ${resolvedCode} est déjà utilisé par un autre cabinet`);
    }

    const description =
      typeof input.description === 'string'
        ? input.description.trim().slice(0, 255)
        : '';

    const previousName = existing.name;
    const updated: CabinetItem = {
      ...existing,
      name: rawName,
      code: resolvedCode,
      description,
      updatedAt: new Date().toISOString(),
    };

    mutationGeneration++;
    beginCabinetMutation(id);
    inMemoryCabinets = inMemoryCabinets.map((item) => (item.id === id ? updated : item));
    persistStorage(inMemoryCabinets);
    syncState.pendingSaves.add(id);
    persistSyncRegistryFile(DELETED_FILE, DATA_DIR, syncState);

    try {
      const saved = await enqueueCabinetOp(id, () => saveCabinetToFirestore(updated));
      if (saved) {
        markLocalSaveConfirmed(id, updated.updatedAt);
      }
    } finally {
      endCabinetMutation(id);
    }

    return { cabinet: updated, previousName };
  },

  async deleteCabinet(id: string): Promise<boolean> {
    const existed = inMemoryCabinets.some((item) => item.id === id);
    if (!existed && !syncState.deletedIds.has(id)) {
      return false;
    }

    mutationGeneration++;
    beginCabinetMutation(id);
    markPermanentlyDeleted([id]);
    inMemoryCabinets = inMemoryCabinets.filter((item) => item.id !== id);
    persistStorage(inMemoryCabinets);

    try {
      const ok = await enqueueCabinetOp(id, () => deleteCabinetFromFirestore(id));
      if (ok && syncState.pendingDeletes.delete(id)) {
        persistSyncRegistryFile(DELETED_FILE, DATA_DIR, syncState);
      }
      return existed || ok;
    } finally {
      endCabinetMutation(id);
    }
  },
};
