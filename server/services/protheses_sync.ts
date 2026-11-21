import { ProtheseItem } from '../types';
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

let loggedProthesesListPermissionWarning = false;
let loggedProthesesWritePermissionWarning = false;

// SYNCHRONISATION COLLECTION PROTHESES FIRESTORE
export async function fetchProthesesFromFirestoreWithStatus(): Promise<{
  ok: boolean;
  protheses: ProtheseItem[];
}> {
  try {
    const protheses: ProtheseItem[] = [];
    const { ok, documents, forbidden } = await queryCollectionDocuments('protheses');
    if (forbidden) {
      if (!loggedProthesesListPermissionWarning) {
        loggedProthesesListPermissionWarning = true;
        console.warn(
          'Synchronisation lecture protheses Firestore en attente : regle allow list requise sur /protheses (cache local utilise).'
        );
      }
      return { ok: false, protheses: [] };
    }
    if (!ok) {
      return { ok: false, protheses: [] };
    }

    for (const docItem of documents) {
      const docId = docItem.name ? docItem.name.split('/').pop() || '' : '';
      if (!docId) continue;

      const data = fromFirestoreFields(docItem.fields);
      const item: ProtheseItem = {
        id: docId,
        cabinetDentaire: String(data.cabinetDentaire || ''),
        patientNomPrenom: String(data.patientNomPrenom || ''),
        patientContact:
          typeof data.patientContact === 'string' ? data.patientContact : '',
        numeroDentaire: String(data.numeroDentaire || ''),
        typeProthese: String(data.typeProthese || ''),
        teinteProthese:
          typeof data.teinteProthese === 'string' ? data.teinteProthese : '',
        nomLaboratoire: String(data.nomLaboratoire || ''),
        nomCreateurProthese:
          typeof data.nomCreateurProthese === 'string'
            ? data.nomCreateurProthese
            : '',
        dateEnvoi: String(data.dateEnvoi || ''),
        dateLivraison:
          typeof data.dateLivraison === 'string' ? data.dateLivraison : '',
        montant: String(data.montant || ''),
        etatTraitement:
          data.etatTraitement === 'Terminer' ? 'Terminer' : 'En cours',
        deleted: Boolean(data.deleted),
        deletedAt:
          typeof data.deletedAt === 'string' && data.deletedAt
            ? data.deletedAt
            : undefined,
        createdAt: String(data.createdAt || new Date().toISOString()),
        updatedAt: String(data.updatedAt || data.createdAt || new Date().toISOString()),
      };

      if (item.patientNomPrenom && item.typeProthese) {
        protheses.push(item);
      }
    }

    return { ok: true, protheses };
  } catch (error) {
    console.error('Erreur lecture protheses Firestore:', error);
    return { ok: false, protheses: [] };
  }
}

export async function saveProthesisToFirestore(
  item: ProtheseItem
): Promise<boolean> {
  try {
    if (!hasRequestAuthToken()) {
      await ensureBackendAuthenticated();
    }
    const docUrl = `${FIRESTORE_REST_BASE}/protheses/${encodeURIComponent(item.id)}`;
    let existingCreatedBy: string | undefined;
    let existingCreatedAt: string | undefined;
    let docExists = false;
    try {
      const existingRes = await firestoreFetch(docUrl);
      if (existingRes.status === 403) {
        if (!loggedProthesesWritePermissionWarning) {
          loggedProthesesWritePermissionWarning = true;
          console.warn(
            'Synchronisation ecriture prothese Firestore en attente : regle requise sur /protheses (cache local utilise).'
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

    const payload: Record<string, unknown> = {
      cabinetDentaire: item.cabinetDentaire.slice(0, 100),
      patientNomPrenom: item.patientNomPrenom.slice(0, 200),
      patientContact: (item.patientContact || '').slice(0, 100),
      numeroDentaire: item.numeroDentaire.slice(0, 100),
      typeProthese: item.typeProthese.slice(0, 150),
      teinteProthese: (item.teinteProthese || '').slice(0, 50),
      nomLaboratoire: item.nomLaboratoire.slice(0, 150),
      nomCreateurProthese: (item.nomCreateurProthese || '').slice(0, 150),
      dateEnvoi: item.dateEnvoi.slice(0, 20),
      dateLivraison: (item.dateLivraison || '').slice(0, 20),
      montant: item.montant.slice(0, 50),
      etatTraitement: item.etatTraitement === 'Terminer' ? 'Terminer' : 'En cours',
      deleted: Boolean(item.deleted),
      deletedAt: item.deletedAt ? item.deletedAt.slice(0, 40) : null,
      createdAt: (existingCreatedAt || item.createdAt).slice(0, 40),
      createdBy: docExists && existingCreatedBy ? existingCreatedBy : getEffectiveAuthUid(),
      updatedAt: (item.updatedAt || new Date().toISOString()).slice(0, 40),
    };

    const response = await firestoreFetch(docUrl, {
      method: 'PATCH',
      body: JSON.stringify({ fields: toFirestoreFields(payload) }),
    });
    if (response.status === 403) {
      if (!loggedProthesesWritePermissionWarning) {
        loggedProthesesWritePermissionWarning = true;
        console.warn(
          'Synchronisation ecriture prothese Firestore en attente : regle requise sur /protheses (cache local utilise).'
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
    console.error('Erreur ecriture prothese Firestore:', error);
    return false;
  }
}

export async function updateProthesisStatusInFirestore(
  id: string,
  etatTraitement: 'En cours' | 'Terminer',
  updatedAt: string,
  item?: ProtheseItem
): Promise<boolean> {
  try {
    if (!hasRequestAuthToken()) {
      await ensureBackendAuthenticated();
    }
    const docUrl = `${FIRESTORE_REST_BASE}/protheses/${encodeURIComponent(id)}`;
    const getRes = await firestoreFetch(docUrl);
    if (getRes.status === 404) {
      if (item) {
        return await saveProthesisToFirestore({
          ...item,
          etatTraitement,
          updatedAt,
        });
      }
      return true;
    }
    if (getRes.status === 403) {
      return false;
    }
    if (!getRes.ok) {
      const errBody = await getRes.text();
      throw new Error(`HTTP ${getRes.status}: ${errBody}`);
    }

    const patchParams = new URLSearchParams();
    patchParams.append('updateMask.fieldPaths', 'etatTraitement');
    patchParams.append('updateMask.fieldPaths', 'updatedAt');

    const patchRes = await firestoreFetch(`${docUrl}?${patchParams.toString()}`, {
      method: 'PATCH',
      body: JSON.stringify({
        fields: toFirestoreFields({
          etatTraitement,
          updatedAt,
        }),
      }),
    });
    if (patchRes.status === 403) {
      return false;
    }
    if (!patchRes.ok) {
      const errBody = await patchRes.text();
      throw new Error(`HTTP ${patchRes.status}: ${errBody}`);
    }
    return true;
  } catch (error) {
    console.error('Erreur mise a jour etat prothese Firestore:', error);
    return false;
  }
}

export async function deleteProthesisFromFirestore(id: string): Promise<boolean> {
  try {
    const docUrl = `${FIRESTORE_REST_BASE}/protheses/${encodeURIComponent(id)}`;
    const response = await firestoreFetch(docUrl, { method: 'DELETE' });
    if (response.status === 403) {
      if (!loggedProthesesWritePermissionWarning) {
        loggedProthesesWritePermissionWarning = true;
        console.warn(
          'Suppression prothese Firestore en attente : regle requise sur /protheses (cache local utilise).'
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
    console.error('Erreur suppression prothese Firestore:', error);
    return false;
  }
}
