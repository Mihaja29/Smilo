import { ProsthesisFormData } from '../prostheses/add_prosthesis_modal';
import { ProsthesisProcessingStatus } from '../prostheses/prostheses_visibility_menu';
import { ProsthesisRecord } from '../prostheses/prostheses_types';
import { getAuthHeaders } from './auth_headers';

export const PROTHESES_UPDATED_EVENT = 'smilo:protheses-updated';

export function notifyProsthesesUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PROTHESES_UPDATED_EVENT));
  }
}

const SYNCED_IDS_STORAGE_KEY = 'smilo_protheses_synced_ids';

export function getSyncedProsthesisIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SYNCED_IDS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

export function markProsthesisIdsSynced(ids: string[]): void {
  if (ids.length === 0) return;
  try {
    const current = getSyncedProsthesisIds();
    for (const id of ids) {
      if (id) current.add(id);
    }
    localStorage.setItem(SYNCED_IDS_STORAGE_KEY, JSON.stringify(Array.from(current)));
  } catch {
    // Stockage local indisponible
  }
}

export type CreateProsthesisPayload = ProsthesisFormData & {
  id?: string;
  etatTraitement?: ProsthesisProcessingStatus;
  deleted?: boolean;
  deletedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

// SERVICE CLIENT API POUR LES PROTHESES DENTAIRES
export async function getProsthesesApi(
  inTrash = false
): Promise<ProsthesisRecord[]> {
  const url = inTrash ? '/api/protheses?inTrash=true' : '/api/protheses';
  const headers = await getAuthHeaders();
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error('Erreur lors du chargement des prothèses dentaires');
  }
  const result = await response.json();
  return Array.isArray(result.data) ? (result.data as ProsthesisRecord[]) : [];
}

export async function createProsthesisApi(
  input: CreateProsthesisPayload
): Promise<ProsthesisRecord> {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch('/api/protheses', {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || "Erreur lors de l'enregistrement de la prothèse dentaire"
    );
  }

  const result = await response.json();
  const created = result.data as ProsthesisRecord;
  if (created?.id) {
    markProsthesisIdsSynced([created.id]);
  }
  return created;
}

export async function updateProsthesisStatusApi(
  id: string,
  etatTraitement: ProsthesisProcessingStatus
): Promise<ProsthesisRecord> {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch(
    `/api/protheses/${encodeURIComponent(id)}/status`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ etatTraitement }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || "Erreur lors de la mise à jour de l'état de traitement"
    );
  }

  const result = await response.json();
  return result.data as ProsthesisRecord;
}

export async function updateProsthesisApi(
  id: string,
  input: ProsthesisFormData
): Promise<ProsthesisRecord> {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch(`/api/protheses/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || 'Erreur lors de la modification de la prothèse dentaire'
    );
  }

  const result = await response.json();
  return result.data as ProsthesisRecord;
}

export async function deleteProsthesisApi(id: string): Promise<ProsthesisRecord> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/protheses/${encodeURIComponent(id)}/trash`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || 'Erreur lors de la mise en corbeille de la prothèse'
    );
  }

  const result = await response.json();
  return result.data as ProsthesisRecord;
}

export async function restoreProsthesisApi(id: string): Promise<ProsthesisRecord> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `/api/protheses/${encodeURIComponent(id)}/restore`,
    {
      method: 'POST',
      headers,
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || 'Erreur lors de la restauration de la prothèse'
    );
  }

  const result = await response.json();
  return result.data as ProsthesisRecord;
}

export async function deleteProsthesisPermanentlyApi(id: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `/api/protheses/${encodeURIComponent(id)}/permanent`,
    {
      method: 'DELETE',
      headers,
    }
  );

  if (!response.ok && response.status !== 404) {
    throw new Error('Erreur lors de la suppression définitive de la prothèse');
  }
}

export async function emptyProsthesisTrashApi(): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/protheses/trash/empty', {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    throw new Error('Erreur lors du vidage de la corbeille des prothèses');
  }
}
