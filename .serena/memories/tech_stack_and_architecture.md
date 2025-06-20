# Technology Stack & Architecture

## Core Technologies

### Frontend Framework
- **React 19.1.0**: Latest React with modern hooks and concurrent features
- **TypeScript 5.7.2**: Strict type checking enabled, modern ES2020 target
- **Tailwind CSS**: Utility-first CSS framework (classes used throughout components)

### Build & Development
- **Vite 6.2.0**: Fast build tool and dev server with HMR
- **ESNext Modules**: Modern module system with bundler resolution
- **JSX**: React JSX transform, no additional React imports needed

### Key Dependencies
- **@google/genai 1.3.0**: Google Gemini API integration for AI analysis
- **marked 13.0.2**: Markdown parsing and rendering for reports
- **mermaid 11.6.0**: Interactive diagram generation (Gantt, flowcharts, DAGs)

## Architecture Patterns

### State Management
- **Centralized State**: All state managed in main `App.tsx` component
- **React Hooks**: useState, useEffect, useCallback, useRef for state management
- **Immutable Updates**: State updates follow React patterns for immutability

### Component Organization
```
components/
├── CollapsibleSection.tsx    # Reusable collapsible UI containers
├── ControlsPanel.tsx         # Main control buttons and actions
├── HilModal.tsx             # Human-in-the-Loop correction modal
├── MermaidDiagram.tsx       # Mermaid diagram renderer
├── PipelineOverview.tsx     # Pipeline visualization and navigation
├── SettingsPanel.tsx        # Configuration and file upload
└── StatusDisplay.tsx        # Step status indicators
```

### Service Layer
- **services/geminiService.ts**: Encapsulates all Gemini API interactions
- **utils/**: Helper modules for data transformation (TSV, HTML, Mermaid, reports)

### Data Flow
1. **Input**: File upload → Raw transcript storage
2. **Processing**: Step-by-step AI analysis via Gemini API
3. **State**: Results stored in typed interfaces (types.ts)
4. **Visualization**: Mermaid diagrams generated from structured data
5. **Output**: Multiple export formats (JSON, TSV, Markdown, HTML)

## TypeScript Configuration
- **Strict Mode**: All strict TypeScript checks enabled
- **Modern Target**: ES2020 with DOM libs
- **Path Mapping**: `@/*` maps to project root for clean imports
- **Bundler Mode**: Optimized for Vite bundling