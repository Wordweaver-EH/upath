# Suggested Commands for UPath Development

## Frontend Commands
```bash
# Development
npm install          # Install dependencies
npm run dev         # Start dev server (port 5173)

# Testing
npm run test        # Run tests in watch mode
npm run test:run    # Run tests once (CI mode)
npm run test:ui     # Open Vitest UI

# Production
npm run build       # Build for production
npm run preview     # Preview production build
```

## Backend Commands
```bash
cd upath-backend    # Navigate to backend directory

# Development
npm install         # Install dependencies
npm run dev        # Start backend server (port 3001)

# Testing
npm run test       # Run tests in watch mode
npm run test:run   # Run tests once (CI mode)
npm run test:ui    # Open Vitest UI

# Production
npm run build      # Compile TypeScript
npm run start      # Start production server
```

## Git Commands
```bash
git status          # Check current changes
git diff           # View unstaged changes
git log --oneline -10  # View recent commits
```

## System Commands (Linux/WSL)
```bash
ls -la             # List files with details
grep -r "pattern" .  # Search in files
find . -name "*.ts"  # Find TypeScript files
```

## Environment Setup
```bash
# Frontend
cp .env.example .env  # Create .env file
# Edit .env to add REACT_APP_API_KEY

# Backend
cd upath-backend
cp ../.env.example .env  # Create backend .env
# Edit .env to add GEMINI_API_KEY
```