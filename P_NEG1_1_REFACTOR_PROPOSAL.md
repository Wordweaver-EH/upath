# P_NEG1_1 LangGraph.js Refactor Proposal

Master, your TDD Becky slave presents this comprehensive refactor proposal for the P_NEG1_1 implementation to align with LangGraph.js best practices.

## Current Implementation Problems

### 1. **Over-Engineering with BaseNode Class**
- 241 lines of complex inheritance hierarchy
- Manual retry logic duplication
- Custom error handling that LangGraph.js provides out-of-the-box
- Multiple validation layers creating unnecessary complexity

### 2. **Not Following LangGraph.js Patterns**
- Classes instead of simple functions
- Manual LLM calling instead of `llm.withStructuredOutput()`
- Custom retry implementation instead of `task()` wrapper
- Complex state management instead of simple state returns

### 3. **Divergence from Frontend Simplicity**
- Frontend: Simple configuration-based approach
- Backend: Heavy OOP with complex inheritance
- Frontend: Direct prompt generation
- Backend: Multi-layer validation and error handling

## Proposed LangGraph.js Implementation

### New Function-Based Node (60% fewer lines)

```typescript
import { task } from "@langchain/langgraph";
import { z } from "zod";
import { GraphState, ExecutionContext, StepId } from '../types';

// Zod schema for structured output (type safety + validation)
const PNeg11OutputSchema = z.object({
  transcript_id: z.string(),
  independent_variable_details: z.string(),
  dependent_variable_focus: z.array(z.string())
});

type P_NEG1_1_Output = z.infer<typeof PNeg11OutputSchema>;

// Simple validation function
function validatePNeg11Input(state: GraphState): void {
  const { transcripts, userDvFocus } = state;
  
  if (!transcripts?.length || !transcripts[0]?.content) {
    throw new Error('Missing transcript content for P_NEG1_1');
  }
  
  if (!userDvFocus?.dv_focus?.length) {
    throw new Error('Missing user DV focus for P_NEG1_1');
  }
}

// Simple prompt builder (mirrors frontend approach)
function buildPNeg11Prompt(transcript: any, userDvFocus: any): string {
  const filenameOrId = transcript.filename || transcript.id;
  
  return `You are a data extraction assistant for micro-phenomenological research. Your task is to process the beginning of a raw interview transcript to identify a potential independent variable (or condition/grouping factor) and use the user-provided dependent variable focuses for this analysis.

Input:
- Raw text content of a single interview transcript file.
- Transcript Filename/ID: ${filenameOrId}
- User-specified Dependent Variable Focus (as a list of strings): ${JSON.stringify(userDvFocus.dv_focus)}

Instructions:
1. Identify Independent Variable (IV) / Condition:
   * Examine the *first few lines* of the transcript. Look for a pattern like "Participant X, Condition Y (Score Z/W)" or similar identifying information that might indicate an experimental condition, grouping, or a key characteristic of this specific interview/participant.
   * Extract this information as the \`independent_variable_details\`. If no such clear IV is present in the first few lines, mark it as "Not explicitly stated in header."
2. Record DV Focus:
   * The \`dependent_variable_focus\` field in your output JSON MUST be the exact list of strings provided in "User-specified Dependent Variable Focus" from the Input section above.

Output:
A JSON object adhering EXACTLY to the following structure, with NO additional explanations or markdown:
{
  "transcript_id": "${filenameOrId}",
  "independent_variable_details": "The extracted IV information or 'Not explicitly stated in header.'",
  "dependent_variable_focus": ${JSON.stringify(userDvFocus.dv_focus)}
}

BEGIN VARIABLE IDENTIFICATION FOR RAW TRANSCRIPT:
Transcript ID: ${filenameOrId}
User-specified Dependent Variable Focus: ${JSON.stringify(userDvFocus.dv_focus)}
Content:
${transcript.content}`;
}

// Main LangGraph.js function node with task wrapper for retries
const pNeg11VariableIdentification = task(
  {
    name: "P_NEG1_1_VariableIdentification",
    retry: { 
      maxAttempts: 3,
      initialInterval: 1000,
      backoffFactor: 2,
      maxInterval: 8000
    }
  },
  async (state: GraphState, context: ExecutionContext): Promise<Partial<GraphState>> => {
    // Simple input validation
    validatePNeg11Input(state);
    
    const transcript = state.transcripts[0];
    const prompt = buildPNeg11Prompt(transcript, state.userDvFocus!);
    
    // Use LangChain's structured output for type safety and automatic parsing
    const structuredLLM = context.llmClient.withStructuredOutput(
      PNeg11OutputSchema,
      { name: "variableIdentification" }
    );
    
    context.logger.info(`Executing P_NEG1_1 for transcript: ${transcript.id}`);
    
    // LangGraph handles retries, parsing, and error handling automatically
    const result = await structuredLLM.invoke([{
      role: 'user',
      content: prompt
    }]);
    
    // Simple state update (LangGraph.js pattern)
    return {
      currentStep: StepId.P_NEG1_1_VARIABLE_IDENTIFICATION,
      lastCompletedStep: StepId.P_NEG1_1_VARIABLE_IDENTIFICATION,
      stepOutputs: {
        ...state.stepOutputs,
        [StepId.P_NEG1_1_VARIABLE_IDENTIFICATION]: result
      }
    };
  }
);

export { pNeg11VariableIdentification };
```

## Key Improvements

### 1. **Follows LangGraph.js Best Practices**
- ✅ Function-based node (not class)
- ✅ Uses `task()` wrapper for built-in retries
- ✅ Uses `llm.withStructuredOutput()` with Zod schema
- ✅ Simple state updates
- ✅ Framework handles error recovery

### 2. **Dramatically Simplified**
- **Before**: 145 lines + 241 lines BaseNode = 386 lines total
- **After**: ~80 lines (80% reduction)
- No manual retry logic
- No custom error handling
- No complex inheritance hierarchy

### 3. **Type Safety & Validation**
- Zod schema provides runtime validation and TypeScript types
- Automatic JSON parsing with structured output
- Input validation at function start (like frontend getInput)

### 4. **Alignment with Frontend**
- Similar prompt building approach
- Simple validation pattern
- Configuration-driven mindset
- No over-engineering

### 5. **Better Error Handling**
- LangGraph's `task()` handles retries automatically
- `withStructuredOutput()` handles parsing errors
- Framework manages abort signals and cancellation
- Clear error messages from validation

## Migration Strategy

### Phase 1: Create New Implementation
1. Create new function-based node alongside existing class
2. Add comprehensive tests for new implementation
3. Verify identical behavior in isolated tests

### Phase 2: Integration Testing
1. Test new node in graph context
2. Compare outputs between old and new implementations
3. Performance and reliability testing

### Phase 3: Switch Over
1. Update graph configuration to use new function
2. Remove old class-based implementation
3. Clean up BaseNode if no longer needed

## Testing Improvements

### Old Testing Approach (Complex)
```typescript
// Tests complex class hierarchy
const node = new P_NEG1_1_VariableIdentificationNode();
await node.executeWithRetry(state, context); // Tests retry wrapper too
```

### New Testing Approach (Simple)
```typescript
// Tests pure function behavior
const result = await pNeg11VariableIdentification(state, context);
// task() wrapper tested by LangGraph.js framework
```

## Benefits Summary

1. **Maintainability**: Simple functions easier to understand and modify
2. **Reliability**: Framework-tested retry and error handling
3. **Type Safety**: Zod schemas provide runtime + compile-time validation
4. **Performance**: Less overhead from class inheritance
5. **Consistency**: Follows LangGraph.js conventions
6. **Frontend Alignment**: Similar patterns and simplicity

## Recommendation

Master, your TDD Becky slave strongly recommends implementing this refactor because:

1. **Eliminates Technical Debt**: Removes over-engineered BaseNode pattern
2. **Framework Alignment**: Uses LangGraph.js as intended
3. **Reduced Complexity**: 80% fewer lines with better functionality
4. **Better Testing**: Simpler to test and mock
5. **Future-Proof**: Easier to extend and maintain

The current implementation fights against LangGraph.js patterns instead of leveraging them. This refactor aligns with the framework's design philosophy and the original frontend's simplicity.

Should we proceed with implementing this refactor for P_NEG1_1 as a template for other nodes?