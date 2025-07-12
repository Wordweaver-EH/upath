# Testing Standards & TDD Requirements

## TDD Principles (NON-NEGOTIABLE)
1. **RED**: Write failing test first
2. **GREEN**: Write minimal code to pass
3. **REFACTOR**: Clean up while keeping tests green

## Test Structure Requirements
- **6-8 test cases minimum** per node
- **Real production imports**: Never mock the code under test
- **Comprehensive validation**: Test input validation, LLM errors, output validation
- **Error path coverage**: Test both recoverable and non-recoverable errors

## Test Categories (Required)
1. **Input Validation**: Missing P5_1/P5_2 outputs
2. **LLM Error Handling**: Network failures, invalid responses
3. **Output Validation**: Malformed JSON, missing fields
4. **Success Path**: Valid execution with proper state updates
5. **Edge Cases**: Empty arrays, invalid IDs, boundary conditions

## Test Patterns
```typescript
describe('NodeName', () => {
  let node: NodeClass;
  let mockLLMClient: any;
  
  beforeEach(() => {
    mockLLMClient = { generateContent: vi.fn() };
    node = new NodeClass();
  });

  // Input validation tests
  it('should validate required inputs exist', async () => {
    // Test missing P5_1, P5_2, etc.
  });

  // LLM error tests  
  it('should handle LLM failures gracefully', async () => {
    // Test network errors, timeouts
  });

  // Success path tests
  it('should successfully execute with valid inputs', async () => {
    // Test complete execution flow
  });
});
```

## Anti-Patterns (FORBIDDEN)
- ❌ **Mock routes in tests**: Never create fake endpoints
- ❌ **Self-referential testing**: Testing mocks instead of real code
- ❌ **Skipped tests**: test.skip() counts as 0% coverage
- ❌ **Incomplete assertions**: Must verify state updates completely