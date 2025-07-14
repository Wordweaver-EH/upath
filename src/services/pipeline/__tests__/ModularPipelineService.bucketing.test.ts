/**
 * Comprehensive test suite for hierarchical bucketing system in ModularPipelineService
 * Tests all phases of bucketing implementation including header parsing, bucket creation,
 * execution engine, and result aggregation.
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { ModularPipelineService, type ModularPipelineServiceDependencies } from '../ModularPipelineService';
import { StepId, StepStatus, type RawTranscript, type TranscriptProcessedData, type P_NEG1_1_Output } from '../../../../types';

// Mock fetch globally
global.fetch = vi.fn();

describe('ModularPipelineService - Hierarchical Bucketing System', () => {
  let service: ModularPipelineService;
  let mockDependencies: ModularPipelineServiceDependencies;
  let mockTranscripts: RawTranscript[];
  let mockProcessedData: Map<string, TranscriptProcessedData>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock transcripts with header data for bucketing
    mockTranscripts = [
      {
        id: 'transcript1',
        filename: 'file1.txt',
        content: 'Scored 4/5: Suggestion 1\nContent of transcript 1...'
      },
      {
        id: 'transcript2', 
        filename: 'file2.txt',
        content: 'Scored 4/5: Suggestion 2\nContent of transcript 2...'
      },
      {
        id: 'transcript3',
        filename: 'file3.txt', 
        content: 'Scored 3/5: Suggestion 1\nContent of transcript 3...'
      },
      {
        id: 'transcript4',
        filename: 'file4.txt',
        content: 'Scored 3/5: Suggestion 2\nContent of transcript 4...'
      }
    ];

    // Create mock processed data with parsed headers
    mockProcessedData = new Map();
    mockProcessedData.set('transcript1', {
      id: 'transcript1',
      filename: 'file1.txt',
      isFullyProcessedSpecificDiachronic: false,
      isFullyProcessedSpecificSynchronic: false,
      p_neg1_1_output: {
        transcript_id: 'transcript1',
        independent_variable_details: 'Score-based evaluation',
        dependent_variable_focus: ['performance'],
        parsed_header: {
          iv_value: '4',
          event_value: '1',
          raw_header: 'Scored 4/5: Suggestion 1'
        }
      } as P_NEG1_1_Output
    });

    mockProcessedData.set('transcript2', {
      id: 'transcript2',
      filename: 'file2.txt',
      isFullyProcessedSpecificDiachronic: false,
      isFullyProcessedSpecificSynchronic: false,
      p_neg1_1_output: {
        transcript_id: 'transcript2',
        independent_variable_details: 'Score-based evaluation',
        dependent_variable_focus: ['performance'],
        parsed_header: {
          iv_value: '4',
          event_value: '2',
          raw_header: 'Scored 4/5: Suggestion 2'
        }
      } as P_NEG1_1_Output
    });

    mockProcessedData.set('transcript3', {
      id: 'transcript3',
      filename: 'file3.txt',
      isFullyProcessedSpecificDiachronic: false,
      isFullyProcessedSpecificSynchronic: false,
      p_neg1_1_output: {
        transcript_id: 'transcript3',
        independent_variable_details: 'Score-based evaluation',
        dependent_variable_focus: ['performance'],
        parsed_header: {
          iv_value: '3',
          event_value: '1',
          raw_header: 'Scored 3/5: Suggestion 1'
        }
      } as P_NEG1_1_Output
    });

    mockProcessedData.set('transcript4', {
      id: 'transcript4',
      filename: 'file4.txt',
      isFullyProcessedSpecificDiachronic: false,
      isFullyProcessedSpecificSynchronic: false,
      p_neg1_1_output: {
        transcript_id: 'transcript4',
        independent_variable_details: 'Score-based evaluation',
        dependent_variable_focus: ['performance'],
        parsed_header: {
          iv_value: '3',
          event_value: '2',
          raw_header: 'Scored 3/5: Suggestion 2'
        }
      } as P_NEG1_1_Output
    });

    // Create mock dependencies
    mockDependencies = {
      getTranscriptData: vi.fn(() => ({
        rawTranscripts: mockTranscripts,
        processedData: mockProcessedData
      })),
      getGenericAnalysisState: vi.fn(() => ({})),
      getPromptHistory: vi.fn(() => []),
      getCurrentStepInfo: vi.fn(() => ({ stepId: StepId.P0_1_REFINE_TRANSCRIPT, status: StepStatus.Idle })),
      getActiveTranscriptIndex: vi.fn(() => 0),
      getSettings: vi.fn(() => ({})),
      updateTranscriptData: vi.fn(),
      replaceProcessedData: vi.fn(),
      updateGenericState: vi.fn(),
      addPromptEntry: vi.fn(),
      setCurrentStepInfo: vi.fn(),
      setAutorunning: vi.fn(),
      addTranscripts: vi.fn(),
      resetTranscripts: vi.fn(),
      resetPromptHistory: vi.fn(),
      resetAnalysisState: vi.fn(),
      resetOrchestrationState: vi.fn()
    };

    service = new ModularPipelineService(mockDependencies);
  });

  describe('Phase 1: Header Parsing Validation', () => {
    it('should detect valid header data for bucketing', () => {
      const result = service['shouldOfferBucketing'](StepId.P_NEG1_1_VARIABLE_IDENTIFICATION);
      expect(result).toBe(true);
    });

    it('should not offer bucketing for non-P_NEG1_1 steps', () => {
      const result = service['shouldOfferBucketing'](StepId.P0_1_REFINE_TRANSCRIPT);
      expect(result).toBe(false);
    });

    it('should not offer bucketing when no parsed headers exist', () => {
      // Clear parsed headers from processed data
      mockProcessedData.forEach((data) => {
        if (data.p_neg1_1_output) {
          delete data.p_neg1_1_output.parsed_header;
        }
      });

      const result = service['shouldOfferBucketing'](StepId.P_NEG1_1_VARIABLE_IDENTIFICATION);
      expect(result).toBe(false);
    });
  });

  describe('Phase 2: Bucket Creation', () => {
    it('should create correct buckets with score IV and suggestion Event', () => {
      const buckets = service['createTranscriptBuckets']('score', 'suggestion');
      
      expect(buckets.size).toBe(4); // 2 IVs × 2 Events = 4 buckets
      expect(buckets.has('iv4_event1')).toBe(true);
      expect(buckets.has('iv4_event2')).toBe(true);
      expect(buckets.has('iv3_event1')).toBe(true);
      expect(buckets.has('iv3_event2')).toBe(true);
      
      expect(buckets.get('iv4_event1')).toEqual(['transcript1']);
      expect(buckets.get('iv4_event2')).toEqual(['transcript2']);
      expect(buckets.get('iv3_event1')).toEqual(['transcript3']);
      expect(buckets.get('iv3_event2')).toEqual(['transcript4']);
    });

    it('should create correct buckets with suggestion IV and score Event', () => {
      const buckets = service['createTranscriptBuckets']('suggestion', 'score');
      
      expect(buckets.size).toBe(4); // 2 suggestions × 2 scores = 4 buckets
      expect(buckets.has('iv1_event4')).toBe(true);
      expect(buckets.has('iv2_event4')).toBe(true);
      expect(buckets.has('iv1_event3')).toBe(true);
      expect(buckets.has('iv2_event3')).toBe(true);
    });

    it('should handle missing header data gracefully', () => {
      // Remove one transcript's parsed header
      const transcript1Data = mockProcessedData.get('transcript1')!;
      delete transcript1Data.p_neg1_1_output!.parsed_header;

      const buckets = service['createTranscriptBuckets']('score', 'suggestion');
      
      expect(buckets.size).toBe(3); // One less bucket
      expect(buckets.has('iv4_event1')).toBe(false); // This bucket should be missing
    });

    it('should generate correct bucket transcript IDs', () => {
      const bucketId = 'iv4_event1';
      const originalId = 'transcript1';
      const result = service['createBucketTranscriptId'](bucketId, originalId);
      
      expect(result).toBe('bucket_iv4_event1_transcript1');
    });
  });

  describe('Phase 3: Bucket Execution Engine', () => {
    beforeEach(() => {
      // Mock successful API responses
      (global.fetch as MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          stepId: StepId.P0_1_REFINE_TRANSCRIPT,
          output: { refined_transcript: 'mock output' },
          executionTimeMs: 1000,
          timestamp: new Date().toISOString()
        })
      } as Response);
    });

    it('should route to bucketing when enabled', async () => {
      const params = {
        stepId: StepId.P0_1_REFINE_TRANSCRIPT,
        settings: {
          bucketingEnabled: true,
          bucketIvField: 'score' as const,
          bucketEventField: 'suggestion' as const,
          apiKey: 'test-key',
          model: 'gemini-2.5-flash',
          temperature: 0.0,
          userDvFocus: { dv_focus: [] }
        }
      };

      const processSingleStepWithBucketingSpy = vi.spyOn(service, 'processSingleStepWithBucketing' as any);
      
      await service.processSingleStep(params);
      
      expect(processSingleStepWithBucketingSpy).toHaveBeenCalledWith(params);
    });

    it('should use normal processing when bucketing disabled', async () => {
      const params = {
        stepId: StepId.P0_1_REFINE_TRANSCRIPT,
        settings: {
          bucketingEnabled: false,
          apiKey: 'test-key',
          model: 'gemini-2.5-flash', 
          temperature: 0.0,
          userDvFocus: { dv_focus: [] }
        }
      };

      const processNormalStepSpy = vi.spyOn(service, 'processNormalStep' as any);
      
      await service.processSingleStep(params);
      
      expect(processNormalStepSpy).toHaveBeenCalledWith(params);
    });

    it('should process bucket with correct transcript isolation', async () => {
      const bucketId = 'iv4_event1';
      const transcriptIds = ['transcript1'];
      const stepId = StepId.P0_1_REFINE_TRANSCRIPT;
      const settings = {
        bucketingEnabled: true,
        bucketIvField: 'score' as const,
        bucketEventField: 'suggestion' as const,
        apiKey: 'test-key',
        model: 'gemini-2.5-flash',
        temperature: 0.0,
        userDvFocus: { dv_focus: [] }
      };

      const results = await service['processBucket'](bucketId, transcriptIds, stepId, settings);
      
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].bucketId).toBe(bucketId);
      expect(results[0].originalTranscriptId).toBe('transcript1');
      
      // Verify bucket transcript data was created
      expect(mockDependencies.replaceProcessedData).toHaveBeenCalledWith(
        'bucket_iv4_event1_transcript1',
        expect.objectContaining({
          id: 'bucket_iv4_event1_transcript1'
        })
      );
    });

    it('should handle bucket processing errors gracefully', async () => {
      // Mock API failure
      (global.fetch as MockedFunction<typeof fetch>).mockRejectedValueOnce(new Error('API Error'));

      const bucketId = 'iv4_event1';
      const transcriptIds = ['transcript1'];
      const stepId = StepId.P0_1_REFINE_TRANSCRIPT;
      const settings = {
        bucketingEnabled: true,
        apiKey: 'test-key',
        model: 'gemini-2.5-flash',
        temperature: 0.0,
        userDvFocus: { dv_focus: [] }
      };

      const results = await service['processBucket'](bucketId, transcriptIds, stepId, settings);
      
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('API Error');
    });
  });

  describe('Phase 4: Result Aggregation', () => {
    let mockBucketResults: Map<string, any[]>;

    beforeEach(() => {
      mockBucketResults = new Map();
      mockBucketResults.set('iv4_event1', [
        { success: true, bucketId: 'iv4_event1', originalTranscriptId: 'transcript1' }
      ]);
      mockBucketResults.set('iv4_event2', [
        { success: true, bucketId: 'iv4_event2', originalTranscriptId: 'transcript2' }
      ]);
      mockBucketResults.set('iv3_event1', [
        { success: false, bucketId: 'iv3_event1', originalTranscriptId: 'transcript3', error: 'Test error' }
      ]);
      mockBucketResults.set('iv3_event2', [
        { success: true, bucketId: 'iv3_event2', originalTranscriptId: 'transcript4' }
      ]);
    });

    it('should aggregate results correctly by IV and Event', () => {
      const aggregated = service.aggregateBucketResults(mockBucketResults, StepId.P0_1_REFINE_TRANSCRIPT);
      
      expect(aggregated.byIv.size).toBe(2); // IV 3 and 4
      expect(aggregated.byEvent.size).toBe(2); // Event 1 and 2
      expect(aggregated.combined.size).toBe(4); // All buckets
      
      expect(aggregated.byIv.get('4')).toHaveLength(2); // transcripts 1 and 2
      expect(aggregated.byIv.get('3')).toHaveLength(2); // transcripts 3 and 4
      expect(aggregated.byEvent.get('1')).toHaveLength(2); // transcripts 1 and 3
      expect(aggregated.byEvent.get('2')).toHaveLength(2); // transcripts 2 and 4
    });

    it('should calculate summary statistics correctly', () => {
      const aggregated = service.aggregateBucketResults(mockBucketResults, StepId.P0_1_REFINE_TRANSCRIPT);
      
      expect(aggregated.summary.totalBuckets).toBe(4);
      expect(aggregated.summary.totalTranscripts).toBe(4);
      expect(aggregated.summary.successfulTranscripts).toBe(3);
      expect(aggregated.summary.failedTranscripts).toBe(1);
      expect(aggregated.summary.ivCount).toBe(2);
      expect(aggregated.summary.eventCount).toBe(2);
    });

    it('should calculate average success rates by dimension', () => {
      const aggregated = service.aggregateBucketResults(mockBucketResults, StepId.P0_1_REFINE_TRANSCRIPT);
      
      // IV 4: 2/2 success = 100%, IV 3: 1/2 success = 50%, avg = 75%
      expect(aggregated.summary.avgSuccessRateByIv).toBeCloseTo(0.75);
      
      // Event 1: 1/2 success = 50%, Event 2: 2/2 success = 100%, avg = 75%
      expect(aggregated.summary.avgSuccessRateByEvent).toBeCloseTo(0.75);
    });

    it('should generate comprehensive analysis report', () => {
      const aggregated = service.aggregateBucketResults(mockBucketResults, StepId.P0_1_REFINE_TRANSCRIPT);
      const report = service.generateBucketAnalysisReport(aggregated, StepId.P0_1_REFINE_TRANSCRIPT);
      
      expect(report).toContain('# Hierarchical Bucketing Analysis Report');
      expect(report).toContain('## Overall Summary');
      expect(report).toContain('## Analysis by Independent Variable (IV)');
      expect(report).toContain('## Analysis by Event Type');
      expect(report).toContain('## Recommendations');
      expect(report).toContain('Total Buckets**: 4');
      expect(report).toContain('Success Rate**: 3/4 (75.0%)');
    });

    it('should export results in JSON format', () => {
      const aggregated = service.aggregateBucketResults(mockBucketResults, StepId.P0_1_REFINE_TRANSCRIPT);
      const exported = service.exportBucketResults(mockBucketResults, aggregated, 'json');
      
      const parsed = JSON.parse(exported);
      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('summary');
      expect(parsed).toHaveProperty('bucketResults');
      expect(parsed).toHaveProperty('aggregations');
      expect(parsed.summary.totalBuckets).toBe(4);
    });

    it('should export results in CSV format', () => {
      const aggregated = service.aggregateBucketResults(mockBucketResults, StepId.P0_1_REFINE_TRANSCRIPT);
      const exported = service.exportBucketResults(mockBucketResults, aggregated, 'csv');
      
      expect(exported).toContain('BucketId,IV,Event,TranscriptId,Success,Error,ExecutionTime');
      expect(exported).toContain('iv4_event1,4,1,transcript1,true,');
      expect(exported).toContain('iv3_event1,3,1,transcript3,false,Test error');
      
      // Count lines (header + 4 data rows)
      const lines = exported.split('\n').filter(line => line.trim());
      expect(lines).toHaveLength(5);
    });
  });

  describe('Integration Tests', () => {
    beforeEach(() => {
      // Mock successful API responses for integration tests
      (global.fetch as MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          stepId: StepId.P0_1_REFINE_TRANSCRIPT,
          output: { refined_transcript: 'mock output' },
          executionTimeMs: 1000,
          timestamp: new Date().toISOString()
        })
      } as Response);
    });

    it('should complete full bucketing workflow end-to-end', async () => {
      const params = {
        stepId: StepId.P0_1_REFINE_TRANSCRIPT,
        settings: {
          bucketingEnabled: true,
          bucketIvField: 'score' as const,
          bucketEventField: 'suggestion' as const,
          apiKey: 'test-key',
          model: 'gemini-2.5-flash',
          temperature: 0.0,
          userDvFocus: { dv_focus: [] }
        }
      };

      const result = await service.processSingleStep(params);
      
      expect(result.success).toBe(true);
      expect(result.output).toHaveProperty('bucketResults');
      expect(result.output).toHaveProperty('aggregatedResults');
      expect(result.output).toHaveProperty('analysisReport');
      expect(result.output).toHaveProperty('summary');
      
      // Verify aggregated results structure
      const aggregatedResults = result.output.aggregatedResults;
      expect(aggregatedResults).toHaveProperty('byIv');
      expect(aggregatedResults).toHaveProperty('byEvent'); 
      expect(aggregatedResults).toHaveProperty('combined');
      expect(aggregatedResults).toHaveProperty('summary');
      
      // Verify summary includes hierarchical insights
      const summary = result.output.summary;
      expect(summary).toHaveProperty('hierarchicalInsights');
      expect(summary.hierarchicalInsights).toHaveProperty('ivCount');
      expect(summary.hierarchicalInsights).toHaveProperty('eventCount');
      expect(summary.hierarchicalInsights).toHaveProperty('avgSuccessRateByIv');
      expect(summary.hierarchicalInsights).toHaveProperty('avgSuccessRateByEvent');
    });

    it('should handle mixed success/failure scenarios correctly', async () => {
      // Mock mixed API responses
      let callCount = 0;
      (global.fetch as MockedFunction<typeof fetch>).mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          // Fail the second call
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            json: () => Promise.resolve({ error: 'API failure' })
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            stepId: StepId.P0_1_REFINE_TRANSCRIPT,
            output: { refined_transcript: 'mock output' },
            executionTimeMs: 1000,
            timestamp: new Date().toISOString()
          })
        } as Response);
      });

      const params = {
        stepId: StepId.P0_1_REFINE_TRANSCRIPT,
        settings: {
          bucketingEnabled: true,
          bucketIvField: 'score' as const,
          bucketEventField: 'suggestion' as const,
          apiKey: 'test-key',
          model: 'gemini-2.5-flash',
          temperature: 0.0,
          userDvFocus: { dv_focus: [] }
        }
      };

      const result = await service.processSingleStep(params);
      
      // Should still complete with mixed results
      expect(result.success).toBe(false); // Overall failure due to some bucket failures
      expect(result.output).toHaveProperty('aggregatedResults');
      
      // Check that some transcripts succeeded and some failed
      const summary = result.output.summary;
      expect(summary.successfulTranscripts).toBeLessThan(summary.totalTranscripts);
      expect(summary.successfulTranscripts).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid bucket ID formats gracefully', () => {
      const invalidBucketResults = new Map();
      invalidBucketResults.set('invalid_format', [
        { success: true, bucketId: 'invalid_format', originalTranscriptId: 'transcript1' }
      ]);

      const aggregated = service.aggregateBucketResults(invalidBucketResults, StepId.P0_1_REFINE_TRANSCRIPT);
      
      // Should handle gracefully without crashing
      expect(aggregated.byIv.size).toBe(0);
      expect(aggregated.byEvent.size).toBe(0);
      expect(aggregated.summary.totalBuckets).toBe(1);
      expect(aggregated.summary.totalTranscripts).toBe(0); // No valid buckets processed
    });

    it('should handle empty bucket results', () => {
      const emptyBucketResults = new Map();
      
      const aggregated = service.aggregateBucketResults(emptyBucketResults, StepId.P0_1_REFINE_TRANSCRIPT);
      
      expect(aggregated.byIv.size).toBe(0);
      expect(aggregated.byEvent.size).toBe(0);
      expect(aggregated.combined.size).toBe(0);
      expect(aggregated.summary.totalBuckets).toBe(0);
      expect(aggregated.summary.totalTranscripts).toBe(0);
      expect(aggregated.summary.avgSuccessRateByIv).toBe(0);
      expect(aggregated.summary.avgSuccessRateByEvent).toBe(0);
    });

    it('should handle missing transcript data in buckets', async () => {
      const bucketId = 'iv4_event1';
      const transcriptIds = ['nonexistent_transcript'];
      const stepId = StepId.P0_1_REFINE_TRANSCRIPT;
      const settings = {
        bucketingEnabled: true,
        apiKey: 'test-key',
        model: 'gemini-2.5-flash',
        temperature: 0.0,
        userDvFocus: { dv_focus: [] }
      };

      const processBucket = service['processBucket'](bucketId, transcriptIds, stepId, settings);
      
      // Should handle missing transcript gracefully
      await expect(processBucket).resolves.toHaveLength(0);
    });
  });
});