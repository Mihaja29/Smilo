import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  DentistryIcon,
  AssignmentIcon,
  CoverageIcon,
  SettingsIcon,
} from './navigation/navigation_icons';
import { MainLayout } from './layout/main_layout';
import { MobileSubNav } from './navigation/mobile_sub_nav';
import { MenuItemData } from './navigation/menu_types';
import { AppLogo } from './navigation/app_logo';
import { IndividualFilesView } from './fiches/individual_files_view';
import { CoverageView } from './assurances/coverage_view';
import { ProsthesesView } from './prostheses/prostheses_view';
import { SettingsView } from './settings/settings_view';
import { AuthProvider, useAuth } from './firebase/auth_context';
import { ThemeProvider } from './services/theme_context';
import { AuthLoginPage } from './firebase/auth_login_page';
import { getCabinetsApi } from './services/cabinets_api';
import { DiscussionBubble } from './discussions/discussion_bubble';

function AppContent() {
  const { user, isAuthenticated, loading } = useAuth();
  const [activeMenuId, setActiveMenuId] = useState<string>('individual_files');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  useEffect(() => {
    if (isAuthenticated && user?.uid) {
      getCabinetsApi().catch(() => {
        // Utilisation du cache local
      });
    }
  }, [isAuthenticated, user?.uid]);

  const handleSelectMenuItem = (id: string) => {
    if (id === 'settings') {
      setIsSettingsOpen(true);
      return;
    }
    setIsSettingsOpen(false);
    setActiveMenuId(id);
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[#FFFFFF] flex items-center justify-center font-poppins text-xs sm:text-sm text-[#6B7280]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
          <span>Chargement de Smilo...</span>
        </div>
      </div>
    );
  }

  const menuItems: MenuItemData[] = [
    {
      id: 'individual_files',
      label: 'Fiches individuelles',
      icon: AssignmentIcon,
    },
    {
      id: 'dental_prostheses',
      label: 'Prothèses dentaires',
      icon: DentistryIcon,
    },
    {
      id: 'coverage',
      label: 'Prise en charge',
      icon: CoverageIcon,
    },
    {
      id: 'settings',
      label: 'Paramètres',
      icon: SettingsIcon,
    },
  ];

  return (
    <MainLayout
      menuItems={menuItems}
      activeMenuId={isSettingsOpen ? 'settings' : activeMenuId}
      onSelectMenuItem={handleSelectMenuItem}
    >
      <header
        id="page-header-bar"
        className="h-14 sm:h-16 px-4 sm:px-6 md:px-8 flex items-center justify-between flex-shrink-0"
      >
        <AppLogo />
      </header>

      <div
        id="page-content-scroll"
        className="flex-1 overflow-y-auto no-scrollbar px-4 sm:px-6 md:px-8 pb-24 md:pb-6"
      >
        <div id="content-container" className="w-full space-y-4">
          <MobileSubNav
            items={menuItems}
            activeId={activeMenuId}
            onSelectItem={handleSelectMenuItem}
          />

          <AnimatePresence mode="wait">
            <motion.div
              key={activeMenuId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="w-full"
            >
              {activeMenuId === 'individual_files' && <IndividualFilesView />}

              {activeMenuId === 'dental_prostheses' && <ProsthesesView />}

              {(activeMenuId === 'coverage' || activeMenuId === 'coverage_havana' || activeMenuId === 'coverage_bcm') && (
                <CoverageView activeMenuId={activeMenuId} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <SettingsView
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {isAuthenticated && !isSettingsOpen && <DiscussionBubble />}

      <AnimatePresence>
        {!isAuthenticated && <AuthLoginPage />}
      </AnimatePresence>
    </MainLayout>
  );
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Erreur inattendue',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-[#FFFFFF] flex items-center justify-center p-6 font-poppins">
          <div className="max-w-md w-full bg-[#F8F9FA] border border-[#E5E7EB] rounded-2xl p-6 text-center space-y-4">
            <h1 className="text-lg font-bold text-[#111827]">
              Une erreur est survenue
            </h1>
            <p className="text-xs sm:text-sm text-[#374151] break-words">
              {this.state.message || "L'interface n'a pas pu se charger correctement."}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-[#FFFFFF] rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer"
            >
              Recharger la page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}
