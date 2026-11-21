import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CloseIcon } from '../navigation/navigation_icons';
import { PriseEnChargeRecord } from '../services/coverages_api';

interface ViewCoverageModalProps {
  isOpen: boolean;
  coverage: PriseEnChargeRecord | null;
  onClose: () => void;
}

const formatDisplayDate = (value?: string): string => {
  const trimmed = (value || '').trim();
  if (!trimmed) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split('-');
    return `${day}/${month}/${year}`;
  }
  return trimmed;
};

// BOITE MODALE MULTI-ETAPES CONSULTATION PRISE EN CHARGE (LECTURE SEULE)
export const ViewCoverageModal: React.FC<ViewCoverageModalProps> = ({
  isOpen,
  coverage,
  onClose,
}) => {
  const [step, setStep] = useState<number>(1);
  const [direction, setDirection] = useState<number>(1);

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setDirection(1);
  }, [isOpen, coverage?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleNextStep = () => {
    setDirection(1);
    setStep((prev) => Math.min(3, prev + 1));
  };

  const handlePrevStep = () => {
    setDirection(-1);
    setStep((prev) => Math.max(1, prev - 1));
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
        return 'Prise en charge';
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

  const readOnlyInputClass =
    'w-full h-9 sm:h-10 px-3 sm:px-3.5 bg-[#F8F9FA] border border-[#E5E7EB] rounded-lg text-xs sm:text-sm text-[#374151] placeholder-[#9CA3AF] cursor-default focus:outline-none';

  return (
    <AnimatePresence>
      {isOpen && coverage && (
        <motion.div
          key="view-coverage-modal-backdrop"
          id="view-coverage-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-black/40 font-poppins overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            id="view-coverage-modal-card"
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
                id="close-view-coverage-modal-button"
                onClick={onClose}
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
                    key="view-coverage-step-1"
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
                        htmlFor="view-coverage-cabinet"
                        className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide"
                      >
                        Cabinet dentaire
                      </label>
                      <input
                        id="view-coverage-cabinet"
                        type="text"
                        readOnly
                        value={coverage.cabinetDentaire || ''}
                        placeholder="Non renseigné"
                        className={readOnlyInputClass}
                      />
                    </div>

                    <div className="flex flex-col space-y-1.5">
                      <label
                        htmlFor="view-coverage-invoice"
                        className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide"
                      >
                        N° Facture
                      </label>
                      <input
                        id="view-coverage-invoice"
                        type="text"
                        readOnly
                        value={coverage.numeroFacture || ''}
                        placeholder="Non renseigné"
                        className={readOnlyInputClass}
                      />
                    </div>

                    <div className="flex flex-col space-y-2">
                      <span className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide">
                        Montant en Ariary
                      </span>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex flex-col space-y-1">
                          <label
                            htmlFor="view-coverage-amount-proposed"
                            className="text-[11px] font-medium text-[#374151]"
                          >
                            Montant proposé
                          </label>
                          <input
                            id="view-coverage-amount-proposed"
                            type="text"
                            readOnly
                            value={coverage.montantProposeAriary || ''}
                            placeholder="Non renseigné"
                            className={readOnlyInputClass}
                          />
                        </div>

                        <div className="flex flex-col space-y-1">
                          <label
                            htmlFor="view-coverage-amount-given"
                            className="text-[11px] font-medium text-[#374151]"
                          >
                            Montant donné par l'assurance
                          </label>
                          <input
                            id="view-coverage-amount-given"
                            type="text"
                            readOnly
                            value={coverage.montantAssuranceAriary || ''}
                            placeholder="Non renseigné"
                            className={readOnlyInputClass}
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="view-coverage-step-2"
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
                        htmlFor="view-coverage-patient-name"
                        className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide"
                      >
                        Nom(s) et prénom(s) du patient
                      </label>
                      <input
                        id="view-coverage-patient-name"
                        type="text"
                        readOnly
                        value={coverage.patientNomPrenom || ''}
                        placeholder="Non renseigné"
                        className={readOnlyInputClass}
                      />
                    </div>

                    <div className="flex flex-col space-y-1.5">
                      <label
                        htmlFor="view-coverage-company-name"
                        className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide"
                      >
                        Nom société
                      </label>
                      <input
                        id="view-coverage-company-name"
                        type="text"
                        readOnly
                        value={coverage.nomSociete || ''}
                        placeholder="Non renseigné"
                        className={readOnlyInputClass}
                      />
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div
                    key="view-coverage-step-3"
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
                        htmlFor="view-coverage-agency"
                        className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide"
                      >
                        Agence
                      </label>
                      <input
                        id="view-coverage-agency"
                        type="text"
                        readOnly
                        value={coverage.agence || ''}
                        placeholder="Non renseigné"
                        className={readOnlyInputClass}
                      />
                    </div>

                    <div className="flex flex-col space-y-1.5">
                      <label
                        htmlFor="view-coverage-pec-number"
                        className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide"
                      >
                        N° de prise en charge
                      </label>
                      <input
                        id="view-coverage-pec-number"
                        type="text"
                        readOnly
                        value={coverage.numeroPriseEnCharge || ''}
                        placeholder="Non renseigné"
                        className={readOnlyInputClass}
                      />
                    </div>

                    <div className="flex flex-col space-y-1.5">
                      <label
                        htmlFor="view-coverage-attestation-date"
                        className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide"
                      >
                        Date d'attestation
                      </label>
                      <input
                        id="view-coverage-attestation-date"
                        type="text"
                        readOnly
                        value={formatDisplayDate(coverage.dateAttestation)}
                        placeholder="Non renseigné"
                        className={readOnlyInputClass}
                      />
                    </div>

                    <div className="flex flex-col space-y-1.5">
                      <label
                        htmlFor="view-coverage-creators"
                        className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide"
                      >
                        Créateurs de prise en charge
                      </label>
                      <input
                        id="view-coverage-creators"
                        type="text"
                        readOnly
                        value={coverage.createursPriseEnCharge || ''}
                        placeholder="Non renseigné"
                        className={readOnlyInputClass}
                      />
                    </div>

                    <div className="flex flex-col space-y-1.5">
                      <label
                        htmlFor="view-coverage-send-date"
                        className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide"
                      >
                        Date d'envoi
                      </label>
                      <input
                        id="view-coverage-send-date"
                        type="text"
                        readOnly
                        value={formatDisplayDate(coverage.dateEnvoi)}
                        placeholder="Non renseigné"
                        className={readOnlyInputClass}
                      />
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
                    id="close-view-coverage-step-1-button"
                    onClick={onClose}
                    className="h-9 sm:h-10 px-4 flex-1 sm:flex-none sm:w-auto bg-[#FFFFFF] border border-[#D1D5DB] hover:bg-[#F3F4F6] text-[#374151] rounded-lg text-xs sm:text-sm font-medium transition-colors text-center cursor-pointer"
                  >
                    Fermer
                  </button>
                  <button
                    type="button"
                    id="next-view-coverage-step-1-button"
                    onClick={handleNextStep}
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
                    id="prev-view-coverage-step-2-button"
                    onClick={handlePrevStep}
                    className="h-9 sm:h-10 px-4 flex-1 sm:flex-none sm:w-auto bg-[#FFFFFF] border border-[#D1D5DB] hover:bg-[#F3F4F6] text-[#374151] rounded-lg text-xs sm:text-sm font-medium transition-colors text-center cursor-pointer"
                  >
                    Précédent
                  </button>
                  <button
                    type="button"
                    id="next-view-coverage-step-2-button"
                    onClick={handleNextStep}
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
                    id="prev-view-coverage-step-3-button"
                    onClick={handlePrevStep}
                    className="h-9 sm:h-10 px-4 flex-1 sm:flex-none sm:w-auto bg-[#FFFFFF] border border-[#D1D5DB] hover:bg-[#F3F4F6] text-[#374151] rounded-lg text-xs sm:text-sm font-medium transition-colors text-center cursor-pointer"
                  >
                    Précédent
                  </button>
                  <button
                    type="button"
                    id="close-view-coverage-step-3-button"
                    onClick={onClose}
                    className="h-9 sm:h-10 px-5 flex-1 sm:flex-none sm:w-auto bg-[#2563EB] hover:bg-[#1D4ED8] text-[#FFFFFF] rounded-lg text-xs sm:text-sm font-medium transition-colors text-center cursor-pointer"
                  >
                    Fermer
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
