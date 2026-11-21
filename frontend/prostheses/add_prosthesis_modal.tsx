import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CloseIcon, ChevronDownIcon } from '../navigation/navigation_icons';
import { getPatientsApi } from '../services/patients_api';
import { PatientRecord } from '../fiches/record_id_utils';
import { useCabinets } from '../services/cabinets_api';

export interface ProsthesisFormData {
  cabinetDentaire: string;
  patientNomPrenom: string;
  patientContact: string;
  numeroDentaire: string;
  typeProthese: string;
  teinteProthese: string;
  nomLaboratoire: string;
  nomCreateurProthese: string;
  dateEnvoi: string;
  dateLivraison: string;
  montant: string;
}

interface AddProsthesisModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProsthesis?: ProsthesisFormData | null;
  onSubmit?: (data: ProsthesisFormData) => Promise<void> | void;
}

const normalizeSearchText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const normalizeMontant = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/ar$/i.test(trimmed)) {
    const withoutAr = trimmed.replace(/ar$/i, '').trim();
    return withoutAr ? `${withoutAr} Ar` : 'Ar';
  }
  return `${trimmed} Ar`;
};

const PROSTHESIS_TYPE_OPTIONS = [
  'Amovible en flexite',
  'Amovible en métalique',
  'Amovible en résine',
  'Correction empreinte',
  'Courone en résine',
  'Courone en séramique',
  'Courone en zircone',
];

// BOITE MODALE MULTI-ETAPES AJOUT DE PROTHESE DENTAIRE
export const AddProsthesisModal: React.FC<AddProsthesisModalProps> = ({
  isOpen,
  onClose,
  initialProsthesis = null,
  onSubmit,
}) => {
  const [step, setStep] = useState<number>(1);
  const [direction, setDirection] = useState<number>(1);

  // Etape 1 : Patient & cabinet
  const [cabinetDentaire, setCabinetDentaire] = useState('');
  const [patientNomPrenom, setPatientNomPrenom] = useState('');
  const [patientContact, setPatientContact] = useState('');
  const [hasAttemptedNextStep1, setHasAttemptedNextStep1] = useState(false);

  const [patientsList, setPatientsList] = useState<PatientRecord[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);
  const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState(false);
  const patientFieldRef = useRef<HTMLDivElement>(null);
  const isContactAutoFilledRef = useRef(false);

  // Etape 2 : Prothese & laboratoire
  const [numeroDentaire, setNumeroDentaire] = useState('');
  const [typeProthese, setTypeProthese] = useState('');
  const [teinteProthese, setTeinteProthese] = useState('');
  const [nomLaboratoire, setNomLaboratoire] = useState('');
  const [nomCreateurProthese, setNomCreateurProthese] = useState('');
  const [hasAttemptedNextStep2, setHasAttemptedNextStep2] = useState(false);

  // Etape 3 : Suivi des dates
  const [dateEnvoi, setDateEnvoi] = useState(() => new Date().toISOString().split('T')[0]);
  const [dateLivraison, setDateLivraison] = useState('');
  const [hasAttemptedNextStep3, setHasAttemptedNextStep3] = useState(false);

  // Etape 4 : Financier
  const [montant, setMontant] = useState('');
  const [hasAttemptedSubmitStep4, setHasAttemptedSubmitStep4] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { cabinets: availableCabinets, refreshCabinets } = useCabinets();
  const cabinetOptions = useMemo(() => {
    const names = availableCabinets.map((c) => c.name);
    const current = cabinetDentaire.trim();
    if (current && !names.some((n) => n.toLowerCase() === current.toLowerCase())) {
      return [...names, current];
    }
    return names;
  }, [availableCabinets, cabinetDentaire]);

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setDirection(1);
    setHasAttemptedNextStep1(false);
    setHasAttemptedNextStep2(false);
    setHasAttemptedNextStep3(false);
    setHasAttemptedSubmitStep4(false);
    setIsSubmitting(false);
    refreshCabinets().catch(() => {
      // Utilisation du cache local
    });

    if (initialProsthesis) {
      setCabinetDentaire(initialProsthesis.cabinetDentaire || '');
      setPatientNomPrenom(initialProsthesis.patientNomPrenom || '');
      setPatientContact(initialProsthesis.patientContact || '');
      setNumeroDentaire(initialProsthesis.numeroDentaire || '');
      setTypeProthese(initialProsthesis.typeProthese || '');
      setTeinteProthese(initialProsthesis.teinteProthese || '');
      setNomLaboratoire(initialProsthesis.nomLaboratoire || '');
      setNomCreateurProthese(initialProsthesis.nomCreateurProthese || '');
      setDateEnvoi(initialProsthesis.dateEnvoi || new Date().toISOString().split('T')[0]);
      setDateLivraison(initialProsthesis.dateLivraison || '');
      setMontant(initialProsthesis.montant || '');
    } else {
      setCabinetDentaire('');
      setPatientNomPrenom('');
      setPatientContact('');
      setNumeroDentaire('');
      setTypeProthese('');
      setTeinteProthese('');
      setNomLaboratoire('');
      setNomCreateurProthese('');
      setDateEnvoi(new Date().toISOString().split('T')[0]);
      setDateLivraison('');
      setMontant('');
    }
    isContactAutoFilledRef.current = false;
    setIsPatientDropdownOpen(false);

    let isCancelled = false;
    setIsLoadingPatients(true);
    getPatientsApi(false)
      .then((patients) => {
        if (!isCancelled) {
          setPatientsList(patients);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setPatientsList([]);
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
  }, [isOpen, initialProsthesis]);

  const handleClose = () => {
    if (isSubmitting) return;
    setStep(1);
    setDirection(1);
    setHasAttemptedNextStep1(false);
    setHasAttemptedNextStep2(false);
    setHasAttemptedNextStep3(false);
    setHasAttemptedSubmitStep4(false);
    isContactAutoFilledRef.current = false;
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

  const filteredPatients = useMemo(() => {
    const query = normalizeSearchText(patientNomPrenom);
    if (!query) return [];

    return patientsList.filter((p) => {
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
  }, [patientsList, patientNomPrenom]);

  const findExactPatientMatch = (name: string): PatientRecord | undefined => {
    const normalized = normalizeSearchText(name);
    if (!normalized) return undefined;

    const matches = patientsList.filter((p) => {
      const nom = normalizeSearchText(p.nom || '');
      const prenom = normalizeSearchText(p.prenom || '');
      return (
        `${nom} ${prenom}`.trim() === normalized ||
        `${prenom} ${nom}`.trim() === normalized
      );
    });

    if (matches.length === 0) return undefined;
    if (cabinetDentaire) {
      const sameCabinetMatch = matches.find((p) => p.cabinet === cabinetDentaire);
      if (sameCabinetMatch) return sameCabinetMatch;
    }
    return matches[0];
  };

  const handleSelectPatient = (patient: PatientRecord) => {
    const fullName = `${(patient.nom || '').toUpperCase()} ${patient.prenom || ''}`.trim();
    setPatientNomPrenom(fullName);
    const linkedContact = (patient.telephone || patient.email || '').trim();
    setPatientContact(linkedContact);
    isContactAutoFilledRef.current = true;
    if (!cabinetDentaire && patient.cabinet) {
      setCabinetDentaire(patient.cabinet);
    }
    setIsPatientDropdownOpen(false);
  };

  const isCabinetValid = cabinetDentaire.trim().length > 0;
  const isPatientValid = patientNomPrenom.trim().length > 0;
  const isStep1Valid = isCabinetValid && isPatientValid;

  const isTypeProtheseValid = typeProthese.trim().length > 0;
  const isNumeroDentaireValid = numeroDentaire.trim().length > 0;
  const isNomLaboratoireValid = nomLaboratoire.trim().length > 0;
  const isStep2Valid =
    isTypeProtheseValid && isNumeroDentaireValid && isNomLaboratoireValid;

  const isDateEnvoiValid = dateEnvoi.trim().length > 0;
  const isDateLivraisonValid =
    !dateLivraison.trim() || !dateEnvoi.trim() || dateLivraison >= dateEnvoi;
  const isStep3Valid = isDateEnvoiValid && isDateLivraisonValid;

  const isMontantValid = montant.trim().length > 0;

  const handleNextStep1 = () => {
    setHasAttemptedNextStep1(true);
    if (!isStep1Valid) return;
    setDirection(1);
    setStep(2);
  };

  const handleNextStep2 = () => {
    setHasAttemptedNextStep2(true);
    if (!isStep2Valid) return;
    setDirection(1);
    setStep(3);
  };

  const handleNextStep3 = () => {
    setHasAttemptedNextStep3(true);
    if (!isStep3Valid) return;
    setDirection(1);
    setStep(4);
  };

  const handlePrevStep = () => {
    setDirection(-1);
    setStep((prev) => Math.max(1, prev - 1));
  };

  const handleFinalSubmit = async () => {
    setHasAttemptedSubmitStep4(true);
    if (!isStep1Valid || !isStep2Valid || !isStep3Valid || !isMontantValid || isSubmitting) {
      return;
    }

    const formattedMontant = normalizeMontant(montant);

    setIsSubmitting(true);
    try {
      await onSubmit?.({
        cabinetDentaire: cabinetDentaire.trim(),
        patientNomPrenom: patientNomPrenom.trim(),
        patientContact: patientContact.trim(),
        numeroDentaire: numeroDentaire.trim(),
        typeProthese: typeProthese.trim(),
        teinteProthese: teinteProthese.trim(),
        nomLaboratoire: nomLaboratoire.trim(),
        nomCreateurProthese: nomCreateurProthese.trim(),
        dateEnvoi: dateEnvoi.trim(),
        dateLivraison: dateLivraison.trim(),
        montant: formattedMontant || montant.trim(),
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 1:
        return 'Patient & cabinet';
      case 2:
        return 'Prothèse & laboratoire';
      case 3:
        return 'Suivi des dates';
      case 4:
        return 'Financier';
      default:
        return '';
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
          key="add-prosthesis-modal-backdrop"
          id="add-prosthesis-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-black/40 font-poppins overflow-y-auto"
          onClick={handleClose}
        >
          <motion.div
            id="add-prosthesis-modal-card"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[94dvh] sm:max-h-[90dvh] bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl shadow-xl overflow-hidden flex flex-col my-auto"
          >
            <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 sm:py-4 [@media(max-height:580px)]:py-2.5 bg-[#FFFFFF] flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-base sm:text-lg font-semibold text-[#111827] truncate">
                  {getStepTitle()}
                </h2>
                <span className="text-xs text-[#9CA3AF] font-medium flex-shrink-0">
                  ({step}/4)
                </span>
              </div>
              <button
                type="button"
                id="close-prosthesis-modal-button"
                onClick={handleClose}
                aria-label="Fermer"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#374151] hover:bg-[#E5E7EB]/50 transition-colors cursor-pointer flex-shrink-0"
              >
                <CloseIcon className="w-4 h-4 sm:w-5 sm:h-5 text-current" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 relative">
              <AnimatePresence initial={false} custom={direction} mode="wait">
                {step === 1 && (
                  <motion.div
                    key="prosthesis-step-1"
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
                        htmlFor="field-prosthesis-cabinet"
                        className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide flex items-center"
                      >
                        Cabinet dentaire
                        <span className="text-[#DC2626] ml-1">*</span>
                      </label>
                      <div className="relative">
                        <select
                          id="field-prosthesis-cabinet"
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
                          {cabinetOptions.map((cabinet) => (
                            <option
                              key={cabinet}
                              value={cabinet}
                              className="text-[#374151]"
                            >
                              {cabinet}
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
                        htmlFor="field-prosthesis-patient"
                        className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide flex items-center"
                      >
                        Nom et prénom du patient
                        <span className="text-[#DC2626] ml-1">*</span>
                      </label>
                      <div ref={patientFieldRef} className="relative">
                        <input
                          id="field-prosthesis-patient"
                          type="text"
                          autoComplete="off"
                          value={patientNomPrenom}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPatientNomPrenom(val);
                            setIsPatientDropdownOpen(val.trim().length > 0);
                            const matched = findExactPatientMatch(val);
                            if (matched) {
                              const linkedContact = (matched.telephone || matched.email || '').trim();
                              setPatientContact(linkedContact);
                              isContactAutoFilledRef.current = true;
                              if (!cabinetDentaire && matched.cabinet) {
                                setCabinetDentaire(matched.cabinet);
                              }
                            } else if (isContactAutoFilledRef.current) {
                              setPatientContact('');
                              isContactAutoFilledRef.current = false;
                            }
                          }}
                          onFocus={() => {
                            if (patientNomPrenom.trim().length > 0) {
                              setIsPatientDropdownOpen(true);
                            }
                          }}
                          placeholder="Saisir le nom et prénom du patient"
                          className={`w-full h-9 sm:h-10 px-3 sm:px-3.5 bg-[#FFFFFF] border rounded-lg text-xs sm:text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none transition-colors ${
                            hasAttemptedNextStep1 && !isPatientValid
                              ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]'
                              : 'border-[#E5E7EB] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]'
                          }`}
                        />

                        {isPatientDropdownOpen && patientNomPrenom.trim().length > 0 && (
                          <div
                            id="prosthesis-patient-suggestions"
                            className="absolute left-0 right-0 top-full mt-1 z-30 bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg shadow-lg max-h-40 overflow-y-auto"
                          >
                            {isLoadingPatients ? (
                              <div className="px-3 py-2 text-xs text-[#6B7280]">
                                Chargement des patients...
                              </div>
                            ) : filteredPatients.length === 0 ? (
                              <div className="px-3 py-2 text-xs text-[#6B7280]">
                                Aucun patient trouvé
                              </div>
                            ) : (
                              filteredPatients.map((patient) => (
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
                                    {`${(patient.nom || '').toUpperCase()} ${patient.prenom || ''}`.trim()}
                                  </span>
                                  {(patient.telephone || patient.cabinet) && (
                                    <span className="text-[11px] text-[#6B7280]">
                                      {[patient.cabinet, patient.telephone].filter(Boolean).join(' - ')}
                                    </span>
                                  )}
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                      {hasAttemptedNextStep1 && !isPatientValid && (
                        <span className="text-[11px] text-[#DC2626]">
                          Le nom et prénom du patient sont obligatoires.
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="field-prosthesis-contact"
                          className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide"
                        >
                          Contact du patient
                        </label>
                        <span className="text-[11px] text-[#9CA3AF] font-normal">
                          Facultatif
                        </span>
                      </div>
                      <input
                        id="field-prosthesis-contact"
                        type="tel"
                        value={patientContact}
                        onChange={(e) => {
                          isContactAutoFilledRef.current = false;
                          setPatientContact(e.target.value);
                        }}
                        placeholder="Ex : 034 00 000 00"
                        className="w-full h-9 sm:h-10 px-3 sm:px-3.5 bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg text-xs sm:text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors"
                      />
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="prosthesis-step-2"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.24, ease: [0.25, 1, 0.5, 1] }}
                    className="p-4 sm:p-6 flex flex-col space-y-3.5 sm:space-y-4"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                      <div className="flex flex-col space-y-1.5">
                        <label
                          htmlFor="field-prosthesis-type"
                          className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide flex items-center"
                        >
                          Type de prothèse
                          <span className="text-[#DC2626] ml-1">*</span>
                        </label>
                        <div className="relative">
                          <select
                            id="field-prosthesis-type"
                            value={typeProthese}
                            onChange={(e) => setTypeProthese(e.target.value)}
                            className={`w-full h-9 sm:h-10 pl-3 sm:pl-3.5 pr-9 sm:pr-10 bg-[#FFFFFF] border rounded-lg text-xs sm:text-sm appearance-none cursor-pointer focus:outline-none transition-colors ${
                              !typeProthese ? 'text-[#9CA3AF]' : 'text-[#374151]'
                            } ${
                              hasAttemptedNextStep2 && !isTypeProtheseValid
                                ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]'
                                : 'border-[#E5E7EB] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]'
                            }`}
                          >
                            <option value="" disabled className="text-[#9CA3AF]">
                              Sélectionner un type
                            </option>
                            {PROSTHESIS_TYPE_OPTIONS.map((typeOption) => (
                              <option
                                key={typeOption}
                                value={typeOption}
                                className="text-[#374151]"
                              >
                                {typeOption}
                              </option>
                            ))}
                          </select>
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#9CA3AF]">
                            <ChevronDownIcon className="w-4 h-4 text-current" />
                          </span>
                        </div>
                        {hasAttemptedNextStep2 && !isTypeProtheseValid && (
                          <span className="text-[11px] text-[#DC2626]">
                            Le type de prothèse est obligatoire.
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <label
                            htmlFor="field-prosthesis-shade"
                            className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide"
                          >
                            Teinte de prothèse
                          </label>
                          <span className="text-[11px] text-[#9CA3AF] font-normal flex-shrink-0">
                            Facultatif
                          </span>
                        </div>
                        <input
                          id="field-prosthesis-shade"
                          type="text"
                          value={teinteProthese}
                          onChange={(e) => setTeinteProthese(e.target.value)}
                          placeholder="Ex : A2, A3, B1..."
                          className="w-full h-9 sm:h-10 px-3 sm:px-3.5 bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg text-xs sm:text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                      <div className="flex flex-col space-y-1.5">
                        <label
                          htmlFor="field-prosthesis-tooth-number"
                          className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide flex items-center"
                        >
                          Numéro dentaire
                          <span className="text-[#DC2626] ml-1">*</span>
                        </label>
                        <input
                          id="field-prosthesis-tooth-number"
                          type="text"
                          value={numeroDentaire}
                          onChange={(e) => setNumeroDentaire(e.target.value)}
                          placeholder="Ex : 11, 21, 36..."
                          className={`w-full h-9 sm:h-10 px-3 sm:px-3.5 bg-[#FFFFFF] border rounded-lg text-xs sm:text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none transition-colors ${
                            hasAttemptedNextStep2 && !isNumeroDentaireValid
                              ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]'
                              : 'border-[#E5E7EB] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]'
                          }`}
                        />
                        {hasAttemptedNextStep2 && !isNumeroDentaireValid && (
                          <span className="text-[11px] text-[#DC2626]">
                            Le numéro dentaire est obligatoire.
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col space-y-1.5">
                        <label
                          htmlFor="field-prosthesis-lab-name"
                          className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide flex items-center"
                        >
                          Nom du laboratoire
                          <span className="text-[#DC2626] ml-1">*</span>
                        </label>
                        <input
                          id="field-prosthesis-lab-name"
                          type="text"
                          value={nomLaboratoire}
                          onChange={(e) => setNomLaboratoire(e.target.value)}
                          placeholder="Saisir le nom du laboratoire"
                          className={`w-full h-9 sm:h-10 px-3 sm:px-3.5 bg-[#FFFFFF] border rounded-lg text-xs sm:text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none transition-colors ${
                            hasAttemptedNextStep2 && !isNomLaboratoireValid
                              ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]'
                              : 'border-[#E5E7EB] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]'
                          }`}
                        />
                        {hasAttemptedNextStep2 && !isNomLaboratoireValid && (
                          <span className="text-[11px] text-[#DC2626]">
                            Le nom du laboratoire est obligatoire.
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="field-prosthesis-creator-name"
                          className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide"
                        >
                          Nom du créateur de prothèse
                        </label>
                        <span className="text-[11px] text-[#9CA3AF] font-normal">
                          Facultatif
                        </span>
                      </div>
                      <input
                        id="field-prosthesis-creator-name"
                        type="text"
                        value={nomCreateurProthese}
                        onChange={(e) => setNomCreateurProthese(e.target.value)}
                        placeholder="Saisir le nom du créateur"
                        className="w-full h-9 sm:h-10 px-3 sm:px-3.5 bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg text-xs sm:text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors"
                      />
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div
                    key="prosthesis-step-3"
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
                        htmlFor="field-prosthesis-sent-date"
                        className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide flex items-center"
                      >
                        Date d’envoi
                        <span className="text-[#DC2626] ml-1">*</span>
                      </label>
                      <input
                        id="field-prosthesis-sent-date"
                        type="date"
                        value={dateEnvoi}
                        onChange={(e) => {
                          const nextSentDate = e.target.value;
                          setDateEnvoi(nextSentDate);
                          if (dateLivraison && nextSentDate && dateLivraison < nextSentDate) {
                            setDateLivraison(nextSentDate);
                          }
                        }}
                        className={`w-full h-9 sm:h-10 px-3 sm:px-3.5 bg-[#FFFFFF] border rounded-lg text-xs sm:text-sm text-[#374151] focus:outline-none transition-colors ${
                          hasAttemptedNextStep3 && !isDateEnvoiValid
                            ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]'
                            : 'border-[#E5E7EB] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]'
                        }`}
                      />
                      {hasAttemptedNextStep3 && !isDateEnvoiValid && (
                        <span className="text-[11px] text-[#DC2626]">
                          La date d’envoi est obligatoire.
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="field-prosthesis-delivery-date"
                          className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide"
                        >
                          Date de livraison
                        </label>
                        <span className="text-[11px] text-[#9CA3AF] font-normal">
                          Facultatif
                        </span>
                      </div>
                      <input
                        id="field-prosthesis-delivery-date"
                        type="date"
                        min={dateEnvoi || undefined}
                        value={dateLivraison}
                        onChange={(e) => setDateLivraison(e.target.value)}
                        className={`w-full h-9 sm:h-10 px-3 sm:px-3.5 bg-[#FFFFFF] border rounded-lg text-xs sm:text-sm text-[#374151] focus:outline-none transition-colors ${
                          !isDateLivraisonValid
                            ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]'
                            : 'border-[#E5E7EB] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]'
                        }`}
                      />
                      {!isDateLivraisonValid && (
                        <span className="text-[11px] text-[#DC2626]">
                          La date de livraison doit être le même jour ou postérieure à la date d’envoi.
                        </span>
                      )}
                    </div>
                  </motion.div>
                )}

                {step === 4 && (
                  <motion.div
                    key="prosthesis-step-4"
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
                        htmlFor="field-prosthesis-amount"
                        className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide flex items-center"
                      >
                        Montant
                        <span className="text-[#DC2626] ml-1">*</span>
                      </label>
                      <input
                        id="field-prosthesis-amount"
                        type="text"
                        value={montant}
                        onChange={(e) => setMontant(e.target.value)}
                        onBlur={() => {
                          if (montant.trim()) {
                            setMontant(normalizeMontant(montant));
                          }
                        }}
                        placeholder="Ex : 150 000 Ar"
                        className={`w-full h-9 sm:h-10 px-3 sm:px-3.5 bg-[#FFFFFF] border rounded-lg text-xs sm:text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none transition-colors ${
                          hasAttemptedSubmitStep4 && !isMontantValid
                            ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]'
                            : 'border-[#E5E7EB] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]'
                        }`}
                      />
                      {hasAttemptedSubmitStep4 && !isMontantValid && (
                        <span className="text-[11px] text-[#DC2626]">
                          Le montant est obligatoire.
                        </span>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="px-4 py-2.5 sm:px-6 sm:py-4 [@media(max-height:580px)]:py-2.5 flex flex-row items-center sm:justify-end gap-2 sm:gap-3 bg-[#FFFFFF] flex-shrink-0">
              {step === 1 && (
                <>
                  <button
                    type="button"
                    id="cancel-prosthesis-modal-button"
                    onClick={handleClose}
                    className="h-9 sm:h-10 px-4 flex-1 sm:flex-none sm:w-auto bg-[#FFFFFF] border border-[#D1D5DB] hover:bg-[#F3F4F6] text-[#374151] rounded-lg text-xs sm:text-sm font-medium transition-colors text-center cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    id="next-prosthesis-step-1-button"
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
                    id="prev-prosthesis-step-2-button"
                    onClick={handlePrevStep}
                    className="h-9 sm:h-10 px-4 flex-1 sm:flex-none sm:w-auto bg-[#FFFFFF] border border-[#D1D5DB] hover:bg-[#F3F4F6] text-[#374151] rounded-lg text-xs sm:text-sm font-medium transition-colors text-center cursor-pointer"
                  >
                    Précédent
                  </button>
                  <button
                    type="button"
                    id="next-prosthesis-step-2-button"
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
                    id="prev-prosthesis-step-3-button"
                    onClick={handlePrevStep}
                    className="h-9 sm:h-10 px-4 flex-1 sm:flex-none sm:w-auto bg-[#FFFFFF] border border-[#D1D5DB] hover:bg-[#F3F4F6] text-[#374151] rounded-lg text-xs sm:text-sm font-medium transition-colors text-center cursor-pointer"
                  >
                    Précédent
                  </button>
                  <button
                    type="button"
                    id="next-prosthesis-step-3-button"
                    onClick={handleNextStep3}
                    className="h-9 sm:h-10 px-5 flex-1 sm:flex-none sm:w-auto bg-[#2563EB] hover:bg-[#1D4ED8] text-[#FFFFFF] rounded-lg text-xs sm:text-sm font-medium transition-colors text-center cursor-pointer"
                  >
                    Suivant
                  </button>
                </>
              )}

              {step === 4 && (
                <>
                  <button
                    type="button"
                    id="prev-prosthesis-step-4-button"
                    onClick={handlePrevStep}
                    disabled={isSubmitting}
                    className="h-9 sm:h-10 px-4 flex-1 sm:flex-none sm:w-auto bg-[#FFFFFF] border border-[#D1D5DB] hover:bg-[#F3F4F6] disabled:opacity-60 text-[#374151] rounded-lg text-xs sm:text-sm font-medium transition-colors text-center cursor-pointer"
                  >
                    Précédent
                  </button>
                  <button
                    type="button"
                    id="save-prosthesis-modal-button"
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
