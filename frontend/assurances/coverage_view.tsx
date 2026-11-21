import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  SearchIcon,
  FilterIcon,
  ArrowRightIcon,
  PlusIcon,
  TrashIcon,
  CloseIcon,
  EyeIcon,
  EyeOffIcon,
} from '../navigation/navigation_icons';
import {
  CoverageFilterMenu,
  AssuranceFilterSortOption,
} from './coverage_filter_menu';
import { CoverageVisibilityMenu } from './coverage_visibility_menu';
import { CoverageAddMenu } from './coverage_add_menu';
import { AddAssuranceModal } from './add_assurance_modal';
import { AddCoverageModal, CoverageFormData } from './add_coverage_modal';
import { CoverageList } from './coverage_list';
import { AssuranceTrashView } from './assurance_trash_view';
import {
  CoverageAssuranceOption,
  getCachedAssurances,
  setCachedAssurances,
  getAssurancesApi,
  createAssuranceApi,
  restoreAssuranceApi,
  deleteAssurancePermanentlyApi,
  emptyAssuranceTrashApi,
} from '../services/assurances_api';
import {
  PriseEnChargeRecord,
  CoverageProcessingStatus,
  getCachedCoverages,
  setCachedCoverages,
  getCoveragesApi,
  createCoverageApi,
  updateCoverageApi,
  updateCoverageStatusApi,
  deleteCoverageApi,
  restoreCoverageApi,
  deleteCoveragePermanentlyApi,
  emptyCoverageTrashApi,
  COVERAGES_UPDATED_EVENT,
} from '../services/coverages_api';

interface CoverageViewProps {
  activeMenuId: string;
}

const dedupeAssurances = (
  items: CoverageAssuranceOption[]
): CoverageAssuranceOption[] => {
  const seen = new Set<string>();
  const result: CoverageAssuranceOption[] = [];
  for (const item of items) {
    if (item?.id && !seen.has(item.id)) {
      seen.add(item.id);
      result.push(item);
    }
  }
  return result;
};

const dedupeCoverages = (
  items: PriseEnChargeRecord[]
): PriseEnChargeRecord[] => {
  const seen = new Set<string>();
  const result: PriseEnChargeRecord[] = [];
  for (const item of items) {
    if (item?.id && !seen.has(item.id)) {
      seen.add(item.id);
      result.push(item);
    }
  }
  return result;
};

const MotionPlusIcon = motion.create(PlusIcon);

const normalizeSearchText = (value?: string): string =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const normalizeCodeWithSymbols = (value?: string): string =>
  normalizeSearchText(value).replace(/\s+/g, '');

const normalizeCodeSearch = (value?: string): string =>
  normalizeSearchText(value).replace(/[^a-z0-9]/g, '');

const CODE_SYMBOL_REGEX = /[/*\-+:]/;

// PAGE PRISE EN CHARGE ET GESTION DES ASSURANCES
export const CoverageView: React.FC<CoverageViewProps> = ({
  activeMenuId,
}) => {
  const [assurances, setAssurances] = useState<CoverageAssuranceOption[]>(() =>
    getCachedAssurances()
  );
  const [coverages, setCoverages] = useState<PriseEnChargeRecord[]>(() =>
    getCachedCoverages()
  );
  const [trashAssurances, setTrashAssurances] = useState<
    CoverageAssuranceOption[]
  >([]);
  const [trashCoverages, setTrashCoverages] = useState<PriseEnChargeRecord[]>(
    []
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [addAnchorRect, setAddAnchorRect] = useState<DOMRect | null>(null);
  const [isAddAssuranceOpen, setIsAddAssuranceOpen] = useState(false);
  const [isAddCoverageOpen, setIsAddCoverageOpen] = useState(false);
  const [addIconRotation, setAddIconRotation] = useState(0);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [filterAnchorRect, setFilterAnchorRect] = useState<DOMRect | null>(null);
  const [currentSort, setCurrentSort] =
    useState<AssuranceFilterSortOption>('none');
  const [isVisibilityMenuOpen, setIsVisibilityMenuOpen] = useState(false);
  const [visibilityAnchorRect, setVisibilityAnchorRect] =
    useState<DOMRect | null>(null);
  const [hiddenAssuranceIds, setHiddenAssuranceIds] = useState<string[]>([]);
  const [hiddenStatuses, setHiddenStatuses] = useState<
    CoverageProcessingStatus[]
  >([]);

  const isAnyAssuranceHidden = hiddenAssuranceIds.length > 0;
  const isAnyStatusHidden = hiddenStatuses.length > 0;
  const isAnyVisibilityHidden = isAnyAssuranceHidden || isAnyStatusHidden;
  const areAllAssurancesHidden =
    assurances.length > 0 &&
    assurances.every((item) => hiddenAssuranceIds.includes(item.id));
  const areAllStatusesHidden =
    hiddenStatuses.includes('En cours') && hiddenStatuses.includes('Reçu');
  const areAllItemsHidden = areAllAssurancesHidden || areAllStatusesHidden;

  useEffect(() => {
    setIsTrashOpen(false);
  }, [activeMenuId]);

  const refreshAssurances = async () => {
    const [activeItems, trashedItems] = await Promise.all([
      getAssurancesApi(false),
      getAssurancesApi(true),
    ]);
    const trashIds = new Set(trashedItems.map((item) => item.id));
    const cleanActive = dedupeAssurances(activeItems).filter(
      (item) => !trashIds.has(item.id)
    );
    setAssurances(cleanActive);
    setCachedAssurances(cleanActive);
    setTrashAssurances(dedupeAssurances(trashedItems));
  };

  const refreshCoverages = async () => {
    const [activeItems, trashedItems] = await Promise.all([
      getCoveragesApi(false),
      getCoveragesApi(true),
    ]);
    const trashIds = new Set(trashedItems.map((item) => item.id));
    const cleanActive = dedupeCoverages(activeItems).filter(
      (item) => !trashIds.has(item.id)
    );
    setCoverages(cleanActive);
    setCachedCoverages(cleanActive);
    setTrashCoverages(dedupeCoverages(trashedItems));
  };

  useEffect(() => {
    const loadCoveragesData = () => {
      refreshAssurances().catch((err) => {
        console.warn('Erreur chargement des assurances:', err);
      });
      refreshCoverages().catch((err) => {
        console.warn('Erreur chargement des prises en charge:', err);
      });
    };
    loadCoveragesData();
    window.addEventListener(COVERAGES_UPDATED_EVENT, loadCoveragesData);
    return () => {
      window.removeEventListener(COVERAGES_UPDATED_EVENT, loadCoveragesData);
    };
  }, []);

  const existingAssuranceLabels = useMemo(() => {
    const labels: string[] = [];
    for (const item of [...assurances, ...trashAssurances]) {
      if (item.label) labels.push(item.label);
      if (item.displayLabel && item.displayLabel !== item.label) {
        labels.push(item.displayLabel);
      }
    }
    return labels;
  }, [assurances, trashAssurances]);

  const sortedAssurances = useMemo(() => {
    const copy = [...assurances];
    if (currentSort === 'name_asc') {
      copy.sort((a, b) =>
        a.displayLabel.localeCompare(b.displayLabel, 'fr', {
          sensitivity: 'base',
        })
      );
    } else if (currentSort === 'name_desc') {
      copy.sort((a, b) =>
        b.displayLabel.localeCompare(a.displayLabel, 'fr', {
          sensitivity: 'base',
        })
      );
    } else if (currentSort === 'newest') {
      copy.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
    } else if (currentSort === 'oldest') {
      copy.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeA - timeB;
      });
    }
    return copy;
  }, [assurances, currentSort]);

  const displayedCoverages = useMemo(() => {
    const hiddenLabels = new Set<string>();
    for (const item of assurances) {
      if (hiddenAssuranceIds.includes(item.id)) {
        if (item.label) hiddenLabels.add(normalizeSearchText(item.label));
        if (item.displayLabel) {
          hiddenLabels.add(normalizeSearchText(item.displayLabel));
        }
      }
    }

    const normalizedQuery = normalizeSearchText(searchQuery);
    const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);

    const filtered = coverages.filter((item) => {
      if (areAllAssurancesHidden || areAllStatusesHidden) return false;
      const itemStatus: CoverageProcessingStatus =
        item.etatTraitement === 'Reçu' ? 'Reçu' : 'En cours';
      if (hiddenStatuses.includes(itemStatus)) {
        return false;
      }
      if (hiddenLabels.size > 0) {
        const itemAgency = normalizeSearchText(item.agence);
        if (hiddenLabels.has(itemAgency)) {
          return false;
        }
      }

      if (queryTokens.length > 0) {
        const searchableText = normalizeSearchText(
          `${item.patientNomPrenom} ${item.nomSociete} ${item.agence} ${item.numeroPriseEnCharge} ${item.numeroFacture} ${item.cabinetDentaire} ${item.createursPriseEnCharge || ''}`
        );
        const pecWithSymbols = normalizeCodeWithSymbols(
          item.numeroPriseEnCharge
        );
        const invoiceWithSymbols = normalizeCodeWithSymbols(
          item.numeroFacture
        );
        const queryWithSymbols = normalizeCodeWithSymbols(normalizedQuery);
        const queryHasSymbols = CODE_SYMBOL_REGEX.test(normalizedQuery);

        if (
          queryWithSymbols &&
          queryWithSymbols.length > 0 &&
          (pecWithSymbols.includes(queryWithSymbols) ||
            invoiceWithSymbols.includes(queryWithSymbols))
        ) {
          return true;
        }

        const compactCoverageNumber = normalizeCodeSearch(
          item.numeroPriseEnCharge
        );
        const compactInvoiceNumber = normalizeCodeSearch(item.numeroFacture);
        const compactQuery = normalizeCodeSearch(normalizedQuery);
        if (
          !queryHasSymbols &&
          compactQuery.length > 0 &&
          (compactCoverageNumber.includes(compactQuery) ||
            compactInvoiceNumber.includes(compactQuery))
        ) {
          return true;
        }

        return queryTokens.every((token) => {
          if (searchableText.includes(token)) {
            return true;
          }
          const tokenWithSymbols = normalizeCodeWithSymbols(token);
          if (CODE_SYMBOL_REGEX.test(token)) {
            return (
              tokenWithSymbols.length > 0 &&
              (pecWithSymbols.includes(tokenWithSymbols) ||
                invoiceWithSymbols.includes(tokenWithSymbols))
            );
          }
          const compactToken = normalizeCodeSearch(token);
          return (
            compactToken.length > 0 &&
            (compactCoverageNumber.includes(compactToken) ||
              compactInvoiceNumber.includes(compactToken))
          );
        });
      }

      return true;
    });

    const sorted = [...filtered];
    if (currentSort === 'name_asc') {
      sorted.sort((a, b) =>
        a.patientNomPrenom.localeCompare(b.patientNomPrenom, 'fr', {
          sensitivity: 'base',
        })
      );
    } else if (currentSort === 'name_desc') {
      sorted.sort((a, b) =>
        b.patientNomPrenom.localeCompare(a.patientNomPrenom, 'fr', {
          sensitivity: 'base',
        })
      );
    } else if (currentSort === 'oldest') {
      sorted.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeA - timeB;
      });
    } else {
      sorted.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
    }

    return sorted;
  }, [
    coverages,
    assurances,
    hiddenAssuranceIds,
    hiddenStatuses,
    areAllAssurancesHidden,
    areAllStatusesHidden,
    searchQuery,
    currentSort,
  ]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    refreshAssurances().catch(() => {
      // Recherche locale active
    });
    refreshCoverages().catch(() => {
      // Recherche locale active
    });
  };

  const handleAddAssurance = async (data: {
    label: string;
    description: string;
  }) => {
    const created = await createAssuranceApi(data);
    setAssurances((prev) => {
      const updated = [
        ...prev.filter((item) => item.id !== created.id),
        created,
      ];
      setCachedAssurances(updated);
      return updated;
    });
  };

  const handleAddCoverage = async (data: CoverageFormData) => {
    try {
      const created = await createCoverageApi(data);
      setCoverages((prev) => {
        const updated = [created, ...prev.filter((item) => item.id !== created.id)];
        setCachedCoverages(updated);
        return updated;
      });
    } catch (err) {
      console.error('Erreur enregistrement prise en charge:', err);
      throw err;
    }
  };

  const handleUpdateCoverage = async (id: string, data: CoverageFormData) => {
    try {
      const serverUpdated = await updateCoverageApi(id, data);
      setCoverages((prev) => {
        const updated = prev.map((item) =>
          item.id === id ? serverUpdated : item
        );
        setCachedCoverages(updated);
        return updated;
      });
    } catch (err) {
      console.error('Erreur modification prise en charge:', err);
      throw err;
    }
  };

  const handleUpdateCoverageStatus = async (
    id: string,
    nextStatus: CoverageProcessingStatus,
    dateObtentionCheque: string
  ) => {
    setCoverages((prev) => {
      const updated = prev.map((item) =>
        item.id === id
          ? {
              ...item,
              etatTraitement: nextStatus,
              dateObtentionCheque,
            }
          : item
      );
      setCachedCoverages(updated);
      return updated;
    });

    try {
      const serverUpdated = await updateCoverageStatusApi(
        id,
        nextStatus,
        dateObtentionCheque
      );
      setCoverages((prev) => {
        const updated = prev.map((item) =>
          item.id === id ? serverUpdated : item
        );
        setCachedCoverages(updated);
        return updated;
      });
    } catch (err) {
      console.error("Erreur mise à jour de l'état de traitement:", err);
      refreshCoverages().catch(() => {});
    }
  };

  const handleRestoreAssurance = async (assuranceId: string) => {
    const target = trashAssurances.find((item) => item.id === assuranceId);
    setTrashAssurances((prev) => prev.filter((item) => item.id !== assuranceId));
    if (target) {
      const activeRestored: CoverageAssuranceOption = {
        ...target,
        deleted: false,
      };
      delete activeRestored.deletedAt;
      setAssurances((prev) => {
        const updated = [
          ...prev.filter((item) => item.id !== assuranceId),
          activeRestored,
        ];
        setCachedAssurances(updated);
        return updated;
      });
    }
    try {
      const serverRestored = await restoreAssuranceApi(assuranceId);
      setAssurances((prev) => {
        const updated = [
          ...prev.filter((item) => item.id !== serverRestored.id),
          serverRestored,
        ];
        setCachedAssurances(updated);
        return updated;
      });
    } catch (err) {
      console.warn('Restauration assurance non effectuée:', err);
      refreshAssurances().catch(() => {});
    }
  };

  const handleDeleteAssurancePermanent = async (assuranceId: string) => {
    setTrashAssurances((prev) => prev.filter((item) => item.id !== assuranceId));
    try {
      await deleteAssurancePermanentlyApi(assuranceId);
    } catch (err) {
      console.warn('Suppression définitive assurance non effectuée:', err);
      refreshAssurances().catch(() => {});
    }
  };

  const handleMoveCoverageToTrash = async (coverageId: string) => {
    const target = coverages.find((item) => item.id === coverageId);
    setCoverages((prev) => {
      const updated = prev.filter((item) => item.id !== coverageId);
      setCachedCoverages(updated);
      return updated;
    });
    if (target) {
      const now = new Date().toISOString();
      const trashed: PriseEnChargeRecord = {
        ...target,
        deleted: true,
        deletedAt: now,
        updatedAt: now,
      };
      setTrashCoverages((prev) => [
        trashed,
        ...prev.filter((item) => item.id !== coverageId),
      ]);
    }
    try {
      await deleteCoverageApi(coverageId);
    } catch (err) {
      console.warn('Mise en corbeille prise en charge non effectuée:', err);
      refreshCoverages().catch(() => {});
    }
  };

  const handleRestoreCoverage = async (coverageId: string) => {
    const target = trashCoverages.find((item) => item.id === coverageId);
    setTrashCoverages((prev) => prev.filter((item) => item.id !== coverageId));
    if (target) {
      const activeRestored: PriseEnChargeRecord = {
        ...target,
        deleted: false,
      };
      delete activeRestored.deletedAt;
      setCoverages((prev) => {
        const updated = [
          activeRestored,
          ...prev.filter((item) => item.id !== coverageId),
        ];
        setCachedCoverages(updated);
        return updated;
      });
    }
    try {
      const serverRestored = await restoreCoverageApi(coverageId);
      setCoverages((prev) => {
        const updated = [
          serverRestored,
          ...prev.filter((item) => item.id !== serverRestored.id),
        ];
        setCachedCoverages(updated);
        return updated;
      });
    } catch (err) {
      console.warn('Restauration prise en charge non effectuée:', err);
      refreshCoverages().catch(() => {});
    }
  };

  const handleDeleteCoveragePermanent = async (coverageId: string) => {
    setTrashCoverages((prev) => prev.filter((item) => item.id !== coverageId));
    try {
      await deleteCoveragePermanentlyApi(coverageId);
    } catch (err) {
      console.warn('Suppression définitive prise en charge non effectuée:', err);
      refreshCoverages().catch(() => {});
    }
  };

  const handleEmptyAssuranceTrash = async () => {
    const hadAssurances = trashAssurances.length > 0;
    const hadCoverages = trashCoverages.length > 0;
    setTrashAssurances([]);
    setTrashCoverages([]);
    try {
      await Promise.all([
        hadAssurances ? emptyAssuranceTrashApi() : Promise.resolve(),
        hadCoverages ? emptyCoverageTrashApi() : Promise.resolve(),
      ]);
    } catch (err) {
      console.warn('Vidage corbeille non effectué:', err);
      refreshAssurances().catch(() => {});
      refreshCoverages().catch(() => {});
    }
  };

  const totalTrashCount = trashAssurances.length + trashCoverages.length;

  const visibilityBadgeText = useMemo(() => {
    if (!isAnyAssuranceHidden) return '';
    if (areAllAssurancesHidden) return 'Assurances masquées';
    const visibleItems = assurances.filter(
      (item) => !hiddenAssuranceIds.includes(item.id)
    );
    if (visibleItems.length === 1) {
      return `${visibleItems[0].displayLabel} uniquement`;
    }
    return `${visibleItems.length} assurances affichées`;
  }, [
    isAnyAssuranceHidden,
    areAllAssurancesHidden,
    assurances,
    hiddenAssuranceIds,
  ]);

  const statusVisibilityBadgeText = useMemo(() => {
    if (!isAnyStatusHidden) return '';
    if (areAllStatusesHidden) return 'Tous les états masqués';
    if (hiddenStatuses.includes('En cours')) return 'Terminer uniquement';
    return 'En cours uniquement';
  }, [isAnyStatusHidden, areAllStatusesHidden, hiddenStatuses]);

  return (
    <div className="w-full font-poppins">
      <AnimatePresence mode="wait" initial={false}>
        {isTrashOpen ? (
          <motion.div
            key="coverage-trash-view"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-full"
          >
            <AssuranceTrashView
              trashAssurances={trashAssurances}
              trashCoverages={trashCoverages}
              onBack={() => setIsTrashOpen(false)}
              onRestore={handleRestoreAssurance}
              onDeletePermanent={handleDeleteAssurancePermanent}
              onRestoreCoverage={handleRestoreCoverage}
              onDeleteCoveragePermanent={handleDeleteCoveragePermanent}
              onEmptyTrash={handleEmptyAssuranceTrash}
            />
          </motion.div>
        ) : (
          <motion.div
            key="coverage-list-view"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-full flex flex-col space-y-4"
          >
            <div
              id="coverage-search-filter-bar"
              className="flex flex-row items-center gap-1 sm:gap-1.5 w-full"
            >
              <form
                id="coverage-search-form"
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
                  id="coverage-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher..."
                  aria-label="Recherche par nom, prénom, n° prise en charge ou n° facture"
                  className="w-full h-10 pl-10 sm:pl-11 pr-11 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl text-xs sm:text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] font-poppins transition-colors"
                />

                <button
                  id="coverage-submit-search-button"
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
                id="coverage-filter-button"
                type="button"
                aria-label="Filtrer et trier les assurances"
                aria-expanded={isFilterMenuOpen}
                title="Filtrer et trier les assurances"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsVisibilityMenuOpen(false);
                  setVisibilityAnchorRect(null);
                  setIsAddMenuOpen(false);
                  setAddAnchorRect(null);
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

              <CoverageFilterMenu
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
                id="coverage-visibility-button"
                type="button"
                aria-label="Afficher ou masquer les assurances"
                aria-expanded={isVisibilityMenuOpen}
                title="Afficher ou masquer les assurances"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFilterMenuOpen(false);
                  setFilterAnchorRect(null);
                  setIsAddMenuOpen(false);
                  setAddAnchorRect(null);
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

              <CoverageVisibilityMenu
                isOpen={isVisibilityMenuOpen}
                anchorRect={visibilityAnchorRect}
                assurances={sortedAssurances}
                hiddenIds={hiddenAssuranceIds}
                hiddenStatuses={hiddenStatuses}
                onChangeHiddenIds={setHiddenAssuranceIds}
                onChangeHiddenStatuses={setHiddenStatuses}
                onClose={() => {
                  setIsVisibilityMenuOpen(false);
                  setVisibilityAnchorRect(null);
                }}
              />

              <button
                id="coverage-trash-button"
                type="button"
                aria-label={
                  totalTrashCount > 0
                    ? `Corbeille (${totalTrashCount})`
                    : 'Corbeille'
                }
                title="Corbeille"
                onClick={() => setIsTrashOpen(true)}
                className="relative w-8 h-10 sm:w-9 p-0 bg-[#FFFFFF] hover:bg-[#F8F9FA] text-[#374151] rounded-xl flex items-center justify-center transition-colors font-poppins flex-shrink-0 cursor-pointer focus:outline-none"
              >
                <TrashIcon
                  className="w-4.5 h-4.5 text-current flex-shrink-0"
                  strokeWidth={2}
                />
                <AnimatePresence>
                  {totalTrashCount > 0 && (
                    <motion.span
                      key="coverage-trash-count-badge"
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.7 }}
                      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute top-1 right-0 min-w-[16px] h-4 px-1 rounded-full bg-[#2563EB] text-[#FFFFFF] text-[10px] font-semibold leading-none flex items-center justify-center ring-2 ring-[#FFFFFF] pointer-events-none"
                    >
                      {totalTrashCount > 9 ? '9+' : totalTrashCount}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>

              <button
                id="coverage-add-button"
                type="button"
                aria-label="Ajouter"
                aria-expanded={isAddMenuOpen}
                title="Ajouter une assurance ou une prise en charge"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFilterMenuOpen(false);
                  setFilterAnchorRect(null);
                  setIsVisibilityMenuOpen(false);
                  setVisibilityAnchorRect(null);
                  setAddIconRotation((prev) => prev + 180);
                  if (isAddMenuOpen) {
                    setIsAddMenuOpen(false);
                    setAddAnchorRect(null);
                  } else {
                    setAddAnchorRect(
                      e.currentTarget.getBoundingClientRect()
                    );
                    setIsAddMenuOpen(true);
                  }
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

              <CoverageAddMenu
                isOpen={isAddMenuOpen}
                anchorRect={addAnchorRect}
                onSelectAssurance={() => setIsAddAssuranceOpen(true)}
                onSelectCoverage={() => setIsAddCoverageOpen(true)}
                onClose={() => {
                  setIsAddMenuOpen(false);
                  setAddAnchorRect(null);
                }}
              />
            </div>

            <AnimatePresence>
              {(currentSort !== 'none' || isAnyVisibilityHidden) && (
                <motion.div
                  key="coverage-active-filter-bar"
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
                  {isAnyAssuranceHidden && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EFF6FF] text-[#2563EB] font-medium text-xs border border-[#BFDBFE]">
                      <span>{visibilityBadgeText}</span>
                      <button
                        type="button"
                        onClick={() => setHiddenAssuranceIds([])}
                        className="hover:text-[#1D4ED8] cursor-pointer"
                        aria-label="Tout afficher"
                        title="Tout afficher"
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
                </motion.div>
              )}
            </AnimatePresence>
            <CoverageList
              coverages={displayedCoverages}
              allCoverages={coverages}
              searchQuery={searchQuery}
              onUpdateStatus={handleUpdateCoverageStatus}
              onUpdateCoverage={handleUpdateCoverage}
              onDeleteCoverage={handleMoveCoverageToTrash}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AddAssuranceModal
        isOpen={isAddAssuranceOpen}
        onClose={() => setIsAddAssuranceOpen(false)}
        existingLabels={existingAssuranceLabels}
        onSubmit={handleAddAssurance}
      />

      <AddCoverageModal
        isOpen={isAddCoverageOpen}
        onClose={() => setIsAddCoverageOpen(false)}
        existingInvoiceNumbers={coverages
          .map((item) => item.numeroFacture)
          .filter(Boolean)}
        onSubmit={handleAddCoverage}
      />
    </div>
  );
};
