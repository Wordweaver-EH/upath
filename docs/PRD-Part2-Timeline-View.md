# Product Requirements Document: Part 2 Timeline View

## Executive Summary

The Part 2 Timeline View is a new visualization component that provides an integrated temporal and structural view of analyzed interview transcripts. It displays the diachronic progression of experience through Diachronic Units (DUs) while revealing the synchronic structures within each unit, enabling researchers to understand both the flow of experience and the simultaneous elements at each moment.

## Problem Statement

Currently, researchers must navigate between multiple tables and views to understand the relationship between temporal progression (Part 1 outputs) and synchronic analysis (Part 2 outputs). This fragmentation makes it difficult to:

1. Visualize the overall experiential flow
2. Understand relationships between DUs and their internal structures
3. Trace specific utterances through the analytical pipeline
4. Identify patterns across the temporal dimension
5. Present findings in an intuitive, accessible format

## Goals and Objectives

### Primary Goals
1. **Unified Visualization**: Create a single view that integrates diachronic and synchronic analyses
2. **Interactive Exploration**: Enable researchers to navigate temporal flow while accessing structural details
3. **Pattern Recognition**: Facilitate identification of recurring themes and transitions
4. **Data Traceability**: Maintain clear connections from utterances to analytical abstractions

### Success Metrics
- Reduced time to navigate between DUs and their analyses
- Improved ability to identify temporal patterns
- Enhanced presentation capabilities for research findings
- Positive user feedback on clarity and usability

## User Personas

### Primary: Micro-phenomenology Researcher
- **Needs**: Detailed view of experiential unfolding, ability to trace analytical decisions
- **Behavior**: Iterative exploration, frequent comparison between units
- **Goals**: Understand participant experience, validate analysis, present findings

### Secondary: Research Collaborator
- **Needs**: High-level overview, key insights, exportable visualizations
- **Behavior**: Quick review, focus on patterns and conclusions
- **Goals**: Understand findings without deep technical knowledge

## Functional Requirements

### Core Features

#### 1. Swim Lane Timeline Display
- **Requirement**: Display 4 parallel horizontal lanes showing different analytical perspectives
- **Acceptance Criteria**:
  - Lane 1: DU progression with variable-width blocks
  - Lane 2: ISU theme flows with intensity variations
  - Lane 3: Synchronic network mini-diagrams
  - Lane 4: Individual utterance segments

#### 2. Interactive Navigation
- **Requirement**: Smooth temporal navigation with zoom and pan
- **Acceptance Criteria**:
  - Horizontal scroll/drag for time navigation
  - Zoom controls for temporal detail adjustment
  - Minimap for overview navigation
  - Smooth animations between states

#### 3. Cross-Lane Interactions
- **Requirement**: Coordinated highlighting across all lanes
- **Acceptance Criteria**:
  - Hover any element highlights related elements in all lanes
  - Visual connections drawn between related elements
  - Click to pin connections for comparison
  - Clear visual feedback for all interactions

#### 4. Detail Panels
- **Requirement**: On-demand detailed information for any element
- **Acceptance Criteria**:
  - DU details: description, segment count, themes
  - ISU details: definition, abstraction operation
  - Segment details: full utterance text, speaker, temporal cues
  - Non-blocking overlay or side panel display

#### 5. Data Export
- **Requirement**: Export timeline visualization and underlying data
- **Acceptance Criteria**:
  - Export timeline as PNG/SVG image
  - Export data as structured CSV
  - Configurable export options (zoom level, lanes to include)
  - High-resolution output for publications

### Technical Requirements

#### Performance
- Render 100+ segments without lag
- Smooth 60fps animations
- Response time <100ms for interactions
- Progressive rendering for large datasets

#### Browser Support
- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest version)
- Minimum viewport: 1280x720

#### Accessibility
- Keyboard navigation support
- Screen reader compatibility for data
- High contrast mode support
- Configurable colors for color-blind users

## Design Specifications

### Visual Design
```
┌─────────────────────────────────────────────────────────────┐
│ Toolbar: [Zoom -|+] [Export] [Filter] [Settings]           │
├─────────────────────────────────────────────────────────────┤
│ DUs      │━━━━━━━│━━━━━━━━━━━│━━━━━━│━━━━━━━━━━━━━│       │
│          │  DU1  │    DU2    │ DU3  │     DU4     │       │
├──────────┼──────────────────────────────────────────────────┤
│ ISUs     │ ≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈       │
│          │   ≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈         │
├──────────┼──────────────────────────────────────────────────┤
│ Networks │  ◯-◯  │    ◯-◯-◯   │ ◯-◯ │   ◯-◯-◯-◯   │       │
│          │   ◯   │      ◯      │     │     ◯-◯     │       │
├──────────┼──────────────────────────────────────────────────┤
│ Segments │ ▪▪▪▪  │ ▪▪▪▪▪▪▪▪▪  │ ▪▪▪ │ ▪▪▪▪▪▪▪▪▪▪ │       │
│          │  ▪▪   │   ▪▪▪▪▪     │  ▪  │    ▪▪▪▪     │       │
├─────────────────────────────────────────────────────────────┤
│ Minimap: [━━━━━━━━━━━━━━━━━━[viewport]━━━━━━━━━━━━━━━━━━] │
└─────────────────────────────────────────────────────────────┘
```

### Color Scheme
- **DUs**: Blue gradient (unique shade per DU)
- **ISUs**: Category-based consistent colors
- **Networks**: Monochrome for clarity
- **Segments**: Speaker differentiation (P/I)

### Interaction States
- **Default**: Normal display
- **Hover**: Highlight + connections
- **Selected**: Bold outline + persistent highlight
- **Pinned**: Dashed connections
- **Filtered**: Opacity reduction for non-matching

## Implementation Plan

### Phase 1: Core Timeline (Week 1-2)
- [ ] Create base component structure
- [ ] Implement DU lane with basic rendering
- [ ] Add temporal navigation (scroll/zoom)
- [ ] Basic hover interactions

### Phase 2: Multi-Lane Integration (Week 3-4)
- [ ] Add ISU flow lane
- [ ] Add network snapshot lane
- [ ] Add segment lane with stacking
- [ ] Implement cross-lane highlighting

### Phase 3: Interactions (Week 5-6)
- [ ] Detail panels
- [ ] Connection pinning
- [ ] Advanced filtering
- [ ] Export functionality

### Phase 4: Polish (Week 7-8)
- [ ] Performance optimization
- [ ] Accessibility features
- [ ] Documentation
- [ ] User testing and refinement

## Technical Architecture

### Component Structure
```typescript
Part2SwimLaneTimeline/
├── index.tsx                 // Main component
├── lanes/
│   ├── DULane.tsx
│   ├── ISULane.tsx
│   ├── NetworkLane.tsx
│   └── SegmentLane.tsx
├── controls/
│   ├── TimelineControls.tsx
│   ├── Minimap.tsx
│   └── ExportDialog.tsx
├── hooks/
│   ├── useTimelineNavigation.ts
│   ├── useDataProcessing.ts
│   └── useInteractions.ts
└── utils/
    ├── rendering.ts
    ├── dataTransform.ts
    └── export.ts
```

### Data Flow
1. Receive P1.4 DUs + P2S outputs
2. Process into timeline-friendly format
3. Calculate layout positions
4. Render lanes with virtual scrolling
5. Handle interactions with efficient updates

### Dependencies
- React 18+
- D3.js (scales, data processing)
- Canvas API (performance rendering)
- React Spring (animations)
- html2canvas (export functionality)

## Risks and Mitigation

### Risk: Performance with Large Datasets
**Mitigation**: Virtual scrolling, progressive rendering, data clustering

### Risk: Complex Interaction Patterns
**Mitigation**: User testing, iterative refinement, clear visual feedback

### Risk: Browser Compatibility
**Mitigation**: Progressive enhancement, fallback rendering modes

## Success Criteria

1. **Functionality**: All features implemented and working
2. **Performance**: Meets performance benchmarks
3. **Usability**: Positive feedback from user testing
4. **Integration**: Seamless integration with existing pipeline
5. **Documentation**: Complete user and developer documentation

## Future Enhancements

1. **Comparative View**: Side-by-side timeline comparison
2. **Pattern Detection**: Automated pattern highlighting
3. **Annotation System**: Add researcher notes to timeline
4. **Collaborative Features**: Share and discuss timelines
5. **Advanced Analytics**: Statistical overlays and metrics

## Appendix

### Mockups
[Include visual mockups here]

### User Stories
1. As a researcher, I want to see the flow of DUs so I can understand temporal progression
2. As a researcher, I want to explore synchronic structures within each DU
3. As a researcher, I want to trace utterances through the analysis pipeline
4. As a presenter, I want to export clean visualizations for publications

### API Specifications
[Include detailed API docs for component props and methods]