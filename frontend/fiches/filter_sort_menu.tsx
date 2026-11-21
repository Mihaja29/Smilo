import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckIcon,
  RotateCcwIcon,
} from '../navigation/navigation_icons';

export type FilterSortOption =
  | 'none'
  | 'name_asc'
  | 'name_desc'
  | 'care_oldest'
  | 'care_newest';

interface FilterSortMenuProps {
  isOpen: boolean;
  anchorRect: DOMRect | null;
  currentSort: FilterSortOption;
  onSelectSort: (option: FilterSortOption) => void;
  onClose: () => void;
}

// Menu contextuel de tri et filtrage des fiches
export const FilterSortMenu: React.FC<FilterSortMenuProps> = ({
  isOpen,
  anchorRect,
  currentSort,
  onSelectSort,
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
      if ((target as Element).closest?.('#individual-files-filter-button')) {
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

  const menuWidth = 320;
  const menuHeight = 330;
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

  const sortItems: {
    id: FilterSortOption;
    label: string;
    subLabel: string;
  }[] = [
    {
      id: 'name_asc',
      label: 'Nom : de A à Z',
      subLabel: 'Ordre alphabétique croissant',
    },
    {
      id: 'name_desc',
      label: 'Nom : de Z à A',
      subLabel: 'Ordre alphabétique décroissant',
    },
    {
      id: 'care_oldest',
      label: 'Ancienneté : Plus ancien',
      subLabel: 'Date la plus ancienne dans l\'historique des soins',
    },
    {
      id: 'care_newest',
      label: 'Ancienneté : Plus récent',
      subLabel: 'Date la plus récente dans l\'historique des soins',
    },
  ];

  return createPortal(
    <AnimatePresence>
      {isOpen && activeRect && (
        <motion.div
          key="filter-sort-menu"
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
          className="fixed z-50 w-80 bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl shadow-xl p-2 font-poppins"
        >
      <div className="px-3 py-2 border-b border-[#E5E7EB] flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#111827]">
          Filtrer et trier
        </span>
        {currentSort !== 'none' && (
          <button
            type="button"
            onClick={() => {
              onSelectSort('none');
              onClose();
            }}
            className="text-[11px] text-[#2563EB] hover:text-[#1D4ED8] font-medium flex items-center gap-1 cursor-pointer transition-colors"
          >
            <RotateCcwIcon className="w-3 h-3 text-current" />
            <span>Réinitialiser</span>
          </button>
        )}
      </div>

      <div className="py-1 space-y-1">
        {sortItems.map((item) => {
          const isSelected = currentSort === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              onClick={() => {
                onSelectSort(item.id);
                onClose();
              }}
              className={`w-full px-3 py-2.5 rounded-xl text-left flex items-start justify-between gap-3 transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-[#F3F4F6] border border-transparent'
                  : 'hover:bg-[#F8F9FA] border border-transparent'
              }`}
            >
              <div className="flex items-start min-w-0">
                <div className="flex flex-col min-w-0">
                  <span
                    className={`text-xs sm:text-sm font-medium leading-snug truncate ${
                      isSelected ? 'text-[#2563EB]' : 'text-[#111827]'
                    }`}
                  >
                    {item.label}
                  </span>
                  <span className="text-[11px] text-[#6B7280] leading-tight line-clamp-1">
                    {item.subLabel}
                  </span>
                </div>
              </div>

              {isSelected && (
                <span className="mt-1 text-[#2563EB] flex-shrink-0">
                  <CheckIcon className="w-4 h-4" />
                </span>
              )}
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
