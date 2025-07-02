import React from 'react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: Array<{
    value: string;
    label: string;
    disabled?: boolean;
  }>;
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  helperText,
  options,
  className = '',
  id,
  ...props
}) => {
  const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;
  
  const baseClasses = "block w-full text-sm rounded-md shadow-sm bg-light-input-bg dark:bg-dark-input-bg text-light-text dark:text-dark-text focus:ring-light-accent dark:focus:ring-dark-accent focus:border-light-accent dark:focus:border-dark-accent border-light-border dark:border-dark-border";
  
  const errorClasses = error ? "border-red-500 dark:border-red-400 focus:ring-red-500 dark:focus:ring-red-400" : "";
  
  return (
    <div className="w-full">
      {label && (
        <label 
          htmlFor={selectId} 
          className="block text-sm font-medium text-light-text dark:text-dark-text mb-1"
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`${baseClasses} ${errorClasses} ${className}`}
        {...props}
      >
        {options.map((option) => (
          <option 
            key={option.value} 
            value={option.value} 
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-sm text-light-sidenote dark:text-dark-sidenote">{helperText}</p>
      )}
    </div>
  );
};