import React, { useState } from 'react';
import {
  PriseEnChargeRecord,
  CoverageProcessingStatus,
} from '../services/coverages_api';
import { MoreVerticalIcon } from '../navigation/navigation_icons';
import { CoverageActionsMenu } from './coverage_actions_menu';
import { CoverageStatusModal } from './coverage_status_modal';
import { ViewCoverageModal } from './view_coverage_modal';
import { AddCoverageModal, CoverageFormData } from './add_coverage_modal';

interface CoverageListProps {
  coverages: PriseEnChargeRecord[];
  allCoverages?: PriseEnChargeRecord[];
  searchQuery: string;
  onUpdateStatus?: (
    id: string,
    nextStatus: CoverageProcessingStatus,
    dateObtentionCheque: string
  ) => void;
  onUpdateCoverage?: (id: string, data: CoverageFormData) => Promise<void> | void;
  onDeleteCoverage?: (id: string) => void;
}

// LISTE RESPONSIVE DES PRISES EN CHARGE ENREGISTREES
export const CoverageList: React.FC<CoverageListProps> = ({
  coverages,
  allCoverages,
  searchQuery,
  onUpdateStatus,
  onUpdateCoverage,
  onDeleteCoverage,
}) => {
  const [openMenuCoverageId, setOpenMenuCoverageId] = useState<string | null>(null);
  const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null);
  const [editingStatusCoverage, setEditingStatusCoverage] =
    useState<PriseEnChargeRecord | null>(null);
  const [viewingCoverage, setViewingCoverage] =
    useState<PriseEnChargeRecord | null>(null);
  const [editingCoverage, setEditingCoverage] =
    useState<PriseEnChargeRecord | null>(null);

  const activeMenuCoverage =
    coverages.find((item) => item.id === openMenuCoverageId) || null;

  const handleToggleMenu = (
    e: React.MouseEvent<HTMLButtonElement>,
    itemId: string
  ) => {
    e.stopPropagation();
    if (openMenuCoverageId === itemId) {
      setOpenMenuCoverageId(null);
      setMenuAnchorRect(null);
    } else {
      setMenuAnchorRect(e.currentTarget.getBoundingClientRect());
      setOpenMenuCoverageId(itemId);
    }
  };

  return (
    <div className="w-full font-poppins">
      <div className="hidden sm:block w-full">
        <div
          id="coverage-records-header-row"
          className="flex flex-row items-center justify-between w-full px-3 pb-2 pt-2 select-none text-xs border-b border-[#E5E7EB]"
        >
          <span className="w-44 lg:w-48 flex-shrink-0 font-semibold text-[#111827] uppercase tracking-wider truncate pr-4">
            N° DE PRISE EN CHARGE
          </span>
          <span className="flex-1 min-w-0 font-semibold text-[#111827] uppercase tracking-wider truncate pr-4">
            NOM(S) ET PRÉNOM(S)
          </span>
          <div className="flex flex-row items-center gap-6 flex-shrink-0">
            <span className="font-semibold text-[#111827] uppercase tracking-wider text-right w-36">
              ÉTAT DE TRAITEMENT
            </span>
            <span className="w-8 flex-shrink-0" aria-hidden="true" />
          </div>
        </div>

        <div id="coverage-records-list-desktop" className="flex flex-col">
          {coverages.length > 0 ? (
            coverages.map((item) => (
              <div
                key={item.id}
                className="flex flex-row items-center justify-between w-full px-3 py-3.5 bg-transparent hover:bg-[#F9FAFB] border-b border-[#E5E7EB] transition-colors text-sm"
              >
                <div className="w-44 lg:w-48 flex-shrink-0 pr-4 flex flex-col justify-center">
                  <span className="font-mono text-xs sm:text-sm font-semibold text-[#111827] tracking-wider truncate">
                    {item.numeroPriseEnCharge}
                  </span>
                </div>

                <div className="flex-1 min-w-0 pr-4 flex flex-col justify-center">
                  <span className="font-semibold text-[#111827] truncate">
                    {item.patientNomPrenom}
                  </span>
                </div>

                <div className="flex flex-row items-center gap-6 flex-shrink-0">
                  <div className="w-36 flex justify-end items-center">
                    <span className="text-xs sm:text-sm font-medium text-[#374151] text-right">
                      {item.etatTraitement === 'Reçu' ? 'Reçu' : 'En cours'}
                    </span>
                  </div>
                  <div
                    className="relative flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      data-coverage-menu-trigger="true"
                      aria-label={`Actions pour ${item.patientNomPrenom}`}
                      aria-expanded={openMenuCoverageId === item.id}
                      title="Options"
                      onClick={(e) => handleToggleMenu(e, item.id)}
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
                : 'Aucune prise en charge enregistrée.'}
            </div>
          )}
        </div>
      </div>

      <div
        id="coverage-records-list-mobile"
        className="sm:hidden flex flex-col w-full divide-y divide-[#E5E7EB]"
      >
        {coverages.length > 0 ? (
          coverages.map((item) => (
            <div
              key={`m-${item.id}`}
              className="flex items-center justify-between gap-2 w-full py-3 px-1"
            >
              <div className="flex flex-col min-w-0 pr-2 space-y-1">
                <span className="font-semibold text-xs text-[#111827] truncate">
                  {item.patientNomPrenom}
                </span>
                <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-[10px]">
                  <span className="font-mono font-medium text-[#2563EB]">
                    {item.numeroPriseEnCharge}
                  </span>
                  {item.numeroFacture && (
                    <>
                      <span className="text-[#D1D5DB]">•</span>
                      <span className="font-mono font-medium text-[#2563EB] truncate">
                        {item.numeroFacture}
                      </span>
                    </>
                  )}
                  <span className="text-[#D1D5DB]">•</span>
                  <span className="text-[#374151] font-medium">
                    {item.etatTraitement === 'Reçu' ? 'Reçu' : 'En cours'}
                  </span>
                </div>
              </div>

              <div
                className="relative flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  data-coverage-menu-trigger="true"
                  aria-label={`Actions pour ${item.patientNomPrenom}`}
                  aria-expanded={openMenuCoverageId === item.id}
                  title="Options"
                  onClick={(e) => handleToggleMenu(e, item.id)}
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
              : 'Aucune prise en charge enregistrée.'}
          </div>
        )}
      </div>

      <CoverageActionsMenu
        isOpen={Boolean(activeMenuCoverage)}
        anchorRect={menuAnchorRect}
        onClose={() => {
          setOpenMenuCoverageId(null);
          setMenuAnchorRect(null);
        }}
        onSelectView={() => {
          if (activeMenuCoverage) {
            setViewingCoverage(activeMenuCoverage);
          }
        }}
        onSelectEdit={() => {
          if (activeMenuCoverage) {
            setEditingCoverage(activeMenuCoverage);
          }
        }}
        onSelectStatus={() => {
          if (activeMenuCoverage) {
            setEditingStatusCoverage(activeMenuCoverage);
          }
        }}
        onSelectDelete={() => {
          if (activeMenuCoverage && onDeleteCoverage) {
            onDeleteCoverage(activeMenuCoverage.id);
          }
        }}
      />

      <ViewCoverageModal
        isOpen={Boolean(viewingCoverage)}
        coverage={viewingCoverage}
        onClose={() => setViewingCoverage(null)}
      />

      <AddCoverageModal
        isOpen={Boolean(editingCoverage)}
        initialCoverage={editingCoverage}
        existingInvoiceNumbers={(allCoverages ?? coverages)
          .filter((item) => item.id !== editingCoverage?.id)
          .map((item) => item.numeroFacture)
          .filter(Boolean)}
        onClose={() => setEditingCoverage(null)}
        onSubmit={async (data) => {
          if (editingCoverage && onUpdateCoverage) {
            await onUpdateCoverage(editingCoverage.id, data);
          }
        }}
      />

      <CoverageStatusModal
        isOpen={Boolean(editingStatusCoverage)}
        coverage={editingStatusCoverage}
        onClose={() => setEditingStatusCoverage(null)}
        onSave={(id, nextStatus, dateObtentionCheque) => {
          if (onUpdateStatus) {
            onUpdateStatus(id, nextStatus, dateObtentionCheque);
          }
        }}
      />
    </div>
  );
};
