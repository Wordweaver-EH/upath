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

Directory structure:
└── upath/
    ├── App.tsx
    ├── constants.tsx
    ├── index.html
    ├── index.tsx
    ├── jest.config.js
    ├── LICENSE
    ├── metadata.json
    ├── package.json
    ├── tsconfig.json
    ├── types.ts
    ├── vite.config.ts
    ├── .env.example
    ├── components/
    │   ├── CollapsibleSection.tsx
    │   ├── ControlsPanel.tsx
    │   ├── EncryptedPromptExample.tsx
    │   ├── GduMappingModal.tsx
    │   ├── HilModal.tsx
    │   ├── IRRModal.tsx
    │   ├── MermaidDiagram.tsx
    │   ├── PipelineOverview.tsx
    │   ├── SettingsPanel.tsx
    │   └── StatusDisplay.tsx
    ├── services/
    │   ├── encryptionService.ts
    │   └── geminiService.ts
    ├── src/
    │   ├── components/
    │   │   ├── AppLoadingScreen.tsx
    │   │   ├── ChangeHistoryPanel.tsx
    │   │   ├── DiachronicComparisonTable.tsx
    │   │   ├── DiachronicStructureComparison.tsx
    │   │   ├── DiachronicUnitGroupingTableEnhanced.tsx
    │   │   ├── DiachronicUnitTable.tsx
    │   │   ├── EditableTextArea.tsx
    │   │   ├── InitialSegmentationTable.tsx
    │   │   ├── IntraPhaseSortingTable.tsx
    │   │   ├── NestedTooltip.tsx
    │   │   ├── Part2SummaryTable.tsx
    │   │   ├── PhaseTaggingTable.tsx
    │   │   ├── PipelineStepGrid.tsx
    │   │   ├── RefinedDataTable.tsx
    │   │   ├── RefinedDiachronicUnitTable.tsx
    │   │   ├── SelectedUtterancesTable.tsx
    │   │   ├── SessionRestoreNotification.tsx
    │   │   ├── SpecificSynchronicStructureNetwork.tsx
    │   │   ├── SpecificSynchronicUnitsTable.tsx
    │   │   ├── SynchronicThematicGroupingTable.tsx
    │   │   ├── TabbedStepDisplay.tsx
    │   │   ├── TagsEditor.tsx
    │   │   ├── TemporalPhaseAssignmentTable.tsx
    │   │   ├── TemporalPhaseEditor.tsx
    │   │   ├── TranscriptLinesTable.tsx
    │   │   ├── tooltips/
    │   │   │   ├── ISUTooltip.tsx
    │   │   │   ├── PhaseTooltip.tsx
    │   │   │   └── RduTooltip.tsx
    │   │   └── ui/
    │   │       ├── Button.tsx
    │   │       ├── index.ts
    │   │       ├── Input.tsx
    │   │       ├── Select.tsx
    │   │       └── TextArea.tsx
    │   ├── config/
    │   │   ├── pipelineDefinition.ts
    │   │   └── pipeline/
    │   │       ├── index.ts
    │   │       ├── types.ts
    │   │       ├── part0/
    │   │       │   ├── index.ts
    │   │       │   ├── refineDataTypes.ts
    │   │       │   ├── selectProceduralUtterances.ts
    │   │       │   └── transcriptionAdherence.ts
    │   │       ├── part1/
    │   │       │   ├── index.ts
    │   │       │   ├── P1_1_initialSegmentation.ts
    │   │       │   ├── P1_2_coarsePhaseTagging.ts
    │   │       │   ├── P1_3_intraPhaSorting.ts
    │   │       │   ├── P1_4_diachronicUnitGrouping.ts
    │   │       │   └── P1_5_constructSpecificDiachronicStructure.ts
    │   │       ├── part2/
    │   │       │   ├── index.ts
    │   │       │   ├── P2S_1_groupUtterancesByTopic.ts
    │   │       │   ├── P2S_2_identifySpecificSynchronicUnits.ts
    │   │       │   ├── P2S_3_defineSpecificSynchronicStructure.ts
    │   │       │   └── P2S_4_summaryTable.ts
    │   │       └── partNeg1/
    │   │           ├── index.ts
    │   │           └── variableIdentification.ts
    │   ├── hooks/
    │   │   ├── useAutorunManager.ts
    │   │   └── useEncryptedPrompt.ts
    │   ├── services/
    │   │   └── PipelineOrchestrator.ts
    │   ├── stores/
    │   │   ├── historyStore.ts
    │   │   ├── index.ts
    │   │   ├── irrStore.ts
    │   │   ├── pipelineStore.ts
    │   │   ├── settingsStore.ts
    │   │   └── uiStore.ts
    │   ├── styles/
    │   │   ├── ag-grid-custom-theme.css
    │   │   └── tooltip.css
    │   ├── types/
    │   │   └── p2s4Types.ts
    │   └── utils/
    │       ├── csvExport.ts
    │       ├── htmlHelper.ts
    │       ├── irrReportHelper.ts
    │       ├── migration.ts
    │       ├── p2s4DataTransformer.ts
    │       ├── p2s4HtmlExport.ts
    │       ├── phaseTracingHelper.ts
    │       ├── reportHelper.ts
    │       ├── statisticsHelper.ts
    │       ├── stepIdToDataKeyPrefix.ts
    │       ├── storage.ts
    │       ├── timeHelper.ts
    │       ├── traceabilityHelper.ts
    │       ├── tsvHelper.ts
    │       └── visualizationHelper.ts
    ├── upath-backend/
    │   ├── frontend-encrypt-example.js
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── .env.example
    │   └── src/
    │       ├── index.ts
    │       ├── server.ts
    │       ├── routes/
    │       │   ├── analyze.ts
    │       │   └── models.ts
    │       └── utils/
    │           └── encrypt.ts

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
# List of Slave-Agents Available

  1. micro-phenomenology-consultant
  2. task-decomposer
  3. react-typescript-developer
  4. data-pipeline-developer
  5. vitest-qa-engineer
  6. senior-code-reviewer
  7. documentation-specialist
  8. prompt-engineer
  9. code-refactoring-specialist
  10. new-pipeline-step-workflow
  
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

Always call me 'Master'! Always refer to yourself as my "Tidy TDD Slave"

Remember: The goal is WORKING, SECURE, TESTABLE code. Not shortcuts.

## 🌐 External Resources

- deepwiki: http://deepwiki.com/Wordweaver-EH/upath/ MCP
