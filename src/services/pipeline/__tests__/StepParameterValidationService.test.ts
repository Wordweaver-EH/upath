import { describe, it, expect, vi } from 'vitest'
import { StepParameterValidationService } from '../StepParameterValidationService'
import { StepId } from '../../../../types'
import type { StepExecutionParams } from '../types'

describe('StepParameterValidationService', () => {
  const service = new StepParameterValidationService()

  describe('validate', () => {
    it('should return error when no settings provided', () => {
      const params: StepExecutionParams = {
        stepId: StepId.P1_1_INITIAL_SEGMENTATION
      }

      const result = service.validate(params)

      expect(result.success).toBe(false)
      expect(result.error).toBe('No settings provided to processSingleStep')
    })

    it('should return error when API key is missing', () => {
      const params: StepExecutionParams = {
        stepId: StepId.P1_1_INITIAL_SEGMENTATION,
        settings: {
          apiKey: '',
          temperature: 0.7,
          userDvFocus: { dv_focus: ['test'] }
        }
      }

      const result = service.validate(params)

      expect(result.success).toBe(false)
      expect(result.error).toBe('API key is required')
    })

    it('should return error when DV focus is missing', () => {
      const params: StepExecutionParams = {
        stepId: StepId.P1_1_INITIAL_SEGMENTATION,
        settings: {
          apiKey: 'test-key',
          temperature: 0.7,
          userDvFocus: { dv_focus: [] }
        }
      }

      const result = service.validate(params)

      expect(result.success).toBe(false)
      expect(result.error).toBe('DV focus is required')
    })

    it('should return error when step config is not found', () => {
      const params: StepExecutionParams = {
        stepId: 'INVALID_STEP' as StepId,
        settings: {
          apiKey: 'test-key',
          temperature: 0.7,
          userDvFocus: { dv_focus: ['test'] }
        }
      }

      const result = service.validate(params)

      expect(result.success).toBe(false)
      expect(result.error).toBe('No configuration found for stepId: INVALID_STEP')
    })

    it('should return success with valid parameters', () => {
      const params: StepExecutionParams = {
        stepId: StepId.P1_1_INITIAL_SEGMENTATION,
        transcriptIdToProcess: 'transcript-123',
        overrideSeed: 42,
        hilMetaPrompt: 'test prompt',
        settings: {
          apiKey: 'test-key',
          temperature: 0.7,
          seed: 123,
          userDvFocus: { dv_focus: ['test'] }
        }
      }

      const result = service.validate(params)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.isValid).toBe(true)
      expect(result.data?.stepId).toBe(StepId.P1_1_INITIAL_SEGMENTATION)
      expect(result.data?.transcriptIdToProcess).toBe('transcript-123')
      expect(result.data?.overrideSeed).toBe(42)
      expect(result.data?.hilMetaPrompt).toBe('test prompt')
      expect(result.data?.settings).toEqual(params.settings)
    })

    it('should handle undefined optional parameters', () => {
      const params: StepExecutionParams = {
        stepId: StepId.P1_1_INITIAL_SEGMENTATION,
        settings: {
          apiKey: 'test-key',
          temperature: 0.7,
          userDvFocus: { dv_focus: ['test'] }
        }
      }

      const result = service.validate(params)

      expect(result.success).toBe(true)
      expect(result.data?.transcriptIdToProcess).toBeUndefined()
      expect(result.data?.overrideSeed).toBeUndefined()
      expect(result.data?.hilMetaPrompt).toBeUndefined()
    })

    it('should validate report step correctly', () => {
      const params: StepExecutionParams = {
        stepId: StepId.P6_1_GENERATE_MARKDOWN_REPORT,
        settings: {
          apiKey: 'test-key',
          temperature: 0.7,
          userDvFocus: { dv_focus: ['test'] }
        }
      }

      const result = service.validate(params)

      expect(result.success).toBe(true)
      expect(result.data?.isValid).toBe(true)
    })
  })
})