# UPath Project Overview

## Purpose
UPath is a data analysis and visualization application that processes interview transcripts using Google's Gemini API. It implements a multi-stage pipeline for analyzing independent and dependent variables from qualitative data.

## Tech Stack
### Frontend
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite
- **State Management**: Zustand
- **UI Components**: 
  - AG-Grid for data tables
  - Headless UI for accessible components
  - Mermaid for diagrams
- **Styling**: CSS with responsive design
- **Storage**: LocalForage for persistent storage

### Backend
- **Framework**: Fastify (Node.js/TypeScript)
- **API Integration**: Google Generative AI (Gemini)
- **Dev Server**: Nodemon with tsx
- **Testing**: Vitest with supertest

## Architecture
- Frontend runs on port 5173 (Vite default)
- Backend runs on port 3001
- Follows a secure proxy pattern: Frontend → Backend → Gemini API
- API keys are never exposed to the browser

## Key Features
- Multi-step pipeline for transcript analysis
- Real-time processing with progress tracking
- Secure API key management
- Configurable AI models
- Export functionality for processed data