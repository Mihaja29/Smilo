import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CloseIcon, ChevronDownIcon } from '../navigation/navigation_icons';
import {
  PriseEnChargeRecord,
  CoverageProcessingStatus,
} from '../services/coverages_api';

interface CoverageStatusModalProps {
  isOpen: boolean;
  coverage: PriseEnChargeRecord | null;
  onClose: () => void;
  onSave: (
    id: string,
    etatTraitement: CoverageProcessingStatus,
    dateObtentionCheque: string
  ) => void;
}

// BOITE MODALE ETAT DE TRAITEMENT ET DATE D'OBTENTION DE CHEQUE
export const CoverageStatusModal: React.FC<CoverageStatusModalProps> = ({
  isOpen,
  coverage,
  onClose,
  onSave,
}) => {
  const [etatTraitement, setEtatTraitement] =
    useState<CoverageProcessingStatus>('En cours');
  const [dateObtentionCheque, setDateObtentionCheque] = useState('');

  useEffect(() => {
    if (!isOpen || !coverage) return;
    setEtatTraitement(
      coverage.etatTraitement === 'Reçu' ? 'Reçu' : 'En cours'
    );
    setDateObtentionCheque(coverage.dateObtentionCheque || '');
  }, [isOpen, coverage]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!coverage) return;
    const finalDate =
      etatTraitement === 'Reçu' ? dateObtentionCheque.trim() : '';
    onSave(coverage.id, etatTraitement, finalDate);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && coverage && (
        <motion.div
          key="coverage-status-modal-backdrop"
          id="coverage-status-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-black/40 font-poppins overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            id="coverage-status-modal-card"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[94dvh] sm:max-h-[90dvh] bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl shadow-xl overflow-hidden flex flex-col my-auto"
          >
            <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 sm:py-4 [@media(max-height:580px)]:py-2.5 bg-[#FFFFFF] flex-shrink-0">
              <div className="flex flex-col min-w-0 pr-3">
                <h2 className="text-base sm:text-lg font-semibold text-[#111827] truncate">
                  État de traitement
                </h2>
                <span className="text-[11px] text-[#6B7280] truncate">
                  {coverage.numeroPriseEnCharge} — {coverage.patientNomPrenom}
                </span>
              </div>
              <button
                type="button"
                id="close-coverage-status-modal-button"
                onClick={onClose}
                aria-label="Fermer"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#374151] hover:bg-[#E5E7EB]/50 transition-colors cursor-pointer flex-shrink-0"
              >
                <CloseIcon className="w-4 h-4 sm:w-5 sm:h-5 text-current" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-3.5 sm:p-6 flex flex-col space-y-3 sm:space-y-4 overflow-y-auto flex-1">
                <div className="flex flex-col space-y-1.5">
                  <label
                    htmlFor="field-coverage-processing-status"
                    className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide"
                  >
                    État de traitement
                  </label>
                  <div className="relative">
                    <select
                      id="field-coverage-processing-status"
                      value={etatTraitement}
                      onChange={(e) =>
                        setEtatTraitement(
                          e.target.value === 'Reçu' ? 'Reçu' : 'En cours'
                        )
                      }
                      className="w-full h-9 sm:h-10 pl-3 sm:pl-3.5 pr-9 sm:pr-10 bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg text-xs sm:text-sm text-[#374151] appearance-none cursor-pointer focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors"
                    >
                      <option value="En cours">En cours</option>
                      <option value="Reçu">Reçu</option>
                    </select>
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#9CA3AF]">
                      <ChevronDownIcon className="w-4 h-4 text-current" />
                    </span>
                  </div>
                </div>

                {etatTraitement === 'Reçu' && (
                  <div className="flex flex-col space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="field-coverage-cheque-date"
                        className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide"
                      >
                        Date d'obtention de chèque
                      </label>
                      <span className="text-[11px] text-[#9CA3AF] font-normal">
                        Facultatif
                      </span>
                    </div>
                    <input
                      id="field-coverage-cheque-date"
                      type="date"
                      value={dateObtentionCheque}
                      onChange={(e) => setDateObtentionCheque(e.target.value)}
                      className="w-full h-9 sm:h-10 px-3 sm:px-3.5 bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg text-xs sm:text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors"
                    />
                  </div>
                )}
              </div>

              <div className="px-4 py-2.5 sm:px-6 sm:py-4 [@media(max-height:580px)]:py-2.5 flex flex-row items-center sm:justify-end gap-2 sm:gap-3 bg-[#FFFFFF] flex-shrink-0">
                <button
                  type="button"
                  id="cancel-coverage-status-button"
                  onClick={onClose}
                  className="h-9 sm:h-10 px-4 flex-1 sm:flex-none sm:w-auto bg-[#FFFFFF] border border-[#D1D5DB] hover:bg-[#F3F4F6] text-[#374151] rounded-lg text-xs sm:text-sm font-medium transition-colors text-center cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  id="save-coverage-status-button"
                  className="h-9 sm:h-10 px-5 flex-1 sm:flex-none sm:w-auto bg-[#2563EB] hover:bg-[#1D4ED8] text-[#FFFFFF] rounded-lg text-xs sm:text-sm font-medium transition-colors text-center cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
