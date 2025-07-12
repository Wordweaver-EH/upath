import { describe, it, expect, vi, beforeEach } from 'vitest';
import { P9_1_SemanticGduMappingNode } from '../P9_1_SemanticGduMappingNode';
import { GraphState, ExecutionContext } from '../../types/state';
import { StepId } from '../../types/enums';
import { GenericDiachronicUnit } from '../../types/outputs';

describe('P9_1_SemanticGduMappingNode Performance', () => {
  let node: P9_1_SemanticGduMappingNode;
  let mockState: GraphState;
  let mockContext: ExecutionContext;

  // Generate large sets of GDUs for performance testing
  const generateGdus = (prefix: string, count: number): GenericDiachronicUnit[] => {
    return Array.from({ length: count }, (_, i) => ({
      gdu_id: `${prefix}_${i + 1}`,
      definition: `Definition for ${prefix} GDU ${i + 1}`,
      supporting_transcripts_count: Math.floor(Math.random() * 5) + 1,
      contributing_refined_du_ids: Array.from({ length: Math.floor(Math.random() * 3) + 1 }, (_, j) => ({
        transcript_id: `T${Math.floor(Math.random() * 10) + 1}`,
        refined_du_id: `RDU_${prefix}_${i + 1}_${j + 1}`
      }))
    }));
  };

  beforeEach(() => {
    node = new P9_1_SemanticGduMappingNode();
    
    mockContext = {
      llmClient: {
        generateContent: vi.fn()
      },
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      },
      settings: {
        temperature: 0.7
      }
    } as any;
    
    vi.clearAllMocks();
  });

  describe('Large dataset performance', () => {
    it('should handle 100 GDUs per run efficiently', async () => {
      const largeGdusA = generateGdus('GDU_A', 100);
      const largeGdusB = generateGdus('GDU_B', 100);
      
      // Mock LLM response with partial mappings
      const mockMappings = Array.from({ length: 80 }, (_, i) => ({
        run_a_gdu: `GDU_A_${i + 1}`,
        run_b_gdu: i < 60 ? `GDU_B_${i + 1}` : null,
        semantic_similarity: i < 60 ? 0.8 + Math.random() * 0.2 : 0,
        mapping_justification: i < 60 ? 'Similar concepts' : 'No match found'
      }));

      mockContext.llmClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({ gdu_mappings: mockMappings })
        }
      });

      mockState = {
        irr_inputs: {
          run_a_gdus: largeGdusA,
          run_b_gdus: largeGdusB
        },
        stepOutputs: {}
      } as any;

      const startTime = performance.now();
      const result = await node.execute(mockState, mockContext);
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Performance assertion: Should complete in reasonable time
      expect(executionTime).toBeLessThan(1000); // Less than 1 second
      
      const output = result.stepOutputs?.[StepId.P9_1_SEMANTIC_GDU_MAPPING];
      expect(output).toBeDefined();
      
      // Should include all GDUs
      const totalExpectedMappings = 100 + (100 - 60); // All A + unmapped B
      expect(output.gdu_mappings.length).toBe(totalExpectedMappings);
      
      console.log(`Execution time for 100x100 GDUs: ${executionTime.toFixed(2)}ms`);
    });

    it('should handle 1000 GDUs per run within reasonable time', async () => {
      const veryLargeGdusA = generateGdus('GDU_A', 1000);
      const veryLargeGdusB = generateGdus('GDU_B', 1000);
      
      // Mock LLM response with partial mappings
      const mockMappings = Array.from({ length: 500 }, (_, i) => ({
        run_a_gdu: `GDU_A_${i + 1}`,
        run_b_gdu: `GDU_B_${i + 1}`,
        semantic_similarity: 0.8 + Math.random() * 0.2,
        mapping_justification: 'Similar concepts'
      }));

      mockContext.llmClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({ gdu_mappings: mockMappings })
        }
      });

      mockState = {
        irr_inputs: {
          run_a_gdus: veryLargeGdusA,
          run_b_gdus: veryLargeGdusB
        },
        stepOutputs: {}
      } as any;

      const startTime = performance.now();
      const result = await node.execute(mockState, mockContext);
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Performance assertion: Should complete in reasonable time
      expect(executionTime).toBeLessThan(5000); // Less than 5 seconds
      
      const output = result.stepOutputs?.[StepId.P9_1_SEMANTIC_GDU_MAPPING];
      expect(output).toBeDefined();
      
      // Should include all unmapped GDUs
      const totalExpectedMappings = 1000 + 500; // All A + unmapped B (500)
      expect(output.gdu_mappings.length).toBe(totalExpectedMappings);
      
      console.log(`Execution time for 1000x1000 GDUs: ${executionTime.toFixed(2)}ms`);
    });

    it('should demonstrate O(n) complexity growth', async () => {
      const testSizes = [10, 50, 100, 500];
      const executionTimes: number[] = [];

      for (const size of testSizes) {
        const gdusA = generateGdus('GDU_A', size);
        const gdusB = generateGdus('GDU_B', size);
        
        // Mock LLM response with half mappings
        const mockMappings = Array.from({ length: Math.floor(size / 2) }, (_, i) => ({
          run_a_gdu: `GDU_A_${i + 1}`,
          run_b_gdu: `GDU_B_${i + 1}`,
          semantic_similarity: 0.9,
          mapping_justification: 'Match'
        }));

        mockContext.llmClient.generateContent.mockResolvedValue({
          response: {
            text: () => JSON.stringify({ gdu_mappings: mockMappings })
          }
        });

        mockState = {
          irr_inputs: {
            run_a_gdus: gdusA,
            run_b_gdus: gdusB
          },
          stepOutputs: {}
        } as any;

        const startTime = performance.now();
        await node.execute(mockState, mockContext);
        const endTime = performance.now();
        
        executionTimes.push(endTime - startTime);
      }

      // Log execution times for analysis
      console.log('\nExecution times by dataset size:');
      testSizes.forEach((size, i) => {
        console.log(`${size} GDUs: ${executionTimes[i].toFixed(2)}ms`);
      });

      // Verify reasonable growth rate (not exponential)
      // The ratio between largest and smallest should be reasonable
      const ratio = executionTimes[executionTimes.length - 1] / executionTimes[0];
      const sizeRatio = testSizes[testSizes.length - 1] / testSizes[0];
      
      // Should be roughly linear or slightly superlinear, not quadratic
      expect(ratio).toBeLessThan(sizeRatio * 2);
    });
  });

  describe('Memory efficiency', () => {
    it('should not create excessive intermediate objects', async () => {
      const largeGdusA = generateGdus('GDU_A', 500);
      const largeGdusB = generateGdus('GDU_B', 500);
      
      // Mock LLM response
      mockContext.llmClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({ 
            gdu_mappings: largeGdusA.slice(0, 250).map((gdu, i) => ({
              run_a_gdu: gdu.gdu_id,
              run_b_gdu: largeGdusB[i].gdu_id,
              semantic_similarity: 0.9,
              mapping_justification: 'Match'
            }))
          })
        }
      });

      mockState = {
        irr_inputs: {
          run_a_gdus: largeGdusA,
          run_b_gdus: largeGdusB
        },
        stepOutputs: {}
      } as any;

      // Get initial memory usage
      if (global.gc) {
        global.gc();
      }
      const initialMemory = process.memoryUsage().heapUsed;

      await node.execute(mockState, mockContext);

      // Get final memory usage
      if (global.gc) {
        global.gc();
      }
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable
      const expectedMaxIncrease = 50 * 1024 * 1024; // 50MB max
      expect(memoryIncrease).toBeLessThan(expectedMaxIncrease);
      
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });
  });
});