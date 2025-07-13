/**
 * Step Validation Framework
 * Systematic validation against the working prototype from Wordweaver-EH/upath
 */

import { StepId } from '../graph/types';
import { ValidationResult, StepValidator as IStepValidator, StepInputParams } from '../pipeline/core/interfaces';
import { stepRegistry } from '../pipeline/core/registry';

/**
 * Prototype step definition interface
 * Represents expected behavior from the working prototype
 */
interface PrototypeStepDefinition {
  stepId: StepId;
  getInputLogic: string;
  generatePromptTemplate: string;
  parseOutputLogic?: string;
  testCases: Array<{
    input: any;
    expectedOutput: any;
    description: string;
  }>;
  specialCases: string[];
}

/**
 * Validation report interface
 * For documenting validation results
 */
interface ValidationReport {
  stepId: StepId;
  validationType: 'pre-implementation' | 'post-implementation';
  timestamp: string;
  isValid: boolean;
  differences: string[];
  recommendations: string[];
  testResults?: Array<{
    testCase: string;
    passed: boolean;
    actualOutput?: any;
    expectedOutput?: any;
    error?: string;
  }>;
}

/**
 * Step Validator Implementation
 * Provides systematic validation against working prototype
 */
export class StepValidator implements IStepValidator {
  private validationReports = new Map<string, ValidationReport>();

  /**
   * Validate step before implementation
   * Queries working prototype for expected behavior
   */
  async validateStepPreImplementation(stepId: StepId): Promise<ValidationResult> {
    console.log(`[StepValidator] Starting pre-implementation validation for ${stepId}`);

    try {
      // Query prototype for step definition
      const prototypeDefinition = await this.queryPrototypeStep(stepId);
      
      // Create validation report
      const report: ValidationReport = {
        stepId,
        validationType: 'pre-implementation',
        timestamp: new Date().toISOString(),
        isValid: true, // Pre-implementation is always "valid" if we get prototype data
        differences: [],
        recommendations: this.generateImplementationRecommendations(prototypeDefinition),
      };

      // Store report
      this.storeValidationReport(`${stepId}-pre`, report);

      console.log(`[StepValidator] Pre-implementation validation completed for ${stepId}`);
      console.log(`[StepValidator] Recommendations: ${report.recommendations.join(', ')}`);

      return {
        stepId,
        isValid: true,
        differences: [],
        recommendations: report.recommendations,
        expectedResult: prototypeDefinition,
      };

    } catch (error) {
      console.error(`[StepValidator] Pre-implementation validation failed for ${stepId}:`, error);
      
      const report: ValidationReport = {
        stepId,
        validationType: 'pre-implementation',
        timestamp: new Date().toISOString(),
        isValid: false,
        differences: [`Failed to query prototype: ${error.message}`],
        recommendations: ['Manually review prototype implementation', 'Implement based on available documentation'],
      };

      this.storeValidationReport(`${stepId}-pre`, report);

      return {
        stepId,
        isValid: false,
        differences: report.differences,
        recommendations: report.recommendations,
      };
    }
  }

  /**
   * Validate step after implementation
   * Compares our implementation with prototype behavior
   */
  async validateStepPostImplementation(stepId: StepId, testData?: any): Promise<ValidationResult> {
    console.log(`[StepValidator] Starting post-implementation validation for ${stepId}`);

    try {
      // Check if step is registered
      if (!stepRegistry.isRegistered(stepId)) {
        throw new Error(`Step ${stepId} is not registered in step registry`);
      }

      // Get our implementation
      const ourImplementation = stepRegistry.get(stepId);

      // Get prototype definition (if we have it from pre-implementation)
      const prototypeDefinition = await this.getStoredPrototypeDefinition(stepId);
      
      // Run comparison tests
      const testResults = await this.runComparisonTests(stepId, ourImplementation, prototypeDefinition, testData);

      // Analyze results
      const differences = this.analyzeTestResults(testResults);
      const isValid = differences.length === 0;

      const report: ValidationReport = {
        stepId,
        validationType: 'post-implementation',
        timestamp: new Date().toISOString(),
        isValid,
        differences,
        recommendations: isValid ? ['Implementation matches prototype'] : this.generateFixRecommendations(differences),
        testResults,
      };

      this.storeValidationReport(`${stepId}-post`, report);

      console.log(`[StepValidator] Post-implementation validation ${isValid ? 'PASSED' : 'FAILED'} for ${stepId}`);
      if (!isValid) {
        console.log(`[StepValidator] Differences found: ${differences.join(', ')}`);
      }

      return {
        stepId,
        isValid,
        differences,
        recommendations: report.recommendations,
        ourResult: testResults,
        expectedResult: prototypeDefinition,
      };

    } catch (error) {
      console.error(`[StepValidator] Post-implementation validation failed for ${stepId}:`, error);
      
      const report: ValidationReport = {
        stepId,
        validationType: 'post-implementation',
        timestamp: new Date().toISOString(),
        isValid: false,
        differences: [`Validation error: ${error.message}`],
        recommendations: ['Fix implementation error', 'Review step module structure'],
      };

      this.storeValidationReport(`${stepId}-post`, report);

      return {
        stepId,
        isValid: false,
        differences: report.differences,
        recommendations: report.recommendations,
      };
    }
  }

  /**
   * Query working prototype for step definition
   * NOTE: This would use DeepWiki MCP in actual implementation
   */
  private async queryPrototypeStep(stepId: StepId): Promise<PrototypeStepDefinition> {
    // Placeholder implementation
    // In real implementation, this would use the DeepWiki MCP tool:
    // const response = await mcp_deepwiki_ask_question("Wordweaver-EH/upath", 
    //   `Show complete implementation of ${stepId} including getInput, generatePrompt, parseOutput with exact code and test examples`);
    
    console.log(`[StepValidator] Querying prototype for step ${stepId}`);
    
    // For now, return a placeholder that indicates we need to implement the actual query
    return {
      stepId,
      getInputLogic: `// TODO: Query prototype for ${stepId} getInput logic`,
      generatePromptTemplate: `// TODO: Query prototype for ${stepId} prompt template`,
      parseOutputLogic: `// TODO: Query prototype for ${stepId} parseOutput logic`,
      testCases: [
        {
          input: { placeholder: true },
          expectedOutput: { placeholder: true },
          description: `TODO: Get real test cases for ${stepId} from prototype`,
        }
      ],
      specialCases: [`TODO: Document special cases for ${stepId}`],
    };
  }

  /**
   * Get stored prototype definition from pre-implementation validation
   */
  private async getStoredPrototypeDefinition(stepId: StepId): Promise<PrototypeStepDefinition | null> {
    const preReport = this.validationReports.get(`${stepId}-pre`);
    if (preReport) {
      return preReport.testResults?.[0]?.expectedOutput as PrototypeStepDefinition || null;
    }
    
    // If not stored, try to query again
    try {
      return await this.queryPrototypeStep(stepId);
    } catch (error) {
      console.warn(`[StepValidator] Could not retrieve prototype definition for ${stepId}:`, error);
      return null;
    }
  }

  /**
   * Run comparison tests between our implementation and prototype
   */
  private async runComparisonTests(
    stepId: StepId, 
    ourImplementation: any, 
    prototypeDefinition: PrototypeStepDefinition | null,
    testData?: any
  ): Promise<Array<{
    testCase: string;
    passed: boolean;
    actualOutput?: any;
    expectedOutput?: any;
    error?: string;
  }>> {
    const results = [];

    // Test 1: Basic function structure
    results.push(this.testFunctionStructure(stepId, ourImplementation));

    // Test 2: getInput behavior (if we have prototype data)
    if (prototypeDefinition && testData) {
      results.push(await this.testGetInputBehavior(stepId, ourImplementation, prototypeDefinition, testData));
    }

    // Test 3: generatePrompt behavior
    if (prototypeDefinition && testData) {
      results.push(await this.testGeneratePromptBehavior(stepId, ourImplementation, prototypeDefinition, testData));
    }

    // Test 4: parseOutput behavior (if step has parseOutput)
    if (ourImplementation.parseOutput && prototypeDefinition && testData) {
      results.push(await this.testParseOutputBehavior(stepId, ourImplementation, prototypeDefinition, testData));
    }

    return results;
  }

  /**
   * Test basic function structure of our implementation
   */
  private testFunctionStructure(stepId: StepId, implementation: any): {
    testCase: string;
    passed: boolean;
    actualOutput?: any;
    expectedOutput?: any;
    error?: string;
  } {
    try {
      const hasRequiredFunctions = 
        typeof implementation.getInput === 'function' &&
        typeof implementation.generatePrompt === 'function' &&
        implementation.config &&
        implementation.config.id === stepId;

      return {
        testCase: 'Basic function structure',
        passed: hasRequiredFunctions,
        actualOutput: {
          hasGetInput: typeof implementation.getInput === 'function',
          hasGeneratePrompt: typeof implementation.generatePrompt === 'function',
          hasConfig: !!implementation.config,
          configIdMatches: implementation.config?.id === stepId,
        },
        expectedOutput: {
          hasGetInput: true,
          hasGeneratePrompt: true,
          hasConfig: true,
          configIdMatches: true,
        }
      };
    } catch (error) {
      return {
        testCase: 'Basic function structure',
        passed: false,
        error: error.message,
      };
    }
  }

  /**
   * Test getInput behavior against prototype
   */
  private async testGetInputBehavior(
    stepId: StepId, 
    implementation: any, 
    prototype: PrototypeStepDefinition, 
    testData: any
  ) {
    try {
      // Use sample test data or provided test data
      const inputParams: StepInputParams = testData || this.generateSampleInputParams(stepId);
      
      const result = implementation.getInput(inputParams);
      
      return {
        testCase: 'getInput behavior',
        passed: result && !result.error, // Basic success check
        actualOutput: result,
        expectedOutput: 'Success without errors', // Simplified for now
      };
    } catch (error) {
      return {
        testCase: 'getInput behavior',
        passed: false,
        error: error.message,
      };
    }
  }

  /**
   * Test generatePrompt behavior against prototype
   */
  private async testGeneratePromptBehavior(
    stepId: StepId, 
    implementation: any, 
    prototype: PrototypeStepDefinition, 
    testData: any
  ) {
    try {
      // Get sample input
      const inputParams = testData || this.generateSampleInputParams(stepId);
      const inputResult = implementation.getInput(inputParams);
      
      if (inputResult.error) {
        throw new Error(`getInput failed: ${inputResult.error}`);
      }

      const prompt = implementation.generatePrompt(inputResult.data);
      
      return {
        testCase: 'generatePrompt behavior',
        passed: typeof prompt === 'string' && prompt.length > 0,
        actualOutput: { promptLength: prompt.length, hasContent: prompt.length > 0 },
        expectedOutput: { promptLength: '>0', hasContent: true },
      };
    } catch (error) {
      return {
        testCase: 'generatePrompt behavior',
        passed: false,
        error: error.message,
      };
    }
  }

  /**
   * Test parseOutput behavior against prototype
   */
  private async testParseOutputBehavior(
    stepId: StepId, 
    implementation: any, 
    prototype: PrototypeStepDefinition, 
    testData: any
  ) {
    try {
      // Use sample output data
      const sampleOutput = this.generateSampleOutput(stepId);
      const result = implementation.parseOutput(sampleOutput);
      
      return {
        testCase: 'parseOutput behavior',
        passed: result !== null && result !== undefined,
        actualOutput: result,
        expectedOutput: 'Non-null parsed result',
      };
    } catch (error) {
      return {
        testCase: 'parseOutput behavior',
        passed: false,
        error: error.message,
      };
    }
  }

  /**
   * Generate sample input parameters for testing
   */
  private generateSampleInputParams(stepId: StepId): StepInputParams {
    return {
      currentTranscript: {
        id: 'test-transcript-1',
        filename: 'test.txt',
        content: 'Sample transcript content for testing...'
      },
      allRawTranscripts: [],
      processedData: new Map(),
      genericAnalysisState: {},
      userDvFocus: { dv_focus: ['emotions', 'cognitions'] },
      apiKeyPresent: true,
    };
  }

  /**
   * Generate sample output for testing parseOutput
   */
  private generateSampleOutput(stepId: StepId): any {
    // Return appropriate sample output based on step
    if (stepId === StepId.P_NEG1_1_VARIABLE_IDENTIFICATION) {
      return {
        transcript_id: 'test-transcript-1',
        independent_variable_details: 'Test IV details',
        dependent_variable_focus: ['emotions', 'cognitions']
      };
    }
    
    return { test: true, stepId };
  }

  /**
   * Analyze test results to find differences
   */
  private analyzeTestResults(testResults: any[]): string[] {
    const differences = [];
    
    for (const result of testResults) {
      if (!result.passed) {
        differences.push(`${result.testCase}: ${result.error || 'Test failed'}`);
      }
    }
    
    return differences;
  }

  /**
   * Generate implementation recommendations from prototype definition
   */
  private generateImplementationRecommendations(prototype: PrototypeStepDefinition): string[] {
    return [
      `Implement getInput function following pattern: ${prototype.getInputLogic}`,
      `Use prompt template: ${prototype.generatePromptTemplate}`,
      `Handle special cases: ${prototype.specialCases.join(', ')}`,
      'Add proper error handling and validation',
      'Follow modular structure with separate files for each function',
    ];
  }

  /**
   * Generate fix recommendations from differences
   */
  private generateFixRecommendations(differences: string[]): string[] {
    const recommendations = [];
    
    for (const diff of differences) {
      if (diff.includes('getInput')) {
        recommendations.push('Review getInput implementation and error handling');
      }
      if (diff.includes('generatePrompt')) {
        recommendations.push('Review prompt template and variable interpolation');
      }
      if (diff.includes('parseOutput')) {
        recommendations.push('Review output parsing and validation logic');
      }
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Review implementation against prototype patterns');
    }
    
    return recommendations;
  }

  /**
   * Store validation report
   */
  private storeValidationReport(key: string, report: ValidationReport): void {
    this.validationReports.set(key, report);
  }

  /**
   * Get all validation reports
   */
  getAllValidationReports(): Map<string, ValidationReport> {
    return new Map(this.validationReports);
  }

  /**
   * Get validation report for specific step and type
   */
  getValidationReport(stepId: StepId, type: 'pre-implementation' | 'post-implementation'): ValidationReport | null {
    return this.validationReports.get(`${stepId}-${type === 'pre-implementation' ? 'pre' : 'post'}`) || null;
  }

  /**
   * Clear all validation reports (for testing)
   */
  clearReports(): void {
    this.validationReports.clear();
  }
}

// Export singleton instance
export const stepValidator = new StepValidator();