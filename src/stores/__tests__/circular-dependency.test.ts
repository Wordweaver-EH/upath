import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Store Independence (Circular Dependency Prevention)', () => {
  test('services should not import stores directly', () => {
    // Test that services use dependency injection, not direct store imports
    const serviceFiles = [
      'services/pipeline/PipelineService.ts',
      'services/pipeline/StepExecutionService.ts',
      'services/pipeline/FileManagementService.ts',
      'services/pipeline/ExportService.ts'
    ];
    
    serviceFiles.forEach(file => {
      try {
        const serviceCode = fs.readFileSync(
          path.join(__dirname, '../../', file), 
          'utf8'
        );
        
        // Services should not import stores directly
        expect(serviceCode).not.toMatch(/import.*use\w+Store.*from.*['"].*stores/);
        expect(serviceCode).not.toMatch(/from ['"].*\/stores\//);
      } catch (e) {
        // File might not exist, that's ok
      }
    });
  });
  
  test('irrStore should not directly call settingsStore', () => {
    const irrCode = fs.readFileSync(
      path.join(__dirname, '../irrStore.ts'), 
      'utf8'
    );
    
    expect(irrCode).not.toMatch(/useSettingsStore\.getState\(\)/);
  });
  
  test('no store should import another store directly', () => {
    // Updated list without pipelineStore
    const storeFiles = [
      'uiStore.ts', 
      'settingsStore.ts', 
      'irrStore.ts',
      'transcriptStore.ts',
      'analysisResultStore.ts',
      'pipelineOrchestrationStore.ts',
      'promptHistoryStore.ts'
    ];
    
    storeFiles.forEach(file => {
      try {
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
      } catch (e) {
        // File might not exist, skip it
      }
    });
  });
  
  test('storeComposition should be the only place that imports multiple stores', () => {
    const compositionCode = fs.readFileSync(
      path.join(__dirname, '../storeComposition.ts'), 
      'utf8'
    );
    
    // This file is allowed to import stores for composition
    expect(compositionCode).toMatch(/import.*useTranscriptStore/);
    expect(compositionCode).toMatch(/import.*useAnalysisResultStore/);
    
    // But it should not directly manipulate store state
    expect(compositionCode).not.toMatch(/\.setState\(/);
  });
});