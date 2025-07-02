#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Files to check
const filesToCheck = [
  'src/stores/pipelineStore.ts',
  'src/stores/uiStore.ts',
  'src/stores/index.ts',
  'App.tsx'
];

console.log('Checking for circular dependencies...\n');

// Check if pipelineStore imports uiStore
const pipelineStore = fs.readFileSync(path.join(__dirname, 'src/stores/pipelineStore.ts'), 'utf8');
const hasUIStoreImport = pipelineStore.includes("from './uiStore'") || 
                        pipelineStore.includes('from "./uiStore"') ||
                        pipelineStore.includes('useUIStore');

console.log('✓ pipelineStore.ts:');
console.log(`  - Imports uiStore: ${hasUIStoreImport ? '❌ YES (BAD)' : '✅ NO (GOOD)'}`);
console.log(`  - Uses useUIStore.getState(): ${pipelineStore.includes('useUIStore.getState()') ? '❌ YES (BAD)' : '✅ NO (GOOD)'}`);

// Check if uiStore imports pipelineStore  
const uiStore = fs.readFileSync(path.join(__dirname, 'src/stores/uiStore.ts'), 'utf8');
const hasPipelineStoreImport = uiStore.includes("from './pipelineStore'") || 
                               uiStore.includes('from "./pipelineStore"') ||
                               uiStore.includes('usePipelineStore');

console.log('\n✓ uiStore.ts:');
console.log(`  - Imports pipelineStore: ${hasPipelineStoreImport ? '❌ YES (BAD)' : '✅ NO (GOOD)'}`);
console.log(`  - Has dynamic import: ${uiStore.includes('import(') ? '❌ YES (BAD)' : '✅ NO (GOOD)'}`);

// Check App.tsx orchestration
const appTsx = fs.readFileSync(path.join(__dirname, 'App.tsx'), 'utf8');
const hasInitializeStores = appTsx.includes('initializeStores');
const hasStoreListeners = appTsx.includes('usePipelineStore.subscribe');

console.log('\n✓ App.tsx:');
console.log(`  - Calls initializeStores: ${hasInitializeStores ? '✅ YES (GOOD)' : '❌ NO (BAD)'}`);
console.log(`  - Has store listeners: ${hasStoreListeners ? '✅ YES (GOOD)' : '❌ NO (BAD)'}`);

// Summary
const hasCircularDep = hasUIStoreImport || hasPipelineStoreImport;
console.log('\n' + '='.repeat(50));
console.log(`RESULT: ${hasCircularDep ? '❌ CIRCULAR DEPENDENCY DETECTED' : '✅ NO CIRCULAR DEPENDENCIES'}`);
console.log('='.repeat(50));

process.exit(hasCircularDep ? 1 : 0);