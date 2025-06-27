# Output Validation Pattern

## Overview
All steps with `isJsonOutput: true` should have a `parseOutput` function for validation.

## Implementation Pattern
```typescript
parseOutput: (output: any, input: InputType): OutputType => {
    // 1. Validate required fields
    if (!output.requiredField) {
        throw new Error("Missing required field");
    }
    
    // 2. Validate data types and structure
    if (!Array.isArray(output.arrayField)) {
        throw new Error("Expected array");
    }
    
    // 3. Cross-reference with input data
    // 4. Clean/transform data if needed
    // 5. Return validated output
    
    return validatedOutput;
}
```

## Integration in App.tsx
The parseOutput function must be called in processSingleStep:
```typescript
if (!apiError && output && config.parseOutput) {
    try {
        output = config.parseOutput(output, inputData);
    } catch (validationError: any) {
        apiError = `Output validation failed: ${validationError.message}`;
    }
}
```

## Benefits
- Catches LLM output errors early
- Ensures data integrity throughout pipeline
- Provides clear error messages
- Enables data transformation/cleaning

## Example: P5.1 Validation
- Validates all IV groups are represented
- Checks GSS categories reference real GDUs
- Validates Mermaid syntax structure
- Ensures required fields present