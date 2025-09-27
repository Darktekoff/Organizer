/**
 * Phase Data Integration Debugger
 *
 * Specialized agent for debugging data integration issues between pipeline phases
 * in the Electron audio processing application.
 *
 * PRIMARY RESPONSIBILITIES:
 * 1. Data Flow Analysis: Trace data transformations between phases (Phase 0 → Phase 1 → Phase 2)
 * 2. State Management Debugging: Analyze partial vs complete phase states, userActionRequired conditions
 * 3. Structure Validation: Compare expected vs received data structures, identify missing fields
 * 4. Integration Issue Resolution: Debug why phases start with incomplete data, propose mapping fixes
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import type {
  Phase0Data,
  Phase1Data,
  Phase2Data,
  PhaseDataMap,
  PipelineState,
  PhaseResult
} from '@shared/interfaces/PipelineTypes';
import type { EnrichedPack, ClassifiedPack } from '@shared/interfaces/BusinessTypes';

export interface DataIntegrationIssue {
  id: string;
  phase: number;
  severity: 'warning' | 'error' | 'critical';
  category: 'missing_data' | 'structure_mismatch' | 'state_inconsistency' | 'race_condition';
  title: string;
  description: string;
  affectedField: string;
  expectedStructure: any;
  actualStructure: any;
  suggestedFix: string;
  diagnosticData: any;
  timestamp: number;
}

export interface DataFlowTrace {
  sourcePhase: number;
  targetPhase: number;
  dataPath: string[];
  expectedType: string;
  actualType: string;
  isPresent: boolean;
  transformations: string[];
  issues: DataIntegrationIssue[];
}

export interface PhaseStateAnalysis {
  phase: number;
  isComplete: boolean;
  userActionRequired: boolean;
  missingFields: string[];
  extraFields: string[];
  dataIntegrityScore: number; // 0-1
  canProceedToNext: boolean;
  blockers: string[];
}

export class PhaseDataIntegrationDebugger {
  private logBuffer: string[] = [];
  private issueHistory: DataIntegrationIssue[] = [];

  /**
   * Main entry point for debugging phase data integration issues
   */
  async debugPhaseTransition(
    sourcePhase: number,
    targetPhase: number,
    sourceData: any,
    targetExpectedStructure: any,
    options: {
      verbose?: boolean;
      generateReport?: boolean;
      autoFix?: boolean;
    } = {}
  ): Promise<{
    issues: DataIntegrationIssue[];
    dataFlowTrace: DataFlowTrace[];
    phaseAnalysis: PhaseStateAnalysis[];
    suggestedFixes: string[];
    canProceed: boolean;
    reportPath?: string;
  }> {
    this.log(`🔍 Starting debug analysis: Phase ${sourcePhase} → Phase ${targetPhase}`);

    const issues: DataIntegrationIssue[] = [];
    const dataFlowTrace: DataFlowTrace[] = [];
    const phaseAnalysis: PhaseStateAnalysis[] = [];

    try {
      // 1. Analyze source phase completeness
      const sourceAnalysis = await this.analyzePhaseState(sourcePhase, sourceData);
      phaseAnalysis.push(sourceAnalysis);

      // 2. Trace data flow between phases
      const trace = await this.traceDataFlow(sourcePhase, targetPhase, sourceData, targetExpectedStructure);
      dataFlowTrace.push(trace);

      // 3. Identify structure mismatches
      const structureIssues = await this.identifyStructureMismatches(sourceData, targetExpectedStructure, sourcePhase, targetPhase);
      issues.push(...structureIssues);

      // 4. Check for race conditions
      const raceConditionIssues = await this.checkRaceConditions(sourcePhase, sourceData);
      issues.push(...raceConditionIssues);

      // 5. Validate state consistency
      const stateIssues = await this.validateStateConsistency(sourceData, sourcePhase);
      issues.push(...stateIssues);

      // 6. Generate suggested fixes
      const suggestedFixes = await this.generateFixes(issues, sourceData, targetExpectedStructure);

      // 7. Determine if pipeline can proceed
      const canProceed = this.canPipelineProceed(issues, sourceAnalysis);

      // 8. Generate report if requested
      let reportPath: string | undefined;
      if (options.generateReport) {
        reportPath = await this.generateDebugReport({
          issues,
          dataFlowTrace,
          phaseAnalysis,
          suggestedFixes,
          canProceed,
          sourcePhase,
          targetPhase,
          sourceData
        });
      }

      this.log(`✅ Debug analysis complete. Found ${issues.length} issues.`);

      return {
        issues,
        dataFlowTrace,
        phaseAnalysis,
        suggestedFixes,
        canProceed,
        reportPath
      };

    } catch (error) {
      this.log(`❌ Debug analysis failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Specialized debugging for the current Phase 1 → Phase 2 enrichedPacks issue
   */
  async debugEnrichedPacksIssue(phase1Data: Phase1Data): Promise<DataIntegrationIssue[]> {
    this.log('🔧 Debugging enrichedPacks data flow issue...');

    const issues: DataIntegrationIssue[] = [];

    // Check all possible locations for enrichedPacks
    const locations = {
      'deepAnalysisResult.enrichedPacks': phase1Data.deepAnalysisResult?.enrichedPacks,
      'metadataResult.enrichedPacks': phase1Data.metadataResult?.enrichedPacks,
      'indexingResult.allFiles': phase1Data.indexingResult?.allFiles
    };

    this.log('📊 EnrichedPacks locations analysis:');
    for (const [location, data] of Object.entries(locations)) {
      const exists = !!data;
      const length = Array.isArray(data) ? data.length : 0;
      this.log(`  - ${location}: ${exists ? `EXISTS (${length} items)` : 'MISSING'}`);
    }

    // Issue 1: metadataResult.enrichedPacks is missing but deepAnalysisResult has data
    if (!phase1Data.metadataResult?.enrichedPacks && phase1Data.deepAnalysisResult?.enrichedPacks?.length > 0) {
      issues.push({
        id: 'enriched-packs-location-mismatch',
        phase: 1,
        severity: 'error',
        category: 'structure_mismatch',
        title: 'EnrichedPacks in wrong location',
        description: 'Phase2 expects enrichedPacks in metadataResult but they are in deepAnalysisResult',
        affectedField: 'metadataResult.enrichedPacks',
        expectedStructure: { metadataResult: { enrichedPacks: 'EnrichedPack[]' } },
        actualStructure: {
          deepAnalysisResult: { enrichedPacks: phase1Data.deepAnalysisResult.enrichedPacks.length },
          metadataResult: { enrichedPacks: 'undefined' }
        },
        suggestedFix: 'Copy enrichedPacks from deepAnalysisResult to metadataResult, or update Phase2 validation',
        diagnosticData: {
          deepAnalysisCount: phase1Data.deepAnalysisResult.enrichedPacks.length,
          metadataResultExists: !!phase1Data.metadataResult,
          workingPath: phase1Data.workingPath
        },
        timestamp: Date.now()
      });
    }

    // Issue 2: metadataResult is completely missing
    if (!phase1Data.metadataResult) {
      issues.push({
        id: 'metadata-result-missing',
        phase: 1,
        severity: 'critical',
        category: 'missing_data',
        title: 'MetadataResult completely missing',
        description: 'Phase1 did not generate metadataResult, Phase2 cannot proceed',
        affectedField: 'metadataResult',
        expectedStructure: { metadataResult: { enrichedPacks: 'EnrichedPack[]', processedFiles: 'number' } },
        actualStructure: { metadataResult: 'undefined' },
        suggestedFix: 'Ensure Phase1 Step3 (MetadataExtractor) completes successfully',
        diagnosticData: {
          hasDeepAnalysis: !!phase1Data.deepAnalysisResult,
          hasIndexing: !!phase1Data.indexingResult,
          workingPath: phase1Data.workingPath
        },
        timestamp: Date.now()
      });
    }

    // Issue 3: Empty enrichedPacks array
    if (phase1Data.metadataResult?.enrichedPacks?.length === 0 && phase1Data.deepAnalysisResult?.enrichedPacks?.length === 0) {
      issues.push({
        id: 'no-enriched-packs',
        phase: 1,
        severity: 'warning',
        category: 'missing_data',
        title: 'No enriched packs generated',
        description: 'Phase1 completed but no packs were enriched with metadata',
        affectedField: 'enrichedPacks',
        expectedStructure: { enrichedPacks: 'EnrichedPack[] (length > 0)' },
        actualStructure: { enrichedPacks: 'empty array' },
        suggestedFix: 'Check Phase1 metadata extraction step for errors or empty source directory',
        diagnosticData: {
          totalFiles: phase1Data.indexingResult?.allFiles?.length || 0,
          totalPacks: phase1Data.deepAnalysisResult?.totalPacks || 0,
          workingPath: phase1Data.workingPath
        },
        timestamp: Date.now()
      });
    }

    this.issueHistory.push(...issues);
    return issues;
  }

  /**
   * Analyze the completeness and integrity of a phase's state
   */
  private async analyzePhaseState(phase: number, data: any): Promise<PhaseStateAnalysis> {
    this.log(`📋 Analyzing Phase ${phase} state...`);

    const analysis: PhaseStateAnalysis = {
      phase,
      isComplete: false,
      userActionRequired: false,
      missingFields: [],
      extraFields: [],
      dataIntegrityScore: 0,
      canProceedToNext: false,
      blockers: []
    };

    if (phase === 1) {
      const phase1Data = data as Phase1Data;

      // Check required fields
      const requiredFields = ['workingPath', 'deepAnalysisResult', 'indexingResult'];
      for (const field of requiredFields) {
        if (!phase1Data[field as keyof Phase1Data]) {
          analysis.missingFields.push(field);
          analysis.blockers.push(`Missing required field: ${field}`);
        }
      }

      // Check enrichedPacks availability
      const hasEnrichedPacks = !!(phase1Data.metadataResult?.enrichedPacks?.length ||
                                  phase1Data.deepAnalysisResult?.enrichedPacks?.length);
      if (!hasEnrichedPacks) {
        analysis.blockers.push('No enriched packs available for classification');
      }

      // Calculate integrity score
      const totalRequiredFields = requiredFields.length + 1; // +1 for enrichedPacks
      const satisfiedFields = requiredFields.length - analysis.missingFields.length + (hasEnrichedPacks ? 1 : 0);
      analysis.dataIntegrityScore = satisfiedFields / totalRequiredFields;

      analysis.isComplete = analysis.missingFields.length === 0 && hasEnrichedPacks;
      analysis.canProceedToNext = analysis.isComplete && analysis.blockers.length === 0;
    }

    return analysis;
  }

  /**
   * Trace how data flows from source phase to target phase
   */
  private async traceDataFlow(
    sourcePhase: number,
    targetPhase: number,
    sourceData: any,
    targetExpectedStructure: any
  ): Promise<DataFlowTrace> {
    this.log(`🔗 Tracing data flow: Phase ${sourcePhase} → Phase ${targetPhase}`);

    const trace: DataFlowTrace = {
      sourcePhase,
      targetPhase,
      dataPath: [],
      expectedType: '',
      actualType: '',
      isPresent: false,
      transformations: [],
      issues: []
    };

    if (sourcePhase === 1 && targetPhase === 2) {
      // Phase 1 → Phase 2: enrichedPacks flow
      trace.dataPath = ['metadataResult', 'enrichedPacks'];
      trace.expectedType = 'EnrichedPack[]';

      const actualData = sourceData.metadataResult?.enrichedPacks;
      trace.actualType = actualData ? `${actualData.constructor.name}[${actualData.length}]` : 'undefined';
      trace.isPresent = !!actualData && Array.isArray(actualData) && actualData.length > 0;

      // Document transformations that should happen
      trace.transformations = [
        'Phase1 Step3 MetadataExtractor generates enrichedPacks',
        'enrichedPacks stored in metadataResult',
        'Phase2 reads enrichedPacks from input.metadataResult.enrichedPacks',
        'Phase2 validates presence and non-empty array'
      ];

      // Check for alternative data paths
      if (!trace.isPresent && sourceData.deepAnalysisResult?.enrichedPacks) {
        trace.issues.push({
          id: 'alternative-data-path',
          phase: sourcePhase,
          severity: 'warning',
          category: 'structure_mismatch',
          title: 'Data available in alternative location',
          description: 'enrichedPacks found in deepAnalysisResult instead of metadataResult',
          affectedField: 'enrichedPacks',
          expectedStructure: { path: trace.dataPath },
          actualStructure: { path: ['deepAnalysisResult', 'enrichedPacks'] },
          suggestedFix: 'Update Phase1Controller to ensure data consistency or Phase2 to check alternative locations',
          diagnosticData: {
            alternativeCount: sourceData.deepAnalysisResult.enrichedPacks.length,
            expectedPath: trace.dataPath.join('.'),
            actualPath: 'deepAnalysisResult.enrichedPacks'
          },
          timestamp: Date.now()
        });
      }
    }

    return trace;
  }

  /**
   * Identify structure mismatches between what's provided and what's expected
   */
  private async identifyStructureMismatches(
    sourceData: any,
    expectedStructure: any,
    sourcePhase: number,
    targetPhase: number
  ): Promise<DataIntegrationIssue[]> {
    this.log(`🔍 Identifying structure mismatches between Phase ${sourcePhase} and ${targetPhase}...`);

    const issues: DataIntegrationIssue[] = [];

    // For Phase 1 → Phase 2 transition
    if (sourcePhase === 1 && targetPhase === 2) {
      const phase1Data = sourceData as Phase1Data;

      // Check if metadataResult structure matches expectation
      if (phase1Data.metadataResult) {
        const expected = ['processedFiles', 'audioMetadata', 'presetMetadata', 'enrichedPacks', 'extractedTags'];
        const actual = Object.keys(phase1Data.metadataResult);

        const missing = expected.filter(key => !(key in phase1Data.metadataResult!));
        const extra = actual.filter(key => !expected.includes(key));

        if (missing.length > 0 || extra.length > 0) {
          issues.push({
            id: 'metadata-result-structure-mismatch',
            phase: sourcePhase,
            severity: missing.includes('enrichedPacks') ? 'error' : 'warning',
            category: 'structure_mismatch',
            title: 'MetadataResult structure mismatch',
            description: `MetadataResult structure doesn't match expected interface`,
            affectedField: 'metadataResult',
            expectedStructure: expected,
            actualStructure: { present: actual, missing, extra },
            suggestedFix: 'Ensure Phase1 Step3 generates complete metadataResult structure',
            diagnosticData: { missing, extra, actual },
            timestamp: Date.now()
          });
        }
      }

      // Check enrichedPacks structure if present
      const enrichedPacks = phase1Data.metadataResult?.enrichedPacks || phase1Data.deepAnalysisResult?.enrichedPacks;
      if (enrichedPacks && enrichedPacks.length > 0) {
        const firstPack = enrichedPacks[0];
        const expectedPackFields = ['packId', 'originalPack', 'files', 'metadata', 'tags'];
        const actualPackFields = Object.keys(firstPack);

        const missingPackFields = expectedPackFields.filter(field => !(field in firstPack));
        if (missingPackFields.length > 0) {
          issues.push({
            id: 'enriched-pack-structure-incomplete',
            phase: sourcePhase,
            severity: 'warning',
            category: 'structure_mismatch',
            title: 'EnrichedPack structure incomplete',
            description: `EnrichedPack objects missing expected fields: ${missingPackFields.join(', ')}`,
            affectedField: 'enrichedPacks[].structure',
            expectedStructure: expectedPackFields,
            actualStructure: actualPackFields,
            suggestedFix: 'Update Phase1 metadata extraction to include all required fields',
            diagnosticData: { missingPackFields, samplePack: firstPack },
            timestamp: Date.now()
          });
        }
      }
    }

    return issues;
  }

  /**
   * Check for potential race conditions in phase transitions
   */
  private async checkRaceConditions(sourcePhase: number, sourceData: any): Promise<DataIntegrationIssue[]> {
    this.log(`⚡ Checking for race conditions in Phase ${sourcePhase}...`);

    const issues: DataIntegrationIssue[] = [];

    if (sourcePhase === 1) {
      const phase1Data = sourceData as Phase1Data;

      // Check if Phase1 appears to have completed prematurely
      const hasQuickComplete = (
        !!phase1Data.deepAnalysisResult &&
        !!phase1Data.indexingResult &&
        !phase1Data.metadataResult
      );

      if (hasQuickComplete) {
        issues.push({
          id: 'phase1-premature-completion',
          phase: sourcePhase,
          severity: 'error',
          category: 'race_condition',
          title: 'Phase1 completed without metadata extraction',
          description: 'Phase1 has structure and indexing results but missing metadata, suggesting premature completion',
          affectedField: 'metadataResult',
          expectedStructure: 'Complete Phase1Data with all steps',
          actualStructure: 'Partial Phase1Data missing Step3 results',
          suggestedFix: 'Ensure Phase1Controller waits for all steps to complete before proceeding',
          diagnosticData: {
            hasDeepAnalysis: !!phase1Data.deepAnalysisResult,
            hasIndexing: !!phase1Data.indexingResult,
            hasMetadata: !!phase1Data.metadataResult,
            summary: phase1Data.summary
          },
          timestamp: Date.now()
        });
      }

      // Check for userActionRequired flag bypassing
      if (phase1Data.indexingResult?.duplicateStrategy === 'MANUAL_REVIEW' &&
          phase1Data.indexingResult?.duplicates?.length > 0 &&
          !phase1Data.indexingResult?.filesToDelete) {
        issues.push({
          id: 'user-action-bypassed',
          phase: sourcePhase,
          severity: 'warning',
          category: 'race_condition',
          title: 'Duplicate handling requires user action',
          description: 'Phase1 found duplicates requiring manual review but proceeded without user input',
          affectedField: 'duplicateStrategy',
          expectedStructure: 'User choice for duplicate handling',
          actualStructure: 'MANUAL_REVIEW strategy without resolution',
          suggestedFix: 'Pause pipeline for user action when duplicates require manual review',
          diagnosticData: {
            duplicateCount: phase1Data.indexingResult.duplicates.length,
            strategy: phase1Data.indexingResult.duplicateStrategy,
            hasResolution: !!phase1Data.indexingResult.filesToDelete
          },
          timestamp: Date.now()
        });
      }
    }

    return issues;
  }

  /**
   * Validate internal state consistency within a phase
   */
  private async validateStateConsistency(sourceData: any, phase: number): Promise<DataIntegrationIssue[]> {
    this.log(`🔧 Validating state consistency for Phase ${phase}...`);

    const issues: DataIntegrationIssue[] = [];

    if (phase === 1) {
      const phase1Data = sourceData as Phase1Data;

      // Check consistency between deepAnalysisResult and metadataResult enrichedPacks
      const deepPacks = phase1Data.deepAnalysisResult?.enrichedPacks;
      const metaPacks = phase1Data.metadataResult?.enrichedPacks;

      if (deepPacks && metaPacks && deepPacks.length !== metaPacks.length) {
        issues.push({
          id: 'enriched-packs-count-inconsistency',
          phase,
          severity: 'warning',
          category: 'state_inconsistency',
          title: 'Inconsistent enrichedPacks count',
          description: `deepAnalysisResult has ${deepPacks.length} enrichedPacks but metadataResult has ${metaPacks.length}`,
          affectedField: 'enrichedPacks.length',
          expectedStructure: 'Same count in both locations',
          actualStructure: { deep: deepPacks.length, meta: metaPacks.length },
          suggestedFix: 'Ensure enrichedPacks are synchronized between deepAnalysisResult and metadataResult',
          diagnosticData: { deepCount: deepPacks.length, metaCount: metaPacks.length },
          timestamp: Date.now()
        });
      }

      // Check file count consistency
      const totalFiles = phase1Data.deepAnalysisResult?.totalFiles;
      const indexedFiles = phase1Data.indexingResult?.allFiles?.length;
      const processedFiles = phase1Data.metadataResult?.processedFiles;

      if (totalFiles && indexedFiles && totalFiles !== indexedFiles) {
        issues.push({
          id: 'file-count-inconsistency',
          phase,
          severity: 'warning',
          category: 'state_inconsistency',
          title: 'File count mismatch between steps',
          description: `Structure analysis found ${totalFiles} files but indexing processed ${indexedFiles}`,
          affectedField: 'totalFiles vs indexedFiles',
          expectedStructure: 'Consistent file counts',
          actualStructure: { structure: totalFiles, indexed: indexedFiles, processed: processedFiles },
          suggestedFix: 'Investigate file filtering differences between Phase1 steps',
          diagnosticData: { totalFiles, indexedFiles, processedFiles },
          timestamp: Date.now()
        });
      }
    }

    return issues;
  }

  /**
   * Generate specific fix suggestions based on identified issues
   */
  private async generateFixes(
    issues: DataIntegrationIssue[],
    sourceData: any,
    targetExpectedStructure: any
  ): Promise<string[]> {
    this.log(`🔧 Generating fix suggestions for ${issues.length} issues...`);

    const fixes: string[] = [];

    for (const issue of issues) {
      switch (issue.id) {
        case 'enriched-packs-location-mismatch':
          fixes.push(
            'IMMEDIATE FIX: In Phase1Controller, ensure metadataResult.enrichedPacks is populated when deepAnalysisResult.enrichedPacks exists',
            'ALTERNATIVE: Update Phase2Controller validation to check both locations: input.metadataResult?.enrichedPacks || input.deepAnalysisResult?.enrichedPacks'
          );
          break;

        case 'metadata-result-missing':
          fixes.push(
            'CHECK: Verify Phase1 Step3 (MetadataExtractor) is being called and completing successfully',
            'FALLBACK: Implement getEmptyMetadata() fallback with enrichedPacks from deepAnalysisResult'
          );
          break;

        case 'phase1-premature-completion':
          fixes.push(
            'ASYNC FIX: Ensure Phase1Controller awaits all step promises sequentially',
            'VALIDATION: Add completion checks before building final Phase1Data'
          );
          break;

        case 'user-action-bypassed':
          fixes.push(
            'PAUSE PIPELINE: Return requiresUserAction=true when duplicates need manual review',
            'UI UPDATE: Implement duplicate resolution UI before proceeding to Phase2'
          );
          break;
      }
    }

    // Generic fixes based on severity
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    const errorIssues = issues.filter(i => i.severity === 'error');

    if (criticalIssues.length > 0) {
      fixes.unshift('CRITICAL: Pipeline must be halted until critical issues are resolved');
    }

    if (errorIssues.length > 0) {
      fixes.push('ERROR HANDLING: Implement fallback data recovery mechanisms');
    }

    return [...new Set(fixes)]; // Remove duplicates
  }

  /**
   * Determine if the pipeline can safely proceed to the next phase
   */
  private canPipelineProceed(issues: DataIntegrationIssue[], phaseAnalysis: PhaseStateAnalysis): boolean {
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const errorIssues = issues.filter(i => i.severity === 'error').length;

    return criticalIssues === 0 && errorIssues === 0 && phaseAnalysis.canProceedToNext;
  }

  /**
   * Generate a comprehensive debug report
   */
  private async generateDebugReport(data: {
    issues: DataIntegrationIssue[];
    dataFlowTrace: DataFlowTrace[];
    phaseAnalysis: PhaseStateAnalysis[];
    suggestedFixes: string[];
    canProceed: boolean;
    sourcePhase: number;
    targetPhase: number;
    sourceData: any;
  }): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(process.cwd(), 'debug-reports', `phase-integration-debug-${timestamp}.json`);

    const report = {
      generatedAt: new Date().toISOString(),
      debugger: 'PhaseDataIntegrationDebugger',
      version: '1.0.0',
      transition: `Phase ${data.sourcePhase} → Phase ${data.targetPhase}`,
      summary: {
        totalIssues: data.issues.length,
        criticalIssues: data.issues.filter(i => i.severity === 'critical').length,
        errorIssues: data.issues.filter(i => i.severity === 'error').length,
        warningIssues: data.issues.filter(i => i.severity === 'warning').length,
        canProceed: data.canProceed,
        dataIntegrityScore: data.phaseAnalysis[0]?.dataIntegrityScore || 0
      },
      issues: data.issues,
      dataFlowTrace: data.dataFlowTrace,
      phaseAnalysis: data.phaseAnalysis,
      suggestedFixes: data.suggestedFixes,
      sourceDataStructure: this.analyzeDataStructure(data.sourceData),
      logs: this.logBuffer,
      diagnostics: {
        memoryUsage: process.memoryUsage(),
        timestamp: Date.now(),
        nodeVersion: process.version,
        platform: process.platform
      }
    };

    // Ensure directory exists
    await fs.mkdir(path.dirname(reportPath), { recursive: true });

    // Write report
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');

    this.log(`📄 Debug report generated: ${reportPath}`);
    return reportPath;
  }

  /**
   * Analyze the structure of data for reporting
   */
  private analyzeDataStructure(data: any): any {
    if (!data || typeof data !== 'object') {
      return { type: typeof data, value: data };
    }

    const structure: any = {};

    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        structure[key] = {
          type: 'array',
          length: value.length,
          firstElementType: value.length > 0 ? typeof value[0] : 'undefined',
          sample: value.length > 0 ? this.analyzeDataStructure(value[0]) : null
        };
      } else if (value && typeof value === 'object') {
        structure[key] = {
          type: 'object',
          keys: Object.keys(value),
          hasData: Object.keys(value).length > 0
        };
      } else {
        structure[key] = {
          type: typeof value,
          hasValue: value !== null && value !== undefined
        };
      }
    }

    return structure;
  }

  /**
   * Utility method to apply automatic fixes where possible
   */
  async applyAutomaticFixes(
    issues: DataIntegrationIssue[],
    sourceData: any
  ): Promise<{ fixed: DataIntegrationIssue[]; remaining: DataIntegrationIssue[] }> {
    this.log('🔧 Applying automatic fixes...');

    const fixed: DataIntegrationIssue[] = [];
    const remaining: DataIntegrationIssue[] = [];

    for (const issue of issues) {
      let canAutoFix = false;

      switch (issue.id) {
        case 'enriched-packs-location-mismatch':
          // Auto-fix: Copy enrichedPacks from deepAnalysisResult to metadataResult
          if (sourceData.deepAnalysisResult?.enrichedPacks && !sourceData.metadataResult?.enrichedPacks) {
            if (!sourceData.metadataResult) {
              sourceData.metadataResult = { enrichedPacks: [], processedFiles: 0, audioMetadata: new Map(), presetMetadata: new Map(), extractedTags: {} };
            }
            sourceData.metadataResult.enrichedPacks = sourceData.deepAnalysisResult.enrichedPacks;
            canAutoFix = true;
            this.log(`✅ Auto-fixed: Copied ${sourceData.deepAnalysisResult.enrichedPacks.length} enrichedPacks to metadataResult`);
          }
          break;
      }

      if (canAutoFix) {
        fixed.push(issue);
      } else {
        remaining.push(issue);
      }
    }

    this.log(`🔧 Auto-fix complete: ${fixed.length} fixed, ${remaining.length} remaining`);
    return { fixed, remaining };
  }

  /**
   * Simple logging utility
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    this.logBuffer.push(logMessage);

    // Keep log buffer manageable
    if (this.logBuffer.length > 1000) {
      this.logBuffer = this.logBuffer.slice(-500);
    }
  }

  /**
   * Clear the debugger state
   */
  clearHistory(): void {
    this.logBuffer = [];
    this.issueHistory = [];
  }

  /**
   * Get debug statistics
   */
  getStatistics(): {
    totalIssuesDetected: number;
    issuesByCategory: Record<string, number>;
    issuesBySeverity: Record<string, number>;
    recentLogs: string[];
  } {
    const issuesByCategory = this.issueHistory.reduce((acc, issue) => {
      acc[issue.category] = (acc[issue.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const issuesBySeverity = this.issueHistory.reduce((acc, issue) => {
      acc[issue.severity] = (acc[issue.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalIssuesDetected: this.issueHistory.length,
      issuesByCategory,
      issuesBySeverity,
      recentLogs: this.logBuffer.slice(-20)
    };
  }
}

/**
 * Factory function to create and configure the debugger
 */
export function createPhaseDataIntegrationDebugger(): PhaseDataIntegrationDebugger {
  return new PhaseDataIntegrationDebugger();
}

/**
 * Convenience function for debugging the specific Phase 1 → Phase 2 issue
 */
export async function debugPhase1ToPhase2Transition(
  phase1Data: Phase1Data,
  options: { autoFix?: boolean; generateReport?: boolean } = {}
): Promise<{
  issues: DataIntegrationIssue[];
  canProceed: boolean;
  autoFixed?: { fixed: DataIntegrationIssue[]; remaining: DataIntegrationIssue[] };
  reportPath?: string;
}> {
  const phaseDebugger = createPhaseDataIntegrationDebugger();

  // First, debug the specific enrichedPacks issue
  const enrichedPacksIssues = await phaseDebugger.debugEnrichedPacksIssue(phase1Data);

  // Then do full transition analysis
  const fullAnalysis = await phaseDebugger.debugPhaseTransition(
    1, 2, phase1Data,
    { metadataResult: { enrichedPacks: 'EnrichedPack[]' } },
    options
  );

  let autoFixed;
  if (options.autoFix) {
    autoFixed = await phaseDebugger.applyAutomaticFixes(fullAnalysis.issues, phase1Data);
  }

  return {
    issues: [...enrichedPacksIssues, ...fullAnalysis.issues],
    canProceed: fullAnalysis.canProceed,
    autoFixed,
    reportPath: fullAnalysis.reportPath
  };
}
