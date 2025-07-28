# Claude AI Agent Team

This directory contains the configuration for specialized AI agents that work together to develop and maintain the µ-PATH project.

## Agent Roster

### Domain Expertise
- **micro-phenomenology-consultant**: Expert on micro-phenomenological analysis methodology

### Planning & Architecture
- **task-decomposer**: Breaks down complex tasks into actionable subtasks

### Development Team
- **react-typescript-developer**: Frontend development with React, TypeScript, Zustand
- **data-pipeline-developer**: Pipeline step logic and data processing
- **prompt-engineer**: LLM prompt optimization and refinement
- **code-refactoring-specialist**: Code quality improvements and refactoring

### Quality Assurance
- **vitest-qa-engineer**: Test coverage with Vitest
- **senior-code-reviewer**: Strict code review and quality gates

### Documentation
- **documentation-specialist**: Technical writing and documentation

### Workflows
- **new-pipeline-step-workflow**: Orchestrates multi-agent workflow for creating new pipeline steps

## Usage

These agents are designed to be invoked through the `Task` tool with specific requests. Each agent has:
- A specialized role and expertise
- Defined tool permissions
- Standard operating procedures
- Clear output requirements

## Branching Strategy

All agents follow the branching convention defined in `/CONTRIBUTING.md`:
- Feature branches: `agent/<agent-name>/<task-description>`
- No direct commits to `main`
- Pull requests required for all changes