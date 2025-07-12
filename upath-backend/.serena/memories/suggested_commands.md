# Essential Development Commands

## Backend Development (from upath-backend/)
```bash
# Development server with hot reload
npm run dev

# Run all tests once (CI/CD)
npm run test:run

# Interactive test development
npm run test

# Visual test UI
npm run test:ui

# Build for production
npm run build

# Start production server
npm run start
```

## Environment Setup
```bash
# Copy and configure environment
cp .env.example .env
# Edit .env with real GEMINI_API_KEY

# Health check
curl http://localhost:3001/health
```

## Testing Workflow
```bash
# Run specific test file
npm run test -- P7_2_ProposePairwiseCausalLinksNode

# Watch mode for TDD
npm run test -- --watch

# Coverage report
npm run test:run -- --coverage
```

## Project Structure Commands
```bash
# Check git status
git status

# View recent commits
git log --oneline -10

# List graph nodes
ls src/graph/nodes/P7_*

# Find test files
find src/graph/nodes/__tests__ -name "P7_*.test.ts"
```

## System Commands (Linux)
```bash
# Process management
ps aux | grep node
kill <PID>

# Port usage
lsof -i :3001

# Directory navigation
cd upath-backend/src/graph/nodes
ls -la __tests__/
```