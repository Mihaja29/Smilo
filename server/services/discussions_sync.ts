import { DiscussionMessage, DiscussionRole } from '../types';
import {
  FIRESTORE_REST_BASE,
  FirestoreDocument,
  toFirestoreFields,
  fromFirestoreFields,
  ensureBackendAuthenticated,
  hasRequestAuthToken,
  getEffectiveAuthUid,
  firestoreFetch,
  queryCollectionDocuments,
} from './firestore_sync';

let loggedListPermissionWarning = false;
let loggedWritePermissionWarning = false;

// SYNCHRONISATION COLLECTION DISCUSSIONS FIRESTORE
export async function fetchDiscussionsFromFirestoreWithStatus(): Promise<{
  ok: boolean;
  messages: DiscussionMessage[];
}> {
  try {
    const messages: DiscussionMessage[] = [];
    const { ok, documents, forbidden } = await queryCollectionDocuments('discussions');
    if (forbidden) {
      if (!loggedListPermissionWarning) {
        loggedListPermissionWarning = true;
        console.warn(
          'Synchronisation lecture discussions Firestore en attente : regle allow list requise sur /discussions (cache local utilise).'
        );
      }
      return { ok: false, messages: [] };
    }
    if (!ok) {
      return { ok: false, messages: [] };
    }

    for (const docItem of documents) {
      const docId = docItem.name ? docItem.name.split('/').pop() || '' : '';
      if (!docId) continue;

      const data = fromFirestoreFields(docItem.fields);
      const authorName = String(data.authorName || '').trim();
      const content = String(data.content || '').trim();
      if (!authorName || !content) continue;

      const role: DiscussionRole = data.role === 'assistant' ? 'assistant' : 'user';
      const rawImage = typeof data.imageDataUrl === 'string' ? data.imageDataUrl.trim() : '';
      const safeImage =
        rawImage && /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(rawImage)
          ? rawImage
          : undefined;
      const item: DiscussionMessage = {
        id: docId,
        conversationId:
          typeof data.conversationId === 'string' && data.conversationId.trim()
            ? data.conversationId.trim().slice(0, 80)
            : 'default',
        role,
        authorName,
        authorUid: String(data.authorUid || data.createdBy || ''),
        content,
        ...(safeImage ? { imageDataUrl: safeImage } : {}),
        deleted: Boolean(data.deleted),
        deletedAt: typeof data.deletedAt === 'string' && data.deletedAt ? data.deletedAt : undefined,
        createdAt: String(data.createdAt || new Date().toISOString()),
        updatedAt: String(data.updatedAt || data.createdAt || new Date().toISOString()),
      };
      messages.push(item);
    }

    return { ok: true, messages };
  } catch (error) {
    console.error('Erreur lecture discussions Firestore:', error);
    return { ok: false, messages: [] };
  }
}

export async function saveDiscussionToFirestore(item: DiscussionMessage): Promise<boolean> {
  try {
    if (!hasRequestAuthToken()) {
      await ensureBackendAuthenticated();
    }
    const docUrl = `${FIRESTORE_REST_BASE}/discussions/${encodeURIComponent(item.id)}`;
    let existingCreatedBy: string | undefined;
    let existingCreatedAt: string | undefined;
    let existingAuthorUid: string | undefined;
    let docExists = false;

    try {
      const existingRes = await firestoreFetch(docUrl);
      if (existingRes.status === 403) {
        if (!loggedWritePermissionWarning) {
          loggedWritePermissionWarning = true;
          console.warn(
            'Synchronisation ecriture discussion Firestore en attente : regle requise sur /discussions (cache local utilise).'
          );
        }
        return false;
      }
      if (existingRes.ok) {
        docExists = true;
        const existingJson = (await existingRes.json()) as FirestoreDocument;
        const existingData = fromFirestoreFields(existingJson.fields);
        if (typeof existingData.createdBy === 'string' && existingData.createdBy) {
          existingCreatedBy = existingData.createdBy;
        }
        if (typeof existingData.createdAt === 'string' && existingData.createdAt) {
          existingCreatedAt = existingData.createdAt;
        }
        if (typeof existingData.authorUid === 'string' && existingData.authorUid) {
          existingAuthorUid = existingData.authorUid;
        }
      }
    } catch {
      // Document inexistant ou lecture ignoree
    }

    const effectiveUid = getEffectiveAuthUid();
    const payload: Record<string, unknown> = {
      conversationId: (item.conversationId || 'default').slice(0, 80),
      role: item.role === 'assistant' ? 'assistant' : 'user',
      authorName: item.authorName.trim().slice(0, 120),
      authorUid: docExists && existingAuthorUid ? existingAuthorUid : (effectiveUid || item.authorUid).slice(0, 128),
      content: item.content.trim().slice(0, 4000),
      ...(item.imageDataUrl ? { imageDataUrl: item.imageDataUrl } : {}),
      deleted: Boolean(item.deleted),
      deletedAt: item.deletedAt ? item.deletedAt.slice(0, 40) : null,
      createdAt: (existingCreatedAt || item.createdAt).slice(0, 40),
      createdBy: docExists && existingCreatedBy ? existingCreatedBy : effectiveUid,
      updatedAt: (item.updatedAt || item.createdAt || new Date().toISOString()).slice(0, 40),
    };

    const response = await firestoreFetch(docUrl, {
      method: 'PATCH',
      body: JSON.stringify({ fields: toFirestoreFields(payload) }),
    });

    if (response.status === 403) {
      if (!loggedWritePermissionWarning) {
        loggedWritePermissionWarning = true;
        console.warn(
          'Synchronisation ecriture discussion Firestore en attente : regle requise sur /discussions (cache local utilise).'
        );
      }
      return false;
    }
    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`HTTP ${response.status}: ${errBody}`);
    }
    return true;
  } catch (error) {
    console.error('Erreur ecriture discussion Firestore:', error);
    return false;
  }
}

export async function deleteDiscussionFromFirestore(id: string): Promise<boolean> {
  try {
    const docUrl = `${FIRESTORE_REST_BASE}/discussions/${encodeURIComponent(id)}`;
    const response = await firestoreFetch(docUrl, { method: 'DELETE' });
    if (response.status === 403) {
      if (!loggedWritePermissionWarning) {
        loggedWritePermissionWarning = true;
        console.warn(
          'Suppression discussion Firestore en attente : regle requise sur /discussions (cache local utilise).'
        );
      }
      return false;
    }
    if (response.status === 404) return true;
    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`HTTP ${response.status}: ${errBody}`);
    }
    return true;
  } catch (error) {
    console.error('Erreur suppression discussion Firestore:', error);
    return false;
  }
}
