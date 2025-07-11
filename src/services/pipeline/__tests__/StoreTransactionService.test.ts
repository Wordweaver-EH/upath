import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { StoreTransactionService } from '../StoreTransactionService'
import { useTranscriptStore } from '../../../stores/transcriptStore'
import { useAnalysisResultStore } from '../../../stores/analysisResultStore'
import { usePromptHistoryStore } from '../../../stores/promptHistoryStore'
import { usePipelineOrchestrationStore } from '../../../stores/pipelineOrchestrationStore'
import { StepId, StepStatus } from '../../../../types'

// Mock storage to avoid persistence during tests
vi.mock('../../../utils/storage', () => ({
  localForageStorage: {
    setItem: vi.fn(),
    getItem: vi.fn().mockResolvedValue(null),
    removeItem: vi.fn()
  }
}))

describe('StoreTransactionService', () => {
  let service: StoreTransactionService

  beforeEach(() => {
    // Reset all stores using setState to ensure clean state
    useTranscriptStore.setState({ rawTranscripts: [], processedData: new Map() })
    useAnalysisResultStore.setState({ 
      genericAnalysisState: {
        isFullyProcessedGenericDiachronic: false,
        isFullyProcessedGenericSynchronic: false,
        isRefinementDone: false,
        isCausalModelingDone: false,
        isReportGenerated: false
      }
    })
    usePromptHistoryStore.setState({ 
      promptHistory: [],
      totalInputTokens: 0,
      totalOutputTokens: 0
    })
    usePipelineOrchestrationStore.setState({
      currentStepInfo: {
        stepId: StepId.IDLE,
        status: StepStatus.Idle
      },
      activeTranscriptIndex: 0,
      isAutorunning: false,
      shouldStopAutorun: false
    })
    
    // Create store operations for dependency injection
    const storeOperations = {
      getTranscriptState: () => useTranscriptStore.getState(),
      getAnalysisState: () => useAnalysisResultStore.getState(),
      replaceProcessedData: (id: string, data: any) => 
        useTranscriptStore.getState().replaceProcessedData(id, data),
      updateGenericState: (updates: any) => 
        useAnalysisResultStore.getState().updateGenericState(updates),
      getPromptHistoryState: () => usePromptHistoryStore.getState(),
      getOrchestrationState: () => usePipelineOrchestrationStore.getState(),
      resetTranscripts: () => useTranscriptStore.getState().reset(),
      addTranscriptsSync: (transcripts: any[]) => 
        useTranscriptStore.getState().addTranscriptsSync(transcripts),
      resetAnalysisState: () => useAnalysisResultStore.getState().reset(),
      resetPromptHistory: () => usePromptHistoryStore.getState().reset(),
      addPromptEntry: (entry: any) => 
        usePromptHistoryStore.getState().addPromptEntry(entry),
      resetOrchestration: () => usePipelineOrchestrationStore.getState().reset(),
      setCurrentStepInfo: (info: any) => 
        usePipelineOrchestrationStore.getState().setCurrentStepInfo(info),
      setActiveTranscriptIndex: (index: number) => 
        usePipelineOrchestrationStore.getState().setActiveTranscriptIndex(index),
      setAutorunning: (value: boolean) => 
        usePipelineOrchestrationStore.getState().setAutorunning(value),
      setShouldStopAutorun: (value: boolean) => 
        usePipelineOrchestrationStore.getState().setShouldStopAutorun(value),
      setHilContext: (context: any) => 
        usePipelineOrchestrationStore.getState().setHilContext(context)
    }
    
    service = new StoreTransactionService(storeOperations)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('beginTransaction', () => {
    it('should create a new transaction with captured state', () => {
      // Setup initial state
      useTranscriptStore.getState().addTranscriptsSync([{
        id: 'test-1',
        name: 'test.txt',
        content: 'test content',
        uploadedAt: Date.now()
      }])

      useAnalysisResultStore.getState().updateGenericState({
        isFullyProcessedGenericDiachronic: true
      })

      // Begin transaction
      const context = service.beginTransaction()

      expect(context.id).toMatch(/^tx_\d+_\d+$/)
      expect(context.status).toBe('active')
      expect(context.mutations).toEqual([])
      expect(context.snapshot.transcriptStore?.rawTranscripts).toHaveLength(1)
      expect(context.snapshot.analysisResultStore?.genericAnalysisState.isFullyProcessedGenericDiachronic).toBe(true)
    })
  })

  describe('commit', () => {
    it('should successfully commit an active transaction', () => {
      const context = service.beginTransaction()
      
      // Record some mutations
      service.recordMutation(context, 'transcript', 'addTranscript', ['test-2'])
      service.recordMutation(context, 'analysisResult', 'updateState', [{ test: true }])

      expect(() => service.commit(context)).not.toThrow()
      expect(context.status).toBe('committed')
    })

    it('should throw error when committing non-active transaction', () => {
      const context = service.beginTransaction()
      service.commit(context)

      expect(() => service.commit(context)).toThrow('Cannot commit transaction')
    })
  })

  describe('rollback', () => {
    it('should restore transcript store state on rollback', () => {
      // Initial state
      useTranscriptStore.getState().addTranscriptsSync([{
        id: 'original-1',
        name: 'original.txt',
        content: 'original content',
        uploadedAt: Date.now()
      }])

      // Verify initial state
      expect(useTranscriptStore.getState().rawTranscripts).toHaveLength(1)

      // Begin transaction
      const context = service.beginTransaction()

      // Make changes
      useTranscriptStore.getState().addTranscriptsSync([{
        id: 'new-1',
        name: 'new.txt',
        content: 'new content',
        uploadedAt: Date.now()
      }])
      useTranscriptStore.getState().updateProcessedData('original-1', {
        p0_1_output: 'test output'
      })

      // Verify changes applied
      expect(useTranscriptStore.getState().rawTranscripts).toHaveLength(2)
      expect(useTranscriptStore.getState().processedData.get('original-1')?.p0_1_output).toBe('test output')

      // Rollback
      service.rollback(context)

      // Verify state restored - get fresh state
      const restoredState = useTranscriptStore.getState()
      expect(restoredState.rawTranscripts).toHaveLength(1)
      expect(restoredState.rawTranscripts[0].id).toBe('original-1')
      expect(restoredState.processedData.get('original-1')).toBeDefined()
      expect(restoredState.processedData.get('original-1')?.p0_1_output).toBeUndefined()
    })

    it('should restore analysis result store state on rollback', () => {
      // Initial state
      useAnalysisResultStore.getState().updateGenericState({
        isFullyProcessedGenericDiachronic: true,
        p2_1_meta_output: 'original meta'
      })

      // Begin transaction
      const context = service.beginTransaction()

      // Make changes
      useAnalysisResultStore.getState().updateGenericState({
        isFullyProcessedGenericDiachronic: false,
        isFullyProcessedGenericSynchronic: true,
        p2_1_meta_output: 'modified meta',
        p2_2_diachronic_output: 'new output'
      })

      // Rollback
      service.rollback(context)

      // Verify state restored - get fresh state
      const state = useAnalysisResultStore.getState().genericAnalysisState
      expect(state.isFullyProcessedGenericDiachronic).toBe(true)
      expect(state.isFullyProcessedGenericSynchronic).toBe(false)
      expect(state.p2_1_meta_output).toBe('original meta')
      expect(state.p2_2_diachronic_output).toBeUndefined()
    })

    it('should restore prompt history store state on rollback', () => {
      // Initial state
      usePromptHistoryStore.getState().addPromptEntry({
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptId: 'test-1',
        prompt: 'original prompt',
        response: 'original response',
        timestamp: Date.now()
      })

      expect(usePromptHistoryStore.getState().promptHistory).toHaveLength(1)

      // Begin transaction
      const context = service.beginTransaction()

      // Make changes
      usePromptHistoryStore.getState().addPromptEntry({
        stepId: StepId.P0_2_EXTRACTION,
        transcriptId: 'test-1',
        prompt: 'new prompt',
        response: 'new response',
        timestamp: Date.now()
      })

      expect(usePromptHistoryStore.getState().promptHistory).toHaveLength(2)

      // Rollback
      service.rollback(context)

      // Verify state restored - get fresh state
      const restoredState = usePromptHistoryStore.getState()
      expect(restoredState.promptHistory).toHaveLength(1)
      expect(restoredState.promptHistory[0].stepId).toBe(StepId.P0_1_TRANSCRIPTION_ADHERENCE)
    })

    it('should restore orchestration store state on rollback', () => {
      // Initial state
      usePipelineOrchestrationStore.getState().setCurrentStepInfo({
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptId: 'test-1',
        status: StepStatus.Success
      })
      usePipelineOrchestrationStore.getState().setAutorunning(true)

      // Begin transaction
      const context = service.beginTransaction()

      // Make changes
      usePipelineOrchestrationStore.getState().setCurrentStepInfo({
        stepId: StepId.P0_2_EXTRACTION,
        transcriptId: 'test-2',
        status: StepStatus.Loading
      })
      usePipelineOrchestrationStore.getState().setAutorunning(false)
      usePipelineOrchestrationStore.getState().setShouldStopAutorun(true)

      // Rollback
      service.rollback(context)

      // Verify state restored - get fresh state
      const restoredState = usePipelineOrchestrationStore.getState()
      expect(restoredState.currentStepInfo.stepId).toBe(StepId.P0_1_TRANSCRIPTION_ADHERENCE)
      expect(restoredState.currentStepInfo.transcriptId).toBe('test-1')
      expect(restoredState.currentStepInfo.status).toBe(StepStatus.Success)
      expect(restoredState.isAutorunning).toBe(true)
      expect(restoredState.shouldStopAutorun).toBe(false)
    })

    it('should throw error when rolling back non-active transaction', () => {
      const context = service.beginTransaction()
      service.rollback(context)

      expect(() => service.rollback(context)).toThrow('Cannot rollback transaction')
    })
  })

  describe('executeInTransaction', () => {
    it('should commit on successful execution', async () => {
      const result = await service.executeInTransaction(async (context) => {
        useTranscriptStore.getState().addTranscriptsSync([{
          id: 'tx-test-1',
          name: 'transaction.txt',
          content: 'transaction content',
          uploadedAt: Date.now()
        }])
        
        useAnalysisResultStore.getState().updateGenericState({
          isFullyProcessedGenericDiachronic: true
        })

        service.recordMutation(context, 'transcript', 'addTranscript', ['tx-test-1'])
        service.recordMutation(context, 'analysisResult', 'updateState', [{ diachronic: true }])
        
        return 'success'
      })

      expect(result).toBe('success')
      expect(useTranscriptStore.getState().rawTranscripts).toHaveLength(1)
      expect(useAnalysisResultStore.getState().genericAnalysisState.isFullyProcessedGenericDiachronic).toBe(true)
    })

    it('should rollback on error', async () => {
      // Initial state
      useTranscriptStore.getState().addTranscriptsSync([{
        id: 'initial-1',
        name: 'initial.txt',
        content: 'initial content',
        uploadedAt: Date.now()
      }])

      await expect(service.executeInTransaction(async (context) => {
        useTranscriptStore.getState().addTranscriptsSync([{
          id: 'error-test-1',
          name: 'error.txt',
          content: 'error content',
          uploadedAt: Date.now()
        }])
        
        useAnalysisResultStore.getState().updateGenericState({
          isFullyProcessedGenericDiachronic: true
        })

        service.recordMutation(context, 'transcript', 'addTranscript', ['error-test-1'])
        
        // Simulate error
        throw new Error('Test error')
      })).rejects.toThrow('Test error')

      // Verify rollback - get fresh state
      const transcriptState = useTranscriptStore.getState()
      const analysisState = useAnalysisResultStore.getState()
      expect(transcriptState.rawTranscripts).toHaveLength(1)
      expect(transcriptState.rawTranscripts[0].id).toBe('initial-1')
      expect(analysisState.genericAnalysisState.isFullyProcessedGenericDiachronic).toBe(false)
    })
  })

  describe('recordMutation', () => {
    it('should record mutations in active transaction', () => {
      const context = service.beginTransaction()

      service.recordMutation(context, 'transcript', 'addTranscript', ['test-1'])
      service.recordMutation(context, 'analysisResult', 'updateState', [{ test: true }])

      expect(context.mutations).toHaveLength(2)
      expect(context.mutations[0]).toMatchObject({
        store: 'transcript',
        method: 'addTranscript',
        args: ['test-1']
      })
      expect(context.mutations[1]).toMatchObject({
        store: 'analysisResult',
        method: 'updateState',
        args: [{ test: true }]
      })
    })

    it('should throw error when recording mutation in non-active transaction', () => {
      const context = service.beginTransaction()
      service.commit(context)

      expect(() => 
        service.recordMutation(context, 'transcript', 'test', [])
      ).toThrow('Cannot record mutation')
    })
  })

  describe('getTransactionLog', () => {
    it('should return formatted transaction log', () => {
      const context = service.beginTransaction()

      service.recordMutation(context, 'transcript', 'addTranscript', ['test-1'])
      service.recordMutation(context, 'analysisResult', 'updateState', [{ 
        isFullyProcessedGenericDiachronic: true,
        p2_1_meta_output: 'Long output that should be truncated...'
      }])

      const log = service.getTransactionLog(context)

      expect(log).toContain(`Transaction ${context.id}:`)
      expect(log).toContain('Status: active')
      expect(log).toContain('Mutations (2):')
      expect(log).toContain('transcript.addTranscript')
      expect(log).toContain('analysisResult.updateState')
    })
  })

  describe('Complex transaction scenarios', () => {
    it('should handle multiple store updates atomically', async () => {
      // Setup initial state
      useTranscriptStore.getState().addTranscriptsSync([{
        id: 'complex-1',
        name: 'complex.txt',
        content: 'complex content',
        uploadedAt: Date.now()
      }])

      await service.executeInTransaction(async (context) => {
        // Update all stores
        useTranscriptStore.getState().updateProcessedData('complex-1', {
          p0_1_output: 'processed output',
          isFullyProcessedSpecificDiachronic: true
        })

        useAnalysisResultStore.getState().updateGenericState({
          isFullyProcessedGenericDiachronic: true,
          p2_1_meta_output: 'meta analysis'
        })

        usePromptHistoryStore.getState().addPromptEntry({
          stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
          transcriptId: 'complex-1',
          prompt: 'test prompt',
          response: 'test response',
          timestamp: Date.now()
        })

        usePipelineOrchestrationStore.getState().setCurrentStepInfo({
          stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
          status: StepStatus.Success
        })

        // Record mutations
        service.recordMutation(context, 'transcript', 'updateProcessedData', ['complex-1'])
        service.recordMutation(context, 'analysisResult', 'updateGenericState', [{}])
        service.recordMutation(context, 'promptHistory', 'addEntry', [{}])
        service.recordMutation(context, 'orchestration', 'setCurrentStepInfo', [{}])
      })

      // Verify all updates were applied - get fresh state
      const transcriptState = useTranscriptStore.getState()
      const analysisState = useAnalysisResultStore.getState()
      const promptState = usePromptHistoryStore.getState()
      const orchestrationState = usePipelineOrchestrationStore.getState()
      
      expect(transcriptState.processedData.get('complex-1')?.p0_1_output).toBe('processed output')
      expect(analysisState.genericAnalysisState.isFullyProcessedGenericDiachronic).toBe(true)
      expect(promptState.promptHistory).toHaveLength(1)
      expect(orchestrationState.currentStepInfo.status).toBe(StepStatus.Success)
    })

    it('should handle partial rollback correctly', async () => {
      // Initial state with existing data
      useTranscriptStore.getState().addTranscriptsSync([
        {
          id: 'existing-1',
          name: 'existing1.txt',
          content: 'existing content 1',
          uploadedAt: Date.now()
        },
        {
          id: 'existing-2',
          name: 'existing2.txt',
          content: 'existing content 2',
          uploadedAt: Date.now()
        }
      ])
      
      useTranscriptStore.getState().updateProcessedData('existing-1', {
        p0_1_output: 'original output'
      })

      useAnalysisResultStore.getState().updateGenericState({
        p2_1_meta_output: 'original meta',
        isFullyProcessedGenericDiachronic: false
      })

      // Attempt transaction that will fail
      await expect(service.executeInTransaction(async () => {
        // Make multiple changes
        useTranscriptStore.getState().updateProcessedData('existing-1', {
          p0_1_output: 'modified output',
          p0_2_output: 'new output'
        })
        
        useTranscriptStore.getState().updateProcessedData('existing-2', {
          p0_1_output: 'another output'
        })
        
        useTranscriptStore.getState().removeTranscript('existing-2')
        
        useAnalysisResultStore.getState().updateGenericState({
          p2_1_meta_output: 'modified meta',
          p2_2_diachronic_output: 'new diachronic',
          isFullyProcessedGenericDiachronic: true
        })

        throw new Error('Simulated failure')
      })).rejects.toThrow('Simulated failure')

      // Verify complete rollback - get fresh state
      const transcriptState = useTranscriptStore.getState()
      const analysisState = useAnalysisResultStore.getState()
      
      expect(transcriptState.rawTranscripts).toHaveLength(2)
      expect(transcriptState.processedData.get('existing-1')?.p0_1_output).toBe('original output')
      expect(transcriptState.processedData.get('existing-1')?.p0_2_output).toBeUndefined()
      expect(transcriptState.processedData.get('existing-2')).toBeDefined()
      expect(analysisState.genericAnalysisState.p2_1_meta_output).toBe('original meta')
      expect(analysisState.genericAnalysisState.p2_2_diachronic_output).toBeUndefined()
      expect(analysisState.genericAnalysisState.isFullyProcessedGenericDiachronic).toBe(false)
    })
  })
})