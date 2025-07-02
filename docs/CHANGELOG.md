# Changelog

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
- **FIXED: Autorun functionality** - Corrected critical bug where `lastStepInfo` was incorrectly set to `StepId.P_NEG1_1_VARIABLE_IDENTIFICATION` with `StepStatus.READY` instead of the actual step with proper Success/Error status
- Added comprehensive debugging logging to track autorun decision logic
- Fixed `handleSuccessfulStep` and `handleStepError` to properly set step status for autorun continuation

### Known Issues
- Some native form elements remain (file inputs, checkbox) which is standard practice
- Inline Tailwind classes throughout (this is expected with Tailwind CSS)

### Files Modified
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

### Lessons Learned
- Initial plan incorrectly assumed callbacks were the solution for circular dependencies
- Parameter passing proved more reliable than callbacks for cross-store communication
- React hook initialization order matters - stores must be initialized before use
- Incremental testing with TDD helped catch runtime errors early