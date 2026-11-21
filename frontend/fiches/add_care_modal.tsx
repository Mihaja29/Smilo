import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CloseIcon } from '../navigation/navigation_icons';
import { CareHistoryItem } from './record_id_utils';

interface AddCareModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialItem?: CareHistoryItem | null;
  onSubmit: (item: Omit<CareHistoryItem, 'id'>) => void;
}

// Modale d'ajout d'une ligne dans l'historique des soins
export const AddCareModal: React.FC<AddCareModalProps> = ({
  isOpen,
  onClose,
  initialItem = null,
  onSubmit,
}) => {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [actesProduitsMedicaments, setActesProduitsMedicaments] = useState('');
  const [observations, setObservations] = useState('');
  const [montant, setMontant] = useState('');
  const [hasAttemptedStep1, setHasAttemptedStep1] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [mobileStep, setMobileStep] = useState<1 | 2>(1);
  const [direction, setDirection] = useState<1 | -1>(1);
  const checkIsMobile = () => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(max-width: 639px)').matches ||
      window.matchMedia('(max-height: 580px) and (max-width: 1023px)').matches
    );
  };

  const [isMobile, setIsMobile] = useState<boolean>(checkIsMobile);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const portraitQuery = window.matchMedia('(max-width: 639px)');
    const landscapeQuery = window.matchMedia('(max-height: 580px) and (max-width: 1023px)');
    const handleChange = () => setIsMobile(portraitQuery.matches || landscapeQuery.matches);
    handleChange();
    portraitQuery.addEventListener('change', handleChange);
    landscapeQuery.addEventListener('change', handleChange);
    window.addEventListener('resize', handleChange);
    window.addEventListener('orientationchange', handleChange);
    return () => {
      portraitQuery.removeEventListener('change', handleChange);
      landscapeQuery.removeEventListener('change', handleChange);
      window.removeEventListener('resize', handleChange);
      window.removeEventListener('orientationchange', handleChange);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setHasAttemptedStep1(false);
    setHasAttemptedSubmit(false);
    setMobileStep(1);
    setDirection(1);
    if (initialItem) {
      setDate(initialItem.date || new Date().toISOString().split('T')[0]);
      setActesProduitsMedicaments(initialItem.actesProduitsMedicaments || '');
      setObservations(initialItem.observations || '');
      setMontant(initialItem.montant || '');
    } else {
      setDate(new Date().toISOString().split('T')[0]);
      setActesProduitsMedicaments('');
      setObservations('');
      setMontant('');
    }
  }, [isOpen, initialItem]);

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
    setHasAttemptedStep1(false);
    setHasAttemptedSubmit(false);
    setMobileStep(1);
    setDirection(1);
    onClose();
  };

  const handleActesKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const { selectionStart, selectionEnd, value } = textarea;

      const before = value.substring(0, selectionStart);
      const after = value.substring(selectionEnd);

      const lastNewlineIndex = before.lastIndexOf('\n');
      const currentLine = lastNewlineIndex === -1 ? before : before.substring(lastNewlineIndex + 1);

      if (currentLine.trim() === '-' || (currentLine.startsWith('-') && currentLine.trim().length === 1)) {
        const lineStart = lastNewlineIndex === -1 ? 0 : lastNewlineIndex + 1;
        const newBefore = value.substring(0, lineStart);
        const newValue = newBefore + '\n' + after;
        setActesProduitsMedicaments(newValue);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = newBefore.length + 1;
        }, 0);
        return;
      }

      let newBefore = before;
      if (lastNewlineIndex === -1 && !before.trim().startsWith('-') && before.trim().length > 0) {
        newBefore = '- ' + before;
      }

      const insertion = '\n- ';
      const newValue = newBefore + insertion + after;
      setActesProduitsMedicaments(newValue);

      const newCursorPos = newBefore.length + insertion.length;
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = newCursorPos;
      }, 0);
    }
  };

  const isDateValid = date.trim().length > 0;
  const isActesValid = actesProduitsMedicaments.trim().length > 0;
  const isMontantValid = montant.trim().length > 0;
  const isStep1Valid = isDateValid && isActesValid;
  const isFormValid = isStep1Valid && isMontantValid;

  const normalizeMontant = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    if (/ar$/i.test(trimmed)) {
      const withoutAr = trimmed.replace(/ar$/i, '').trim();
      return withoutAr ? `${withoutAr} Ar` : 'Ar';
    }
    return `${trimmed} Ar`;
  };

  const handleNextMobileStep = () => {
    setHasAttemptedStep1(true);
    if (!isStep1Valid) return;
    setHasAttemptedSubmit(false);
    setDirection(1);
    setMobileStep(2);
  };

  const handlePrevMobileStep = () => {
    setDirection(-1);
    setMobileStep(1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isMobile && mobileStep === 1) {
      handleNextMobileStep();
      return;
    }

    setHasAttemptedStep1(true);
    setHasAttemptedSubmit(true);

    if (!isFormValid) {
      return;
    }

    const formattedActes = actesProduitsMedicaments
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((l) => (l.startsWith('-') ? l : `- ${l}`))
      .join('\n');

    const formattedMontant = normalizeMontant(montant);

    onSubmit({
      date: date.trim(),
      actesProduitsMedicaments: formattedActes || actesProduitsMedicaments.trim(),
      observations: observations.trim(),
      montant: formattedMontant || montant.trim(),
    });

    setDate(new Date().toISOString().split('T')[0]);
    setActesProduitsMedicaments('');
    setObservations('');
    setMontant('');
    setHasAttemptedStep1(false);
    setHasAttemptedSubmit(false);
    setMobileStep(1);
    setDirection(1);
    onClose();
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

  const showStep1Errors = isMobile ? hasAttemptedStep1 : hasAttemptedSubmit;

  const renderDateAndActesFields = () => (
    <>
      <div className="flex flex-col space-y-1.5">
        <label
          htmlFor="care-field-date"
          className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide"
        >
          Date <span className="text-[#DC2626]">*</span>
        </label>
        <input
          id="care-field-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={`h-10 px-3 bg-[#FFFFFF] border rounded-lg text-xs sm:text-sm text-[#374151] focus:outline-none focus:ring-1 font-poppins transition-colors ${
            showStep1Errors && !isDateValid
              ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]'
              : 'border-[#E5E7EB] focus:border-[#2563EB] focus:ring-[#2563EB]'
          }`}
        />
      </div>

      <div className="flex flex-col space-y-1.5">
        <label
          htmlFor="care-field-actes"
          className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide"
        >
          Actes, Produits et Médicaments <span className="text-[#DC2626]">*</span>
        </label>
        <textarea
          id="care-field-actes"
          rows={isMobile ? 2 : 4}
          value={actesProduitsMedicaments}
          onChange={(e) => setActesProduitsMedicaments(e.target.value)}
          onKeyDown={handleActesKeyDown}
          placeholder="Ex : - Détartrage&#10;- Composite"
          className={`p-3 bg-[#FFFFFF] border rounded-lg text-xs sm:text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 font-poppins transition-colors resize-none ${
            showStep1Errors && !isActesValid
              ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]'
              : 'border-[#E5E7EB] focus:border-[#2563EB] focus:ring-[#2563EB]'
          }`}
        />
      </div>
    </>
  );

  const renderObservationsAndMontantFields = () => (
    <>
      <div className="flex flex-col space-y-1.5">
        <label
          htmlFor="care-field-observations"
          className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide"
        >
          Observations
        </label>
        <textarea
          id="care-field-observations"
          rows={2}
          value={observations}
          onChange={(e) => setObservations(e.target.value)}
          placeholder="Remarques ou suivi..."
          className="p-3 bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg text-xs sm:text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] font-poppins transition-colors resize-none"
        />
      </div>

      <div className="flex flex-col space-y-1.5">
        <label
          htmlFor="care-field-montant"
          className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide"
        >
          Montants <span className="text-[#DC2626]">*</span>
        </label>
        <input
          id="care-field-montant"
          type="text"
          value={montant}
          onChange={(e) => setMontant(e.target.value)}
          onBlur={() => {
            if (montant.trim()) {
              setMontant(normalizeMontant(montant));
            }
          }}
          placeholder="Ex: 50 000 Ar"
          className={`h-10 px-3 bg-[#FFFFFF] border rounded-lg text-xs sm:text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 font-poppins transition-colors ${
            hasAttemptedSubmit && !isMontantValid
              ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]'
              : 'border-[#E5E7EB] focus:border-[#2563EB] focus:ring-[#2563EB]'
          }`}
        />
      </div>
    </>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="add-care-modal-backdrop"
          id="add-care-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-black/40 font-poppins overflow-y-auto"
          onClick={handleClose}
        >
          <motion.div
            id="add-care-modal-card"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[94dvh] sm:max-h-[90dvh] bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl shadow-xl overflow-hidden flex flex-col my-auto"
          >
            <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 sm:py-3.5 [@media(max-height:580px)]:py-2.5 bg-[#FFFFFF] flex-shrink-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-lg [@media(max-height:580px)]:text-base font-semibold text-[#111827]">
                  {initialItem ? 'Modifier un soin' : 'Ajouter un soin'}
                </h2>
                {isMobile && (
                  <span className="text-xs text-[#9CA3AF] font-medium">
                    ({mobileStep}/2)
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Fermer"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#374151] hover:bg-[#E5E7EB]/50 transition-colors cursor-pointer"
              >
                <CloseIcon className="w-4 h-4 sm:w-5 sm:h-5 text-current" />
              </button>
            </div>

            <form
              id="add-care-form"
              onSubmit={handleSubmit}
              className="flex flex-col flex-1 min-h-0 overflow-hidden"
            >
              {isMobile ? (
                <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 relative">
                  <AnimatePresence initial={false} custom={direction} mode="wait">
                    {mobileStep === 1 && (
                      <motion.div
                        key="care-mobile-step-1"
                        custom={direction}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.24, ease: [0.25, 1, 0.5, 1] }}
                        className="p-3.5 flex flex-col space-y-3"
                      >
                        {renderDateAndActesFields()}
                      </motion.div>
                    )}

                    {mobileStep === 2 && (
                      <motion.div
                        key="care-mobile-step-2"
                        custom={direction}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.24, ease: [0.25, 1, 0.5, 1] }}
                        className="p-3.5 flex flex-col space-y-3"
                      >
                        {renderObservationsAndMontantFields()}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="p-4 sm:p-6 flex flex-col space-y-4 overflow-y-auto flex-1">
                  {renderDateAndActesFields()}
                  {renderObservationsAndMontantFields()}
                </div>
              )}

              <div className="px-4 py-2.5 sm:px-6 sm:py-3.5 [@media(max-height:580px)]:py-2.5 flex flex-row items-center sm:justify-end gap-2 sm:gap-2.5 bg-[#FFFFFF] flex-shrink-0">
                {isMobile ? (
                  mobileStep === 1 ? (
                    <>
                      <button
                        type="button"
                        id="cancel-add-care-button"
                        onClick={handleClose}
                        className="h-9 px-4 flex-1 bg-[#FFFFFF] border border-[#D1D5DB] hover:bg-[#F3F4F6] text-[#374151] rounded-lg text-xs font-medium transition-colors text-center cursor-pointer"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        id="next-add-care-step-button"
                        onClick={handleNextMobileStep}
                        className="h-9 px-5 flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-[#FFFFFF] rounded-lg text-xs font-medium transition-colors text-center cursor-pointer"
                      >
                        Suivant
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        id="prev-add-care-step-button"
                        onClick={handlePrevMobileStep}
                        className="h-9 px-4 flex-1 bg-[#FFFFFF] border border-[#D1D5DB] hover:bg-[#F3F4F6] text-[#374151] rounded-lg text-xs font-medium transition-colors text-center cursor-pointer"
                      >
                        Précédent
                      </button>
                      <button
                        type="submit"
                        id="submit-add-care-button"
                        className="h-9 px-5 flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-[#FFFFFF] rounded-lg text-xs font-medium transition-colors text-center cursor-pointer"
                      >
                        Enregistrer
                      </button>
                    </>
                  )
                ) : (
                  <>
                    <button
                      type="button"
                      id="cancel-add-care-button"
                      onClick={handleClose}
                      className="h-9 sm:h-10 px-4 w-auto bg-[#FFFFFF] border border-[#D1D5DB] hover:bg-[#F3F4F6] text-[#374151] rounded-lg text-xs sm:text-sm font-medium transition-colors text-center cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      id="submit-add-care-button"
                      className="h-9 sm:h-10 px-5 w-auto bg-[#2563EB] hover:bg-[#1D4ED8] text-[#FFFFFF] rounded-lg text-xs sm:text-sm font-medium transition-colors text-center cursor-pointer"
                    >
                      Enregistrer
                    </button>
                  </>
                )}
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
