import { describe, it, expect } from 'vitest'
import { PromptHistoryService } from '../PromptHistoryService'
import { StepId } from '../../../../types'
import type { ExecutionContext, StepOutput } from '../types'

describe('PromptHistoryService', () => {
  const service = new PromptHistoryService()

  describe('createHistoryEntry', () => {
    it('should create history entry with all required fields', () => {
      const stepId = StepId.P1_1_INITIAL_SEGMENTATION
      const transcriptIdToProcess = 'transcript-123'
      const output: StepOutput = {
        output: { test: 'data' },
        apiError: undefined,
        groundingSources: [{
          web: {
            uri: 'https://example.com',
            title: 'Test Source'
          }
        }],
        estimatedInputTokens: 100,
        estimatedOutputTokens: 200,
        promptForHistory: 'Test prompt for history'
      }
      const context: ExecutionContext = {
        currentTranscript: {
          id: 'transcript-123',
          filename: 'test.txt',
          content: 'test content'
        },
        currentPhase: 'phase1',
        currentGDU: 'gdu1',
        tempGenericState: {
          isFullyProcessedGenericDiachronic: false,
          isFullyProcessedGenericSynchronic: false,
          isRefinementDone: false,
          isCausalModelingDone: false,
          isReportGenerated: false
        },
        isReportStep: false
      }

      const result = service.createHistoryEntry(stepId, transcriptIdToProcess, output, context)

      expect(result.stepId).toBe(stepId)
      expect(result.transcriptId).toBe(transcriptIdToProcess)
      expect(result.prompt).toBe('Test prompt for history')
      expect(result.responseRaw).toBe('{"test":"data"}')
      expect(result.responseParsed).toEqual({ test: 'data' })
      expect(result.error).toBeUndefined()
      expect(result.groundingSources).toEqual(output.groundingSources)
      expect(result.estimatedInputTokens).toBe(100)
      expect(result.estimatedOutputTokens).toBe(200)
      expect(result.timestamp).toBeDefined()
    })

    it('should handle string output', () => {
      const stepId = StepId.P6_1_GENERATE_MARKDOWN_REPORT
      const transcriptIdToProcess = undefined
      const output: StepOutput = {
        output: 'String output result',
        apiError: undefined,
        groundingSources: undefined,
        estimatedInputTokens: 50,
        estimatedOutputTokens: 75,
        promptForHistory: 'Generate report'
      }
      const context: ExecutionContext = {
        currentTranscript: undefined,
        currentPhase: undefined,
        currentGDU: undefined,
        tempGenericState: {
          isFullyProcessedGenericDiachronic: false,
          isFullyProcessedGenericSynchronic: false,
          isRefinementDone: false,
          isCausalModelingDone: false,
          isReportGenerated: false
        },
        isReportStep: true
      }

      const result = service.createHistoryEntry(stepId, transcriptIdToProcess, output, context)

      expect(result.stepId).toBe(stepId)
      expect(result.transcriptId).toBeUndefined()
      expect(result.prompt).toBe('Generate report')
      expect(result.responseRaw).toBe('String output result')
      expect(result.responseParsed).toBe('String output result')
      expect(result.error).toBeUndefined()
      expect(result.groundingSources).toBeUndefined()
      expect(result.estimatedInputTokens).toBe(50)
      expect(result.estimatedOutputTokens).toBe(75)
    })

    it('should handle API error', () => {
      const stepId = StepId.P1_1_INITIAL_SEGMENTATION
      const transcriptIdToProcess = 'transcript-123'
      const output: StepOutput = {
        output: { test: 'data' },
        apiError: 'API call failed',
        groundingSources: undefined,
        estimatedInputTokens: 100,
        estimatedOutputTokens: 0,
        promptForHistory: 'Test prompt'
      }
      const context: ExecutionContext = {
        currentTranscript: {
          id: 'transcript-123',
          filename: 'test.txt',
          content: 'test content'
        },
        currentPhase: undefined,
        currentGDU: undefined,
        tempGenericState: {
          isFullyProcessedGenericDiachronic: false,
          isFullyProcessedGenericSynchronic: false,
          isRefinementDone: false,
          isCausalModelingDone: false,
          isReportGenerated: false
        },
        isReportStep: false
      }

      const result = service.createHistoryEntry(stepId, transcriptIdToProcess, output, context)

      expect(result.stepId).toBe(stepId)
      expect(result.transcriptId).toBe(transcriptIdToProcess)
      expect(result.error).toBe('API call failed')
      expect(result.estimatedInputTokens).toBe(100)
      expect(result.estimatedOutputTokens).toBe(0)
    })

    it('should handle null/undefined output', () => {
      const stepId = StepId.P1_1_INITIAL_SEGMENTATION
      const transcriptIdToProcess = 'transcript-123'
      const output: StepOutput = {
        output: null,
        apiError: undefined,
        groundingSources: undefined,
        estimatedInputTokens: 100,
        estimatedOutputTokens: 50,
        promptForHistory: 'Test prompt'
      }
      const context: ExecutionContext = {
        currentTranscript: {
          id: 'transcript-123',
          filename: 'test.txt',
          content: 'test content'
        },
        currentPhase: undefined,
        currentGDU: undefined,
        tempGenericState: {
          isFullyProcessedGenericDiachronic: false,
          isFullyProcessedGenericSynchronic: false,
          isRefinementDone: false,
          isCausalModelingDone: false,
          isReportGenerated: false
        },
        isReportStep: false
      }

      const result = service.createHistoryEntry(stepId, transcriptIdToProcess, output, context)

      expect(result.responseRaw).toBe('')
      expect(result.responseParsed).toBe(null)
    })

    it('should handle report step with programmatic input', () => {
      const stepId = StepId.P6_1_GENERATE_MARKDOWN_REPORT
      const transcriptIdToProcess = undefined
      const output: StepOutput = {
        output: 'Generated report content',
        apiError: undefined,
        groundingSources: undefined,
        estimatedInputTokens: undefined,
        estimatedOutputTokens: undefined,
        promptForHistory: 'Programmatic report generation.'
      }
      const context: ExecutionContext = {
        currentTranscript: undefined,
        currentPhase: undefined,
        currentGDU: undefined,
        tempGenericState: {
          isFullyProcessedGenericDiachronic: false,
          isFullyProcessedGenericSynchronic: false,
          isRefinementDone: false,
          isCausalModelingDone: false,
          isReportGenerated: false
        },
        isReportStep: true
      }

      const result = service.createHistoryEntry(stepId, transcriptIdToProcess, output, context)

      expect(result.stepId).toBe(stepId)
      expect(result.transcriptId).toBeUndefined()
      expect(result.prompt).toBe('Programmatic report generation.')
      expect(result.responseRaw).toBe('Generated report content')
      expect(result.responseParsed).toBe('Generated report content')
      expect(result.estimatedInputTokens).toBeUndefined()
      expect(result.estimatedOutputTokens).toBeUndefined()
    })

    it('should generate valid ISO timestamp', () => {
      const stepId = StepId.P1_1_INITIAL_SEGMENTATION
      const transcriptIdToProcess = 'transcript-123'
      const output: StepOutput = {
        output: { test: 'data' },
        apiError: undefined,
        groundingSources: undefined,
        estimatedInputTokens: 100,
        estimatedOutputTokens: 200,
        promptForHistory: 'Test prompt'
      }
      const context: ExecutionContext = {
        currentTranscript: {
          id: 'transcript-123',
          filename: 'test.txt',
          content: 'test content'
        },
        currentPhase: undefined,
        currentGDU: undefined,
        tempGenericState: {
          isFullyProcessedGenericDiachronic: false,
          isFullyProcessedGenericSynchronic: false,
          isRefinementDone: false,
          isCausalModelingDone: false,
          isReportGenerated: false
        },
        isReportStep: false
      }

      const result = service.createHistoryEntry(stepId, transcriptIdToProcess, output, context)

      expect(result.timestamp).toBeDefined()
      expect(typeof result.timestamp).toBe('string')
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp)
    })
  })
})