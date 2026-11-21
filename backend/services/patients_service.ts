import {
  PatientRecord,
  CareHistoryItem,
  getCabinetCode,
  formatRecordId,
  calculateNextSequence,
} from '../models/patient_model';

// SERVICE METIER DE GESTION DES DOSSIERS PATIENTS ET SOINS
class PatientsService {
  private records: Map<string, PatientRecord> = new Map();

  constructor() {
    // Liste initiale vide
  }


  public getAllPatients(): PatientRecord[] {
    const list = Array.from(this.records.values());
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public getPatientById(id: string): PatientRecord | null {
    return this.records.get(id) || null;
  }

  public getNextIdPreview(cabinet: string): string {
    const list = Array.from(this.records.values());
    const code = getCabinetCode(cabinet);
    if (!code) return '';
    const seq = calculateNextSequence(cabinet, list);
    return formatRecordId(code, seq);
  }

  public createPatient(data: Omit<PatientRecord, 'id' | 'createdAt'>): PatientRecord {
    const list = Array.from(this.records.values());
    const cabinet = data.cabinet || 'Anjanahary';
    const code = getCabinetCode(cabinet);

    let identifiant = data.identifiant;
    if (!identifiant || !identifiant.startsWith(`CAB-${code}-`)) {
      const nextSeq = calculateNextSequence(cabinet, list);
      identifiant = formatRecordId(code, nextSeq);
    }

    const newId = `pat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newRecord: PatientRecord = {
      ...data,
      id: newId,
      identifiant,
      createdAt: new Date().toISOString(),
      historiqueSoins: data.historiqueSoins || [],
    };

    this.records.set(newId, newRecord);
    return newRecord;
  }

  public updatePatient(id: string, partial: Partial<PatientRecord>): PatientRecord | null {
    const existing = this.records.get(id);
    if (!existing) return null;

    const updated: PatientRecord = {
      ...existing,
      ...partial,
      id: existing.id,
      createdAt: existing.createdAt,
    };

    this.records.set(id, updated);
    return updated;
  }

  public addCareAct(
    patientId: string,
    careItemData: Omit<CareHistoryItem, 'id'>
  ): PatientRecord | null {
    const patient = this.records.get(patientId);
    if (!patient) return null;

    const newCareId = `soin-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newCareItem: CareHistoryItem = {
      ...careItemData,
      id: newCareId,
    };

    const currentHistory = patient.historiqueSoins || [];
    const updatedHistory = [newCareItem, ...currentHistory];

    const updatedPatient: PatientRecord = {
      ...patient,
      historiqueSoins: updatedHistory,
    };

    this.records.set(patientId, updatedPatient);
    return updatedPatient;
  }

  public deletePatient(id: string): boolean {
    return this.records.delete(id);
  }
}

export const patientsService = new PatientsService();
