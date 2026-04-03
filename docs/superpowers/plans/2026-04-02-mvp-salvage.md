# MVP Salvage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Salvage `origin/modular-pipeline-config` into a deployable, secure MVP by fixing the XSS vulnerability and adding Docker Compose support for both frontend and backend services.

**Architecture:** Frontend (Vite/React) proxies all Gemini API calls through a Fastify backend that holds the API key. Three focused changes: (1) switch to the right branch, (2) sanitize Gemini output in the HTML renderer, (3) add Docker Compose with both services.

**Tech Stack:** React 19, TypeScript, Vite, Zustand, Fastify, Node 20, DOMPurify, Docker Compose

---

## File Map

| File | Action | Why |
|------|--------|-----|
| `App.tsx` | Modify | Add DOMPurify sanitization before `setHtml` |
| `package.json` | Modify | Add `dompurify` + `@types/dompurify` |
| `docker-compose.yml` | Create | Add backend service alongside existing frontend |
| `upath-backend/Dockerfile` | Create | Backend container (Node 20, runs `npm start`) |
| `upath-backend/.env.example` | Modify | Add `ENCRYPTION_KEY` field |
| `.env.example` | Create | Document frontend env vars (does not exist on modular-pipeline-config) |

---

### Task 1: Switch to modular-pipeline-config

**Files:**
- No file changes — branch setup only

- [ ] **Step 1: Check out modular-pipeline-config as a new local branch**

```bash
git fetch origin
git checkout -b modular-pipeline-config origin/modular-pipeline-config
```

Expected: `Branch 'modular-pipeline-config' set up to track 'origin/modular-pipeline-config'`

- [ ] **Step 2: Verify the branch is correct**

```bash
git log --oneline -5
```

Expected: Recent commits visible (84 ahead of main). The latest commits should reference pipeline config changes.

- [ ] **Step 3: Install frontend dependencies**

```bash
npm install
```

Expected: No errors. `node_modules` populated.

---

### Task 2: Fix XSS in ReportRenderer (App.tsx)

**Context:** `App.tsx` renders Gemini API output (markdown → HTML) using `dangerouslySetInnerHTML` without sanitization. An adversarial model response could inject arbitrary HTML/JS into the user's browser.

**Files:**
- Modify: `App.tsx` (import block at top, and `setHtml` call inside `ReportRenderer`)
- Modify: `package.json` (add dompurify deps)

- [ ] **Step 1: Install DOMPurify**

```bash
npm install dompurify
npm install --save-dev @types/dompurify
```

Expected: Both packages added to `package.json`.

- [ ] **Step 2: Verify dompurify added to package.json**

```bash
grep dompurify package.json
```

Expected: `"dompurify"` and `"@types/dompurify"` visible.

- [ ] **Step 3: Add DOMPurify import to App.tsx**

In `App.tsx`, the last import is:
```typescript
import { SessionRestoreNotification } from './src/components/SessionRestoreNotification';
```

Add the DOMPurify import directly after that line:

```typescript
import DOMPurify from 'dompurify';
```

- [ ] **Step 4: Sanitize the HTML before setting state**

In `App.tsx`, inside the `ReportRenderer` component's first `useEffect`, find the line that reads:

```typescript
    setHtml(parsed);
```

Replace it with:

```typescript
    setHtml(DOMPurify.sanitize(parsed));
```

- [ ] **Step 5: Verify the app builds without errors**

```bash
npm run build 2>&1 | tail -20
```

Expected: Build succeeds. No TypeScript errors about `dompurify`.

- [ ] **Step 6: Commit the XSS fix**

```bash
git add App.tsx package.json package-lock.json
git commit -m "fix: sanitize Gemini HTML output with DOMPurify to prevent XSS"
```

---

### Task 3: Docker Compose — both services

**Context:** The repo has a frontend `Dockerfile` at root but no `docker-compose.yml` and no backend `Dockerfile`. We need both to run the full stack in containers.

**Important note on `REACT_APP_BACKEND_URL`:** This is a Vite/React env var baked into the frontend bundle at dev-server startup time. The value is used by JavaScript running **in the browser**, not inside the Docker container. Since the backend port `3001` is mapped to the host (`ports: "3001:3001"`), the browser at `http://localhost:5173` correctly reaches it via `http://localhost:3001`. Do NOT use `http://backend:3001` — that Docker service name is only resolvable inside the Docker network, not from the host browser.

**Files:**
- Create: `upath-backend/Dockerfile`
- Create: `docker-compose.yml`

- [ ] **Step 1: Create the backend Dockerfile**

Create `upath-backend/Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
```

- [ ] **Step 2: Create docker-compose.yml**

Create `docker-compose.yml` at the repo root:

```yaml
services:
  backend:
    build:
      context: ./upath-backend
    ports:
      - "3001:3001"
    env_file:
      - ./upath-backend/.env
    environment:
      - NODE_ENV=production
      - PORT=3001

  frontend:
    build: .
    ports:
      - "5173:5173"
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - REACT_APP_BACKEND_URL=http://localhost:3001
    depends_on:
      - backend
```

Note: `CORS_ORIGINS` is not hardcoded here — it is read from `./upath-backend/.env` via `env_file`. Set it there for your environment.

- [ ] **Step 3: Verify backend TypeScript compiles**

```bash
cd upath-backend && npm install && npm run build 2>&1 | tail -20
```

Expected: TypeScript compiles to `dist/`. No fatal errors.

- [ ] **Step 4: Return to repo root and commit**

```bash
cd ..
git add docker-compose.yml upath-backend/Dockerfile
git commit -m "feat: add Docker Compose with frontend + backend services"
```

---

### Task 4: Document encryption key setup

**Context:** `encryptionService.ts` falls back to a hardcoded AES key when `REACT_APP_ENCRYPTION_KEY` is not set. The backend similarly has a weak fallback. This needs to be documented via `.env.example` files so operators know to set real keys.

**On `modular-pipeline-config`:**
- `upath-backend/.env.example` exists but does NOT contain `ENCRYPTION_KEY` → append it
- `.env.example` (frontend) does NOT exist on this branch → create it

**Files:**
- Modify: `upath-backend/.env.example` (append `ENCRYPTION_KEY` section)
- Create: `.env.example` at repo root

- [ ] **Step 1: Append ENCRYPTION_KEY to backend .env.example**

Open `upath-backend/.env.example`. Verify it does not already contain `ENCRYPTION_KEY`:

```bash
grep ENCRYPTION_KEY upath-backend/.env.example || echo "not present — safe to add"
```

Append to the end of `upath-backend/.env.example`:

```
# Encryption key for prompt encryption (must match REACT_APP_ENCRYPTION_KEY in frontend)
# Generate with: openssl rand -hex 32
ENCRYPTION_KEY=your_32_byte_hex_key_here
```

- [ ] **Step 2: Create frontend .env.example**

Create `.env.example` at repo root (this file does not exist on `modular-pipeline-config`):

```
# Backend URL (Fastify proxy that holds the Gemini API key)
REACT_APP_BACKEND_URL=http://localhost:3001

# Feature flags
REACT_APP_P3_2_APPROACH=original

# Prompt encryption (must match ENCRYPTION_KEY in upath-backend/.env)
# Generate with: openssl rand -hex 32
# Set REACT_APP_USE_ENCRYPTION=true to enable
REACT_APP_ENCRYPTION_KEY=your_32_byte_hex_key_here
REACT_APP_USE_ENCRYPTION=false
```

- [ ] **Step 3: Commit**

```bash
git add upath-backend/.env.example .env.example
git commit -m "docs: add .env.example files documenting encryption key setup"
```

---

### Task 5: Smoke test

**Context:** Verify the full stack works. This task uses `docker compose` to avoid the multi-terminal problem.

**Prerequisite:** `upath-backend/.env` must exist with a real `GEMINI_API_KEY`. If it doesn't exist:
```bash
cp upath-backend/.env.example upath-backend/.env
# Then manually edit upath-backend/.env and set GEMINI_API_KEY to your real key
```

- [ ] **Step 1: Build and start both containers**

```bash
docker compose up --build -d
```

Expected: Both `backend` and `frontend` containers start. No build errors.

- [ ] **Step 2: Verify backend health endpoint**

```bash
curl -s http://localhost:3001/health
```

Expected: JSON response with `"status"` field (e.g. `{"status":"ok"}`).

- [ ] **Step 3: Verify frontend is serving**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
```

Expected: `200`

- [ ] **Step 4: Check container logs for errors**

```bash
docker compose logs backend | tail -20
docker compose logs frontend | tail -20
```

Expected: No crash errors. Backend shows server started on port 3001.

- [ ] **Step 5: Stop containers**

```bash
docker compose down
```

- [ ] **Step 6: Tag the MVP and push**

```bash
git tag -a v0.12.0-mvp -m "MVP: XSS fixed, Docker Compose, backend proxy verified"
git push origin modular-pipeline-config --tags
```
