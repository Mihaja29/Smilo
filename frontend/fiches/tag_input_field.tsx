import React, { useState } from 'react';
import { CloseIcon, PlusIcon } from '../navigation/navigation_icons';

interface TagInputFieldProps {
  label: string;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder: string;
  isOptional?: boolean;
}

// Section du composant de champ de saisie par etiquettes
export const TagInputField: React.FC<TagInputFieldProps> = ({
  label,
  tags,
  onTagsChange,
  placeholder,
  isOptional = true,
}) => {
  const [inputValue, setInputValue] = useState('');

  const addTag = (tagText: string) => {
    const cleaned = tagText.trim();
    if (cleaned && !tags.includes(cleaned)) {
      onTagsChange([...tags, cleaned]);
    }
    setInputValue('');
  };

  const removeTag = (tagToRemove: string) => {
    onTagsChange(tags.filter((t) => t !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    }
  };

  return (
    <div className="flex flex-col space-y-2 font-poppins">
      <div className="flex items-center justify-between">
        <label className="text-[11px] sm:text-xs font-semibold text-[#111827] uppercase tracking-wide">
          {label}
        </label>
        {isOptional && (
          <span className="text-[11px] text-[#9CA3AF] font-normal">
            Facultatif
          </span>
        )}
      </div>

      <div className="flex flex-row items-center gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 h-9 sm:h-10 px-3 sm:px-3.5 bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg text-xs sm:text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors"
        />
        <button
          type="button"
          onClick={() => addTag(inputValue)}
          disabled={!inputValue.trim()}
          aria-label="Ajouter l'étiquette"
          className="h-9 sm:h-10 px-3 bg-[#FFFFFF] border border-[#D1D5DB] hover:bg-[#F3F4F6] disabled:opacity-40 disabled:hover:bg-[#FFFFFF] text-[#374151] rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors flex-shrink-0"
        >
          <PlusIcon className="w-3.5 h-3.5 text-current" />
          <span className="hidden sm:inline">Ajouter</span>
        </button>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#F8F9FA] border border-[#E5E7EB] text-[#111827]"
            >
              <span>{tag}</span>
              <button
                type="button"
                onClick={() => removeTag(tag)}
                aria-label={`Supprimer ${tag}`}
                className="w-3.5 h-3.5 rounded flex items-center justify-center text-[#9CA3AF] hover:text-[#DC2626] transition-colors"
              >
                <CloseIcon className="w-3 h-3 text-current" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

