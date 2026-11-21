import { CabinetItem } from '../types';
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

let loggedCabinetsListPermissionWarning = false;
let loggedCabinetsWritePermissionWarning = false;

// SYNCHRONISATION COLLECTION CABINETS FIRESTORE
export async function fetchCabinetsFromFirestoreWithStatus(): Promise<{
  ok: boolean;
  cabinets: CabinetItem[];
}> {
  try {
    const cabinets: CabinetItem[] = [];
    const { ok, documents, forbidden } = await queryCollectionDocuments('cabinets');
    if (forbidden) {
      if (!loggedCabinetsListPermissionWarning) {
        loggedCabinetsListPermissionWarning = true;
        console.warn(
          'Synchronisation lecture cabinets Firestore en attente : regle allow list requise sur /cabinets (cache local utilise).'
        );
      }
      return { ok: false, cabinets: [] };
    }
    if (!ok) {
      return { ok: false, cabinets: [] };
    }

    for (const docItem of documents) {
      const docId = docItem.name ? docItem.name.split('/').pop() || '' : '';
      if (!docId) continue;

      const data = fromFirestoreFields(docItem.fields);
      const name = String(data.name || '').trim();
      if (!name) continue;

      const rawCode =
        typeof data.code === 'string'
          ? data.code.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 6)
          : '';
      const item: CabinetItem = {
        id: docId,
        name,
        code: rawCode || undefined,
        description:
          typeof data.description === 'string' ? data.description.trim() : '',
        isDefault: Boolean(data.isDefault),
        deleted: Boolean(data.deleted),
        deletedAt:
          typeof data.deletedAt === 'string' && data.deletedAt
            ? data.deletedAt
            : undefined,
        createdAt: String(data.createdAt || new Date().toISOString()),
        updatedAt: String(data.updatedAt || data.createdAt || new Date().toISOString()),
      };

      cabinets.push(item);
    }

    return { ok: true, cabinets };
  } catch (error) {
    console.error('Erreur lecture cabinets Firestore:', error);
    return { ok: false, cabinets: [] };
  }
}

export async function saveCabinetToFirestore(item: CabinetItem): Promise<boolean> {
  try {
    if (!hasRequestAuthToken()) {
      await ensureBackendAuthenticated();
    }
    const docUrl = `${FIRESTORE_REST_BASE}/cabinets/${encodeURIComponent(item.id)}`;
    let existingCreatedBy: string | undefined;
    let existingCreatedAt: string | undefined;
    let docExists = false;

    try {
      const existingRes = await firestoreFetch(docUrl);
      if (existingRes.status === 403) {
        if (!loggedCabinetsWritePermissionWarning) {
          loggedCabinetsWritePermissionWarning = true;
          console.warn(
            'Synchronisation ecriture cabinet Firestore en attente : regle requise sur /cabinets (cache local utilise).'
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
      }
    } catch {
      // Document inexistant ou lecture ignoree
    }

    const normalizedCode = (item.code || '')
      .replace(/[^A-Za-z]/g, '')
      .toUpperCase()
      .slice(0, 6);
    const payload: Record<string, unknown> = {
      name: item.name.trim().slice(0, 100),
      ...(normalizedCode.length >= 2 ? { code: normalizedCode } : {}),
      description: (item.description || '').trim().slice(0, 255),
      isDefault: Boolean(item.isDefault),
      deleted: Boolean(item.deleted),
      deletedAt: item.deletedAt ? item.deletedAt.slice(0, 40) : null,
      createdAt: (existingCreatedAt || item.createdAt).slice(0, 40),
      createdBy: docExists && existingCreatedBy ? existingCreatedBy : getEffectiveAuthUid(),
      updatedAt: (item.updatedAt || item.createdAt || new Date().toISOString()).slice(0, 40),
    };

    const response = await firestoreFetch(docUrl, {
      method: 'PATCH',
      body: JSON.stringify({ fields: toFirestoreFields(payload) }),
    });

    if (response.status === 403) {
      if (!loggedCabinetsWritePermissionWarning) {
        loggedCabinetsWritePermissionWarning = true;
        console.warn(
          'Synchronisation ecriture cabinet Firestore en attente : regle requise sur /cabinets (cache local utilise).'
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
    console.error('Erreur ecriture cabinet Firestore:', error);
    return false;
  }
}

export async function deleteCabinetFromFirestore(id: string): Promise<boolean> {
  try {
    const docUrl = `${FIRESTORE_REST_BASE}/cabinets/${encodeURIComponent(id)}`;
    const response = await firestoreFetch(docUrl, { method: 'DELETE' });
    if (response.status === 403) {
      if (!loggedCabinetsWritePermissionWarning) {
        loggedCabinetsWritePermissionWarning = true;
        console.warn(
          'Suppression cabinet Firestore en attente : regle requise sur /cabinets (cache local utilise).'
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
    console.error('Erreur suppression cabinet Firestore:', error);
    return false;
  }
}
