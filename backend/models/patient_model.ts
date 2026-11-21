// MODELES ET STRUCTURES DES DOSSIERS PATIENTS
export interface CareHistoryItem {
  id: string;
  date: string;
  actesProduitsMedicaments: string;
  observations: string;
  montant: string;
}

export interface PatientRecord {
  id: string;
  identifiant: string;
  nom: string;
  prenom: string;
  sexe: string;
  dateNaissance: string;
  adresse: string;
  telephone: string;
  email: string;
  cabinet: string;
  profession: string;
  assurance: string;
  allergies: string[];
  antecedents: string[];
  traitements: string[];
  grossesseAllaitement: string[];
  historiqueSoins?: CareHistoryItem[];
  createdAt: string;
  createdBy?: string;
}

export const CABINET_CODES: Record<string, string> = {
  Anjanahary: 'ANJ',
  Ambohitrimanjaka: 'AMB',
  Antanimena: 'ANT',
};

export function getCabinetCode(cabinet: string): string {
  return CABINET_CODES[cabinet] || '';
}

export function formatRecordId(cabinetCode: string, sequenceNumber: number): string {
  if (!cabinetCode || sequenceNumber < 1) return '';
  const padded = String(sequenceNumber).padStart(6, '0');
  return `CAB-${cabinetCode}-${padded}`;
}

export function calculateNextSequence(cabinet: string, existingRecords: PatientRecord[]): number {
  const code = getCabinetCode(cabinet);
  if (!code) return 1;

  const prefix = `CAB-${code}-`;
  let maxSeq = 0;

  for (const record of existingRecords) {
    if (record.identifiant && record.identifiant.startsWith(prefix)) {
      const numPart = record.identifiant.substring(prefix.length);
      const parsed = parseInt(numPart, 10);
      if (!isNaN(parsed) && parsed > maxSeq) {
        maxSeq = parsed;
      }
    }
  }

  return maxSeq + 1;
}
