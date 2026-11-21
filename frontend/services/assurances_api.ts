import { getAuthHeaders } from './auth_headers';

export interface CoverageAssuranceOption {
  id: string;
  label: string;
  displayLabel: string;
  description?: string;
  isDefault?: boolean;
  deleted?: boolean;
  deletedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

const ASSURANCES_STORAGE_KEY = 'smilo_coverage_assurances';

export const DEFAULT_ASSURANCES: CoverageAssuranceOption[] = [];

export function getCachedAssurances(): CoverageAssuranceOption[] {
  try {
    const raw = localStorage.getItem(ASSURANCES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // Lecture cache locale
  }
  return [...DEFAULT_ASSURANCES];
}

export function setCachedAssurances(items: CoverageAssuranceOption[]): void {
  try {
    localStorage.setItem(ASSURANCES_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Sauvegarde cache locale
  }
}

// SERVICE CLIENT D'APPEL A L'API BACKEND POUR LES ASSURANCES
export async function getAssurancesApi(
  inTrash = false
): Promise<CoverageAssuranceOption[]> {
  const url = inTrash ? '/api/assurances?inTrash=true' : '/api/assurances';
  const headers = await getAuthHeaders();
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error('Erreur de chargement des assurances');
  }
  const result = await response.json();
  const data: CoverageAssuranceOption[] = Array.isArray(result.data)
    ? result.data
    : inTrash
      ? []
      : [...DEFAULT_ASSURANCES];
  if (!inTrash) {
    setCachedAssurances(data);
  }
  return data;
}

export async function createAssuranceApi(input: {
  label: string;
  description?: string;
}): Promise<CoverageAssuranceOption> {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch('/api/assurances', {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Erreur lors de l'ajout de l'assurance");
  }

  const result = await response.json();
  return result.data;
}

export async function deleteAssuranceApi(id: string): Promise<CoverageAssuranceOption> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/assurances/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Erreur lors de la mise en corbeille');
  }

  const result = await response.json();
  return result.data;
}

export async function restoreAssuranceApi(
  id: string
): Promise<CoverageAssuranceOption> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/assurances/${encodeURIComponent(id)}/restore`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Erreur lors de la restauration');
  }

  const result = await response.json();
  return result.data;
}

export async function deleteAssurancePermanentlyApi(id: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `/api/assurances/${encodeURIComponent(id)}/permanent`,
    {
      method: 'DELETE',
      headers,
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || 'Erreur lors de la suppression définitive'
    );
  }
}

export async function emptyAssuranceTrashApi(): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/assurances/trash/empty', {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Erreur lors du vidage de la corbeille');
  }
}
