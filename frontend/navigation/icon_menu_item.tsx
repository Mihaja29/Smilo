import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MenuItemData } from './menu_types';

interface IconMenuItemProps {
  item: MenuItemData;
  isActive: boolean;
  activeId: string;
  onSelectItem: (id: string) => void;
}

// Composant élément de menu icône avec animations de survol et tiret actif fluide
export const IconMenuItem: React.FC<IconMenuItemProps> = ({
  item,
  isActive,
  activeId,
  onSelectItem,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = item.icon;
  const hasChildren = Boolean(item.children && item.children.length > 0);

  const handleMouseEnter = () => {
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    setIsOpen(false);
  };

  return (
    <div
      id={`icon-menu-wrapper-${item.id}`}
      className="relative flex items-center justify-center w-full"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <motion.button
        id={`icon-menu-button-${item.id}`}
        onClick={() => onSelectItem(item.id)}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.1 }}
        aria-label={item.label}
        className={`relative w-full h-11 px-3 rounded-lg flex items-center justify-start gap-3 text-left transition-colors font-poppins cursor-pointer ${
          isActive
            ? 'bg-[#F3F4F6] text-[#2563EB] font-semibold'
            : 'text-[#374151] hover:bg-[#F3F4F6] hover:text-[#111827] font-medium'
        }`}
      >
        {Icon && (
          <span className="flex items-center justify-center w-5 h-5 flex-shrink-0">
            <Icon className="w-5 h-5 text-current" />
          </span>
        )}
        <span className="text-[13px] truncate leading-tight">
          {item.label}
        </span>
      </motion.button>

      <AnimatePresence>
        {isOpen && hasChildren && (
          <motion.div
            id={`flyout-${item.id}`}
            initial={{ opacity: 0, x: -8, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-full top-0 pl-2.5 z-50 font-poppins"
          >
            <div className="w-64 bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg shadow-lg py-2 flex flex-col">
              <div className="px-3.5 py-2 border-b border-[#E5E7EB] bg-[#F8F9FA] rounded-t-lg">
                <span className="text-xs font-semibold text-[#111827] uppercase tracking-wide">
                  {item.label}
                </span>
              </div>
              <div className="py-1 px-1 flex flex-col space-y-0.5">
                {item.children?.map((child) => {
                  const ChildIcon = child.icon;
                  const isChildActive = child.id === activeId;
                  return (
                    <motion.button
                      key={child.id}
                      id={`submenu-item-${child.id}`}
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ duration: 0.1 }}
                      onClick={() => {
                        onSelectItem(child.id);
                        setIsOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2.5 rounded-md ${
                        isChildActive
                          ? 'bg-[#F3F4F6] text-[#2563EB] font-semibold'
                          : 'text-[#374151] hover:bg-[#F3F4F6] hover:text-[#2563EB]'
                      }`}
                    >
                      {ChildIcon && (
                        <span
                          className={`w-4 h-4 flex-shrink-0 flex items-center justify-center ${
                            isChildActive ? 'text-[#2563EB]' : 'text-[#6B7280]'
                          }`}
                        >
                          <ChildIcon className="w-4 h-4 text-current" />
                        </span>
                      )}
                      <span className="truncate">{child.label}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
