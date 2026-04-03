# UPath Project Structure

## Repository Layout
```
upath/                      # Root directory (Frontend)
├── src/                   # Frontend source code
│   ├── stores/           # Zustand state management
│   ├── components/       # React components
│   ├── utils/           # Helper functions
│   └── services/        # API integration
├── public/              # Static assets
├── e2e/                 # End-to-end tests
├── docs/                # Documentation
├── types.ts             # TypeScript interfaces
├── constants.tsx        # App constants and config
├── App.tsx             # Main app component
├── index.tsx           # App entry point
├── vite.config.ts      # Vite configuration
├── tsconfig.json       # TypeScript config
├── package.json        # Frontend dependencies
├── CLAUDE.md           # AI agent guidelines
└── .env.example        # Environment template

upath-backend/            # Backend directory
├── src/
│   ├── routes/         # API endpoints
│   ├── server.ts       # Testable app builder
│   ├── index.ts        # Server entry point
│   └── __tests__/      # Test files
├── tsconfig.json       # Backend TS config
├── package.json        # Backend dependencies
└── .env               # Environment variables
```

## Key Patterns
- Frontend and backend are separate Node projects
- Backend serves as secure proxy for Gemini API
- Tests live alongside source code in `__tests__`
- Configuration via environment variables
- Strict TypeScript throughout