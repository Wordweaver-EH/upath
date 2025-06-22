# Cleanup and Deprecation Changes

## Recent Codebase Cleanup (Latest Session)

### Files Removed
1. **Empty Components**: 
   - `components/DiachronicVisualization.tsx` (empty file)
   - `components/SynchronicVisualization.tsx` (empty file)

2. **Backup Files**:
   - `backup/upath_v6.3.zip` 
   - `backup/` directory (removed if empty)

### Feature Flag Deprecation
- **Removed**: `USE_TWO_PHASE_P3_2` boolean flag completely
- **Updated**: All references to use `P3_2_APPROACH` instead
- **Files Modified**:
  - `constants.tsx`: Removed flag definition and export
  - `App.tsx`: Removed import and updated conditional logic
  - `.env.example`: Replaced with deprecation notice

### Logic Migration
**Before**:
```typescript
if (USE_TWO_PHASE_P3_2) { ... }
```

**After**:
```typescript
if (['minimal_context_tsv', 'full_context_tsv', 'zero_context_tsv', 'minified'].includes(P3_2_APPROACH)) { ... }
```

### Documentation Updates
- **CLAUDE.md**: Removed legacy flag references, added implementation notes
- **.env.example**: Updated with comprehensive approach examples
- **Comments**: Updated to reflect new architecture

### Error Message Improvements
- **Console logs**: Now show specific approach (e.g., `[P3.2 full_context_tsv]`)
- **IV fallback**: Changed from misleading "To be analyzed." to descriptive "No IV variation analysis provided in LLM classifications."

### Result
- Cleaner codebase without obsolete files
- Unified feature flag system
- Better user feedback and debugging capabilities
- Maintained backwards compatibility through environment variable migration path