import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CloseIcon, ChevronDownIcon } from '../navigation/navigation_icons';
import { getPatientsApi } from '../services/patients_api';
import { PatientRecord } from '../fiches/record_id_utils';
import { useCabinets } from '../services/cabinets_api';

export interface CoverageFormData {
  cabinetDentaire: string;
  numeroFacture: string;
  montantProposeAriary: string;
  montantAssuranceAriary: string;
  patientNomPrenom: string;
  nomSociete: string;
  numeroPriseEnCharge: string;
  dateAttestation: string;
  createursPriseEnCharge: string;
  dateEnvoi: string;
  agence: string;
}

interface AddCoverageModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingInvoiceNumbers?: string[];
  initialCoverage?: CoverageFormData | null;
  onSubmit?: (data: CoverageFormData) => Promise<void> | void;
}

const normalizeSearchText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const normalizeInvoiceNumber = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const cleaned = trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '/')
    .replace(/^\/+|\/+$/g, '');
  if (!cleaned) {
    return trimmed.toLowerCase();
  }
  return cleaned
    .split('/')
    .map((part) => (/^\d+$/.test(part) ? part.replace(/^0+/, '') || '0' : part))
    .join('/');
};

// BOITE MODALE MULTI-ETAPES NOUVELLE PRISE EN CHARGE
export const AddCoverageModal: React.FC<AddCoverageModalProps> = ({
  isOpen,
  onClose,
  existingInvoiceNumbers = [],
  initialCoverage = null,
  onSubmit,
}) => {
  const [step, setStep] = useState<number>(1);
  const [direction, setDirection] = useState<number>(1);

  // Champs Etape 1 : Prestataire / Facture
  const [cabinetDentaire, setCabinetDentaire] = useState('');
  const [numeroFacture, setNumeroFacture] = useState('');
  const [montantProposeAriary, setMontantProposeAriary] = useState('');
  const [montantAssuranceAriary, setMontantAssuranceAriary] = useState('');
  const [hasAttemptedNextStep1, setHasAttemptedNextStep1] = useState(false);
  const { cabinets: availableCabinets, refreshCabinets } = useCabinets();
  const cabinetOptions = useMemo(() => {
    const names = availableCabinets.map((c) => c.name);
    const current = cabinetDentaire.trim();
    if (current && !names.some((n) => n.toLowerCase() === current.toLowerCase())) {
      return [...names, current];
    }
    return names;
  }, [availableCabinets, cabinetDentaire]);

  // Champs Etape 2 : Patient / Societe
  const [patientNomPrenom, setPatientNomPrenom] = useState('');
  const [nomSociete, setNomSociete] = useState('');
  const [hasAttemptedNextStep2, setHasAttemptedNextStep2] = useState(false);
  const [insuredPatients, setInsuredPatients] = useState<PatientRecord[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);
  const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState(false);
  const patientFieldRef = useRef<HTMLDivElement>(null);

  // Champs Etape 3 : Prise en charge
  const [numeroPriseEnCharge, setNumeroPriseEnCharge] = useState('');
  const [dateAttestation, setDateAttestation] = useState('');
  const [createursPriseEnCharge, setCreateursPriseEnCharge] = useState('');
  const [dateEnvoi, setDateEnvoi] = useState('');
  const [agence, setAgence] = useState('');
  const [hasAttemptedSubmitStep3, setHasAttemptedSubmitStep3] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setDirection(1);
    setHasAttemptedNextStep1(false);
    setHasAttemptedNextStep2(false);
    setHasAttemptedSubmitStep3(false);
    setIsSubmitting(false);
    setSubmitError('');
    refreshCabinets().catch(() => {
      // Utilisation du cache local
    });
    if (initialCoverage) {
      setCabinetDentaire(initialCoverage.cabinetDentaire || '');
      setNumeroFacture(initialCoverage.numeroFacture || '');
      setMontantProposeAriary(initialCoverage.montantProposeAriary || '');
      setMontantAssuranceAriary(initialCoverage.montantAssuranceAriary || '');
      setPatientNomPrenom(initialCoverage.patientNomPrenom || '');
      setNomSociete(initialCoverage.nomSociete || '');
      setNumeroPriseEnCharge(initialCoverage.numeroPriseEnCharge || '');
      setDateAttestation(initialCoverage.dateAttestation || '');
      setCreateursPriseEnCharge(initialCoverage.createursPriseEnCharge || '');
      setDateEnvoi(initialCoverage.dateEnvoi || '');
      setAgence(initialCoverage.agence || '');
    } else {
      setCabinetDentaire('');
      setNumeroFacture('');
      setMontantProposeAriary('');
      setMontantAssuranceAriary('');
      setPatientNomPrenom('');
      setNomSociete('');
      setNumeroPriseEnCharge('');
      setDateAttestation('');
      setCreateursPriseEnCharge('');
      setDateEnvoi('');
      setAgence('');
    }
    setIsPatientDropdownOpen(false);

    let isCancelled = false;
    setIsLoadingPatients(true);
    getPatientsApi(false)
      .then((patients) => {
        if (isCancelled) return;
        const insuredOnly = patients.filter((p) => {
          const assurance = (p.assurance || '').trim();
          return (
            assurance.length > 0 &&
            assurance.toLowerCase() !== 'aucune assurance'
          );
        });
        setInsuredPatients(insuredOnly);
      })
      .catch(() => {
        if (!isCancelled) {
          setInsuredPatients([]);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingPatients(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, initialCoverage]);

  const handleClose = () => {
    if (isSubmitting) return;
    setStep(1);
    setDirection(1);
    setHasAttemptedNextStep1(false);
    setHasAttemptedNextStep2(false);
    setHasAttemptedSubmitStep3(false);
    setSubmitError('');
    setIsPatientDropdownOpen(false);
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (isPatientDropdownOpen) {
          setIsPatientDropdownOpen(false);
          return;
        }
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPatientDropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        patientFieldRef.current &&
        !patientFieldRef.current.contains(event.target as Node)
      ) {
        setIsPatientDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredInsuredPatients = useMemo(() => {
    const query = normalizeSearchText(patientNomPrenom);
    if (!query) return [];

    return insuredPatients.filter((p) => {
      const nom = normalizeSearchText(p.nom || '');
      const prenom = normalizeSearchText(p.prenom || '');
      const fullName = `${nom} ${prenom}`.trim();
      const reverseName = `${prenom} ${nom}`.trim();

      return (
        nom.includes(query) ||
        prenom.includes(query) ||
        fullName.includes(query) ||
        reverseName.includes(query)
      );
    });
  }, [insuredPatients, patientNomPrenom]);

  const findExactPatientMatch = (name: string): PatientRecord | undefined => {
    const normalized = normalizeSearchText(name);
    if (!normalized) return undefined;
    return insuredPatients.find((p) => {
      const nom = normalizeSearchText(p.nom || '');
      const prenom = normalizeSearchText(p.prenom || '');
      return (
        `${nom} ${prenom}`.trim() === normalized ||
        `${prenom} ${nom}`.trim() === normalized
      );
    });
  };

  const handleSelectPatient = (patient: PatientRecord) => {
    const formattedName = `${patient.nom || ''} ${patient.prenom || ''}`.trim();
    setPatientNomPrenom(formattedName);
    setAgence((patient.assurance || '').trim());
    setIsPatientDropdownOpen(false);
  };

  const normalizedExistingInvoices = useMemo(() => {
    const set = new Set<string>();
    for (const item of existingInvoiceNumbers) {
      const normalized = normalizeInvoiceNumber(item || '');
      if (normalized) {
        set.add(normalized);
      }
    }
    return set;
  }, [existingInvoiceNumbers]);

  // Validation Etape 1
  const isCabinetValid = cabinetDentaire.trim().length > 0;
  const isNumeroFactureEmpty = numeroFacture.trim().length === 0;
  const isNumeroFactureDuplicate =
    !isNumeroFactureEmpty &&
    normalizedExistingInvoices.has(normalizeInvoiceNumber(numeroFacture));
  const isNumeroFactureValid = !isNumeroFactureEmpty && !isNumeroFactureDuplicate;
  const parsedMontantPropose = Number(montantProposeAriary);
  const isMontantProposeValid =
    montantProposeAriary.trim().length > 0 &&
    !Number.isNaN(parsedMontantPropose) &&
    parsedMontantPropose >= 0;
  const parsedMontantAssurance = Number(montantAssuranceAriary);
  const isMontantAssuranceValid =
    montantAssuranceAriary.trim().length > 0 &&
    !Number.isNaN(parsedMontantAssurance) &&
    parsedMontantAssurance >= 0;
  const isStep1Valid =
    isCabinetValid &&
    isNumeroFactureValid &&
    isMontantProposeValid &&
    isMontantAssuranceValid;

  const handleNextStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setHasAttemptedNextStep1(true);

    if (!isStep1Valid) {
      return;
    }

    setDirection(1);
    setStep(2);
  };

  // Validation Etape 2
  const isPatientNomPrenomValid = patientNomPrenom.trim().length > 0;
  const isNomSocieteValid = nomSociete.trim().length > 0;
  const isStep2Valid = isPatientNomPrenomValid && isNomSocieteValid;

  const handleNextStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    setHasAttemptedNextStep2(true);

    if (!isStep2Valid) {
      return;
    }

    if (!agence.trim()) {
      const matched = findExactPatientMatch(patientNomPrenom);
      if (matched && matched.assurance) {
        setAgence(matched.assurance.trim());
      }
    }

    setIsPatientDropdownOpen(false);
    setDirection(1);
    setStep(3);
  };

  const handlePrevStep = () => {
    setIsPatientDropdownOpen(false);
    setDirection(-1);
    setStep((prev) => Math.max(1, prev - 1));
  };

  // Validation Etape 3
  const isAgenceValid = agence.trim().length > 0;
  const isNumeroPriseEnChargeValid = numeroPriseEnCharge.trim().length > 0;
  const isStep3Valid = isAgenceValid && isNumeroPriseEnChargeValid;

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setHasAttemptedSubmitStep3(true);
    setSubmitError('');

    if (!isStep3Valid) {
      return;
    }

    setIsSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit({
          cabinetDentaire: cabinetDentaire.trim(),
          numeroFacture: numeroFacture.trim(),
          montantProposeAriary: montantProposeAriary.trim(),
          montantAssuranceAriary: montantAssuranceAriary.trim(),
          patientNomPrenom: patientNomPrenom.trim(),
          nomSociete: nomSociete.trim(),
          numeroPriseEnCharge: numeroPriseEnCharge.trim(),
          dateAttestation: dateAttestation.trim(),
          createursPriseEnCharge: createursPriseEnCharge.trim(),
          dateEnvoi: dateEnvoi.trim(),
          agence: agence.trim(),
        });
      }
      setCabinetDentaire('');
      setNumeroFacture('');
      setMontantProposeAriary('');
      setMontantAssuranceAriary('');
      setPatientNomPrenom('');
      setNomSociete('');
      setNumeroPriseEnCharge('');
      setDateAttestation('');
      setCreateursPriseEnCharge('');
      setDateEnvoi('');
      setAgence('');
      setStep(1);
      setDirection(1);
      setHasAttemptedNextStep1(false);
      setHasAttemptedNextStep2(false);
      setHasAttemptedSubmitStep3(false);
      setSubmitError('');
      setIsPatientDropdownOpen(false);
      onClose();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Impossible d'enregistrer la prise en charge.";
      setSubmitError(msg);
      if (msg.toLowerCase().includes('facture')) {
        setDirection(-1);
        setStep(1);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 1:
        return 'Prestataire / Facture';
      case 2:
        return 'Patient / Société';
      case 3:
        return 'Prise en charge';
      default:
        return 'Nouvelle prise en charge';
    }
  };

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? '100%' : '-100%',
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? '-100%' : '100%',
      opacity: 0,
    }),
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="add-coverage-modal-backdrop"
          id="add-coverage-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-black/40 font-poppins overflow-y-auto"
          onClick={handleClose}
        >
          <motion.div
            id="add-coverage-modal-card"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[94dvh] sm:max-h-[90dvh] bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl shadow-xl overflow-hidden flex flex-col my-auto"
          >
            <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 sm:py-4 [@media(max-height:580px)]:py-2.5 bg-[#FFFFFF] flex-shrink-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-semibold text-[#111827]">
                  {getStepTitle()}
                </h2>
                <span className="text-xs text-[#9CA3AF] font-medium">
                  ({step}/3)
                </span>
              </div>
              <button
                type="button"
                id="close-coverage-modal-button"
                onClick={handleClose}
                aria-label="Fermer"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#374151] hover:bg-[#E5E7EB]/50 transition-colors cursor-pointer"
              >
                <CloseIcon className="w-4 h-4 sm:w-5 sm:h-5 text-current" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 relative">
              <AnimatePresence initial={false} custom={direction} mode="wait">
                {step === 1 && (
                  <motion.div
                    key="coverage-step-1"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.24, ease: [0.25, 1, 0.5, 1] }}
                    className="p-4 sm:p-6 flex flex-col space-y-3.5 sm:space-y-4"
                  >
                    <div className="flex flex-col space-y-1.5">
                      <label
                        htmlFor="field-coverage-cabinet"
                        className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide flex items-center"
                      >
                        Cabinet dentaire
                        <span className="text-[#DC2626] ml-1">*</span>
                      </label>
                      <div className="relative">
                        <select
                          id="field-coverage-cabinet"
                          value={cabinetDentaire}
                          onChange={(e) => setCabinetDentaire(e.target.value)}
                          className={`w-full h-9 sm:h-10 pl-3 sm:pl-3.5 pr-9 sm:pr-10 bg-[#FFFFFF] border rounded-lg text-xs sm:text-sm appearance-none cursor-pointer focus:outline-none transition-colors ${
                            !cabinetDentaire ? 'text-[#9CA3AF]' : 'text-[#374151]'
                          } ${
                            hasAttemptedNextStep1 && !isCabinetValid
                              ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]'
                              : 'border-[#E5E7EB] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]'
                          }`}
                        >
                          <option value="" disabled className="text-[#9CA3AF]">
                            Sélectionner un cabinet dentaire
                          </option>
                          {cabinetOptions.map((cabinetName) => (
                            <option
                              key={cabinetName}
                              value={cabinetName}
                              className="text-[#374151]"
                            >
                              {cabinetName}
                            </option>
                          ))}
                        </select>
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#9CA3AF]">
                          <ChevronDownIcon className="w-4 h-4 text-current" />
                        </span>
                      </div>
                      {hasAttemptedNextStep1 && !isCabinetValid && (
                        <span className="text-[11px] text-[#DC2626]">
                          Le cabinet dentaire est obligatoire.
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col space-y-1.5">
                      <label
                        htmlFor="field-coverage-invoice"
                        className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide flex items-center"
                      >
                        N° Facture
                        <span className="text-[#DC2626] ml-1">*</span>
                      </label>
                      <input
                        id="field-coverage-invoice"
                        type="text"
                        value={numeroFacture}
                        onChange={(e) => {
                          setNumeroFacture(e.target.value);
                          if (submitError) setSubmitError('');
                        }}
                        placeholder="Ex : 000/0000"
                        className={`w-full h-9 sm:h-10 px-3 sm:px-3.5 bg-[#FFFFFF] border rounded-lg text-xs sm:text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none transition-colors ${
                          (hasAttemptedNextStep1 && isNumeroFactureEmpty) ||
                          isNumeroFactureDuplicate ||
                          (submitError && submitError.toLowerCase().includes('facture'))
                            ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]'
                            : 'border-[#E5E7EB] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]'
                        }`}
                      />
                      {hasAttemptedNextStep1 && isNumeroFactureEmpty && (
                        <span className="text-[11px] text-[#DC2626]">
                          Le numéro de facture est obligatoire.
                        </span>
                      )}
                      {isNumeroFactureDuplicate && (
                        <span className="text-[11px] text-[#DC2626]">
                          Ce numéro de facture existe déjà. Chaque numéro de facture doit être unique.
                        </span>
                      )}
                      {!isNumeroFactureDuplicate &&
                        submitError &&
                        submitError.toLowerCase().includes('facture') && (
                          <span className="text-[11px] text-[#DC2626]">
                            {submitError}
                          </span>
                        )}
                    </div>

                    <div className="flex flex-col space-y-2">
                      <span className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide flex items-center">
                        Montant en Ariary
                        <span className="text-[#DC2626] ml-1">*</span>
                      </span>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex flex-col space-y-1">
                          <label
                            htmlFor="field-coverage-amount-proposed"
                            className="text-[11px] font-medium text-[#374151]"
                          >
                            Montant proposé
                          </label>
                          <input
                            id="field-coverage-amount-proposed"
                            type="number"
                            min="0"
                            step="any"
                            value={montantProposeAriary}
                            onChange={(e) => setMontantProposeAriary(e.target.value)}
                            placeholder="Saisir le montant proposé"
                            className={`w-full h-9 sm:h-10 px-3 sm:px-3.5 bg-[#FFFFFF] border rounded-lg text-xs sm:text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none transition-colors ${
                              hasAttemptedNextStep1 && !isMontantProposeValid
                                ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]'
                                : 'border-[#E5E7EB] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]'
                            }`}
                          />
                          {hasAttemptedNextStep1 && !isMontantProposeValid && (
                            <span className="text-[11px] text-[#DC2626]">
                              Le montant proposé est obligatoire.
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col space-y-1">
                          <label
                            htmlFor="field-coverage-amount-given"
                            className="text-[11px] font-medium text-[#374151]"
                          >
                            Montant donné par l'assurance
                          </label>
                          <input
                            id="field-coverage-amount-given"
                            type="number"
                            min="0"
                            step="any"
                            value={montantAssuranceAriary}
                            onChange={(e) => setMontantAssuranceAriary(e.target.value)}
                            placeholder="Saisir le montant accordé"
                            className={`w-full h-9 sm:h-10 px-3 sm:px-3.5 bg-[#FFFFFF] border rounded-lg text-xs sm:text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none transition-colors ${
                              hasAttemptedNextStep1 && !isMontantAssuranceValid
                                ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]'
                                : 'border-[#E5E7EB] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]'
                            }`}
                          />
                          {hasAttemptedNextStep1 && !isMontantAssuranceValid && (
                            <span className="text-[11px] text-[#DC2626]">
                              Le montant donné par l'assurance est obligatoire.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="coverage-step-2"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.24, ease: [0.25, 1, 0.5, 1] }}
                    className="p-4 sm:p-6 flex flex-col space-y-3.5 sm:space-y-4 min-h-[260px]"
                  >
                    <div className="flex flex-col space-y-1.5">
                      <label
                        htmlFor="field-coverage-patient-name"
                        className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide flex items-center"
                      >
                        Nom(s) et prénom(s) du patient
                        <span className="text-[#DC2626] ml-1">*</span>
                      </label>
                      <div ref={patientFieldRef} className="relative">
                        <input
                          id="field-coverage-patient-name"
                          type="text"
                          autoComplete="off"
                          value={patientNomPrenom}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPatientNomPrenom(val);
                            setIsPatientDropdownOpen(val.trim().length > 0);
                            const matched = findExactPatientMatch(val);
                            setAgence(matched ? (matched.assurance || '').trim() : '');
                          }}
                          onFocus={() => {
                            if (patientNomPrenom.trim().length > 0) {
                              setIsPatientDropdownOpen(true);
                            }
                          }}
                          placeholder="Taper le nom ou prénom du patient assuré"
                          className={`w-full h-9 sm:h-10 px-3 sm:px-3.5 bg-[#FFFFFF] border rounded-lg text-xs sm:text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none transition-colors ${
                            hasAttemptedNextStep2 && !isPatientNomPrenomValid
                              ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]'
                              : 'border-[#E5E7EB] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]'
                          }`}
                        />

                        {isPatientDropdownOpen && patientNomPrenom.trim().length > 0 && (
                          <div
                            id="coverage-patient-suggestions"
                            className="absolute left-0 right-0 top-full mt-1 z-30 bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg shadow-lg max-h-44 overflow-y-auto"
                          >
                            {isLoadingPatients ? (
                              <div className="px-3 py-2.5 text-xs text-[#6B7280]">
                                Chargement des patients assurés...
                              </div>
                            ) : filteredInsuredPatients.length === 0 ? (
                              <div className="px-3 py-2.5 text-xs text-[#6B7280]">
                                Aucun patient assuré trouvé
                              </div>
                            ) : (
                              filteredInsuredPatients.map((patient) => (
                                <button
                                  key={patient.id}
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelectPatient(patient);
                                  }}
                                  className="w-full px-3 py-2 text-left hover:bg-[#F8F9FA] transition-colors flex flex-col border-b border-[#E5E7EB] last:border-b-0 cursor-pointer"
                                >
                                  <span className="text-xs sm:text-sm font-medium text-[#111827]">
                                    {`${patient.nom || ''} ${patient.prenom || ''}`.trim()}
                                  </span>
                                  <span className="text-[11px] text-[#6B7280]">
                                    {patient.identifiant ? `${patient.identifiant} - ` : ''}
                                    {patient.assurance}
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                      {hasAttemptedNextStep2 && !isPatientNomPrenomValid && (
                        <span className="text-[11px] text-[#DC2626]">
                          Le nom et prénom du patient sont obligatoires.
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col space-y-1.5">
                      <label
                        htmlFor="field-coverage-company-name"
                        className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide flex items-center"
                      >
                        Nom société
                        <span className="text-[#DC2626] ml-1">*</span>
                      </label>
                      <input
                        id="field-coverage-company-name"
                        type="text"
                        value={nomSociete}
                        onChange={(e) => setNomSociete(e.target.value)}
                        placeholder="Saisir le nom de la société"
                        className={`w-full h-9 sm:h-10 px-3 sm:px-3.5 bg-[#FFFFFF] border rounded-lg text-xs sm:text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none transition-colors ${
                          hasAttemptedNextStep2 && !isNomSocieteValid
                            ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]'
                            : 'border-[#E5E7EB] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]'
                        }`}
                      />
                      {hasAttemptedNextStep2 && !isNomSocieteValid && (
                        <span className="text-[11px] text-[#DC2626]">
                          Le nom de la société est obligatoire.
                        </span>
                      )}
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div
                    key="coverage-step-3"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.24, ease: [0.25, 1, 0.5, 1] }}
                    className="p-4 sm:p-6 flex flex-col space-y-3.5 sm:space-y-4"
                  >
                    <div className="flex flex-col space-y-1.5">
                      <label
                        htmlFor="field-coverage-agency"
                        className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide flex items-center"
                      >
                        Agence
                        <span className="text-[#DC2626] ml-1">*</span>
                      </label>
                      <input
                        id="field-coverage-agency"
                        type="text"
                        value={agence}
                        onChange={(e) => setAgence(e.target.value)}
                        placeholder="Saisir le nom de l'agence"
                        className={`w-full h-9 sm:h-10 px-3 sm:px-3.5 bg-[#FFFFFF] border rounded-lg text-xs sm:text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none transition-colors ${
                          hasAttemptedSubmitStep3 && !isAgenceValid
                            ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]'
                            : 'border-[#E5E7EB] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]'
                        }`}
                      />
                      {hasAttemptedSubmitStep3 && !isAgenceValid && (
                        <span className="text-[11px] text-[#DC2626]">
                          L'agence est obligatoire.
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col space-y-1.5">
                      <label
                        htmlFor="field-coverage-pec-number"
                        className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide flex items-center"
                      >
                        N° de prise en charge
                        <span className="text-[#DC2626] ml-1">*</span>
                      </label>
                      <input
                        id="field-coverage-pec-number"
                        type="text"
                        value={numeroPriseEnCharge}
                        onChange={(e) => setNumeroPriseEnCharge(e.target.value)}
                        placeholder="Saisir le numéro de prise en charge"
                        className={`w-full h-9 sm:h-10 px-3 sm:px-3.5 bg-[#FFFFFF] border rounded-lg text-xs sm:text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none transition-colors ${
                          hasAttemptedSubmitStep3 && !isNumeroPriseEnChargeValid
                            ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]'
                            : 'border-[#E5E7EB] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]'
                        }`}
                      />
                      {hasAttemptedSubmitStep3 && !isNumeroPriseEnChargeValid && (
                        <span className="text-[11px] text-[#DC2626]">
                          Le numéro de prise en charge est obligatoire.
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="field-coverage-attestation-date"
                          className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide"
                        >
                          Date d'attestation
                        </label>
                        <span className="text-[11px] text-[#9CA3AF] font-normal">
                          Facultatif
                        </span>
                      </div>
                      <input
                        id="field-coverage-attestation-date"
                        type="date"
                        value={dateAttestation}
                        onChange={(e) => setDateAttestation(e.target.value)}
                        className="w-full h-9 sm:h-10 px-3 sm:px-3.5 bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg text-xs sm:text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors"
                      />
                    </div>

                    <div className="flex flex-col space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="field-coverage-creators"
                          className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide"
                        >
                          Créateurs de prise en charge
                        </label>
                        <span className="text-[11px] text-[#9CA3AF] font-normal">
                          Facultatif
                        </span>
                      </div>
                      <input
                        id="field-coverage-creators"
                        type="text"
                        value={createursPriseEnCharge}
                        onChange={(e) => setCreateursPriseEnCharge(e.target.value)}
                        placeholder="Saisir le ou les créateurs"
                        className="w-full h-9 sm:h-10 px-3 sm:px-3.5 bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg text-xs sm:text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors"
                      />
                    </div>

                    <div className="flex flex-col space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="field-coverage-send-date"
                          className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide"
                        >
                          Date d'envoi
                        </label>
                        <span className="text-[11px] text-[#9CA3AF] font-normal">
                          Facultatif
                        </span>
                      </div>
                      <input
                        id="field-coverage-send-date"
                        type="date"
                        value={dateEnvoi}
                        onChange={(e) => setDateEnvoi(e.target.value)}
                        className="w-full h-9 sm:h-10 px-3 sm:px-3.5 bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg text-xs sm:text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors"
                      />
                    </div>
                    {submitError && !submitError.toLowerCase().includes('facture') && (
                      <span className="text-[11px] text-[#DC2626]">
                        {submitError}
                      </span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="px-4 py-2.5 sm:px-6 sm:py-4 [@media(max-height:580px)]:py-2.5 flex flex-row items-center sm:justify-end gap-2 sm:gap-3 bg-[#FFFFFF] flex-shrink-0">
              {step === 1 && (
                <>
                  <button
                    type="button"
                    id="cancel-coverage-modal-button"
                    onClick={handleClose}
                    className="h-9 sm:h-10 px-4 flex-1 sm:flex-none sm:w-auto bg-[#FFFFFF] border border-[#D1D5DB] hover:bg-[#F3F4F6] text-[#374151] rounded-lg text-xs sm:text-sm font-medium transition-colors text-center cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    id="next-coverage-step-1-button"
                    onClick={handleNextStep1}
                    className="h-9 sm:h-10 px-5 flex-1 sm:flex-none sm:w-auto bg-[#2563EB] hover:bg-[#1D4ED8] text-[#FFFFFF] rounded-lg text-xs sm:text-sm font-medium transition-colors text-center cursor-pointer"
                  >
                    Suivant
                  </button>
                </>
              )}

              {step === 2 && (
                <>
                  <button
                    type="button"
                    id="prev-coverage-step-2-button"
                    onClick={handlePrevStep}
                    className="h-9 sm:h-10 px-4 flex-1 sm:flex-none sm:w-auto bg-[#FFFFFF] border border-[#D1D5DB] hover:bg-[#F3F4F6] text-[#374151] rounded-lg text-xs sm:text-sm font-medium transition-colors text-center cursor-pointer"
                  >
                    Précédent
                  </button>
                  <button
                    type="button"
                    id="next-coverage-step-2-button"
                    onClick={handleNextStep2}
                    className="h-9 sm:h-10 px-5 flex-1 sm:flex-none sm:w-auto bg-[#2563EB] hover:bg-[#1D4ED8] text-[#FFFFFF] rounded-lg text-xs sm:text-sm font-medium transition-colors text-center cursor-pointer"
                  >
                    Suivant
                  </button>
                </>
              )}

              {step === 3 && (
                <>
                  <button
                    type="button"
                    id="prev-coverage-step-3-button"
                    onClick={handlePrevStep}
                    disabled={isSubmitting}
                    className="h-9 sm:h-10 px-4 flex-1 sm:flex-none sm:w-auto bg-[#FFFFFF] border border-[#D1D5DB] hover:bg-[#F3F4F6] disabled:opacity-60 text-[#374151] rounded-lg text-xs sm:text-sm font-medium transition-colors text-center cursor-pointer"
                  >
                    Précédent
                  </button>
                  <button
                    type="button"
                    id="save-coverage-modal-button"
                    onClick={handleFinalSubmit}
                    disabled={isSubmitting}
                    className="h-9 sm:h-10 px-5 flex-1 sm:flex-none sm:w-auto bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-[#FFFFFF] rounded-lg text-xs sm:text-sm font-medium transition-colors text-center cursor-pointer"
                  >
                    {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
