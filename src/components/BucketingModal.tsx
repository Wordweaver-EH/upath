import React, { useState, useEffect } from 'react';
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

export const BucketingModal: React.FC<BucketingModalProps> = ({
  isOpen,
  onClose,
  onConfigureBucketing
}) => {
  const { bucketIvField, bucketEventField } = useSettingsStore();
  const { processedData } = useTranscriptStore();
  
  const [selectedIvField, setSelectedIvField] = useState<'suggestion' | 'score'>(bucketIvField);
  const [selectedEventField, setSelectedEventField] = useState<'suggestion' | 'score'>(bucketEventField);
  const [bucketPreviews, setBucketPreviews] = useState<BucketPreview[]>([]);
  const [availableData, setAvailableData] = useState<Array<{
    transcriptId: string;
    ivValue?: string;
    eventValue?: string;
    hasValidHeader: boolean;
  }>>([]);

  // Calculate bucket previews when field selection changes
  useEffect(() => {
    const data: Array<{
      transcriptId: string;
      ivValue?: string;
      eventValue?: string;
      hasValidHeader: boolean;
    }> = [];

    // Extract header data from all P_NEG1_1 outputs
    processedData.forEach((transcriptData, transcriptId) => {
      const p_neg1_1_output = transcriptData.p_neg1_1_output;
      
      if (p_neg1_1_output?.parsed_header) {
        const { iv_value, event_value } = p_neg1_1_output.parsed_header;
        data.push({
          transcriptId,
          ivValue: iv_value,
          eventValue: event_value,
          hasValidHeader: true
        });
      } else {
        data.push({
          transcriptId,
          hasValidHeader: false
        });
      }
    });

    setAvailableData(data);

    // Generate bucket previews
    const buckets = new Map<string, string[]>();
    
    data.forEach(({ transcriptId, ivValue, eventValue, hasValidHeader }) => {
      if (!hasValidHeader) return;

      const iv = selectedIvField === 'score' ? ivValue : eventValue;
      const event = selectedEventField === 'suggestion' ? eventValue : ivValue;
      
      if (iv && event) {
        const bucketId = `iv=${iv},event=${selectedEventField}${event}`;
        if (!buckets.has(bucketId)) {
          buckets.set(bucketId, []);
        }
        buckets.get(bucketId)!.push(transcriptId);
      }
    });

    const previews: BucketPreview[] = Array.from(buckets.entries()).map(([bucketId, transcripts]) => ({
      bucketId,
      transcriptCount: transcripts.length,
      transcripts
    }));

    // Sort buckets by IV value, then by Event value
    previews.sort((a, b) => {
      const aIv = a.bucketId.match(/iv=(\w+)/)?.[1] || '';
      const bIv = b.bucketId.match(/iv=(\w+)/)?.[1] || '';
      const aEvent = a.bucketId.match(/event=\w+(\w+)/)?.[1] || '';
      const bEvent = b.bucketId.match(/event=\w+(\w+)/)?.[1] || '';
      
      if (aIv !== bIv) {
        return aIv.localeCompare(bIv, undefined, { numeric: true });
      }
      return aEvent.localeCompare(bEvent, undefined, { numeric: true });
    });

    setBucketPreviews(previews);
  }, [selectedIvField, selectedEventField, processedData]);

  const handleEnableBucketing = () => {
    onConfigureBucketing(true, selectedIvField, selectedEventField);
    onClose();
  };

  const handleContinueNormal = () => {
    onConfigureBucketing(false, selectedIvField, selectedEventField);
    onClose();
  };

  const validTranscriptCount = availableData.filter(d => d.hasValidHeader).length;
  const invalidTranscriptCount = availableData.length - validTranscriptCount;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto m-4">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Configure Analysis Bucketing</h2>
          <p className="text-gray-600 mt-2">
            Your transcripts contain header information that can be used to split the analysis into buckets.
            This allows for hierarchical analysis by grouping transcripts with similar characteristics.
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Data Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Data Summary</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-blue-700">Transcripts with valid headers:</span>
                <span className="font-semibold ml-2">{validTranscriptCount}</span>
              </div>
              <div>
                <span className="text-blue-700">Transcripts without headers:</span>
                <span className="font-semibold ml-2">{invalidTranscriptCount}</span>
              </div>
            </div>
            {invalidTranscriptCount > 0 && (
              <p className="text-amber-600 text-xs mt-2">
                Note: Transcripts without valid headers will be processed in a separate group.
              </p>
            )}
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
                      onChange={(e) => setSelectedIvField(e.target.value as 'score')}
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
                      onChange={(e) => setSelectedIvField(e.target.value as 'suggestion')}
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
                      onChange={(e) => setSelectedEventField(e.target.value as 'suggestion')}
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
                      onChange={(e) => setSelectedEventField(e.target.value as 'score')}
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
              <h3 className="text-lg font-semibold text-gray-900">
                Bucket Preview ({bucketPreviews.length} buckets)
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                <div className="grid gap-3">
                  {bucketPreviews.map((bucket) => (
                    <div key={bucket.bucketId} className="bg-white rounded border p-3">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-900">{bucket.bucketId}</span>
                        <span className="text-sm text-gray-600">
                          {bucket.transcriptCount} transcript{bucket.transcriptCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {bucket.transcripts.join(', ')}
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
        </div>

        {/* Action Buttons */}
        <div className="border-t border-gray-200 p-6 flex justify-end space-x-3">
          <button
            onClick={handleContinueNormal}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Continue Normal Pipeline
          </button>
          <button
            onClick={handleEnableBucketing}
            disabled={selectedIvField === selectedEventField || bucketPreviews.length === 0}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Enable Bucketing
          </button>
        </div>
      </div>
    </div>
  );
};