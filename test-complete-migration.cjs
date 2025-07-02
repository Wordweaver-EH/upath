#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('Testing Phase 4: Complete Design System Migration\n');

let errors = 0;

// Helper function to check file for native elements
function checkFileForNativeElements(filePath, fileName) {
  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];
  
  // Check for native button elements
  const buttonMatches = content.match(/<button\s/g);
  if (buttonMatches) {
    issues.push(`  - Found ${buttonMatches.length} native <button> element(s)`);
  }
  
  // Check for native input elements
  const inputMatches = content.match(/<input\s/g);
  if (inputMatches) {
    issues.push(`  - Found ${inputMatches.length} native <input> element(s)`);
  }
  
  // Check for native select elements
  const selectMatches = content.match(/<select\s/g);
  if (selectMatches) {
    issues.push(`  - Found ${selectMatches.length} native <select> element(s)`);
  }
  
  // Check for native textarea elements
  const textareaMatches = content.match(/<textarea\s/g);
  if (textareaMatches) {
    issues.push(`  - Found ${textareaMatches.length} native <textarea> element(s)`);
  }
  
  return issues;
}

// Test 1: Check all components for native elements
console.log('Test 1: Checking all components for native form elements...');
const componentsDir = path.join(__dirname, 'components');
const componentFiles = fs.readdirSync(componentsDir).filter(f => f.endsWith('.tsx'));

let hasNativeElements = false;
componentFiles.forEach(file => {
  const filePath = path.join(componentsDir, file);
  const issues = checkFileForNativeElements(filePath, file);
  
  if (issues.length > 0) {
    console.log(`\n  ❌ ${file}:`);
    issues.forEach(issue => console.log(issue));
    hasNativeElements = true;
    errors++;
  }
});

if (!hasNativeElements) {
  console.log('  ✅ No native form elements found in components');
}

// Test 2: Check App.tsx for native elements
console.log('\nTest 2: Checking App.tsx for native elements...');
const appPath = path.join(__dirname, 'App.tsx');
const appIssues = checkFileForNativeElements(appPath, 'App.tsx');

if (appIssues.length > 0) {
  console.log('  ❌ App.tsx has native elements:');
  appIssues.forEach(issue => console.log(issue));
  errors++;
} else {
  console.log('  ✅ App.tsx uses only design system components');
}

// Test 3: Check for Select component
console.log('\nTest 3: Checking for Select component...');
const selectPath = path.join(__dirname, 'src/components/ui/Select.tsx');
if (fs.existsSync(selectPath)) {
  console.log('  ✅ Select component exists');
  
  // Check implementation
  const selectContent = fs.readFileSync(selectPath, 'utf8');
  const hasInterface = selectContent.includes('export interface SelectProps');
  const hasComponent = selectContent.includes('export const Select');
  
  if (!hasInterface || !hasComponent) {
    console.log('  ❌ Select component incomplete');
    errors++;
  }
} else {
  console.log('  ❌ Select component missing');
  errors++;
}

// Test 4: Check for TextArea component
console.log('\nTest 4: Checking for TextArea component...');
const textareaPath = path.join(__dirname, 'src/components/ui/TextArea.tsx');
if (fs.existsSync(textareaPath)) {
  console.log('  ✅ TextArea component exists');
  
  // Check implementation
  const textareaContent = fs.readFileSync(textareaPath, 'utf8');
  const hasInterface = textareaContent.includes('export interface TextAreaProps');
  const hasComponent = textareaContent.includes('export const TextArea');
  
  if (!hasInterface || !hasComponent) {
    console.log('  ❌ TextArea component incomplete');
    errors++;
  }
} else {
  console.log('  ❌ TextArea component missing');
  errors++;
}

// Test 5: Check component imports
console.log('\nTest 5: Checking component imports...');
let importsCorrect = true;

componentFiles.forEach(file => {
  const filePath = path.join(componentsDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Skip UI component files themselves
  if (file === 'Button.tsx' || file === 'Input.tsx' || file === 'Select.tsx' || file === 'TextArea.tsx') {
    return;
  }
  
  // Check if file has form elements but doesn't import from UI
  const hasFormElements = content.includes('<button') || content.includes('<input') || 
                         content.includes('<select') || content.includes('<textarea');
  const importsUI = content.includes("from '../src/components/ui'") || 
                    content.includes("from './ui'");
  
  if (hasFormElements && !importsUI) {
    console.log(`  ❌ ${file} uses form elements but doesn't import UI components`);
    importsCorrect = false;
    errors++;
  }
});

if (importsCorrect) {
  console.log('  ✅ All components properly import UI components');
}

// Test 6: Check for inline styles
console.log('\nTest 6: Checking for inline style classes...');
let hasInlineStyles = false;

const stylePatterns = [
  /className="[^"]*(?:px-|py-|p-|m-|bg-|text-|border-|rounded-|shadow-)/,
  /className={`[^`]*(?:px-|py-|p-|m-|bg-|text-|border-|rounded-|shadow-)/
];

[...componentFiles, 'App.tsx'].forEach(file => {
  const filePath = file === 'App.tsx' ? appPath : path.join(componentsDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Skip UI component files
  if (file.startsWith('Button.') || file.startsWith('Input.') || 
      file.startsWith('Select.') || file.startsWith('TextArea.')) {
    return;
  }
  
  let fileHasInlineStyles = false;
  stylePatterns.forEach(pattern => {
    if (pattern.test(content)) {
      fileHasInlineStyles = true;
    }
  });
  
  if (fileHasInlineStyles) {
    console.log(`  ⚠️  ${file} may have inline Tailwind classes`);
    hasInlineStyles = true;
  }
});

if (!hasInlineStyles) {
  console.log('  ✅ No inline style classes detected');
}

// Summary
console.log('\n' + '='.repeat(50));
if (errors === 0) {
  console.log('✅ PHASE 4 COMPLETE: All components use design system');
} else {
  console.log(`❌ PHASE 4 INCOMPLETE: ${errors} issues found`);
  console.log('\nNext steps:');
  console.log('1. Create Select and TextArea components');
  console.log('2. Replace all native elements with design system components');
  console.log('3. Update imports to use UI components');
  console.log('4. Consider creating more specialized components (Modal, Card, etc.)');
}
console.log('='.repeat(50));

process.exit(errors > 0 ? 1 : 0);