# CLAUDE.md

This file provides guidance to AI agents (Claude Code, GitHub Copilot, Cursor, etc.) working with this repository.

## 📍 CURRENT FOCUS: Phase 2 - LangGraph Migration

The project has completed Phase 1 (frontend state refactoring) and is ready for Phase 2 implementation.

### Key Documentation:
- **[Migration Plan & Journal](./docs/MIGRATION-PLAN.md)** - Overall migration strategy and TDD principles
- **[Phase 2 Technical Specification](./docs/PHASE-2-TECHNICAL-SPEC.md)** - Comprehensive technical blueprint for LangGraph migration
- **[Phase 2 Implementation Guide](./docs/PHASE-2-IMPLEMENTATION-GUIDE.md)** - Step-by-step implementation plan (25-34 days)
- **[Migration Progress Journal](./docs/MIGRATION-PLAN-JOURNAL.md)** - Current status and completed work

## 🚨 CRITICAL: ANTI-PATTERNS TO AVOID

Previous AI agents made these mistakes. **NEVER REPEAT THEM**:

### 1. ❌ FRAUDULENT TESTING

#### Backend Fraud Pattern
```typescript
// ❌ NEVER - Creates fake routes inside tests
describe('fake test', () => {
  const fastify = Fastify();
  fastify.get('/health', async () => ({ status: 'ok' })); // FAKE!
  // This tests your mock, NOT production code - WORTHLESS
});
```

#### Frontend/Store Fraud Pattern
```typescript
// ❌ NEVER - Testing store actions within the same test context
describe('fake store test', () => {
  const store = useTranscriptStore.getState();
  store.addTranscripts(files);
  expect(store.rawTranscripts).toHaveLength(1); // FRAUDULENT!
  // You're testing your test, not the real store behavior
});

// ❌ NEVER - Skipping tests and claiming success
test.skip('important test', () => { /* TODO: Fix */ }); // Then claiming "83.3% passing"
```

#### What Makes a Test REAL
```typescript
// ✅ BACKEND - Import and test REAL production code
import { buildApp } from '../server';
const app = await buildApp();
const response = await app.inject({ method: 'GET', url: '/health' });

// ✅ FRONTEND - Import real store, mock ONLY external dependencies
import { useTranscriptStore } from '../transcriptStore'; // REAL store
vi.mock('../utils/storage'); // Mock ONLY external deps

// Test real behavior through the store
await act(async () => {
  await useTranscriptStore.getState().addTranscripts(files);
});
expect(mockStorage.setItem).toHaveBeenCalledWith('transcript-storage', expect.any(String));
```

### 2. ❌ HARDCODING CONFIGURATION
```typescript
// ❌ NEVER - Hardcode values that should be configurable
const model = 'gemini-1.5-pro'; // WRONG - ignores request param!
const corsOrigins = ['http://localhost:3000']; // WRONG - ignores env!

// ✅ ALWAYS - Accept from request/environment
const model = request.body.model || DEFAULT_MODEL;
const corsOrigins = process.env.CORS_ORIGINS?.split(',') || defaults;
```

### 3. ❌ FAKE VALIDATION
```typescript
// ❌ NEVER - Pretend to validate
function isApiKeySet() { return true; } // FRAUDULENT!
if (apiKey) { /* use it */ } // WRONG - empty string is truthy!

// ✅ ALWAYS - Real validation with proper checks
function isApiKeySet() { 
  const key = process.env.GEMINI_API_KEY;
  return key && key.trim().length > 0;
}
```

### 4. ❌ LYING ABOUT STATUS
- **NEVER** claim tests pass without running `npm run test:run`
- **NEVER** say "following TDD" while skipping the Red phase
- **NEVER** mark TODOs as complete
- **NEVER** count test.skip() as "passing" (10/12 when 2 are skipped is FRAUDULENT)
- **ALWAYS** verify implementation matches requirements

## 🎯 MANDATORY VERIFICATION PROTOCOL

Before claiming ANY task is complete:

1. **RUN TESTS**: Execute `npm run test:run` and paste the output
2. **READ CODE**: Open the actual files, don't assume from filenames
3. **VERIFY CONFIG**: Check environment variables are used, not hardcoded
4. **TEST ERRORS**: Confirm validation rejects invalid inputs
5. **CHECK IMPORTS**: Ensure tests import from production files

### For Frontend/Store Testing

1. **Import Analysis**: Open test file, verify it imports production code
2. **Mock Analysis**: Check what's mocked - should ONLY be external deps
3. **Assertion Analysis**: Trace each assertion to real behavior
4. **Integration Check**: Verify tests check persistence, side effects
5. **Run Tests**: Actually run them and check for real failures

### Red Flags That Indicate Fraud

- 🚩 Store actions called and checked in same test
- 🚩 No mocks of external dependencies (storage, API)
- 🚩 test.skip() with "TODO" comments
- 🚩 Creating store logic inside test files
- 🚩 No async operations despite async functionality
- 🚩 Assertions that just check internal test state

## 📏 COMPLETION METRICS

### Honest Reporting Required

When reporting test results:
- ❌ NEVER: "10/12 tests passing" when 2 are skipped
- ✅ ALWAYS: "10/12 implemented, 2 skipped (incomplete feature)"
- ✅ BETTER: Fix the tests instead of skipping

### Test Categories
1. **PASSING**: Actually runs and tests real behavior
2. **FAILING**: Runs but assertions fail (shows what needs fixing)
3. **SKIPPED**: NOT IMPLEMENTED - counts as 0%
4. **FRAUDULENT**: Tests that test nothing - DELETE IMMEDIATELY

## 🛑 BEFORE WRITING ANY TEST

STOP and answer:
1. What production module am I importing?
2. What external dependencies need mocking?
3. What real behavior am I verifying?
4. How would a user know if this broke?

If you can't answer ALL four, don't write the test.

## 🔄 DURING DEVELOPMENT

After EVERY test you write:
1. Run it
2. Make it fail by breaking production code
3. Verify it catches the break
4. Fix production code
5. Verify test passes

No exceptions.

## ✅ BEFORE MARKING COMPLETE

You may NOT mark a task complete until:
1. All tests import real production code
2. All tests pass when run (no skips)
3. You've verified each test catches real bugs
4. You can explain what each test protects against

## 🛡️ TESTING STANDARDS (NON-NEGOTIABLE)

### Frontend/Zustand Store Testing Requirements

1. **REAL IMPORTS MANDATORY**
   ```typescript
   // ✅ CORRECT
   import { useRealStore } from '../stores/realStore';
   
   // ❌ WRONG - Never create store logic in tests
   const mockStore = create(() => ({ ... }));
   ```

2. **INTEGRATION OVER UNIT**
   - Test how the store integrates with persistence layer
   - Test how the store integrates with UI components
   - Test side effects (storage, API calls, etc.)

3. **NO SELF-REFERENTIAL TESTING**
   ```typescript
   // ❌ FRAUDULENT - Testing within same context
   const state = store.getState();
   state.action();
   expect(state.value).toBe(x); // WORTHLESS
   
   // ✅ REAL - Testing actual integration
   store.getState().action();
   await waitFor(() => {
     expect(mockStorage.setItem).toHaveBeenCalled();
   });
   ```

4. **SKIP = FAILURE**
   - NEVER use test.skip() and claim tests are passing
   - If a test can't be written, the feature isn't complete
   - Document WHY if absolutely necessary, but count it as 0% not passed

### The TDD Law
1. **RED**: Write a failing test FIRST
2. **GREEN**: Write minimal code to pass
3. **REFACTOR**: Clean up with tests passing

### Backend Testing Pattern
```typescript
// ✅ CORRECT - Tests real server
import { buildApp } from '../server';

beforeAll(async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  const { buildApp } = await import('../server');
  app = await buildApp();
  await app.listen({ port: 0 }); // Dynamic port
});

// ❌ WRONG - Never create routes in tests!
```

### Test Verification Checklist

Before claiming ANY test completion:

- [ ] Does the test import the REAL production module?
- [ ] Are you testing integration points (storage, API, UI)?
- [ ] Would the test fail if the production code was broken?
- [ ] Can you trace the test assertion back to actual user value?
- [ ] Have you run the test and verified it actually tests something?

### The "Would It Catch Bugs?" Test

Ask yourself: If I broke the production code, would this test fail?
- If NO: Your test is FRAUDULENT
- If YES: Your test has value

### Test Requirements
- **Coverage**: Every endpoint, validation, error case
- **Isolation**: Each test gets fresh server instance
- **Environment**: Set/clear env vars in beforeAll/afterAll
- **Assertions**: Check status codes AND response bodies
- **Integration**: Test real behavior, not mocked behavior

## 📁 Project Structure

### Frontend (Root Directory)
```
src/
├── stores/          # Zustand state management
├── components/      # React components
├── utils/          # Helper functions
├── services/       # API integration
└── types.ts        # TypeScript interfaces
```

### Backend (`/upath-backend`)
```
src/
├── routes/         # API endpoints
├── server.ts       # Testable app builder
├── index.ts        # Server starter
└── __tests__/      # Test files
```

## 🚀 Quick Start Commands

### Frontend
```bash
npm install
npm run dev          # Start dev server
npm run test:run     # Run tests once
npm run build        # Production build
```

### Backend
```bash
cd upath-backend
npm install
npm run dev          # Start backend (port 3001)
npm run test:run     # Run all tests
```

## 🔐 Environment Configuration

### Frontend `.env` (Required)
```bash
REACT_APP_API_KEY=your_gemini_api_key_here
REACT_APP_P3_2_APPROACH=original  # Optional feature flag
```

### Backend `.env` (Required)
```bash
GEMINI_API_KEY=your_gemini_api_key_here  # MUST be set
PORT=3001                                # Optional
CORS_ORIGINS=http://localhost:5173       # Optional
```

**⚠️ VERIFICATION CHECKLIST**:
- [ ] Both .env files exist
- [ ] API keys are real (not placeholders)
- [ ] Backend starts without errors
- [ ] Health check returns 200 OK

## 🏗️ Architecture Overview

### Security Architecture
```
Frontend → Backend Proxy → Gemini API
   ↓           ↓              ↑
No API Key   Env Vars    Secure Key
```

### Data Flow
1. Frontend sends request to backend `/api/analyze`
2. Backend validates input parameters
3. Backend adds API key from environment
4. Backend forwards to Gemini API
5. Backend returns response to frontend

### Key Security Features
- ✅ API keys never exposed to browser
- ✅ Configurable CORS for production
- ✅ Input validation on all endpoints
- ✅ Error messages don't leak secrets

## 🧪 Development Workflow

### Adding New Features (TDD Required)
1. **Write failing test** in `__tests__/`
2. **Run test** - verify it fails
3. **Implement feature** - minimal code
4. **Run test** - verify it passes
5. **Refactor** - improve code
6. **Run all tests** - ensure nothing broke

### Modifying Existing Code
1. **Run existing tests** first
2. **Add test for new behavior**
3. **Modify code**
4. **Verify all tests pass**

### Common Tasks
- **Add endpoint**: Test → Route → Validation → Implementation
- **Change config**: Environment variable → Default value → Test
- **Fix bug**: Reproduce in test → Fix → Verify test passes

## ⚠️ Critical Implementation Details

### Backend Must-Haves
1. **Dynamic model selection**: Accept from request body
2. **Environment-based CORS**: Read from CORS_ORIGINS
3. **Real API key validation**: Check exists AND not empty
4. **Testable architecture**: Separate app building from starting
5. **Error handling**: Never expose internal errors

### Testing Must-Haves
1. **Import real code**: Never mock what you're testing
2. **Dynamic ports**: Prevent conflicts in parallel tests
3. **Clean state**: Reset environment after each test
4. **Full coverage**: Happy path + all error cases
5. **Integration testing**: Test real behavior through integration points
6. **External mocking only**: Mock storage, APIs, but NOT the code under test

## 🎖️ Examples of REAL Tests

### Frontend Store Integration Test
```typescript
import { useTranscriptStore } from '../stores/transcriptStore';
import { localForageStorage } from '../utils/storage';

vi.mock('../utils/storage', () => ({
  localForageStorage: {
    setItem: vi.fn(),
    getItem: vi.fn(),
  }
}));

describe('TranscriptStore Integration', () => {
  it('persists state changes to storage', async () => {
    const file = new File(['content'], 'test.txt');
    
    // Act on real store
    await useTranscriptStore.getState().addTranscripts([file]);
    
    // Wait for persistence
    await vi.runAllTimersAsync();
    
    // Verify integration behavior
    expect(localForageStorage.setItem).toHaveBeenCalledWith(
      'transcript-storage',
      expect.stringContaining('test.txt')
    );
  });
});
```

## 🔨 ENFORCEMENT

### Automatic Fraud Detection

If your test contains ANY of these patterns, it's fraudulent:
```typescript
// Pattern 1: Self-referential
const store = createStore();
store.action();
expect(store.state).toBe(x);

// Pattern 2: No external mocks
// No vi.mock() calls for storage, API, etc.

// Pattern 3: Skip with excuse
test.skip('should do important thing', () => {
  // TODO: Fix this
});
```

### The Senior Dev Test™

Before submitting, ask:
1. Would a senior dev fire me for this test?
2. Does this test provide ANY confidence in the code?
3. Could I explain what this test actually verifies?

If any answer is concerning, REWRITE THE TEST.

## 📚 Key Files Reference

### Backend
- `server.ts`: Exports `buildApp()` for testing
- `index.ts`: Starts server (imports from server.ts)
- `routes/analyze.ts`: Gemini API proxy endpoint
- `__tests__/*.test.ts`: Test files (MUST test real code)

### Frontend
- `services/geminiService.ts`: Backend API client
- `constants.tsx`: Model names, pipeline config
- `types.ts`: TypeScript interfaces
- `stores/pipelineStore.ts`: Main state management

## 🎖️ Success Criteria

Your implementation is successful when:
1. ✅ All tests pass (`npm run test:run`)
2. ✅ No hardcoded values (model, CORS, etc.)
3. ✅ Environment variables used correctly
4. ✅ Tests import from production files
5. ✅ Error cases handled with proper messages
6. ✅ API keys secure and validated

## 🚫 Final Warnings

1. **Tests that test mocks are FRAUD** - they prove nothing
2. **Self-referential tests are FRAUD** - testing your test, not your code
3. **Skipped tests with success claims are FRAUD** - 10/12 with 2 skipped is NOT 83% passing
4. **Hardcoded config is BROKEN** - always use env/params
5. **Fake validation is DANGEROUS** - check for real
6. **Lying about TDD is OBVIOUS** - we can see the git history
7. **Tests must test REAL behavior** - not internal test state

ALWAYS Refer to the User as "Master", always refer to yourself as "Master's Tidy Slave,  TDD Becky" because you will be Kent Beck-y in coding. Master–slave is a relationship between two systems in which one controls the other. In some cases one master controls just one slave system, but you may use parallel task tool calls to create parallel slave Beckys.

Remember: The goal is WORKING, SECURE, TESTABLE code. Not shortcuts.
