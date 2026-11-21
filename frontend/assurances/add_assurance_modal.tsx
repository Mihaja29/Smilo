import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CloseIcon } from '../navigation/navigation_icons';

interface AddAssuranceModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingLabels: string[];
  onSubmit: (data: { label: string; description: string }) => Promise<void> | void;
}

// BOITE MODALE D'AJOUT D'UNE NOUVELLE ASSURANCE
export const AddAssuranceModal: React.FC<AddAssuranceModalProps> = ({
  isOpen,
  onClose,
  existingLabels,
  onSubmit,
}) => {
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLabel('');
    setDescription('');
    setErrorMessage('');
    setIsSubmitting(false);
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) {
      setErrorMessage("Le nom de l'assurance est obligatoire.");
      return;
    }

    const normalized = trimmed.toLowerCase();
    const isDuplicate = existingLabels.some(
      (item) => item.trim().toLowerCase() === normalized
    );
    if (isDuplicate) {
      setErrorMessage('Cette assurance existe déjà.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    try {
      await onSubmit({
        label: trimmed,
        description: description.trim(),
      });
      onClose();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Impossible d'ajouter cette assurance.";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="add-assurance-modal-backdrop"
          id="add-assurance-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-black/40 font-poppins overflow-y-auto"
          onClick={() => {
            if (!isSubmitting) onClose();
          }}
        >
          <motion.div
            id="add-assurance-modal-card"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[94dvh] sm:max-h-[90dvh] bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl shadow-xl overflow-hidden flex flex-col my-auto"
          >
            <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 sm:py-4 [@media(max-height:580px)]:py-2.5 bg-[#FFFFFF] flex-shrink-0">
              <h2 className="text-base sm:text-lg font-semibold text-[#111827]">
                Nouvelle assurance
              </h2>
              <button
                type="button"
                id="close-assurance-modal-button"
                onClick={onClose}
                disabled={isSubmitting}
                aria-label="Fermer"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#374151] hover:bg-[#E5E7EB]/50 transition-colors cursor-pointer"
              >
                <CloseIcon className="w-4 h-4 sm:w-5 sm:h-5 text-current" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-3.5 sm:p-6 flex flex-col space-y-3 sm:space-y-4 overflow-y-auto flex-1">
                <div className="flex flex-col space-y-1.5">
                  <label
                    htmlFor="field-assurance-name"
                    className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide flex items-center"
                  >
                    Nom de l'assurance
                    <span className="text-[#DC2626] ml-1">*</span>
                  </label>
                  <input
                    id="field-assurance-name"
                    type="text"
                    value={label}
                    onChange={(e) => {
                      setLabel(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="Ex : ARO, Allianz, MAMA..."
                    autoFocus
                    className={`w-full h-9 sm:h-10 px-3 sm:px-3.5 bg-[#FFFFFF] border rounded-lg text-xs sm:text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none transition-colors ${
                      errorMessage
                        ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]'
                        : 'border-[#E5E7EB] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]'
                    }`}
                  />
                  {errorMessage && (
                    <span className="text-[11px] text-[#DC2626]">{errorMessage}</span>
                  )}
                </div>

                <div className="flex flex-col space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="field-assurance-description"
                      className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide"
                    >
                      Description
                    </label>
                    <span className="text-[11px] text-[#9CA3AF] font-normal">
                      Facultatif
                    </span>
                  </div>
                  <textarea
                    id="field-assurance-description"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Conditions de prise en charge, remarques..."
                    className="w-full px-3 sm:px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg text-xs sm:text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors resize-none"
                  />
                </div>
              </div>

              <div className="px-4 py-2.5 sm:px-6 sm:py-4 [@media(max-height:580px)]:py-2.5 flex flex-row items-center sm:justify-end gap-2 sm:gap-3 bg-[#FFFFFF] flex-shrink-0">
                <button
                  type="button"
                  id="cancel-assurance-modal-button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="h-9 sm:h-10 px-4 flex-1 sm:flex-none sm:w-auto bg-[#FFFFFF] border border-[#D1D5DB] hover:bg-[#F3F4F6] text-[#374151] rounded-lg text-xs sm:text-sm font-medium transition-colors text-center cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  id="save-assurance-modal-button"
                  disabled={isSubmitting}
                  className="h-9 sm:h-10 px-5 flex-1 sm:flex-none sm:w-auto bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-[#FFFFFF] rounded-lg text-xs sm:text-sm font-medium transition-colors text-center cursor-pointer"
                >
                  {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
