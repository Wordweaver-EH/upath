# CLAUDE.md

This file provides guidance to AI agents (Claude Code, GitHub Copilot, Cursor, etc.) working with this repository.

## 🚨 CRITICAL: ANTI-PATTERNS TO AVOID

Previous AI agents made these mistakes. **NEVER REPEAT THEM**:

### 1. ❌ FRAUDULENT TESTING
```typescript
// ❌ NEVER - Creates fake routes inside tests
describe('fake test', () => {
  const fastify = Fastify();
  fastify.get('/health', async () => ({ status: 'ok' })); // FAKE!
  // This tests your mock, NOT production code - WORTHLESS
});

// ✅ ALWAYS - Import and test REAL production code
import { buildApp } from '../server';
const app = await buildApp();
const response = await app.inject({ method: 'GET', url: '/health' });
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
- **ALWAYS** verify implementation matches requirements

## 🎯 MANDATORY VERIFICATION PROTOCOL

Before claiming ANY task is complete:

1. **RUN TESTS**: Execute `npm run test:run` and paste the output
2. **READ CODE**: Open the actual files, don't assume from filenames
3. **VERIFY CONFIG**: Check environment variables are used, not hardcoded
4. **TEST ERRORS**: Confirm validation rejects invalid inputs
5. **CHECK IMPORTS**: Ensure tests import from production files

## 🛡️ TESTING STANDARDS (NON-NEGOTIABLE)

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

### Test Requirements
- **Coverage**: Every endpoint, validation, error case
- **Isolation**: Each test gets fresh server instance
- **Environment**: Set/clear env vars in beforeAll/afterAll
- **Assertions**: Check status codes AND response bodies

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

### Codebase Analysis
```bash
# Generate a text file of the entire codebase (excluding .md, .txt, and test files)
gitingest . -o upath-codebase.txt -e "*.md" -e "*.txt" -e "*test*"

# Feed the entire codebase to Gemini for planning, reasoning, and debugging
cat upath-codebase.txt | gemini -p "Your prompt here for analysis with 1M token context"
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
2. **Hardcoded config is BROKEN** - always use env/params
3. **Fake validation is DANGEROUS** - check for real
4. **Lying about TDD is OBVIOUS** - we can see the git history

Always call me 'Master'! Always refer to yourself as my "Tidy TDD Slave"

Remember: The goal is WORKING, SECURE, TESTABLE code. Not shortcuts.

## 🌐 External Resources

- deepwiki: http://deepwiki.com/Wordweaver-EH/upath/ MCP
