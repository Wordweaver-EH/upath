import { describe, it, expect, beforeEach } from 'vitest';
import { ProgressCalculator } from '../ProgressCalculator';
import { Graph } from '../../graphBuilder';
import { StepId } from '../../types/enums';

describe('ProgressCalculator', () => {
  let calculator: ProgressCalculator;
  let mockGraph: Graph;

  beforeEach(() => {
    // Create a mock graph with topological sort
    mockGraph = {
      nodes: new Map(),
      edges: new Map(),
      conditionalEdges: new Map(),
      entryPoint: StepId.P_NEG1_1_VARIABLE_IDENTIFICATION,
      hasCycles: false,
      metadata: { version: '1.0', createdAt: Date.now() },
      topologicalSort: vi.fn(),
      findPaths: vi.fn()
    } as unknown as Graph;

    calculator = new ProgressCalculator(mockGraph);
  });

  describe('calculateProgress', () => {
    it('should return 0 when topological sort returns null (cyclic graph)', () => {
      // Arrange
      vi.mocked(mockGraph.topologicalSort).mockReturnValue(null);

      // Act
      const progress = calculator.calculateProgress(StepId.P0_1_TRANSCRIPTION_ADHERENCE);

      // Assert
      expect(progress).toBe(0);
      expect(mockGraph.topologicalSort).toHaveBeenCalled();
    });

    it('should return 0 when current step is not in the graph', () => {
      // Arrange
      const sortedSteps = [
        StepId.P_NEG1_1_VARIABLE_IDENTIFICATION,
        StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        StepId.P0_2_REFINE_DATA_TYPES
      ];
      vi.mocked(mockGraph.topologicalSort).mockReturnValue(sortedSteps);

      // Act
      const progress = calculator.calculateProgress('non-existent-step');

      // Assert
      expect(progress).toBe(0);
    });

    it('should return 100 when current step is COMPLETE', () => {
      // Arrange
      const sortedSteps = [
        StepId.P_NEG1_1_VARIABLE_IDENTIFICATION,
        StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        StepId.COMPLETE
      ];
      vi.mocked(mockGraph.topologicalSort).mockReturnValue(sortedSteps);

      // Act
      const progress = calculator.calculateProgress(StepId.COMPLETE);

      // Assert
      expect(progress).toBe(100);
    });

    it('should calculate correct progress percentage for steps in the middle', () => {
      // Arrange
      const sortedSteps = [
        StepId.P_NEG1_1_VARIABLE_IDENTIFICATION,
        StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        StepId.P0_2_REFINE_DATA_TYPES,
        StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES,
        StepId.COMPLETE
      ];
      vi.mocked(mockGraph.topologicalSort).mockReturnValue(sortedSteps);

      // Act
      const progress = calculator.calculateProgress(StepId.P0_2_REFINE_DATA_TYPES);

      // Assert
      // Step is at index 2 (0-based), so it's the 3rd step out of 5
      // Progress = (3 / 5) * 100 = 60
      expect(progress).toBe(60);
    });

    it('should return correct progress for the first step', () => {
      // Arrange
      const sortedSteps = [
        StepId.P_NEG1_1_VARIABLE_IDENTIFICATION,
        StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        StepId.P0_2_REFINE_DATA_TYPES,
        StepId.COMPLETE
      ];
      vi.mocked(mockGraph.topologicalSort).mockReturnValue(sortedSteps);

      // Act
      const progress = calculator.calculateProgress(StepId.P_NEG1_1_VARIABLE_IDENTIFICATION);

      // Assert
      // First step: (1 / 4) * 100 = 25
      expect(progress).toBe(25);
    });

    it('should round progress to nearest integer', () => {
      // Arrange
      const sortedSteps = [
        StepId.P_NEG1_1_VARIABLE_IDENTIFICATION,
        StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        StepId.P0_2_REFINE_DATA_TYPES,
        StepId.COMPLETE
      ];
      vi.mocked(mockGraph.topologicalSort).mockReturnValue(sortedSteps);

      // Act
      const progress = calculator.calculateProgress(StepId.P0_1_TRANSCRIPTION_ADHERENCE);

      // Assert
      // Second step: (2 / 4) * 100 = 50
      expect(progress).toBe(50);
    });

    it('should cache topological sort result for performance', () => {
      // Arrange
      const sortedSteps = [
        StepId.P_NEG1_1_VARIABLE_IDENTIFICATION,
        StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        StepId.COMPLETE
      ];
      vi.mocked(mockGraph.topologicalSort).mockReturnValue(sortedSteps);

      // Act
      calculator.calculateProgress(StepId.P_NEG1_1_VARIABLE_IDENTIFICATION);
      calculator.calculateProgress(StepId.P0_1_TRANSCRIPTION_ADHERENCE);
      calculator.calculateProgress(StepId.P_NEG1_1_VARIABLE_IDENTIFICATION);

      // Assert
      expect(mockGraph.topologicalSort).toHaveBeenCalledTimes(1);
    });
  });

  describe('getProgressInfo', () => {
    it('should return detailed progress information', () => {
      // Arrange
      const sortedSteps = [
        StepId.P_NEG1_1_VARIABLE_IDENTIFICATION,
        StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        StepId.P0_2_REFINE_DATA_TYPES,
        StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES,
        StepId.COMPLETE
      ];
      vi.mocked(mockGraph.topologicalSort).mockReturnValue(sortedSteps);

      // Act
      const info = calculator.getProgressInfo(StepId.P0_2_REFINE_DATA_TYPES);

      // Assert
      expect(info).toEqual({
        currentStep: StepId.P0_2_REFINE_DATA_TYPES,
        currentStepIndex: 2,
        totalSteps: 5,
        percentage: 60,
        isComplete: false,
        stepsCompleted: 3,
        stepsRemaining: 2
      });
    });

    it('should handle COMPLETE step correctly', () => {
      // Arrange
      const sortedSteps = [
        StepId.P_NEG1_1_VARIABLE_IDENTIFICATION,
        StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        StepId.COMPLETE
      ];
      vi.mocked(mockGraph.topologicalSort).mockReturnValue(sortedSteps);

      // Act
      const info = calculator.getProgressInfo(StepId.COMPLETE);

      // Assert
      expect(info).toEqual({
        currentStep: StepId.COMPLETE,
        currentStepIndex: 2,
        totalSteps: 3,
        percentage: 100,
        isComplete: true,
        stepsCompleted: 3,
        stepsRemaining: 0
      });
    });

    it('should handle invalid step correctly', () => {
      // Arrange
      const sortedSteps = [
        StepId.P_NEG1_1_VARIABLE_IDENTIFICATION,
        StepId.COMPLETE
      ];
      vi.mocked(mockGraph.topologicalSort).mockReturnValue(sortedSteps);

      // Act
      const info = calculator.getProgressInfo('invalid-step');

      // Assert
      expect(info).toEqual({
        currentStep: 'invalid-step',
        currentStepIndex: -1,
        totalSteps: 2,
        percentage: 0,
        isComplete: false,
        stepsCompleted: 0,
        stepsRemaining: 2
      });
    });

    it('should handle cyclic graph correctly', () => {
      // Arrange
      vi.mocked(mockGraph.topologicalSort).mockReturnValue(null);

      // Act
      const info = calculator.getProgressInfo(StepId.P0_1_TRANSCRIPTION_ADHERENCE);

      // Assert
      expect(info).toEqual({
        currentStep: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        currentStepIndex: -1,
        totalSteps: 0,
        percentage: 0,
        isComplete: false,
        stepsCompleted: 0,
        stepsRemaining: 0
      });
    });
  });

  describe('resetCache', () => {
    it('should clear the cached topological sort', () => {
      // Arrange
      const sortedSteps = [
        StepId.P_NEG1_1_VARIABLE_IDENTIFICATION,
        StepId.COMPLETE
      ];
      vi.mocked(mockGraph.topologicalSort).mockReturnValue(sortedSteps);

      // Act
      calculator.calculateProgress(StepId.P_NEG1_1_VARIABLE_IDENTIFICATION);
      calculator.resetCache();
      calculator.calculateProgress(StepId.P_NEG1_1_VARIABLE_IDENTIFICATION);

      // Assert
      expect(mockGraph.topologicalSort).toHaveBeenCalledTimes(2);
    });
  });
});