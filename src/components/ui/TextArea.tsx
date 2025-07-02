import React from 'react';

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const TextArea: React.FC<TextAreaProps> = ({
  label,
  error,
  helperText,
  className = '',
  id,
  rows = 4,
  ...props
}) => {
  const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
  
  const baseClasses = "block w-full text-sm rounded-md shadow-sm bg-light-input-bg dark:bg-dark-input-bg text-light-text dark:text-dark-text placeholder-light-sidenote dark:placeholder-dark-sidenote focus:ring-light-accent dark:focus:ring-dark-accent focus:border-light-accent dark:focus:border-dark-accent border-light-border dark:border-dark-border";
  
  const errorClasses = error ? "border-red-500 dark:border-red-400 focus:ring-red-500 dark:focus:ring-red-400" : "";
  
  return (
    <div className="w-full">
      {label && (
        <label 
          htmlFor={textareaId} 
          className="block text-sm font-medium text-light-text dark:text-dark-text mb-1"
        >
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        rows={rows}
        className={`${baseClasses} ${errorClasses} ${className}`}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-sm text-light-sidenote dark:text-dark-sidenote">{helperText}</p>
      )}
    </div>
  );
};