/**
 * Example Usage of Phase Data Integration Debugger
 *
 * This file demonstrates how to use the PhaseDataIntegrationDebugger
 * to troubleshoot the current Phase 1 → Phase 2 enrichedPacks issue.
 */

import type { Phase1Data } from '@shared/interfaces/PipelineTypes';
import {
  createPhaseDataIntegrationDebugger,
  debugPhase1ToPhase2Transition,
  type DataIntegrationIssue
} from './PhaseDataIntegrationDebugger';

/**
 * Example 1: Debug the specific Phase 1 → Phase 2 enrichedPacks issue
 */
export async function exampleDebugEnrichedPacksIssue(phase1Data: Phase1Data): Promise<void> {
  console.log('🔍 Example 1: Debugging enrichedPacks issue...');

  try {
    const result = await debugPhase1ToPhase2Transition(phase1Data, {
      autoFix: true,
      generateReport: true
    });

    console.log(`📊 Analysis Results:`);
    console.log(`  - Issues found: ${result.issues.length}`);
    console.log(`  - Can proceed: ${result.canProceed}`);

    if (result.autoFixed) {
      console.log(`  - Auto-fixed: ${result.autoFixed.fixed.length} issues`);
      console.log(`  - Remaining: ${result.autoFixed.remaining.length} issues`);
    }

    if (result.reportPath) {
      console.log(`  - Report saved: ${result.reportPath}`);
    }

    // Log critical issues
    const criticalIssues = result.issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      console.error('❌ Critical Issues:');
      criticalIssues.forEach(issue => {
        console.error(`  - ${issue.title}: ${issue.description}`);
        console.error(`    Fix: ${issue.suggestedFix}`);
      });
    }

    // Log error issues
    const errorIssues = result.issues.filter(i => i.severity === 'error');
    if (errorIssues.length > 0) {
      console.warn('⚠️  Error Issues:');
      errorIssues.forEach(issue => {
        console.warn(`  - ${issue.title}: ${issue.description}`);
        console.warn(`    Fix: ${issue.suggestedFix}`);
      });
    }

  } catch (error) {
    console.error('❌ Debug analysis failed:', error);
  }
}

/**
 * Example 2: Full phase transition debugging
 */
export async function exampleFullPhaseDebug(phase1Data: Phase1Data): Promise<void> {
  console.log('🔍 Example 2: Full phase transition debugging...');

  const phaseDebugger = createPhaseDataIntegrationDebugger();

  try {
    const analysis = await phaseDebugger.debugPhaseTransition(
      1, // source phase
      2, // target phase
      phase1Data,
      {
        metadataResult: {
          enrichedPacks: 'EnrichedPack[]',
          processedFiles: 'number'
        }
      },
      {
        verbose: true,
        generateReport: true,
        autoFix: false
      }
    );

    console.log('📊 Full Analysis Results:');
    console.log('  Issues by severity:');
    const bySeverity = analysis.issues.reduce((acc, issue) => {
      acc[issue.severity] = (acc[issue.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(bySeverity).forEach(([severity, count]) => {
      console.log(`    ${severity}: ${count}`);
    });

    console.log('  Issues by category:');
    const byCategory = analysis.issues.reduce((acc, issue) => {
      acc[issue.category] = (acc[issue.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(byCategory).forEach(([category, count]) => {
      console.log(`    ${category}: ${count}`);
    });

    console.log('\n🔧 Suggested Fixes:');
    analysis.suggestedFixes.forEach((fix, index) => {
      console.log(`  ${index + 1}. ${fix}`);
    });

    console.log('\n📈 Phase Analysis:');
    analysis.phaseAnalysis.forEach(phase => {
      console.log(`  Phase ${phase.phase}:`);
      console.log(`    Complete: ${phase.isComplete}`);
      console.log(`    Integrity Score: ${(phase.dataIntegrityScore * 100).toFixed(1)}%`);
      console.log(`    Can Proceed: ${phase.canProceedToNext}`);
      if (phase.blockers.length > 0) {
        console.log(`    Blockers: ${phase.blockers.join(', ')}`);
      }
    });

    console.log('\n🔗 Data Flow Trace:');
    analysis.dataFlowTrace.forEach(trace => {
      console.log(`  ${trace.sourcePhase} → ${trace.targetPhase}:`);
      console.log(`    Path: ${trace.dataPath.join('.')}`);
      console.log(`    Expected: ${trace.expectedType}`);
      console.log(`    Actual: ${trace.actualType}`);
      console.log(`    Present: ${trace.isPresent}`);
    });

  } catch (error) {
    console.error('❌ Full debug analysis failed:', error);
  }
}

/**
 * Example 3: Targeted enrichedPacks debugging
 */
export async function exampleTargetedDebugging(phase1Data: Phase1Data): Promise<void> {
  console.log('🔍 Example 3: Targeted enrichedPacks debugging...');

  const phaseDebugger = createPhaseDataIntegrationDebugger();

  try {
    const enrichedPacksIssues = await phaseDebugger.debugEnrichedPacksIssue(phase1Data);

    console.log('📊 EnrichedPacks Analysis:');
    console.log(`  Issues found: ${enrichedPacksIssues.length}`);

    enrichedPacksIssues.forEach(issue => {
      console.log(`\n  Issue: ${issue.title}`);
      console.log(`    Severity: ${issue.severity}`);
      console.log(`    Description: ${issue.description}`);
      console.log(`    Affected Field: ${issue.affectedField}`);
      console.log(`    Suggested Fix: ${issue.suggestedFix}`);

      if (issue.diagnosticData) {
        console.log(`    Diagnostic Data:`, issue.diagnosticData);
      }
    });

    // Show debugger statistics
    const stats = phaseDebugger.getStatistics();
    console.log('\n📈 Debugger Statistics:');
    console.log(`  Total Issues Detected: ${stats.totalIssuesDetected}`);
    console.log(`  By Category:`, stats.issuesByCategory);
    console.log(`  By Severity:`, stats.issuesBySeverity);

  } catch (error) {
    console.error('❌ Targeted debug analysis failed:', error);
  }
}

/**
 * Example 4: Integration with Phase2Controller validation
 */
export function examplePhase2Integration(): string {
  return `
// In your Phase2Controller.ts execute method:

async execute(input: Phase1Data, onProgress?: ProgressCallback): Promise<StepResult<Phase2Data>> {
  const startTime = Date.now();
  const errors: string[] = [];

  try {
    // STEP 1: Debug data integration before validation
    console.log('🔍 Debugging Phase 1 → Phase 2 data integration...');

    const debugResult = await debugPhase1ToPhase2Transition(input, {
      autoFix: true
    });

    // STEP 2: Handle critical issues
    const criticalIssues = debugResult.issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      return {
        success: false,
        error: {
          code: 'PHASE1_DATA_CRITICAL_ISSUES',
          message: \`Critical data integration issues detected: \${criticalIssues.map(i => i.title).join(', ')}\`
        },
        canProceed: false
      };
    }

    // STEP 3: Log auto-fixes applied
    if (debugResult.autoFixed?.fixed.length > 0) {
      console.log(\`✅ Applied \${debugResult.autoFixed.fixed.length} automatic fixes\`);
      debugResult.autoFixed.fixed.forEach(fix => {
        console.log(\`  - Fixed: \${fix.title}\`);
      });
    }

    // STEP 4: Warn about remaining issues
    const remainingIssues = debugResult.autoFixed?.remaining || debugResult.issues;
    if (remainingIssues.length > 0) {
      console.warn(\`⚠️  Remaining issues (\${remainingIssues.length}):\`);
      remainingIssues.forEach(issue => {
        console.warn(\`  - \${issue.severity.toUpperCase()}: \${issue.title}\`);
      });
    }

    // STEP 5: Proceed with original validation (should now pass)
    const validation = await this.validate(input);
    if (!validation.valid) {
      return {
        success: false,
        error: {
          code: 'PHASE1_DATA_INVALID',
          message: \`Données Phase 1 invalides après debug: \${validation.errors.join(', ')}\`
        },
        canProceed: false
      };
    }

    // Continue with normal Phase2 execution...
    const enrichedPacks = input.metadataResult.enrichedPacks; // Should now work

    // Rest of your Phase2 logic...
  } catch (error) {
    console.error('❌ Phase2 execution failed:', error);
    // Handle error...
  }
}
`;
}

/**
 * Example 5: Create a mock Phase1Data with the common issue for testing
 */
export function createMockPhase1DataWithIssue(): Phase1Data {
  return {
    workingPath: '/mock/working/path',
    deepAnalysisResult: {
      totalPacks: 5,
      totalFiles: 50,
      totalSize: 1024 * 1024 * 100, // 100MB
      fileDistribution: {} as any,
      depthAnalysis: {} as any,
      organizationPatterns: {} as any,
      statistics: {} as any,
      enrichedPacks: [
        {
          packId: 'mock-pack-1',
          originalPack: { name: 'Mock Pack 1', path: '/mock/pack1' } as any,
          files: [],
          metadata: {},
          tags: {}
        },
        {
          packId: 'mock-pack-2',
          originalPack: { name: 'Mock Pack 2', path: '/mock/pack2' } as any,
          files: [],
          metadata: {},
          tags: {}
        }
      ] as any[]
    },
    indexingResult: {
      indexedFiles: 50,
      allFiles: [],
      duplicates: [],
      packIndex: new Map(),
      packDetails: new Map()
    },
    // Missing metadataResult - this will trigger the issue!
    // metadataResult: undefined,
    summary: {
      startTime: Date.now(),
      endTime: Date.now(),
      duration: 1000,
      totalPacks: 5,
      totalFiles: 50,
      totalSize: 1024 * 1024 * 100,
      duplicatesFound: 0,
      duplicatesRemoved: 0,
      spaceRecovered: 0,
      metadataExtracted: 0,
      errors: [],
      warnings: []
    }
  };
}

/**
 * Run all examples
 */
export async function runAllExamples(): Promise<void> {
  console.log('🚀 Running Phase Data Integration Debugger Examples...\n');

  // Create mock data with the common issue
  const mockPhase1Data = createMockPhase1DataWithIssue();

  await exampleDebugEnrichedPacksIssue(mockPhase1Data);
  console.log('\n' + '='.repeat(60) + '\n');

  await exampleFullPhaseDebug(mockPhase1Data);
  console.log('\n' + '='.repeat(60) + '\n');

  await exampleTargetedDebugging(mockPhase1Data);
  console.log('\n' + '='.repeat(60) + '\n');

  console.log('💡 Example Phase2Controller Integration:');
  console.log(examplePhase2Integration());

  console.log('\n✅ All examples completed!');
}

// Function already exported above
