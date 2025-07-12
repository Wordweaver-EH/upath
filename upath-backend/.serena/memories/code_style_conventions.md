# Code Style & Conventions

## TypeScript Standards
- **Strict mode enabled**: All code must pass TypeScript strict checks
- **Interface-based typing**: Use interfaces for complex types, especially outputs
- **Explicit type annotations**: Required for function parameters and return types
- **No any types**: All types must be properly defined

## Node Implementation Patterns
- **Inheritance**: All analysis nodes extend `BaseNode`
- **Step IDs**: Use enum values from `StepId` for consistent identification
- **Error Handling**: Use `LLMResponseError` for LLM failures, standard Error for validation
- **State Management**: Always update `currentStep`, `lastCompletedStep`, and `lastUpdateTime`

## Naming Conventions
- **Files**: PascalCase for classes (e.g., `P7_2_ProposePairwiseCausalLinksNode.ts`)
- **Tests**: Same name with `.test.ts` suffix in `__tests__/` directory
- **Variables**: camelCase for variables, SCREAMING_SNAKE_CASE for constants
- **Methods**: camelCase with descriptive names

## Code Organization
- **Single responsibility**: Each node handles one analysis phase
- **Validation separation**: Private methods for input/output validation
- **Error recovery**: Implement `isRecoverable()` to distinguish retry-able errors
- **Console logging**: Use descriptive console logs with node prefix (e.g., `[P7_2]`)

## LLM Prompt Structure
- Clear task description with context
- Structured input data formatting
- Explicit output format requirements (JSON)
- Validation instructions and constraints