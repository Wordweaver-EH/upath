import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { ICellEditorComp, ICellEditorParams } from 'ag-grid-community';

// Define the allowed temporal phase values based on constants.tsx
const TEMPORAL_PHASES = [
  'Beginning',
  'Early-Middle',
  'Core Event',
  'Late-Middle',
  'Ending',
  'Reflection',
  'Transition',
  'Other'
];

export const TemporalPhaseEditor = forwardRef<ICellEditorComp, ICellEditorParams>((props, ref) => {
  const [value, setValue] = useState(props.value || 'Beginning');

  useImperativeHandle(ref, () => ({
    getValue() {
      return value;
    },
    isCancelBeforeStart() {
      return false;
    },
    isCancelAfterEnd() {
      return false;
    }
  }));

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      props.stopEditing();
    } else if (e.key === 'Escape') {
      props.stopEditing(true);
    }
  };

  return (
    <select
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      className="w-full h-full px-2 py-1 border-0 outline-none focus:ring-2 
        focus:ring-light-accent dark:focus:ring-dark-accent bg-white dark:bg-gray-800"
      autoFocus
    >
      {TEMPORAL_PHASES.map(phase => (
        <option key={phase} value={phase}>
          {phase}
        </option>
      ))}
    </select>
  );
});