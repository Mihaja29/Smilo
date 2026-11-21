import React from 'react';
import { MenuItemData } from './menu_types';

interface MobileSubNavProps {
  items: MenuItemData[];
  activeId: string;
  onSelectItem: (id: string) => void;
}

const HIDDEN_SUB_IDS = new Set(['coverage_havana', 'coverage_bcm']);

export const MobileSubNav: React.FC<MobileSubNavProps> = ({
  items,
  activeId,
  onSelectItem,
}) => {
  const activeParent = items.find(
    (item) =>
      (item.id === activeId || item.children?.some((child) => child.id === activeId)) &&
      item.children &&
      item.children.length > 0
  );

  const visibleChildren = activeParent?.children?.filter((child) => !HIDDEN_SUB_IDS.has(child.id)) ?? [];

  if (!activeParent || visibleChildren.length === 0) {
    return null;
  }

  return (
    <nav
      id="page-sub-nav"
      aria-label="Sous-menu de la page"
      className="w-full flex flex-wrap items-center gap-2 select-none pt-1"
    >
      {visibleChildren.map((child) => {
        const Icon = child.icon;
        const isActive = child.id === activeId;

        return (
          <button
            key={child.id}
            id={`mobile-sub-item-${child.id}`}
            type="button"
            onClick={() => onSelectItem(child.id)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium text-left transition-colors ${
              isActive
                ? 'bg-[#2563EB] text-white shadow-sm'
                : 'bg-[#F8F9FA] text-[#374151] border border-[#E5E7EB] hover:bg-[#F3F4F6]'
            }`}
          >
            {Icon && (
              <span
                data-active={isActive ? 'true' : undefined}
                className="flex items-center justify-center w-4 h-4 flex-shrink-0"
              >
                <Icon className="w-4 h-4 text-current" />
              </span>
            )}
            <span className="break-words leading-tight">{child.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
