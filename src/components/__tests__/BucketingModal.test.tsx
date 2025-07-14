import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BucketingModal } from '../BucketingModal';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranscriptStore } from '../../stores/transcriptStore';

// Mock the stores
vi.mock('../../stores/settingsStore');
vi.mock('../../stores/transcriptStore');

const mockUseSettingsStore = vi.mocked(useSettingsStore);
const mockUseTranscriptStore = vi.mocked(useTranscriptStore);

describe('BucketingModal', () => {
  const mockOnClose = vi.fn();
  const mockOnConfigureBucketing = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onConfigureBucketing: mockOnConfigureBucketing
  };

  const mockProcessedData = new Map([
    ['transcript1', {
      p_neg1_1_output: {
        parsed_header: {
          iv_value: '4',
          event_value: '1'
        }
      }
    }],
    ['transcript2', {
      p_neg1_1_output: {
        parsed_header: {
          iv_value: '5',
          event_value: '2'
        }
      }
    }]
  ]);

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock settings store
    mockUseSettingsStore.mockReturnValue({
      bucketIvField: 'score',
      bucketEventField: 'suggestion'
    });

    // Mock transcript store
    mockUseTranscriptStore.mockReturnValue({
      processedData: mockProcessedData
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Modal Visibility', () => {
    test('should render when isOpen is true', () => {
      render(<BucketingModal {...defaultProps} />);
      
      expect(screen.getByText('Configure Analysis Bucketing')).toBeInTheDocument();
      expect(screen.getByText(/Your transcripts contain header information/)).toBeInTheDocument();
    });

    test('should not render when isOpen is false', () => {
      render(<BucketingModal {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByText('Configure Analysis Bucketing')).not.toBeInTheDocument();
    });
  });

  describe('Data Summary Display', () => {
    test('should display correct transcript counts', () => {
      render(<BucketingModal {...defaultProps} />);
      
      expect(screen.getByTestId('valid-transcript-count')).toHaveTextContent('2');
      expect(screen.getByTestId('invalid-transcript-count')).toHaveTextContent('0');
    });

    test('should not show warning since strict validation prevents invalid data', () => {
      render(<BucketingModal {...defaultProps} />);
      
      // With strict validation, there should never be warnings about invalid headers
      expect(screen.queryByText(/Note: Transcripts without valid headers/)).not.toBeInTheDocument();
    });
  });

  describe('Field Mapping Configuration', () => {
    test('should initialize with settings store values', () => {
      render(<BucketingModal {...defaultProps} />);
      
      // Check IV field selection by finding the specific radio in IV section
      const ivRadios = screen.getAllByDisplayValue('score');
      const ivScoreRadio = ivRadios.find(radio => (radio as HTMLInputElement).name === 'ivField');
      expect(ivScoreRadio).toBeChecked();

      // Check Event field selection by finding the specific radio in Event section
      const eventRadios = screen.getAllByDisplayValue('suggestion');
      const eventSuggestionRadio = eventRadios.find(radio => (radio as HTMLInputElement).name === 'eventField');
      expect(eventSuggestionRadio).toBeChecked();
    });

    test('should allow changing IV field selection', () => {
      render(<BucketingModal {...defaultProps} />);
      
      // Find the suggestion radio in the IV field section
      const ivRadios = screen.getAllByDisplayValue('suggestion');
      const ivSuggestionRadio = ivRadios.find(radio => (radio as HTMLInputElement).name === 'ivField');
      fireEvent.click(ivSuggestionRadio!);
      
      expect(ivSuggestionRadio).toBeChecked();
    });

    test('should allow changing Event field selection', () => {
      render(<BucketingModal {...defaultProps} />);
      
      // Find the score radio in the Event field section
      const eventRadios = screen.getAllByDisplayValue('score');
      const eventScoreRadio = eventRadios.find(radio => (radio as HTMLInputElement).name === 'eventField');
      fireEvent.click(eventScoreRadio!);
      
      expect(eventScoreRadio).toBeChecked();
    });
  });

  describe('Field Validation', () => {
    test('should show error when IV and Event fields are the same', async () => {
      render(<BucketingModal {...defaultProps} />);
      
      // Set both to 'score'
      const eventRadios = screen.getAllByDisplayValue('score');
      const eventScoreRadio = eventRadios.find(radio => (radio as HTMLInputElement).name === 'eventField');
      fireEvent.click(eventScoreRadio!);
      
      await waitFor(() => {
        expect(screen.getByText(/Invalid configuration: IV and Event cannot use the same source field/)).toBeInTheDocument();
      });
    });

    test('should disable Enable Bucketing button when fields are the same', async () => {
      render(<BucketingModal {...defaultProps} />);
      
      // Set both to 'score'
      const eventRadios = screen.getAllByDisplayValue('score');
      const eventScoreRadio = eventRadios.find(radio => (radio as HTMLInputElement).name === 'eventField');
      fireEvent.click(eventScoreRadio!);
      
      await waitFor(() => {
        const enableButton = screen.getByRole('button', { name: 'Enable Bucketing' });
        expect(enableButton).toBeDisabled();
      });
    });
  });

  describe('Bucket Preview Generation', () => {
    test('should generate bucket previews with correct counts', async () => {
      render(<BucketingModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('bucket-preview-title')).toHaveTextContent('Bucket Preview (2 buckets)');
      });
    });

    test('should display bucket details correctly', async () => {
      render(<BucketingModal {...defaultProps} />);
      
      await waitFor(() => {
        // Check for bucket IDs using more specific selectors
        expect(screen.getByTestId('bucket-id-iv=4,event=1')).toHaveTextContent('iv=4,event=1');
        expect(screen.getByTestId('bucket-id-iv=5,event=2')).toHaveTextContent('iv=5,event=2');
        
        // Check for transcript counts using specific selectors
        expect(screen.getByTestId('bucket-count-iv=4,event=1')).toHaveTextContent('1 transcript');
        expect(screen.getByTestId('bucket-count-iv=5,event=2')).toHaveTextContent('1 transcript');
        
        // Check for transcript IDs (these are still in the bucket containers)
        expect(screen.getByText('transcript1')).toBeInTheDocument();
        expect(screen.getByText('transcript2')).toBeInTheDocument();
      });
    });

    test('should update bucket preview when field mapping changes', async () => {
      render(<BucketingModal {...defaultProps} />);
      
      // Change Event field to score (IV field is already score by default)
      const eventRadios = screen.getAllByDisplayValue('score');
      const eventScoreRadio = eventRadios.find(radio => (radio as HTMLInputElement).name === 'eventField');
      fireEvent.click(eventScoreRadio!);
      
      await waitFor(() => {
        // Both fields are now 'score', so Enable Bucketing should be disabled and no preview
        const enableButton = screen.getByRole('button', { name: 'Enable Bucketing' });
        expect(enableButton).toBeDisabled();
        expect(screen.getByText(/Invalid configuration: IV and Event cannot use the same source field/)).toBeInTheDocument();
      });
    });

    test('should sort buckets correctly', async () => {
      const sortTestData = new Map([
        ['transcript1', {
          p_neg1_1_output: {
            parsed_header: {
              iv_value: '10',
              event_value: '2'
            }
          }
        }],
        ['transcript2', {
          p_neg1_1_output: {
            parsed_header: {
              iv_value: '2',
              event_value: '1'
            }
          }
        }],
        ['transcript3', {
          p_neg1_1_output: {
            parsed_header: {
              iv_value: '10',
              event_value: '1'
            }
          }
        }]
      ]);

      mockUseTranscriptStore.mockReturnValue({
        processedData: sortTestData
      });

      render(<BucketingModal {...defaultProps} />);
      
      await waitFor(() => {
        const bucketElements = screen.getAllByText(/iv=\d+,event=\d+/);
        expect(bucketElements[0]).toHaveTextContent('iv=2,event=1');
        expect(bucketElements[1]).toHaveTextContent('iv=10,event=1');
        expect(bucketElements[2]).toHaveTextContent('iv=10,event=2');
      });
    });
  });

  describe('Action Buttons', () => {
    test('should call onClose when Continue Normal Pipeline is clicked', () => {
      render(<BucketingModal {...defaultProps} />);
      
      const continueButton = screen.getByRole('button', { name: 'Continue Normal Pipeline' });
      fireEvent.click(continueButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    test('should call onConfigureBucketing with false when Continue Normal Pipeline is clicked', () => {
      render(<BucketingModal {...defaultProps} />);
      
      const continueButton = screen.getByRole('button', { name: 'Continue Normal Pipeline' });
      fireEvent.click(continueButton);
      
      expect(mockOnConfigureBucketing).toHaveBeenCalledWith(false, 'score', 'suggestion');
    });

    test('should call onConfigureBucketing with true when Enable Bucketing is clicked', () => {
      render(<BucketingModal {...defaultProps} />);
      
      const enableButton = screen.getByRole('button', { name: 'Enable Bucketing' });
      fireEvent.click(enableButton);
      
      expect(mockOnConfigureBucketing).toHaveBeenCalledWith(true, 'score', 'suggestion');
    });

    test('should call onClose when Enable Bucketing is clicked', () => {
      render(<BucketingModal {...defaultProps} />);
      
      const enableButton = screen.getByRole('button', { name: 'Enable Bucketing' });
      fireEvent.click(enableButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    test('should disable Enable Bucketing when no buckets are generated', () => {
      // Mock empty processed data
      mockUseTranscriptStore.mockReturnValue({
        processedData: new Map()
      });

      render(<BucketingModal {...defaultProps} />);
      
      const enableButton = screen.getByRole('button', { name: 'Enable Bucketing' });
      expect(enableButton).toBeDisabled();
    });
  });

  describe('Benefits Section', () => {
    test('should display bucketing benefits', () => {
      render(<BucketingModal {...defaultProps} />);
      
      expect(screen.getByText('Bucketing Benefits')).toBeInTheDocument();
      expect(screen.getByText(/Each bucket runs the complete pipeline independently/)).toBeInTheDocument();
      expect(screen.getByText(/Results can be compared across different IV values/)).toBeInTheDocument();
      expect(screen.getByText(/Hierarchical aggregation: per-bucket → per-event → combined/)).toBeInTheDocument();
      expect(screen.getByText(/Individual progress tracking for each bucket/)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty processed data gracefully', () => {
      mockUseTranscriptStore.mockReturnValue({
        processedData: new Map()
      });

      render(<BucketingModal {...defaultProps} />);
      
      // Find all elements containing '0' and verify there are 2 (valid + invalid counts)
      const zeroElements = screen.getAllByText('0');
      expect(zeroElements).toHaveLength(2);
    });

    test('should display error for transcripts with malformed header data', async () => {
      const malformedData = new Map([
        ['transcript1', {
          p_neg1_1_output: {
            parsed_header: {
              iv_value: undefined,
              event_value: '1'
            }
          }
        }]
      ]);

      mockUseTranscriptStore.mockReturnValue({
        processedData: malformedData
      });

      render(<BucketingModal {...defaultProps} />);

      // Should display error message instead of throwing
      await waitFor(() => {
        expect(screen.getByText('Validation Error')).toBeInTheDocument();
        expect(screen.getByText(/❌ Bucketing Analysis Blocked/)).toBeInTheDocument();
      });
    });

    test('should display error for transcripts with missing parsed_header', async () => {
      const missingHeaderData = new Map([
        ['transcript1', {
          p_neg1_1_output: {
            // parsed_header is missing
          }
        }]
      ]);

      mockUseTranscriptStore.mockReturnValue({
        processedData: missingHeaderData
      });

      render(<BucketingModal {...defaultProps} />);

      // Should display error message instead of throwing
      await waitFor(() => {
        expect(screen.getByText('Validation Error')).toBeInTheDocument();
        expect(screen.getByText(/❌ Bucketing Analysis Blocked/)).toBeInTheDocument();
      });
    });
  });

  describe('Current Field Values', () => {
    test('should reflect current field selection in bucket generation', async () => {
      render(<BucketingModal {...defaultProps} />);
      
      // Change to different field combination
      const ivRadios = screen.getAllByDisplayValue('suggestion');
      const ivSuggestionRadio = ivRadios.find(radio => (radio as HTMLInputElement).name === 'ivField');
      const eventRadios = screen.getAllByDisplayValue('score');
      const eventScoreRadio = eventRadios.find(radio => (radio as HTMLInputElement).name === 'eventField');
      
      fireEvent.click(ivSuggestionRadio!);
      fireEvent.click(eventScoreRadio!);
      
      await waitFor(() => {
        // When IV field='suggestion', it uses eventValue (1,2) for IV
        // When Event field='score', it uses ivValue (4,5) for Event
        // This creates buckets: iv=1,event=4 and iv=2,event=5
        expect(screen.getByText('iv=1,event=4')).toBeInTheDocument();
        expect(screen.getByText('iv=2,event=5')).toBeInTheDocument();
      });
    });

    test('should pass updated field values to onConfigureBucketing', async () => {
      render(<BucketingModal {...defaultProps} />);
      
      // Change field selections
      const ivRadios = screen.getAllByDisplayValue('suggestion');
      const ivSuggestionRadio = ivRadios.find(radio => (radio as HTMLInputElement).name === 'ivField');
      const eventRadios = screen.getAllByDisplayValue('score');
      const eventScoreRadio = eventRadios.find(radio => (radio as HTMLInputElement).name === 'eventField');
      
      fireEvent.click(ivSuggestionRadio!);
      fireEvent.click(eventScoreRadio!);
      
      // Click Enable Bucketing
      const enableButton = screen.getByRole('button', { name: 'Enable Bucketing' });
      fireEvent.click(enableButton);
      
      expect(mockOnConfigureBucketing).toHaveBeenCalledWith(true, 'suggestion', 'score');
    });
  });
});