import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronDownIcon,
  CloseIcon,
} from '../navigation/navigation_icons';
import {
  CabinetOption,
  transferCabinetPatientsApi,
} from '../services/cabinets_api';
import { getPatientsStatsApi } from '../services/patients_api';

interface TransferCabinetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cabinets: CabinetOption[];
}

// BOITE MODALE DE REAFFECTATION GLOBALE DES PATIENTS ENTRE CABINETS
export const TransferCabinetsModal: React.FC<TransferCabinetsModalProps> = ({
  isOpen,
  onClose,
  cabinets,
}) => {
  const [sourceCabinet, setSourceCabinet] = useState('');
  const [targetCabinet, setTargetCabinet] = useState('');
  const [countsByCabinet, setCountsByCabinet] = useState<Record<string, number>>({});
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const first = cabinets[0]?.name || '';
    const second = cabinets.find((c) => c.name !== first)?.name || '';
    setSourceCabinet(first);
    setTargetCabinet(second);
    setErrorMessage('');
    setIsSubmitting(false);

    setIsLoadingCounts(true);
    getPatientsStatsApi()
      .then((stats) => {
        setCountsByCabinet(stats?.byCabinet || {});
      })
      .catch(() => {
        setCountsByCabinet({});
      })
      .finally(() => {
        setIsLoadingCounts(false);
      });
  }, [isOpen, cabinets]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  const targetOptions = useMemo(
    () =>
      cabinets.filter(
        (c) => c.name.trim().toLowerCase() !== sourceCabinet.trim().toLowerCase()
      ),
    [cabinets, sourceCabinet]
  );

  const sourceCount = useMemo(() => {
    const entry = Object.entries(countsByCabinet).find(
      ([name]) => name.trim().toLowerCase() === sourceCabinet.trim().toLowerCase()
    );
    return entry ? entry[1] : 0;
  }, [countsByCabinet, sourceCabinet]);

  const handleSourceChange = (nextSource: string) => {
    setSourceCabinet(nextSource);
    setErrorMessage('');
    if (nextSource.trim().toLowerCase() === targetCabinet.trim().toLowerCase()) {
      const nextTarget =
        cabinets.find(
          (c) => c.name.trim().toLowerCase() !== nextSource.trim().toLowerCase()
        )?.name || '';
      setTargetCabinet(nextTarget);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cabinets.length < 2) {
      setErrorMessage('Au moins deux cabinets sont requis pour effectuer un transfert.');
      return;
    }
    if (!sourceCabinet || !targetCabinet) {
      setErrorMessage('Veuillez sélectionner un cabinet source et un cabinet destinataire.');
      return;
    }
    if (sourceCabinet.trim().toLowerCase() === targetCabinet.trim().toLowerCase()) {
      setErrorMessage('Le cabinet source et le cabinet destinataire doivent être différents.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await transferCabinetPatientsApi({
        sourceCabinet,
        targetCabinet,
      });
      onClose();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Impossible de transférer les patients.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="transfer-cabinets-modal-backdrop"
          id="transfer-cabinets-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-black/40 font-poppins overflow-y-auto"
          onClick={() => {
            if (!isSubmitting) onClose();
          }}
        >
          <motion.div
            id="transfer-cabinets-modal-card"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[94dvh] sm:max-h-[90dvh] bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl shadow-xl overflow-hidden flex flex-col my-auto"
          >
            <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 sm:py-4 [@media(max-height:580px)]:py-2.5 bg-[#FFFFFF] flex-shrink-0">
              <h2 className="text-base sm:text-lg font-semibold text-[#111827]">
                Réaffectation globale
              </h2>
              <button
                type="button"
                id="close-transfer-modal-button"
                onClick={onClose}
                disabled={isSubmitting}
                aria-label="Fermer"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#374151] hover:bg-[#E5E7EB]/50 transition-colors cursor-pointer"
              >
                <CloseIcon className="w-4 h-4 sm:w-5 sm:h-5 text-current" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex flex-col flex-1 min-h-0 overflow-hidden"
            >
              <div className="p-3.5 sm:p-6 flex flex-col space-y-3 sm:space-y-4 overflow-y-auto flex-1">
                {cabinets.length < 2 ? (
                  <p className="text-xs sm:text-sm text-[#374151]">
                    Au moins deux cabinets sont nécessaires pour effectuer une réaffectation globale.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-col space-y-1.5">
                      <label
                        htmlFor="field-transfer-source"
                        className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide flex items-center"
                      >
                        Cabinet source
                        <span className="text-[#DC2626] ml-1">*</span>
                      </label>
                      <div className="relative">
                        <select
                          id="field-transfer-source"
                          value={sourceCabinet}
                          onChange={(e) => handleSourceChange(e.target.value)}
                          disabled={isSubmitting}
                          className="w-full h-9 sm:h-10 pl-3 sm:pl-3.5 pr-9 sm:pr-10 bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg text-xs sm:text-sm text-[#374151] appearance-none cursor-pointer focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors"
                        >
                          {cabinets.map((cabinet) => {
                            const countEntry = Object.entries(countsByCabinet).find(
                              ([name]) =>
                                name.trim().toLowerCase() ===
                                cabinet.name.trim().toLowerCase()
                            );
                            const count = countEntry ? countEntry[1] : 0;
                            return (
                              <option key={cabinet.id} value={cabinet.name}>
                                {cabinet.name}
                                {!isLoadingCounts ? ` (${count})` : ''}
                              </option>
                            );
                          })}
                        </select>
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#9CA3AF]">
                          <ChevronDownIcon className="w-4 h-4 text-current" />
                        </span>
                      </div>
                      <AnimatePresence mode="wait">
                        {!isLoadingCounts && sourceCabinet && (
                          <motion.span
                            key={`transfer-count-${sourceCabinet}`}
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                            className="text-[11px] text-[#6B7280]"
                          >
                            {sourceCount} patient(s) actif(s) seront transférés
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="flex flex-col space-y-1.5">
                      <label
                        htmlFor="field-transfer-target"
                        className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide flex items-center"
                      >
                        Cabinet destinataire
                        <span className="text-[#DC2626] ml-1">*</span>
                      </label>
                      <div className="relative">
                        <select
                          id="field-transfer-target"
                          value={targetCabinet}
                          onChange={(e) => {
                            setTargetCabinet(e.target.value);
                            if (errorMessage) setErrorMessage('');
                          }}
                          disabled={isSubmitting}
                          className="w-full h-9 sm:h-10 pl-3 sm:pl-3.5 pr-9 sm:pr-10 bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg text-xs sm:text-sm text-[#374151] appearance-none cursor-pointer focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors"
                        >
                          {targetOptions.map((cabinet) => (
                            <option key={cabinet.id} value={cabinet.name}>
                              {cabinet.name}
                            </option>
                          ))}
                        </select>
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#9CA3AF]">
                          <ChevronDownIcon className="w-4 h-4 text-current" />
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {errorMessage && (
                  <span className="text-[11px] text-[#DC2626]">{errorMessage}</span>
                )}
              </div>

              <div className="px-4 py-2.5 sm:px-6 sm:py-4 [@media(max-height:580px)]:py-2.5 flex flex-row items-center sm:justify-end gap-2 sm:gap-3 bg-[#FFFFFF] flex-shrink-0">
                <button
                  type="button"
                  id="cancel-transfer-modal-button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="h-9 sm:h-10 px-4 flex-1 sm:flex-none sm:w-auto bg-[#FFFFFF] border border-[#D1D5DB] hover:bg-[#F3F4F6] text-[#374151] rounded-lg text-xs sm:text-sm font-medium transition-colors text-center cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  id="submit-transfer-modal-button"
                  disabled={
                    isSubmitting ||
                    cabinets.length < 2 ||
                    !sourceCabinet ||
                    !targetCabinet
                  }
                  className="h-9 sm:h-10 px-4 flex-1 sm:flex-none sm:w-auto bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-[#FFFFFF] rounded-lg text-xs sm:text-sm font-medium transition-colors text-center cursor-pointer"
                >
                  {isSubmitting ? 'Transfert...' : 'Transférer'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
