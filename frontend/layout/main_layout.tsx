import React from 'react';
import { SideNav } from '../navigation/side_nav';
import { BottomNav } from '../navigation/bottom_nav';
import { MenuItemData } from '../navigation/menu_types';

interface MainLayoutProps {
  menuItems: MenuItemData[];
  activeMenuId: string;
  onSelectMenuItem: (id: string) => void;
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  menuItems,
  activeMenuId,
  onSelectMenuItem,
  children,
}) => {
  return (
    <div id="main-layout" className="w-full h-screen bg-[#FFFFFF] overflow-hidden flex flex-col md:flex-row">
      <SideNav
        items={menuItems}
        activeId={activeMenuId}
        onSelectItem={onSelectMenuItem}
      />
      <main
        id="main-content"
        className="flex-1 h-full overflow-hidden bg-[#FFFFFF] flex flex-col min-w-0"
      >
        {children}
      </main>
      <BottomNav
        items={menuItems}
        activeId={activeMenuId}
        onSelectItem={onSelectMenuItem}
      />
    </div>
  );
};
