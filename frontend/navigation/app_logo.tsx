import React from 'react';

interface AppLogoProps {
  className?: string;
}

export const AppLogo: React.FC<AppLogoProps> = ({ className = '' }) => {
  return (
    <div id="app-logo" className={`flex items-center select-none flex-shrink-0 ${className}`}>
      <span
        id="app-logo-text"
        className="font-caveat text-4xl sm:text-[46px] font-normal text-[#2563EB] leading-none"
      >
        Smilo
      </span>
    </div>
  );
};
