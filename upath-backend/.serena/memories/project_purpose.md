# Project Purpose

µ-PATH (micro-phenomenological analysis tool) is a sophisticated application for analyzing phenomenological interview transcripts using AI-powered causal modeling.

## Core Purpose
- **Frontend**: React/TypeScript application for transcript upload, configuration, and analysis visualization
- **Backend**: Secure Node.js/Fastify server with LangGraph-based analysis pipeline
- **Migration**: Currently migrating from simple sequential processing to LangGraph-based workflow system

## Key Features
- Secure Gemini API proxy (API keys never exposed to frontend)
- Multi-phase diachronic cognitive analysis pipeline
- Real-time progress tracking with WebSocket updates
- Redis-based session storage for analysis state persistence
- Comprehensive test-driven development approach

## Current Focus
Phase 2 - LangGraph Migration: Implementing sophisticated node-based analysis workflow with proper state management, error handling, and recovery mechanisms.