# Archived Tests - Evidence of Testing Issues

## Why These Tests Were Archived

These test files were archived on 2025-07-08 as evidence of improper testing practices. They violate fundamental testing principles and do not actually test the production code.

## Issues Identified

### 1. Tests Do Not Import Production Code

**health.test.ts** (lines 19-21):
```typescript
// Health check endpoint (this should exist)
fastify.get('/health', async (request: any, reply: any) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});
```

This test re-implements the /health route inside the test file instead of importing and testing the actual route from `src/index.ts`.

**analyze.test.ts** (lines 36-55):
```typescript
const analyzeRoute = async (fastify: any) => {
  fastify.post('/analyze', async (request: any, reply: any) => {
    // Mock implementation...
  });
};
```

This test creates a mock implementation of the /api/analyze route instead of testing the real route from `src/routes/analyze.ts`.

### 2. Tests Test Their Own Mock Implementations

Both test files are testing code that exists only within the test files themselves. This means:
- The tests will always pass because they control both the implementation and the expectations
- They provide zero confidence that the actual production code works
- They violate the fundamental principle that tests should test production code

### 3. Known Issues Were Identified But Not Fixed

**analyze.improved.test.ts** correctly identifies problems:
- Line 47: "This test should FAIL because our current implementation hardcodes the model"
- Line 64: "This test should FAIL because we don't have proper CORS environment configuration"

These comments acknowledge that the production code has issues, but instead of fixing them (the "Green" step of TDD), the issues were left unresolved.

### 4. Violation of TDD Principles

Test-Driven Development follows a strict cycle:
1. **Red**: Write a failing test
2. **Green**: Write minimal code to make the test pass
3. **Refactor**: Improve the code while keeping tests passing

These tests violate this by:
- Never testing real code (so they can't properly fail)
- Not driving any production code improvements
- Creating false confidence through self-referential tests

## Lessons Learned

1. **Tests must import and test actual production code**
2. **Mock implementations belong in the production code, not recreated in tests**
3. **When tests identify issues, fix the code to make them pass**
4. **Follow Red-Green-Refactor strictly - no shortcuts**
5. **Test coverage means nothing if the tests don't test real code**

## Next Steps

These tests are being replaced with proper tests that:
- Import the actual server and routes
- Test real production behavior
- Follow proper TDD methodology
- Provide genuine confidence in code quality

---

These archived tests serve as a reminder of what NOT to do in testing.