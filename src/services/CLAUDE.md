# Project Knowledge Base: CLAUDE.md

**Purpose:** This file serves as a persistent, shared knowledge base for this directory. All AI agents and human developers interacting with the code in this folder must consult and update this document.

**Guidelines for AI Agents:**
1.  **Consult First:** Before starting a task, read this file to understand the context, recent decisions, and known complexities related to this part of the codebase.
2.  **Update with Insights:** If you make a significant design decision, discover a non-obvious dependency, fix a complex bug, or gain any "hard-won" knowledge that isn't immediately clear from the code, you MUST document it here.
3.  **Be Concise:** Add clear, concise entries. Use headings, bullet points, and timestamps where appropriate. Focus on the "why" behind changes, not just the "what". Avoid trivial notes that can be inferred from reading the code itself.

This document is the collective memory of the project. Keep it accurate and up-to-date to ensure seamless collaboration and prevent repeated work.

## Services Architecture Overview

This directory contains service modules that handle core business logic and external integrations.

### Service Files:

#### PipelineOrchestrator.ts
The central orchestration service for pipeline execution. Key responsibilities:
- Manages the execution flow of all pipeline steps
- Handles iteration patterns (per-transcript, per-DU, global)
- Integrates with Gemini API for LLM processing
- Manages pause/resume functionality with checkpoints
- Coordinates between pipeline configuration and state management

Key features:
- Automatic retry logic for failed API calls
- Progress tracking and status updates
- Error handling with graceful degradation
- Support for different iteration contexts

### Related Services (in root `/services/`):

#### geminiService.ts
Handles all communication with the Gemini API:
- Manages API key validation and security
- Implements request/response formatting
- Handles rate limiting and error responses
- Supports multiple model selection
- Integrates with backend proxy for security

#### encryptionService.ts
Provides encryption/decryption for sensitive data:
- Encrypts analysis outputs for secure storage
- Uses CryptoJS for AES encryption
- Password-based encryption for file exports
- Maintains backward compatibility with older formats

### Design Patterns:
1. **Separation of Concerns**: Each service has a single, well-defined responsibility
2. **Error Boundaries**: Services handle their own errors and return meaningful messages
3. **Type Safety**: All services use TypeScript interfaces for API contracts
4. **Async/Await**: Consistent use of modern async patterns
5. **Dependency Injection**: Services receive configuration through parameters

### Integration Points:
- PipelineOrchestrator connects to pipeline stores via callbacks
- GeminiService integrates with backend proxy at `/api/analyze`
- EncryptionService is used by export/import functionality

### Known Complexities:
- PipelineOrchestrator must handle complex iteration patterns and state management
- API rate limiting requires careful request throttling
- Encryption must maintain compatibility across versions
- Error recovery in pipeline execution requires careful state management
