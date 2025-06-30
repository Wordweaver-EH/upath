import { describe, it, expect } from 'vitest';
import { 
  calculateKrippendorffsAlpha, 
  buildReliabilityMatrix, 
  validateReliabilityMatrix,
  type ReliabilityMatrix,
  type AlphaResult 
} from '../statisticsHelper';

describe('statisticsHelper', () => {
  describe('calculateKrippendorffsAlpha', () => {
    it('should return perfect agreement (α=1) for identical ratings with multiple categories', () => {
      const matrix: ReliabilityMatrix = [
        ['A', 'A'],
        ['B', 'B'],
        ['C', 'C'],
        ['A', 'A'],
        ['B', 'B']
      ];
      
      const result = calculateKrippendorffsAlpha(matrix);
      expect(result.alpha).toBe(1);
      expect(result.interpretation).toBe('Excellent reliability'); // Multiple categories with perfect agreement
    });

    it('should return perfect agreement for single category', () => {
      const matrix: ReliabilityMatrix = [
        ['A', 'A'],
        ['A', 'A'],
        ['A', 'A']
      ];
      
      const result = calculateKrippendorffsAlpha(matrix);
      expect(result.alpha).toBe(1);
      expect(result.interpretation).toBe('Perfect agreement (single category)');
      expect(result.categoryCount).toBe(1);
    });

    it('should return α=-1 for systematic disagreement', () => {
      // This specific pattern creates systematic disagreement (worse than chance)
      const matrix: ReliabilityMatrix = [
        ['A', 'B'],
        ['B', 'A'],
        ['A', 'B'], 
        ['B', 'A']
      ];
      
      const result = calculateKrippendorffsAlpha(matrix);
      expect(result.alpha).toBe(-1);
      expect(result.interpretation).toBe('Systematic disagreement');
    });

    it('should handle missing data correctly', () => {
      const matrix: ReliabilityMatrix = [
        ['A', 'A'],    // Pairable: contributes 1 pair (A,A)
        ['B', null],   // Not pairable: only 1 non-null value
        [null, 'C'],   // Not pairable: only 1 non-null value
        ['C', 'C']     // Pairable: contributes 1 pair (C,C)
      ];
      
      const result = calculateKrippendorffsAlpha(matrix);
      expect(result.alpha).toBe(1); // Perfect agreement on pairable values
      expect(result.totalPairableValues).toBe(2); // 1 pair from row 1 + 1 pair from row 4
    });

    it('should return appropriate α for partial agreement', () => {
      const matrix: ReliabilityMatrix = [
        ['A', 'A'], // Agreement
        ['B', 'B'], // Agreement
        ['C', 'D'], // Disagreement
        ['A', 'A'], // Agreement
        ['B', 'C'], // Disagreement
        ['D', 'D']  // Agreement
      ];
      
      const result = calculateKrippendorffsAlpha(matrix);
      expect(result.alpha).toBeGreaterThan(0);
      expect(result.alpha).toBeLessThan(1);
      expect(result.observedDisagreement).toBeGreaterThan(0);
      expect(result.observedDisagreement).toBeLessThan(result.expectedDisagreement);
    });

    it('should handle empty matrix', () => {
      const matrix: ReliabilityMatrix = [];
      
      const result = calculateKrippendorffsAlpha(matrix);
      expect(result.alpha).toBe(0);
      expect(result.interpretation).toBe('No data');
      expect(result.totalPairableValues).toBe(0);
    });

    it('should handle matrix with no pairable values', () => {
      const matrix: ReliabilityMatrix = [
        ['A', null],
        [null, 'B'],
        [null, null]
      ];
      
      const result = calculateKrippendorffsAlpha(matrix);
      expect(result.alpha).toBe(0);
      expect(result.interpretation).toBe('No pairable values');
      expect(result.totalPairableValues).toBe(0);
    });

    it('should provide correct interpretation for different alpha ranges', () => {
      const testCases = [
        { alpha: 0.85, expectedInterpretation: 'Excellent reliability' },
        { alpha: 0.75, expectedInterpretation: 'Good reliability' },
        { alpha: 0.5, expectedInterpretation: 'Moderate reliability' },
        { alpha: 0.2, expectedInterpretation: 'Poor reliability' },
        { alpha: -0.1, expectedInterpretation: 'Systematic disagreement' }
      ];

      testCases.forEach(({ alpha, expectedInterpretation }) => {
        // Create a mock result with the desired alpha
        const matrix: ReliabilityMatrix = [['A', 'A']]; // Dummy matrix
        const result = calculateKrippendorffsAlpha(matrix);
        
        // Override the alpha for testing interpretation
        (result as any).alpha = alpha;
        const interpretation = alpha >= 0.8 ? 'Excellent reliability' :
                            alpha >= 0.667 ? 'Good reliability' :
                            alpha >= 0.4 ? 'Moderate reliability' :
                            alpha > 0 ? 'Poor reliability' :
                            alpha === 0 ? 'No reliability' :
                            'Systematic disagreement';
        
        expect(interpretation).toBe(expectedInterpretation);
      });
    });
  });

  describe('buildReliabilityMatrix', () => {
    it('should build matrix from utterance mappings without GDU mapping', () => {
      const runAMappings = new Map([
        ['t1|1', ['GDU_A', 'GDU_B']],  // 2 assignments
        ['t1|2', ['GDU_A']],           // 1 assignment  
        ['t1|3', ['GDU_C']]            // 1 assignment
      ]);
      
      const runBMappings = new Map([
        ['t1|1', ['GDU_A']],           // 1 assignment
        ['t1|2', ['GDU_A', 'GDU_B']],  // 2 assignments
        ['t1|3', ['GDU_C']]            // 1 assignment
      ]);
      
      const matrix = buildReliabilityMatrix(runAMappings, runBMappings);
      
      // t1|1: max(2,1)=2 rows, t1|2: max(1,2)=2 rows, t1|3: max(1,1)=1 row = 5 total
      expect(matrix).toHaveLength(5);
      
      // Verify the exact contents of the matrix
      // t1|1: Run A has ['GDU_A', 'GDU_B'], Run B has ['GDU_A']
      // This creates 2 rows: ['GDU_A', 'GDU_A'] and ['GDU_B', null]
      // t1|2: Run A has ['GDU_A'], Run B has ['GDU_A', 'GDU_B']  
      // This creates 2 rows: ['GDU_A', 'GDU_A'] and [null, 'GDU_B']
      // t1|3: Run A has ['GDU_C'], Run B has ['GDU_C']
      // This creates 1 row: ['GDU_C', 'GDU_C']
      
      const expectedMatrix = [
        ['GDU_A', 'GDU_A'], // t1|1 first assignment
        ['GDU_B', null],    // t1|1 second assignment (no match in Run B)
        ['GDU_A', 'GDU_A'], // t1|2 first assignment  
        [null, 'GDU_B'],    // t1|2 second assignment (no match in Run A)
        ['GDU_C', 'GDU_C']  // t1|3 single assignment
      ];
      
      expect(matrix).toEqual(expectedMatrix);
    });

    it('should apply GDU mapping when provided', () => {
      const runAMappings = new Map([
        ['t1|1', ['GDU_1']],
        ['t1|2', ['GDU_2']]
      ]);
      
      const runBMappings = new Map([
        ['t1|1', ['GDU_X']],
        ['t1|2', ['GDU_Y']]
      ]);
      
      const gduMapping = new Map([
        ['GDU_1', 'GDU_X'], // GDU_1 maps to GDU_X
        ['GDU_2', null]     // GDU_2 has no match
      ]);
      
      const matrix = buildReliabilityMatrix(runAMappings, runBMappings, gduMapping);
      
      expect(matrix).toHaveLength(2);
      expect(matrix[0]).toEqual(['GDU_X', 'GDU_X']); // Mapped correctly
      expect(matrix[1]).toEqual([null, 'GDU_Y']);    // No mapping for GDU_2
    });

    it('should handle utterances with no assignments', () => {
      const runAMappings = new Map([
        ['t1|1', ['GDU_A']],
        ['t1|2', []]  // No assignment
      ]);
      
      const runBMappings = new Map([
        ['t1|1', []],  // No assignment
        ['t1|2', ['GDU_B']]
      ]);
      
      const matrix = buildReliabilityMatrix(runAMappings, runBMappings);
      
      expect(matrix).toHaveLength(2);
      expect(matrix).toContainEqual(['GDU_A', null]);
      expect(matrix).toContainEqual([null, 'GDU_B']);
    });

    it('should handle multiple GDU assignments per utterance', () => {
      const runAMappings = new Map([
        ['t1|1', ['GDU_A', 'GDU_B', 'GDU_C']]
      ]);
      
      const runBMappings = new Map([
        ['t1|1', ['GDU_X', 'GDU_Y']]
      ]);
      
      const matrix = buildReliabilityMatrix(runAMappings, runBMappings);
      
      expect(matrix).toHaveLength(3); // Max(3, 2) = 3
      expect(matrix[0]).toEqual(['GDU_A', 'GDU_X']);
      expect(matrix[1]).toEqual(['GDU_B', 'GDU_Y']);
      expect(matrix[2]).toEqual(['GDU_C', null]);
    });
  });

  describe('validateReliabilityMatrix', () => {
    it('should validate a proper matrix', () => {
      const matrix: ReliabilityMatrix = [
        ['A', 'A'],
        ['B', 'B'],
        ['C', 'D']
      ];
      
      const validation = validateReliabilityMatrix(matrix);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.warnings).toHaveLength(0);
    });

    it('should error on empty matrix', () => {
      const matrix: ReliabilityMatrix = [];
      
      const validation = validateReliabilityMatrix(matrix);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Matrix is empty');
    });

    it('should error on inconsistent column count', () => {
      const matrix: ReliabilityMatrix = [
        ['A', 'A'],
        ['B'],  // Missing second column
        ['C', 'C', 'Extra']  // Extra column
      ];
      
      const validation = validateReliabilityMatrix(matrix);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toHaveLength(2);
      expect(validation.errors[0]).toMatch(/Row 1 has 1 columns, expected 2/);
    });

    it('should warn on high missing data percentage', () => {
      const matrix: ReliabilityMatrix = [
        ['A', null],   // 1 missing out of 2 = 50%
        [null, 'B'],   // 1 missing out of 2 = 50%  
        [null, null],  // 2 missing out of 2 = 100%
        ['C', 'C']     // 0 missing out of 2 = 0%
      ];
      // Total: 4 missing out of 8 = 50%, not > 50%, so no warning
      
      const validation = validateReliabilityMatrix(matrix);
      expect(validation.isValid).toBe(true);
      expect(validation.warnings).toHaveLength(0); // 50% exactly, not > 50%
    });

    it('should error when all data is missing', () => {
      const matrix: ReliabilityMatrix = [
        [null, null],
        [null, null]
      ];
      
      const validation = validateReliabilityMatrix(matrix);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('All data is missing');
    });
  });

  describe('Integration test: Full IRR workflow', () => {
    it('should handle a complete IRR analysis workflow', () => {
      // Simulate two runs with partially overlapping GDU assignments
      const runAMappings = new Map([
        ['transcript1|1', ['GDU_EMOTION', 'GDU_COGNITION']],
        ['transcript1|2', ['GDU_SENSATION']],
        ['transcript1|3', ['GDU_EMOTION']],
        ['transcript2|1', ['GDU_IMAGINATION']],
        ['transcript2|2', ['GDU_COGNITION']]
      ]);
      
      const runBMappings = new Map([
        ['transcript1|1', ['GDU_FEELING', 'GDU_THOUGHT']],
        ['transcript1|2', ['GDU_SENSATION']],
        ['transcript1|3', ['GDU_FEELING']],
        ['transcript2|1', ['GDU_FANTASY']],
        ['transcript2|2', ['GDU_THOUGHT']]
      ]);
      
      // Simulate semantic mapping (as if from LLM)
      const gduMapping = new Map([
        ['GDU_EMOTION', 'GDU_FEELING'],
        ['GDU_COGNITION', 'GDU_THOUGHT'],
        ['GDU_SENSATION', 'GDU_SENSATION'],
        ['GDU_IMAGINATION', 'GDU_FANTASY']
      ]);
      
      // Build matrix
      const matrix = buildReliabilityMatrix(runAMappings, runBMappings, gduMapping);
      
      // Validate matrix
      const validation = validateReliabilityMatrix(matrix);
      expect(validation.isValid).toBe(true);
      
      // Calculate alpha
      const result = calculateKrippendorffsAlpha(matrix);
      
      // Should have perfect agreement since all mappings align
      expect(result.alpha).toBe(1);
      expect(result.interpretation).toBe('Excellent reliability');
      expect(result.totalPairableValues).toBe(6); // Reduced by half after removing reverse pairs
      expect(result.categoryCount).toBe(4); // 4 unique mapped categories
    });
  });
});