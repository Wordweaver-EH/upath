import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Store Independence (Circular Dependency Prevention)', () => {
  test('pipelineStore should not import uiStore', () => {
    const pipelineCode = fs.readFileSync(
      path.join(__dirname, '../pipelineStore.ts'), 
      'utf8'
    );
    
    // Should not have direct imports
    expect(pipelineCode).not.toMatch(/import.*useUIStore/);
    expect(pipelineCode).not.toMatch(/from ['"]\.\/uiStore['"]/);
    
    // Should not have direct calls
    expect(pipelineCode).not.toMatch(/useUIStore\.getState\(\)/);
  });
  
  test('pipelineStore should not import settingsStore', () => {
    const pipelineCode = fs.readFileSync(
      path.join(__dirname, '../pipelineStore.ts'), 
      'utf8'
    );
    
    expect(pipelineCode).not.toMatch(/import.*useSettingsStore/);
    expect(pipelineCode).not.toMatch(/from ['"]\.\/settingsStore['"]/);
    expect(pipelineCode).not.toMatch(/useSettingsStore\.getState\(\)/);
  });
  
  test('irrStore should not directly call settingsStore', () => {
    const irrCode = fs.readFileSync(
      path.join(__dirname, '../irrStore.ts'), 
      'utf8'
    );
    
    expect(irrCode).not.toMatch(/useSettingsStore\.getState\(\)/);
  });
  
  test('no store should import another store directly', () => {
    const storeFiles = ['pipelineStore.ts', 'uiStore.ts', 'settingsStore.ts', 'irrStore.ts'];
    
    storeFiles.forEach(file => {
      const code = fs.readFileSync(
        path.join(__dirname, `../${file}`), 
        'utf8'
      );
      
      // Count store imports (should only have its own)
      const storeImports = code.match(/import.*use\w+Store.*from/g) || [];
      
      if (file !== 'index.ts') {
        // Each store should only import external dependencies, not other stores
        const internalStoreImports = storeImports.filter(imp => 
          imp.includes('./') && imp.includes('Store')
        );
        
        expect(internalStoreImports).toHaveLength(0);
      }
    });
  });
});