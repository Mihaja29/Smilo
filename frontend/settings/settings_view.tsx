import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../firebase/auth_context';
import {
  ArrowLeftRightIcon,
  BuildingIcon,
  CheckIcon,
  CloseIcon,
  EditIcon,
  PaletteIcon,
  PlusIcon,
  ShieldCheckIcon,
  TrashIcon,
  UserIcon,
} from '../navigation/navigation_icons';
import {
  CabinetOption,
  createCabinetApi,
  deleteCabinetApi,
  getCabinetsApi,
  getCachedCabinets,
  updateCabinetApi,
} from '../services/cabinets_api';
import { AddCabinetModal } from './add_cabinet_modal';
import { EditCabinetModal } from './edit_cabinet_modal';
import { TransferCabinetsModal } from './transfer_cabinets_modal';
import {
  MobileSettingsPage,
  MobileSettingsSubPage,
} from './mobile_settings_page';
import { AppearanceSettings } from './appearance_settings';
import { suggestCabinetCode } from '../fiches/record_id_utils';

interface SettingsViewProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTabId = 'account' | 'cabinets' | 'appearance' | 'about';

const MotionPlusIcon = motion.create(PlusIcon);

// BOITE MODALE DES PARAMETRES AVEC MENUS VERTICAUX ET LIGNES DE DETAILS
export const SettingsView: React.FC<SettingsViewProps> = ({ isOpen, onClose }) => {
  const { user, profilePhoneNumber, signOutUser, updateUserProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTabId>('account');
  const [cabinets, setCabinets] = useState<CabinetOption[]>(() => getCachedCabinets());
  const [isAddCabinetModalOpen, setIsAddCabinetModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [addIconRotation, setAddIconRotation] = useState(0);
  const [isSelectingCabinetToDelete, setIsSelectingCabinetToDelete] = useState(false);
  const [isSelectingCabinetToEdit, setIsSelectingCabinetToEdit] = useState(false);
  const [deletingCabinet, setDeletingCabinet] = useState<CabinetOption | null>(null);
  const [editingCabinet, setEditingCabinet] = useState<CabinetOption | null>(null);
  const [isDeletingCabinet, setIsDeletingCabinet] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingNameValue, setEditingNameValue] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [editingPhoneValue, setEditingPhoneValue] = useState('');
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const [mobileSubPage, setMobileSubPage] = useState<MobileSettingsSubPage>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('account');
      setMobileSubPage(null);
      setIsAddCabinetModalOpen(false);
      setIsTransferModalOpen(false);
      setIsSelectingCabinetToDelete(false);
      setIsSelectingCabinetToEdit(false);
      setDeletingCabinet(null);
      setEditingCabinet(null);
      setIsEditingName(false);
      setIsEditingPhone(false);
      getCabinetsApi()
        .then((items) => setCabinets(items))
        .catch(() => {
          setCabinets(getCachedCabinets());
        });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'Escape' &&
        isOpen &&
        !isAddCabinetModalOpen &&
        !isTransferModalOpen &&
        !deletingCabinet &&
        !editingCabinet
      ) {
        if (isEditingName) {
          setIsEditingName(false);
          return;
        }
        if (isEditingPhone) {
          setIsEditingPhone(false);
          return;
        }
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    isAddCabinetModalOpen,
    isTransferModalOpen,
    deletingCabinet,
    editingCabinet,
    isEditingName,
    isEditingPhone,
    onClose,
  ]);

  const handleSaveName = async () => {
    const trimmed = editingNameValue.trim();
    if (!trimmed || isSavingName) return;
    setIsSavingName(true);
    try {
      await updateUserProfile({ displayName: trimmed });
      setIsEditingName(false);
    } catch (error) {
      console.error('Erreur modification nom:', error);
    } finally {
      setIsSavingName(false);
    }
  };

  const sanitizePhoneInput = (value: string) => value.replace(/[^0-9/*\-+]/g, '');

  const handleSavePhone = async () => {
    if (isSavingPhone) return;
    setIsSavingPhone(true);
    try {
      await updateUserProfile({ phoneNumber: sanitizePhoneInput(editingPhoneValue) });
      setIsEditingPhone(false);
    } catch (error) {
      console.error('Erreur modification téléphone:', error);
    } finally {
      setIsSavingPhone(false);
    }
  };

  const handleCreateCabinet = async (data: {
    name: string;
    code: string;
    description: string;
  }) => {
    const created = await createCabinetApi(data);
    setCabinets((prev) => [...prev, created]);
  };

  const handleUpdateCabinet = async (
    id: string,
    data: {
      name: string;
      code: string;
      description: string;
    }
  ) => {
    const updated = await updateCabinetApi(id, data);
    setCabinets((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  };

  const handleConfirmDeleteCabinet = async () => {
    if (!deletingCabinet) return;
    setIsDeletingCabinet(true);
    try {
      await deleteCabinetApi(deletingCabinet.id);
      setCabinets((prev) => prev.filter((item) => item.id !== deletingCabinet.id));
      setDeletingCabinet(null);
    } catch (error) {
      console.error('Erreur suppression cabinet:', error);
    } finally {
      setIsDeletingCabinet(false);
    }
  };

  const menuTabs: {
    id: SettingsTabId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'account', label: 'Profil', icon: UserIcon },
    { id: 'cabinets', label: 'Cabinets', icon: BuildingIcon },
    { id: 'appearance', label: 'Apparence', icon: PaletteIcon },
    { id: 'about', label: 'Application', icon: ShieldCheckIcon },
  ];

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="settings-modal-backdrop"
            id="settings-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] flex items-stretch md:items-center justify-center p-0 md:p-6 max-md:bg-[#FFFFFF] max-md:dark:bg-[#1F1F1F] md:bg-[#111827]/40 dark:md:bg-black/60 backdrop-blur-md font-poppins overflow-hidden md:overflow-y-auto"
          >
            <motion.div
              id="settings-view-container"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full h-full md:h-auto md:max-w-3xl min-h-0 md:min-h-[420px] md:max-h-[88dvh] bg-[#FFFFFF] border-0 rounded-none md:rounded-2xl shadow-none md:shadow-xl overflow-hidden flex flex-col md:my-auto"
            >
              <MobileSettingsPage
                subPage={mobileSubPage}
                onChangeSubPage={(page) => {
                  setIsSelectingCabinetToDelete(false);
                  setIsSelectingCabinetToEdit(false);
                  setIsEditingName(false);
                  setIsEditingPhone(false);
                  setMobileSubPage(page);
                }}
                onClose={onClose}
                user={user}
                profilePhoneNumber={profilePhoneNumber}
                onSignOut={signOutUser}
                isEditingName={isEditingName}
                editingNameValue={editingNameValue}
                isSavingName={isSavingName}
                onStartEditName={() => {
                  setIsEditingPhone(false);
                  setEditingNameValue(user?.displayName || '');
                  setIsEditingName(true);
                }}
                onChangeNameValue={setEditingNameValue}
                onSaveName={handleSaveName}
                onCancelEditName={() => setIsEditingName(false)}
                isEditingPhone={isEditingPhone}
                editingPhoneValue={editingPhoneValue}
                isSavingPhone={isSavingPhone}
                onStartEditPhone={() => {
                  setIsEditingName(false);
                  setEditingPhoneValue(sanitizePhoneInput(profilePhoneNumber || ''));
                  setIsEditingPhone(true);
                }}
                onChangePhoneValue={(val) => setEditingPhoneValue(sanitizePhoneInput(val))}
                onSavePhone={handleSavePhone}
                onCancelEditPhone={() => setIsEditingPhone(false)}
                cabinets={cabinets}
                isSelectingCabinetToDelete={isSelectingCabinetToDelete}
                isSelectingCabinetToEdit={isSelectingCabinetToEdit}
                onToggleDeleteSelection={() => {
                  setIsSelectingCabinetToEdit(false);
                  if (cabinets.length === 1) {
                    setIsSelectingCabinetToDelete(false);
                    setDeletingCabinet(cabinets[0]);
                  } else {
                    setIsSelectingCabinetToDelete((prev) => !prev);
                  }
                }}
                onToggleEditSelection={() => {
                  setIsSelectingCabinetToDelete(false);
                  if (cabinets.length === 1) {
                    setIsSelectingCabinetToEdit(false);
                    setEditingCabinet(cabinets[0]);
                  } else {
                    setIsSelectingCabinetToEdit((prev) => !prev);
                  }
                }}
                onSelectCabinetToDelete={(cabinet) => {
                  setDeletingCabinet(cabinet);
                  setIsSelectingCabinetToDelete(false);
                }}
                onSelectCabinetToEdit={(cabinet) => {
                  setEditingCabinet(cabinet);
                  setIsSelectingCabinetToEdit(false);
                }}
                onOpenTransferModal={() => {
                  setIsSelectingCabinetToDelete(false);
                  setIsSelectingCabinetToEdit(false);
                  setIsTransferModalOpen(true);
                }}
                onOpenAddCabinet={() => {
                  setIsSelectingCabinetToDelete(false);
                  setIsSelectingCabinetToEdit(false);
                  setAddIconRotation((prev) => prev + 180);
                  setIsAddCabinetModalOpen(true);
                }}
              />

              <div className="hidden md:flex items-center justify-end px-5 pt-4 pb-2 flex-shrink-0">
                <button
                  type="button"
                  id="close-settings-modal-button"
                  onClick={onClose}
                  aria-label="Fermer"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[#374151] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
                >
                  <CloseIcon className="w-4 h-4 text-current" />
                </button>
              </div>

              <div className="hidden md:flex flex-1 flex-row min-h-0 px-6 pb-6 gap-8 overflow-hidden">
                <nav
                  id="settings-vertical-menu"
                  aria-label="Menus"
                  className="w-full sm:w-48 flex sm:flex-col gap-1.5 flex-shrink-0 overflow-x-auto sm:overflow-visible pb-2 sm:pb-0"
                >
                  {menuTabs.map((tab) => {
                    const Icon = tab.icon;
                    const isSelected = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        id={`settings-tab-${tab.id}`}
                        type="button"
                        onClick={() => {
                          setIsSelectingCabinetToDelete(false);
                          setIsSelectingCabinetToEdit(false);
                          setActiveTab(tab.id);
                        }}
                        className={`w-auto sm:w-full px-3.5 py-2.5 rounded-xl flex items-center gap-3 text-left text-[13px] transition-colors whitespace-nowrap sm:whitespace-normal cursor-pointer ${
                          isSelected
                            ? 'bg-[#F3F4F6] text-[#2563EB] font-semibold'
                            : 'text-[#374151] hover:bg-[#F8F9FA] hover:text-[#111827] font-medium'
                        }`}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0 text-current" />
                        <span className="truncate">{tab.label}</span>
                      </button>
                    );
                  })}
                </nav>

                <div className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 pr-1">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeTab}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                      className="w-full"
                    >
                      {activeTab === 'account' && (
                        <div className="divide-y divide-[#E5E7EB]">
                          {user ? (
                            <>
                              <div className="py-3.5 flex items-center justify-between gap-4">
                                <span className="text-[13px] font-medium text-[#374151] flex-shrink-0">
                                  Nom
                                </span>
                                {isEditingName ? (
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <input
                                      type="text"
                                      value={editingNameValue}
                                      onChange={(e) => setEditingNameValue(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          handleSaveName();
                                        }
                                      }}
                                      autoFocus
                                      placeholder="Votre nom"
                                      aria-label="Modifier le nom"
                                      className="w-40 sm:w-52 h-8 px-2.5 bg-[#FFFFFF] border border-[#D1D5DB] rounded-lg text-[13px] text-[#111827] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] font-poppins"
                                    />
                                    <button
                                      type="button"
                                      onClick={handleSaveName}
                                      disabled={isSavingName || !editingNameValue.trim()}
                                      aria-label="Enregistrer le nom"
                                      title="Enregistrer"
                                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[#2563EB] hover:bg-[#F3F4F6] disabled:opacity-40 transition-colors cursor-pointer flex-shrink-0"
                                    >
                                      <CheckIcon className="w-4 h-4 text-current" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setIsEditingName(false)}
                                      disabled={isSavingName}
                                      aria-label="Annuler"
                                      title="Annuler"
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
                                      onClick={() => {
                                        setIsEditingPhone(false);
                                        setEditingNameValue(user.displayName || '');
                                        setIsEditingName(true);
                                      }}
                                      aria-label="Modifier le nom"
                                      title="Modifier le nom"
                                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors cursor-pointer flex-shrink-0"
                                    >
                                      <EditIcon className="w-3.5 h-3.5 text-current" />
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div className="py-3.5 flex items-center justify-between gap-4">
                                <span className="text-[13px] font-medium text-[#374151] flex-shrink-0">
                                  Adresse e-mail
                                </span>
                                <span className="text-[13px] font-medium text-[#111827] truncate">
                                  {user.email || '-'}
                                </span>
                              </div>

                              <div className="py-3.5 flex items-center justify-between gap-4">
                                <span className="text-[13px] font-medium text-[#374151] flex-shrink-0">
                                  Numéro de téléphone
                                </span>
                                {isEditingPhone ? (
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <input
                                      type="tel"
                                      inputMode="tel"
                                      value={editingPhoneValue}
                                      onChange={(e) => setEditingPhoneValue(sanitizePhoneInput(e.target.value))}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          handleSavePhone();
                                        }
                                      }}
                                      autoFocus
                                      placeholder="+261340000000"
                                      aria-label="Modifier le numéro de téléphone"
                                      className="w-40 sm:w-52 h-8 px-2.5 bg-[#FFFFFF] border border-[#D1D5DB] rounded-lg text-[13px] text-[#111827] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] font-poppins"
                                    />
                                    <button
                                      type="button"
                                      onClick={handleSavePhone}
                                      disabled={isSavingPhone}
                                      aria-label="Enregistrer le numéro"
                                      title="Enregistrer"
                                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[#2563EB] hover:bg-[#F3F4F6] disabled:opacity-40 transition-colors cursor-pointer flex-shrink-0"
                                    >
                                      <CheckIcon className="w-4 h-4 text-current" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setIsEditingPhone(false)}
                                      disabled={isSavingPhone}
                                      aria-label="Annuler"
                                      title="Annuler"
                                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-[#F3F4F6] transition-colors cursor-pointer flex-shrink-0"
                                    >
                                      <CloseIcon className="w-4 h-4 text-current" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 min-w-0">
                                    {profilePhoneNumber && (
                                      <span className="text-[13px] font-medium text-[#111827] truncate">
                                        {profilePhoneNumber}
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setIsEditingName(false);
                                        setEditingPhoneValue(sanitizePhoneInput(profilePhoneNumber || ''));
                                        setIsEditingPhone(true);
                                      }}
                                      aria-label="Modifier le numéro de téléphone"
                                      title="Modifier le numéro de téléphone"
                                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors cursor-pointer flex-shrink-0"
                                    >
                                      <EditIcon className="w-3.5 h-3.5 text-current" />
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div className="py-3.5 flex items-center justify-between gap-4">
                                <span className="text-[13px] font-medium text-[#374151] flex-shrink-0">
                                  Déconnexion de la session
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    signOutUser();
                                  }}
                                  title="Déconnexion"
                                  aria-label="Déconnexion"
                                  className="px-4 py-1.5 rounded-full border border-[#FCA5A5] text-[#DC2626] hover:bg-[#FEF2F2] text-xs font-medium transition-colors cursor-pointer flex-shrink-0"
                                >
                                  Déconnexion
                                </button>
                              </div>
                            </>
                          ) : (
                            <div className="py-10 text-center space-y-2">
                              <UserIcon className="w-8 h-8 text-[#9CA3AF] mx-auto" />
                              <p className="text-xs text-[#6B7280]">
                                Aucun utilisateur connecté pour le moment.
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {activeTab === 'cabinets' && (
                        <div className="space-y-2">
                          <div className="pb-2 border-b border-[#E5E7EB] flex items-center justify-end gap-1.5">
                            {cabinets.length > 0 && (
                              <>
                                <button
                                  type="button"
                                  id="edit-cabinet-button"
                                  aria-label={
                                    isSelectingCabinetToEdit
                                      ? 'Annuler la modification'
                                      : 'Modifier un cabinet'
                                  }
                                  title={isSelectingCabinetToEdit ? 'Annuler' : 'Modifier'}
                                  onClick={() => {
                                    setIsSelectingCabinetToDelete(false);
                                    if (cabinets.length === 1) {
                                      setIsSelectingCabinetToEdit(false);
                                      setEditingCabinet(cabinets[0]);
                                    } else {
                                      setIsSelectingCabinetToEdit((prev) => !prev);
                                    }
                                  }}
                                  className={`w-9 h-9 p-0 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
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
                                  id="delete-cabinet-button"
                                  aria-label={
                                    isSelectingCabinetToDelete
                                      ? 'Annuler la suppression'
                                      : 'Supprimer un cabinet'
                                  }
                                  title={isSelectingCabinetToDelete ? 'Annuler' : 'Supprimer'}
                                  onClick={() => {
                                    setIsSelectingCabinetToEdit(false);
                                    if (cabinets.length === 1) {
                                      setIsSelectingCabinetToDelete(false);
                                      setDeletingCabinet(cabinets[0]);
                                    } else {
                                      setIsSelectingCabinetToDelete((prev) => !prev);
                                    }
                                  }}
                                  className={`w-9 h-9 p-0 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
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

                            <button
                              type="button"
                              id="transfer-cabinet-button"
                              aria-label="Réaffectation globale des patients"
                              title="Réaffectation globale"
                              onClick={() => {
                                setIsSelectingCabinetToDelete(false);
                                setIsSelectingCabinetToEdit(false);
                                setIsTransferModalOpen(true);
                              }}
                              className="w-9 h-9 p-0 rounded-lg bg-[#FFFFFF] hover:bg-[#F3F4F6] text-[#374151] flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <ArrowLeftRightIcon className="w-4 h-4 text-current" />
                            </button>

                            <button
                              type="button"
                              id="add-cabinet-button"
                              aria-label="Ajouter"
                              title="Ajouter"
                              onClick={() => {
                                setIsSelectingCabinetToDelete(false);
                                setIsSelectingCabinetToEdit(false);
                                setAddIconRotation((prev) => prev + 180);
                                setIsAddCabinetModalOpen(true);
                              }}
                              className="w-8 h-10 sm:w-auto sm:px-3 p-0 sm:py-0 bg-[#FFFFFF] hover:bg-[#F8F9FA] text-[#374151] rounded-xl text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 transition-colors font-poppins flex-shrink-0 cursor-pointer focus:outline-none"
                            >
                              <MotionPlusIcon
                                className="w-4.5 h-4.5 text-current flex-shrink-0"
                                strokeWidth={2.5}
                                animate={{ rotate: addIconRotation }}
                                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                              />
                              <span className="hidden sm:inline">Ajouter</span>
                            </button>
                          </div>

                          {cabinets.length > 0 ? (
                            <div className="divide-y divide-[#E5E7EB]">
                              {cabinets.map((cabinet) => (
                                <div
                                  key={cabinet.id}
                                  onClick={() => {
                                    if (isSelectingCabinetToDelete) {
                                      setDeletingCabinet(cabinet);
                                      setIsSelectingCabinetToDelete(false);
                                    } else if (isSelectingCabinetToEdit) {
                                      setEditingCabinet(cabinet);
                                      setIsSelectingCabinetToEdit(false);
                                    }
                                  }}
                                  className={`py-3.5 px-2 rounded-lg flex items-center justify-between gap-4 transition-colors ${
                                    isSelectingCabinetToDelete
                                      ? 'hover:bg-[#FEF2F2] cursor-pointer'
                                      : isSelectingCabinetToEdit
                                      ? 'hover:bg-[#EFF6FF] cursor-pointer'
                                      : ''
                                  }`}
                                >
                                  <span className="text-[13px] font-medium text-[#111827]">
                                    {cabinet.name}
                                  </span>
                                  <span className="text-xs font-medium text-[#6B7280] flex-shrink-0">
                                    {cabinet.code || suggestCabinetCode(cabinet.name)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="py-10 text-center space-y-2">
                              <BuildingIcon className="w-8 h-8 text-[#9CA3AF] mx-auto" />
                              <p className="text-xs text-[#6B7280]">
                                Aucun cabinet enregistré.
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {activeTab === 'appearance' && <AppearanceSettings />}

                      {activeTab === 'about' && (
                        <div className="divide-y divide-[#E5E7EB]">
                          <div className="py-3.5 flex items-center justify-between gap-4">
                            <span className="text-[13px] font-medium text-[#374151]">
                              Application
                            </span>
                            <span className="text-[13px] font-medium text-[#111827]">
                              Smilo
                            </span>
                          </div>
                          <div className="py-3.5 flex items-center justify-between gap-4">
                            <span className="text-[13px] font-medium text-[#374151]">
                              Version de l'application
                            </span>
                            <span className="text-[13px] font-medium text-[#111827]">
                              beta-v0.0.5
                            </span>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AddCabinetModal
        isOpen={isAddCabinetModalOpen}
        onClose={() => setIsAddCabinetModalOpen(false)}
        existingNames={cabinets.map((c) => c.name)}
        existingCodes={cabinets.map((c) => c.code || suggestCabinetCode(c.name))}
        onSubmit={handleCreateCabinet}
      />

      <EditCabinetModal
        isOpen={Boolean(editingCabinet)}
        cabinet={editingCabinet}
        onClose={() => setEditingCabinet(null)}
        existingNames={cabinets
          .filter((c) => c.id !== editingCabinet?.id)
          .map((c) => c.name)}
        existingCodes={cabinets
          .filter((c) => c.id !== editingCabinet?.id)
          .map((c) => c.code || suggestCabinetCode(c.name))}
        onSubmit={handleUpdateCabinet}
      />

      <TransferCabinetsModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        cabinets={cabinets}
      />

      <AnimatePresence>
        {deletingCabinet && (
          <motion.div
            key="delete-cabinet-confirm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/40 font-poppins"
            onClick={() => {
              if (!isDeletingCabinet) setDeletingCabinet(null);
            }}
          >
            <motion.div
              key="delete-cabinet-confirm-card"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-md max-h-[94dvh] overflow-y-auto bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl shadow-xl p-4 sm:p-6 flex flex-col space-y-3 sm:space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-semibold text-[#111827]">
                Supprimer le cabinet
              </h3>
              <p className="text-xs sm:text-sm text-[#374151] leading-relaxed">
                Êtes-vous sûr de vouloir supprimer le cabinet {deletingCabinet.name} ? Cette action est irréversible.
              </p>
              <div className="pt-3 flex flex-row items-center sm:justify-end gap-2 sm:gap-2.5">
                <button
                  type="button"
                  disabled={isDeletingCabinet}
                  onClick={() => setDeletingCabinet(null)}
                  className="h-9 sm:h-10 px-4 flex-1 sm:flex-none sm:w-auto bg-[#FFFFFF] border border-[#D1D5DB] hover:bg-[#F3F4F6] text-[#374151] rounded-lg text-xs sm:text-sm font-medium transition-colors text-center cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={isDeletingCabinet}
                  onClick={handleConfirmDeleteCabinet}
                  className="h-9 sm:h-10 px-4 flex-1 sm:flex-none sm:w-auto bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-60 text-[#FFFFFF] rounded-lg text-xs sm:text-sm font-medium transition-colors text-center cursor-pointer"
                >
                  {isDeletingCabinet ? 'Suppression...' : 'Supprimer'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
