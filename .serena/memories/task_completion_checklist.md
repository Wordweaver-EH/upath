# Task Completion Checklist

When completing any coding task in the UPath project, follow this mandatory verification protocol:

## 1. Run Tests
```bash
# Frontend
npm run test:run

# Backend (if modified)
cd upath-backend && npm run test:run
```
- **NEVER** claim tests pass without running this command
- **ALWAYS** paste the test output as proof

## 2. Verify Implementation
- Open and read the actual files (don't assume from filenames)
- Confirm the implementation matches requirements
- Check that all TODOs are addressed

## 3. Check Configuration
- Verify environment variables are used (not hardcoded)
- Confirm dynamic values come from request/environment
- Check CORS and API keys are properly configured

## 4. Validate Error Handling
- Test validation rejects invalid inputs
- Ensure error messages don't leak sensitive info
- Verify API keys are validated properly

## 5. Review Imports
- Ensure tests import from production files
- Never test mocks instead of real code
- Check for circular dependencies

## 6. Code Quality Checks
Since there are no explicit linting/formatting commands in package.json:
- Manually verify TypeScript compilation: `npx tsc --noEmit`
- Check for TypeScript errors in the IDE
- Ensure consistent code style

## Critical Reminders
- **Tests that test mocks are FRAUD**
- **Hardcoded config is BROKEN**
- **Fake validation is DANGEROUS**
- **Always verify with actual command output**