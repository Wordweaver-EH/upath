# µ-PATH Codebase Architectural Analysis

## Executive Summary

This analysis identifies critical architectural issues in the µ-PATH micro-phenomenological analysis application that pose significant risks to security, maintainability, and scalability. While the codebase demonstrates sophisticated domain modeling and a comprehensive data processing pipeline, it suffers from several systemic problems that require immediate attention.

## Critical Security Vulnerabilities

### 🔴 CRITICAL: Client-Side API Key Exposure
**Location:** `services/geminiService.ts:7`
**Issue:** The Google Gemini API key is exposed in client-side code, making it accessible to anyone who inspects the application.
**Risk:** API key theft, unauthorized usage, financial liability
**Fix:** Move all API calls to a secure backend service and remove API keys from client code.

### 🔴 CRITICAL: XSS Vulnerability in Report Rendering
**Location:** `App.tsx:109` (ReportRenderer component)
**Issue:** User content from Gemini API is rendered as HTML without sanitization using `dangerouslySetInnerHTML`
**Risk:** Cross-site scripting attacks, data theft, session hijacking
**Fix:** Implement HTML sanitization using DOMPurify before rendering.

### 🟠 HIGH: State File Upload XSS Vector
**Location:** `src/stores/pipelineStore.ts:1631`
**Issue:** User-uploaded state files can contain malicious HTML that gets rendered without sanitization
**Risk:** XSS through crafted state files
**Fix:** Sanitize state data during file import process.

## Major Architectural Problems

### 1. Monolithic "God Store" Pattern
**Primary Issues:**
- `pipelineStore.ts` (2,085 lines) contains business logic, API calls, state management, and data transformations
- `processSingleStep` function spans 280+ lines with deeply nested logic
- Violates Single Responsibility Principle
- Makes testing and maintenance extremely difficult

**Impact:** High development friction, poor testability, increased bug risk

**Recommendation:** Extract business logic into dedicated service layer

### 2. Tight Inter-Store Coupling
**Issues:**
- Stores directly access other stores via `getState()` calls
- Manual dependency injection in `initializeStores()`
- Imperative state synchronization in `App.tsx` using `useEffect`
- Circular dependency detected between pipeline and UI stores

**Impact:** Fragile data flow, difficult debugging, reduced modularity

**Recommendation:** Implement unidirectional data flow and eliminate cross-store dependencies

### 3. Massive Constants File
**Issue:** `constants.tsx` contains 2,834 lines of mixed configuration, business logic, and type definitions

**Impact:** Poor discoverability, merge conflicts, hard to navigate

**Recommendation:** Break down by feature/domain and co-locate with relevant code

## Code Organization Issues

### 4. Monolithic Type Definitions
**Issue:** All types (818 lines) are in a single `types.ts` file
**Impact:** Poor discoverability, coupling between unrelated features
**Recommendation:** Co-locate types with features that use them

### 5. Utility Module Problems
**Issues in `src/utils/`:**
- `htmlHelper.ts` (1,136 lines) mixes data calculations with HTML generation
- Duplicated sorting logic across test files
- Complex data transformation functions with nested loops
- HTML generation via unsafe string concatenation

**Impact:** Security risks, maintenance burden, code duplication

### 6. Performance Issues
**Identified Problems:**
- Unbounded state growth in `pipelineStore`
- Inefficient store subscriptions causing excessive re-renders
- Large state objects persisted to localStorage (5-10MB limit)
- No virtualization for large data lists

**Impact:** Memory leaks, browser crashes, poor user experience

## Component Architecture Issues

### 7. App.tsx Complexity
**Issues:**
- 391 lines with multiple responsibilities
- Manual state synchronization between stores
- Embedded ReportRenderer component (should be extracted)
- Multiple `useEffect` hooks for cross-store communication

**Recommendation:** Extract components, simplify state flow

### 8. Modal Components Coupling
**Issues:**
- Large modal components (300+ lines each)
- Tight coupling to specific store implementations
- Mixed UI and business logic

**Recommendation:** Separate UI components from business logic

## File Size Analysis

### Largest Files (Lines of Code):
1. `constants.tsx` - 2,834 lines ⚠️
2. `src/stores/pipelineStore.ts` - 2,085 lines ⚠️
3. `src/utils/htmlHelper.ts` - 1,136 lines ⚠️
4. `types.ts` - 818 lines ⚠️
5. `src/utils/statisticsHelper.ts` - 490 lines
6. `src/stores/irrStore.ts` - 487 lines
7. `App.tsx` - 391 lines ⚠️

Files marked with ⚠️ require immediate refactoring.

## Dependency Analysis

### Circular Dependencies Detected:
- `pipelineStore.ts` ↔ `uiStore.ts`
- Manual dependency injection required to break cycles

### High Coupling Areas:
- All stores depend on `constants.tsx`
- `reportHelper.ts` incorrectly depends on `htmlHelper.ts` for calculations
- Components tightly coupled to specific store implementations

## Recommended Action Plan

### Phase 1: Critical Security Fixes (Immediate)
1. **Move API calls to backend** - Prevent API key exposure
2. **Implement HTML sanitization** - Prevent XSS attacks
3. **Sanitize state file uploads** - Prevent malicious state injection

### Phase 2: Core Architectural Refactoring (High Priority)
1. **Extract pipeline service layer** - Move business logic out of stores
2. **Break down constants.tsx** - Split by feature/domain
3. **Eliminate store coupling** - Implement unidirectional data flow
4. **Create analysisHelper.ts** - Separate calculations from presentation

### Phase 3: Code Organization (Medium Priority)
1. **Co-locate types** - Move types closer to their usage
2. **Refactor utility modules** - Break down monolithic helpers
3. **Extract App.tsx components** - Reduce component complexity
4. **Implement virtualization** - Handle large data sets efficiently

### Phase 4: Performance Optimization (Ongoing)
1. **Optimize store subscriptions** - Reduce unnecessary re-renders
2. **Implement state size management** - Prevent memory issues
3. **Add error boundaries** - Improve resilience
4. **Component memoization** - Optimize rendering performance

## Quick Wins (Can be implemented immediately)

1. **Extract ReportRenderer** from App.tsx
2. **Centralize sorting functions** in dedicated utility
3. **Consolidate test files** with their corresponding modules
4. **Implement DOMPurify sanitization** in ReportRenderer
5. **Add state size warnings** before localStorage operations

## Positive Aspects to Preserve

- Comprehensive TypeScript type coverage
- Robust error handling in API calls with retry logic
- Sophisticated data processing pipeline
- Good separation of UI components
- Effective use of Zustand for state management
- Comprehensive test coverage for critical functions

## Technical Debt Score

**Overall Assessment: HIGH RISK**
- Security: Critical vulnerabilities requiring immediate attention
- Maintainability: Poor due to monolithic components and tight coupling
- Scalability: Limited by current architectural constraints
- Performance: Moderate issues with potential for degradation

**Recommended Timeline:**
- Security fixes: Within 1 week
- Core refactoring: 2-4 weeks
- Full architectural improvements: 2-3 months

This analysis should guide prioritization of development efforts to address the most critical issues first while building toward a more maintainable and scalable architecture.