import { PriseEnChargeItem } from '../types';
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

let loggedCoveragesListPermissionWarning = false;
let loggedCoveragesWritePermissionWarning = false;

// SYNCHRONISATION COLLECTION PRISES EN CHARGE FIRESTORE
export async function fetchCoveragesFromFirestoreWithStatus(): Promise<{
  ok: boolean;
  coverages: PriseEnChargeItem[];
}> {
  try {
    const coverages: PriseEnChargeItem[] = [];
    const { ok, documents, forbidden } = await queryCollectionDocuments('prises_en_charge');
    if (forbidden) {
      if (!loggedCoveragesListPermissionWarning) {
        loggedCoveragesListPermissionWarning = true;
        console.warn(
          'Synchronisation lecture prises en charge Firestore en attente : regle allow list requise sur /prises_en_charge (cache local utilise).'
        );
      }
      return { ok: false, coverages: [] };
    }
    if (!ok) {
      return { ok: false, coverages: [] };
    }

    for (const docItem of documents) {
      const docId = docItem.name ? docItem.name.split('/').pop() || '' : '';
      if (!docId) continue;

      const data = fromFirestoreFields(docItem.fields);
      const item: PriseEnChargeItem = {
        id: docId,
        cabinetDentaire: String(data.cabinetDentaire || ''),
        numeroFacture: String(data.numeroFacture || ''),
        montantProposeAriary: String(data.montantProposeAriary || ''),
        montantAssuranceAriary: String(data.montantAssuranceAriary || ''),
        patientNomPrenom: String(data.patientNomPrenom || ''),
        nomSociete: String(data.nomSociete || ''),
        agence: String(data.agence || ''),
        numeroPriseEnCharge: String(data.numeroPriseEnCharge || ''),
        dateAttestation:
          typeof data.dateAttestation === 'string' ? data.dateAttestation : '',
        createursPriseEnCharge:
          typeof data.createursPriseEnCharge === 'string'
            ? data.createursPriseEnCharge
            : '',
        dateEnvoi: typeof data.dateEnvoi === 'string' ? data.dateEnvoi : '',
        etatTraitement:
          data.etatTraitement === 'Reçu' ? 'Reçu' : 'En cours',
        dateObtentionCheque:
          typeof data.dateObtentionCheque === 'string'
            ? data.dateObtentionCheque
            : '',
        deleted: Boolean(data.deleted),
        deletedAt:
          typeof data.deletedAt === 'string' && data.deletedAt
            ? data.deletedAt
            : undefined,
        createdAt: String(data.createdAt || new Date().toISOString()),
        updatedAt: String(data.updatedAt || data.createdAt || new Date().toISOString()),
      };

      if (item.patientNomPrenom && item.numeroPriseEnCharge) {
        coverages.push(item);
      }
    }

    return { ok: true, coverages };
  } catch (error) {
    console.error('Erreur lecture prises en charge Firestore:', error);
    return { ok: false, coverages: [] };
  }
}

export async function saveCoverageToFirestore(
  item: PriseEnChargeItem
): Promise<boolean> {
  try {
    if (!hasRequestAuthToken()) {
      await ensureBackendAuthenticated();
    }
    const docUrl = `${FIRESTORE_REST_BASE}/prises_en_charge/${encodeURIComponent(item.id)}`;
    let existingCreatedBy: string | undefined;
    let existingCreatedAt: string | undefined;
    let docExists = false;
    try {
      const existingRes = await firestoreFetch(docUrl);
      if (existingRes.status === 403) {
        if (!loggedCoveragesWritePermissionWarning) {
          loggedCoveragesWritePermissionWarning = true;
          console.warn(
            'Synchronisation ecriture prise en charge Firestore en attente : regle requise sur /prises_en_charge (cache local utilise).'
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
      cabinetDentaire: item.cabinetDentaire,
      numeroFacture: item.numeroFacture,
      montantProposeAriary: item.montantProposeAriary,
      montantAssuranceAriary: item.montantAssuranceAriary,
      patientNomPrenom: item.patientNomPrenom,
      nomSociete: item.nomSociete,
      agence: item.agence,
      numeroPriseEnCharge: item.numeroPriseEnCharge,
      dateAttestation: item.dateAttestation || '',
      createursPriseEnCharge: item.createursPriseEnCharge || '',
      dateEnvoi: item.dateEnvoi || '',
      etatTraitement: item.etatTraitement === 'Reçu' ? 'Reçu' : 'En cours',
      dateObtentionCheque: item.dateObtentionCheque || '',
      deleted: Boolean(item.deleted),
      deletedAt: item.deletedAt || null,
      createdAt: existingCreatedAt || item.createdAt,
      createdBy: docExists && existingCreatedBy ? existingCreatedBy : getEffectiveAuthUid(),
      updatedAt: item.updatedAt || new Date().toISOString(),
    };

    const response = await firestoreFetch(docUrl, {
      method: 'PATCH',
      body: JSON.stringify({ fields: toFirestoreFields(payload) }),
    });
    if (response.status === 403) {
      if (!loggedCoveragesWritePermissionWarning) {
        loggedCoveragesWritePermissionWarning = true;
        console.warn(
          'Synchronisation ecriture prise en charge Firestore en attente : regle requise sur /prises_en_charge (cache local utilise).'
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
    console.error('Erreur ecriture prise en charge Firestore:', error);
    return false;
  }
}

export async function updateCoverageStatusInFirestore(
  id: string,
  etatTraitement: 'En cours' | 'Reçu',
  dateObtentionCheque: string,
  updatedAt: string,
  item?: PriseEnChargeItem
): Promise<boolean> {
  try {
    if (!hasRequestAuthToken()) {
      await ensureBackendAuthenticated();
    }
    const docUrl = `${FIRESTORE_REST_BASE}/prises_en_charge/${encodeURIComponent(id)}`;
    const getRes = await firestoreFetch(docUrl);
    if (getRes.status === 404) {
      if (item) {
        return await saveCoverageToFirestore({
          ...item,
          etatTraitement,
          dateObtentionCheque,
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
    patchParams.append('updateMask.fieldPaths', 'dateObtentionCheque');
    patchParams.append('updateMask.fieldPaths', 'updatedAt');

    const patchRes = await firestoreFetch(`${docUrl}?${patchParams.toString()}`, {
      method: 'PATCH',
      body: JSON.stringify({
        fields: toFirestoreFields({
          etatTraitement,
          dateObtentionCheque,
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
    console.error('Erreur mise a jour etat prise en charge Firestore:', error);
    return false;
  }
}

export async function deleteCoverageFromFirestore(id: string): Promise<boolean> {
  try {
    const docUrl = `${FIRESTORE_REST_BASE}/prises_en_charge/${encodeURIComponent(id)}`;
    const response = await firestoreFetch(docUrl, { method: 'DELETE' });
    if (response.status === 403) {
      if (!loggedCoveragesWritePermissionWarning) {
        loggedCoveragesWritePermissionWarning = true;
        console.warn(
          'Suppression prise en charge Firestore en attente : regle requise sur /prises_en_charge (cache local utilise).'
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
    console.error('Erreur suppression prise en charge Firestore:', error);
    return false;
  }
}
