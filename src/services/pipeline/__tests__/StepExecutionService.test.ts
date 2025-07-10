import { describe, test, expect, vi, beforeEach } from 'vitest'
import { StepExecutionService } from '../StepExecutionService'
import { IStepExecutionService, StepInput, ExecutionContext, SettingsData } from '../types'
import { StepId } from '../../../../types'
import { callGeminiAPI } from '../../../../services/geminiService'
import { generateMarkdownReportProgrammatically } from '../../../utils/reportHelper'
import { 
  STEP_CONFIGS,
  REPORT_STEP_IDS
} from '../../../../constants'

// Mock external dependencies
vi.mock('../../../../services/geminiService')
vi.mock('../../../utils/reportHelper')

describe('StepExecutionService', () => {
  let service: IStepExecutionService
  
  beforeEach(() => {
    vi.clearAllMocks()
    service = new StepExecutionService()
  })

  describe('executeStep', () => {
    const mockSettings: SettingsData = {
      apiKey: 'test-key',
      temperature: 0.7,
      seed: 123,
      userDvFocus: { dv_focus: ['test'] }
    }

    const mockContext: ExecutionContext = {
      currentTranscript: {
        id: 'transcript-1',
        name: 'test.txt',
        content: 'Test content',
        uploadedAt: Date.now()
      },
      tempGenericState: {},
      isReportStep: false
    }

    describe('API call steps', () => {
      test('should execute API call for non-report steps', async () => {
        const mockInput: StepInput = {
          data: { test: 'data' }
        }

        const mockApiResponse = {
          output: { result: 'success' },
          groundingSources: [{ text: 'source', score: 0.9 }],
          estimatedInputTokens: 100,
          estimatedOutputTokens: 50
        }

        vi.mocked(callGeminiAPI).mockResolvedValueOnce(mockApiResponse)

        const result = await service.executeStep(
          StepId.P0_1_TRANSCRIPTION_ADHERENCE,
          mockInput,
          mockContext,
          mockSettings
        )

        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
        expect(result.data?.output).toEqual(mockApiResponse.output)
        expect(result.data?.groundingSources).toEqual(mockApiResponse.groundingSources)
        expect(result.data?.estimatedInputTokens).toBe(100)
        expect(result.data?.estimatedOutputTokens).toBe(50)

        // Verify API was called with correct parameters
        expect(callGeminiAPI).toHaveBeenCalledWith(
          'test-key',
          0.7,
          mockInput.data,
          123
        )
      })

      test('should handle API errors gracefully', async () => {
        const mockInput: StepInput = {
          data: { test: 'data' }
        }

        vi.mocked(callGeminiAPI).mockRejectedValueOnce(new Error('API Error'))

        const result = await service.executeStep(
          StepId.P0_1_TRANSCRIPTION_ADHERENCE,
          mockInput,
          mockContext,
          mockSettings
        )

        expect(result.success).toBe(false)
        expect(result.error).toBe('API Error')
        expect(result.data).toBeUndefined()
      })

      test('should handle input errors', async () => {
        const mockInput: StepInput = {
          data: null,
          error: 'Input preparation failed'
        }

        const result = await service.executeStep(
          StepId.P0_1_TRANSCRIPTION_ADHERENCE,
          mockInput,
          mockContext,
          mockSettings
        )

        expect(result.success).toBe(true)
        expect(result.data?.apiError).toBe('Input preparation failed')
        expect(result.data?.output).toBeNull()
        expect(callGeminiAPI).not.toHaveBeenCalled()
      })

      test('should use overrideSeed when provided', async () => {
        const mockInput: StepInput = {
          data: { test: 'data' }
        }

        const settingsWithOverride = {
          ...mockSettings,
          seed: 999
        }

        vi.mocked(callGeminiAPI).mockResolvedValueOnce({
          output: { result: 'success' }
        })

        await service.executeStep(
          StepId.P0_1_EXTRACT_BASIC_INFO,
          mockInput,
          mockContext,
          settingsWithOverride
        )

        expect(callGeminiAPI).toHaveBeenCalledWith(
          'test-key',
          0.7,
          mockInput.data,
          999
        )
      })
    })

    describe('Report generation steps', () => {
      test('should generate report for report steps', async () => {
        const reportContext: ExecutionContext = {
          ...mockContext,
          isReportStep: true,
          tempGenericState: {
            p3_1_output: { generic_dia: 'test' },
            p4s_outputs_by_gdu: { gdu1: { gss: 'test' } }
          }
        }

        const mockInput: StepInput = {
          data: { reportData: 'test' }
        }

        const mockReport = '# Generated Report\nContent here...'
        vi.mocked(generateMarkdownReportProgrammatically).mockReturnValueOnce(mockReport)

        const result = await service.executeStep(
          StepId.P6_1_REPORT,
          mockInput,
          reportContext,
          mockSettings
        )

        expect(result.success).toBe(true)
        expect(result.data?.output).toBe(mockReport)
        expect(result.data?.apiError).toBeUndefined()
        expect(generateMarkdownReportProgrammatically).toHaveBeenCalledWith(
          mockInput.data,
          reportContext.tempGenericState
        )
        expect(callGeminiAPI).not.toHaveBeenCalled()
      })

      test('should handle report generation errors', async () => {
        const reportContext: ExecutionContext = {
          ...mockContext,
          isReportStep: true
        }

        const mockInput: StepInput = {
          data: { reportData: 'test' }
        }

        vi.mocked(generateMarkdownReportProgrammatically).mockImplementationOnce(() => {
          throw new Error('Report generation failed')
        })

        const result = await service.executeStep(
          StepId.P6_1_REPORT,
          mockInput,
          reportContext,
          mockSettings
        )

        expect(result.success).toBe(false)
        expect(result.error).toBe('Report generation failed')
      })
    })

    describe('promptForHistory generation', () => {
      test('should generate prompt for history from step config', async () => {
        const mockInput: StepInput = {
          data: { 
            filename_or_id: 'test.txt',
            raw_transcript_text_from_file: 'Test transcript content'
          }
        }

        vi.mocked(callGeminiAPI).mockResolvedValueOnce({
          output: { result: 'success' }
        })

        const result = await service.executeStep(
          StepId.P0_1_TRANSCRIPTION_ADHERENCE,
          mockInput,
          mockContext,
          mockSettings
        )

        expect(result.data?.promptForHistory).toBeDefined()
        // Should contain key parts of the generated prompt
        expect(result.data?.promptForHistory).toContain('micro-phenomenological data preparation')
        expect(result.data?.promptForHistory).toContain('test.txt')
      })

      test('should stringify input data for prompt history', async () => {
        const complexInput: StepInput = {
          data: { 
            nested: { 
              data: 'value' 
            },
            array: [1, 2, 3]
          }
        }

        vi.mocked(callGeminiAPI).mockResolvedValueOnce({
          output: { result: 'success' }
        })

        const result = await service.executeStep(
          StepId.P0_1_EXTRACT_BASIC_INFO,
          complexInput,
          mockContext,
          mockSettings
        )

        expect(result.data?.promptForHistory).toContain(JSON.stringify(complexInput.data, null, 2))
      })
    })
  })
})