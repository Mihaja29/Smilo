import fs from 'fs';
import path from 'path';
import {
  AiCreatedEntity,
  AiFormRequest,
  AskDiscussionInput,
  DiscussionMessage,
} from '../types';
import {
  deleteDiscussionFromFirestore,
  fetchDiscussionsFromFirestoreWithStatus,
  saveDiscussionToFirestore,
} from './discussions_sync';
import {
  loadSyncRegistryFile,
  persistSyncRegistryFile,
  reconcileBidirectionalSync,
  SyncStateSets,
} from './firestore_sync';
import { resolveWritableDataDir } from '../path_utils';
import { generateAiDiscussionReply } from './nvidia_ai_service';

const DATA_DIR = resolveWritableDataDir(import.meta.url);
const DATA_FILE = path.join(DATA_DIR, 'discussions.json');
const DELETED_FILE = path.join(DATA_DIR, 'deleted_discussions.json');
const MAX_MESSAGES = 300;

// STOCKAGE LOCAL ET REGISTRE DE SYNCHRONISATION
function ensureStorage(): DiscussionMessage[] {
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
    console.error('Erreur lecture discussions.json:', error);
    return [];
  }
}

function persistStorage(items: DiscussionMessage[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const trimmed = items.slice(-MAX_MESSAGES);
    fs.writeFileSync(DATA_FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
  } catch (error) {
    console.error('Erreur ecriture discussions.json:', error);
  }
}

function sortMessagesChronologically(items: DiscussionMessage[]): DiscussionMessage[] {
  return [...items].sort((a, b) => {
    const timeA = Date.parse(a.createdAt || '') || 0;
    const timeB = Date.parse(b.createdAt || '') || 0;
    if (timeA !== timeB) return timeA - timeB;
    return a.id.localeCompare(b.id);
  });
}

const rawInitialDiscussions = ensureStorage();
const { registry: initialRegistry, existed: registryExisted } = loadSyncRegistryFile(
  DELETED_FILE,
  rawInitialDiscussions.map((d) => d.id)
);
const syncState: SyncStateSets = {
  deletedIds: new Set<string>(initialRegistry.deletedIds),
  pendingDeletes: new Set<string>(initialRegistry.pendingDeletes),
  pendingSaves: new Set<string>(
    registryExisted
      ? initialRegistry.pendingSaves
      : rawInitialDiscussions.map((d) => d.id)
  ),
  syncedIds: new Set<string>(initialRegistry.syncedIds),
};

let inMemoryDiscussions: DiscussionMessage[] = sortMessagesChronologically(
  rawInitialDiscussions.filter((item) => !item.deleted && !syncState.deletedIds.has(item.id))
);

if (!registryExisted) {
  persistSyncRegistryFile(DELETED_FILE, DATA_DIR, syncState);
}

let activeSyncPromise: Promise<boolean> | null = null;
const pendingMutations = new Set<string>();
const pendingMutationCounts = new Map<string, number>();
const opQueues = new Map<string, Promise<unknown>>();
let mutationGeneration = 0;

function beginMutation(id: string): void {
  const count = (pendingMutationCounts.get(id) || 0) + 1;
  pendingMutationCounts.set(id, count);
  pendingMutations.add(id);
}

function endMutation(id: string): void {
  const count = (pendingMutationCounts.get(id) || 1) - 1;
  if (count <= 0) {
    pendingMutationCounts.delete(id);
    pendingMutations.delete(id);
  } else {
    pendingMutationCounts.set(id, count);
  }
}

function enqueueOp<T>(id: string, task: () => Promise<T>): Promise<T> {
  const previous = opQueues.get(id) || Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  const tracked = next.finally(() => {
    if (opQueues.get(id) === tracked) {
      opQueues.delete(id);
    }
  });
  opQueues.set(id, tracked);
  return next;
}

function markLocalSaveConfirmed(id: string, snapshotUpdatedAt?: string): void {
  const current = inMemoryDiscussions.find((item) => item.id === id);
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
    const ok = await enqueueOp(id, () => deleteDiscussionFromFirestore(id));
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
    if (syncState.pendingSaves.delete(id)) added = true;
    if (syncState.syncedIds.delete(id)) added = true;
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

// SYNCHRONISATION BIDIRECTIONNELLE DES DISCUSSIONS AVEC FIRESTORE
async function syncDiscussionsWithFirestore(): Promise<boolean> {
  if (activeSyncPromise) {
    return activeSyncPromise;
  }
  activeSyncPromise = (async () => {
    try {
      await flushPendingFirestoreDeletes();
      const syncStartGen = mutationGeneration;
      const { ok, messages: firestoreMessages } = await fetchDiscussionsFromFirestoreWithStatus();
      if (!ok || mutationGeneration !== syncStartGen) {
        return false;
      }

      const result = reconcileBidirectionalSync<DiscussionMessage>({
        localItems: inMemoryDiscussions,
        firestoreItems: firestoreMessages,
        state: syncState,
        pendingMutations,
        opQueues,
        getTimestamp: (item) => Date.parse(item.updatedAt || item.createdAt || '') || 0,
        isTombstonedLocal: (item) => Boolean(item.deleted),
        isTombstonedRemote: (item) => Boolean(item.deleted),
        mergeItems: (_local, remote) => ({ ...remote }),
      });

      if (mutationGeneration !== syncStartGen) {
        return false;
      }

      inMemoryDiscussions = sortMessagesChronologically(result.mergedItems);
      persistStorage(inMemoryDiscussions);
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
        const localItem = inMemoryDiscussions.find((item) => item.id === pushId);
        if (!localItem) {
          if (syncState.pendingSaves.delete(pushId)) {
            pushRegistryChanged = true;
          }
          continue;
        }
        const snapshotUpdatedAt = localItem.updatedAt;
        const saved = await enqueueOp(pushId, () => saveDiscussionToFirestore(localItem));
        if (saved) {
          const latest = inMemoryDiscussions.find((item) => item.id === pushId);
          if (latest && latest.updatedAt === snapshotUpdatedAt) {
            if (syncState.pendingSaves.delete(pushId)) pushRegistryChanged = true;
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
          enqueueOp(ghostId, () => deleteDiscussionFromFirestore(ghostId)).then((deleted) => {
            if (deleted && syncState.pendingDeletes.delete(ghostId)) {
              persistSyncRegistryFile(DELETED_FILE, DATA_DIR, syncState);
            }
          });
        }
      }
      return true;
    } catch (error) {
      console.error('Erreur synchronisation discussions Firestore:', error);
      return false;
    } finally {
      activeSyncPromise = null;
    }
  })();
  return activeSyncPromise;
}

syncDiscussionsWithFirestore();

function appendMessage(item: DiscussionMessage): void {
  mutationGeneration++;
  beginMutation(item.id);
  inMemoryDiscussions = sortMessagesChronologically([...inMemoryDiscussions, item]).slice(
    -MAX_MESSAGES
  );
  persistStorage(inMemoryDiscussions);
  syncState.pendingSaves.add(item.id);
  persistSyncRegistryFile(DELETED_FILE, DATA_DIR, syncState);

  enqueueOp(item.id, () => saveDiscussionToFirestore(item))
    .then((saved) => {
      if (saved) {
        markLocalSaveConfirmed(item.id, item.updatedAt);
      }
    })
    .catch((err) => {
      console.error('Erreur synchronisation asynchrone discussion:', err);
    })
    .finally(() => {
      endMutation(item.id);
    });
}

function sanitizeConversationId(raw?: string): string {
  if (typeof raw !== 'string') return 'default';
  const trimmed = raw.trim();
  if (!trimmed || !/^[a-zA-Z0-9_-]{1,80}$/.test(trimmed)) {
    return 'default';
  }
  return trimmed;
}

function sanitizeImageDataUrl(raw?: string): string | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw !== 'string') {
    throw new Error("Format d'image invalide.");
  }
  const trimmed = raw.trim();
  if (trimmed.length > 800000) {
    throw new Error("L'image est trop volumineuse (max 600 Ko).");
  }
  if (!/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) {
    throw new Error('Format image non pris en charge (PNG, JPG ou WEBP uniquement).');
  }
  return trimmed;
}

// SERVICE DE DISCUSSION AVEC L'ASSISTANT IA
export const DiscussionsService = {
  async getMessages(requesterUid?: string): Promise<DiscussionMessage[]> {
    await syncDiscussionsWithFirestore();
    return inMemoryDiscussions.filter(
      (item) =>
        !item.deleted &&
        (requesterUid
          ? item.authorUid === requesterUid
          : item.authorUid.startsWith('demo-'))
    );
  },

  async askAi(input: AskDiscussionInput): Promise<{
    userMessage: DiscussionMessage;
    assistantMessage: DiscussionMessage;
    createdEntities: AiCreatedEntity[];
    formRequest?: AiFormRequest;
  }> {
    const rawPrompt = typeof input.prompt === 'string' ? input.prompt.trim() : '';
    const imageDataUrl = sanitizeImageDataUrl(input.imageDataUrl);

    if (!rawPrompt && !imageDataUrl) {
      throw new Error('Votre message ne peut pas être vide.');
    }
    if (rawPrompt.length > 2000) {
      throw new Error('Votre message ne doit pas dépasser 2000 caractères.');
    }

    const conversationId = sanitizeConversationId(input.conversationId);
    const storedUserContent = rawPrompt || 'Image envoyée';
    const aiPrompt = rawPrompt || 'Analyse cette image.';

    const authorName =
      typeof input.authorName === 'string' && input.authorName.trim()
        ? input.authorName.trim().slice(0, 120)
        : 'Praticien Smilo';
    const authorUid =
      typeof input.authorUid === 'string' && input.authorUid.trim()
        ? input.authorUid.trim().slice(0, 128)
        : 'demo-practitioner';

    const userHistory = inMemoryDiscussions.filter(
      (m) =>
        !m.deleted &&
        m.authorUid === authorUid &&
        (m.conversationId || 'default') === conversationId
    );

    const { replyText, createdEntities, formRequest } = await generateAiDiscussionReply(
      userHistory,
      aiPrompt,
      imageDataUrl
    );

    const userTime = new Date();
    const assistantTime = new Date(userTime.getTime() + 1);
    const suffixA = Math.random().toString(36).slice(2, 8);
    const suffixB = Math.random().toString(36).slice(2, 8);

    const userMessage: DiscussionMessage = {
      id: `disc_${userTime.getTime()}_u_${suffixA}`,
      conversationId,
      role: 'user',
      authorName,
      authorUid,
      content: storedUserContent,
      ...(imageDataUrl ? { imageDataUrl } : {}),
      deleted: false,
      createdAt: userTime.toISOString(),
      updatedAt: userTime.toISOString(),
    };

    const assistantMessage: DiscussionMessage = {
      id: `disc_${assistantTime.getTime()}_a_${suffixB}`,
      conversationId,
      role: 'assistant',
      authorName: 'Diana',
      authorUid,
      content: replyText,
      deleted: false,
      createdAt: assistantTime.toISOString(),
      updatedAt: assistantTime.toISOString(),
    };

    appendMessage(userMessage);
    appendMessage(assistantMessage);

    return {
      userMessage,
      assistantMessage,
      createdEntities,
      ...(formRequest ? { formRequest } : {}),
    };
  },

  async clearMessages(requesterUid?: string, conversationId?: string): Promise<number> {
    const scopedConvId =
      typeof conversationId === 'string' && conversationId.trim()
        ? sanitizeConversationId(conversationId)
        : undefined;

    const targets = inMemoryDiscussions.filter((item) => {
      const matchesUser = requesterUid
        ? item.authorUid === requesterUid
        : item.authorUid.startsWith('demo-');
      if (!matchesUser) return false;
      if (!scopedConvId) return true;
      return (item.conversationId || 'default') === scopedConvId;
    });
    if (targets.length === 0) {
      return 0;
    }

    const ids = targets.map((t) => t.id);
    mutationGeneration++;
    ids.forEach((id) => beginMutation(id));
    markPermanentlyDeleted(ids);
    const targetSet = new Set(ids);
    inMemoryDiscussions = inMemoryDiscussions.filter((item) => !targetSet.has(item.id));
    persistStorage(inMemoryDiscussions);

    try {
      let registryUpdated = false;
      for (const id of ids) {
        const ok = await enqueueOp(id, () => deleteDiscussionFromFirestore(id));
        if (ok && syncState.pendingDeletes.delete(id)) {
          registryUpdated = true;
        }
      }
      if (registryUpdated) {
        persistSyncRegistryFile(DELETED_FILE, DATA_DIR, syncState);
      }
      return ids.length;
    } finally {
      ids.forEach((id) => endMutation(id));
    }
  },
};
