# Code Style and Conventions

## TypeScript Configuration
- **Strict Mode**: Enabled for type safety
- **Target**: ES2020
- **Module System**: ESNext (frontend), CommonJS (backend)
- **Path Aliases**: `@/*` maps to root directory
- **Linting Rules**:
  - No unused locals/parameters
  - No fallthrough cases in switch
  - No unchecked side effect imports

## Code Style Guidelines

### General
- Use TypeScript for all new code
- Prefer interfaces over type aliases for object shapes
- Use enums for fixed sets of values
- Always specify return types for functions
- No hardcoded configuration values

### Naming Conventions
- **Files**: kebab-case (e.g., `pipeline-store.ts`)
- **Components**: PascalCase (e.g., `PipelineStep.tsx`)
- **Functions/Variables**: camelCase
- **Constants**: UPPER_SNAKE_CASE
- **Interfaces**: PascalCase with 'I' prefix avoided
- **Types**: PascalCase

### React/Component Guidelines
- Functional components only (no class components)
- Use React hooks for state and effects
- Props interfaces defined above component
- Destructure props in function signature

### Import Organization
1. External dependencies
2. Internal modules/components
3. Types/interfaces
4. Styles/assets

### Error Handling
- Never expose internal errors or API keys
- Provide user-friendly error messages
- Log errors for debugging (dev only)

### Testing Principles
- Follow TDD: Red → Green → Refactor
- Test real code, not mocks
- Import from production files
- Use dynamic ports for parallel testing
- Clean up environment after tests