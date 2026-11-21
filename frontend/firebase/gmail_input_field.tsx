import React, { useState } from 'react';
import { EyeIcon, EyeOffIcon } from '../navigation/navigation_icons';

interface GmailInputFieldProps {
  id?: string;
  label: string;
  type?: 'text' | 'email' | 'password';
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
}

// Champ de saisie avec bordure fine et etiquette flottante inspire de Gmail
export const GmailInputField: React.FC<GmailInputFieldProps> = ({
  id,
  label,
  type = 'text',
  value,
  onChange,
  autoComplete,
  required = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isPasswordType = type === 'password';
  const isFloating = isFocused || value.length > 0;

  return (
    <div className="relative w-full">
      <input
        id={id}
        type={isPasswordType && showPassword ? 'text' : type}
        value={value}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        className={`w-full h-12 pl-3.5 text-xs sm:text-sm text-[#111827] bg-[#FFFFFF] rounded-md transition-colors font-poppins focus:outline-none ${
          isPasswordType ? 'pr-11' : 'pr-3.5'
        } ${
          isFocused
            ? 'border-2 border-[#2563EB] px-[13px]'
            : 'border border-[#D1D5DB] hover:border-[#9CA3AF]'
        }`}
      />

      <label
        htmlFor={id}
        className={`absolute left-3 transition-all duration-150 pointer-events-none select-none font-poppins ${
          isFloating
            ? '-top-2 text-[11px] bg-[#FFFFFF] px-1 font-medium ' +
              (isFocused ? 'text-[#2563EB]' : 'text-[#6B7280]')
            : 'top-3.5 text-xs sm:text-sm text-[#6B7280]'
        }`}
      >
        {label}
      </label>

      {isPasswordType && (
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111827] p-1 transition-colors cursor-pointer"
          aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        >
          {showPassword ? (
            <EyeOffIcon className="w-4 h-4 text-current" />
          ) : (
            <EyeIcon className="w-4 h-4 text-current" />
          )}
        </button>
      )}
    </div>
  );
};
