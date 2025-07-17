import React, { useState, useRef, useEffect } from 'react';

interface EditableTextAreaProps {
  value: string;
  onChange: (newValue: string) => void;
  theme: 'light' | 'dark';
  placeholder?: string;
  maxLength?: number;
  className?: string;
}

export const EditableTextArea: React.FC<EditableTextAreaProps> = ({
  value,
  onChange,
  theme,
  placeholder = 'Click to edit...',
  maxLength = 1000,
  className = ''
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    onChange(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
    } else if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    }
  };

  if (isEditing) {
    return (
      <div className="space-y-2">
        <textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={maxLength}
          className={`w-full p-2 text-sm rounded border-2 resize-none ${
            theme === 'dark'
              ? 'bg-dark-bg text-dark-text border-dark-accent'
              : 'bg-light-bg text-light-text border-light-accent'
          } ${className}`}
          rows={3}
        />
        <div className="flex gap-2 text-xs">
          <button
            onClick={handleSave}
            className={`px-2 py-1 rounded ${
              theme === 'dark'
                ? 'bg-dark-accent text-dark-bg hover:bg-dark-accent-hover'
                : 'bg-light-accent text-light-bg hover:bg-light-accent-hover'
            }`}
          >
            Save (Ctrl+Enter)
          </button>
          <button
            onClick={handleCancel}
            className={`px-2 py-1 rounded ${
              theme === 'dark'
                ? 'bg-dark-border text-dark-text hover:bg-dark-bg-alt'
                : 'bg-light-border text-light-text hover:bg-light-bg-alt'
            }`}
          >
            Cancel (Esc)
          </button>
          <span className="ml-auto text-light-sidenote dark:text-dark-sidenote">
            {editValue.length}/{maxLength}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={`cursor-pointer p-2 rounded text-sm transition-colors ${
        theme === 'dark'
          ? 'hover:bg-dark-bg-alt border border-transparent hover:border-dark-border'
          : 'hover:bg-light-bg-alt border border-transparent hover:border-light-border'
      } ${className}`}
    >
      {value || <span className="italic text-light-sidenote dark:text-dark-sidenote">{placeholder}</span>}
    </div>
  );
};