import React from 'react';
import { MenuItemData } from './menu_types';
import { UserAvatar } from './user_avatar';
import { useAuth } from '../firebase/auth_context';

interface BottomNavProps {
  items: MenuItemData[];
  activeId: string;
  onSelectItem: (id: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  items,
  activeId,
  onSelectItem,
}) => {
  const { user } = useAuth();
  const userName = user?.displayName || user?.email || 'Paramètres';

  return (
    <nav
      id="bottom-mobile-nav"
      className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#F8F9FA] border-t border-[#E5E7EB] flex items-center justify-around px-2 z-40 select-none"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.id === activeId ||
          item.children?.some((child) => child.id === activeId);
        const isProfileItem = item.id === 'settings';

        return (
          <button
            key={item.id}
            id={`bottom-nav-item-${item.id}`}
            type="button"
            onClick={() => onSelectItem(item.id)}
            title={isProfileItem ? userName : item.label}
            aria-label={isProfileItem ? userName : item.label}
            className={`flex items-center justify-center w-12 h-12 rounded-full transition-colors font-poppins ${
              isActive
                ? 'text-[#2563EB] bg-transparent'
                : 'text-[#6B7280] hover:text-[#111827] hover:bg-[#E5E7EB]/20'
            }`}
          >
            {isProfileItem ? (
              <UserAvatar
                photoURL={user?.photoURL}
                displayName={user?.displayName}
                email={user?.email}
                sizeClass="w-8 h-8"
                textClass="text-xs"
                extraClass={
                  isActive ? 'ring-2 ring-[#2563EB] ring-offset-2 ring-offset-[#F8F9FA]' : ''
                }
              />
            ) : (
              Icon && (
                <span
                  data-active={isActive ? 'true' : undefined}
                  className="flex items-center justify-center w-6 h-6"
                >
                  <Icon className="w-5 h-5 text-current" />
                </span>
              )
            )}
          </button>
        );
      })}
    </nav>
  );
};
