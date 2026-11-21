import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  SearchIcon,
  FilterIcon,
  ArrowRightIcon,
  PlusIcon,
  TrashIcon,
  EyeIcon,
  EyeOffIcon,
  CloseIcon,
} from '../navigation/navigation_icons';
import {
  ProsthesesFilterMenu,
  ProsthesesFilterSortOption,
} from './prostheses_filter_menu';
import {
  ProsthesesVisibilityMenu,
  ProsthesisProcessingStatus,
} from './prostheses_visibility_menu';
import {
  ProsthesesTrashView,
  ProsthesisTrashItem,
} from './prostheses_trash_view';
import { AddProsthesisModal, ProsthesisFormData } from './add_prosthesis_modal';
import { ProsthesesList } from './prostheses_list';
import {
  ProsthesisRecord,
  getCachedProstheses,
  setCachedProstheses,
} from './prostheses_types';
import {
  getProsthesesApi,
  createProsthesisApi,
  updateProsthesisApi,
  updateProsthesisStatusApi,
  deleteProsthesisApi,
  restoreProsthesisApi,
  deleteProsthesisPermanentlyApi,
  emptyProsthesisTrashApi,
  getSyncedProsthesisIds,
  markProsthesisIdsSynced,
  PROTHESES_UPDATED_EVENT,
} from '../services/protheses_api';
import { useAuth } from '../firebase/auth_context';
import { useCabinets } from '../services/cabinets_api';

const MotionPlusIcon = motion.create(PlusIcon);

const normalizeSearchText = (value?: string): string =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const dedupeProstheses = (items: ProsthesisRecord[]): ProsthesisRecord[] => {
  const seen = new Set<string>();
  const result: ProsthesisRecord[] = [];
  for (const item of items) {
    if (item?.id && !seen.has(item.id)) {
      seen.add(item.id);
      result.push(item);
    }
  }
  return result;
};

// PAGE PROTHESES DENTAIRES
export const ProsthesesView: React.FC = () => {
  const { user } = useAuth();
  const [allProstheses, setAllProstheses] = useState<ProsthesisRecord[]>(() =>
    getCachedProstheses()
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [addIconRotation, setAddIconRotation] = useState(0);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [filterAnchorRect, setFilterAnchorRect] = useState<DOMRect | null>(null);
  const [currentSort, setCurrentSort] =
    useState<ProsthesesFilterSortOption>('none');
  const [isVisibilityMenuOpen, setIsVisibilityMenuOpen] = useState(false);
  const [visibilityAnchorRect, setVisibilityAnchorRect] =
    useState<DOMRect | null>(null);
  const [hiddenStatuses, setHiddenStatuses] = useState<
    ProsthesisProcessingStatus[]
  >([]);
  const [hiddenCabinets, setHiddenCabinets] = useState<string[]>([]);
  const { cabinets: availableCabinets, refreshCabinets } = useCabinets();

  const updateProsthesesState = useCallback(
    (updater: (prev: ProsthesisRecord[]) => ProsthesisRecord[]) => {
      setAllProstheses((prev) => {
        const next = dedupeProstheses(updater(prev));
        setCachedProstheses(next);
        return next;
      });
    },
    []
  );

  const refreshProstheses = useCallback(async () => {
    const localBeforeFetch = getCachedProstheses();
    const syncedIds = getSyncedProsthesisIds();

    const [activeItems, trashedItems] = await Promise.all([
      getProsthesesApi(false),
      getProsthesesApi(true),
    ]);

    const serverMap = new Map<string, ProsthesisRecord>();
    for (const item of activeItems) {
      serverMap.set(item.id, { ...item, deleted: false });
    }
    for (const item of trashedItems) {
      serverMap.set(item.id, { ...item, deleted: true });
    }

    markProsthesisIdsSynced(Array.from(serverMap.keys()));

    const unmigratedLocal = localBeforeFetch.filter(
      (localItem) =>
        localItem?.id &&
        !serverMap.has(localItem.id) &&
        !syncedIds.has(localItem.id)
    );

    for (const localItem of unmigratedLocal) {
      try {
        const created = await createProsthesisApi({
          id: localItem.id,
          cabinetDentaire: localItem.cabinetDentaire,
          patientNomPrenom: localItem.patientNomPrenom,
          patientContact: localItem.patientContact || '',
          numeroDentaire: localItem.numeroDentaire,
          typeProthese: localItem.typeProthese,
          teinteProthese: localItem.teinteProthese || '',
          nomLaboratoire: localItem.nomLaboratoire,
          nomCreateurProthese: localItem.nomCreateurProthese || '',
          dateEnvoi: localItem.dateEnvoi,
          dateLivraison: localItem.dateLivraison || '',
          montant: localItem.montant,
          etatTraitement: localItem.etatTraitement,
          deleted: Boolean(localItem.deleted),
          deletedAt: localItem.deletedAt,
          createdAt: localItem.createdAt,
          updatedAt: localItem.updatedAt,
        });
        serverMap.set(created.id, created);
      } catch (err) {
        console.warn('Erreur migration prothese locale:', err);
      }
    }

    const merged = dedupeProstheses(Array.from(serverMap.values()));
    setAllProstheses(merged);
    setCachedProstheses(merged);
  }, []);

  useEffect(() => {
    const loadAll = () => {
      refreshProstheses().catch((err) => {
        console.warn('Erreur chargement des protheses dentaires:', err);
      });
      refreshCabinets().catch(() => {
        // Utilisation du cache local
      });
    };
    loadAll();
    window.addEventListener(PROTHESES_UPDATED_EVENT, loadAll);
    return () => {
      window.removeEventListener(PROTHESES_UPDATED_EVENT, loadAll);
    };
  }, [refreshProstheses, refreshCabinets, user?.uid]);

  const activeProstheses = useMemo(
    () => allProstheses.filter((item) => !item.deleted),
    [allProstheses]
  );

  const trashItems: ProsthesisTrashItem[] = useMemo(
    () =>
      allProstheses
        .filter((item) => Boolean(item.deleted))
        .map((item) => ({
          id: item.id,
          patientNomPrenom: item.patientNomPrenom,
          typeProthese: item.typeProthese,
          cabinetDentaire: item.cabinetDentaire,
          deletedAt: item.deletedAt,
        })),
    [allProstheses]
  );

  const cabinetOptions = useMemo(() => {
    const names = availableCabinets.map((c) => c.name);
    const knownLower = new Set(names.map((n) => n.toLowerCase()));
    const extras: string[] = [];
    for (const item of activeProstheses) {
      const name = (item.cabinetDentaire || '').trim();
      if (name && !knownLower.has(name.toLowerCase())) {
        knownLower.add(name.toLowerCase());
        extras.push(name);
      }
    }
    return [...names, ...extras];
  }, [availableCabinets, activeProstheses]);

  const isAnyStatusHidden = hiddenStatuses.length > 0;
  const isAnyCabinetHidden = hiddenCabinets.length > 0;
  const isAnyVisibilityHidden = isAnyStatusHidden || isAnyCabinetHidden;
  const areAllStatusesHidden =
    hiddenStatuses.includes('En cours') && hiddenStatuses.includes('Terminer');
  const areAllCabinetsHidden =
    cabinetOptions.length > 0 &&
    cabinetOptions.every((cabinet) => hiddenCabinets.includes(cabinet));
  const areAllItemsHidden = areAllStatusesHidden && (cabinetOptions.length === 0 || areAllCabinetsHidden);

  const statusVisibilityBadgeText = useMemo(() => {
    if (!isAnyStatusHidden) return '';
    if (areAllStatusesHidden) return 'Tous les états masqués';
    if (hiddenStatuses.includes('En cours')) return 'Terminer uniquement';
    return 'En cours uniquement';
  }, [isAnyStatusHidden, areAllStatusesHidden, hiddenStatuses]);

  const cabinetVisibilityBadgeText = useMemo(() => {
    if (!isAnyCabinetHidden) return '';
    if (areAllCabinetsHidden) return 'Cabinets masqués';
    const visibleCabinets = cabinetOptions.filter(
      (cabinet) => !hiddenCabinets.includes(cabinet)
    );
    if (visibleCabinets.length === 1) {
      return `${visibleCabinets[0]} uniquement`;
    }
    return `${visibleCabinets.length} cabinets affichés`;
  }, [isAnyCabinetHidden, areAllCabinetsHidden, cabinetOptions, hiddenCabinets]);

  const filteredProstheses = useMemo(() => {
    const query = normalizeSearchText(searchQuery);
    const hiddenStatusSet = new Set(hiddenStatuses);
    const hiddenCabinetSet = new Set(hiddenCabinets);

    const visible = activeProstheses.filter((item) => {
      const status: ProsthesisProcessingStatus =
        item.etatTraitement === 'Terminer' ? 'Terminer' : 'En cours';
      if (hiddenStatusSet.has(status)) return false;
      if (item.cabinetDentaire && hiddenCabinetSet.has(item.cabinetDentaire)) {
        return false;
      }
      if (!query) return true;
      return (
        normalizeSearchText(item.patientNomPrenom).includes(query) ||
        normalizeSearchText(item.montant).includes(query) ||
        normalizeSearchText(item.typeProthese).includes(query) ||
        normalizeSearchText(item.nomLaboratoire).includes(query)
      );
    });

    if (currentSort === 'name_asc') {
      return [...visible].sort((a, b) =>
        (a.patientNomPrenom || '').localeCompare(b.patientNomPrenom || '', 'fr', {
          sensitivity: 'base',
        })
      );
    }
    if (currentSort === 'name_desc') {
      return [...visible].sort((a, b) =>
        (b.patientNomPrenom || '').localeCompare(a.patientNomPrenom || '', 'fr', {
          sensitivity: 'base',
        })
      );
    }
    if (currentSort === 'newest') {
      return [...visible].sort((a, b) =>
        (b.createdAt || '').localeCompare(a.createdAt || '')
      );
    }
    if (currentSort === 'oldest') {
      return [...visible].sort((a, b) =>
        (a.createdAt || '').localeCompare(b.createdAt || '')
      );
    }
    return visible;
  }, [
    activeProstheses,
    searchQuery,
    hiddenStatuses,
    hiddenCabinets,
    currentSort,
  ]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const handleAddProsthesis = async (data: ProsthesisFormData) => {
    try {
      const created = await createProsthesisApi(data);
      updateProsthesesState((prev) => [created, ...prev]);
    } catch (error) {
      console.warn('Erreur ajout prothese API, sauvegarde locale:', error);
      const now = new Date().toISOString();
      const fallbackRecord: ProsthesisRecord = {
        ...data,
        id: `proth_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        etatTraitement: 'En cours',
        deleted: false,
        createdAt: now,
        updatedAt: now,
      };
      updateProsthesesState((prev) => [fallbackRecord, ...prev]);
    }
  };

  const handleUpdateProsthesis = async (id: string, data: ProsthesisFormData) => {
    const now = new Date().toISOString();
    updateProsthesesState((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, ...data, updatedAt: now } : item
      )
    );
    try {
      const updated = await updateProsthesisApi(id, data);
      updateProsthesesState((prev) =>
        prev.map((item) => (item.id === id ? updated : item))
      );
    } catch (error) {
      console.warn('Erreur mise a jour prothese API:', error);
    }
  };

  const handleUpdateStatus = async (
    id: string,
    etatTraitement: ProsthesisProcessingStatus
  ) => {
    const now = new Date().toISOString();
    updateProsthesesState((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, etatTraitement, updatedAt: now } : item
      )
    );
    try {
      const updated = await updateProsthesisStatusApi(id, etatTraitement);
      updateProsthesesState((prev) =>
        prev.map((item) => (item.id === id ? updated : item))
      );
    } catch (error) {
      console.warn('Erreur mise a jour statut prothese API:', error);
    }
  };

  const handleMoveToTrash = async (id: string) => {
    const now = new Date().toISOString();
    updateProsthesesState((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, deleted: true, deletedAt: now, updatedAt: now }
          : item
      )
    );
    try {
      await deleteProsthesisApi(id);
    } catch (error) {
      console.warn('Erreur mise en corbeille prothese API:', error);
    }
  };

  const handleRestoreTrashItem = async (id: string) => {
    const now = new Date().toISOString();
    updateProsthesesState((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, deleted: false, deletedAt: undefined, updatedAt: now }
          : item
      )
    );
    try {
      const restored = await restoreProsthesisApi(id);
      updateProsthesesState((prev) =>
        prev.map((item) => (item.id === id ? restored : item))
      );
    } catch (error) {
      console.warn('Erreur restauration prothese API:', error);
    }
  };

  const handleDeleteTrashPermanent = async (id: string) => {
    updateProsthesesState((prev) => prev.filter((item) => item.id !== id));
    try {
      await deleteProsthesisPermanentlyApi(id);
    } catch (error) {
      console.warn('Erreur suppression definitive prothese API:', error);
    }
  };

  const handleEmptyTrash = async () => {
    updateProsthesesState((prev) => prev.filter((item) => !item.deleted));
    try {
      await emptyProsthesisTrashApi();
    } catch (error) {
      console.warn('Erreur vidage corbeille protheses API:', error);
    }
  };

  return (
    <div id="prostheses-page" className="w-full font-poppins">
      <AnimatePresence mode="wait" initial={false}>
        {isTrashOpen ? (
          <motion.div
            key="prostheses-trash-view"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-full"
          >
            <ProsthesesTrashView
              trashItems={trashItems}
              onBack={() => setIsTrashOpen(false)}
              onRestore={handleRestoreTrashItem}
              onDeletePermanent={handleDeleteTrashPermanent}
              onEmptyTrash={handleEmptyTrash}
            />
          </motion.div>
        ) : (
          <motion.div
            key="prostheses-list-view"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-full flex flex-col space-y-4"
          >
            <div
              id="prostheses-search-filter-bar"
              className="flex flex-row items-center gap-1 sm:gap-1.5 w-full"
            >
              <form
                id="prostheses-search-form"
                onSubmit={handleSearchSubmit}
                className="relative flex-1 min-w-0"
              >
                <span className="absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] flex items-center justify-center pointer-events-none">
                  <SearchIcon
                    className="w-4.5 h-4.5 text-[#9CA3AF] flex-shrink-0"
                    strokeWidth={2}
                  />
                </span>

                <input
                  id="prostheses-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher..."
                  aria-label="Recherche par nom ou prénom"
                  className="w-full h-10 pl-10 sm:pl-11 pr-11 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl text-xs sm:text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] font-poppins transition-colors"
                />

                <button
                  id="prostheses-submit-search-button"
                  type="submit"
                  aria-label="Valider la recherche"
                  title="Valider la recherche"
                  className="absolute right-1 sm:right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 sm:w-8 sm:h-8 bg-transparent hover:bg-[#F3F4F6] text-[#374151] hover:text-[#111827] border-0 shadow-none focus:outline-none rounded-lg flex items-center justify-center transition-colors flex-shrink-0 cursor-pointer"
                >
                  <ArrowRightIcon
                    className="w-4 h-4 text-current flex-shrink-0"
                    strokeWidth={2.5}
                  />
                </button>
              </form>

              <button
                id="prostheses-filter-button"
                type="button"
                aria-label="Filtrer et trier"
                aria-expanded={isFilterMenuOpen}
                title="Filtrer et trier"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsVisibilityMenuOpen(false);
                  setVisibilityAnchorRect(null);
                  if (isFilterMenuOpen) {
                    setIsFilterMenuOpen(false);
                    setFilterAnchorRect(null);
                  } else {
                    setFilterAnchorRect(
                      e.currentTarget.getBoundingClientRect()
                    );
                    setIsFilterMenuOpen(true);
                  }
                }}
                className="w-8 h-10 sm:w-9 p-0 bg-[#FFFFFF] hover:bg-[#F8F9FA] text-[#374151] rounded-xl flex items-center justify-center transition-colors font-poppins flex-shrink-0 cursor-pointer relative focus:outline-none"
              >
                <FilterIcon
                  className="w-4.5 h-4.5 text-current flex-shrink-0"
                  strokeWidth={2}
                />
                {currentSort !== 'none' && (
                  <span className="absolute top-1.5 right-1 w-2 h-2 rounded-full bg-[#2563EB]" />
                )}
              </button>

              <ProsthesesFilterMenu
                isOpen={isFilterMenuOpen}
                anchorRect={filterAnchorRect}
                currentSort={currentSort}
                onSelectSort={(option) => setCurrentSort(option)}
                onClose={() => {
                  setIsFilterMenuOpen(false);
                  setFilterAnchorRect(null);
                }}
              />

              <button
                id="prostheses-visibility-button"
                type="button"
                aria-label="Afficher ou masquer"
                aria-expanded={isVisibilityMenuOpen}
                title="Afficher ou masquer"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFilterMenuOpen(false);
                  setFilterAnchorRect(null);
                  if (isVisibilityMenuOpen) {
                    setIsVisibilityMenuOpen(false);
                    setVisibilityAnchorRect(null);
                  } else {
                    setVisibilityAnchorRect(
                      e.currentTarget.getBoundingClientRect()
                    );
                    setIsVisibilityMenuOpen(true);
                  }
                }}
                className="w-8 h-10 sm:w-9 p-0 bg-[#FFFFFF] hover:bg-[#F8F9FA] text-[#374151] rounded-xl flex items-center justify-center transition-colors font-poppins flex-shrink-0 cursor-pointer relative focus:outline-none"
              >
                {areAllItemsHidden ? (
                  <EyeOffIcon
                    className="w-4.5 h-4.5 text-current flex-shrink-0"
                    strokeWidth={2}
                  />
                ) : (
                  <EyeIcon
                    className="w-4.5 h-4.5 text-current flex-shrink-0"
                    strokeWidth={2}
                  />
                )}
                {isAnyVisibilityHidden && (
                  <span className="absolute top-1.5 right-1 w-2 h-2 rounded-full bg-[#2563EB]" />
                )}
              </button>

              <ProsthesesVisibilityMenu
                isOpen={isVisibilityMenuOpen}
                anchorRect={visibilityAnchorRect}
                cabinetOptions={cabinetOptions}
                hiddenStatuses={hiddenStatuses}
                hiddenCabinets={hiddenCabinets}
                onChangeHiddenStatuses={setHiddenStatuses}
                onChangeHiddenCabinets={setHiddenCabinets}
                onClose={() => {
                  setIsVisibilityMenuOpen(false);
                  setVisibilityAnchorRect(null);
                }}
              />

              <button
                id="prostheses-trash-button"
                type="button"
                aria-label={
                  trashItems.length > 0
                    ? `Corbeille (${trashItems.length})`
                    : 'Corbeille'
                }
                title="Corbeille"
                onClick={() => {
                  setIsFilterMenuOpen(false);
                  setFilterAnchorRect(null);
                  setIsVisibilityMenuOpen(false);
                  setVisibilityAnchorRect(null);
                  setIsTrashOpen(true);
                }}
                className="relative w-8 h-10 sm:w-9 p-0 bg-[#FFFFFF] hover:bg-[#F8F9FA] text-[#374151] rounded-xl flex items-center justify-center transition-colors font-poppins flex-shrink-0 cursor-pointer focus:outline-none"
              >
                <TrashIcon
                  className="w-4.5 h-4.5 text-current flex-shrink-0"
                  strokeWidth={2}
                />
                <AnimatePresence>
                  {trashItems.length > 0 && (
                    <motion.span
                      key="prostheses-trash-count-badge"
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.7 }}
                      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute top-1 right-0 min-w-[16px] h-4 px-1 rounded-full bg-[#2563EB] text-[#FFFFFF] text-[10px] font-semibold leading-none flex items-center justify-center ring-2 ring-[#FFFFFF] pointer-events-none"
                    >
                      {trashItems.length > 9 ? '9+' : trashItems.length}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>

              <button
                id="prostheses-add-button"
                type="button"
                aria-label="Ajouter"
                title="Ajouter"
                onClick={() => {
                  setIsFilterMenuOpen(false);
                  setFilterAnchorRect(null);
                  setIsVisibilityMenuOpen(false);
                  setVisibilityAnchorRect(null);
                  setAddIconRotation((prev) => prev + 180);
                  setIsAddModalOpen(true);
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

            <AnimatePresence>
              {(currentSort !== 'none' || isAnyVisibilityHidden) && (
                <motion.div
                  id="prostheses-active-filter-bar"
                  key="prostheses-active-filter-bar"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-center flex-wrap gap-2 text-xs text-[#374151] pt-0.5"
                >
                  <span className="text-[#6B7280]">Filtre actif :</span>
                  {currentSort !== 'none' && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EFF6FF] text-[#2563EB] font-medium text-xs border border-[#BFDBFE]">
                      <span>
                        {currentSort === 'name_asc' && 'Nom : de A à Z'}
                        {currentSort === 'name_desc' && 'Nom : de Z à A'}
                        {currentSort === 'newest' &&
                          "Ajout : Plus récentes d'abord"}
                        {currentSort === 'oldest' &&
                          "Ajout : Plus anciennes d'abord"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCurrentSort('none')}
                        className="hover:text-[#1D4ED8] cursor-pointer"
                        aria-label="Supprimer le filtre"
                        title="Supprimer le filtre"
                      >
                        <CloseIcon className="w-3.5 h-3.5 text-current" />
                      </button>
                    </span>
                  )}
                  {isAnyStatusHidden && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EFF6FF] text-[#2563EB] font-medium text-xs border border-[#BFDBFE]">
                      <span>{statusVisibilityBadgeText}</span>
                      <button
                        type="button"
                        onClick={() => setHiddenStatuses([])}
                        className="hover:text-[#1D4ED8] cursor-pointer"
                        aria-label="Afficher tous les états"
                        title="Afficher tous les états"
                      >
                        <CloseIcon className="w-3.5 h-3.5 text-current" />
                      </button>
                    </span>
                  )}
                  {isAnyCabinetHidden && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EFF6FF] text-[#2563EB] font-medium text-xs border border-[#BFDBFE]">
                      <span>{cabinetVisibilityBadgeText}</span>
                      <button
                        type="button"
                        onClick={() => setHiddenCabinets([])}
                        className="hover:text-[#1D4ED8] cursor-pointer"
                        aria-label="Afficher tous les cabinets"
                        title="Afficher tous les cabinets"
                      >
                        <CloseIcon className="w-3.5 h-3.5 text-current" />
                      </button>
                    </span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            <ProsthesesList
              prostheses={filteredProstheses}
              searchQuery={searchQuery}
              onUpdateProsthesis={handleUpdateProsthesis}
              onUpdateStatus={handleUpdateStatus}
              onDeleteProsthesis={handleMoveToTrash}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AddProsthesisModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddProsthesis}
      />
    </div>
  );
};
