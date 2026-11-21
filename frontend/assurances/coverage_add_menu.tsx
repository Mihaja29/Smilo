import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRightIcon } from '../navigation/navigation_icons';

interface CoverageAddMenuProps {
  isOpen: boolean;
  anchorRect: DOMRect | null;
  onSelectAssurance: () => void;
  onSelectCoverage: () => void;
  onClose: () => void;
}

// MENU CONTEXTUEL DE CHOIX D'AJOUT
export const CoverageAddMenu: React.FC<CoverageAddMenuProps> = ({
  isOpen,
  anchorRect,
  onSelectAssurance,
  onSelectCoverage,
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
      if ((target as Element).closest?.('#coverage-add-button')) {
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

  const menuWidth = 300;
  const menuHeight = 190;
  const spaceBelow = activeRect ? window.innerHeight - activeRect.bottom : 0;
  const openUpwards = activeRect
    ? spaceBelow < menuHeight && activeRect.top > menuHeight
    : false;
  const top = activeRect
    ? openUpwards
      ? Math.max(8, activeRect.top - menuHeight - 6)
      : activeRect.bottom + 6
    : 0;

  let left = activeRect ? activeRect.right - menuWidth : 0;
  if (activeRect && left < 12) {
    left = 12;
  }
  if (activeRect && left + menuWidth > window.innerWidth - 12) {
    left = Math.max(12, window.innerWidth - menuWidth - 12);
  }

  return createPortal(
    <AnimatePresence>
      {isOpen && activeRect && (
        <motion.div
          key="coverage-add-menu"
          ref={menuRef}
          role="menu"
          initial={{ opacity: 0, scale: 0.95, y: openUpwards ? 6 : -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: openUpwards ? 6 : -6 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          style={{
            top: `${top}px`,
            left: `${left}px`,
            transformOrigin: openUpwards ? 'bottom right' : 'top right',
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="fixed z-50 w-[300px] bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl shadow-xl p-2 font-poppins"
        >
          <div className="px-3 py-2 border-b border-[#E5E7EB]">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#111827]">
              Que souhaitez-vous créer ?
            </span>
          </div>

          <div className="py-1 space-y-1">
            <button
              type="button"
              id="choice-new-assurance-button"
              role="menuitem"
              onClick={() => {
                onClose();
                onSelectAssurance();
              }}
              className="w-full px-3 py-2.5 rounded-xl text-left flex items-center justify-between gap-3 hover:bg-[#F8F9FA] transition-colors cursor-pointer group"
            >
              <div className="flex flex-col min-w-0">
                <span className="text-xs sm:text-sm font-medium text-[#111827] truncate">
                  Nouvelle assurance
                </span>
                <span className="text-[11px] text-[#6B7280] leading-tight truncate">
                  Ajouter un organisme d'assurance
                </span>
              </div>
              <ChevronRightIcon className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#374151] flex-shrink-0" />
            </button>

            <button
              type="button"
              id="choice-new-coverage-button"
              role="menuitem"
              onClick={() => {
                onClose();
                onSelectCoverage();
              }}
              className="w-full px-3 py-2.5 rounded-xl text-left flex items-center justify-between gap-3 hover:bg-[#F8F9FA] transition-colors cursor-pointer group"
            >
              <div className="flex flex-col min-w-0">
                <span className="text-xs sm:text-sm font-medium text-[#111827] truncate">
                  Nouvelle prise en charge
                </span>
                <span className="text-[11px] text-[#6B7280] leading-tight truncate">
                  Créer un dossier de prise en charge
                </span>
              </div>
              <ChevronRightIcon className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#374151] flex-shrink-0" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
