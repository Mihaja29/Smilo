import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PatientRecord } from './record_id_utils';
import { ArrowLeftIcon, MoreVerticalIcon, TrashIcon } from '../navigation/navigation_icons';
import { TrashActionsMenu } from './trash_actions_menu';

interface TrashViewProps {
  trashRecords: PatientRecord[];
  onBack: () => void;
  onRestore: (id: string) => void;
  onDeletePermanent: (id: string) => void;
  onEmptyTrash: () => void;
}

// Vue et gestion des fiches placées en corbeille
export const TrashView: React.FC<TrashViewProps> = ({
  trashRecords,
  onBack,
  onRestore,
  onDeletePermanent,
  onEmptyTrash,
}) => {
  const [confirmTarget, setConfirmTarget] = useState<PatientRecord | 'all' | null>(null);
  const [openMenuRecordId, setOpenMenuRecordId] = useState<string | null>(null);
  const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null);

  const handleConfirmAction = () => {
    if (confirmTarget === 'all') {
      onEmptyTrash();
    } else if (confirmTarget) {
      onDeletePermanent(confirmTarget.id);
    }
    setConfirmTarget(null);
  };

  return (
    <div className="w-full flex flex-col space-y-4 font-poppins">
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#E5E7EB]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="w-9 h-9 rounded-lg bg-transparent text-[#374151] flex items-center justify-center cursor-pointer"
            title="Retour aux fiches actives"
          >
            <ArrowLeftIcon className="w-5 h-5 text-current" />
          </button>
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-[#111827]">
              Corbeille
            </h2>
            <p className="text-xs text-[#6B7280]">
              {trashRecords.length} {trashRecords.length > 1 ? 'fiches en attente' : 'fiche en attente'}
            </p>
          </div>
        </div>

        {trashRecords.length > 0 && (
          <button
            type="button"
            onClick={() => setConfirmTarget('all')}
            className="h-9 px-3 bg-transparent hover:bg-[#F3F4F6] text-[#374151] hover:text-[#111827] rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
          >
            <TrashIcon className="w-4 h-4 text-[#DC2626] flex-shrink-0" />
            <span>Vider la corbeille</span>
          </button>
        )}
      </div>

      {trashRecords.length === 0 ? (
        <div className="py-16 text-center text-xs sm:text-sm text-[#9CA3AF]">
          La corbeille est vide.
        </div>
      ) : (
        <div className="flex flex-col space-y-2.5">
          {trashRecords.map((record) => (
            <div
              key={record.id}
              className="p-3 sm:p-4 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl flex flex-row items-center justify-between gap-2.5 sm:gap-4 shadow-xs"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-xs sm:text-base text-[#111827] truncate">
                    {record.nom.toUpperCase()} {record.prenom}
                  </span>
                  <span className="font-mono text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 bg-[#F3F4F6] text-[#374151] rounded-md font-medium flex-shrink-0 text-right">
                    {record.identifiant}
                  </span>
                </div>
                <div className="text-[11px] sm:text-xs text-[#6B7280] mt-1 flex items-center justify-between gap-2">
                  <span className="truncate">
                    <span className="hidden sm:inline">Téléphone : </span>
                    {record.telephone}
                  </span>
                  {record.deletedAt && (
                    <span className="whitespace-nowrap flex-shrink-0 text-right">
                      Supprimé le {new Date(record.deletedAt).toLocaleDateString('fr-FR')}
                    </span>
                  )}
                </div>
              </div>

              <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  data-trash-menu-trigger="true"
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
                  className="w-8 h-8 rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#E5E7EB]/50 active:bg-[#E5E7EB] flex items-center justify-center transition-colors cursor-pointer"
                >
                  <MoreVerticalIcon className="w-4 h-4 text-current" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <TrashActionsMenu
        isOpen={Boolean(openMenuRecordId && trashRecords.some((r) => r.id === openMenuRecordId))}
        anchorRect={menuAnchorRect}
        onClose={() => {
          setOpenMenuRecordId(null);
          setMenuAnchorRect(null);
        }}
        onRestore={() => {
          if (openMenuRecordId) {
            onRestore(openMenuRecordId);
          }
        }}
        onDeletePermanent={() => {
          const target = trashRecords.find((r) => r.id === openMenuRecordId);
          if (target) setConfirmTarget(target);
        }}
      />

      {/* Modale de confirmation */}
      <AnimatePresence>
        {confirmTarget && (
          <motion.div
            key="trash-confirm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/40 font-poppins"
            onClick={() => setConfirmTarget(null)}
          >
            <motion.div
              key="trash-confirm-card"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-md max-h-[94dvh] overflow-y-auto bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl shadow-xl p-4 sm:p-6 flex flex-col space-y-3 sm:space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-semibold text-[#111827]">
                {confirmTarget === 'all'
                  ? 'Vider la corbeille'
                  : 'Suppression définitive'}
              </h3>
              <p className="text-xs sm:text-sm text-[#374151] leading-relaxed">
                {confirmTarget === 'all'
                  ? 'Êtes-vous sûr de vouloir supprimer définitivement toutes les fiches de la corbeille ? Cette action est irréversible.'
                  : `Êtes-vous sûr de vouloir supprimer définitivement le dossier de ${confirmTarget.nom.toUpperCase()} ${confirmTarget.prenom} (${confirmTarget.identifiant}) ? Cette action est irréversible.`}
              </p>
              <div className="pt-3 flex flex-row items-center sm:justify-end gap-2 sm:gap-2.5">
                <button
                  type="button"
                  onClick={() => setConfirmTarget(null)}
                  className="h-9 sm:h-10 px-4 flex-1 sm:flex-none sm:w-auto bg-[#FFFFFF] border border-[#D1D5DB] hover:bg-[#F3F4F6] text-[#374151] rounded-lg text-xs sm:text-sm font-medium transition-colors text-center cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAction}
                  className="h-9 sm:h-10 px-4 flex-1 sm:flex-none sm:w-auto bg-[#DC2626] hover:bg-[#B91C1C] text-[#FFFFFF] rounded-lg text-xs sm:text-sm font-medium transition-colors text-center cursor-pointer"
                >
                  Supprimer définitivement
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
