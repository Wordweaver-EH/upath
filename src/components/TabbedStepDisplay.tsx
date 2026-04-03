import React, { useState } from 'react';
import { Tab } from '@headlessui/react';
import { TranscriptProcessedData } from '../../types';

interface TabItem {
  id: string;
  label: string;
  data: any;
}

interface TabbedStepDisplayProps {
  processedData: Map<string, TranscriptProcessedData>;
  extractTabs: (processedData: Map<string, TranscriptProcessedData>) => TabItem[];
  renderContent: (tabData: any, theme: 'light' | 'dark') => React.ReactNode;
  theme: 'light' | 'dark';
  emptyMessage?: string;
}

function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export const TabbedStepDisplay: React.FC<TabbedStepDisplayProps> = ({ 
  processedData,
  extractTabs,
  renderContent,
  theme,
  emptyMessage = "No data available"
}) => {
  const tabs = extractTabs(processedData);
  
  if (tabs.length === 0) {
    return (
      <div className="text-center py-8 text-light-sidenote dark:text-dark-sidenote">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="w-full">
      <Tab.Group>
        <Tab.List className="flex space-x-1 rounded-lg bg-light-bg-alt dark:bg-dark-bg-alt p-1 mb-4">
          {tabs.map((tab) => (
            <Tab
              key={tab.id}
              className={({ selected }) =>
                classNames(
                  'w-full rounded-lg py-2.5 px-4 text-sm font-medium leading-5 transition-colors duration-200',
                  'ring-light-accent dark:ring-dark-accent focus:outline-none focus:ring-2',
                  selected
                    ? 'bg-light-bg dark:bg-dark-bg text-light-accent dark:text-dark-accent shadow'
                    : 'text-light-text dark:text-dark-text hover:bg-light-bg/50 dark:hover:bg-dark-bg/50'
                )
              }
            >
              {tab.label}
            </Tab>
          ))}
        </Tab.List>
        <Tab.Panels>
          {tabs.map((tab) => (
            <Tab.Panel
              key={tab.id}
              className={classNames(
                'rounded-lg bg-light-bg dark:bg-dark-bg',
                'ring-light-accent dark:ring-dark-accent focus:outline-none focus:ring-2'
              )}
            >
              {renderContent(tab.data, theme)}
            </Tab.Panel>
          ))}
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
};