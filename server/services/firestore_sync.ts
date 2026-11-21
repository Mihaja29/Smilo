import fs from 'fs';
import path from 'path';
import { AsyncLocalStorage } from 'async_hooks';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { PatientRecord, CareHistoryItem, AssuranceItem } from '../types';
import { resolveConfigPath } from '../path_utils';

const CONFIG_PATH = resolveConfigPath(import.meta.url);

const rawConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
const app = initializeApp(rawConfig);
const auth = getAuth(app);

const PROJECT_ID: string = rawConfig.projectId;
const DATABASE_ID: string = rawConfig.firestoreDatabaseId || '(default)';
export const FIRESTORE_REST_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

const SERVICE_EMAIL = 'smilo-backend-service@smilo.mg';
const SERVICE_PASS = 'SmiloBackendService2026!';

export type FirestoreValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { timestampValue: string }
  | { stringValue: string }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

export interface FirestoreDocument {
  name?: string;
  fields?: Record<string, FirestoreValue>;
}

// CONVERSION DONNEES FIRESTORE REST

function toFirestoreValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }
  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return { integerValue: String(value) };
    }
    return { doubleValue: value };
  }
  if (typeof value === 'string') {
    return { stringValue: value };
  }
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((item) => toFirestoreValue(item)),
      },
    };
  }
  if (typeof value === 'object') {
    const fields: Record<string, FirestoreValue> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        fields[k] = toFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

export function toFirestoreFields(obj: Record<string, unknown>): Record<string, FirestoreValue> {
  const fields: Record<string, FirestoreValue> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      fields[key] = toFirestoreValue(val);
    }
  }
  return fields;
}

function fromFirestoreValue(val: FirestoreValue | undefined): unknown {
  if (!val) return undefined;
  if ('nullValue' in val) return null;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('timestampValue' in val) return val.timestampValue;
  if ('stringValue' in val) return val.stringValue;
  if ('arrayValue' in val) {
    const items = val.arrayValue?.values || [];
    return items.map((item) => fromFirestoreValue(item));
  }
  if ('mapValue' in val) {
    return fromFirestoreFields(val.mapValue?.fields);
  }
  return undefined;
}

export function fromFirestoreFields(fields?: Record<string, FirestoreValue>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (!fields) return result;
  for (const [key, val] of Object.entries(fields)) {
    result[key] = fromFirestoreValue(val);
  }
  return result;
}

// AUTHENTIFICATION & REQUETES HTTP FIRESTORE

const ADMIN_EMAILS = new Set([
  'antokofaha9faravohitra@gmail.com',
  'mathieuromeo2025@gmail.com',
  'rabarisoaharimalala@gmail.com',
  'mathieuandrianarivelo03@gmail.com',
]);

const requestTokenStorage = new AsyncLocalStorage<string | undefined>();
let serviceAdminBootstrapped = false;

export function runWithRequestAuthToken(
  token: string | undefined,
  fn: () => void
): void {
  requestTokenStorage.run(token, fn);
}

export function hasRequestAuthToken(): boolean {
  return Boolean(requestTokenStorage.getStore());
}

function decodeJwtPayload(token?: string): {
  sub?: string;
  email?: string;
  email_verified?: boolean;
} | null {
  if (!token || token.split('.').length !== 3) return null;
  try {
    return JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf-8')
    );
  } catch {
    return null;
  }
}

function isVerifiedAdminToken(token?: string): boolean {
  const claims = decodeJwtPayload(token);
  return Boolean(
    claims?.email_verified === true &&
      claims?.email &&
      ADMIN_EMAILS.has(claims.email)
  );
}

export async function ensureBackendAuthenticated(forceRefresh = false): Promise<string> {
  if (!auth.currentUser) {
    try {
      await signInWithEmailAndPassword(auth, SERVICE_EMAIL, SERVICE_PASS);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/invalid-credential' || code === 'auth/user-not-found') {
        await createUserWithEmailAndPassword(auth, SERVICE_EMAIL, SERVICE_PASS);
      } else {
        throw err;
      }
    }
  }
  if (!auth.currentUser) {
    throw new Error('Authentification backend Firebase requise');
  }
  return auth.currentUser.getIdToken(forceRefresh);
}

export function getBackendAuthUid(): string {
  return getEffectiveAuthUid();
}

export function getEffectiveAuthUid(): string {
  const reqToken = requestTokenStorage.getStore();
  const claims = decodeJwtPayload(reqToken);
  if (claims?.sub) {
    return claims.sub;
  }
  return auth.currentUser?.uid || 'backend-service';
}

async function tryBootstrapServiceAdmin(reqToken?: string): Promise<void> {
  if (serviceAdminBootstrapped || !isVerifiedAdminToken(reqToken)) {
    return;
  }
  serviceAdminBootstrapped = true;
  try {
    await ensureBackendAuthenticated(false);
    const serviceUid = auth.currentUser?.uid;
    if (!serviceUid) return;
    const adminDocUrl = `${FIRESTORE_REST_BASE}/admins/${encodeURIComponent(serviceUid)}`;
    await fetch(adminDocUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${reqToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: toFirestoreFields({
          role: 'service',
          createdAt: new Date().toISOString(),
        }),
      }),
    });
  } catch {
    // Bootstrap silencieux
  }
}

export async function firestoreFetch(url: string, init: RequestInit = {}): Promise<globalThis.Response> {
  const reqToken = requestTokenStorage.getStore();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (reqToken) {
    void tryBootstrapServiceAdmin(reqToken);
    headers.set('Authorization', `Bearer ${reqToken}`);
    const userResponse = await fetch(url, { ...init, headers });
    if (userResponse.status !== 401) {
      return userResponse;
    }
  }

  let token = await ensureBackendAuthenticated(false);
  headers.set('Authorization', `Bearer ${token}`);
  let response = await fetch(url, { ...init, headers });
  if (response.status === 401) {
    token = await ensureBackendAuthenticated(true);
    headers.set('Authorization', `Bearer ${token}`);
    response = await fetch(url, { ...init, headers });
  }
  return response;
}

export async function queryCollectionDocuments(collectionId: string): Promise<{
  ok: boolean;
  documents: FirestoreDocument[];
  forbidden?: boolean;
}> {
  const reqToken = requestTokenStorage.getStore();
  if (!reqToken) {
    await ensureBackendAuthenticated(false);
  }
  const uid = getEffectiveAuthUid();

  if (isVerifiedAdminToken(reqToken)) {
    const adminResponse = await firestoreFetch(`${FIRESTORE_REST_BASE}:runQuery`, {
      method: 'POST',
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId }],
        },
      }),
    });
    if (adminResponse.ok) {
      const rows = (await adminResponse.json()) as Array<{ document?: FirestoreDocument }>;
      const documents = (Array.isArray(rows) ? rows : [])
        .map((row) => row.document)
        .filter((doc): doc is FirestoreDocument => Boolean(doc && doc.name));
      return { ok: true, documents };
    }
    if (adminResponse.status !== 403) {
      const errBody = await adminResponse.text();
      throw new Error(`HTTP ${adminResponse.status}: ${errBody}`);
    }
  }

  const response = await firestoreFetch(`${FIRESTORE_REST_BASE}:runQuery`, {
    method: 'POST',
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'createdBy' },
            op: 'EQUAL',
            value: { stringValue: uid },
          },
        },
      },
    }),
  });
  if (response.status === 403) {
    return { ok: false, documents: [], forbidden: true };
  }
  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`HTTP ${response.status}: ${errBody}`);
  }
  const rows = (await response.json()) as Array<{ document?: FirestoreDocument }>;
  const documents = (Array.isArray(rows) ? rows : [])
    .map((row) => row.document)
    .filter((doc): doc is FirestoreDocument => Boolean(doc && doc.name));
  return { ok: true, documents };
}

// SYNCHRONISATION FIRESTORE BACKEND

let loggedPatientsListPermissionWarning = false;

export async function fetchPatientsFromFirestoreWithStatus(): Promise<{
  ok: boolean;
  patients: PatientRecord[];
}> {
  try {
    const patients: PatientRecord[] = [];
    const { ok, documents, forbidden } = await queryCollectionDocuments('patients');
    if (forbidden) {
      if (!loggedPatientsListPermissionWarning) {
        loggedPatientsListPermissionWarning = true;
        console.warn(
          'Synchronisation lecture patients Firestore en attente : regle allow list requise sur /patients (cache local utilise).'
        );
      }
      return { ok: false, patients: [] };
    }
    if (!ok) {
      return { ok: false, patients: [] };
    }

    for (const docItem of documents) {
      const docId = docItem.name ? docItem.name.split('/').pop() || '' : '';
      if (!docId) continue;

        const data = fromFirestoreFields(docItem.fields);
        const rawAntecedents = Array.isArray(data.antecedents) ? data.antecedents : [];
        const corbeilleTag = rawAntecedents.find(
          (a: unknown) => typeof a === 'string' && a.startsWith('__CORBEILLE__:')
        );
        const isDeleted = Boolean(data.deleted) || Boolean(corbeilleTag);
        const deletedAt =
          typeof data.deletedAt === 'string' && data.deletedAt
            ? data.deletedAt
            : corbeilleTag
              ? String(corbeilleTag).replace('__CORBEILLE__:', '')
              : undefined;
        const cleanAntecedents = rawAntecedents.filter(
          (a: unknown): a is string => typeof a === 'string' && !a.startsWith('__CORBEILLE__:')
        );

        const patient: PatientRecord = {
          id: docId,
          identifiant: String(data.identifiant || ''),
          nom: String(data.nom || ''),
          prenom: String(data.prenom || ''),
          sexe: (data.sexe as PatientRecord['sexe']) || 'Masculin',
          dateNaissance: String(data.dateNaissance || ''),
          adresse: String(data.adresse || ''),
          telephone: String(data.telephone || ''),
          email: String(data.email || ''),
          cabinet: (data.cabinet as PatientRecord['cabinet']) || 'Anjanahary',
          profession: String(data.profession || ''),
          assurance: String(data.assurance || ''),
          allergies: Array.isArray(data.allergies) ? (data.allergies as string[]) : [],
          antecedents: cleanAntecedents,
          traitements: Array.isArray(data.traitements) ? (data.traitements as string[]) : [],
          grossesseAllaitement: Array.isArray(data.grossesseAllaitement)
            ? (data.grossesseAllaitement as string[])
            : [],
          historiqueSoins: Array.isArray(data.historiqueSoins)
            ? (data.historiqueSoins as CareHistoryItem[])
            : [],
          deleted: isDeleted,
          deletedAt,
          createdAt: String(data.createdAt || new Date().toISOString()),
          updatedAt: String(data.updatedAt || data.createdAt || new Date().toISOString()),
        };
      patients.push(patient);
    }

    return { ok: true, patients };
  } catch (error) {
    console.error('Erreur lecture Firestore:', error);
    return { ok: false, patients: [] };
  }
}

export async function fetchPatientsFromFirestore(): Promise<PatientRecord[]> {
  const result = await fetchPatientsFromFirestoreWithStatus();
  return result.patients;
}

let loggedPatientsWritePermissionWarning = false;

export async function savePatientToFirestore(patient: PatientRecord): Promise<boolean> {
  try {
    if (!requestTokenStorage.getStore()) {
      await ensureBackendAuthenticated();
    }
    const docUrl = `${FIRESTORE_REST_BASE}/patients/${encodeURIComponent(patient.id)}`;
    let existingCreatedBy: string | undefined;
    let existingCreatedAt: string | undefined;
    let docExists = false;
    try {
      const existingRes = await firestoreFetch(docUrl);
      if (existingRes.status === 403) {
        if (!loggedPatientsWritePermissionWarning) {
          loggedPatientsWritePermissionWarning = true;
          console.warn(
            'Synchronisation patient Firestore en attente : autorisation requise (cache local utilise).'
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

    const baseAntecedents = Array.isArray(patient.antecedents)
      ? patient.antecedents.filter((a) => !a.startsWith('__CORBEILLE__:'))
      : [];
    if (patient.deleted) {
      baseAntecedents.push(`__CORBEILLE__:${patient.deletedAt || new Date().toISOString()}`);
    }
    const payload = {
      identifiant: patient.identifiant,
      nom: patient.nom,
      prenom: patient.prenom,
      sexe: patient.sexe,
      dateNaissance: patient.dateNaissance,
      adresse: patient.adresse,
      telephone: patient.telephone,
      email: patient.email || '',
      cabinet: patient.cabinet,
      profession: patient.profession || '',
      assurance: patient.assurance || '',
      allergies: patient.allergies || [],
      antecedents: baseAntecedents,
      traitements: patient.traitements || [],
      grossesseAllaitement: patient.grossesseAllaitement || [],
      historiqueSoins: patient.historiqueSoins || [],
      createdAt: existingCreatedAt || patient.createdAt,
      createdBy: docExists && existingCreatedBy ? existingCreatedBy : getEffectiveAuthUid(),
      deleted: Boolean(patient.deleted),
      deletedAt: patient.deletedAt || null,
      updatedAt: patient.updatedAt || new Date().toISOString(),
    };

    const response = await firestoreFetch(docUrl, {
      method: 'PATCH',
      body: JSON.stringify({ fields: toFirestoreFields(payload) }),
    });
    if (response.status === 403) {
      if (!loggedPatientsWritePermissionWarning) {
        loggedPatientsWritePermissionWarning = true;
        console.warn(
          'Synchronisation ecriture patient Firestore en attente : autorisation requise (cache local utilise).'
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
    console.error('Erreur ecriture Firestore:', error);
    return false;
  }
}

export async function updateTrashStatusInFirestore(
  patientId: string,
  deleted: boolean,
  deletedAt?: string,
  updatedAt?: string,
  patient?: PatientRecord
): Promise<boolean> {
  try {
    if (!requestTokenStorage.getStore()) {
      await ensureBackendAuthenticated();
    }
    const docUrl = `${FIRESTORE_REST_BASE}/patients/${encodeURIComponent(patientId)}`;
    const getRes = await firestoreFetch(docUrl);
    if (getRes.status === 404) {
      if (patient) {
        return await savePatientToFirestore({
          ...patient,
          deleted,
          deletedAt: deleted ? deletedAt || patient.deletedAt : undefined,
          updatedAt: updatedAt || patient.updatedAt || new Date().toISOString(),
        });
      }
      return true;
    }
    if (getRes.status === 403) {
      if (!loggedPatientsWritePermissionWarning) {
        loggedPatientsWritePermissionWarning = true;
        console.warn(
          'Synchronisation corbeille patient Firestore en attente : autorisation requise (cache local utilise).'
        );
      }
      return false;
    }
    if (!getRes.ok) {
      const errBody = await getRes.text();
      throw new Error(`HTTP ${getRes.status}: ${errBody}`);
    }

    const docJson = (await getRes.json()) as FirestoreDocument;
    const data = fromFirestoreFields(docJson.fields);
    const rawAntecedents = Array.isArray(data.antecedents) ? data.antecedents : [];
    const cleanAntecedents = rawAntecedents.filter(
      (a: unknown): a is string => typeof a === 'string' && !a.startsWith('__CORBEILLE__:')
    );
    const resolvedDeletedAt = deleted ? deletedAt || new Date().toISOString() : null;
    if (deleted && resolvedDeletedAt) {
      cleanAntecedents.push(`__CORBEILLE__:${resolvedDeletedAt}`);
    }

    const patchParams = new URLSearchParams();
    patchParams.append('updateMask.fieldPaths', 'deleted');
    patchParams.append('updateMask.fieldPaths', 'deletedAt');
    patchParams.append('updateMask.fieldPaths', 'updatedAt');
    patchParams.append('updateMask.fieldPaths', 'antecedents');

    const patchRes = await firestoreFetch(`${docUrl}?${patchParams.toString()}`, {
      method: 'PATCH',
      body: JSON.stringify({
        fields: toFirestoreFields({
          deleted,
          deletedAt: resolvedDeletedAt,
          updatedAt: updatedAt || new Date().toISOString(),
          antecedents: cleanAntecedents,
        }),
      }),
    });
    if (patchRes.status === 403) {
      if (!loggedPatientsWritePermissionWarning) {
        loggedPatientsWritePermissionWarning = true;
        console.warn(
          'Synchronisation corbeille patient Firestore en attente : autorisation requise (cache local utilise).'
        );
      }
      return false;
    }
    if (!patchRes.ok) {
      const errBody = await patchRes.text();
      throw new Error(`HTTP ${patchRes.status}: ${errBody}`);
    }
    return true;
  } catch (error) {
    console.error('Erreur mise a jour statut corbeille Firestore:', error);
    return false;
  }
}

export async function updateCareHistoryInFirestore(
  patientId: string,
  historiqueSoins: CareHistoryItem[],
  patient?: PatientRecord
): Promise<boolean> {
  try {
    if (!requestTokenStorage.getStore()) {
      await ensureBackendAuthenticated();
    }
    const docUrl = `${FIRESTORE_REST_BASE}/patients/${encodeURIComponent(patientId)}`;
    const getRes = await firestoreFetch(docUrl);
    if (getRes.status === 404) {
      if (patient) {
        return await savePatientToFirestore({ ...patient, historiqueSoins });
      }
      return true;
    }
    if (getRes.status === 403) {
      if (!loggedPatientsWritePermissionWarning) {
        loggedPatientsWritePermissionWarning = true;
        console.warn(
          'Synchronisation soins patient Firestore en attente : autorisation requise (cache local utilise).'
        );
      }
      return false;
    }
    if (!getRes.ok) {
      const errBody = await getRes.text();
      throw new Error(`HTTP ${getRes.status}: ${errBody}`);
    }

    const patchParams = new URLSearchParams();
    patchParams.append('updateMask.fieldPaths', 'historiqueSoins');
    patchParams.append('updateMask.fieldPaths', 'updatedAt');

    const response = await firestoreFetch(`${docUrl}?${patchParams.toString()}`, {
      method: 'PATCH',
      body: JSON.stringify({
        fields: toFirestoreFields({
          historiqueSoins,
          updatedAt: new Date().toISOString(),
        }),
      }),
    });
    if (response.status === 403) {
      if (!loggedPatientsWritePermissionWarning) {
        loggedPatientsWritePermissionWarning = true;
        console.warn(
          'Synchronisation soins patient Firestore en attente : autorisation requise (cache local utilise).'
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
    console.error('Erreur mise a jour soins Firestore:', error);
    return false;
  }
}

export async function deletePatientFromFirestore(patientId: string): Promise<boolean> {
  try {
    const docUrl = `${FIRESTORE_REST_BASE}/patients/${encodeURIComponent(patientId)}`;
    const response = await firestoreFetch(docUrl, { method: 'DELETE' });
    if (response.status === 403) {
      if (!loggedPatientsWritePermissionWarning) {
        loggedPatientsWritePermissionWarning = true;
        console.warn(
          'Suppression patient Firestore en attente : autorisation requise (cache local utilise).'
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
    console.error('Erreur suppression Firestore:', error);
    return false;
  }
}

// SYNCHRONISATION COLLECTION ASSURANCES FIRESTORE

let loggedAssurancesListPermissionWarning = false;

export async function fetchAssurancesFromFirestoreWithStatus(): Promise<{
  ok: boolean;
  assurances: AssuranceItem[];
}> {
  try {
    const assurances: AssuranceItem[] = [];
    const { ok, documents, forbidden } = await queryCollectionDocuments('assurances');
    if (forbidden) {
      if (!loggedAssurancesListPermissionWarning) {
        loggedAssurancesListPermissionWarning = true;
        console.warn(
          'Synchronisation lecture assurances Firestore en attente : regle allow list requise sur /assurances (cache local utilise).'
        );
      }
      return { ok: false, assurances: [] };
    }
    if (!ok) {
      return { ok: false, assurances: [] };
    }

    for (const docItem of documents) {
      const docId = docItem.name ? docItem.name.split('/').pop() || '' : '';
      if (!docId) continue;

      const data = fromFirestoreFields(docItem.fields);
      const assurance: AssuranceItem = {
        id: docId,
        label: String(data.label || ''),
        displayLabel: String(data.displayLabel || data.label || ''),
        description: typeof data.description === 'string' ? data.description : '',
        isDefault: Boolean(data.isDefault),
        deleted: Boolean(data.deleted),
        deletedAt: typeof data.deletedAt === 'string' && data.deletedAt ? data.deletedAt : undefined,
        createdAt: String(data.createdAt || new Date().toISOString()),
        updatedAt: String(data.updatedAt || data.createdAt || new Date().toISOString()),
      };
      if (assurance.label) {
        assurances.push(assurance);
      }
    }

    return { ok: true, assurances };
  } catch (error) {
    console.error('Erreur lecture assurances Firestore:', error);
    return { ok: false, assurances: [] };
  }
}

let loggedAssurancesWritePermissionWarning = false;

export async function saveAssuranceToFirestore(assurance: AssuranceItem): Promise<boolean> {
  try {
    if (!requestTokenStorage.getStore()) {
      await ensureBackendAuthenticated();
    }
    const docUrl = `${FIRESTORE_REST_BASE}/assurances/${encodeURIComponent(assurance.id)}`;
    let existingCreatedBy: string | undefined;
    let existingCreatedAt: string | undefined;
    let docExists = false;
    try {
      const existingRes = await firestoreFetch(docUrl);
      if (existingRes.status === 403) {
        if (!loggedAssurancesWritePermissionWarning) {
          loggedAssurancesWritePermissionWarning = true;
          console.warn(
            'Synchronisation assurance Firestore en attente : autorisation requise (cache local utilise).'
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
      label: assurance.label,
      displayLabel: assurance.displayLabel,
      description: assurance.description || '',
      isDefault: Boolean(assurance.isDefault),
      deleted: Boolean(assurance.deleted),
      deletedAt: assurance.deletedAt || null,
      createdAt: existingCreatedAt || assurance.createdAt,
      createdBy: docExists && existingCreatedBy ? existingCreatedBy : getEffectiveAuthUid(),
      updatedAt: assurance.updatedAt || new Date().toISOString(),
    };

    const response = await firestoreFetch(docUrl, {
      method: 'PATCH',
      body: JSON.stringify({ fields: toFirestoreFields(payload) }),
    });
    if (response.status === 403) {
      if (!loggedAssurancesWritePermissionWarning) {
        loggedAssurancesWritePermissionWarning = true;
        console.warn(
          'Synchronisation ecriture assurance Firestore en attente : autorisation requise (cache local utilise).'
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
    console.error('Erreur ecriture assurance Firestore:', error);
    return false;
  }
}

export async function updateAssuranceTrashInFirestore(
  assuranceId: string,
  deleted: boolean,
  deletedAt?: string,
  updatedAt?: string,
  assurance?: AssuranceItem
): Promise<boolean> {
  try {
    if (!requestTokenStorage.getStore()) {
      await ensureBackendAuthenticated();
    }
    const docUrl = `${FIRESTORE_REST_BASE}/assurances/${encodeURIComponent(assuranceId)}`;
    const getRes = await firestoreFetch(docUrl);
    if (getRes.status === 404) {
      if (assurance) {
        return await saveAssuranceToFirestore({
          ...assurance,
          deleted,
          deletedAt: deleted ? deletedAt || assurance.deletedAt : undefined,
          updatedAt: updatedAt || assurance.updatedAt || new Date().toISOString(),
        });
      }
      return true;
    }
    if (getRes.status === 403) {
      if (!loggedAssurancesWritePermissionWarning) {
        loggedAssurancesWritePermissionWarning = true;
        console.warn(
          'Synchronisation corbeille assurance Firestore en attente : autorisation requise (cache local utilise).'
        );
      }
      return false;
    }
    if (!getRes.ok) {
      const errBody = await getRes.text();
      throw new Error(`HTTP ${getRes.status}: ${errBody}`);
    }

    const resolvedDeletedAt = deleted ? deletedAt || new Date().toISOString() : null;
    const patchParams = new URLSearchParams();
    patchParams.append('updateMask.fieldPaths', 'deleted');
    patchParams.append('updateMask.fieldPaths', 'deletedAt');
    patchParams.append('updateMask.fieldPaths', 'updatedAt');

    const patchRes = await firestoreFetch(`${docUrl}?${patchParams.toString()}`, {
      method: 'PATCH',
      body: JSON.stringify({
        fields: toFirestoreFields({
          deleted,
          deletedAt: resolvedDeletedAt,
          updatedAt: updatedAt || new Date().toISOString(),
        }),
      }),
    });
    if (patchRes.status === 403) {
      if (!loggedAssurancesWritePermissionWarning) {
        loggedAssurancesWritePermissionWarning = true;
        console.warn(
          'Synchronisation corbeille assurance Firestore en attente : autorisation requise (cache local utilise).'
        );
      }
      return false;
    }
    if (!patchRes.ok) {
      const errBody = await patchRes.text();
      throw new Error(`HTTP ${patchRes.status}: ${errBody}`);
    }
    return true;
  } catch (error) {
    console.error('Erreur mise a jour corbeille assurance Firestore:', error);
    return false;
  }
}

export async function deleteAssuranceFromFirestore(assuranceId: string): Promise<boolean> {
  try {
    const docUrl = `${FIRESTORE_REST_BASE}/assurances/${encodeURIComponent(assuranceId)}`;
    const response = await firestoreFetch(docUrl, { method: 'DELETE' });
    if (response.status === 403) {
      if (!loggedAssurancesWritePermissionWarning) {
        loggedAssurancesWritePermissionWarning = true;
        console.warn(
          'Suppression assurance Firestore en attente : autorisation requise (cache local utilise).'
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
    console.error('Erreur suppression assurance Firestore:', error);
    return false;
  }
}

// REGISTRE LOCAL ET RECONCILIATION BIDIRECTIONNELLE

export interface SyncRegistryData {
  deletedIds: string[];
  pendingDeletes: string[];
  pendingSaves: string[];
  syncedIds: string[];
}

export interface SyncStateSets {
  deletedIds: Set<string>;
  pendingDeletes: Set<string>;
  pendingSaves: Set<string>;
  syncedIds: Set<string>;
}

export interface ReconcileSyncOptions<T extends { id: string }> {
  localItems: T[];
  firestoreItems: T[];
  state: SyncStateSets;
  pendingMutations: Set<string>;
  opQueues: Map<string, Promise<unknown>>;
  getTimestamp: (item: T) => number;
  isTombstonedLocal?: (item: T) => boolean;
  isTombstonedRemote?: (item: T) => boolean;
  mergeItems?: (local: T | undefined, remote: T) => T;
}

export interface ReconcileSyncResult<T> {
  mergedItems: T[];
  idsToPush: string[];
  ghostIdsToDelete: string[];
  registryChanged: boolean;
}

export function loadSyncRegistryFile(
  filePath: string,
  initialItemIds: string[] = []
): { registry: SyncRegistryData; existed: boolean } {
  try {
    if (!fs.existsSync(filePath)) {
      return {
        registry: {
          deletedIds: [],
          pendingDeletes: [],
          pendingSaves: [...initialItemIds],
          syncedIds: [],
        },
        existed: false,
      };
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<SyncRegistryData>;
    return {
      registry: {
        deletedIds: Array.isArray(parsed?.deletedIds) ? parsed.deletedIds : [],
        pendingDeletes: Array.isArray(parsed?.pendingDeletes) ? parsed.pendingDeletes : [],
        pendingSaves: Array.isArray(parsed?.pendingSaves) ? parsed.pendingSaves : [],
        syncedIds: Array.isArray(parsed?.syncedIds) ? parsed.syncedIds : [],
      },
      existed: true,
    };
  } catch {
    return {
      registry: {
        deletedIds: [],
        pendingDeletes: [],
        pendingSaves: [...initialItemIds],
        syncedIds: [],
      },
      existed: false,
    };
  }
}

export function persistSyncRegistryFile(
  filePath: string,
  dataDir: string,
  state: SyncStateSets
): void {
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const payload: SyncRegistryData = {
      deletedIds: Array.from(state.deletedIds),
      pendingDeletes: Array.from(state.pendingDeletes),
      pendingSaves: Array.from(state.pendingSaves),
      syncedIds: Array.from(state.syncedIds),
    };
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (error) {
    console.error('Erreur ecriture registre de synchronisation:', error);
  }
}

export function reconcileBidirectionalSync<T extends { id: string }>(
  options: ReconcileSyncOptions<T>
): ReconcileSyncResult<T> {
  const {
    localItems,
    firestoreItems,
    state,
    pendingMutations,
    opQueues,
    getTimestamp,
    isTombstonedLocal,
    isTombstonedRemote,
    mergeItems,
  } = options;

  const localMap = new Map<string, T>();
  for (const item of localItems) {
    if (item?.id) localMap.set(item.id, item);
  }

  const remoteMap = new Map<string, T>();
  for (const item of firestoreItems) {
    if (item?.id) remoteMap.set(item.id, item);
  }

  const allIds = new Set<string>([...localMap.keys(), ...remoteMap.keys()]);
  const mergedItems: T[] = [];
  const idsToPush: string[] = [];
  const ghostIdsToDelete: string[] = [];
  let registryChanged = false;

  for (const id of allIds) {
    const local = localMap.get(id);
    const remote = remoteMap.get(id);

    if (state.deletedIds.has(id) || state.pendingDeletes.has(id)) {
      if (remote) {
        ghostIdsToDelete.push(id);
      }
      continue;
    }

    if (pendingMutations.has(id) || opQueues.has(id)) {
      if (local && !isTombstonedLocal?.(local)) {
        mergedItems.push(local);
      }
      continue;
    }

    if (local && !remote) {
      if (isTombstonedLocal?.(local)) {
        continue;
      }
      if (state.pendingSaves.has(id) || !state.syncedIds.has(id)) {
        mergedItems.push(local);
        idsToPush.push(id);
      } else if (state.syncedIds.delete(id)) {
        registryChanged = true;
      }
      continue;
    }

    if (!local && remote) {
      if (isTombstonedRemote?.(remote)) {
        continue;
      }
      mergedItems.push(mergeItems ? mergeItems(undefined, remote) : remote);
      if (!state.syncedIds.has(id)) {
        state.syncedIds.add(id);
        registryChanged = true;
      }
      continue;
    }

    if (local && remote) {
      if (isTombstonedRemote?.(remote) && !state.pendingSaves.has(id)) {
        if (state.syncedIds.delete(id)) {
          registryChanged = true;
        }
        continue;
      }

      const localTs = getTimestamp(local);
      const remoteTs = getTimestamp(remote);

      if (state.pendingSaves.has(id) || localTs > remoteTs) {
        if (!isTombstonedLocal?.(local)) {
          mergedItems.push(local);
          idsToPush.push(id);
        }
      } else {
        mergedItems.push(mergeItems ? mergeItems(local, remote) : remote);
        if (state.pendingSaves.delete(id)) {
          registryChanged = true;
        }
        if (!state.syncedIds.has(id)) {
          state.syncedIds.add(id);
          registryChanged = true;
        }
      }
    }
  }

  return {
    mergedItems,
    idsToPush,
    ghostIdsToDelete,
    registryChanged,
  };
}
