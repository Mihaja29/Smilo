import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CloseIcon, ChevronDownIcon } from '../navigation/navigation_icons';
import { TagInputField } from './tag_input_field';
import { generateRecordId, PatientRecord } from './record_id_utils';
import { CUSTOM_ASSURANCE_VALUE } from '../assurances/coverage_options';
import {
  CoverageAssuranceOption,
  getCachedAssurances,
  getAssurancesApi,
} from '../services/assurances_api';
import { useCabinets } from '../services/cabinets_api';

interface AddRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingRecordIds?: string[];
  initialRecord?: PatientRecord | null;
  onSubmit?: (data: Omit<PatientRecord, 'id' | 'createdAt'>) => void;
}

// Boite de formulaire modale multi-etapes responsive
export const AddRecordModal: React.FC<AddRecordModalProps> = ({
  isOpen,
  onClose,
  existingRecordIds = [],
  initialRecord = null,
  onSubmit,
}) => {
  const [step, setStep] = useState<number>(1);
  const [direction, setDirection] = useState<number>(1);


  // Champs Etape 1 : Identite (tous obligatoires)
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [sexe, setSexe] = useState('');
  const [dateNaissance, setDateNaissance] = useState('');
  const [hasAttemptedNextStep1, setHasAttemptedNextStep1] = useState(false);

  // Champs Etape 2 : Coordonnees (Adresse et Telephone obligatoires)
  const [adresse, setAdresse] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [hasAttemptedNextStep2, setHasAttemptedNextStep2] = useState(false);

  // Champs Etape 3 : Informations administratives (Cabinet obligatoire, Profession et Assurance facultatifs)
  const [cabinet, setCabinet] = useState('');
  const [profession, setProfession] = useState('');
  const [assurance, setAssurance] = useState('');
  const [customAssurance, setCustomAssurance] = useState('');
  const [availableAssurances, setAvailableAssurances] = useState<CoverageAssuranceOption[]>(() =>
    getCachedAssurances()
  );
  const [hasAttemptedNextStep3, setHasAttemptedNextStep3] = useState(false);
  const { cabinets: availableCabinets, refreshCabinets } = useCabinets();
  const cabinetOptions = useMemo(() => {
    const names = availableCabinets.map((c) => c.name);
    const current = cabinet.trim();
    if (current && !names.some((n) => n.toLowerCase() === current.toLowerCase())) {
      return [...names, current];
    }
    return names;
  }, [availableCabinets, cabinet]);

  const generatedIdentifiant = useMemo(() => {
    if (initialRecord?.identifiant) return initialRecord.identifiant;
    if (!cabinet) return '';
    return generateRecordId(cabinet, existingRecordIds, availableCabinets);
  }, [cabinet, existingRecordIds, initialRecord, availableCabinets]);

  // Champs Etape 4 : Informations medicales (en etiquettes, tout facultatif)
  const [allergies, setAllergies] = useState<string[]>([]);
  const [antecedents, setAntecedents] = useState<string[]>([]);
  const [traitements, setTraitements] = useState<string[]>([]);
  const [grossesseAllaitement, setGrossesseAllaitement] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setDirection(1);
    setHasAttemptedNextStep1(false);
    setHasAttemptedNextStep2(false);
    setHasAttemptedNextStep3(false);
    refreshCabinets().catch(() => {
      // Utilisation du cache local
    });
    let activeList = getCachedAssurances();
    setAvailableAssurances(activeList);

    const applyInitialAssurance = (list: CoverageAssuranceOption[]) => {
      if (!initialRecord) return;
      const initialAssurance = (initialRecord.assurance || '').trim();
      if (!initialAssurance) {
        setAssurance('');
        setCustomAssurance('');
      } else {
        const matched = list.find(
          (item) =>
            item.label.toLowerCase() === initialAssurance.toLowerCase() ||
            item.displayLabel.toLowerCase() === initialAssurance.toLowerCase()
        );
        if (matched) {
          setAssurance(matched.label);
          setCustomAssurance('');
        } else {
          setAssurance(CUSTOM_ASSURANCE_VALUE);
          setCustomAssurance(initialAssurance);
        }
      }
    };

    getAssurancesApi()
      .then((apiList) => {
        activeList = apiList;
        setAvailableAssurances(apiList);
        applyInitialAssurance(apiList);
      })
      .catch(() => {
        // Utilisation du cache local
      });

    if (initialRecord) {
      setNom(initialRecord.nom || '');
      setPrenom(initialRecord.prenom || '');
      setSexe(initialRecord.sexe || '');
      setDateNaissance(initialRecord.dateNaissance || '');
      setAdresse(initialRecord.adresse || '');
      setTelephone(initialRecord.telephone || '');
      setEmail(initialRecord.email || '');
      setCabinet(initialRecord.cabinet || '');
      setProfession(initialRecord.profession || '');
      applyInitialAssurance(activeList);
      setAllergies(Array.isArray(initialRecord.allergies) ? initialRecord.allergies : []);
      setAntecedents(Array.isArray(initialRecord.antecedents) ? initialRecord.antecedents : []);
      setTraitements(Array.isArray(initialRecord.traitements) ? initialRecord.traitements : []);
      setGrossesseAllaitement(
        Array.isArray(initialRecord.grossesseAllaitement) ? initialRecord.grossesseAllaitement : []
      );
    } else {
      setNom('');
      setPrenom('');
      setSexe('');
      setDateNaissance('');
      setAdresse('');
      setTelephone('');
      setEmail('');
      setCabinet('');
      setProfession('');
      setAssurance('');
      setCustomAssurance('');
      setAllergies([]);
      setAntecedents([]);
      setTraitements([]);
      setGrossesseAllaitement([]);
    }
  }, [isOpen, initialRecord]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleClose = () => {
    setStep(1);
    setDirection(1);
    setHasAttemptedNextStep1(false);
    setHasAttemptedNextStep2(false);
    setHasAttemptedNextStep3(false);
    onClose();
  };

  // Validation Etape 1
  const isNomValid = nom.trim().length > 0;
  const isPrenomValid = prenom.trim().length > 0;
  const isSexeValid = sexe.length > 0;
  const isDateNaissanceValid = dateNaissance.trim().length > 0;
  const isStep1Valid =
    isNomValid && isPrenomValid && isSexeValid && isDateNaissanceValid;

  // Validation Etape 2
  const isAdresseValid = adresse.trim().length > 0;
  const isTelephoneValid = telephone.trim().length > 0;
  const isStep2Valid = isAdresseValid && isTelephoneValid;

  // Validation Etape 3
  const isCabinetValid = cabinet.trim().length > 0;
  const isStep3Valid = isCabinetValid;

  const handleNextStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setHasAttemptedNextStep1(true);

    if (!isStep1Valid) {
      return;
    }

    setDirection(1);
    setStep(2);
  };

  const handleNextStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    setHasAttemptedNextStep2(true);

    if (!isStep2Valid) {
      return;
    }

    setDirection(1);
    setStep(3);
  };

  const handleNextStep3 = (e: React.FormEvent) => {
    e.preventDefault();
    setHasAttemptedNextStep3(true);

    if (!isStep3Valid) {
      return;
    }

    setDirection(1);
    setStep(4);
  };

  const handlePrevStep = () => {
    setDirection(-1);
    setStep((prev) => Math.max(1, prev - 1));
  };

  const handleFinalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedAssurance =
      assurance === CUSTOM_ASSURANCE_VALUE ? customAssurance.trim() : assurance.trim();
    if (onSubmit) {
      onSubmit({
        identifiant: generatedIdentifiant,
        nom: nom.trim(),
        prenom: prenom.trim(),
        sexe,
        dateNaissance,
        adresse: adresse.trim(),
        telephone: telephone.trim(),
        email: email.trim(),
        cabinet: cabinet.trim(),
        profession: profession.trim(),
        assurance: resolvedAssurance,
        allergies,
        antecedents,
        traitements,
        grossesseAllaitement: sexe === 'Féminin' ? grossesseAllaitement : [],
      });
    }
    setNom('');
    setPrenom('');
    setSexe('');
    setDateNaissance('');
    setAdresse('');
    setTelephone('');
    setEmail('');
    setCabinet('');
    setProfession('');
    setAssurance('');
    setCustomAssurance('');
    setAllergies([]);
    setAntecedents([]);
    setTraitements([]);
    setGrossesseAllaitement([]);
    handleClose();
  };

  const getStepTitle = () => {
    switch (step) {
      case 1:
        return 'Identité';
      case 2:
        return 'Coordonnées';
      case 3:
        return 'Informations administratives';
      case 4:
        return 'Informations médicales';
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
          key="add-record-modal-backdrop"
          id="add-record-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-black/40 font-poppins overflow-y-auto"
          onClick={handleClose}
        >
          <motion.div
            id="add-record-modal-card"
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
                  ({step}/4)
                </span>
              </div>
              <button
                type="button"
                id="close-modal-button"
                onClick={handleClose}
                aria-label="Fermer"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#374151] hover:bg-[#E5E7EB]/50 transition-colors"
              >
                <CloseIcon className="w-4 h-4 sm:w-5 sm:h-5 text-current" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 relative">
              <AnimatePresence initial={false} custom={direction} mode="wait">
                {step === 1 && (
                  <motion.div
                    key="step-1"
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
                        htmlFor="field-nom"
                        className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide flex items-center"
                      >
                        Nom
                        <span className="text-[#DC2626] ml-1">*</span>
                      </label>
                      <input
                        id="field-nom"
                        type="text"
                        value={nom}
                        onChange={(e) => setNom(e.target.value)}
                        placeholder="Saisir le nom"
                        className={`w-full h-9 sm:h-10 px-3 sm:px-3.5 bg-[#FFFFFF] border rounded-lg text-xs sm:text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none transition-colors ${
                          hasAttemptedNextStep1 && !isNomValid
                            ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]'
                            : 'border-[#E5E7EB] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]'
                        }`}
                      />
                      {hasAttemptedNextStep1 && !isNomValid && (
                        <span className="text-[11px] text-[#DC2626]">
                          Le nom est obligatoire.
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col space-y-1.5">
                      <label
                        htmlFor="field-prenom"
                        className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide flex items-center"
                      >
                        Prénom
                        <span className="text-[#DC2626] ml-1">*</span>
                      </label>
                      <input
                        id="field-prenom"
                        type="text"
                        value={prenom}
                        onChange={(e) => setPrenom(e.target.value)}
                        placeholder="Saisir le prénom"
                        className={`w-full h-9 sm:h-10 px-3 sm:px-3.5 bg-[#FFFFFF] border rounded-lg text-xs sm:text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none transition-colors ${
                          hasAttemptedNextStep1 && !isPrenomValid
                            ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]'
                            : 'border-[#E5E7EB] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]'
                        }`}
                      />
                      {hasAttemptedNextStep1 && !isPrenomValid && (
                        <span className="text-[11px] text-[#DC2626]">
                          Le prénom est obligatoire.
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col space-y-2">
                      <span className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide flex items-center">
                        Sexe
                        <span className="text-[#DC2626] ml-1">*</span>
                      </span>
                      <div className="flex items-center gap-6 pt-0.5">
                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                          <input
                            id="checkbox-sexe-masculin"
                            type="checkbox"
                            checked={sexe === 'Masculin'}
                            onChange={() => setSexe(sexe === 'Masculin' ? '' : 'Masculin')}
                            className="w-4 h-4 rounded text-[#2563EB] border-[#D1D5DB] focus:ring-[#2563EB] accent-[#2563EB] cursor-pointer"
                          />
                          <span className="text-xs sm:text-sm text-[#374151] font-medium">
                            Masculin
                          </span>
                        </label>

                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                          <input
                            id="checkbox-sexe-feminin"
                            type="checkbox"
                            checked={sexe === 'Féminin'}
                            onChange={() => setSexe(sexe === 'Féminin' ? '' : 'Féminin')}
                            className="w-4 h-4 rounded text-[#2563EB] border-[#D1D5DB] focus:ring-[#2563EB] accent-[#2563EB] cursor-pointer"
                          />
                          <span className="text-xs sm:text-sm text-[#374151] font-medium">
                            Féminin
                          </span>
                        </label>
                      </div>
                      {hasAttemptedNextStep1 && !isSexeValid && (
                        <span className="text-[11px] text-[#DC2626]">
                          Veuillez sélectionner le sexe.
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col space-y-1.5">
                      <label
                        htmlFor="field-date-naissance"
                        className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide flex items-center"
                      >
                        Date de naissance
                        <span className="text-[#DC2626] ml-1">*</span>
                      </label>
                      <input
                        id="field-date-naissance"
                        type="date"
                        value={dateNaissance}
                        onChange={(e) => setDateNaissance(e.target.value)}
                        className={`w-full h-9 sm:h-10 px-3 sm:px-3.5 bg-[#FFFFFF] border rounded-lg text-xs sm:text-sm text-[#374151] focus:outline-none transition-colors ${
                          hasAttemptedNextStep1 && !isDateNaissanceValid
                            ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]'
                            : 'border-[#E5E7EB] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]'
                        }`}
                      />
                      {hasAttemptedNextStep1 && !isDateNaissanceValid && (
                        <span className="text-[11px] text-[#DC2626]">
                          La date de naissance est obligatoire.
                        </span>
                      )}
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step-2"
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
                        htmlFor="field-adresse"
                        className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide flex items-center"
                      >
                        Adresse
                        <span className="text-[#DC2626] ml-1">*</span>
                      </label>
                      <input
                        id="field-adresse"
                        type="text"
                        value={adresse}
                        onChange={(e) => setAdresse(e.target.value)}
                        placeholder="Saisir l'adresse"
                        className={`w-full h-9 sm:h-10 px-3 sm:px-3.5 bg-[#FFFFFF] border rounded-lg text-xs sm:text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none transition-colors ${
                          hasAttemptedNextStep2 && !isAdresseValid
                            ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]'
                            : 'border-[#E5E7EB] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]'
                        }`}
                      />
                      {hasAttemptedNextStep2 && !isAdresseValid && (
                        <span className="text-[11px] text-[#DC2626]">
                          L'adresse est obligatoire.
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col space-y-1.5">
                      <label
                        htmlFor="field-telephone"
                        className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide flex items-center"
                      >
                        Téléphone
                        <span className="text-[#DC2626] ml-1">*</span>
                      </label>
                      <input
                        id="field-telephone"
                        type="tel"
                        value={telephone}
                        onChange={(e) => setTelephone(e.target.value)}
                        placeholder="Saisir le numéro de téléphone"
                        className={`w-full h-9 sm:h-10 px-3 sm:px-3.5 bg-[#FFFFFF] border rounded-lg text-xs sm:text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none transition-colors ${
                          hasAttemptedNextStep2 && !isTelephoneValid
                            ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]'
                            : 'border-[#E5E7EB] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]'
                        }`}
                      />
                      {hasAttemptedNextStep2 && !isTelephoneValid && (
                        <span className="text-[11px] text-[#DC2626]">
                          Le numéro de téléphone est obligatoire.
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="field-email"
                          className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide"
                        >
                          E-mail
                        </label>
                        <span className="text-[11px] text-[#9CA3AF] font-normal">
                          Facultatif
                        </span>
                      </div>
                      <input
                        id="field-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Saisir l'adresse e-mail"
                        className="w-full h-9 sm:h-10 px-3 sm:px-3.5 bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg text-xs sm:text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors"
                      />
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div
                    key="step-3"
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
                        htmlFor="field-cabinet"
                        className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide flex items-center"
                      >
                        Cabinet de rattachement
                        <span className="text-[#DC2626] ml-1">*</span>
                      </label>
                      <div className="relative">
                        <select
                          id="field-cabinet"
                          value={cabinet}
                          onChange={(e) => setCabinet(e.target.value)}
                          className={`w-full h-9 sm:h-10 pl-3 sm:pl-3.5 pr-9 sm:pr-10 bg-[#FFFFFF] border rounded-lg text-xs sm:text-sm appearance-none cursor-pointer focus:outline-none transition-colors ${
                            !cabinet ? 'text-[#9CA3AF]' : 'text-[#374151]'
                          } ${
                            hasAttemptedNextStep3 && !isCabinetValid
                              ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]'
                              : 'border-[#E5E7EB] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]'
                          }`}
                        >
                          <option value="" disabled className="text-[#9CA3AF]">
                            Sélectionner un cabinet
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
                      {hasAttemptedNextStep3 && !isCabinetValid && (
                        <span className="text-[11px] text-[#DC2626]">
                          Le cabinet de rattachement est obligatoire.
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="field-identifiant"
                          className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide"
                        >
                          Identifiant
                        </label>
                        <span className="text-[11px] text-[#9CA3AF] font-normal">
                          Lecture seule
                        </span>
                      </div>
                      <input
                        id="field-identifiant"
                        type="text"
                        readOnly
                        tabIndex={-1}
                        value={generatedIdentifiant}
                        placeholder="Généré automatiquement selon le cabinet"
                        className="w-full h-9 sm:h-10 px-3 sm:px-3.5 bg-[#F8F9FA] border border-[#E5E7EB] rounded-lg text-xs sm:text-sm text-[#111827] font-semibold placeholder-[#9CA3AF] cursor-not-allowed select-all focus:outline-none transition-colors"
                      />
                    </div>

                    <div className="flex flex-col space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="field-profession"
                          className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide"
                        >
                          Profession
                        </label>
                        <span className="text-[11px] text-[#9CA3AF] font-normal">
                          Facultatif
                        </span>
                      </div>
                      <input
                        id="field-profession"
                        type="text"
                        value={profession}
                        onChange={(e) => setProfession(e.target.value)}
                        placeholder="Saisir la profession"
                        className="w-full h-9 sm:h-10 px-3 sm:px-3.5 bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg text-xs sm:text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors"
                      />
                    </div>

                    <div className="flex flex-col space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="field-assurance"
                          className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide"
                        >
                          Assurance
                        </label>
                        <span className="text-[11px] text-[#9CA3AF] font-normal">
                          Facultatif
                        </span>
                      </div>
                      <div className="relative">
                        <select
                          id="field-assurance"
                          value={assurance}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAssurance(val);
                            if (val !== CUSTOM_ASSURANCE_VALUE) {
                              setCustomAssurance('');
                            }
                          }}
                          className={`w-full h-9 sm:h-10 pl-3 sm:pl-3.5 pr-9 sm:pr-10 bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg text-xs sm:text-sm appearance-none cursor-pointer focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors ${
                            !assurance ? 'text-[#9CA3AF]' : 'text-[#374151]'
                          }`}
                        >
                          <option value="" className="text-[#374151]">
                            Aucune assurance
                          </option>
                          {availableAssurances.map((item) => (
                            <option key={item.id} value={item.label} className="text-[#374151]">
                              {item.label}
                            </option>
                          ))}
                          <option value={CUSTOM_ASSURANCE_VALUE} className="text-[#374151]">
                            Autre assurance...
                          </option>
                        </select>
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#9CA3AF]">
                          <ChevronDownIcon className="w-4 h-4 text-current" />
                        </span>
                      </div>
                      {assurance === CUSTOM_ASSURANCE_VALUE && (
                        <input
                          id="field-assurance-custom"
                          type="text"
                          value={customAssurance}
                          onChange={(e) => setCustomAssurance(e.target.value)}
                          placeholder="Préciser le nom de l'assurance"
                          className="w-full h-9 sm:h-10 px-3 sm:px-3.5 bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg text-xs sm:text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors"
                        />
                      )}
                    </div>
                  </motion.div>
                )}

                {step === 4 && (
                  <motion.div
                    key="step-4"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.24, ease: [0.25, 1, 0.5, 1] }}
                    className="p-4 sm:p-6 flex flex-col space-y-4"
                  >
                    <TagInputField
                      label="Allergies"
                      tags={allergies}
                      onTagsChange={setAllergies}
                      placeholder="Saisir une allergie..."
                      isOptional={true}
                    />

                    <TagInputField
                      label="Antécédents médicaux"
                      tags={antecedents}
                      onTagsChange={setAntecedents}
                      placeholder="Saisir un antécédent médical..."
                      isOptional={true}
                    />

                    <TagInputField
                      label="Traitements en cours"
                      tags={traitements}
                      onTagsChange={setTraitements}
                      placeholder="Saisir un traitement en cours..."
                      isOptional={true}
                    />

                    {sexe === 'Féminin' && (
                      <TagInputField
                        label="Grossesse / Allaitement"
                        tags={grossesseAllaitement}
                        onTagsChange={setGrossesseAllaitement}
                        placeholder="Préciser une situation..."
                        isOptional={true}
                      />
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
                    id="cancel-modal-button"
                    onClick={handleClose}
                    className="h-9 sm:h-10 px-4 flex-1 sm:flex-none sm:w-auto bg-[#FFFFFF] border border-[#D1D5DB] hover:bg-[#F3F4F6] text-[#374151] rounded-lg text-xs sm:text-sm font-medium transition-colors text-center cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    id="next-step-1-modal-button"
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
                    id="prev-step-2-modal-button"
                    onClick={handlePrevStep}
                    className="h-9 sm:h-10 px-4 flex-1 sm:flex-none sm:w-auto bg-[#FFFFFF] border border-[#D1D5DB] hover:bg-[#F3F4F6] text-[#374151] rounded-lg text-xs sm:text-sm font-medium transition-colors text-center cursor-pointer"
                  >
                    Précédent
                  </button>
                  <button
                    type="button"
                    id="next-step-2-modal-button"
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
                    id="prev-step-3-modal-button"
                    onClick={handlePrevStep}
                    className="h-9 sm:h-10 px-4 flex-1 sm:flex-none sm:w-auto bg-[#FFFFFF] border border-[#D1D5DB] hover:bg-[#F3F4F6] text-[#374151] rounded-lg text-xs sm:text-sm font-medium transition-colors text-center cursor-pointer"
                  >
                    Précédent
                  </button>
                  <button
                    type="button"
                    id="next-step-3-modal-button"
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
                    id="prev-step-4-modal-button"
                    onClick={handlePrevStep}
                    className="h-9 sm:h-10 px-4 flex-1 sm:flex-none sm:w-auto bg-[#FFFFFF] border border-[#D1D5DB] hover:bg-[#F3F4F6] text-[#374151] rounded-lg text-xs sm:text-sm font-medium transition-colors text-center cursor-pointer"
                  >
                    Précédent
                  </button>
                  <button
                    type="button"
                    id="save-modal-button"
                    onClick={handleFinalSubmit}
                    className="h-9 sm:h-10 px-5 flex-1 sm:flex-none sm:w-auto bg-[#2563EB] hover:bg-[#1D4ED8] text-[#FFFFFF] rounded-lg text-xs sm:text-sm font-medium transition-colors text-center cursor-pointer"
                  >
                    Enregistrer
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
