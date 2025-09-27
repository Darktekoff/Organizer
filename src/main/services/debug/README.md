# Phase Data Integration Debugger

A specialized debugging agent for troubleshooting data integration issues between pipeline phases in the Audio Organizer V6 Electron application.

## Quick Start

### Debug the Current Phase 1 → Phase 2 Issue

```typescript
import { debugPhase1ToPhase2Transition } from './PhaseDataIntegrationDebugger';

// In your Phase2Controller or pipeline manager
const phase1Data = /* your Phase1Data */;

const debugResult = await debugPhase1ToPhase2Transition(phase1Data, {
  autoFix: true,        // Attempt automatic fixes
  generateReport: true  // Generate detailed report
});

console.log(`Found ${debugResult.issues.length} issues`);
console.log(`Can proceed: ${debugResult.canProceed}`);

if (debugResult.autoFixed) {
  console.log(`Auto-fixed: ${debugResult.autoFixed.fixed.length} issues`);
}
```

### Full Phase Transition Debugging

```typescript
import { createPhaseDataIntegrationDebugger } from './PhaseDataIntegrationDebugger';

const debugger = createPhaseDataIntegrationDebugger();

const analysis = await debugger.debugPhaseTransition(
  1, // source phase
  2, // target phase
  phase1Data,
  { metadataResult: { enrichedPacks: 'EnrichedPack[]' } }, // expected structure
  {
    verbose: true,
    generateReport: true,
    autoFix: false
  }
);

console.log('Issues found:', analysis.issues);
console.log('Suggested fixes:', analysis.suggestedFixes);
```

## Common Issues Detected

### 1. EnrichedPacks Location Mismatch
**Problem**: Phase2 expects `enrichedPacks` in `metadataResult` but they're in `deepAnalysisResult`

**Auto-fix**: Copies enrichedPacks to the correct location

**Manual fix**: Update Phase1Controller or Phase2 validation logic

### 2. Missing MetadataResult
**Problem**: Phase1 Step3 (MetadataExtractor) failed or didn't complete

**Diagnostic**: Check Phase1 execution logs for Step3 errors

**Fix**: Ensure Step3 completes successfully or implement fallback

### 3. Premature Phase Completion
**Problem**: Phase appears complete but missing critical data

**Diagnostic**: Check for race conditions in async step execution

**Fix**: Ensure proper async/await handling in controllers

### 4. User Action Required Bypass
**Problem**: Pipeline proceeds despite needing user input (e.g., duplicate handling)

**Diagnostic**: Check `requiresUserAction` flags and duplicate strategies

**Fix**: Implement proper user action handling in pipeline flow

## Debug Report Structure

Generated reports include:

- **Issue Summary**: Count by severity (critical/error/warning)
- **Data Flow Trace**: How data moves between phases
- **Phase State Analysis**: Completeness and integrity scores
- **Suggested Fixes**: Specific recommendations for each issue
- **Source Data Structure**: Analysis of actual vs expected data
- **Diagnostics**: System info and performance metrics

## Integration with Pipeline

### In Phase Controllers

```typescript
export class Phase2Controller {
  async execute(input: Phase1Data, onProgress?: ProgressCallback): Promise<StepResult<Phase2Data>> {
    // Debug data integration before proceeding
    const debugResult = await debugPhase1ToPhase2Transition(input, { autoFix: true });

    if (!debugResult.canProceed) {
      return {
        success: false,
        error: {
          code: 'PHASE1_DATA_INVALID',
          message: `Critical data integration issues: ${debugResult.issues.filter(i => i.severity === 'critical').map(i => i.title).join(', ')}`
        },
        canProceed: false
      };
    }

    // Apply any auto-fixes
    if (debugResult.autoFixed?.fixed.length > 0) {
      console.log(`Applied ${debugResult.autoFixed.fixed.length} automatic fixes`);
    }

    // Continue with normal execution...
  }
}
```

### In Pipeline Manager

```typescript
async transitionToPhase2(phase1Data: Phase1Data): Promise<void> {
  const debugger = createPhaseDataIntegrationDebugger();

  // Full diagnostic before transition
  const analysis = await debugger.debugPhaseTransition(1, 2, phase1Data, expectedPhase2Input);

  if (analysis.issues.some(i => i.severity === 'critical')) {
    throw new Error('Cannot proceed to Phase 2: Critical data integration issues detected');
  }

  // Log warnings but proceed
  const warnings = analysis.issues.filter(i => i.severity === 'warning');
  if (warnings.length > 0) {
    console.warn(`Phase transition warnings: ${warnings.map(w => w.title).join(', ')}`);
  }
}
```

## API Reference

### Main Functions

- `createPhaseDataIntegrationDebugger()`: Factory for creating debugger instances
- `debugPhase1ToPhase2Transition(phase1Data, options)`: Convenience function for the current issue
- `debugger.debugPhaseTransition(source, target, data, expected, options)`: Full phase transition analysis
- `debugger.debugEnrichedPacksIssue(phase1Data)`: Specific enrichedPacks debugging
- `debugger.applyAutomaticFixes(issues, sourceData)`: Apply auto-fixes where possible

### Options

```typescript
interface DebugOptions {
  verbose?: boolean;        // Detailed logging
  generateReport?: boolean; // Create JSON report file
  autoFix?: boolean;       // Apply automatic fixes
}
```

### Issue Types

- **missing_data**: Required data is absent
- **structure_mismatch**: Data structure doesn't match expectation
- **state_inconsistency**: Internal state is inconsistent
- **race_condition**: Timing/async execution issues

### Severity Levels

- **critical**: Pipeline must halt
- **error**: Likely to cause phase failure
- **warning**: May cause issues but can proceed

## Troubleshooting

### Common Solutions

1. **"enrichedPacks in wrong location"**
   - Enable auto-fix or update Phase1Controller to ensure data consistency

2. **"MetadataResult completely missing"**
   - Check Phase1 Step3 execution logs
   - Verify file system permissions and working directory

3. **"Phase completed prematurely"**
   - Review async/await usage in Phase1Controller
   - Add completion validation before building Phase1Data

4. **"User action bypassed"**
   - Implement proper `requiresUserAction` handling
   - Add UI for duplicate resolution before proceeding

### Debug Report Locations

Reports are saved to: `./debug-reports/phase-integration-debug-{timestamp}.json`

### Performance Considerations

- Debugging adds ~50-200ms overhead per phase transition
- Auto-fix operations are in-memory and generally safe
- Report generation adds ~10-50ms depending on data size
- Use `verbose: false` in production for better performance

## Contributing

When adding new issue detection:

1. Add issue ID to the appropriate detection method
2. Include suggested fix in `generateFixes()`
3. Add auto-fix logic in `applyAutomaticFixes()` if applicable
4. Update this documentation with the new issue type