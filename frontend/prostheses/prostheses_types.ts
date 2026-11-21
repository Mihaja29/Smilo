import { ProsthesisFormData } from './add_prosthesis_modal';
import { ProsthesisProcessingStatus } from './prostheses_visibility_menu';

export interface ProsthesisRecord extends ProsthesisFormData {
  id: string;
  etatTraitement?: ProsthesisProcessingStatus;
  deleted?: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

const PROSTHESES_STORAGE_KEY = 'smilo_protheses_dentaires';

// STOCKAGE LOCAL DES PROTHESES DENTAIRES
export function getCachedProstheses(): ProsthesisRecord[] {
  try {
    const raw = localStorage.getItem(PROSTHESES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ProsthesisRecord[]) : [];
  } catch {
    return [];
  }
}

export function setCachedProstheses(items: ProsthesisRecord[]): void {
  try {
    localStorage.setItem(PROSTHESES_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Stockage local indisponible
  }
}
