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
  sexe: 'Masculin' | 'Féminin' | string;
  dateNaissance: string;
  adresse: string;
  telephone: string;
  email?: string;
  cabinet: string;
  profession?: string;
  assurance?: string;
  allergies?: string[];
  antecedents?: string[];
  traitements?: string[];
  grossesseAllaitement?: string[];
  historiqueSoins?: CareHistoryItem[];
  deleted?: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreatePatientInput {
  identifiant?: string;
  nom: string;
  prenom: string;
  sexe: string;
  dateNaissance: string;
  adresse: string;
  telephone: string;
  email?: string;
  cabinet: string;
  profession?: string;
  assurance?: string;
  allergies?: string[];
  antecedents?: string[];
  traitements?: string[];
  grossesseAllaitement?: string[];
}

export interface AddCareInput {
  date: string;
  actesProduitsMedicaments: string;
  observations: string;
  montant: string;
}

export interface AssuranceItem {
  id: string;
  label: string;
  displayLabel: string;
  description?: string;
  isDefault?: boolean;
  deleted?: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PriseEnChargeItem {
  id: string;
  cabinetDentaire: string;
  numeroFacture: string;
  montantProposeAriary: string;
  montantAssuranceAriary: string;
  patientNomPrenom: string;
  nomSociete: string;
  agence: string;
  numeroPriseEnCharge: string;
  dateAttestation?: string;
  createursPriseEnCharge?: string;
  dateEnvoi?: string;
  etatTraitement?: 'En cours' | 'Reçu';
  dateObtentionCheque?: string;
  deleted?: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ProtheseItem {
  id: string;
  cabinetDentaire: string;
  patientNomPrenom: string;
  patientContact?: string;
  numeroDentaire: string;
  typeProthese: string;
  teinteProthese?: string;
  nomLaboratoire: string;
  nomCreateurProthese?: string;
  dateEnvoi: string;
  dateLivraison?: string;
  montant: string;
  etatTraitement?: 'En cours' | 'Terminer';
  deleted?: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CabinetItem {
  id: string;
  name: string;
  code?: string;
  description: string;
  isDefault?: boolean;
  deleted?: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export type DiscussionRole = 'user' | 'assistant';

export interface DiscussionMessage {
  id: string;
  conversationId?: string;
  role: DiscussionRole;
  authorName: string;
  authorUid: string;
  content: string;
  imageDataUrl?: string;
  deleted?: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AskDiscussionInput {
  conversationId?: string;
  authorName: string;
  authorUid?: string;
  prompt: string;
  imageDataUrl?: string;
}

export type AiEntityType = 'patient' | 'prothese' | 'prise_en_charge';

export interface AiCreatedEntity {
  type: AiEntityType;
  id: string;
  label: string;
}

export interface AiFormRequest {
  entityType: AiEntityType;
  prefill?: Record<string, unknown>;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
