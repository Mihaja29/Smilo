import React from 'react';
import { LayoutGroup, motion } from 'motion/react';
import { SideNavProps } from './menu_types';
import { IconMenuItem } from './icon_menu_item';
import { UserAvatar } from './user_avatar';
import { useAuth } from '../firebase/auth_context';

// BARRE DE NAVIGATION LATÉRALE
export const SideNav: React.FC<SideNavProps> = ({
  items,
  activeId,
  onSelectItem,
}) => {
  const { user } = useAuth();
  const topItems = items.filter((item) => item.id !== 'settings');
  const bottomItems = items.filter((item) => item.id === 'settings');

  const userName = user?.displayName || user?.email || 'Paramètres';
  const userEmail = user?.email || 'Compte praticien actif';

  return (
    <aside
      id="left-side-nav"
      className="relative h-full w-54 bg-[#FFFFFF] border-r border-[#E5E7EB] hidden md:flex flex-col flex-shrink-0 select-none overflow-visible z-30"
    >
      <LayoutGroup id="side-nav-layout-group">
        <nav
          id="side-nav-items"
          className="flex-1 flex flex-col justify-between pt-2.5 pb-2 px-2 w-full overflow-visible"
        >
          <div className="flex flex-col space-y-1.5 w-full overflow-visible">
            {topItems.map((item) => {
              const isItemActive =
                item.id === activeId ||
                Boolean(item.children?.some((child) => child.id === activeId));

              return (
                <IconMenuItem
                  key={item.id}
                  item={item}
                  isActive={isItemActive}
                  activeId={activeId}
                  onSelectItem={onSelectItem}
                />
              );
            })}
          </div>

          {bottomItems.length > 0 && (
            <div className="flex flex-col space-y-1.5 w-full overflow-visible pt-2 pb-1">
              {bottomItems.map((item) => {
                const isItemActive =
                  item.id === activeId ||
                  Boolean(item.children?.some((child) => child.id === activeId));

                return (
                  <div
                    key={item.id}
                    id={`icon-menu-wrapper-${item.id}`}
                    className="relative flex items-center justify-center w-full"
                  >
                    <motion.button
                      id={`icon-menu-button-${item.id}`}
                      type="button"
                      onClick={() => onSelectItem(item.id)}
                      whileTap={{ scale: 0.98 }}
                      transition={{ duration: 0.1 }}
                      title={userName}
                      aria-label={userName}
                      className={`relative w-full px-2.5 py-2 rounded-xl flex items-center gap-2.5 text-left transition-colors font-poppins cursor-pointer ${
                        isItemActive
                          ? 'bg-[#F3F4F6]'
                          : 'hover:bg-[#F3F4F6]'
                      }`}
                    >
                      <UserAvatar
                        photoURL={user?.photoURL}
                        displayName={user?.displayName}
                        email={user?.email}
                        sizeClass="w-9 h-9"
                        textClass="text-sm"
                      />
                      <div className="min-w-0 flex-1">
                        <span
                          className={`block text-[13px] font-semibold truncate leading-tight ${
                            isItemActive ? 'text-[#2563EB]' : 'text-[#111827]'
                          }`}
                        >
                          {userName}
                        </span>
                        <span className="block text-[11px] text-[#6B7280] truncate leading-tight mt-0.5">
                          {userEmail}
                        </span>
                      </div>
                    </motion.button>
                  </div>
                );
              })}
            </div>
          )}
        </nav>
      </LayoutGroup>
    </aside>
  );
};
