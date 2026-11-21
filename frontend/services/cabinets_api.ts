import { useState, useEffect, useCallback } from 'react';
import { getAuthHeaders } from './auth_headers';
import { notifyPatientsUpdated } from './patients_api';

export interface CabinetOption {
  id: string;
  name: string;
  code?: string;
  description: string;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const CABINETS_STORAGE_KEY = 'smilo_cabinets';
export const CABINETS_UPDATED_EVENT = 'smilo:cabinets-updated';

export const DEFAULT_CABINETS: CabinetOption[] = [
  { id: 'anj', name: 'Anjanahary', code: 'ANJ', description: 'Cabinet dentaire Smilo', isDefault: true },
  { id: 'amb', name: 'Ambohitrimanjaka', code: 'AMB', description: 'Cabinet dentaire Smilo', isDefault: true },
  { id: 'ant', name: 'Antanimena', code: 'ANT', description: 'Cabinet dentaire Smilo', isDefault: true },
];

export function getCachedCabinets(): CabinetOption[] {
  try {
    const raw = localStorage.getItem(CABINETS_STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // Lecture cache locale
  }
  return [...DEFAULT_CABINETS];
}

export function setCachedCabinets(items: CabinetOption[]): void {
  try {
    localStorage.setItem(CABINETS_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Sauvegarde cache locale
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CABINETS_UPDATED_EVENT));
  }
}

// SERVICE CLIENT POUR LES CABINETS DENTAIRES
export async function getCabinetsApi(): Promise<CabinetOption[]> {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/cabinets', { headers });
  if (!response.ok) {
    throw new Error('Erreur de chargement des cabinets');
  }
  const result = await response.json();
  const data: CabinetOption[] = Array.isArray(result.data)
    ? result.data
    : [...DEFAULT_CABINETS];
  setCachedCabinets(data);
  return data;
}

export async function createCabinetApi(input: {
  name: string;
  code?: string;
  description?: string;
}): Promise<CabinetOption> {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch('/api/cabinets', {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Erreur lors de l'ajout du cabinet");
  }

  const result = await response.json();
  const created: CabinetOption = result.data;
  const current = getCachedCabinets();
  const next = [...current.filter((c) => c.id !== created.id), created];
  setCachedCabinets(next);
  return created;
}

export async function updateCabinetApi(
  id: string,
  input: {
    name: string;
    code: string;
    description?: string;
  }
): Promise<CabinetOption> {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch(`/api/cabinets/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Erreur lors de la modification du cabinet');
  }

  const result = await response.json();
  const updated: CabinetOption = result.data;
  const current = getCachedCabinets();
  const next = current.map((c) => (c.id === updated.id ? updated : c));
  setCachedCabinets(next);
  if (result.nameChanged) {
    notifyPatientsUpdated();
  }
  return updated;
}

export async function deleteCabinetApi(id: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/cabinets/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Erreur lors de la suppression du cabinet');
  }

  const next = getCachedCabinets().filter((c) => c.id !== id);
  setCachedCabinets(next);
}

export async function transferCabinetPatientsApi(input: {
  sourceCabinet: string;
  targetCabinet: string;
}): Promise<{
  sourceCabinet: string;
  targetCabinet: string;
  transferredCount: number;
  activeTransferredCount: number;
}> {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch('/api/cabinets/transfer', {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Erreur lors du transfert des patients');
  }

  const result = await response.json();
  notifyPatientsUpdated();
  return result.data;
}

export function useCabinets(): {
  cabinets: CabinetOption[];
  refreshCabinets: () => Promise<CabinetOption[]>;
} {
  const [cabinets, setCabinets] = useState<CabinetOption[]>(() => getCachedCabinets());

  const refreshCabinets = useCallback(async () => {
    const items = await getCabinetsApi();
    setCabinets(items);
    return items;
  }, []);

  useEffect(() => {
    const syncFromCache = () => {
      setCabinets(getCachedCabinets());
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === CABINETS_STORAGE_KEY) {
        syncFromCache();
      }
    };

    window.addEventListener(CABINETS_UPDATED_EVENT, syncFromCache);
    window.addEventListener('storage', handleStorage);

    getCabinetsApi().catch(() => {
      // Utilisation du cache local
    });

    return () => {
      window.removeEventListener(CABINETS_UPDATED_EVENT, syncFromCache);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return { cabinets, refreshCabinets };
}
