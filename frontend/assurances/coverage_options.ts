export interface CoverageAssuranceOption {
  id: string;
  menuId: 'coverage_havana' | 'coverage_bcm';
  label: string;
}

// ORGANISMES D'ASSURANCE RATTACHES A LA PAGE PRISE EN CHARGE
export const COVERAGE_ASSURANCES: CoverageAssuranceOption[] = [];

export const CUSTOM_ASSURANCE_VALUE = '__autre__';

export function isStandardAssurance(value?: string): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return COVERAGE_ASSURANCES.some((item) => item.label.toLowerCase() === normalized);
}
