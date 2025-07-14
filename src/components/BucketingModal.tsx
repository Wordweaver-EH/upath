import React, { useState, useMemo, useEffect } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { useTranscriptStore } from '../stores/transcriptStore';

interface BucketingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigureBucketing: (enabled: boolean, ivField: 'suggestion' | 'score', eventField: 'suggestion' | 'score') => void;
}

interface BucketPreview {
  bucketId: string;
  transcriptCount: number;
  transcripts: string[];
}

// Type guard for field sources
const isFieldSource = (value: string): value is 'suggestion' | 'score' => {
  return value === 'suggestion' || value === 'score';
};

export const BucketingModal: React.FC<BucketingModalProps> = ({
  isOpen,
  onClose,
  onConfigureBucketing
}) => {
  const { bucketIvField, bucketEventField } = useSettingsStore();
  const { processedData } = useTranscriptStore();
  
  const [selectedIvField, setSelectedIvField] = useState<'suggestion' | 'score'>(bucketIvField);
  const [selectedEventField, setSelectedEventField] = useState<'suggestion' | 'score'>(bucketEventField);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Memoize validation and data extraction
  const { validationError, validData, validTranscriptCount, invalidTranscriptCount } = useMemo(() => {
    const invalidTranscripts: string[] = [];
    const data: Array<{ transcriptId: string; ivValue: string; eventValue: string; }> = [];

    processedData.forEach((transcriptData, transcriptId) => {
      const header = transcriptData.p_neg1_1_output?.parsed_header;
      if (!header?.iv_value || !header?.event_value || 
          header.iv_value.trim() === '' || header.event_value.trim() === '') {
        invalidTranscripts.push(transcriptId);
      } else {
        data.push({ 
          transcriptId, 
          ivValue: header.iv_value, 
          eventValue: header.event_value 
        });
      }
    });

    const invalidCount = invalidTranscripts.length;
    const validCount = data.length;

    if (invalidCount > 0) {
      const errorMsg = 
        `❌ Bucketing Analysis Blocked\n\n` +
        `${invalidCount} transcript(s) missing required header data:\n` +
        `${invalidTranscripts.slice(0, 5).join(', ')}${invalidCount > 5 ? '...' : ''}\n\n` +
        `Required: Both iv_value and event_value in each transcript header\n\n` +
        `Solutions:\n` +
        `• Check P_NEG1_1 step output for parsing errors\n` +
        `• Use HIL to correct P_NEG1_1 if LLM missed header info\n` +
        `• Add dummy values: iv_value="condition1", event_value="session1"`;
      return { validationError: errorMsg, validData: [], validTranscriptCount: validCount, invalidTranscriptCount: invalidCount };
    }

    return { validationError: null, validData: data, validTranscriptCount: validCount, invalidTranscriptCount: invalidCount };
  }, [processedData]);

  // Memoize bucket generation with improved sorting
  const bucketPreviews = useMemo(() => {
    if (!validData.length) return [];
    
    // Store structured data for efficient sorting
    const buckets = new Map<string, { iv: string; event: string; transcripts: string[] }>();
    
    validData.forEach(({ transcriptId, ivValue, eventValue }) => {
      const valueMap = {
        score: ivValue,
        suggestion: eventValue,
      };

      const iv = valueMap[selectedIvField];
      const event = valueMap[selectedEventField];

      // Error checks for robustness
      if (iv === undefined) {
        throw new Error(`Unknown IV field: ${selectedIvField}`);
      }
      if (event === undefined) {
        throw new Error(`Unknown Event field: ${selectedEventField}`);
      }
      
      const bucketId = `iv=${iv},event=${event}`;
      if (!buckets.has(bucketId)) {
        buckets.set(bucketId, { iv, event, transcripts: [] });
      }
      buckets.get(bucketId)!.transcripts.push(transcriptId);
    });

    // Sort on structured data before creating final format
    const sortedBucketData = Array.from(buckets.values()).sort((a, b) => {
      if (a.iv !== b.iv) {
        return a.iv.localeCompare(b.iv, undefined, { numeric: true });
      }
      return a.event.localeCompare(b.event, undefined, { numeric: true });
    });

    // Map to final preview structure
    return sortedBucketData.map(({ iv, event, transcripts }) => ({
      bucketId: `iv=${iv},event=${event}`,
      transcriptCount: transcripts.length,
      transcripts,
    }));
  }, [validData, selectedIvField, selectedEventField]);

  const handleEnableBucketing = () => {
    onConfigureBucketing(true, selectedIvField, selectedEventField);
    onClose();
  };

  const handleContinueNormal = () => {
    onConfigureBucketing(false, selectedIvField, selectedEventField);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bucketing-modal-title"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto m-4">
        <div className="p-6 border-b border-gray-200 flex justify-between items-start">
          <div>
            <h2 id="bucketing-modal-title" className="text-2xl font-bold text-gray-900">Configure Analysis Bucketing</h2>
            <p className="text-gray-600 mt-2">
              Your transcripts contain header information that can be used to split the analysis into buckets.
              This allows for hierarchical analysis by grouping transcripts with similar characteristics.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close modal" className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Validation Error Display */}
          {validationError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-semibold text-red-900 mb-2">Validation Error</h3>
              <pre className="text-red-800 text-sm whitespace-pre-wrap">{validationError}</pre>
            </div>
          )}
          
          {/* Conditionally render the rest of the modal content */}
          {!validationError && (
            <>
              {/* Data Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Data Summary</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-blue-700">Transcripts with valid headers:</span>
                <span className="font-semibold ml-2" data-testid="valid-transcript-count">{validTranscriptCount}</span>
              </div>
              <div>
                <span className="text-blue-700">Transcripts without headers:</span>
                <span className="font-semibold ml-2" data-testid="invalid-transcript-count">{invalidTranscriptCount}</span>
              </div>
            </div>
          </div>

          {/* Field Mapping Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Field Mapping</h3>
            <p className="text-gray-600 text-sm">
              Choose how to map the extracted header values to Independent Variable (IV) and Event categories:
            </p>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Independent Variable (IV) Source:
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="ivField"
                      value="score"
                      checked={selectedIvField === 'score'}
                      onChange={(e) => {
                        if (isFieldSource(e.target.value)) {
                          setSelectedIvField(e.target.value);
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm">Score (e.g., "4" from "Scored 4/5")</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="ivField"
                      value="suggestion"
                      checked={selectedIvField === 'suggestion'}
                      onChange={(e) => {
                        if (isFieldSource(e.target.value)) {
                          setSelectedIvField(e.target.value);
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm">Suggestion Number (e.g., "1" from "Suggestion 1")</span>
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Event Category Source:
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="eventField"
                      value="suggestion"
                      checked={selectedEventField === 'suggestion'}
                      onChange={(e) => {
                        if (isFieldSource(e.target.value)) {
                          setSelectedEventField(e.target.value);
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm">Suggestion Number (e.g., "1" from "Suggestion 1")</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="eventField"
                      value="score"
                      checked={selectedEventField === 'score'}
                      onChange={(e) => {
                        if (isFieldSource(e.target.value)) {
                          setSelectedEventField(e.target.value);
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm">Score (e.g., "4" from "Scored 4/5")</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Validation */}
            {selectedIvField === selectedEventField && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm">
                  ⚠️ Invalid configuration: IV and Event cannot use the same source field.
                  Please select different sources for Independent Variable and Event.
                </p>
              </div>
            )}
          </div>

          {/* Bucket Preview */}
          {bucketPreviews.length > 0 && selectedIvField !== selectedEventField && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900" data-testid="bucket-preview-title">
                Bucket Preview ({bucketPreviews.length} buckets)
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto" data-testid="bucket-preview-container">
                <div className="grid gap-3">
                  {bucketPreviews.map((bucket) => (
                    <div key={bucket.bucketId} className="bg-white rounded border p-3" data-testid={`bucket-${bucket.bucketId}`}>
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-900" data-testid={`bucket-id-${bucket.bucketId}`}>{bucket.bucketId}</span>
                        <span className="text-sm text-gray-600" data-testid={`bucket-count-${bucket.bucketId}`}>
                          {bucket.transcriptCount} transcript{bucket.transcriptCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1 truncate">
                        {bucket.transcripts.slice(0, 10).join(', ')}
                        {bucket.transcripts.length > 10 ? '...' : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Benefits */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-semibold text-green-900 mb-2">Bucketing Benefits</h4>
            <ul className="text-sm text-green-800 space-y-1">
              <li>• Each bucket runs the complete pipeline independently</li>
              <li>• Results can be compared across different IV values within each Event</li>
              <li>• Hierarchical aggregation: per-bucket → per-event → combined</li>
              <li>• Individual progress tracking for each bucket</li>
            </ul>
          </div>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="border-t border-gray-200 p-6 flex justify-end space-x-3">
          <button
            onClick={handleContinueNormal}
            disabled={!!validationError}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            Continue Normal Pipeline
          </button>
          <button
            onClick={handleEnableBucketing}
            disabled={!!validationError || selectedIvField === selectedEventField || bucketPreviews.length === 0}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Enable Bucketing
          </button>
        </div>
      </div>
    </div>
  );
};