# µ-PATH Project Overview

## Purpose
µ-PATH (Micro-Phenomenological Analytic Threader) is a web application that automates the analysis of micro-phenomenological interview transcripts using AI-powered prompt chaining with Google's Gemini API.

## Key Features
- **Multi-step Analysis Pipeline**: 9-part sequential analysis (Variable ID → Data Prep → Specific Diachronic → Specific Synchronic → Generic Diachronic → Generic Synchronic → Refinement → Causal Modeling → Report)
- **Human-in-the-Loop Correction**: Users can provide guidance to correct AI outputs and re-run steps
- **State Management**: Complete save/load functionality for application state
- **Mermaid.js Visualizations**: Interactive diagrams for diachronic (Gantt), synchronic (flowcharts), and causal (DAG) structures
- **Multiple Export Formats**: JSON, TSV, Markdown, HTML with embedded diagrams

## Research Foundation
Based on academic methodologies:
- Valenzuela-Moguillansky & Vásquez-Rosati (2019) micro-phenomenological interview analysis
- Sheldrake & Dienes (2025) hypothesis generation framework

## Core Workflow
1. Upload interview transcripts (.txt files)
2. Configure dependent variable focus and analysis parameters
3. Run automated analysis pipeline (manual steps or autorun)
4. Review outputs with interactive visualizations
5. Apply human-in-the-loop corrections as needed
6. Generate comprehensive reports with embedded diagrams

## Critical Requirements
- **Google Gemini API Key**: Must be set as `process.env.API_KEY` environment variable
- **Model**: Uses `gemini-2.5-flash-preview-04-17` specifically
- Modern web browser for Mermaid.js diagram rendering