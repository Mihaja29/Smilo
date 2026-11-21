import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeftRightIcon,
  BuildingIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  EditIcon,
  InfoIcon,
  LogOutIcon,
  PaletteIcon,
  PlusIcon,
  ShieldCheckIcon,
  TrashIcon,
  UserIcon,
} from '../navigation/navigation_icons';
import { CabinetOption } from '../services/cabinets_api';
import { suggestCabinetCode } from '../fiches/record_id_utils';
import { useTheme } from '../services/theme_context';
import { AppearanceSettings } from './appearance_settings';

export type MobileSettingsSubPage = 'account' | 'cabinets' | 'appearance' | null;

interface MobileSettingsPageProps {
  subPage: MobileSettingsSubPage;
  onChangeSubPage: (page: MobileSettingsSubPage) => void;
  onClose: () => void;
  user: { displayName?: string | null; email?: string | null } | null;
  profilePhoneNumber: string;
  onSignOut: () => void;
  isEditingName: boolean;
  editingNameValue: string;
  isSavingName: boolean;
  onStartEditName: () => void;
  onChangeNameValue: (value: string) => void;
  onSaveName: () => void;
  onCancelEditName: () => void;
  isEditingPhone: boolean;
  editingPhoneValue: string;
  isSavingPhone: boolean;
  onStartEditPhone: () => void;
  onChangePhoneValue: (value: string) => void;
  onSavePhone: () => void;
  onCancelEditPhone: () => void;
  cabinets: CabinetOption[];
  isSelectingCabinetToDelete: boolean;
  isSelectingCabinetToEdit: boolean;
  onToggleDeleteSelection: () => void;
  onToggleEditSelection: () => void;
  onSelectCabinetToDelete: (cabinet: CabinetOption) => void;
  onSelectCabinetToEdit: (cabinet: CabinetOption) => void;
  onOpenTransferModal: () => void;
  onOpenAddCabinet: () => void;
}

const MotionPlusIcon = motion.create(PlusIcon);
const MotionArrowLeftRightIcon = motion.create(ArrowLeftRightIcon);

// VUE MOBILE PLEINE PAGE DES PARAMETRES AVEC NAVIGATION PAR SECTIONS
export const MobileSettingsPage: React.FC<MobileSettingsPageProps> = ({
  subPage,
  onChangeSubPage,
  onClose,
  user,
  profilePhoneNumber,
  onSignOut,
  isEditingName,
  editingNameValue,
  isSavingName,
  onStartEditName,
  onChangeNameValue,
  onSaveName,
  onCancelEditName,
  isEditingPhone,
  editingPhoneValue,
  isSavingPhone,
  onStartEditPhone,
  onChangePhoneValue,
  onSavePhone,
  onCancelEditPhone,
  cabinets,
  isSelectingCabinetToDelete,
  isSelectingCabinetToEdit,
  onToggleDeleteSelection,
  onToggleEditSelection,
  onSelectCabinetToDelete,
  onSelectCabinetToEdit,
  onOpenTransferModal,
  onOpenAddCabinet,
}) => {
  const { themePreference } = useTheme();
  const [transferIconRotation, setTransferIconRotation] = useState(0);
  const [addIconRotation, setAddIconRotation] = useState(0);

  const themeSummaryLabel =
    themePreference === 'dark'
      ? 'Sombre'
      : themePreference === 'light'
      ? 'Clair'
      : 'Système';

  const headerTitle =
    subPage === 'account'
      ? 'Paramètres du compte'
      : subPage === 'cabinets'
      ? 'Cabinets'
      : subPage === 'appearance'
      ? 'Apparence'
      : 'Paramètres';

  const handleBack = () => {
    if (subPage) {
      onChangeSubPage(null);
      return;
    }
    onClose();
  };

  return (
    <div
      id="mobile-settings-page"
      className="flex md:hidden flex-col w-full h-full bg-[#FFFFFF] font-poppins"
    >
      <div className="h-14 px-4 flex items-center justify-between flex-shrink-0 border-b border-[#E5E7EB]">
        <button
          type="button"
          id="mobile-settings-back-button"
          onClick={handleBack}
          aria-label="Retour"
          className="w-9 h-9 rounded-full bg-[#F8F9FA] border border-[#E5E7EB] flex items-center justify-center text-[#111827] hover:bg-[#F3F4F6] transition-colors cursor-pointer flex-shrink-0"
        >
          <ChevronLeftIcon className="w-5 h-5 text-current" />
        </button>

        <h1 className="text-[15px] font-semibold text-[#111827] truncate px-2">
          {headerTitle}
        </h1>

        <div className="w-9 flex-shrink-0" />
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-5">
        <AnimatePresence mode="wait">
          {subPage === null && (
            <motion.div
              key="mobile-settings-main"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-5 pb-4"
            >
              <div>
                <p className="text-xs font-medium text-[#6B7280] px-2 mb-2">
                  Profil
                </p>
                <div className="bg-[#F8F9FA] border border-[#E5E7EB] rounded-2xl overflow-hidden divide-y divide-[#E5E7EB]">
                  <button
                    type="button"
                    id="mobile-settings-account-row"
                    onClick={() => onChangeSubPage('account')}
                    className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-[#F3F4F6] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <UserIcon className="w-4.5 h-4.5 text-[#374151] flex-shrink-0" />
                      <span className="text-[13px] font-medium text-[#111827] truncate">
                        Paramètres du compte
                      </span>
                    </div>
                    <div className="flex items-center gap-2 min-w-0 flex-shrink-0 max-w-[42%]">
                      <span className="text-xs text-[#6B7280] truncate">
                        {user?.displayName || user?.email || ''}
                      </span>
                      <ChevronRightIcon className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-[#6B7280] px-2 mb-2">
                  Cabinets
                </p>
                <div className="bg-[#F8F9FA] border border-[#E5E7EB] rounded-2xl overflow-hidden divide-y divide-[#E5E7EB]">
                  <button
                    type="button"
                    id="mobile-settings-cabinets-row"
                    onClick={() => onChangeSubPage('cabinets')}
                    className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-[#F3F4F6] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <BuildingIcon className="w-4.5 h-4.5 text-[#374151] flex-shrink-0" />
                      <span className="text-[13px] font-medium text-[#111827] truncate">
                        Gestion des cabinets
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-[#6B7280]">
                        {cabinets.length}
                      </span>
                      <ChevronRightIcon className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-[#6B7280] px-2 mb-2">
                  Apparence
                </p>
                <div className="bg-[#F8F9FA] border border-[#E5E7EB] rounded-2xl overflow-hidden divide-y divide-[#E5E7EB]">
                  <button
                    type="button"
                    id="mobile-settings-appearance-row"
                    onClick={() => onChangeSubPage('appearance')}
                    className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-[#F3F4F6] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <PaletteIcon className="w-4.5 h-4.5 text-[#374151] flex-shrink-0" />
                      <span className="text-[13px] font-medium text-[#111827] truncate">
                        Apparence
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-[#6B7280]">
                        {themeSummaryLabel}
                      </span>
                      <ChevronRightIcon className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-[#6B7280] px-2 mb-2">
                  À propos
                </p>
                <div className="bg-[#F8F9FA] border border-[#E5E7EB] rounded-2xl overflow-hidden divide-y divide-[#E5E7EB]">
                  <div className="w-full px-4 py-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <ShieldCheckIcon className="w-4.5 h-4.5 text-[#374151] flex-shrink-0" />
                      <span className="text-[13px] font-medium text-[#111827]">
                        Application
                      </span>
                    </div>
                    <span className="text-xs font-medium text-[#6B7280]">
                      Smilo
                    </span>
                  </div>
                  <div className="w-full px-4 py-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <InfoIcon className="w-4.5 h-4.5 text-[#374151] flex-shrink-0" />
                      <span className="text-[13px] font-medium text-[#111827]">
                        Version de l'application
                      </span>
                    </div>
                    <span className="text-xs font-medium text-[#6B7280]">
                      beta-v0.0.5
                    </span>
                  </div>
                </div>
              </div>

              {user && (
                <div className="pt-1">
                  <div className="bg-[#F8F9FA] border border-[#E5E7EB] rounded-2xl overflow-hidden">
                    <button
                      type="button"
                      id="mobile-settings-logout-button"
                      onClick={() => {
                        onClose();
                        onSignOut();
                      }}
                      className="w-full px-4 py-3.5 flex items-center gap-3 text-left text-[#DC2626] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
                    >
                      <LogOutIcon className="w-4.5 h-4.5 text-current flex-shrink-0" />
                      <span className="text-[13px] font-medium">
                        Déconnexion
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {subPage === 'account' && (
            <motion.div
              key="mobile-settings-account"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-4"
            >
              {user ? (
                <div className="divide-y divide-[#E5E7EB]">
                  <div className="py-3.5 flex items-center justify-between gap-3">
                    <span className="text-[13px] font-medium text-[#374151] flex-shrink-0">
                      Nom
                    </span>
                    {isEditingName ? (
                      <div className="flex items-center gap-1 min-w-0 flex-1 justify-end">
                        <input
                          type="text"
                          value={editingNameValue}
                          onChange={(e) => onChangeNameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              onSaveName();
                            }
                          }}
                          autoFocus
                          placeholder="Votre nom"
                          aria-label="Modifier le nom"
                          className="w-full max-w-[170px] h-8 px-2.5 bg-[#FFFFFF] border border-[#D1D5DB] rounded-lg text-[13px] text-[#111827] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] font-poppins"
                        />
                        <button
                          type="button"
                          onClick={onSaveName}
                          disabled={isSavingName || !editingNameValue.trim()}
                          aria-label="Enregistrer le nom"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#2563EB] hover:bg-[#F3F4F6] disabled:opacity-40 transition-colors cursor-pointer flex-shrink-0"
                        >
                          <CheckIcon className="w-4 h-4 text-current" />
                        </button>
                        <button
                          type="button"
                          onClick={onCancelEditName}
                          disabled={isSavingName}
                          aria-label="Annuler"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-[#F3F4F6] transition-colors cursor-pointer flex-shrink-0"
                        >
                          <CloseIcon className="w-4 h-4 text-current" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[13px] font-medium text-[#111827] truncate">
                          {user.displayName || '-'}
                        </span>
                        <button
                          type="button"
                          onClick={onStartEditName}
                          aria-label="Modifier le nom"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors cursor-pointer flex-shrink-0"
                        >
                          <EditIcon className="w-3.5 h-3.5 text-current" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="py-3.5 flex items-center justify-between gap-3">
                    <span className="text-[13px] font-medium text-[#374151] flex-shrink-0">
                      Adresse e-mail
                    </span>
                    <span className="text-[13px] font-medium text-[#111827] truncate">
                      {user.email || '-'}
                    </span>
                  </div>

                  <div className="py-3.5 flex items-center justify-between gap-3">
                    <span className="text-[13px] font-medium text-[#374151] flex-shrink-0">
                      Téléphone
                    </span>
                    {isEditingPhone ? (
                      <div className="flex items-center gap-1 min-w-0 flex-1 justify-end">
                        <input
                          type="tel"
                          inputMode="tel"
                          value={editingPhoneValue}
                          onChange={(e) => onChangePhoneValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              onSavePhone();
                            }
                          }}
                          autoFocus
                          placeholder="+261340000000"
                          aria-label="Modifier le numéro de téléphone"
                          className="w-full max-w-[170px] h-8 px-2.5 bg-[#FFFFFF] border border-[#D1D5DB] rounded-lg text-[13px] text-[#111827] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] font-poppins"
                        />
                        <button
                          type="button"
                          onClick={onSavePhone}
                          disabled={isSavingPhone}
                          aria-label="Enregistrer le numéro"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#2563EB] hover:bg-[#F3F4F6] disabled:opacity-40 transition-colors cursor-pointer flex-shrink-0"
                        >
                          <CheckIcon className="w-4 h-4 text-current" />
                        </button>
                        <button
                          type="button"
                          onClick={onCancelEditPhone}
                          disabled={isSavingPhone}
                          aria-label="Annuler"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-[#F3F4F6] transition-colors cursor-pointer flex-shrink-0"
                        >
                          <CloseIcon className="w-4 h-4 text-current" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[13px] font-medium text-[#111827] truncate">
                          {profilePhoneNumber || '-'}
                        </span>
                        <button
                          type="button"
                          onClick={onStartEditPhone}
                          aria-label="Modifier le numéro de téléphone"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors cursor-pointer flex-shrink-0"
                        >
                          <EditIcon className="w-3.5 h-3.5 text-current" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-[#F8F9FA] border border-[#E5E7EB] rounded-2xl py-10 text-center space-y-2">
                  <UserIcon className="w-8 h-8 text-[#9CA3AF] mx-auto" />
                  <p className="text-xs text-[#6B7280]">
                    Aucun utilisateur connecté pour le moment.
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {subPage === 'cabinets' && (
            <motion.div
              key="mobile-settings-cabinets"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-2"
            >
              <div className="pb-2 border-b border-[#E5E7EB] flex items-center justify-end gap-1.5">
                {cabinets.length > 0 && (
                  <>
                    <button
                      type="button"
                      id="mobile-edit-cabinet-button"
                      onClick={onToggleEditSelection}
                      aria-label={
                        isSelectingCabinetToEdit
                          ? 'Annuler la modification'
                          : 'Modifier un cabinet'
                      }
                      title={isSelectingCabinetToEdit ? 'Annuler' : 'Modifier'}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                        isSelectingCabinetToEdit
                          ? 'bg-transparent hover:bg-[#F3F4F6] text-[#2563EB]'
                          : 'bg-[#FFFFFF] hover:bg-[#F3F4F6] text-[#374151]'
                      }`}
                    >
                      {isSelectingCabinetToEdit ? (
                        <CloseIcon className="w-4 h-4 text-current" />
                      ) : (
                        <EditIcon className="w-4 h-4 text-current" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={onToggleDeleteSelection}
                      aria-label={
                        isSelectingCabinetToDelete
                          ? 'Annuler la suppression'
                          : 'Supprimer un cabinet'
                      }
                      className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                        isSelectingCabinetToDelete
                          ? 'bg-transparent hover:bg-[#F3F4F6] text-[#DC2626]'
                          : 'bg-[#FFFFFF] hover:bg-[#F3F4F6] text-[#374151]'
                      }`}
                    >
                      {isSelectingCabinetToDelete ? (
                        <CloseIcon className="w-4 h-4 text-current" />
                      ) : (
                        <TrashIcon className="w-4 h-4 text-current" />
                      )}
                    </button>
                  </>
                )}
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    setTransferIconRotation((prev) => prev + 180);
                    onOpenTransferModal();
                  }}
                  aria-label="Réaffectation globale des patients"
                  title="Réaffectation globale"
                  className="w-9 h-9 rounded-lg bg-[#FFFFFF] hover:bg-[#F3F4F6] flex items-center justify-center text-[#374151] transition-colors cursor-pointer"
                >
                  <MotionArrowLeftRightIcon
                    className="w-4 h-4 text-current"
                    animate={{ rotate: transferIconRotation }}
                    transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                  />
                </motion.button>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    setAddIconRotation((prev) => prev + 180);
                    onOpenAddCabinet();
                  }}
                  aria-label="Ajouter un cabinet"
                  className="w-9 h-9 rounded-lg bg-[#FFFFFF] hover:bg-[#F3F4F6] flex items-center justify-center text-[#374151] transition-colors cursor-pointer"
                >
                  <MotionPlusIcon
                    className="w-4 h-4 text-current"
                    animate={{ rotate: addIconRotation }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  />
                </motion.button>
              </div>

              {isSelectingCabinetToDelete && cabinets.length > 0 && (
                <p className="text-xs text-[#DC2626] px-2">
                  Sélectionnez un cabinet à supprimer.
                </p>
              )}

              {cabinets.length > 0 ? (
                <div className="divide-y divide-[#E5E7EB]">
                  {cabinets.map((cabinet) => (
                    <div
                      key={cabinet.id}
                      onClick={() => {
                        if (isSelectingCabinetToDelete) {
                          onSelectCabinetToDelete(cabinet);
                        } else if (isSelectingCabinetToEdit) {
                          onSelectCabinetToEdit(cabinet);
                        }
                      }}
                      className={`px-4 py-3.5 flex items-center justify-between gap-3 transition-colors ${
                        isSelectingCabinetToDelete
                          ? 'hover:bg-[#FEF2F2] cursor-pointer'
                          : isSelectingCabinetToEdit
                          ? 'hover:bg-[#EFF6FF] cursor-pointer'
                          : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-[13px] font-medium text-[#111827] truncate">
                          {cabinet.name}
                        </span>
                      </div>
                      {isSelectingCabinetToDelete ? (
                        <TrashIcon className="w-4 h-4 text-[#DC2626] flex-shrink-0" />
                      ) : (
                        <span className="text-xs font-medium text-[#6B7280] flex-shrink-0">
                          {cabinet.code || suggestCabinetCode(cabinet.name)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-[#F8F9FA] border border-[#E5E7EB] rounded-2xl py-10 text-center space-y-2">
                  <BuildingIcon className="w-8 h-8 text-[#9CA3AF] mx-auto" />
                  <p className="text-xs text-[#6B7280]">
                    Aucun cabinet enregistré.
                  </p>
                </div>
              )}
            </motion.div>
          )}
          {subPage === 'appearance' && (
            <motion.div
              key="mobile-settings-appearance"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-4"
            >
              <AppearanceSettings />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
