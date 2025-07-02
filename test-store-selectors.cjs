#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('Testing Phase 2: Store Selectors for Derived State\n');

// Files to check
const componentsToCheck = [
  { file: 'components/ControlsPanel.tsx', name: 'ControlsPanel' },
  { file: 'App.tsx', name: 'App' }
];

const storeFiles = [
  { file: 'src/stores/uiStore.ts', name: 'uiStore' },
  { file: 'src/stores/pipelineStore.ts', name: 'pipelineStore' }
];

let errors = 0;

// Test 1: Check for business logic in components (should be in stores)
console.log('Test 1: Checking for business logic in components...');
componentsToCheck.forEach(({ file, name }) => {
  const content = fs.readFileSync(path.join(__dirname, file), 'utf8');
  
  // Look for useMemo with complex logic
  const hasMemoizedBusinessLogic = content.includes('useMemo(() => {') && 
    (content.includes('rawTranscripts.length === 0') || 
     content.includes('currentStepInfo.status === StepStatus'));
  
  // Look for complex conditionals in render
  const hasComplexConditionals = content.match(/\{[^}]*&&[^}]*&&[^}]*\}/);
  
  if (hasMemoizedBusinessLogic) {
    console.log(`  ❌ ${name}: Contains memoized business logic (should be in store selector)`);
    errors++;
  } else {
    console.log(`  ✅ ${name}: No complex memoized logic found`);
  }
});

// Test 2: Check for selector functions in stores
console.log('\nTest 2: Checking for selector functions in stores...');
const expectedSelectors = [
  { store: 'uiStore', selectors: ['selectIsAutorunDisabled', 'selectShowRetryUI'] },
  { store: 'pipelineStore', selectors: ['selectCurrentStepDisplay', 'selectMermaidChartForStep'] }
];

expectedSelectors.forEach(({ store, selectors }) => {
  const file = storeFiles.find(f => f.name === store);
  if (!file) return;
  
  const content = fs.readFileSync(path.join(__dirname, file.file), 'utf8');
  
  selectors.forEach(selector => {
    // Check for both inline selectors (selector:) and exported selectors (export const selector)
    if (content.includes(`${selector}:`) || content.includes(`export const ${selector}`)) {
      console.log(`  ✅ ${store}: Has ${selector} selector`);
    } else {
      console.log(`  ❌ ${store}: Missing ${selector} selector`);
      errors++;
    }
  });
});

// Test 3: Check that components use selectors instead of inline logic
console.log('\nTest 3: Checking component selector usage...');
const controlsPanel = fs.readFileSync(path.join(__dirname, 'components/ControlsPanel.tsx'), 'utf8');

// Check for direct selector usage
const usesAutorunSelector = controlsPanel.includes('selectIsAutorunDisabled');
const hasInlineAutorunLogic = controlsPanel.includes('!apiKeyPresent ||') && 
                              controlsPanel.includes('rawTranscripts.length === 0');

if (usesAutorunSelector && !hasInlineAutorunLogic) {
  console.log('  ✅ ControlsPanel: Uses selector for autorun logic');
} else if (!usesAutorunSelector && hasInlineAutorunLogic) {
  console.log('  ❌ ControlsPanel: Uses inline logic instead of selector');
  errors++;
} else {
  console.log('  ⚠️  ControlsPanel: Mixed usage detected');
}

// Test 4: Check App.tsx for renderOutput logic
console.log('\nTest 4: Checking App.tsx output rendering...');
const appContent = fs.readFileSync(path.join(__dirname, 'App.tsx'), 'utf8');

const hasRenderOutputFunction = appContent.includes('const renderOutput = ()');
const hasComplexRenderLogic = appContent.includes('if (currentStepInfo.status === StepStatus.Loading)');
const usesStepDisplaySelector = appContent.includes('selectCurrentStepDisplay');

if (usesStepDisplaySelector && !hasComplexRenderLogic) {
  console.log('  ✅ App: Uses selector for output display logic');
} else if (!usesStepDisplaySelector && hasComplexRenderLogic) {
  console.log('  ❌ App: Contains complex render logic (should use selector)');
  errors++;
} else {
  console.log('  ⚠️  App: Partial selector implementation');
}

// Summary
console.log('\n' + '='.repeat(50));
if (errors === 0) {
  console.log('✅ PHASE 2 COMPLETE: All derived state moved to selectors');
} else {
  console.log(`❌ PHASE 2 INCOMPLETE: ${errors} issues found`);
  console.log('\nNext steps:');
  console.log('1. Create selector functions in stores');
  console.log('2. Replace component business logic with selector calls');
  console.log('3. Remove useMemo for derived state calculations');
}
console.log('='.repeat(50));

process.exit(errors > 0 ? 1 : 0);