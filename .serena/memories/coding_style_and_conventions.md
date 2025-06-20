# Coding Style & Conventions

## TypeScript Style

### Interface Conventions
- **Export Interfaces**: All interfaces are exported for reusability
- **PascalCase Naming**: Interface names use PascalCase (e.g., `RawTranscript`, `StepConfig`)
- **Descriptive Names**: Interface names clearly describe their purpose
- **Property Naming**: Use snake_case for data properties, camelCase for component props

### Type Definitions
```typescript
// Example from types.ts
export interface RawTranscript {
  id: string;
  filename: string;
  content: string;
}
```

### Enums
- Use numeric enums for step statuses and IDs
- Clear, descriptive enum member names
- Export enums for global use

## Component Conventions

### Component Structure
- **Default Exports**: All components use default exports
- **Props Interfaces**: Each component has a dedicated Props interface
- **Functional Components**: Use function declarations, not arrow functions for components
- **Hooks**: Extensive use of React hooks (useState, useEffect, useCallback, useRef)

### Event Handlers
- Prefix with `handle` (e.g., `handleFileUpload`, `handleNextStep`)
- Use inline arrow functions for simple handlers
- Extract complex handlers to separate functions

### CSS Classes
- **Tailwind CSS**: Utility-first approach throughout
- **Dynamic Classes**: Conditional classes using template literals
- **Reusable Class Variables**: Common class combinations stored in variables

## File Organization

### Import Order
1. React and React-related imports
2. External library imports
3. Internal type imports
4. Internal component/utility imports
5. Relative imports

### File Naming
- **Components**: PascalCase (e.g., `CollapsibleSection.tsx`)
- **Utilities**: camelCase (e.g., `tsvHelper.ts`, `visualizationHelper.ts`)
- **Services**: camelCase with suffix (e.g., `geminiService.ts`)

## Constants and Configuration

### Constants File (constants.tsx)
- **Icon Components**: SVG icons as React components
- **Configuration Objects**: Step configurations, pipeline orders
- **Static Values**: Model names, API endpoints

### Naming Patterns
- **Constants**: SCREAMING_SNAKE_CASE for static values
- **Icons**: PascalCase with "Icon" suffix (e.g., `PlayIcon`, `PauseIcon`)
- **Configs**: PascalCase for objects (e.g., `STEP_CONFIGS`)

## Code Quality

### TypeScript Strictness
- Strict mode enabled
- No unused locals or parameters allowed
- No fallthrough cases in switches
- No unchecked side effect imports

### Error Handling
- JSON parsing with self-correction mechanisms
- Comprehensive error states in UI
- Graceful degradation for API failures

## Comments and Documentation
- Minimal inline comments (code should be self-documenting)
- JSDoc-style comments for complex utility functions
- README.md provides comprehensive documentation
- CLAUDE.md for development guidance