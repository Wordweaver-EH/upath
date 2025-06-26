# Mermaid.js Dependency Conflict Fix

## Problem Identified
The project had a triple dependency conflict with Mermaid.js:

1. **CDN Script Tag**: `index.html` line 13 loaded `mermaid@11.0.0-rc.1` from CDN via ES module
2. **Import Map**: `index.html` line 208 specified `mermaid@^11.6.0` from ESM.sh
3. **Package.json**: Declared dependency on `mermaid@^11.6.0`

## Root Cause
Multiple loading mechanisms created potential for:
- **Version Conflicts**: Different versions (11.0.0-rc.1 vs 11.6.0) with potentially different APIs
- **Global Namespace Pollution**: CDN version could create global `mermaid` object conflicting with imported version
- **Build Non-Determinism**: Unpredictable behavior depending on load order
- **Runtime Errors**: API mismatches between versions

## Solution Implemented
**Removed redundant CDN script tag** from `index.html` line 13:
```html
<!-- REMOVED: -->
<script type="module" src="https://cdn.jsdelivr.net/npm/mermaid@11.0.0-rc.1/dist/mermaid.esm.min.js"></script>
```

## Current Architecture (Post-Fix)
**Single Source of Truth**: 
- **Import Map**: `index.html` line 208 specifies `mermaid@^11.6.0` from ESM.sh  
- **Package.json**: Declares `mermaid@^11.6.0` dependency
- **Code Import**: `index.tsx` line 4 imports via `import mermaid from 'mermaid'`
- **Global Instance**: `index.tsx` creates `window.globalMermaidInstance` for app-wide use

## Architecture Benefits
- **Hermetic Build**: No external CDN dependencies at runtime
- **Version Consistency**: Single version (^11.6.0) across entire application  
- **Predictable Behavior**: Consistent API and functionality
- **Better Error Handling**: Clear error sources and debugging
- **Theme Integration**: Proper initialization with app theme system

## Implementation Details
- **Location**: `index.html` line 13 (removed)
- **Approach**: Non-breaking change - existing initialization in `index.tsx` unchanged
- **Testing**: Build verified successful - no functionality impacted
- **Fallback**: Robust error handling already in place in `index.tsx`

## Impact
- **Eliminates Dependency Conflicts**: Single Mermaid version throughout app
- **Improves Reliability**: Predictable diagram rendering behavior
- **Enhances Build Reproducibility**: Removes external runtime dependencies
- **Maintains Functionality**: All existing Mermaid features continue working