# Transaction Pattern Documentation

**Navigation:** [📚 Docs Home](../README.md) | [📋 Migration Plan](../MIGRATION-PLAN.md) | [🔧 Store Migration Pattern](STORE-MIGRATION-PATTERN.md) | [📚 State Refactoring](../plan/01_state_refactoring.md)

## Overview

The Transaction Pattern implemented in Phase 3 provides atomic operations across multiple Zustand stores in the µ-PATH application. This ensures data consistency during complex pipeline operations that modify multiple stores.

## Core Components

### 1. StoreTransactionService

The `StoreTransactionService` manages atomic operations across all application stores:
- TranscriptStore
- AnalysisResultStore
- PromptHistoryStore
- OrchestrationStore

#### Key Methods

```typescript
// Begin a new transaction
beginTransaction(): TransactionContext

// Commit all changes
commit(context: TransactionContext): void

// Rollback to original state
rollback(context: TransactionContext): void

// Execute function with automatic transaction handling
async executeInTransaction<T>(
  fn: (context: TransactionContext) => Promise<T>
): Promise<T>
```

### 2. Transaction Context

Each transaction maintains:
- Unique transaction ID
- Snapshots of all store states
- List of mutations performed
- Transaction status (active/committed/rolled_back)

## Usage Patterns

### Basic Transaction

```typescript
const context = transactionService.beginTransaction()
try {
  // Perform multiple store operations
  storeOperations.updateGenericState({ ... })
  storeOperations.replaceProcessedData(id, data)
  
  // Commit on success
  transactionService.commit(context)
} catch (error) {
  // Rollback on error
  transactionService.rollback(context)
  throw error
}
```

### Automatic Transaction Handling

```typescript
await transactionService.executeInTransaction(async (context) => {
  // All operations here are atomic
  await performComplexOperation()
  updateMultipleStores()
  // Automatically commits on success, rolls back on error
})
```

## Integration with PipelineOrchestrator

The PipelineOrchestrator uses transactions for:

1. **Error Handling**: Atomic updates when API calls fail
2. **Success Handling**: Atomic updates across stores on successful execution
3. **Consistency**: Ensures prompt history, transcript data, and analysis state stay synchronized

### Example: Error Handling

```typescript
await this.transactionService.executeInTransaction(async (txContext) => {
  // Update error state atomically
  this.errorService.handleError({ ... })
  this.updateStores({ status: StepStatus.Error })
  
  // Record mutations for debugging
  this.transactionService.recordMutation(
    txContext, 
    'transcript', 
    'handleError', 
    [stepId, transcriptId]
  )
})
```

## Snapshot and Restore Mechanism

### Snapshot Creation
- Deep clones of store state are created at transaction start
- Immutable snapshots ensure accurate rollback
- Efficient memory usage through selective snapshotting

### Restore Process
1. Reset stores to initial state
2. Reapply original data from snapshots
3. Maintain referential integrity

## Dependency Injection

The transaction service uses dependency injection to avoid direct store imports:

```typescript
interface TransactionStoreOperations {
  getTranscriptState(): TranscriptState
  getAnalysisState(): AnalysisState
  resetTranscripts(): void
  updateGenericState(updates: Partial<GenericAnalysisState>): void
  // ... other operations
}
```

## Transaction Logging

All transactions are logged for debugging:
- Transaction ID and timestamp
- Duration and mutation count
- Detailed mutation history

Example log:
```
[StoreTransaction] Transaction tx_1234567_abcde started
[StoreTransaction] Transaction tx_1234567_abcde committed (45ms, 3 mutations)
```

## Best Practices

1. **Keep Transactions Small**: Minimize the scope of each transaction
2. **Avoid Nested Transactions**: Use a single transaction per operation
3. **Handle Async Operations**: Ensure all async operations complete within the transaction
4. **Test Rollback Scenarios**: Always test error paths to verify rollback behavior

## Testing Transactions

### Unit Tests
```typescript
it('should rollback on error', async () => {
  const initialState = getStoreState()
  
  await expect(
    transactionService.executeInTransaction(async () => {
      updateStore()
      throw new Error('Test error')
    })
  ).rejects.toThrow()
  
  expect(getStoreState()).toEqual(initialState)
})
```

### Integration Tests
- Test atomic updates across multiple stores
- Verify consistency during concurrent operations
- Ensure proper error propagation

## Performance Considerations

1. **Snapshot Overhead**: Minimal due to selective cloning
2. **Transaction Scope**: Keep transactions focused on related operations
3. **Concurrent Transactions**: Each transaction is independent

## Future Enhancements

1. **Transaction Metrics**: Add performance monitoring
2. **Replay Capability**: Record and replay transactions for debugging
3. **Optimistic Locking**: Detect concurrent modifications
4. **Transaction Middleware**: Hook into Zustand middleware layer

## Migration Guide

To add transaction support to new operations:

1. Inject TransactionStoreOperations into your service
2. Wrap critical operations in executeInTransaction
3. Record mutations for debugging
4. Test both success and rollback paths

```typescript
class YourService {
  constructor(
    private storeOps: TransactionStoreOperations,
    private transactionService: StoreTransactionService
  ) {}
  
  async criticalOperation() {
    await this.transactionService.executeInTransaction(async (ctx) => {
      // Your atomic operations here
    })
  }
}
```