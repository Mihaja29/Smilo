import { CoverageFormData } from '../assurances/add_coverage_modal';
import { getAuthHeaders } from './auth_headers';

export const COVERAGES_UPDATED_EVENT = 'smilo:coverages-updated';

export function notifyCoveragesUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(COVERAGES_UPDATED_EVENT));
  }
}

export type CoverageProcessingStatus = 'En cours' | 'Reçu';

export interface PriseEnChargeRecord extends CoverageFormData {
  id: string;
  etatTraitement?: CoverageProcessingStatus;
  dateObtentionCheque?: string;
  deleted?: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

const COVERAGES_STORAGE_KEY = 'smilo_prises_en_charge';

export function getCachedCoverages(): PriseEnChargeRecord[] {
  try {
    const raw = localStorage.getItem(COVERAGES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setCachedCoverages(items: PriseEnChargeRecord[]): void {
  try {
    localStorage.setItem(COVERAGES_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Stockage local indisponible
  }
}

// SERVICE CLIENT API POUR LES PRISES EN CHARGE
export async function getCoveragesApi(
  inTrash = false
): Promise<PriseEnChargeRecord[]> {
  const url = inTrash
    ? '/api/prises-en-charge?inTrash=true'
    : '/api/prises-en-charge';
  const headers = await getAuthHeaders();
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error('Erreur lors du chargement des prises en charge');
  }
  const result = await response.json();
  const data = Array.isArray(result.data)
    ? (result.data as PriseEnChargeRecord[])
    : [];
  if (!inTrash) {
    setCachedCoverages(data);
  }
  return data;
}

export async function createCoverageApi(
  input: CoverageFormData
): Promise<PriseEnChargeRecord> {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch('/api/prises-en-charge', {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || "Erreur lors de l'enregistrement de la prise en charge"
    );
  }

  const result = await response.json();
  return result.data as PriseEnChargeRecord;
}

export async function updateCoverageStatusApi(
  id: string,
  etatTraitement: CoverageProcessingStatus,
  dateObtentionCheque?: string
): Promise<PriseEnChargeRecord> {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch(
    `/api/prises-en-charge/${encodeURIComponent(id)}/status`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        etatTraitement,
        dateObtentionCheque: dateObtentionCheque ?? '',
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || "Erreur lors de la mise à jour de l'état de traitement"
    );
  }

  const result = await response.json();
  return result.data as PriseEnChargeRecord;
}

export async function updateCoverageApi(
  id: string,
  input: CoverageFormData
): Promise<PriseEnChargeRecord> {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch(
    `/api/prises-en-charge/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify(input),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || 'Erreur lors de la modification de la prise en charge'
    );
  }

  const result = await response.json();
  return result.data as PriseEnChargeRecord;
}

export async function deleteCoverageApi(
  id: string
): Promise<PriseEnChargeRecord> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `/api/prises-en-charge/${encodeURIComponent(id)}/trash`,
    {
      method: 'POST',
      headers,
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || 'Erreur lors de la mise en corbeille de la prise en charge'
    );
  }

  const result = await response.json();
  return result.data as PriseEnChargeRecord;
}

export async function restoreCoverageApi(
  id: string
): Promise<PriseEnChargeRecord> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `/api/prises-en-charge/${encodeURIComponent(id)}/restore`,
    {
      method: 'POST',
      headers,
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || 'Erreur lors de la restauration de la prise en charge'
    );
  }

  const result = await response.json();
  return result.data as PriseEnChargeRecord;
}

export async function deleteCoveragePermanentlyApi(id: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `/api/prises-en-charge/${encodeURIComponent(id)}/permanent`,
    {
      method: 'DELETE',
      headers,
    }
  );

  if (!response.ok && response.status !== 404) {
    throw new Error('Erreur lors de la suppression définitive de la prise en charge');
  }
}

export async function emptyCoverageTrashApi(): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/prises-en-charge/trash/empty', {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    throw new Error('Erreur lors du vidage de la corbeille des prises en charge');
  }
}
