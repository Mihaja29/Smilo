import React, { useEffect, useState } from 'react';

interface UserAvatarProps {
  photoURL?: string | null;
  displayName?: string | null;
  email?: string | null;
  sizeClass?: string;
  textClass?: string;
  extraClass?: string;
}

// AVATAR UTILISATEUR AVEC PHOTO GOOGLE OU INITIALE
export const UserAvatar: React.FC<UserAvatarProps> = ({
  photoURL,
  displayName,
  email,
  sizeClass = 'w-9 h-9',
  textClass = 'text-sm',
  extraClass = '',
}) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [photoURL]);

  const initial = (displayName || email || 'U').charAt(0).toUpperCase();
  const altLabel = displayName || email || 'Profil utilisateur';
  const showImage = Boolean(photoURL && !imgError);

  if (showImage && photoURL) {
    return (
      <img
        src={photoURL}
        alt={altLabel}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 border border-[#E5E7EB] bg-[#F8F9FA] ${extraClass}`}
      />
    );
  }

  return (
    <span
      className={`${sizeClass} rounded-full bg-[#2563EB] text-[#FFFFFF] flex items-center justify-center ${textClass} font-bold flex-shrink-0 font-poppins ${extraClass}`}
    >
      {initial}
    </span>
  );
};
