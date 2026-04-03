import React, { useState, useEffect } from 'react';
import { ICellEditorParams } from 'ag-grid-community';

const TAG_OPTIONS = [
  'procedural_information',
  'experiential_content',
  'ambiguous_or_mixed'
];

export const TagsEditor: React.FC<ICellEditorParams> = (props) => {
  const [selectedTags, setSelectedTags] = useState<string[]>(props.value || []);

  useEffect(() => {
    // Focus on the first checkbox when opened
    const firstCheckbox = document.querySelector('.tags-editor-container input');
    if (firstCheckbox) {
      (firstCheckbox as HTMLInputElement).focus();
    }
  }, []);

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) {
        return prev.filter(t => t !== tag);
      } else {
        return [...prev, tag];
      }
    });
  };

  const getValue = () => {
    return selectedTags;
  };

  // AG-Grid will call this
  (props as any).api.getValue = getValue;

  return (
    <div className="tags-editor-container p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg">
      <div className="space-y-2">
        {TAG_OPTIONS.map(tag => (
          <label key={tag} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 p-1 rounded">
            <input
              type="checkbox"
              checked={selectedTags.includes(tag)}
              onChange={() => handleTagToggle(tag)}
              className="cursor-pointer"
            />
            <span className="text-sm select-none">
              {tag.replace(/_/g, ' ')}
            </span>
          </label>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => props.stopEditing()}
          className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Done
        </button>
      </div>
    </div>
  );
};