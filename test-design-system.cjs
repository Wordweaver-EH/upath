#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('Testing Phase 3: Design System Components\n');

let errors = 0;

// Test 1: Check if UI component directory exists
console.log('Test 1: Checking for UI component directory...');
const uiDir = path.join(__dirname, 'src/components/ui');
if (fs.existsSync(uiDir)) {
  console.log('  ✅ UI component directory exists');
} else {
  console.log('  ❌ UI component directory missing at src/components/ui/');
  errors++;
}

// Test 2: Check for required component files
console.log('\nTest 2: Checking for component files...');
const requiredComponents = ['Button.tsx', 'Input.tsx', 'index.ts'];
requiredComponents.forEach(component => {
  const componentPath = path.join(uiDir, component);
  if (fs.existsSync(componentPath)) {
    console.log(`  ✅ ${component} exists`);
  } else {
    console.log(`  ❌ ${component} missing`);
    errors++;
  }
});

// Test 3: Check Button component implementation
console.log('\nTest 3: Checking Button component implementation...');
const buttonPath = path.join(uiDir, 'Button.tsx');
if (fs.existsSync(buttonPath)) {
  const buttonContent = fs.readFileSync(buttonPath, 'utf8');
  
  const hasInterface = buttonContent.includes('export interface ButtonProps');
  const hasVariant = buttonContent.includes("variant?: 'primary' | 'secondary'");
  const hasSize = buttonContent.includes("size?: 'sm' | 'md' | 'lg'");
  const hasComponent = buttonContent.includes('export const Button');
  
  if (hasInterface && hasVariant && hasSize && hasComponent) {
    console.log('  ✅ Button component properly implemented');
  } else {
    console.log('  ❌ Button component missing required features');
    if (!hasInterface) console.log('    - Missing ButtonProps interface');
    if (!hasVariant) console.log('    - Missing variant prop');
    if (!hasSize) console.log('    - Missing size prop');
    if (!hasComponent) console.log('    - Missing Button export');
    errors++;
  }
}

// Test 4: Check style prop drilling in App.tsx
console.log('\nTest 4: Checking for style prop drilling in App.tsx...');
const appContent = fs.readFileSync(path.join(__dirname, 'App.tsx'), 'utf8');

const hasStyleDefinitions = appContent.includes('const inputBaseClasses') || 
                           appContent.includes('const primaryButtonClasses');
const passesStyleProps = appContent.includes('inputBaseClasses={inputBaseClasses}') ||
                        appContent.includes('primaryButtonClasses={primaryButtonClasses}');

if (hasStyleDefinitions && passesStyleProps) {
  console.log('  ❌ App.tsx still has style prop drilling');
  errors++;
} else if (!hasStyleDefinitions && !passesStyleProps) {
  console.log('  ✅ App.tsx has no style prop drilling');
} else {
  console.log('  ⚠️  App.tsx partially refactored');
}

// Test 5: Check if components use design system
console.log('\nTest 5: Checking component usage of design system...');
const controlsPanelContent = fs.readFileSync(path.join(__dirname, 'components/ControlsPanel.tsx'), 'utf8');

const importsButton = controlsPanelContent.includes("from '../src/components/ui'") || 
                     controlsPanelContent.includes("from '../src/components/ui/Button'");
const usesButtonComponent = controlsPanelContent.includes('<Button');
const hasOldButtonMarkup = controlsPanelContent.includes('<button');

if (importsButton && usesButtonComponent && !hasOldButtonMarkup) {
  console.log('  ✅ ControlsPanel uses Button component');
} else if (!importsButton && hasOldButtonMarkup) {
  console.log('  ❌ ControlsPanel still uses native button elements');
  errors++;
} else {
  console.log('  ⚠️  ControlsPanel partially migrated');
}

// Test 6: Check component props interfaces
console.log('\nTest 6: Checking removal of style props from components...');
const hasStylePropsInterface = controlsPanelContent.includes('inputBaseClasses:') || 
                               controlsPanelContent.includes('primaryButtonClasses:');

if (!hasStylePropsInterface) {
  console.log('  ✅ ControlsPanel has no style props in interface');
} else {
  console.log('  ❌ ControlsPanel still has style props in interface');
  errors++;
}

// Summary
console.log('\n' + '='.repeat(50));
if (errors === 0) {
  console.log('✅ PHASE 3 COMPLETE: Design system implemented');
} else {
  console.log(`❌ PHASE 3 INCOMPLETE: ${errors} issues found`);
  console.log('\nNext steps:');
  console.log('1. Create src/components/ui/ directory');
  console.log('2. Implement Button and Input components');
  console.log('3. Remove style definitions from App.tsx');
  console.log('4. Update components to use design system');
}
console.log('='.repeat(50));

process.exit(errors > 0 ? 1 : 0);