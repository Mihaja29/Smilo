import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { CoverageAssuranceOption } from '../services/assurances_api';
import { CoverageProcessingStatus } from '../services/coverages_api';

interface CoverageVisibilityMenuProps {
  isOpen: boolean;
  anchorRect: DOMRect | null;
  assurances: CoverageAssuranceOption[];
  hiddenIds: string[];
  hiddenStatuses: CoverageProcessingStatus[];
  onChangeHiddenIds: (nextHiddenIds: string[]) => void;
  onChangeHiddenStatuses: (nextHiddenStatuses: CoverageProcessingStatus[]) => void;
  onClose: () => void;
}

const STATUS_VISIBILITY_OPTIONS: {
  value: CoverageProcessingStatus;
  label: string;
}[] = [
  { value: 'En cours', label: 'En cours' },
  { value: 'Reçu', label: 'Terminer' },
];

// MENU CONTEXTUEL DE VISIBILITE DES ASSURANCES ET ETATS
export const CoverageVisibilityMenu: React.FC<CoverageVisibilityMenuProps> = ({
  isOpen,
  anchorRect,
  assurances,
  hiddenIds,
  hiddenStatuses,
  onChangeHiddenIds,
  onChangeHiddenStatuses,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuRef.current && menuRef.current.contains(target)) {
        return;
      }
      if ((target as Element).closest?.('#coverage-visibility-button')) {
        return;
      }
      onClose();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const lastAnchorRef = useRef<DOMRect | null>(null);
  if (anchorRect) {
    lastAnchorRef.current = anchorRect;
  }
  const activeRect = anchorRect ?? lastAnchorRef.current;

  const menuWidth = 260;
  const menuHeight = 350;
  const spaceBelow = activeRect ? window.innerHeight - activeRect.bottom : 0;
  const openUpwards = activeRect ? spaceBelow < menuHeight && activeRect.top > menuHeight : false;
  const top = activeRect
    ? openUpwards
      ? Math.max(8, activeRect.top - menuHeight - 6)
      : activeRect.bottom + 6
    : 0;

  let left = activeRect ? activeRect.left : 0;
  if (activeRect && left + menuWidth > window.innerWidth - 12) {
    left = Math.max(12, window.innerWidth - menuWidth - 12);
  }

  const hiddenSet = new Set(hiddenIds);
  const hiddenStatusSet = new Set(hiddenStatuses);
  const allStatusesHidden =
    hiddenStatusSet.has('En cours') && hiddenStatusSet.has('Reçu');
  const allAssurancesHidden =
    assurances.length > 0 && assurances.every((item) => hiddenSet.has(item.id));
  const allShown = hiddenIds.length === 0 && hiddenStatuses.length === 0;
  const allHidden =
    (assurances.length > 0 ? allAssurancesHidden && allStatusesHidden : allStatusesHidden);

  const handleShowAll = () => {
    onChangeHiddenIds([]);
    onChangeHiddenStatuses([]);
  };

  const handleHideAll = () => {
    onChangeHiddenIds(assurances.map((item) => item.id));
    onChangeHiddenStatuses(['En cours', 'Reçu']);
  };

  const toggleAssurance = (id: string) => {
    if (hiddenSet.has(id)) {
      onChangeHiddenIds(hiddenIds.filter((item) => item !== id));
    } else {
      onChangeHiddenIds([...hiddenIds, id]);
    }
  };

  const toggleStatus = (status: CoverageProcessingStatus) => {
    if (hiddenStatusSet.has(status)) {
      onChangeHiddenStatuses(hiddenStatuses.filter((item) => item !== status));
    } else {
      onChangeHiddenStatuses([...hiddenStatuses, status]);
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && activeRect && (
        <motion.div
          key="coverage-visibility-menu"
          ref={menuRef}
          role="menu"
          initial={{ opacity: 0, scale: 0.95, y: openUpwards ? 6 : -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: openUpwards ? 6 : -6 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          style={{
            top: `${top}px`,
            left: `${left}px`,
            transformOrigin: openUpwards ? 'bottom left' : 'top left',
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="fixed z-50 w-64 bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl shadow-xl p-2 font-poppins"
        >
          <div className="px-3 py-2 border-b border-[#E5E7EB]">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#111827]">
              Affichage des assurances
            </span>
          </div>

          <div className="py-1 space-y-0.5 max-h-80 overflow-y-auto">
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={allShown}
              onClick={handleShowAll}
              className="w-full px-3 py-2 rounded-xl text-left flex items-center gap-2.5 hover:bg-[#F8F9FA] transition-colors cursor-pointer"
            >
              <input
                type="checkbox"
                checked={allShown}
                readOnly
                tabIndex={-1}
                className="w-4 h-4 rounded text-[#2563EB] border-[#D1D5DB] focus:ring-[#2563EB] accent-[#2563EB] pointer-events-none flex-shrink-0"
              />
              <span className="text-xs sm:text-sm font-medium text-[#111827]">
                Afficher tout
              </span>
            </button>

            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={allHidden}
              onClick={handleHideAll}
              className="w-full px-3 py-2 rounded-xl text-left flex items-center gap-2.5 hover:bg-[#F8F9FA] transition-colors cursor-pointer"
            >
              <input
                type="checkbox"
                checked={allHidden}
                readOnly
                tabIndex={-1}
                className="w-4 h-4 rounded text-[#2563EB] border-[#D1D5DB] focus:ring-[#2563EB] accent-[#2563EB] pointer-events-none flex-shrink-0"
              />
              <span className="text-xs sm:text-sm font-medium text-[#111827]">
                Masquer tout
              </span>
            </button>

            <div className="my-1 border-t border-[#E5E7EB]" />

            <div className="px-3 pt-1 pb-0.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                État de traitement
              </span>
            </div>

            {STATUS_VISIBILITY_OPTIONS.map((option) => {
              const isVisible = !hiddenStatusSet.has(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={isVisible}
                  onClick={() => toggleStatus(option.value)}
                  className="w-full px-3 py-2 rounded-xl text-left flex items-center gap-2.5 hover:bg-[#F8F9FA] transition-colors cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={isVisible}
                    readOnly
                    tabIndex={-1}
                    className="w-4 h-4 rounded text-[#2563EB] border-[#D1D5DB] focus:ring-[#2563EB] accent-[#2563EB] pointer-events-none flex-shrink-0"
                  />
                  <span className="text-xs sm:text-sm font-medium text-[#111827] truncate">
                    {option.label}
                  </span>
                </button>
              );
            })}

            {assurances.length > 0 && (
              <>
                <div className="my-1 border-t border-[#E5E7EB]" />
                <div className="px-3 pt-1 pb-0.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                    Assurances
                  </span>
                </div>
              </>
            )}

            {assurances.map((item) => {
              const isVisible = !hiddenSet.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={isVisible}
                  onClick={() => toggleAssurance(item.id)}
                  className="w-full px-3 py-2 rounded-xl text-left flex items-center gap-2.5 hover:bg-[#F8F9FA] transition-colors cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={isVisible}
                    readOnly
                    tabIndex={-1}
                    className="w-4 h-4 rounded text-[#2563EB] border-[#D1D5DB] focus:ring-[#2563EB] accent-[#2563EB] pointer-events-none flex-shrink-0"
                  />
                  <span className="text-xs sm:text-sm font-medium text-[#111827] truncate">
                    {item.displayLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
