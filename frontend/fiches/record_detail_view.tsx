import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon, EditIcon, TrashIcon, CloseIcon } from '../navigation/navigation_icons';
import { PatientRecord, CareHistoryItem } from './record_id_utils';
import { AddCareModal } from './add_care_modal';

interface RecordDetailViewProps {
  record: PatientRecord;
  onBack: () => void;
  onAddCare?: (item: Omit<CareHistoryItem, 'id'>) => void;
  onUpdateCare?: (careId: string, item: Omit<CareHistoryItem, 'id'>) => void;
  onDeleteCare?: (careId: string) => void;
}

type DetailTabId = 'identite' | 'coordonnees' | 'administratif' | 'medical' | 'historique';

const tabContentVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 14 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -10 }),
};

// Page complète d'affichage d'une fiche individuelle patient avec onglets
export const RecordDetailView: React.FC<RecordDetailViewProps> = ({
  record,
  onBack,
  onAddCare,
  onUpdateCare,
  onDeleteCare,
}) => {
  const [activeTab, setActiveTab] = useState<DetailTabId>('identite');
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);
  const [isAddCareModalOpen, setIsAddCareModalOpen] = useState(false);
  const [editingCareItem, setEditingCareItem] = useState<CareHistoryItem | null>(null);
  const [isSelectingCareToEdit, setIsSelectingCareToEdit] = useState(false);
  const [isSelectingCareToDelete, setIsSelectingCareToDelete] = useState(false);
  const [deletingCareItem, setDeletingCareItem] = useState<CareHistoryItem | null>(null);
  const tabsNavRef = useRef<HTMLElement>(null);

  const tabs: { id: DetailTabId; label: string; mobileLabel: string }[] = [
    { id: 'identite', label: 'Identité', mobileLabel: 'Identité' },
    { id: 'coordonnees', label: 'Coordonnées', mobileLabel: 'Contact' },
    { id: 'administratif', label: 'Informations administratives', mobileLabel: 'Administratif' },
    { id: 'medical', label: 'Informations médicales', mobileLabel: 'Médical' },
    { id: 'historique', label: 'Historique des soins', mobileLabel: 'Soins' },
  ];

  const handleSelectTab = (nextTab: DetailTabId) => {
    if (nextTab === activeTab) return;
    const prevIdx = tabs.findIndex((t) => t.id === activeTab);
    const nextIdx = tabs.findIndex((t) => t.id === nextTab);
    setSlideDirection(nextIdx >= prevIdx ? 1 : -1);
    setIsSelectingCareToEdit(false);
    setIsSelectingCareToDelete(false);
    setActiveTab(nextTab);
  };

  const renderField = (label: string, value?: string, mono = false) => (
    <div className="px-4 sm:px-6 py-3.5 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 items-baseline transition-colors hover:bg-[#F8F9FA]/70">
      <dt className="text-xs font-medium text-[#6B7280]">
        {label}
      </dt>
      <dd
        className={`sm:col-span-2 text-xs sm:text-sm text-[#111827] font-medium break-words ${
          mono ? 'font-mono tracking-wider tabular-nums' : ''
        }`}
      >
        {value && value.trim().length > 0 ? (
          value
        ) : (
          <span className="text-[#9CA3AF] font-normal">Non renseigné</span>
        )}
      </dd>
    </div>
  );

  const renderTags = (label: string, items?: string[], emptyText = 'Aucun') => (
    <div className="px-4 sm:px-6 py-3.5 grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-4 items-baseline transition-colors hover:bg-[#F8F9FA]/70">
      <dt className="text-xs font-medium text-[#6B7280]">
        {label}
      </dt>
      <dd className="sm:col-span-2">
        {items && items.length > 0 ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm font-medium text-[#111827]">
            {items.map((item, idx) => (
              <React.Fragment key={`${label}-${idx}`}>
                {idx > 0 && (
                  <span className="text-[#9CA3AF] select-none" aria-hidden="true">
                    ·
                  </span>
                )}
                <span>{item}</span>
              </React.Fragment>
            ))}
          </div>
        ) : (
          <span className="text-xs sm:text-sm text-[#9CA3AF] font-normal">
            {emptyText}
          </span>
        )}
      </dd>
    </div>
  );

  const renderActesDisplay = (text?: string) => {
    if (!text || text.trim().length === 0) {
      return <span className="text-[#9CA3AF]">Non renseigné</span>;
    }
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((l) => (l.startsWith('-') ? l : `- ${l}`));

    if (lines.length === 0) {
      return <span className="text-[#9CA3AF]">Non renseigné</span>;
    }

    return (
      <div className="flex flex-col space-y-1 text-xs sm:text-sm text-[#374151]">
        {lines.map((line, idx) => (
          <span key={idx} className="block leading-relaxed">
            {line}
          </span>
        ))}
      </div>
    );
  };

  const formatMontantDisplay = (val?: string) => {
    if (!val || val.trim().length === 0) return '-';
    const trimmed = val.trim();
    if (/ar$/i.test(trimmed)) {
      const withoutAr = trimmed.replace(/ar$/i, '').trim();
      return withoutAr ? `${withoutAr} Ar` : 'Ar';
    }
    return `${trimmed} Ar`;
  };

  return (
    <div id="record-detail-page" className="w-full flex flex-col space-y-5 font-poppins">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          id="back-to-records-button"
          onClick={onBack}
          aria-label="Retour"
          title="Retour"
          className="w-9 h-9 p-0 bg-transparent text-[#374151] rounded-lg flex items-center justify-center flex-shrink-0 cursor-pointer"
        >
          <ArrowLeftIcon className="w-5 h-5 inline-flex! items-center! justify-center! text-[18px]! leading-none! text-current" />
        </button>

        <div className="flex flex-col items-end text-right min-w-0 flex-1">
          <h1 className="text-base sm:text-xl font-semibold text-[#111827] truncate max-w-full text-right">
            {(record.nom || '').toUpperCase()} {record.prenom}
          </h1>
          <span className="font-mono text-xs font-medium text-[#6B7280] tracking-wider text-right">
            {record.identifiant}
          </span>
        </div>
      </div>

      <div className="flex items-center">
        <button
          type="button"
          aria-label="Défiler les onglets vers la gauche"
          title="Défiler vers la gauche"
          onClick={() =>
            tabsNavRef.current?.scrollBy({ left: -180, behavior: 'smooth' })
          }
          className="lg:hidden w-7 h-7 mb-1.5 mr-1 rounded-md text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] flex items-center justify-center transition-colors flex-shrink-0"
        >
          <ChevronLeftIcon className="w-4 h-4 text-current" />
        </button>

        <motion.nav
          ref={tabsNavRef}
          layoutScroll
          aria-label="Sections de la fiche patient"
          onWheel={(e) => {
            if (e.deltaY !== 0) {
              e.currentTarget.scrollLeft += e.deltaY;
            }
          }}
          className="flex-1 min-w-0 flex items-center justify-start lg:justify-between gap-6 sm:gap-8 lg:gap-4 overflow-x-auto lg:overflow-visible no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleSelectTab(tab.id)}
                className={`relative pb-3 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 cursor-pointer ${
                  isActive
                    ? 'text-[#2563EB]'
                    : 'text-[#6B7280] hover:text-[#111827]'
                }`}
              >
                <span className="sm:hidden">{tab.mobileLabel}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                {isActive && (
                  <motion.span
                    layoutId="record-detail-tab-indicator"
                    transition={{ type: 'spring', stiffness: 450, damping: 35, mass: 0.8 }}
                    aria-hidden="true"
                    className="absolute left-0 right-0 bottom-1 h-[2.5px] bg-[#2563EB] rounded-full"
                  />
                )}
              </button>
            );
          })}
        </motion.nav>

        <button
          type="button"
          aria-label="Défiler les onglets vers la droite"
          title="Défiler vers la droite"
          onClick={() =>
            tabsNavRef.current?.scrollBy({ left: 180, behavior: 'smooth' })
          }
          className="lg:hidden w-7 h-7 mb-1.5 ml-1 rounded-md text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] flex items-center justify-center transition-colors flex-shrink-0"
        >
          <ChevronRightIcon className="w-4 h-4 text-current" />
        </button>
      </div>

      <AnimatePresence mode="wait" initial={false} custom={slideDirection}>
        <motion.div
          key={activeTab}
          custom={slideDirection}
          variants={tabContentVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        >
          {activeTab === 'identite' && (
            <section className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl overflow-hidden">
              <dl className="divide-y divide-[#E5E7EB]">
                {renderField('Identifiant', record.identifiant, true)}
                {renderField('Nom', record.nom.toUpperCase())}
                {renderField('Prénom', record.prenom)}
                {renderField('Sexe', record.sexe)}
                {renderField('Date de naissance', record.dateNaissance)}
              </dl>
            </section>
          )}

          {activeTab === 'coordonnees' && (
            <section className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl overflow-hidden">
              <dl className="divide-y divide-[#E5E7EB]">
                {renderField('Adresse', record.adresse)}
                {renderField('Téléphone', record.telephone)}
                {renderField('Email', record.email)}
              </dl>
            </section>
          )}

          {activeTab === 'administratif' && (
            <section className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl overflow-hidden">
              <dl className="divide-y divide-[#E5E7EB]">
                {renderField('Cabinet', record.cabinet)}
                {renderField('Profession', record.profession)}
                {renderField('Assurance', record.assurance)}
              </dl>
            </section>
          )}

          {activeTab === 'medical' && (
            <section className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl overflow-hidden">
              <dl className="divide-y divide-[#E5E7EB]">
                {renderTags('Allergies', record.allergies, 'Aucune')}
                {renderTags('Antécédents médicaux', record.antecedents, 'Aucun')}
                {renderTags('Traitements en cours', record.traitements, 'Aucun')}
                {(record.sexe === 'Féminin' ||
                  (record.grossesseAllaitement && record.grossesseAllaitement.length > 0)) &&
                  renderTags(
                    'Grossesse / Allaitement',
                    record.grossesseAllaitement,
                    'Aucune'
                  )}
              </dl>
            </section>
          )}

          {activeTab === 'historique' && (
            <div className="space-y-3">
              {record.historiqueSoins && record.historiqueSoins.length > 0 && (
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    id="edit-care-history-button"
                    aria-label={isSelectingCareToEdit ? 'Annuler la modification' : 'Modifier un soin'}
                    title={isSelectingCareToEdit ? 'Annuler' : 'Modifier'}
                    onClick={() => {
                      setIsSelectingCareToDelete(false);
                      if (record.historiqueSoins && record.historiqueSoins.length === 1) {
                        setIsSelectingCareToEdit(false);
                        setEditingCareItem(record.historiqueSoins[0]);
                      } else {
                        setIsSelectingCareToEdit((prev) => !prev);
                      }
                    }}
                    className={`w-9 h-9 p-0 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                      isSelectingCareToEdit
                        ? 'bg-transparent hover:bg-[#F3F4F6] text-[#2563EB]'
                        : 'bg-[#FFFFFF] hover:bg-[#F3F4F6] text-[#374151]'
                    }`}
                  >
                    {isSelectingCareToEdit ? (
                      <CloseIcon className="w-4 h-4 text-current" />
                    ) : (
                      <EditIcon className="w-4 h-4 text-current" />
                    )}
                  </button>

                  <button
                    type="button"
                    id="delete-care-history-button"
                    aria-label={isSelectingCareToDelete ? 'Annuler la suppression' : 'Supprimer un soin'}
                    title={isSelectingCareToDelete ? 'Annuler' : 'Supprimer'}
                    onClick={() => {
                      setIsSelectingCareToEdit(false);
                      if (record.historiqueSoins && record.historiqueSoins.length === 1) {
                        setIsSelectingCareToDelete(false);
                        setDeletingCareItem(record.historiqueSoins[0]);
                      } else {
                        setIsSelectingCareToDelete((prev) => !prev);
                      }
                    }}
                    className={`w-9 h-9 p-0 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                      isSelectingCareToDelete
                        ? 'bg-transparent hover:bg-[#F3F4F6] text-[#DC2626]'
                        : 'bg-[#FFFFFF] hover:bg-[#F3F4F6] text-[#374151]'
                    }`}
                  >
                    {isSelectingCareToDelete ? (
                      <CloseIcon className="w-4 h-4 text-current" />
                    ) : (
                      <TrashIcon className="w-4 h-4 text-current" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsSelectingCareToEdit(false);
                      setIsSelectingCareToDelete(false);
                      setEditingCareItem(null);
                      setIsAddCareModalOpen(true);
                    }}
                    className="h-9 px-3.5 bg-[#FFFFFF] border border-[#D1D5DB] hover:bg-[#F3F4F6] text-[#374151] rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <PlusIcon className="w-4 h-4 text-current" />
                    <span>Ajouter un soin</span>
                  </button>
                </div>
              )}

              <section className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl overflow-hidden">
                <div
                  onWheel={(e) => {
                    if (e.deltaY !== 0 && e.currentTarget.scrollWidth > e.currentTarget.clientWidth) {
                      e.currentTarget.scrollLeft += e.deltaY;
                    }
                  }}
                  className="overflow-x-auto no-scrollbar"
                >
                  <table className="w-full min-w-[640px] sm:min-w-0 text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F8F9FA] border-b border-[#E5E7EB] text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wider">
                        <th className="py-3 px-4 whitespace-nowrap">Date</th>
                        <th className="py-3 px-4">Actes, Produits et Médicaments</th>
                        <th className="py-3 px-4">Observations</th>
                        <th className="py-3 px-4 text-right whitespace-nowrap">Montants</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB] text-xs sm:text-sm text-[#374151]">
                      {record.historiqueSoins && record.historiqueSoins.length > 0 ? (
                        record.historiqueSoins.map((item) => (
                          <tr
                            key={item.id}
                            onClick={() => {
                              if (isSelectingCareToEdit) {
                                setEditingCareItem(item);
                                setIsSelectingCareToEdit(false);
                              } else if (isSelectingCareToDelete) {
                                setDeletingCareItem(item);
                                setIsSelectingCareToDelete(false);
                              }
                            }}
                            className={`transition-colors ${
                              isSelectingCareToEdit
                                ? 'hover:bg-[#EFF6FF] cursor-pointer'
                                : isSelectingCareToDelete
                                ? 'hover:bg-[#FEF2F2] cursor-pointer'
                                : 'hover:bg-[#F8F9FA]'
                            }`}
                          >
                            <td className="py-3 px-4 whitespace-nowrap font-medium text-[#111827]">
                              {item.date}
                            </td>
                            <td className="py-3 px-4">
                              {renderActesDisplay(item.actesProduitsMedicaments)}
                            </td>
                            <td className="py-3 px-4 whitespace-pre-line leading-relaxed">
                              {item.observations || <span className="text-[#9CA3AF]">Non renseigné</span>}
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-semibold text-[#111827]">
                              {formatMontantDisplay(item.montant)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={4}
                            className="py-10 px-4 text-center"
                          >
                            <div className="flex flex-col items-center justify-center space-y-3">
                              <span className="text-xs text-[#9CA3AF]">
                                Aucun soin enregistré.
                              </span>
                              <button
                                type="button"
                                id="add-care-empty-button"
                                onClick={() => setIsAddCareModalOpen(true)}
                                className="h-9 px-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-[#FFFFFF] rounded-lg text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 transition-colors"
                              >
                                <PlusIcon className="w-4 h-4 text-current" />
                                <span>Ajouter un soin</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <AddCareModal
        isOpen={isAddCareModalOpen || Boolean(editingCareItem)}
        initialItem={editingCareItem}
        onClose={() => {
          setIsAddCareModalOpen(false);
          setEditingCareItem(null);
        }}
        onSubmit={(item) => {
          if (editingCareItem) {
            if (onUpdateCare) {
              onUpdateCare(editingCareItem.id, item);
            }
          } else if (onAddCare) {
            onAddCare(item);
          }
        }}
      />

      <AnimatePresence>
        {deletingCareItem && (
          <motion.div
            key="delete-care-confirm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/40 font-poppins"
            onClick={() => setDeletingCareItem(null)}
          >
            <motion.div
              key="delete-care-confirm-card"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-md max-h-[94dvh] overflow-y-auto bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl shadow-xl p-4 sm:p-6 flex flex-col space-y-3 sm:space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-semibold text-[#111827]">
                Supprimer le soin
              </h3>
              <p className="text-xs sm:text-sm text-[#374151] leading-relaxed">
                Êtes-vous sûr de vouloir supprimer le soin du {deletingCareItem.date} ? Cette action est irréversible.
              </p>
              <div className="pt-3 flex flex-row items-center sm:justify-end gap-2 sm:gap-2.5">
                <button
                  type="button"
                  onClick={() => setDeletingCareItem(null)}
                  className="h-9 sm:h-10 px-4 flex-1 sm:flex-none sm:w-auto bg-[#FFFFFF] border border-[#D1D5DB] hover:bg-[#F3F4F6] text-[#374151] rounded-lg text-xs sm:text-sm font-medium transition-colors text-center cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onDeleteCare) {
                      onDeleteCare(deletingCareItem.id);
                    }
                    setDeletingCareItem(null);
                  }}
                  className="h-9 sm:h-10 px-4 flex-1 sm:flex-none sm:w-auto bg-[#DC2626] hover:bg-[#B91C1C] text-[#FFFFFF] rounded-lg text-xs sm:text-sm font-medium transition-colors text-center cursor-pointer"
                >
                  Supprimer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
