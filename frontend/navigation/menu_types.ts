import React from 'react';

export interface MenuItemData {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  children?: MenuItemData[];
}

export interface SideNavProps {
  items: MenuItemData[];
  activeId: string;
  onSelectItem: (id: string) => void;
}

