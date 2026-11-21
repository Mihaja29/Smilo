import React, { useState } from 'react';
import { MoreVerticalIcon } from '../navigation/navigation_icons';
import { ProsthesisRecord } from './prostheses_types';
import { ProsthesisProcessingStatus } from './prostheses_visibility_menu';
import { ProsthesesActionsMenu } from './prostheses_actions_menu';
import { ViewProsthesisModal } from './view_prosthesis_modal';
import { ProsthesisStatusModal } from './prosthesis_status_modal';
import { AddProsthesisModal, ProsthesisFormData } from './add_prosthesis_modal';

interface ProsthesesListProps {
  prostheses: ProsthesisRecord[];
  searchQuery: string;
  onUpdateProsthesis: (id: string, data: ProsthesisFormData) => void;
  onUpdateStatus: (id: string, etatTraitement: ProsthesisProcessingStatus) => void;
  onDeleteProsthesis: (id: string) => void;
}

// TABLEAU RESPONSIVE DES PROTHESES DENTAIRES
export const ProsthesesList: React.FC<ProsthesesListProps> = ({
  prostheses,
  searchQuery,
  onUpdateProsthesis,
  onUpdateStatus,
  onDeleteProsthesis,
}) => {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null);
  const [viewingProsthesis, setViewingProsthesis] =
    useState<ProsthesisRecord | null>(null);
  const [editingProsthesis, setEditingProsthesis] =
    useState<ProsthesisRecord | null>(null);
  const [editingStatusProsthesis, setEditingStatusProsthesis] =
    useState<ProsthesisRecord | null>(null);

  const activeMenuProsthesis =
    prostheses.find((item) => item.id === openMenuId) || null;

  const handleToggleMenu = (
    e: React.MouseEvent<HTMLButtonElement>,
    itemId: string
  ) => {
    e.stopPropagation();
    if (openMenuId === itemId) {
      setOpenMenuId(null);
      setMenuAnchorRect(null);
    } else {
      setMenuAnchorRect(e.currentTarget.getBoundingClientRect());
      setOpenMenuId(itemId);
    }
  };

  return (
    <div className="w-full font-poppins">
      <div className="hidden sm:block w-full">
        <div
          id="prostheses-records-header-row"
          className="flex flex-row items-center justify-between w-full px-3 pb-2 pt-2 select-none text-xs border-b border-[#E5E7EB]"
        >
          <span className="flex-1 min-w-0 font-semibold text-[#111827] uppercase tracking-wider truncate pr-4">
            NOM(S) ET PRÉNOM(S)
          </span>
          <div className="flex flex-row items-center gap-6 flex-shrink-0">
            <span className="font-semibold text-[#111827] uppercase tracking-wider text-right w-32 lg:w-36">
              MONTANT
            </span>
            <span className="font-semibold text-[#111827] uppercase tracking-wider text-right w-36">
              ÉTAT DE TRAITEMENT
            </span>
            <span className="w-8 flex-shrink-0" aria-hidden="true" />
          </div>
        </div>

        <div id="prostheses-records-list-desktop" className="flex flex-col">
          {prostheses.length > 0 ? (
            prostheses.map((item) => (
              <div
                key={item.id}
                className="flex flex-row items-center justify-between w-full px-3 py-3.5 bg-transparent hover:bg-[#F9FAFB] border-b border-[#E5E7EB] transition-colors text-sm"
              >
                <div className="flex-1 min-w-0 pr-4 flex flex-col justify-center">
                  <span className="font-semibold text-[#111827] truncate">
                    {item.patientNomPrenom}
                  </span>
                </div>

                <div className="flex flex-row items-center gap-6 flex-shrink-0">
                  <div className="w-32 lg:w-36 flex justify-end items-center text-right">
                    <span className="text-xs sm:text-sm font-semibold text-[#111827] text-right truncate">
                      {item.montant}
                    </span>
                  </div>
                  <div className="w-36 flex justify-end items-center">
                    <span className="text-xs sm:text-sm font-medium text-[#374151] text-right">
                      {item.etatTraitement === 'Terminer' ? 'Terminer' : 'En cours'}
                    </span>
                  </div>
                  <div
                    className="relative flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      data-prosthesis-menu-trigger="true"
                      aria-label={`Actions pour ${item.patientNomPrenom}`}
                      aria-expanded={openMenuId === item.id}
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
                : 'Aucune prothèse dentaire enregistrée.'}
            </div>
          )}
        </div>
      </div>

      <div
        id="prostheses-records-list-mobile"
        className="sm:hidden flex flex-col w-full divide-y divide-[#E5E7EB]"
      >
        {prostheses.length > 0 ? (
          prostheses.map((item) => (
            <div
              key={`m-${item.id}`}
              className="flex items-center justify-between gap-2 w-full py-3 px-1"
            >
              <div className="flex flex-col min-w-0 pr-2 space-y-1">
                <span className="font-semibold text-xs text-[#111827] truncate">
                  {item.patientNomPrenom}
                </span>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="font-medium text-[#111827]">
                    {item.montant}
                  </span>
                  <span className="text-[#D1D5DB]">•</span>
                  <span className="text-[#374151] font-medium">
                    {item.etatTraitement === 'Terminer' ? 'Terminer' : 'En cours'}
                  </span>
                </div>
              </div>

              <div
                className="relative flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  data-prosthesis-menu-trigger="true"
                  aria-label={`Actions pour ${item.patientNomPrenom}`}
                  aria-expanded={openMenuId === item.id}
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
              : 'Aucune prothèse dentaire enregistrée.'}
          </div>
        )}
      </div>

      <ProsthesesActionsMenu
        isOpen={Boolean(activeMenuProsthesis)}
        anchorRect={menuAnchorRect}
        onClose={() => {
          setOpenMenuId(null);
          setMenuAnchorRect(null);
        }}
        onSelectView={() => {
          if (activeMenuProsthesis) {
            setViewingProsthesis(activeMenuProsthesis);
          }
        }}
        onSelectEdit={() => {
          if (activeMenuProsthesis) {
            setEditingProsthesis(activeMenuProsthesis);
          }
        }}
        onSelectStatus={() => {
          if (activeMenuProsthesis) {
            setEditingStatusProsthesis(activeMenuProsthesis);
          }
        }}
        onSelectDelete={() => {
          if (activeMenuProsthesis) {
            onDeleteProsthesis(activeMenuProsthesis.id);
          }
        }}
      />

      <ViewProsthesisModal
        isOpen={Boolean(viewingProsthesis)}
        prosthesis={viewingProsthesis}
        onClose={() => setViewingProsthesis(null)}
      />

      <AddProsthesisModal
        isOpen={Boolean(editingProsthesis)}
        initialProsthesis={editingProsthesis}
        onClose={() => setEditingProsthesis(null)}
        onSubmit={(data) => {
          if (editingProsthesis) {
            onUpdateProsthesis(editingProsthesis.id, data);
          }
        }}
      />

      <ProsthesisStatusModal
        isOpen={Boolean(editingStatusProsthesis)}
        prosthesis={editingStatusProsthesis}
        onClose={() => setEditingStatusProsthesis(null)}
        onSave={(id, etatTraitement) => {
          onUpdateStatus(id, etatTraitement);
        }}
      />
    </div>
  );
};
