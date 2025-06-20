import React, { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '../constants';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  contentMaxHeight?: string; // e.g., '24rem' (max-h-96), 'none'
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, children, defaultOpen = false, contentMaxHeight = '24rem' }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="mb-4 border border-light-border dark:border-dark-border rounded-md bg-light-bg-alt dark:bg-dark-bg-alt">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-3 hover:bg-light-border dark:hover:bg-dark-border focus:outline-none rounded-t-md transition-colors duration-150"
        aria-expanded={isOpen}
      >
        <h3 className="text-md font-semibold text-light-accent dark:text-dark-accent">{title}</h3>
        {isOpen ? ChevronUpIcon : ChevronDownIcon}
      </button>
      {isOpen && (
        <div 
          className="p-3 bg-light-bg dark:bg-dark-bg rounded-b-md overflow-y-auto"
          style={{ maxHeight: contentMaxHeight }}
        >
          {children}
        </div>
      )}
    </div>
  );
};

export default CollapsibleSection;