# Changelog

## [Unreleased] - 2025-07-03

### Bug Fixes

#### Hidden Asynchronous Dependency in IRR Store (2025-07-03)
- **FIXED: Dynamic Import Anti-Pattern** - Removed hidden dependency in `src/stores/irrStore.ts`
  - The `generateSemanticMapping` function used dynamic import: `(await import('./settingsStore')).useSettingsStore.getState()`
  - This pattern hid a critical dependency on settingsStore that wasn't visible in imports or function signature
  - Made unit testing difficult as it required mocking dynamic imports instead of simple dependency injection
  - Was the only instance of dynamic store import in the entire codebase (inconsistent pattern)
  - **Solution**: Added proper import at top of file and used standard `useSettingsStore.getState()` pattern
  - **Impact**: Improves code transparency, testability, and consistency with rest of codebase
  - Modified files: `src/stores/irrStore.ts`

#### Gemini API Method Reversion (2025-07-03)
- **FIXED: Incorrect API Method** - Reverted Gemini API call method in `services/geminiService.ts`
  - The July 2 fix incorrectly changed from `ai.models.generateContent()` to `ai.getGenerativeModel().generateContent()`
  - This caused runtime error: "ai.getGenerativeModel is not a function"
  - The @google/genai v1.5.1 package uses `ai.models.generateContent()` directly
  - **Solution**: Reverted to original pattern: `await ai.models.generateContent(params)`
  - **Impact**: Restores Gemini API functionality
  - Modified files: `services/geminiService.ts`

#### Store Encapsulation Violation in App.tsx (2025-07-03)
- **FIXED: Direct State Manipulation Anti-Pattern** - Fixed architectural violation where App.tsx was directly manipulating pipelineStore state
  - App.tsx was using `usePipelineStore.setState({ shouldStopAutorun: false })` and `setState({ lastHilContext: undefined })`
  - This bypassed store encapsulation and created tight coupling between component and store internals
  - **Solution**: Added proper `clearShouldStopAutorunFlag()` and `clearLastHilContext()` actions to pipelineStore
  - **Impact**: Maintains proper encapsulation, improves maintainability, and prevents silent failures from property name changes
  - Modified files: `src/stores/pipelineStore.ts`, `App.tsx`

#### Unguarded Deep Property Access in P4S.1.A Step (2025-07-03)
- **FIXED: Runtime Crash from Unguarded Property Access** - Fixed potential TypeError in `constants.tsx` P4S.1.A step
  - The guard clause at line 1680 was missing optional chaining on `phaseData.p2s_2_output`
  - Lines 1691-1692 accessed nested properties without optional chaining after the guard
  - This could cause runtime crashes when `phaseData`, `p2s_3_output`, or `p2s_2_output` were null/undefined
  - **Solution**: Added optional chaining to all property accesses and implemented defensive variable assignment with additional validation
  - **Impact**: Prevents pipeline crashes during cross-transcript analysis when data is missing or malformed

#### Critical Race Condition in IRR State Update (2025-07-03)
- **FIXED: Race Condition in confirmMapping** - Removed setTimeout hack that caused non-deterministic failures in IRR calculations
  - The `confirmMapping` action was using `setTimeout(..., 100)` to delay calling `calculateResults()`
  - This created a race condition where `calculateResults` could execute before state updates completed
  - Under heavy system load, this led to IRR calculations using stale or null mapping data
  - **Solution**: Modified `calculateResults` to accept optional mapping parameter and pass data directly
  - **Impact**: Eliminates silent failures and ensures IRR statistics are always calculated with correct data
- **IMPROVED: Error Handling** - Added user-facing error messages when calculateResults lacks required data
- **ADDED: Comprehensive Tests** - Created test suite to verify race condition fix and prevent regression

## [Unreleased] - 2025-07-02

### Architectural Refactoring - Zustand Migration Fixes

**Note**: This Claude completed a major architectural refactoring and identified/fixed the critical autorun bug that was preventing proper step progression.

### Changed

#### Phase 1: Circular Dependency Elimination
- Eliminated circular dependency between `pipelineStore` and `uiStore` using dependency injection pattern
- Replaced all 22 instances of `useUIStore.getState()` in pipelineStore with parameter passing
- Added `initializeStores()` function to orchestrate store synchronization via Zustand subscriptions
- Fixed runtime errors by passing required parameters from components to store functions
- Updated App.tsx to act as store orchestrator, managing cross-store communication

#### Phase 2: Store Selectors Implementation  
- Moved business logic from components to store selectors
- Added `selectCurrentStepDisplay` and `selectMermaidChartForStep` to pipelineStore
- Added `selectIsAutorunDisabled` and `selectShowRetryUI` to uiStore
- Removed `useMemo` calculations from components in favor of store selectors

#### Phase 3: Design System Creation
- Created reusable UI components: `Button`, `Input`, `Select`, `TextArea`
- Established consistent styling with encapsulated Tailwind classes
- Removed style prop drilling from App.tsx
- Migrated ControlsPanel to use new design system components

#### Phase 4: Complete Component Migration
- Migrated all modal components (GduMappingModal, HilModal, IRRModal) to use design system
- Updated SettingsPanel to use Input components instead of native elements
- Fixed theme toggle button in App.tsx to use Button component
- Removed all style prop interfaces and dependencies

### Technical Details
- Used Test-Driven Development (TDD) approach with custom test scripts
- Created test files: `test-circular-deps.cjs`, `test-store-selectors.cjs`, `test-design-system.cjs`, `test-complete-migration.cjs`
- Fixed parameter passing issues that caused runtime errors
- Addressed React hooks temporal dead zone issues

### Bug Fixes

#### Critical Autorun Restoration (2025-07-02)
- **FIXED: DV Focus Initialization** - Fixed `userDvFocus.dv_focus` array not being populated from default string on startup, preventing "Missing transcript content or DV focus" error
- **FIXED: Gemini API Parameter Order** - Corrected `callGeminiAPI` parameters being passed in wrong order, fixing temperature validation errors
- **FIXED: Store Subscription Middleware** - Added missing `subscribeWithSelector` middleware to `pipelineStore` enabling proper state synchronization with UI
- **FIXED: Invalid Enum Values** - Replaced non-existent `StepStatus.READY` with `StepStatus.Idle` in multiple locations
- **FIXED: Missing Import** - Added `P3_2_APPROACH` import to prevent ReferenceError during P3.2 step processing
- **FIXED: Undefined Function** - Replaced missing `getUIStoreSync()` function with proper `useUIStore.getState()` pattern
- **FIXED: String Interpolation** - Corrected template literal syntax in P5.1 error messages for proper variable interpolation

#### Debug Logging & Monitoring
- Added comprehensive debugging logging to track autorun decision logic
- Enhanced pipeline state synchronization logging between stores
- Added step-by-step execution tracking in `processSingleStep` function
- Improved error reporting with detailed context in validation failures

### Known Issues
- Some native form elements remain (file inputs, checkbox) which is standard practice
- Inline Tailwind classes throughout (this is expected with Tailwind CSS)

### Files Modified

#### Architectural Refactoring
- `src/stores/pipelineStore.ts` - Removed circular dependencies, added selectors
- `src/stores/uiStore.ts` - Added selectors, removed pipelineStore import  
- `src/stores/index.ts` - Added store initialization and exports
- `App.tsx` - Removed style definitions, added store orchestration
- `components/ControlsPanel.tsx` - Migrated to design system
- `components/SettingsPanel.tsx` - Migrated to design system
- `components/GduMappingModal.tsx` - Migrated to design system
- `components/HilModal.tsx` - Migrated to design system
- `components/IRRModal.tsx` - Migrated to design system
- `components/CollapsibleSection.tsx` - Migrated to use Button component
- Created: `src/components/ui/` directory with Button, Input, Select, TextArea components

#### Autorun Fixes & Code Review
- `src/stores/settingsStore.ts` - Added `parseDvFocusString` helper and proper DV focus initialization
- `src/stores/pipelineStore.ts` - Fixed API parameter order, added `subscribeWithSelector`, fixed enum values, added missing imports
- `App.tsx` - Added pipeline state subscription debugging and sync logic
- `constants.tsx` - Fixed string interpolation errors in P5.1 validation messages

#### Comprehensive Code Review & Quality Fixes (2025-07-02)
- **FIXED: Critical Google Generative AI API Call** - Corrected `ai.models.generateContent(params)` to `ai.getGenerativeModel({ model }).generateContent(params)` in `services/geminiService.ts` preventing `TypeError: ai.models.generateContent is not a function`
- **FIXED: Test Configuration Issues** - Updated `vitest.config.ts` path alias configuration to match `vite.config.ts` and `tsconfig.json`, fixing test import resolution failures
- **FIXED: Project Configuration** - Cleaned up package.json name from malformed string to "upath", added missing `baseUrl: "."` to `tsconfig.json` for consistent module resolution
- **FIXED: Environment Variable Documentation** - Corrected README.md to specify `GEMINI_API_KEY` instead of incorrect `REACT_APP_API_KEY` for Vite environment variable handling
- **VERIFIED: Test Suite Coverage** - All 154 tests now pass, covering utility functions, statistics, visualization, traceability, and critical bug fix validation

### Lessons Learned
- Initial plan incorrectly assumed callbacks were the solution for circular dependencies
- Parameter passing proved more reliable than callbacks for cross-store communication
- React hook initialization order matters - stores must be initialized before use
- Incremental testing with TDD helped catch runtime errors early