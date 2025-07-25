# Product Requirements Document: Part 2 Summary Table (P2S.4)

## Executive Summary

The Part 2 Summary Table is a comprehensive nested table component that presents the synchronic analysis results for all Diachronic Units (DUs) in a structured, hierarchical format. It provides researchers with an organized view of the relationships between DUs, ISU themes, utterances, and network structures, enabling efficient navigation and analysis of the synchronic dimensions of experience.

## Problem Statement

Currently, researchers must navigate between multiple separate outputs (P2S.1, P2S.2, P2S.3) to understand the synchronic analysis results. This fragmentation makes it difficult to:

1. See all DUs and their associated themes in one place
2. Understand which utterances belong to which themes
3. Visualize the network relationships for each DU
4. Compare patterns across different DUs
5. Export consolidated findings for reporting

## Goals and Objectives

### Primary Goals
1. **Consolidated View**: Create a single table that integrates all P2S outputs
2. **Hierarchical Navigation**: Enable expand/collapse functionality for focused analysis
3. **Direct Access**: Provide immediate access to utterance content and network diagrams
4. **Efficient Comparison**: Facilitate pattern recognition across DUs

### Success Metrics
- All P2S data accessible from a single view
- Reduced clicks to access utterance content
- Improved ability to compare themes across DUs
- Positive user feedback on organization and accessibility

## User Personas

### Primary: Micro-phenomenology Researcher
- **Needs**: Organized view of all synchronic analyses, ability to drill down to specific utterances
- **Behavior**: Systematic review of themes, frequent expansion of details
- **Goals**: Validate theme assignments, understand network relationships, prepare findings

### Secondary: Research Collaborator
- **Needs**: Summary view of themes and patterns, key network diagrams
- **Behavior**: High-level review, selective deep dives
- **Goals**: Understand synchronic patterns without navigating multiple screens

## Functional Requirements

### Core Features

#### 1. Nested Table Structure
- **Requirement**: Display a 4-column table with hierarchical data organization
- **Acceptance Criteria**:
  - Column 1: DU identification and metadata
  - Column 2: ISU themes with expand/collapse
  - Column 3: Utterances grouped by theme
  - Column 4: Network diagram for each DU

#### 2. DU Column (First Column)
- **Features**:
  - DU ID and descriptive name
  - Segment count badge
  - Temporal span indicator
  - Phase-based color coding
  - Expand/collapse toggle
- **Acceptance Criteria**:
  - Click to expand/collapse entire DU row
  - Visual indicator of expansion state
  - Preserve expansion state during session

#### 3. ISU Themes Column (Second Column)
- **Features**:
  - List of all ISU themes for the DU
  - Hierarchy level indicator (Level 1, 2, etc.)
  - Segment count per ISU
  - Abstraction operation type (e.g., "generalization")
  - ISU intensional definition (expandable)
  - Visual hierarchy with indentation for sub-units
- **Acceptance Criteria**:
  - ISUs sorted by hierarchy level then alphabetically
  - Level 1 ISUs shown with bold/larger text
  - Sub-units indented under parent units
  - Click ISU to expand/view utterances

#### 4. Utterances Column (Third Column)
- **Features**:
  - Grouped by ISU theme
  - Speaker identification (P/I icons)
  - Segment IDs and timestamps
  - Full utterance text
  - Keyword highlighting
- **Acceptance Criteria**:
  - Expandable for long utterances
  - Clear visual separation between utterances
  - Maintain readability with proper spacing

#### 4. Network Diagram Column (Fourth Column)
- **Features**:
  - Mermaid network diagram per DU
  - Shows ISU nodes and relationships
  - Node size = centrality
  - Edge thickness = connection strength
  - Click to view full-size
- **Acceptance Criteria**:
  - Responsive diagram sizing
  - Modal view for detailed inspection
  - Export capability

### Interaction Requirements

#### 1. Expand/Collapse Functionality
- **Requirement**: Multi-level expansion control
- **Acceptance Criteria**:
  - DU level: Show/hide all content for a DU
  - Theme level: Show/hide utterances for a theme
  - Utterance level: Expand/collapse long text
  - Expand/collapse all controls

#### 2. Sorting and Filtering
- **Requirement**: Table organization controls
- **Acceptance Criteria**:
  - Sort DUs by ID, name, or segment count
  - Filter ISUs by hierarchy level (show only Level 1, etc.)
  - Search utterances by keyword
  - Filter by speaker (P/I)

#### 3. Network Diagram Interaction
- **Requirement**: Interactive network visualization
- **Acceptance Criteria**:
  - Click diagram to open modal
  - Zoom/pan in modal view
  - Node hover shows details
  - Export as PNG/SVG

### Data Integration

#### 1. Input Sources
- P1.4 output: DU definitions and segments
- P2S.1 output: Thematic groupings
- P2S.2 output: ISU hierarchies and descriptions
- P2S.3 output: Network structures

#### 2. Data Processing
- Aggregate ISUs by DU from P2S.2
- Build ISU hierarchy with parent-child relationships
- Map segments to ISUs
- Generate network diagrams from P2S.3

### UI/UX Requirements

#### 1. Visual Design
- **Requirement**: Clean, professional table design
- **Acceptance Criteria**:
  - Consistent with existing app theme
  - Clear visual hierarchy
  - Adequate spacing and padding
  - Responsive to screen size

#### 2. Performance
- **Requirement**: Smooth interaction with large datasets
- **Acceptance Criteria**:
  - Lazy loading for utterance content
  - Efficient expand/collapse
  - Smooth scrolling
  - Fast diagram rendering

#### 3. Accessibility
- **Requirement**: WCAG 2.1 AA compliance
- **Acceptance Criteria**:
  - Keyboard navigation
  - Screen reader support
  - Sufficient color contrast
  - Focus indicators

### Export Requirements

#### 1. Table Export
- **Requirement**: Export table data in multiple formats
- **Acceptance Criteria**:
  - CSV export with hierarchical structure
  - Excel export with formatting
  - PDF export with diagrams
  - Markdown export for reports

#### 2. Diagram Export
- **Requirement**: Export network diagrams
- **Acceptance Criteria**:
  - PNG export at multiple resolutions
  - SVG export for editing
  - Batch export all diagrams

## Technical Specifications

### Component Architecture
- Main component: `Part2SummaryTable`
- Sub-components:
  - `DURowComponent`
  - `ISUThemeList`
  - `UtteranceGroup`
  - `NetworkDiagramViewer`

### State Management
- Expansion states in component state
- Filter/sort preferences in local storage
- Diagram cache for performance

### Styling Approach
- CSS modules for component styles
- Theme variables for consistency
- Responsive breakpoints

## Implementation Priorities

### Phase 1: Core Table Structure
1. Basic 4-column layout
2. DU and theme display
3. Simple expand/collapse

### Phase 2: Utterance Integration
1. Utterance grouping and display
2. Speaker identification
3. Text expansion

### Phase 3: Network Diagrams
1. Mermaid integration
2. Diagram generation
3. Modal viewer

### Phase 4: Enhancements
1. Sorting and filtering
2. Export functionality
3. Performance optimization

## Success Criteria

1. All P2S data accessible in a single view
2. Intuitive navigation through hierarchical data
3. Clear presentation of themes and utterances
4. Effective network visualization
5. Positive user feedback on usability

## Risks and Mitigations

### Risk 1: Performance with Large Datasets
- **Mitigation**: Implement virtual scrolling and lazy loading

### Risk 2: Complex Nested Interactions
- **Mitigation**: Clear visual indicators and consistent behavior

### Risk 3: Diagram Rendering Issues
- **Mitigation**: Fallback to simple representations if needed

## Future Enhancements

1. Cross-DU theme comparison view
2. Timeline overlay showing temporal relationships
3. Advanced filtering by multiple criteria
4. Integration with other analysis steps
5. Collaborative annotation features