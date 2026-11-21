// Utilitaires de generation d'identifiant par cabinet

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
  deleted?: boolean;
  deletedAt?: string;
  createdAt: string;
}

export const CABINET_CODES: Record<string, string> = {
  Anjanahary: 'ANJ',
  Ambohitrimanjaka: 'AMB',
  Antanimena: 'ANT',
};

const KNOWN_CABINET_CODES: Record<string, string> = {
  anjanahary: 'ANJ',
  ambohitrimanjaka: 'AMB',
  antanimena: 'ANT',
};

export const normalizeCabinetCode = (value: string): string => {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .slice(0, 6);
};

export const suggestCabinetCode = (cabinet: string): string => {
  const trimmed = (cabinet || '').trim();
  if (!trimmed) return '';
  const normalizedKey = trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (KNOWN_CABINET_CODES[normalizedKey]) {
    return KNOWN_CABINET_CODES[normalizedKey];
  }
  const lettersOnly = normalizedKey.replace(/[^a-z]/g, '').toUpperCase();
  if (lettersOnly.length >= 2) {
    return lettersOnly.slice(0, 3);
  }
  if (lettersOnly.length === 1) {
    return `${lettersOnly}CB`;
  }
  return 'CAB';
};

export const getCabinetCode = (
  cabinet: string,
  cabinetsList?: Array<{ name: string; code?: string }>
): string => {
  const trimmed = (cabinet || '').trim();
  if (!trimmed) return '';
  if (Array.isArray(cabinetsList)) {
    const matched = cabinetsList.find(
      (item) => item.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (matched?.code) {
      const normalized = normalizeCabinetCode(matched.code);
      if (normalized.length >= 2) {
        return normalized;
      }
    }
  }
  return suggestCabinetCode(trimmed);
};

export const formatRecordId = (cabinetCode: string, sequenceNumber: number): string => {
  if (!cabinetCode || sequenceNumber < 1) return '';
  const padded = String(sequenceNumber).padStart(6, '0');
  return `CAB-${cabinetCode}-${padded}`;
};

export const getNextSequenceNumber = (
  cabinet: string,
  existingIds: string[],
  cabinetsList?: Array<{ name: string; code?: string }>
): number => {
  const code = getCabinetCode(cabinet, cabinetsList);
  if (!code) return 1;

  const prefix = `CAB-${code}-`;
  let maxSeq = 0;

  for (const id of existingIds) {
    if (id && id.startsWith(prefix)) {
      const numPart = id.substring(prefix.length);
      const parsed = parseInt(numPart, 10);
      if (!isNaN(parsed) && parsed > maxSeq) {
        maxSeq = parsed;
      }
    }
  }

  return maxSeq + 1;
};

export const generateRecordId = (
  cabinet: string,
  existingIds: string[] = [],
  cabinetsList?: Array<{ name: string; code?: string }>
): string => {
  const code = getCabinetCode(cabinet, cabinetsList);
  if (!code) return '';
  const nextSeq = getNextSequenceNumber(cabinet, existingIds, cabinetsList);
  return formatRecordId(code, nextSeq);
};
