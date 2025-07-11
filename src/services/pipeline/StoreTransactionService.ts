import type { RawTranscript, TranscriptProcessedData, GenericAnalysisState, PromptHistoryEntry } from '../../../types'
import type { TransactionStoreOperations } from './types'

/**
 * Represents a captured state snapshot for a single store
 */
interface StoreSnapshot {
  transcriptStore?: {
    rawTranscripts: RawTranscript[]
    processedData: Array<[string, TranscriptProcessedData]>
  }
  analysisResultStore?: {
    genericAnalysisState: GenericAnalysisState
  }
  promptHistoryStore?: {
    promptHistory: PromptHistoryEntry[]
    totalInputTokens: number
    totalOutputTokens: number
  }
  orchestrationStore?: any
}

/**
 * Represents a single mutation operation
 */
interface Mutation {
  store: 'transcript' | 'analysisResult' | 'promptHistory' | 'orchestration'
  method: string
  args: any[]
  timestamp: number
}

/**
 * Transaction context containing all state for a transaction
 */
export interface TransactionContext {
  id: string
  startTime: number
  snapshot: StoreSnapshot
  mutations: Mutation[]
  status: 'active' | 'committed' | 'rolled_back'
}

/**
 * Service for managing atomic store transactions
 * 
 * Provides transaction support for Zustand stores to ensure data consistency
 * across multiple store updates. Supports automatic rollback on failure.
 */
export class StoreTransactionService {
  private activeTransactions: Map<string, TransactionContext> = new Map()
  private transactionCounter = 0
  private storeOps?: TransactionStoreOperations

  constructor(storeOperations?: TransactionStoreOperations) {
    this.storeOps = storeOperations
  }

  /**
   * Get store operations either from dependency injection or direct imports
   * This allows backward compatibility while supporting dependency injection
   */
  private getStoreOperations(): TransactionStoreOperations {
    if (this.storeOps) {
      return this.storeOps
    }

    throw new Error('StoreTransactionService requires store operations to be injected')
  }

  /**
   * Begins a new transaction by capturing current store states
   */
  beginTransaction(): TransactionContext {
    const id = `tx_${Date.now()}_${++this.transactionCounter}`
    
    // Capture current state snapshots
    const snapshot: StoreSnapshot = {
      transcriptStore: this.captureTranscriptStore(),
      analysisResultStore: this.captureAnalysisResultStore(),
      promptHistoryStore: this.capturePromptHistoryStore(),
      orchestrationStore: this.captureOrchestrationStore()
    }

    const context: TransactionContext = {
      id,
      startTime: Date.now(),
      snapshot,
      mutations: [],
      status: 'active'
    }

    this.activeTransactions.set(id, context)
    
    console.log(`[StoreTransaction] Transaction ${id} started`)
    return context
  }

  /**
   * Commits a transaction by finalizing all mutations
   */
  commit(context: TransactionContext): void {
    if (context.status !== 'active') {
      throw new Error(`Cannot commit transaction ${context.id} with status ${context.status}`)
    }

    context.status = 'committed'
    this.activeTransactions.delete(context.id)
    
    const duration = Date.now() - context.startTime
    console.log(`[StoreTransaction] Transaction ${context.id} committed (${duration}ms, ${context.mutations.length} mutations)`)
  }

  /**
   * Rolls back a transaction by restoring original states
   */
  rollback(context: TransactionContext): void {
    if (context.status !== 'active') {
      throw new Error(`Cannot rollback transaction ${context.id} with status ${context.status}`)
    }

    console.log(`[StoreTransaction] Rolling back transaction ${context.id}`)

    // Restore original states
    if (context.snapshot.transcriptStore) {
      this.restoreTranscriptStore(context.snapshot.transcriptStore)
    }
    if (context.snapshot.analysisResultStore) {
      this.restoreAnalysisResultStore(context.snapshot.analysisResultStore)
    }
    if (context.snapshot.promptHistoryStore) {
      this.restorePromptHistoryStore(context.snapshot.promptHistoryStore)
    }
    if (context.snapshot.orchestrationStore) {
      this.restoreOrchestrationStore(context.snapshot.orchestrationStore)
    }

    context.status = 'rolled_back'
    this.activeTransactions.delete(context.id)
    
    const duration = Date.now() - context.startTime
    console.log(`[StoreTransaction] Transaction ${context.id} rolled back (${duration}ms)`)
  }

  /**
   * Executes a function within a transaction, automatically handling commit/rollback
   */
  async executeInTransaction<T>(
    fn: (context: TransactionContext) => Promise<T>
  ): Promise<T> {
    const context = this.beginTransaction()
    
    try {
      const result = await fn(context)
      this.commit(context)
      return result
    } catch (error) {
      this.rollback(context)
      throw error
    }
  }

  /**
   * Records a mutation within a transaction
   */
  recordMutation(
    context: TransactionContext,
    store: 'transcript' | 'analysisResult' | 'promptHistory' | 'orchestration',
    method: string,
    args: any[]
  ): void {
    if (context.status !== 'active') {
      throw new Error(`Cannot record mutation in transaction ${context.id} with status ${context.status}`)
    }

    context.mutations.push({
      store,
      method,
      args,
      timestamp: Date.now()
    })
  }

  /**
   * Gets transaction logs for debugging
   */
  getTransactionLog(context: TransactionContext): string {
    const mutations = context.mutations.map(m => 
      `  - ${m.store}.${m.method}(${JSON.stringify(m.args).slice(0, 100)}...)`
    ).join('\n')
    
    return `Transaction ${context.id}:
  Status: ${context.status}
  Duration: ${Date.now() - context.startTime}ms
  Mutations (${context.mutations.length}):
${mutations}`
  }

  // Private methods for capturing store states
  private captureTranscriptStore() {
    const state = this.getStoreOperations().getTranscriptState()
    return {
      rawTranscripts: [...state.rawTranscripts],
      processedData: Array.from(state.processedData.entries())
    }
  }

  private captureAnalysisResultStore() {
    const state = this.getStoreOperations().getAnalysisState()
    return {
      genericAnalysisState: { ...state.genericAnalysisState }
    }
  }

  private capturePromptHistoryStore() {
    const state = this.getStoreOperations().getPromptHistoryState()
    return {
      promptHistory: [...state.promptHistory],
      totalInputTokens: state.totalInputTokens,
      totalOutputTokens: state.totalOutputTokens
    }
  }

  private captureOrchestrationStore() {
    const state = this.getStoreOperations().getOrchestrationState()
    // Deep clone the entire state
    return JSON.parse(JSON.stringify({
      currentStepInfo: state.currentStepInfo,
      activeTranscriptIndex: state.activeTranscriptIndex,
      isAutorunning: state.isAutorunning,
      shouldStopAutorun: state.shouldStopAutorun,
      lastHilContext: state.lastHilContext,
      lastExecutionParams: state.lastExecutionParams
    }))
  }

  // Private methods for restoring store states
  private restoreTranscriptStore(snapshot: StoreSnapshot['transcriptStore']) {
    if (!snapshot) return
    
    const ops = this.getStoreOperations()
    // Use reset and then restore data
    ops.resetTranscripts()
    
    // Restore raw transcripts
    if (snapshot.rawTranscripts.length > 0) {
      ops.addTranscriptsSync(snapshot.rawTranscripts)
    }
    
    // Restore processed data
    snapshot.processedData.forEach(([id, data]) => {
      ops.replaceProcessedData(id, data)
    })
  }

  private restoreAnalysisResultStore(snapshot: StoreSnapshot['analysisResultStore']) {
    if (!snapshot) return
    
    const ops = this.getStoreOperations()
    ops.resetAnalysisState()
    ops.updateGenericState(snapshot.genericAnalysisState)
  }

  private restorePromptHistoryStore(snapshot: StoreSnapshot['promptHistoryStore']) {
    if (!snapshot) return
    
    const ops = this.getStoreOperations()
    // Reset to clear state
    ops.resetPromptHistory()
    
    // Restore entries one by one to maintain token counts
    snapshot.promptHistory.forEach(entry => ops.addPromptEntry(entry))
  }

  private restoreOrchestrationStore(snapshot: any) {
    if (!snapshot) return
    
    const ops = this.getStoreOperations()
    // Reset to initial state
    ops.resetOrchestration()
    
    // Restore saved state
    if (snapshot.currentStepInfo) {
      ops.setCurrentStepInfo(snapshot.currentStepInfo)
    }
    if (snapshot.activeTranscriptIndex !== undefined) {
      ops.setActiveTranscriptIndex(snapshot.activeTranscriptIndex)
    }
    if (snapshot.isAutorunning !== undefined) {
      ops.setAutorunning(snapshot.isAutorunning)
    }
    if (snapshot.shouldStopAutorun !== undefined) {
      ops.setShouldStopAutorun(snapshot.shouldStopAutorun)
    }
    if (snapshot.lastHilContext) {
      ops.setHilContext(snapshot.lastHilContext)
    }
  }
}