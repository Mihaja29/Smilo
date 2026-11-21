import { PatientRecord, CareHistoryItem } from '../fiches/record_id_utils';
import { getAuthHeaders } from './auth_headers';

export const PATIENTS_UPDATED_EVENT = 'smilo:patients-updated';

export function notifyPatientsUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PATIENTS_UPDATED_EVENT));
  }
}

// SERVICE CLIENT D'APPEL A L'API BACKEND POUR LES DOSSIERS PATIENTS
export async function getPatientsApi(inTrash = false): Promise<PatientRecord[]> {
  const url = inTrash ? '/api/patients?inTrash=true' : '/api/patients';
  const headers = await getAuthHeaders();
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error('Erreur de chargement des patients');
  }
  const result = await response.json();
  return result.data || [];
}

export async function getNextIdApi(cabinet: string): Promise<string> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/patients/next-id?cabinet=${encodeURIComponent(cabinet)}`, { headers });
  if (!response.ok) {
    return '';
  }
  const result = await response.json();
  return result.data?.nextId || '';
}

export async function createPatientApi(
  patientData: Omit<PatientRecord, 'id' | 'createdAt'>
): Promise<PatientRecord> {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch('/api/patients', {
    method: 'POST',
    headers,
    body: JSON.stringify(patientData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Erreur lors de la creation du patient');
  }

  const result = await response.json();
  return result.data;
}

export async function updatePatientApi(
  patientId: string,
  patientData: Partial<PatientRecord>
): Promise<PatientRecord> {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch(`/api/patients/${encodeURIComponent(patientId)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(patientData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Erreur lors de la modification du patient');
  }

  const result = await response.json();
  return result.data;
}

export async function addCareActApi(
  patientId: string,
  careItem: Omit<CareHistoryItem, 'id'>
): Promise<PatientRecord | CareHistoryItem> {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch(`/api/patients/${patientId}/soins`, {
    method: 'POST',
    headers,
    body: JSON.stringify(careItem),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Erreur lors de l'enregistrement du soin");
  }

  const result = await response.json();
  return result.data;
}

export async function updateCareActApi(
  patientId: string,
  careId: string,
  careItem: Omit<CareHistoryItem, 'id'>
): Promise<PatientRecord> {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch(
    `/api/patients/${encodeURIComponent(patientId)}/soins/${encodeURIComponent(careId)}`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify(careItem),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Erreur lors de la modification du soin');
  }

  const result = await response.json();
  return result.data;
}

export async function deleteCareActApi(
  patientId: string,
  careId: string
): Promise<boolean> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `/api/patients/${encodeURIComponent(patientId)}/soins/${encodeURIComponent(careId)}`,
    {
      method: 'DELETE',
      headers,
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Erreur lors de la suppression du soin');
  }

  return true;
}

export async function deletePatientApi(patientId: string): Promise<boolean> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/patients/${encodeURIComponent(patientId)}/trash`, {
    method: 'POST',
    headers,
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Erreur lors de la mise en corbeille');
  }
  return true;
}

export async function restorePatientApi(patientId: string): Promise<PatientRecord | null> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/patients/${encodeURIComponent(patientId)}/restore`, {
    method: 'POST',
    headers,
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Erreur lors de la restauration');
  }
  const result = await response.json().catch(() => null);
  return result?.data || null;
}

export async function deletePatientPermanentlyApi(patientId: string): Promise<boolean> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/patients/${encodeURIComponent(patientId)}/permanent`, {
    method: 'DELETE',
    headers,
  });
  if (!response.ok && response.status !== 404) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Erreur lors de la suppression définitive');
  }
  return true;
}

export async function emptyTrashApi(): Promise<boolean> {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/patients/trash/empty', {
    method: 'DELETE',
    headers,
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Erreur lors du vidage de la corbeille');
  }
  return true;
}

export async function getPatientsStatsApi(): Promise<{
  totalPatients: number;
  byCabinet: Record<string, number>;
  totalCares: number;
}> {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/patients/stats', { headers });
  if (!response.ok) {
    throw new Error('Erreur de chargement des statistiques patients');
  }
  const result = await response.json();
  return result.data;
}
