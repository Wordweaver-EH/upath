import React, { useState, useEffect, useCallback } from 'react';
import { Select } from './ui/Select';

/**
 * Interface for Gemini model data from backend
 */
interface GeminiModel {
  id: string;           // "models/gemini-2.5-flash-preview-04-17"
  value: string;        // "gemini-2.5-flash-preview-04-17" (clean ID for use)
  label: string;        // "Gemini 2.5 Flash (Preview)" (display name)
  description?: string; // Model description
  maxInputTokens?: number;
  maxOutputTokens?: number;
}

/**
 * Props for ModelSelector component
 */
interface ModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * ModelSelector Component
 * 
 * Fetches available Gemini models from backend and displays them in a dropdown.
 * Provides secure model selection without exposing API keys to frontend.
 */
export const ModelSelector: React.FC<ModelSelectorProps> = ({
  value,
  onChange,
  className = '',
  disabled = false
}) => {
  const [models, setModels] = useState<GeminiModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch models from backend API
   */
  const fetchModels = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:3001/api/gemini/models');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
      }
      
      const modelsData: GeminiModel[] = await response.json();
      setModels(modelsData);
      
      // If current selected value is not in the list, select first available model
      if (modelsData.length > 0 && !modelsData.some(m => m.value === value)) {
        onChange(modelsData[0].value);
      }
      
    } catch (err) {
      console.error('Failed to fetch Gemini models:', err);
      
      // Fallback to hardcoded models if backend fails
      const fallbackModels: GeminiModel[] = [
        {
          id: 'models/gemini-2.5-flash-preview-04-17',
          value: 'gemini-2.5-flash-preview-04-17',
          label: 'Gemini 2.5 Flash (Preview)',
          description: 'Latest Gemini 2.5 Flash model (fallback)'
        },
        {
          id: 'models/gemini-1.5-flash',
          value: 'gemini-1.5-flash',
          label: 'Gemini 1.5 Flash',
          description: 'Fast and efficient Gemini model (fallback)'
        },
        {
          id: 'models/gemini-1.5-pro',
          value: 'gemini-1.5-pro',
          label: 'Gemini 1.5 Pro',
          description: 'High-performance Gemini model (fallback)'
        }
      ];
      
      setModels(fallbackModels);
      setError('Using fallback model list. Backend unavailable.');
      
      // Ensure current value is valid with fallback models
      if (!fallbackModels.some(m => m.value === value)) {
        onChange(fallbackModels[0].value);
      }
    } finally {
      setLoading(false);
    }
  }, [value, onChange]);

  // Fetch models on component mount
  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  /**
   * Handle model selection change
   */
  const handleModelChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = event.target.value;
    onChange(selectedValue);
  };

  // Loading state
  if (loading) {
    return (
      <div className="w-full">
        <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-1">
          AI Model
        </label>
        <div className="block w-full text-sm rounded-md shadow-sm bg-light-input-bg dark:bg-dark-input-bg text-light-text dark:text-dark-text border-light-border dark:border-dark-border px-3 py-2">
          Loading models...
        </div>
      </div>
    );
  }

  // Convert models to Select component format
  const options = models.map(model => ({
    value: model.value,
    label: model.label,
    disabled: false
  }));

  return (
    <div className={`w-full ${className}`}>
      <div className="relative">
        <Select
          label="AI Model"
          value={value}
          onChange={handleModelChange}
          options={options}
          disabled={disabled || loading}
          error={error ? "Backend unavailable - using fallback models" : undefined}
        />
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center top-7">
          <span 
            className="text-light-sidenote dark:text-dark-sidenote cursor-pointer group" 
            title={(() => {
              const selectedModel = models.find(m => m.value === value);
              if (selectedModel?.description) {
                return `${selectedModel.label}: ${selectedModel.description}`;
              }
              return "Choose the Gemini model for analysis";
            })()}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
            </svg>
          </span>
        </div>
      </div>
      
      {/* Refresh button for development */}
      {process.env.NODE_ENV === 'development' && (
        <button
          onClick={fetchModels}
          disabled={loading}
          className="mt-2 text-xs text-light-accent dark:text-dark-accent hover:underline disabled:opacity-50"
        >
          Refresh Models
        </button>
      )}
    </div>
  );
};