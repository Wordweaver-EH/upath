import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

interface BinDefinition {
  label: string;
  values: string[];
}

interface VariableBinning {
  variableName: string;
  strategy: 'raw' | 'custom';
  bins?: BinDefinition[];
}

interface VariableBinningModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedVariables: string[];
  variableData: Map<string, Map<string, string>>; // transcriptId -> variableName -> value
  onConfirm: (binning: VariableBinning[]) => void;
}

export const VariableBinningModal: React.FC<VariableBinningModalProps> = ({
  isOpen,
  onClose,
  selectedVariables,
  variableData,
  onConfirm
}) => {
  const [binningConfig, setBinningConfig] = useState<Map<string, VariableBinning>>(new Map());

  // Extract unique values for each selected variable
  const variableValues = useMemo(() => {
    const valueMap = new Map<string, Set<string>>();
    
    selectedVariables.forEach(varName => {
      const values = new Set<string>();
      variableData.forEach(transcriptVars => {
        const value = transcriptVars.get(varName);
        if (value) {
          values.add(value);
        }
      });
      valueMap.set(varName, values);
    });
    
    return valueMap;
  }, [selectedVariables, variableData]);

  // Initialize binning config
  useEffect(() => {
    const config = new Map<string, VariableBinning>();
    
    selectedVariables.forEach(varName => {
      const values = Array.from(variableValues.get(varName) || []).sort();
      
      // Auto-detect if numeric and suggest binning
      const isNumeric = values.every(v => !isNaN(Number(v)));
      
      if (isNumeric && values.length > 3) {
        // Suggest binning for numeric values
        const numValues = values.map(Number).sort((a, b) => a - b);
        const min = numValues[0];
        const max = numValues[numValues.length - 1];
        
        // Create terciles by default
        const third = (max - min) / 3;
        
        config.set(varName, {
          variableName: varName,
          strategy: 'custom',
          bins: [
            {
              label: 'Low',
              values: values.filter(v => Number(v) <= min + third)
            },
            {
              label: 'Medium',
              values: values.filter(v => Number(v) > min + third && Number(v) <= min + 2 * third)
            },
            {
              label: 'High',
              values: values.filter(v => Number(v) > min + 2 * third)
            }
          ].filter(bin => bin.values.length > 0)
        });
      } else {
        // Use raw values for non-numeric or small sets
        config.set(varName, {
          variableName: varName,
          strategy: 'raw'
        });
      }
    });
    
    setBinningConfig(config);
  }, [selectedVariables, variableValues]);

  const handleStrategyChange = useCallback((varName: string, strategy: 'raw' | 'custom') => {
    setBinningConfig(prev => {
      const newConfig = new Map(prev);
      const current = newConfig.get(varName);
      if (current) {
        current.strategy = strategy;
        if (strategy === 'raw') {
          delete current.bins;
        } else if (!current.bins) {
          // Initialize with empty bins
          current.bins = [{ label: '', values: [] }];
        }
      }
      return newConfig;
    });
  }, []);

  const handleBinLabelChange = useCallback((varName: string, binIndex: number, newLabel: string) => {
    setBinningConfig(prev => {
      const newConfig = new Map(prev);
      const current = newConfig.get(varName);
      if (current?.bins) {
        current.bins[binIndex].label = newLabel;
      }
      return newConfig;
    });
  }, []);

  const handleAddBin = useCallback((varName: string) => {
    setBinningConfig(prev => {
      const newConfig = new Map(prev);
      const current = newConfig.get(varName);
      if (current?.bins) {
        current.bins.push({ label: '', values: [] });
      }
      return newConfig;
    });
  }, []);

  const handleRemoveBin = useCallback((varName: string, binIndex: number) => {
    setBinningConfig(prev => {
      const newConfig = new Map(prev);
      const current = newConfig.get(varName);
      if (current?.bins && current.bins.length > 1) {
        current.bins.splice(binIndex, 1);
      }
      return newConfig;
    });
  }, []);

  const handleValueToggle = useCallback((varName: string, binIndex: number, value: string) => {
    setBinningConfig(prev => {
      const newConfig = new Map(prev);
      const current = newConfig.get(varName);
      if (current?.bins) {
        const bin = current.bins[binIndex];
        const valueIndex = bin.values.indexOf(value);
        if (valueIndex >= 0) {
          bin.values.splice(valueIndex, 1);
        } else {
          bin.values.push(value);
        }
      }
      return newConfig;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    const binningArray = Array.from(binningConfig.values());
    onConfirm(binningArray);
  }, [binningConfig, onConfirm]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto m-4">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Configure Variable Binning
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Choose how to group values for each selected variable. You can use raw values or create custom bins.
          </p>
        </div>

        <div className="p-6 space-y-6">
          {selectedVariables.map(varName => {
            const config = binningConfig.get(varName);
            const values = Array.from(variableValues.get(varName) || []).sort();
            
            if (!config) return null;
            
            return (
              <div key={varName} className="border rounded-lg p-4 space-y-4">
                <h3 className="text-lg font-semibold">{varName}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Unique values: {values.join(', ')}
                </p>
                
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name={`${varName}-strategy`}
                      checked={config.strategy === 'raw'}
                      onChange={() => handleStrategyChange(varName, 'raw')}
                      className="mr-2"
                    />
                    Use raw values
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name={`${varName}-strategy`}
                      checked={config.strategy === 'custom'}
                      onChange={() => handleStrategyChange(varName, 'custom')}
                      className="mr-2"
                    />
                    Create custom bins
                  </label>
                </div>
                
                {config.strategy === 'custom' && config.bins && (
                  <div className="space-y-3 ml-6">
                    {config.bins.map((bin, binIndex) => (
                      <div key={binIndex} className="border rounded p-3 space-y-2">
                        <div className="flex items-center space-x-2">
                          <Input
                            value={bin.label}
                            onChange={(e) => handleBinLabelChange(varName, binIndex, e.target.value)}
                            placeholder="Bin label (e.g., Low, High)"
                            className="flex-1"
                          />
                          {config.bins.length > 1 && (
                            <Button
                              onClick={() => handleRemoveBin(varName, binIndex)}
                              variant="secondary"
                              size="sm"
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {values.map(value => (
                            <label key={value} className="flex items-center">
                              <input
                                type="checkbox"
                                checked={bin.values.includes(value)}
                                onChange={() => handleValueToggle(varName, binIndex, value)}
                                className="mr-1"
                              />
                              <span className="text-sm">{value}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                    <Button
                      onClick={() => handleAddBin(varName)}
                      variant="secondary"
                      size="sm"
                    >
                      + Add Bin
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 p-6 flex justify-end space-x-3">
          <Button
            onClick={onClose}
            variant="secondary"
            size="sm"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            variant="primary"
            size="sm"
          >
            Confirm Binning
          </Button>
        </div>
      </div>
    </div>
  );
};