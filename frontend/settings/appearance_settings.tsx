import React, { useId } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
} from '../navigation/navigation_icons';
import { ThemePreference, useTheme } from '../services/theme_context';

const THEME_OPTIONS: {
  id: ThemePreference;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'light',
    label: 'Clair',
    icon: SunIcon,
  },
  {
    id: 'dark',
    label: 'Sombre',
    icon: MoonIcon,
  },
  {
    id: 'system',
    label: 'Système',
    icon: MonitorIcon,
  },
];

// PANNEAU DE REGLAGE DE L'APPARENCE ET DU THEME
export const AppearanceSettings: React.FC = () => {
  const { themePreference, setThemePreference } = useTheme();
  const instanceId = useId();

  const handleSelectTheme = (
    e: React.MouseEvent<HTMLButtonElement>,
    optionId: ThemePreference
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const hasPointerOrigin = e.clientX > 0 || e.clientY > 0;
    const origin = hasPointerOrigin
      ? { x: e.clientX, y: e.clientY }
      : { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    setThemePreference(optionId, origin);
  };

  return (
    <div className="space-y-3 font-poppins">
      <div className="px-1">
        <h3 className="text-[13px] font-semibold text-[#111827]">Thème</h3>
      </div>

      <div
        role="radiogroup"
        aria-label="Thème de l'application"
        className="space-y-1.5"
      >
        {THEME_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = themePreference === option.id;

          return (
            <motion.button
              key={option.id}
              id={`theme-option-${option.id}`}
              type="button"
              role="radio"
              aria-checked={isSelected}
              whileTap={{ scale: 0.985 }}
              transition={{ duration: 0.14 }}
              onClick={(e) => handleSelectTheme(e, option.id)}
              className={`relative w-full px-4 py-3 rounded-xl flex items-center justify-between gap-3 text-left transition-colors cursor-pointer overflow-hidden ${
                isSelected ? '' : 'hover:bg-[#F3F4F6]'
              }`}
            >
              {isSelected && (
                <motion.span
                  layoutId={`active-theme-pill-${instanceId}`}
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="absolute inset-0 bg-[#EFF6FF] rounded-xl pointer-events-none"
                  aria-hidden="true"
                />
              )}

              <div className="relative z-10 flex items-center gap-3 min-w-0">
                <motion.span
                  animate={
                    isSelected
                      ? { scale: [1, 1.18, 1], rotate: option.id === 'light' ? 20 : 0 }
                      : { scale: 1, rotate: 0 }
                  }
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-center justify-center flex-shrink-0"
                >
                  <Icon
                    className={`w-4.5 h-4.5 transition-colors ${
                      isSelected ? 'text-[#2563EB]' : 'text-[#374151]'
                    }`}
                  />
                </motion.span>
                <span
                  className={`block text-[13px] font-medium truncate transition-colors ${
                    isSelected ? 'text-[#2563EB]' : 'text-[#111827]'
                  }`}
                >
                  {option.label}
                </span>
              </div>

              <AnimatePresence initial={false}>
                {isSelected && (
                  <motion.span
                    key={`check-${option.id}`}
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    className="relative z-10 flex items-center justify-center flex-shrink-0"
                  >
                    <CheckIcon className="w-4 h-4 text-[#2563EB]" />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
