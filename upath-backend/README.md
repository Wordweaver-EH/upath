# µ-PATH Backend

Secure backend server for the µ-PATH microphenomenological analysis application. This server acts as a secure proxy between the frontend and Google's Gemini API, ensuring API keys are never exposed to clients while maintaining full functionality.

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and configure required variables (see [Environment Configuration](#environment-configuration))

3. **Start development server**:
   ```bash
   npm run dev
   ```

4. **Verify installation**:
   ```bash
   curl http://localhost:3001/health
   ```

## Environment Configuration

### Required Variables

Create a `.env` file in the backend root directory:

```bash
# Required: Google Gemini API Key
GEMINI_API_KEY=your_actual_gemini_api_key_here

# Optional: Server port (default: 3001)
PORT=3001

# Optional: CORS allowed origins (comma-separated)
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,https://your-production-domain.com
```

### Environment Variable Details

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | Yes | None | Google Gemini API key for AI processing |
| `PORT` | No | 3001 | Port for the server to listen on |
| `CORS_ORIGINS` | No | `http://localhost:5173,http://localhost:3000` | Comma-separated list of allowed origins for CORS |

### Getting a Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the key to your `.env` file
4. **Never commit the `.env` file to version control**

## API Endpoints

### POST /api/analyze

Secure proxy for Gemini API calls with full parameter support.

**Request Body**:
```json
{
  "prompt": "Your analysis prompt",
  "model": "gemini-2.5-flash-preview-04-17",
  "isJsonOutput": false,
  "useGrounding": false,
  "temperature": 0.0,
  "seed": 12345
}
```

**Parameters**:
- `prompt` (string, required): The text prompt to send to Gemini
- `model` (string, optional): Gemini model name (defaults to `gemini-2.5-flash-preview-04-17`)
- `isJsonOutput` (boolean, optional): Request JSON response format
- `useGrounding` (boolean, optional): Enable Google Search grounding
- `temperature` (number, optional): Response randomness (0.0-1.0)
- `seed` (number, optional): Deterministic seed for reproducible outputs

**Response**:
```json
{
  "text": "Generated response",
  "groundingSources": [],
  "estimatedInputTokens": 100,
  "estimatedOutputTokens": 200
}
```

**Error Responses**:
- `400 Bad Request`: Missing or invalid prompt parameter
- `500 Internal Server Error`: API key not configured or Gemini API error

### GET /health

Health check endpoint for monitoring and frontend validation.

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-07-08T19:30:00.000Z"
}
```

## Development Workflow

### Available Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `npm run dev` | Start development server with hot reload | Development |
| `npm run build` | Compile TypeScript to JavaScript | Pre-deployment |
| `npm run start` | Start production server | Production |
| `npm run test` | Run tests in watch mode | Development |
| `npm run test:run` | Run tests once | CI/CD |
| `npm run test:ui` | Interactive test runner | Development |

### Backend Testing Guide

The backend follows **Test-Driven Development (TDD)** principles:

1. **Write failing tests first** - All new features must have tests
2. **Make tests pass** - Implement minimum code to pass tests
3. **Refactor** - Improve code while keeping tests green

#### Testing Architecture

The backend uses a **testable server pattern** that separates app building from server starting:

```typescript
// server.ts - Exports buildApp() for testing
export async function buildApp() {
  const app = Fastify({ logger: true });
  // ... configure routes
  return app;
}

// index.ts - Starts the server
const app = await buildApp();
await app.listen({ port: PORT });
```

This pattern enables:
- **Dynamic port allocation** in tests to prevent conflicts
- **Isolated test instances** for each test suite
- **Real route testing** without mocks

#### Writing Tests

**CRITICAL**: Always test real production code, never create mock routes:

```typescript
// ✅ CORRECT - Tests real production code
import { buildApp } from '../server';

describe('My Test', () => {
  let app: FastifyInstance;
  
  beforeAll(async () => {
    const { buildApp } = await import('../server');
    app = await buildApp();
    await app.listen({ port: 0 }); // Dynamic port
  });
  
  afterAll(async () => {
    await app.close();
  });
  
  it('should test real routes', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health'
    });
    expect(response.statusCode).toBe(200);
  });
});

// ❌ WRONG - Fraudulent testing with mocks
fastify.get('/health', async () => ({ status: 'ok' })); // NEVER DO THIS
```

#### Test Coverage

- ✅ Health endpoint validation
- ✅ API parameter validation
- ✅ Error handling (missing API key, invalid parameters)
- ✅ Environment configuration
- ✅ CORS configuration
- ✅ Model parameter handling

#### Running Tests

```bash
# Development (watch mode)
npm run test

# CI/CD (run once)
npm run test:run

# Interactive UI
npm run test:ui
```

#### Testing Best Practices

1. **Import from `../server`** not `../index` to avoid port conflicts
2. **Use `app.inject()`** for testing routes without HTTP overhead
3. **Set environment variables** in `beforeAll()` and clean up in `afterAll()`
4. **Test error cases** including missing parameters and invalid inputs
5. **Verify CORS headers** for different origins
6. **Test concurrent requests** to ensure server stability

#### Common Testing Patterns

**Environment Setup**:
```typescript
beforeAll(async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.PORT = '0';
  // ... build and start app
});

afterAll(async () => {
  await app.close();
  delete process.env.GEMINI_API_KEY;
  delete process.env.PORT;
});
```

**Parameter Validation**:
```typescript
it('should reject invalid model', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/analyze',
    payload: {
      prompt: 'Test',
      model: 'invalid-model'
    }
  });
  expect(response.statusCode).toBe(400);
  expect(JSON.parse(response.body).error).toContain('Invalid model');
});
```

**CORS Testing**:
```typescript
it('should handle CORS', async () => {
  const response = await app.inject({
    method: 'OPTIONS',
    url: '/api/analyze',
    headers: {
      'origin': 'http://localhost:5173',
      'access-control-request-method': 'POST'
    }
  });
  expect(response.statusCode).toBe(204);
  expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
});
```

## Deployment

### Production Deployment (Vercel)

1. **Prepare for deployment**:
   ```bash
   npm run build
   npm run test:run
   ```

2. **Deploy to Vercel**:
   ```bash
   # Install Vercel CLI
   npm i -g vercel

   # Deploy
   vercel --prod
   ```

3. **Configure environment variables in Vercel dashboard**:
   - `GEMINI_API_KEY`: Your production API key
   - `CORS_ORIGINS`: Production frontend URLs

### Alternative Deployment Options

#### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3001
CMD ["npm", "start"]
```

#### Traditional Server

```bash
# Build for production
npm run build

# Start with PM2
pm2 start dist/index.js --name upath-backend

# Or start directly
npm run start
```

## Security Features

### Implemented Security Measures

- ✅ **API Key Protection**: Keys stored securely on server, never exposed to clients
- ✅ **CORS Configuration**: Configurable allowed origins for cross-origin requests
- ✅ **Input Validation**: All parameters validated before processing
- ✅ **Error Handling**: Secure error messages prevent information leakage
- ✅ **Environment Separation**: Different configurations for dev/staging/production

### Security Best Practices

1. **Never commit `.env` files** - API keys must stay out of version control
2. **Use HTTPS in production** - All communication should be encrypted
3. **Regularly rotate API keys** - Change keys periodically for security
4. **Monitor API usage** - Watch for unusual patterns or excessive requests
5. **Keep dependencies updated** - Regularly update npm packages

## Troubleshooting

### Common Issues

#### Backend Won't Start

**Symptom**: Server fails to start with port error
```
Error: listen EADDRINUSE: address already in use 0.0.0.0:3001
```

**Solution**:
```bash
# Find process using port 3001
lsof -i :3001

# Kill the process
kill <PID>

# Or use different port
PORT=3002 npm run dev
```

#### CORS Errors

**Symptom**: Frontend requests blocked by CORS policy
```
Access to fetch at 'http://localhost:3001/api/analyze' from origin 'http://localhost:5173' has been blocked by CORS policy
```

**Solution**:
```bash
# Check CORS_ORIGINS environment variable
echo $CORS_ORIGINS

# Add frontend URL to CORS_ORIGINS in .env
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

#### API Key Errors

**Symptom**: 500 error with "API Key not configured"

**Solution**:
1. Verify `.env` file exists in backend directory
2. Check `GEMINI_API_KEY` is set correctly
3. Restart server after changing `.env`

#### Health Check Failures

**Symptom**: Frontend reports backend unavailable

**Solution**:
```bash
# Test health endpoint directly
curl http://localhost:3001/health

# Check server logs for errors
npm run dev

# Verify network connectivity
ping localhost
```

### Debug Mode

Enable detailed logging:

```bash
# Start with debug logging
DEBUG=* npm run dev

# Or specific debug namespace
DEBUG=fastify:* npm run dev
```

### Performance Monitoring

Monitor API performance:

```bash
# Check response times
curl -w "@curl-format.txt" -s -o /dev/null http://localhost:3001/health

# Monitor server resources
top -p $(pgrep -f "node.*index.ts")
```

## Architecture Notes

### Design Decisions

1. **Fastify Framework**: Chosen for performance and TypeScript support
2. **Secure Proxy Pattern**: Prevents API key exposure while maintaining functionality
3. **Environment Configuration**: Flexible deployment across environments
4. **Health Checks**: Essential for monitoring and frontend validation
5. **Comprehensive Testing**: TDD approach ensures reliability

### Integration with Frontend

The backend is designed to be a drop-in replacement for direct Gemini API calls:

```typescript
// Frontend code remains unchanged
const result = await callGeminiAPI(
  prompt,
  isJsonOutput,
  useGrounding,
  temperature,
  seed
);
```

The `geminiService.ts` handles the backend integration transparently.

## Contributing

### Development Guidelines

1. **Follow TDD**: Write failing tests before implementing features
2. **Use TypeScript**: All code must be properly typed
3. **Document Changes**: Update README and comments for new features
4. **Test Everything**: All routes, error cases, and configurations
5. **Security First**: Never expose sensitive data or skip validation

### Code Style

- Use TypeScript strict mode
- Follow existing comment patterns
- Group related functionality
- Use descriptive variable names
- Handle all error cases

For detailed development methodology, see `/docs/MIGRATION-PLAN.md`.