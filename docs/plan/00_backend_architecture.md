# Supplementary Doc: Backend Architecture

**Navigation:** [📚 Docs Home](../README.md) | [📋 Migration Plan](../MIGRATION-PLAN.md) | [📚 State Refactoring](01_state_refactoring.md) | [📚 LangGraph Migration](02_langgraph_migration.md)

This document explains the "why" and "how" of the new backend being introduced in Phase 0 of the migration.

## Why Are We Creating a Backend?

Our current application runs entirely in the user's web browser (the "client"). This has a major security flaw:

-   **API Key Exposure:** To call the Gemini API, the application needs an API key. Right now, this key is included in the frontend code. Anyone with a little technical skill can open their browser's developer tools, find this key, and use it for their own purposes, potentially costing us a lot of money.

To fix this, we are creating a **backend server**. This is a program that will run on a remote machine (like Vercel), not in the user's browser.

### The Proxy Pattern

The backend will act as a **secure proxy**:

1.  The **Frontend** (user's browser) will no longer call the Gemini API directly. Instead, it will make a simple request to our new backend.
2.  The **Backend** will receive this request. It will then securely add the secret API key (which is stored safely on the server, hidden from users) and forward the request to the real Gemini API.
3.  The **Gemini API** will send its response back to our backend.
4.  Our **Backend** will then send the response back to the user's browser.

This way, the secret API key **never** leaves our secure server environment.

## Technical Choices

-   **Fastify:** We are using Fastify as our web server framework. It is known for being very fast and having low overhead, which is perfect for a simple proxy. It's also easy to learn.
-   **TypeScript:** We are using TypeScript for the backend to match the frontend. This helps maintain consistency and catch errors early.
-   **Vercel:** We will deploy the backend on Vercel as a "Serverless Function." This means we don't have to manage a traditional server. Vercel automatically runs our code when a request comes in, which is efficient and cost-effective.
