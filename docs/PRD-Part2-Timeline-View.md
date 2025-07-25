# Product Requirements Document: Part 2 Summary Table (P2S.4)

## Executive Summary

The Part 2 Summary Table is a comprehensive table component that presents the synchronic analysis results for all Diachronic Units (DUs) in a clear, fully-visible format. Using merged cells for optimal data presentation, it provides researchers with an organized view of the relationships between DUs, ISU themes, utterances, and network structures, enabling efficient analysis of the synchronic dimensions of experience without requiring any interaction to reveal data.

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
2. **Complete Visibility**: All data visible without any user interaction required
3. **Direct Access**: Provide immediate access to utterance content and network diagrams
4. **Efficient Comparison**: Facilitate pattern recognition across DUs

### Success Metrics
- All P2S data visible from a single view with no interaction required
- Zero clicks needed to access any data
- Improved ability to compare themes across DUs
- Positive user feedback on organization and accessibility

## User Personas

### Primary: Micro-phenomenology Researcher
- **Needs**: Organized view of all synchronic analyses with complete visibility
- **Behavior**: Systematic review of themes, scanning across rows for patterns
- **Goals**: Validate theme assignments, understand network relationships, prepare findings

### Secondary: Research Collaborator
- **Needs**: Complete view of themes and patterns, all network diagrams visible
- **Behavior**: High-level review, visual scanning of data
- **Goals**: Understand synchronic patterns without any navigation or clicks

## Functional Requirements

### Core Features

#### 1. Table Structure with Merged Cells
- **Requirement**: Display a 4-column table with merged cells for optimal data presentation
- **Acceptance Criteria**:
  - Column 1: DU identification and metadata (spans all rows for that DU)
  - Column 2: ISU themes (each theme spans its utterance rows)
  - Column 3: Utterances (one per row)
  - Column 4: Network diagram for each DU (spans all rows for that DU)

#### 2. DU Column (First Column)
- **Features**:
  - DU ID and descriptive name
  - Segment count badge
  - Temporal span indicator
  - Phase-based color coding
  - Merged cell spanning all rows for the DU
- **Acceptance Criteria**:
  - Cell uses rowSpan attribute for proper merging
  - Visual borders clearly delineate DU boundaries
  - Phase colors applied as background

#### 3. ISU Themes Column (Second Column)
- **Features**:
  - ISU theme name and metadata
  - Hierarchy level indicator (Level 1, 2, etc.)
  - Utterance count per ISU
  - Abstraction operation type (e.g., "generalization")
  - ISU intensional definition displayed
  - Visual hierarchy with indentation for sub-units
  - Merged cell spanning all utterances for that ISU
- **Acceptance Criteria**:
  - ISUs sorted by hierarchy level then alphabetically
  - Level 1 ISUs shown with bold/larger text
  - Sub-units indented with └─ prefix
  - Cell uses rowSpan for proper merging

#### 4. Utterances Column (Third Column)
- **Features**:
  - One utterance per row
  - Speaker identification (P/I icons)
  - Segment IDs and timestamps
  - Full utterance text visible
  - Keyword highlighting when searching
- **Acceptance Criteria**:
  - Each utterance in its own table row
  - Clear visual separation between utterances
  - Maintain readability with proper spacing
  - Text wrapping for long utterances

#### 5. Network Diagram Column (Fourth Column)
- **Features**:
  - Mermaid network diagram per DU
  - Shows ISU nodes and relationships
  - Node size = centrality
  - Edge thickness = connection strength
  - Click to view full-size
  - Merged cell spanning all rows for the DU
- **Acceptance Criteria**:
  - Cell uses rowSpan for proper merging
  - Responsive diagram sizing within cell
  - Modal view for detailed inspection on click
  - Export capability from modal

### Interaction Requirements

#### 1. Scrolling and Navigation
- **Requirement**: Smooth scrolling through complete dataset
- **Acceptance Criteria**:
  - Vertical scrolling through all rows
  - Horizontal scrolling if table exceeds viewport
  - Sticky headers remain visible during scroll
  - Virtual scrolling for performance with large datasets

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
- Filter/sort preferences in local storage
- Search query in component state
- Diagram cache for performance
- No expansion state needed

### Styling Approach
- CSS modules for component styles
- Theme variables for consistency
- Responsive breakpoints

## Implementation Priorities

### Phase 1: Core Table Structure
1. Basic 4-column layout with merged cells
2. Row generation logic for proper spanning
3. DU and ISU display with hierarchy

### Phase 2: Utterance Integration
1. Utterance display one per row
2. Speaker identification
3. Proper alignment with ISU themes

### Phase 3: Network Diagrams
1. Mermaid integration
2. Diagram generation
3. Modal viewer

### Phase 4: Enhancements
1. Sorting and filtering
2. Export functionality
3. Performance optimization

## Success Criteria

1. All P2S data visible in a single view without user interaction
2. Clear visual hierarchy through merged cells and indentation
3. Clear presentation of themes and utterances
4. Effective network visualization
5. Positive user feedback on immediate data visibility

## Risks and Mitigations

### Risk 1: Performance with Large Datasets
- **Mitigation**: Implement virtual scrolling and lazy loading

### Risk 2: Complex Cell Merging Layout
- **Mitigation**: Careful row calculation and proper HTML table structure

### Risk 3: Diagram Rendering Issues
- **Mitigation**: Fallback to simple representations if needed

## Future Enhancements

1. Cross-DU theme comparison view
2. Timeline overlay showing temporal relationships
3. Advanced filtering by multiple criteria
4. Integration with other analysis steps
5. Collaborative annotation features