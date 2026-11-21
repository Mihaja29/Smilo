import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CloseIcon } from '../navigation/navigation_icons';

import {
  normalizeCabinetCode,
  suggestCabinetCode,
} from '../fiches/record_id_utils';

interface AddCabinetModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingNames: string[];
  existingCodes?: string[];
  onSubmit: (data: {
    name: string;
    code: string;
    description: string;
  }) => Promise<void> | void;
}

// BOITE MODALE D'AJOUT D'UN NOUVEAU CABINET
export const AddCabinetModal: React.FC<AddCabinetModalProps> = ({
  isOpen,
  onClose,
  existingNames,
  existingCodes = [],
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [isCodeEdited, setIsCodeEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [codeError, setCodeError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setCode('');
    setIsCodeEdited(false);
    setDescription('');
    setErrorMessage('');
    setCodeError('');
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
    const trimmed = name.trim();
    if (!trimmed) {
      setErrorMessage('Le nom du cabinet est obligatoire.');
      return;
    }

    const normalized = trimmed.toLowerCase();
    const isDuplicate = existingNames.some(
      (item) => item.trim().toLowerCase() === normalized
    );
    if (isDuplicate) {
      setErrorMessage('Ce cabinet existe déjà.');
      return;
    }

    const resolvedCode = normalizeCabinetCode(code) || suggestCabinetCode(trimmed);
    if (resolvedCode.length < 2 || resolvedCode.length > 6) {
      setCodeError('Le code doit contenir entre 2 et 6 lettres.');
      return;
    }

    const isDuplicateCode = existingCodes.some(
      (item) => normalizeCabinetCode(item) === resolvedCode
    );
    if (isDuplicateCode) {
      setCodeError(`Le code ${resolvedCode} est déjà utilisé par un autre cabinet.`);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setCodeError('');
    try {
      await onSubmit({
        name: trimmed,
        code: resolvedCode,
        description: description.trim() || 'Cabinet dentaire Smilo',
      });
      onClose();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Impossible d'ajouter ce cabinet.";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="add-cabinet-modal-backdrop"
          id="add-cabinet-modal-backdrop"
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
            id="add-cabinet-modal-card"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[94dvh] sm:max-h-[90dvh] bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl shadow-xl overflow-hidden flex flex-col my-auto"
          >
            <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 sm:py-4 [@media(max-height:580px)]:py-2.5 bg-[#FFFFFF] flex-shrink-0">
              <h2 className="text-base sm:text-lg font-semibold text-[#111827]">
                Nouveau cabinet
              </h2>
              <button
                type="button"
                id="close-cabinet-modal-button"
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
                    htmlFor="field-cabinet-name"
                    className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide flex items-center"
                  >
                    Nom du cabinet
                    <span className="text-[#DC2626] ml-1">*</span>
                  </label>
                  <input
                    id="field-cabinet-name"
                    type="text"
                    value={name}
                    onChange={(e) => {
                      const nextName = e.target.value;
                      setName(nextName);
                      if (!isCodeEdited) {
                        setCode(suggestCabinetCode(nextName));
                      }
                      if (errorMessage) setErrorMessage('');
                      if (codeError) setCodeError('');
                    }}
                    placeholder="Ex : Ivandry, Analakely..."
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
                      htmlFor="field-cabinet-code"
                      className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide flex items-center"
                    >
                      Code du cabinet
                      <span className="text-[#DC2626] ml-1">*</span>
                    </label>
                    <span className="text-[11px] text-[#9CA3AF] font-normal">
                      2 à 6 lettres
                    </span>
                  </div>
                  <input
                    id="field-cabinet-code"
                    type="text"
                    value={code}
                    maxLength={6}
                    onChange={(e) => {
                      const normalizedCode = normalizeCabinetCode(e.target.value);
                      setCode(normalizedCode);
                      setIsCodeEdited(normalizedCode.length > 0);
                      if (codeError) setCodeError('');
                    }}
                    placeholder="Ex : IVA, ASB..."
                    className={`w-full h-9 sm:h-10 px-3 sm:px-3.5 bg-[#FFFFFF] border rounded-lg text-xs sm:text-sm font-medium tracking-wider uppercase text-[#111827] placeholder-[#9CA3AF] placeholder:normal-case placeholder:tracking-normal placeholder:font-normal focus:outline-none transition-colors ${
                      codeError
                        ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]'
                        : 'border-[#E5E7EB] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]'
                    }`}
                  />
                  {codeError ? (
                    <span className="text-[11px] text-[#DC2626]">{codeError}</span>
                  ) : (
                    code && (
                      <span className="text-[11px] text-[#6B7280]">
                        Aperçu identifiant patient : CAB-{code}-000001
                      </span>
                    )
                  )}
                </div>

                <div className="flex flex-col space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="field-cabinet-description"
                      className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide"
                    >
                      Description
                    </label>
                    <span className="text-[11px] text-[#9CA3AF] font-normal">
                      Facultatif
                    </span>
                  </div>
                  <input
                    id="field-cabinet-description"
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Cabinet dentaire Smilo"
                    className="w-full h-9 sm:h-10 px-3 sm:px-3.5 bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg text-xs sm:text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors"
                  />
                </div>
              </div>

              <div className="px-4 py-2.5 sm:px-6 sm:py-4 [@media(max-height:580px)]:py-2.5 flex flex-row items-center sm:justify-end gap-2 sm:gap-3 bg-[#FFFFFF] flex-shrink-0">
                <button
                  type="button"
                  id="cancel-cabinet-modal-button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="h-9 sm:h-10 px-4 flex-1 sm:flex-none sm:w-auto bg-[#FFFFFF] border border-[#D1D5DB] hover:bg-[#F3F4F6] text-[#374151] rounded-lg text-xs sm:text-sm font-medium transition-colors text-center cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  id="submit-cabinet-modal-button"
                  disabled={isSubmitting}
                  className="h-9 sm:h-10 px-4 flex-1 sm:flex-none sm:w-auto bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-[#FFFFFF] rounded-lg text-xs sm:text-sm font-medium transition-colors text-center cursor-pointer"
                >
                  {isSubmitting ? 'Ajout...' : 'Ajouter'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
