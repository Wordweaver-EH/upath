# Essential Commands for µ-PATH Development

## Primary Development Commands

### Development Server
```bash
npm run dev
```
- Starts Vite development server
- Hot reload enabled for rapid development
- Default runs on localhost (port varies)

### Building
```bash
npm run build
```
- Creates production build using Vite
- Outputs to `dist/` directory
- TypeScript compilation and bundling

### Preview Production Build
```bash
npm run preview
```
- Serves production build locally for testing
- Useful for verifying build before deployment

## Environment Setup

### Required Environment Variable
```bash
export API_KEY="your_google_gemini_api_key"
```
- **CRITICAL**: Application will not function without this
- Must be Google Gemini API key
- Set before running any commands

## Package Management
```bash
npm install           # Install dependencies
npm ci               # Clean install from package-lock.json
```

## Development Workflow Commands
```bash
# Start development
export API_KEY="your_key" && npm run dev

# Build and test
npm run build && npm run preview

# Full development cycle
npm install && export API_KEY="your_key" && npm run dev
```

## System Commands (Linux)
```bash
ls -la               # List files with details
find . -name "*.ts*" # Find TypeScript files
grep -r "pattern"    # Search in files
git status           # Check git status
git log --oneline    # View commit history
```

## Notes
- No linting, testing, or formatting scripts are configured in package.json
- TypeScript compilation is handled by Vite during build
- Development relies heavily on real-time feedback via dev server