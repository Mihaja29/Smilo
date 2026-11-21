import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { RestoreIcon, TrashIcon } from '../navigation/navigation_icons';

interface TrashActionsMenuProps {
  isOpen: boolean;
  anchorRect: DOMRect | null;
  onClose: () => void;
  onRestore: () => void;
  onDeletePermanent: () => void;
}

// Menu contextuel des actions sur une fiche en corbeille
export const TrashActionsMenu: React.FC<TrashActionsMenuProps> = ({
  isOpen,
  anchorRect,
  onClose,
  onRestore,
  onDeletePermanent,
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
      if ((target as Element).closest?.('[data-trash-menu-trigger="true"]')) {
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

  const menuHeight = 88;
  const spaceBelow = activeRect ? window.innerHeight - activeRect.bottom : 0;
  const openUpwards = activeRect ? spaceBelow < menuHeight && activeRect.top > menuHeight : false;
  const top = activeRect
    ? openUpwards
      ? Math.max(8, activeRect.top - menuHeight - 6)
      : activeRect.bottom + 6
    : 0;
  const right = activeRect ? Math.max(12, window.innerWidth - activeRect.right) : 12;

  return createPortal(
    <AnimatePresence>
      {isOpen && activeRect && (
        <motion.div
          key="trash-actions-menu"
          ref={menuRef}
          role="menu"
          initial={{ opacity: 0, scale: 0.95, y: openUpwards ? 6 : -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: openUpwards ? 6 : -6 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          style={{
            top: `${top}px`,
            right: `${right}px`,
            transformOrigin: openUpwards ? 'bottom right' : 'top right',
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="fixed z-50 w-52 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl shadow-lg py-1.5 font-poppins"
        >
      <div
        className={`absolute right-3 w-3 h-3 bg-[#FFFFFF] border-[#E5E7EB] rotate-45 ${
          openUpwards
            ? '-bottom-1.5 border-r border-b'
            : '-top-1.5 border-l border-t'
        }`}
        aria-hidden="true"
      />

      <button
        type="button"
        role="menuitem"
        onClick={(e) => {
          e.stopPropagation();
          onRestore();
          onClose();
        }}
        className="w-full px-3.5 py-2 text-left text-xs sm:text-sm text-[#374151] hover:bg-[#F3F4F6] hover:text-[#111827] flex items-center gap-2.5 transition-colors cursor-pointer"
      >
        <RestoreIcon className="w-4 h-4 text-[#374151] flex-shrink-0" />
        <span>Restaurer</span>
      </button>

      <button
        type="button"
        role="menuitem"
        onClick={(e) => {
          e.stopPropagation();
          onDeletePermanent();
          onClose();
        }}
        className="w-full px-3.5 py-2 text-left text-xs sm:text-sm text-[#DC2626] hover:bg-[#FEF2F2] flex items-center gap-2.5 transition-colors cursor-pointer"
      >
        <TrashIcon className="w-4 h-4 text-[#DC2626] flex-shrink-0" />
        <span>Supprimer définitivement</span>
      </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
