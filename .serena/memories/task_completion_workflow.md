# Task Completion Workflow

## Development Workflow

### When Task is Completed

1. **Test Functionality**
   ```bash
   npm run dev
   ```
   - Verify changes work in development server
   - Test affected features manually
   - Check console for errors or warnings

2. **Build Validation**
   ```bash
   npm run build
   ```
   - Ensure TypeScript compilation succeeds
   - Check for build errors or warnings
   - Verify no unused imports or variables

3. **Production Preview**
   ```bash
   npm run preview
   ```
   - Test production build locally
   - Verify all features work in production mode
   - Check for any build-specific issues

### No Automated Testing
- **Note**: This project has no automated test suite configured
- **Manual Testing Required**: All functionality must be tested manually
- **Key Test Areas**:
  - File upload functionality
  - Pipeline step execution
  - Mermaid diagram rendering
  - State save/load functionality
  - Export features (JSON, TSV, HTML, Markdown)

### Code Quality Checks

#### TypeScript Validation
- **Automatic**: TypeScript strict mode catches type errors during development
- **Build Process**: `npm run build` performs full TypeScript compilation
- **Key Areas**: Interface compliance, type safety, unused code detection

#### Manual Code Review
- **Interface Compliance**: Ensure new code matches expected TypeScript interfaces in `types.ts`
- **Component Patterns**: Follow established component patterns in `components/`
- **State Management**: Maintain centralized state patterns in `App.tsx`
- **Utility Integration**: Use existing utility functions in `utils/`

### Environment Considerations
- **API Key**: Ensure `process.env.API_KEY` is properly configured for testing
- **Browser Compatibility**: Test Mermaid diagram rendering in target browsers
- **File Handling**: Test file upload/download functionality

### Documentation Updates
- **README.md**: Update if new features or changes affect user workflow
- **CLAUDE.md**: Update if architectural changes affect development patterns
- **Code Comments**: Add comments for complex logic or non-obvious implementations

### Git Workflow
```bash
git add .
git commit -m "Descriptive commit message"
# Only push if working on shared repository
```

## Deployment Readiness Checklist
- [ ] Development server runs without errors
- [ ] Production build completes successfully
- [ ] Manual testing of affected functionality passed
- [ ] TypeScript compilation clean (no errors/warnings)
- [ ] Environment variables properly configured
- [ ] Documentation updated if necessary