import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SearchIcon, FilterIcon, ArrowRightIcon, PlusIcon, MoreVerticalIcon, TrashIcon, CloseIcon } from '../navigation/navigation_icons';
import { AddRecordModal } from './add_record_modal';
import { RecordDetailView } from './record_detail_view';
import { RecordActionsMenu } from './record_actions_menu';
import { FilterSortMenu, FilterSortOption } from './filter_sort_menu';
import { TrashView } from './trash_view';
import { PatientRecord, CareHistoryItem } from './record_id_utils';
import {
  getPatientsApi,
  createPatientApi,
  updatePatientApi,
  addCareActApi,
  updateCareActApi,
  deleteCareActApi,
  deletePatientApi,
  restorePatientApi,
  deletePatientPermanentlyApi,
  emptyTrashApi,
  PATIENTS_UPDATED_EVENT,
} from '../services/patients_api';
import { useAuth } from '../firebase/auth_context';

const STORAGE_KEY = 'smilo_patient_records';

// Helpers pour le calcul d'anciennete base sur l'historique des soins
const parseCareDate = (dateStr?: string): number | null => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d.getTime();
  }

  const ymdMatch = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d.getTime();
  }

  const parsed = Date.parse(trimmed);
  if (!isNaN(parsed)) return parsed;

  return null;
};

const getOldestCareTimestamp = (record: PatientRecord): number | null => {
  if (!record.historiqueSoins || record.historiqueSoins.length === 0) return null;
  let minTime: number | null = null;
  for (const item of record.historiqueSoins) {
    const t = parseCareDate(item.date);
    if (t !== null) {
      if (minTime === null || t < minTime) {
        minTime = t;
      }
    }
  }
  return minTime;
};

const getNewestCareTimestamp = (record: PatientRecord): number | null => {
  if (!record.historiqueSoins || record.historiqueSoins.length === 0) return null;
  let maxTime: number | null = null;
  for (const item of record.historiqueSoins) {
    const t = parseCareDate(item.date);
    if (t !== null) {
      if (maxTime === null || t > maxTime) {
        maxTime = t;
      }
    }
  }
  return maxTime;
};

const formatCareDate = (timestamp: number | null): string => {
  if (timestamp === null) return 'Aucun soin';
  const d = new Date(timestamp);
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const dedupeRecords = (items: PatientRecord[]): PatientRecord[] => {
  const seen = new Set<string>();
  const result: PatientRecord[] = [];
  for (const item of items) {
    if (item?.id && !seen.has(item.id)) {
      seen.add(item.id);
      result.push(item);
    }
  }
  return result;
};

const normalizeSearchText = (value?: string): string => {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

const MotionPlusIcon = motion.create(PlusIcon);

// Vue responsive de la page Fiches Individuelles avec liste et formulaire d'ajout
export const IndividualFilesView: React.FC = () => {
  const { user, loading } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PatientRecord | null>(null);
  const [addIconRotation, setAddIconRotation] = useState(0);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [viewingRecord, setViewingRecord] = useState<PatientRecord | null>(null);
  const [openMenuRecordId, setOpenMenuRecordId] = useState<string | null>(null);
  const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [filterAnchorRect, setFilterAnchorRect] = useState<DOMRect | null>(null);
  const [currentSort, setCurrentSort] = useState<FilterSortOption>('none');
  const [trashRecords, setTrashRecords] = useState<PatientRecord[]>([]);
  const [records, setRecords] = useState<PatientRecord[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const filtered = Array.isArray(parsed)
          ? parsed.filter((r) => r.id !== 'p-1' && r.id !== 'p-2' && r.id !== 'p-3')
          : [];
        return dedupeRecords(filtered);
      }
    } catch {
      // Erreur de lecture locale
    }
    return [];
  });

  useEffect(() => {
    const loadPatients = () => {
      Promise.all([
        getPatientsApi(false),
        getPatientsApi(true),
      ])
        .then(([apiPatients, apiTrash]) => {
          const trashIds = new Set((apiTrash || []).map((r) => r.id));
          if (apiPatients) {
            const uniquePatients = dedupeRecords(apiPatients).filter((r) => !trashIds.has(r.id));
            setRecords(uniquePatients);
            setViewingRecord((prev) =>
              prev ? uniquePatients.find((r) => r.id === prev.id) || prev : null
            );
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(uniquePatients));
            } catch {
              // Mise en cache
            }
          }
          if (apiTrash) {
            setTrashRecords(dedupeRecords(apiTrash));
          }
        })
        .catch((err) => {
          console.warn('Erreur chargement patients:', err);
        });
    };

    loadPatients();
    window.addEventListener(PATIENTS_UPDATED_EVENT, loadPatients);
    return () => {
      window.removeEventListener(PATIENTS_UPDATED_EVENT, loadPatients);
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    getPatientsApi(false)
      .then((apiPatients) => {
        if (apiPatients) {
          const uniquePatients = dedupeRecords(apiPatients);
          setRecords(uniquePatients);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(uniquePatients));
          } catch {
            // Mise en cache
          }
        }
      })
      .catch(() => {
        // Recherche locale active
      });
  };

  const handleAddPatient = async (data: Omit<PatientRecord, 'id' | 'createdAt'>) => {
    try {
      const created = await createPatientApi(data);
      setRecords((prev) => {
        const updated = [created, ...prev.filter((r) => r.id !== created.id)];
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // Sauvegarde locale
        }
        return updated;
      });
    } catch (err) {
      console.error('Erreur creation patient:', err);
      const fallback: PatientRecord = {
        ...data,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
      };
      setRecords((prev) => {
        const updated = [fallback, ...prev.filter((r) => r.id !== fallback.id)];
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // Sauvegarde locale
        }
        return updated;
      });
    }
  };

  const handleUpdatePatient = async (
    recordId: string,
    data: Omit<PatientRecord, 'id' | 'createdAt'>
  ) => {
    try {
      const updatedRecord = await updatePatientApi(recordId, data);
      setRecords((prev) => {
        const updated = prev.map((r) => (r.id === recordId ? updatedRecord : r));
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // Sauvegarde locale
        }
        return updated;
      });
      if (viewingRecord?.id === recordId) {
        setViewingRecord(updatedRecord);
      }
    } catch (err) {
      console.error('Erreur modification patient:', err);
    }
  };

  const existingRecordIds = useMemo(() => {
    return records.map((r) => r.identifiant).filter(Boolean);
  }, [records]);

  const filteredRecords = useMemo(() => {
    const normalizedQuery = normalizeSearchText(searchQuery);
    const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
    let result = records;

    if (queryTokens.length > 0) {
      result = records.filter((r) => {
        const searchableText = normalizeSearchText(
          `${r.nom || ''} ${r.prenom || ''} ${r.nom || ''} ${r.identifiant || ''} ${r.telephone || ''} ${r.cabinet || ''}`
        );
        return queryTokens.every((token) => searchableText.includes(token));
      });
    }

    if (currentSort === 'name_asc') {
      return [...result].sort((a, b) => {
        const cmpNom = (a.nom || '').localeCompare(b.nom || '', 'fr', { sensitivity: 'base' });
        if (cmpNom !== 0) return cmpNom;
        return (a.prenom || '').localeCompare(b.prenom || '', 'fr', { sensitivity: 'base' });
      });
    }

    if (currentSort === 'name_desc') {
      return [...result].sort((a, b) => {
        const cmpNom = (b.nom || '').localeCompare(a.nom || '', 'fr', { sensitivity: 'base' });
        if (cmpNom !== 0) return cmpNom;
        return (b.prenom || '').localeCompare(a.prenom || '', 'fr', { sensitivity: 'base' });
      });
    }

    if (currentSort === 'care_oldest') {
      return [...result].sort((a, b) => {
        const tA = getOldestCareTimestamp(a);
        const tB = getOldestCareTimestamp(b);
        if (tA !== null && tB !== null) return tA - tB;
        if (tA !== null && tB === null) return -1;
        if (tA === null && tB !== null) return 1;
        return (a.nom || '').localeCompare(b.nom || '', 'fr', { sensitivity: 'base' });
      });
    }

    if (currentSort === 'care_newest') {
      return [...result].sort((a, b) => {
        const tA = getNewestCareTimestamp(a);
        const tB = getNewestCareTimestamp(b);
        if (tA !== null && tB !== null) return tB - tA;
        if (tA !== null && tB === null) return -1;
        if (tA === null && tB !== null) return 1;
        return (a.nom || '').localeCompare(b.nom || '', 'fr', { sensitivity: 'base' });
      });
    }

    return result;
  }, [records, searchQuery, currentSort]);

  const handleAddCare = async (item: Omit<CareHistoryItem, 'id'>) => {
    if (!viewingRecord) return;

    try {
      const apiResult = await addCareActApi(viewingRecord.id, item);
      const updatedPatient: PatientRecord =
        'nom' in apiResult
          ? apiResult
          : {
              ...viewingRecord,
              historiqueSoins: [apiResult, ...(viewingRecord.historiqueSoins || [])],
            };
      setViewingRecord(updatedPatient);
      setRecords((prev) => {
        const updatedList = prev.map((r) =>
          r.id === updatedPatient.id ? updatedPatient : r
        );
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
        } catch {
          // Sauvegarde locale
        }
        return updatedList;
      });
    } catch (err) {
      console.error('Erreur enregistrement acte de soin:', err);
      const newCareItem: CareHistoryItem = {
        ...item,
        id: Date.now().toString(),
      };
      const fallbackUpdated: PatientRecord = {
        ...viewingRecord,
        historiqueSoins: [newCareItem, ...(viewingRecord.historiqueSoins || [])],
      };
      setViewingRecord(fallbackUpdated);
      setRecords((prev) =>
        prev.map((r) => (r.id === fallbackUpdated.id ? fallbackUpdated : r))
      );
    }
  };

  const handleUpdateCare = async (careId: string, item: Omit<CareHistoryItem, 'id'>) => {
    if (!viewingRecord) return;

    try {
      const updatedPatient = await updateCareActApi(viewingRecord.id, careId, item);
      setViewingRecord(updatedPatient);
      setRecords((prev) => {
        const updatedList = prev.map((r) =>
          r.id === updatedPatient.id ? updatedPatient : r
        );
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
        } catch {
          // Sauvegarde locale
        }
        return updatedList;
      });
    } catch (err) {
      console.error('Erreur modification acte de soin:', err);
      const fallbackUpdated: PatientRecord = {
        ...viewingRecord,
        historiqueSoins: (viewingRecord.historiqueSoins || []).map((c) =>
          c.id === careId ? { ...c, ...item } : c
        ),
      };
      setViewingRecord(fallbackUpdated);
      setRecords((prev) =>
        prev.map((r) => (r.id === fallbackUpdated.id ? fallbackUpdated : r))
      );
    }
  };

  const handleDeleteCare = async (careId: string) => {
    if (!viewingRecord) return;

    const updatedRecord: PatientRecord = {
      ...viewingRecord,
      historiqueSoins: (viewingRecord.historiqueSoins || []).filter((c) => c.id !== careId),
    };

    setViewingRecord(updatedRecord);
    setRecords((prev) => {
      const updatedList = prev.map((r) =>
        r.id === updatedRecord.id ? updatedRecord : r
      );
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
      } catch {
        // Sauvegarde locale
      }
      return updatedList;
    });

    try {
      await deleteCareActApi(viewingRecord.id, careId);
    } catch (err) {
      console.error('Erreur suppression acte de soin:', err);
    }
  };

  const handleMoveToTrash = async (recordId: string) => {
    setOpenMenuRecordId(null);
    setMenuAnchorRect(null);
    const moved = records.find((r) => r.id === recordId);

    setRecords((prev) => {
      const updated = prev.filter((r) => r.id !== recordId);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Sauvegarde locale
      }
      return updated;
    });

    if (moved) {
      setTrashRecords((prev) => [
        { ...moved, deleted: true, deletedAt: new Date().toISOString() },
        ...prev.filter((r) => r.id !== recordId),
      ]);
    }
    if (viewingRecord?.id === recordId) {
      setViewingRecord(null);
    }

    try {
      await deletePatientApi(recordId);
    } catch (err) {
      console.warn('Mise en corbeille backend non effectuée:', err);
      const [apiPatients, apiTrash] = await Promise.all([
        getPatientsApi(false).catch(() => null),
        getPatientsApi(true).catch(() => null),
      ]);
      if (apiPatients) setRecords(dedupeRecords(apiPatients));
      if (apiTrash) setTrashRecords(dedupeRecords(apiTrash));
    }
  };

  const handleRestoreRecord = async (recordId: string) => {
    const restored = trashRecords.find((r) => r.id === recordId);
    setTrashRecords((prev) => prev.filter((r) => r.id !== recordId));
    if (restored) {
      const activeRestored: PatientRecord = { ...restored, deleted: false };
      delete activeRestored.deletedAt;
      setRecords((prev) => {
        const updated = [activeRestored, ...prev.filter((r) => r.id !== recordId)];
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // Sauvegarde locale
        }
        return updated;
      });
    }
    try {
      const serverRestored = await restorePatientApi(recordId);
      if (serverRestored) {
        setRecords((prev) => {
          const updated = [
            serverRestored,
            ...prev.filter((r) => r.id !== serverRestored.id),
          ];
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          } catch {
            // Sauvegarde locale
          }
          return updated;
        });
      }
    } catch (err) {
      console.warn('Restauration backend non effectuée:', err);
      const [apiPatients, apiTrash] = await Promise.all([
        getPatientsApi(false).catch(() => null),
        getPatientsApi(true).catch(() => null),
      ]);
      if (apiPatients) {
        const deduped = dedupeRecords(apiPatients);
        setRecords(deduped);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(deduped));
        } catch {
          // Sauvegarde locale
        }
      }
      if (apiTrash) setTrashRecords(dedupeRecords(apiTrash));
    }
  };

  const handleDeletePermanent = async (recordId: string) => {
    setTrashRecords((prev) => prev.filter((r) => r.id !== recordId));
    setRecords((prev) => {
      const updated = prev.filter((r) => r.id !== recordId);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Sauvegarde locale
      }
      return updated;
    });
    try {
      await deletePatientPermanentlyApi(recordId);
    } catch (err) {
      console.warn('Suppression définitive non effectuée:', err);
      const [apiPatients, apiTrash] = await Promise.all([
        getPatientsApi(false).catch(() => null),
        getPatientsApi(true).catch(() => null),
      ]);
      if (apiPatients) {
        const deduped = dedupeRecords(apiPatients);
        setRecords(deduped);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(deduped));
        } catch {
          // Sauvegarde locale
        }
      }
      if (apiTrash) setTrashRecords(dedupeRecords(apiTrash));
    }
  };

  const handleEmptyTrash = async () => {
    const removedIds = new Set(trashRecords.map((r) => r.id));
    setTrashRecords([]);
    if (removedIds.size > 0) {
      setRecords((prev) => {
        const updated = prev.filter((r) => !removedIds.has(r.id));
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // Sauvegarde locale
        }
        return updated;
      });
    }
    try {
      await emptyTrashApi();
    } catch (err) {
      console.warn('Vidage corbeille non effectué:', err);
      const [apiPatients, apiTrash] = await Promise.all([
        getPatientsApi(false).catch(() => null),
        getPatientsApi(true).catch(() => null),
      ]);
      if (apiPatients) {
        const deduped = dedupeRecords(apiPatients);
        setRecords(deduped);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(deduped));
        } catch {
          // Sauvegarde locale
        }
      }
      if (apiTrash) setTrashRecords(dedupeRecords(apiTrash));
    }
  };

  return (
    <div className="w-full">
      <AnimatePresence mode="wait" initial={false}>
        {viewingRecord ? (
          <motion.div
            key="record-detail-view"
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 28 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="w-full"
          >
            <RecordDetailView
              record={viewingRecord}
              onBack={() => setViewingRecord(null)}
              onAddCare={handleAddCare}
              onUpdateCare={handleUpdateCare}
              onDeleteCare={handleDeleteCare}
            />
          </motion.div>
        ) : isTrashOpen ? (
          <motion.div
            key="trash-view"
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 28 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="w-full"
          >
            <TrashView
              trashRecords={trashRecords}
              onBack={() => setIsTrashOpen(false)}
              onRestore={handleRestoreRecord}
              onDeletePermanent={handleDeletePermanent}
              onEmptyTrash={handleEmptyTrash}
            />
          </motion.div>
        ) : (
          <motion.div
            key="records-list-view"
            initial={{ opacity: 0, x: -28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -28 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="w-full"
          >
            <div id="individual-files-page" className="w-full flex flex-col space-y-4 font-poppins">
      <div
        id="search-filter-bar"
        className="flex flex-row items-center gap-1 sm:gap-1.5 w-full"
      >
        <form
          id="search-form"
          onSubmit={handleSearchSubmit}
          className="relative flex-1 min-w-0"
        >
          <span className="absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] flex items-center justify-center pointer-events-none">
            <SearchIcon className="w-4.5 h-4.5 text-[#9CA3AF] flex-shrink-0" strokeWidth={2} />
          </span>

          <input
            id="individual-files-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher..."
            aria-label="Recherche par nom ou prénom"
            className="w-full h-10 pl-10 sm:pl-11 pr-11 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl text-xs sm:text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] font-poppins transition-colors"
          />

          <button
            id="submit-search-button"
            type="submit"
            aria-label="Valider la recherche"
            title="Valider la recherche"
            className="absolute right-1 sm:right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 sm:w-8 sm:h-8 bg-transparent hover:bg-[#F3F4F6] text-[#374151] hover:text-[#111827] border-0 shadow-none focus:outline-none rounded-lg flex items-center justify-center transition-colors flex-shrink-0 cursor-pointer"
          >
            <ArrowRightIcon className="w-4 h-4 text-current flex-shrink-0" strokeWidth={2.5} />
          </button>
        </form>

        <button
          id="individual-files-filter-button"
          type="button"
          aria-label="Filtrer et trier"
          aria-expanded={isFilterMenuOpen}
          title="Filtrer et trier les fiches"
          onClick={(e) => {
            e.stopPropagation();
            if (isFilterMenuOpen) {
              setIsFilterMenuOpen(false);
              setFilterAnchorRect(null);
            } else {
              setFilterAnchorRect(e.currentTarget.getBoundingClientRect());
              setIsFilterMenuOpen(true);
            }
          }}
          className="w-8 h-10 sm:w-9 p-0 bg-[#FFFFFF] hover:bg-[#F8F9FA] text-[#374151] rounded-xl flex items-center justify-center transition-colors font-poppins flex-shrink-0 cursor-pointer relative focus:outline-none"
        >
          <FilterIcon className="w-4.5 h-4.5 text-current flex-shrink-0" strokeWidth={2} />
          {currentSort !== 'none' && (
            <span className="absolute top-1.5 right-1 w-2 h-2 rounded-full bg-[#2563EB]" />
          )}
        </button>

        <FilterSortMenu
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
          id="individual-files-trash-button"
          type="button"
          aria-label={
            trashRecords.length > 0
              ? `Ouvrir la corbeille (${trashRecords.length})`
              : 'Ouvrir la corbeille'
          }
          title="Ouvrir la corbeille"
          onClick={() => setIsTrashOpen(true)}
          className="relative w-8 h-10 sm:w-9 p-0 bg-[#FFFFFF] hover:bg-[#F8F9FA] text-[#374151] rounded-xl flex items-center justify-center transition-colors font-poppins flex-shrink-0 cursor-pointer focus:outline-none"
        >
          <TrashIcon className="w-4.5 h-4.5 text-current flex-shrink-0" strokeWidth={2} />
          <AnimatePresence>
            {trashRecords.length > 0 && (
              <motion.span
                key="trash-count-badge"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="absolute top-1 right-0 min-w-[16px] h-4 px-1 rounded-full bg-[#2563EB] text-[#FFFFFF] text-[10px] font-semibold leading-none flex items-center justify-center ring-2 ring-[#FFFFFF] pointer-events-none"
              >
                {trashRecords.length > 9 ? '9+' : trashRecords.length}
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        <button
          id="individual-files-add-button"
          type="button"
          aria-label="Ajouter"
          title="Ajouter"
          onClick={() => {
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
        {currentSort !== 'none' && (
          <motion.div
            key="active-filter-bar"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center flex-wrap gap-2 text-xs text-[#374151] pt-0.5"
          >
            <span className="text-[#6B7280]">Filtre actif :</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EFF6FF] text-[#2563EB] font-medium text-xs border border-[#BFDBFE]">
              <span>
                {currentSort === 'name_asc' && 'Nom : de A à Z'}
                {currentSort === 'name_desc' && 'Nom : de Z à A'}
                {currentSort === 'care_oldest' && 'Ancienneté : Plus ancien d\'abord'}
                {currentSort === 'care_newest' && 'Ancienneté : Plus récent d\'abord'}
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Version Desktop : Tableau complet multi-colonnes */}
      <div className="hidden sm:block w-full">
        <div
          id="individual-files-header-row"
          className="flex flex-row items-center justify-between w-full px-3 pb-2 pt-2 font-poppins select-none text-xs border-b border-[#E5E7EB]"
        >
          <span className="flex-1 min-w-0 font-semibold text-[#111827] uppercase tracking-wider truncate pr-4">
            NOM COMPLET
          </span>
          <div className="flex flex-row items-center gap-8 flex-shrink-0">
            <span className="font-semibold text-[#111827] uppercase tracking-wider text-right w-40">
              IDENTIFIANT
            </span>
            <span className="font-semibold text-[#111827] uppercase tracking-wider text-right w-36">
              CONTACT
            </span>
            <span className="w-8 flex-shrink-0" aria-hidden="true" />
          </div>
        </div>

        <div id="patient-records-list-desktop" className="flex flex-col">
          {filteredRecords.length > 0 ? (
            filteredRecords.map((record) => (
              <div
                key={record.id}
                className="flex flex-row items-center justify-between w-full px-3 py-3.5 bg-transparent hover:bg-[#F9FAFB] border-b border-[#E5E7EB] transition-colors text-sm font-poppins"
              >
                <div className="flex-1 min-w-0 pr-4 flex flex-col justify-center">
                  <span className="font-semibold text-[#111827] truncate">
                    {(record.nom || '').toUpperCase()} {record.prenom}
                  </span>
                  <span className="text-[11px] text-[#9CA3AF] truncate">
                    {record.cabinet} {record.profession ? `• ${record.profession}` : ''}
                    {currentSort === 'care_oldest' && (
                      <span className="ml-1.5 font-medium text-[#2563EB]">
                        • 1er soin : {formatCareDate(getOldestCareTimestamp(record))}
                      </span>
                    )}
                    {currentSort === 'care_newest' && (
                      <span className="ml-1.5 font-medium text-[#2563EB]">
                        • Dernier soin : {formatCareDate(getNewestCareTimestamp(record))}
                      </span>
                    )}
                  </span>
                </div>

                <div className="flex flex-row items-center gap-8 flex-shrink-0">
                  <div className="w-40 flex justify-end items-center text-right">
                    <span className="font-mono text-xs sm:text-sm font-semibold text-[#111827] tracking-wider text-right">
                      {record.identifiant}
                    </span>
                  </div>

                  <div className="w-36 flex justify-end items-center text-right">
                    <span className="text-xs sm:text-sm text-[#374151] font-medium truncate text-right">
                      {record.telephone}
                    </span>
                  </div>

                  <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      data-record-menu-trigger="true"
                      aria-label={`Actions pour ${record.nom} ${record.prenom}`}
                      aria-expanded={openMenuRecordId === record.id}
                      title="Options"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (openMenuRecordId === record.id) {
                          setOpenMenuRecordId(null);
                          setMenuAnchorRect(null);
                        } else {
                          setMenuAnchorRect(e.currentTarget.getBoundingClientRect());
                          setOpenMenuRecordId(record.id);
                        }
                      }}
                      className="w-8 h-8 rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#E5E7EB]/50 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <MoreVerticalIcon className="w-4 h-4 text-current" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-xs text-[#9CA3AF]">
              {searchQuery
                ? 'Aucun résultat trouvé pour cette recherche.'
                : 'Aucune fiche individuelle enregistrée.'}
            </div>
          )}
        </div>
      </div>

      {/* Version Mobile : Essentiel uniquement (sans défilement horizontal) */}
      <div id="patient-records-list-mobile" className="sm:hidden flex flex-col w-full divide-y divide-[#E5E7EB]">
        {filteredRecords.length > 0 ? (
          filteredRecords.map((record) => (
            <div
              key={`m-${record.id}`}
              className="flex items-center justify-between w-full py-3 px-1 transition-colors"
            >
              <div className="flex-1 min-w-0 pr-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-semibold text-xs text-[#111827] truncate">
                    {(record.nom || '').toUpperCase()} {record.prenom}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-[#6B7280]">
                  <span className="truncate">{record.cabinet}</span>
                  {record.telephone && (
                    <>
                      <span className="text-[#D1D5DB]">•</span>
                      <span className="truncate">{record.telephone}</span>
                    </>
                  )}
                  {currentSort === 'care_oldest' && (
                    <>
                      <span className="text-[#D1D5DB]">•</span>
                      <span className="text-[#2563EB] font-medium truncate">
                        1er soin : {formatCareDate(getOldestCareTimestamp(record))}
                      </span>
                    </>
                  )}
                  {currentSort === 'care_newest' && (
                    <>
                      <span className="text-[#D1D5DB]">•</span>
                      <span className="text-[#2563EB] font-medium truncate">
                        Dernier soin : {formatCareDate(getNewestCareTimestamp(record))}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  data-record-menu-trigger="true"
                  aria-label={`Actions pour ${record.nom} ${record.prenom}`}
                  aria-expanded={openMenuRecordId === record.id}
                  title="Options"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (openMenuRecordId === record.id) {
                      setOpenMenuRecordId(null);
                      setMenuAnchorRect(null);
                    } else {
                      setMenuAnchorRect(e.currentTarget.getBoundingClientRect());
                      setOpenMenuRecordId(record.id);
                    }
                  }}
                  className="w-8 h-8 rounded-lg text-[#6B7280] active:bg-[#E5E7EB] flex items-center justify-center transition-colors cursor-pointer"
                >
                  <MoreVerticalIcon className="w-4 h-4 text-current" />
                </button>
              </div>
              </div>
          ))
        ) : (
          <div className="py-10 text-center text-xs text-[#9CA3AF]">
            {searchQuery
              ? 'Aucun résultat trouvé pour cette recherche.'
              : 'Aucune fiche individuelle enregistrée.'}
          </div>
        )}
      </div>
    </div>
          </motion.div>
        )}
      </AnimatePresence>

      <RecordActionsMenu
        isOpen={Boolean(openMenuRecordId && records.some((r) => r.id === openMenuRecordId))}
        anchorRect={menuAnchorRect}
        onClose={() => {
          setOpenMenuRecordId(null);
          setMenuAnchorRect(null);
        }}
        onView={() => {
          const target = records.find((r) => r.id === openMenuRecordId);
          if (target) setViewingRecord(target);
        }}
        onEdit={() => {
          const target = records.find((r) => r.id === openMenuRecordId);
          if (target) setEditingRecord(target);
        }}
        onDelete={() => {
          if (openMenuRecordId) {
            handleMoveToTrash(openMenuRecordId);
          }
        }}
      />

      <AddRecordModal
        isOpen={isAddModalOpen || Boolean(editingRecord)}
        initialRecord={editingRecord}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingRecord(null);
        }}
        existingRecordIds={existingRecordIds}
        onSubmit={(data) => {
          if (editingRecord) {
            handleUpdatePatient(editingRecord.id, data);
          } else {
            handleAddPatient(data);
          }
        }}
      />
    </div>
  );
};

