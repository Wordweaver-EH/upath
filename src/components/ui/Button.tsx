import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
  children,
  ...props
}) => {
  const baseClasses = "inline-flex items-center justify-center space-x-2 font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-150";
  
  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1.5 text-sm",
    lg: "px-4 py-2 text-base"
  };
  
  const variantClasses = {
    primary: "bg-light-accent hover:bg-light-accent-hover text-white dark:bg-dark-accent dark:hover:bg-dark-accent-hover dark:text-dark-bg focus:ring-light-accent dark:focus:ring-dark-accent",
    secondary: "bg-light-btn dark:bg-dark-btn text-light-text dark:text-dark-text hover:bg-light-border dark:hover:bg-dark-border border border-light-border dark:border-dark-border focus:ring-offset-light-bg-alt dark:focus:ring-offset-dark-bg-alt"
  };
  
  const disabledClasses = disabled ? "opacity-50 cursor-not-allowed" : "";
  
  return (
    <button
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${disabledClasses} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};