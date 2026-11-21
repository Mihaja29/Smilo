import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CloseIcon } from '../navigation/navigation_icons';
import { ProsthesisRecord } from './prostheses_types';

interface ViewProsthesisModalProps {
  isOpen: boolean;
  prosthesis: ProsthesisRecord | null;
  onClose: () => void;
}

const formatDisplayDate = (value?: string): string => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('fr-FR');
};

// BOITE MODALE DE CONSULTATION D'UNE PROTHESE DENTAIRE
export const ViewProsthesisModal: React.FC<ViewProsthesisModalProps> = ({
  isOpen,
  prosthesis,
  onClose,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && prosthesis && (
        <motion.div
          key="view-prosthesis-modal-backdrop"
          id="view-prosthesis-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-black/40 font-poppins overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            id="view-prosthesis-modal-card"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[94dvh] sm:max-h-[90dvh] bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl shadow-xl overflow-hidden flex flex-col my-auto"
          >
            <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 sm:py-4 bg-[#FFFFFF] flex-shrink-0">
              <div className="flex flex-col min-w-0 pr-3">
                <h2 className="text-base sm:text-lg font-semibold text-[#111827] truncate">
                  {prosthesis.patientNomPrenom}
                </h2>
                <span className="text-[11px] sm:text-xs text-[#6B7280] truncate">
                  {prosthesis.typeProthese}
                </span>
              </div>
              <button
                type="button"
                id="close-view-prosthesis-modal-button"
                onClick={onClose}
                aria-label="Fermer"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#374151] hover:bg-[#E5E7EB]/50 transition-colors cursor-pointer flex-shrink-0"
              >
                <CloseIcon className="w-4 h-4 sm:w-5 sm:h-5 text-current" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
              <div className="space-y-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                  Patient & cabinet
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-[#F8F9FA] border border-[#E5E7EB] rounded-xl">
                  <div className="flex flex-col space-y-0.5">
                    <span className="text-[11px] text-[#6B7280]">Nom(s) et prénom(s)</span>
                    <span className="text-xs sm:text-sm font-semibold text-[#111827] break-words">
                      {prosthesis.patientNomPrenom || '-'}
                    </span>
                  </div>
                  <div className="flex flex-col space-y-0.5">
                    <span className="text-[11px] text-[#6B7280]">Contact</span>
                    <span className="text-xs sm:text-sm font-medium text-[#374151] break-words">
                      {prosthesis.patientContact || '-'}
                    </span>
                  </div>
                  <div className="flex flex-col space-y-0.5">
                    <span className="text-[11px] text-[#6B7280]">Cabinet dentaire</span>
                    <span className="text-xs sm:text-sm font-medium text-[#374151] break-words">
                      {prosthesis.cabinetDentaire || '-'}
                    </span>
                  </div>
                  <div className="flex flex-col space-y-0.5">
                    <span className="text-[11px] text-[#6B7280]">État de traitement</span>
                    <span className="text-xs sm:text-sm font-semibold text-[#111827]">
                      {prosthesis.etatTraitement === 'Terminer' ? 'Terminer' : 'En cours'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                  Prothèse & laboratoire
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-[#F8F9FA] border border-[#E5E7EB] rounded-xl">
                  <div className="flex flex-col space-y-0.5">
                    <span className="text-[11px] text-[#6B7280]">Type de prothèse</span>
                    <span className="text-xs sm:text-sm font-medium text-[#111827] break-words">
                      {prosthesis.typeProthese || '-'}
                    </span>
                  </div>
                  <div className="flex flex-col space-y-0.5">
                    <span className="text-[11px] text-[#6B7280]">Numéro dentaire</span>
                    <span className="text-xs sm:text-sm font-medium text-[#374151] break-words">
                      {prosthesis.numeroDentaire || '-'}
                    </span>
                  </div>
                  <div className="flex flex-col space-y-0.5">
                    <span className="text-[11px] text-[#6B7280]">Teinte</span>
                    <span className="text-xs sm:text-sm font-medium text-[#374151] break-words">
                      {prosthesis.teinteProthese || '-'}
                    </span>
                  </div>
                  <div className="flex flex-col space-y-0.5">
                    <span className="text-[11px] text-[#6B7280]">Laboratoire</span>
                    <span className="text-xs sm:text-sm font-medium text-[#374151] break-words">
                      {prosthesis.nomLaboratoire || '-'}
                    </span>
                  </div>
                  <div className="flex flex-col space-y-0.5 sm:col-span-2">
                    <span className="text-[11px] text-[#6B7280]">Créateur de prothèse</span>
                    <span className="text-xs sm:text-sm font-medium text-[#374151] break-words">
                      {prosthesis.nomCreateurProthese || '-'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                  Suivi & montant
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-[#F8F9FA] border border-[#E5E7EB] rounded-xl">
                  <div className="flex flex-col space-y-0.5">
                    <span className="text-[11px] text-[#6B7280]">Date d'envoi</span>
                    <span className="text-xs sm:text-sm font-medium text-[#374151]">
                      {formatDisplayDate(prosthesis.dateEnvoi)}
                    </span>
                  </div>
                  <div className="flex flex-col space-y-0.5">
                    <span className="text-[11px] text-[#6B7280]">Date de livraison</span>
                    <span className="text-xs sm:text-sm font-medium text-[#374151]">
                      {formatDisplayDate(prosthesis.dateLivraison)}
                    </span>
                  </div>
                  <div className="flex flex-col space-y-0.5">
                    <span className="text-[11px] text-[#6B7280]">Montant</span>
                    <span className="text-xs sm:text-sm font-semibold text-[#111827]">
                      {prosthesis.montant || '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-4 sm:px-6 py-3 bg-[#FFFFFF] flex justify-end flex-shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="h-9 sm:h-10 px-5 bg-[#FFFFFF] border border-[#D1D5DB] hover:bg-[#F3F4F6] text-[#374151] rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
