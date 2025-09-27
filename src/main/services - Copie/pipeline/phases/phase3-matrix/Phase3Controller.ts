/**
 * Phase3Controller - Contrôleur pour Phase 3 Matrix & Structure
 * Orchestre Step1_MatrixGenerator et Step2_StructureProposal
 */

import type { StepExecutor, StepResult, ValidationResult, ProgressCallback } from '@shared/interfaces/StepContracts';
import type { Phase2Data, Phase3Data } from '@shared/interfaces/PipelineTypes';
import type {
  MatrixGenerationInput,
  MatrixGenerationOutput,
  StructureProposalInput,
  StructureProposalOutput,
  Phase3Summary
} from './Phase3Types';
import type { ClassifiedPack } from '@shared/interfaces/BusinessTypes';

import { Step1_MatrixGenerator } from './Step1_MatrixGenerator';
import { Step2_StructureProposal } from './Step2_StructureProposal';
import * as path from 'path';

/**
 * Configuration pour Phase 3
 */
export interface Phase3Config {
  taxonomyPath?: string;

  // Config MatrixGenerator
  matrixConfig?: {
    minPackCountForEntry?: number;
    minConfidenceThreshold?: number;
    maxDiscoveredPatterns?: number;
    enableContextDetection?: boolean;
    taxonomyRequired?: boolean;
  };

  // Config StructureProposal
  proposalConfig?: {
    maxProposals?: number;
    minFilesPerFolder?: number;
    maxFilesPerFolder?: number;
    balanceWeight?: number;
    compatibilityWeight?: number;
    simplicityWeight?: number;
  };
}

/**
 * Contrôleur Phase 3 - Matrix & Structure
 */
export class Phase3Controller implements StepExecutor<Phase2Data, Phase3Data> {
  private readonly config: Phase3Config;
  private readonly matrixGenerator: Step1_MatrixGenerator;
  private readonly structureProposal: Step2_StructureProposal;

  constructor(config: Phase3Config = {}) {
    this.config = config;

    this.matrixGenerator = new Step1_MatrixGenerator(config.matrixConfig);
    this.structureProposal = new Step2_StructureProposal(config.proposalConfig);
  }

  /**
   * Exécute Phase 3 : Matrix Generation + Structure Proposal
   */
  async execute(
    input: Phase2Data,
    onProgress?: ProgressCallback
  ): Promise<StepResult<Phase3Data>> {
    const phaseStartTime = Date.now();

    try {
      console.log('🚀 [Phase3Controller] Starting Phase 3 - Matrix & Structure');

      // Validation des données d'entrée
      const validation = this.validate(input);
      if (!validation.valid) {
        console.error('❌ [Phase3Controller] Validation failed:', validation.errors);
        return {
          success: false,
          error: {
            code: 'PHASE3_VALIDATION_FAILED',
            message: `Phase 3 validation failed: ${validation.errors.join('; ')}`,
            recoverable: false
          },
          canProceed: false
        };
      }

      onProgress?.(5, 'Initialisation Phase 3...');

      // ============================================
      // STEP 1 - MATRIX GENERATION
      // ============================================
      onProgress?.(10, 'Étape 1: Génération de la matrice adaptative...');

      console.log(`📊 [Phase3Controller] Step 1: Generating matrix from ${input.classification.classifiedPacks.length} classified packs`);

      const matrixInput: MatrixGenerationInput = {
        classifiedPacks: input.classification.classifiedPacks,
        taxonomyPath: this.config.taxonomyPath
      };

      const matrixResult = await this.matrixGenerator.execute(matrixInput, (progress, message) => {
        const adjustedProgress = 10 + Math.floor(progress * 0.4); // 10-50%
        onProgress?.(adjustedProgress, `Step 1: ${message || 'Génération matrice...'}`);
      });

      if (!matrixResult.success || !matrixResult.data) {
        console.error('❌ [Phase3Controller] Matrix generation failed:', matrixResult.error);
        return {
          success: false,
          error: {
            code: 'MATRIX_GENERATION_FAILED',
            message: `Matrix generation failed: ${matrixResult.error?.message || 'Unknown error'}`,
            recoverable: matrixResult.error?.recoverable || false
          },
          canProceed: false,
          userActionRequired: matrixResult.userActionRequired
        };
      }

      const matrixData = matrixResult.data;
      console.log(`✅ [Phase3Controller] Matrix generated: ${matrixData.statistics.totalEntries} entries, ${matrixData.statistics.uniqueFamilies} families`);

      onProgress?.(50, 'Matrice générée avec succès');

      // ============================================
      // STEP 2 - STRUCTURE PROPOSAL
      // ============================================
      onProgress?.(55, 'Étape 2: Génération des propositions de structure...');

      console.log(`🏗️ [Phase3Controller] Step 2: Generating structure proposals`);

      const structureInput: StructureProposalInput = {
        adaptiveMatrix: matrixData.adaptiveMatrix,
        classifiedPacks: input.classification.classifiedPacks,
        statistics: matrixData.statistics
      };

      const structureResult = await this.structureProposal.execute(structureInput, (progress, message) => {
        const adjustedProgress = 55 + Math.floor(progress * 0.35); // 55-90%
        onProgress?.(adjustedProgress, `Step 2: ${message || 'Génération propositions...'}`);
      });

      if (!structureResult.success || !structureResult.data) {
        console.error('❌ [Phase3Controller] Structure proposal failed:', structureResult.error);
        return {
          success: false,
          error: {
            code: 'STRUCTURE_PROPOSAL_FAILED',
            message: `Structure proposal failed: ${structureResult.error?.message || 'Unknown error'}`,
            recoverable: structureResult.error?.recoverable || false
          },
          canProceed: false,
          userActionRequired: structureResult.userActionRequired
        };
      }

      const structureData = structureResult.data;
      console.log(`✅ [Phase3Controller] Generated ${structureData.proposals.length} structure proposals`);

      const phaseEndTime = Date.now();
      const phaseDuration = phaseEndTime - phaseStartTime;

      const summary = this.createSummary(
        phaseStartTime,
        phaseEndTime,
        input.classification.classifiedPacks,
        matrixData,
        structureData,
        structureData.recommendations.recommendedId
      );

      const phase3Data = this.buildPhase3Data(
        input.classification.classifiedPacks,
        matrixData,
        structureData,
        summary
      );

      if (structureResult.userActionRequired) {
        const userActionRequired = {
          ...structureResult.userActionRequired,
          defaultValue: {
            ...(structureResult.userActionRequired.defaultValue || {}),
            pendingState: {
              startTime: phaseStartTime,
              classification: input.classification,
              matrixData,
              structureData,
              summary
            }
          }
        };

        onProgress?.(95, 'En attente de validation utilisateur...');

        return {
          success: true,
          data: phase3Data,
          canProceed: false,
          userActionRequired,
          progress: 95
        };
      }

      onProgress?.(100, 'Phase 3 terminée avec succès');

      console.log(`🎉 [Phase3Controller] Phase 3 completed successfully in ${(phaseDuration / 1000).toFixed(2)}s`);

      return {
        success: true,
        data: phase3Data,
        canProceed: true,
        metrics: {
          startTime: phaseStartTime,
          endTime: phaseEndTime,
          itemsProcessed: input.classification.classifiedPacks.length,
          processingSpeed: input.classification.classifiedPacks.length / (phaseDuration / 1000),
          duration: phaseDuration
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ [Phase3Controller] Fatal error:', error);

      return {
        success: false,
        error: {
          code: 'PHASE3_FATAL_ERROR',
          message: `Phase 3 fatal error: ${errorMessage}`,
          recoverable: false,
          cause: error instanceof Error ? error.stack : undefined
        },
        canProceed: false
      };
    }
  }

  async resumeAfterUserAction(
    previousState: any,
    userChoice: any,
    onProgress?: ProgressCallback
  ): Promise<StepResult<Phase3Data>> {
    try {
      if (!previousState?.structureData || !previousState?.matrixData || !previousState?.classification) {
        return {
          success: false,
          error: {
            code: 'PHASE3_RESUME_INVALID_STATE',
            message: 'Invalid state received for Phase 3 user action resume'
          },
          canProceed: false
        };
      }

      const selectedStructureId: string = userChoice?.selectedStructureId
        || previousState.structureData.recommendations?.recommendedId;

      const duplicateStrategy = userChoice?.duplicateStrategy ?? 'merge';
      const duplicateResolutions = this.normalizeDuplicateResolutions(userChoice?.duplicateResolutions);

      const selectedProposal = previousState.structureData.proposals.find((proposal: any) => proposal.id === selectedStructureId);
      if (!selectedProposal) {
        return {
          success: false,
          error: {
            code: 'PHASE3_RESUME_INVALID_SELECTION',
            message: `Aucune proposition ne correspond à l'identifiant ${selectedStructureId}`
          },
          canProceed: false
        };
      }

      onProgress?.(60, 'Application de la structure sélectionnée...');

      const endTime = Date.now();
      const summary = this.createSummary(
        previousState.startTime || endTime,
        endTime,
        previousState.classification.classifiedPacks,
        previousState.matrixData,
        previousState.structureData,
        selectedStructureId
      );

      const phase3Data = this.buildPhase3Data(
        previousState.classification.classifiedPacks,
        previousState.matrixData,
        previousState.structureData,
        summary,
        {
          selectedStructureId,
          duplicateStrategy,
          duplicateResolutions
        }
      );

      onProgress?.(100, 'Structure validée');

      return {
        success: true,
        data: phase3Data,
        canProceed: true,
        progress: 100
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ [Phase3Controller] Resume after user action failed:', error);

      return {
        success: false,
        error: {
          code: 'PHASE3_RESUME_FAILED',
          message
        },
        canProceed: false
      };
    }
  }

  private buildPhase3Data(
    classifiedPacks: ClassifiedPack[],
    matrixData: MatrixGenerationOutput,
    structureData: StructureProposalOutput,
    summary: Phase3Summary,
    userChoice?: {
      selectedStructureId: string;
      duplicateStrategy: 'merge' | 'keep-best' | 'keep-all' | 'manual';
      duplicateResolutions: Map<string, string>;
    }
  ): Phase3Data {
    const workingPath = this.extractWorkingPathFromPacks(classifiedPacks);
    return {
      classifiedPacks,
      workingPath,
      matrixResult: {
        success: true,
        dimensions: {
          types: this.extractDimensions(matrixData.adaptiveMatrix, 'type'),
          formats: this.extractDimensions(matrixData.adaptiveMatrix, 'function'),
          variations: this.extractDimensions(matrixData.adaptiveMatrix, 'variant')
        },
        statistics: {
          totalEntries: matrixData.statistics.totalEntries,
          uniqueFamilies: matrixData.statistics.uniqueFamilies,
          uniqueTypes: matrixData.statistics.uniqueTypes
        },
        totalDimensions: matrixData.statistics.totalEntries,
        matrixComplexity: matrixData.statistics.matrixComplexity,
        fusionGroups: matrixData.fusionGroups,
        folderClusters: matrixData.folderClusters
      },
      fusionGroups: this.transformFusionGroups(matrixData.fusionGroups || []),
      structureProposals: this.transformStructureProposals(structureData.proposals),
      userChoice: userChoice
        ? {
            selectedStructureId: userChoice.selectedStructureId,
            duplicateStrategy: userChoice.duplicateStrategy,
            duplicateResolutions: userChoice.duplicateResolutions
          }
        : undefined,
      duplicatesResult: {
        groups: [],
        totalDuplicates: 0,
        potentialSavings: 0
      },
      summary
    };
  }

  private extractWorkingPathFromPacks(classifiedPacks: ClassifiedPack[]): string | undefined {
    for (const pack of classifiedPacks) {
      const packPath = pack?.originalPack?.path;
      if (packPath) {
        return path.dirname(packPath);
      }
    }
    return undefined;
  }

  private transformStructureProposals(proposals: StructureProposalOutput['proposals']) {
    return proposals.map(proposal => ({
      id: proposal.id,
      name: proposal.name,
      description: proposal.description,
      targetStructure: {
        family: proposal.hierarchy.includes('Family'),
        type: proposal.hierarchy.includes('Type'),
        style: proposal.hierarchy.includes('Style'),
        maxDepth: proposal.maxDepth
      },
      structure: proposal.hierarchy,
      statistics: proposal.statistics ?? {
        estimatedFolders: proposal.estimatedFolders,
        estimatedFiles: Math.round(proposal.avgFilesPerFolder * proposal.estimatedFolders),
        fusionGroups: 0,
        duplicatesResolved: 0
      },
      estimatedFolders: proposal.estimatedFolders,
      advantages: proposal.advantages,
      disadvantages: proposal.disadvantages,
      preview: proposal.preview.map(node => ({
        path: node.path,
        example: node.examples.slice(0, 2).join(', ')
      })),
      score: proposal.compatibilityScore
    }));
  }

  private transformFusionGroups(fusionGroups: any[]) {
    return fusionGroups.map(group => ({
      id: group.id,
      canonical: group.canonical,
      confidence: group.confidence,
      classification: {
        family: group.classification.family,
        type: group.classification.type,
        style: group.classification.style
      },
      targetPath: group.targetPath,
      sourceFiles: group.sourceFiles.map((source: any) => ({
        packName: source.packName,
        originalPath: source.originalPath,
        fileCount: source.fileCount,
        estimatedSize: source.estimatedSize
      })),
      statistics: {
        totalFiles: group.statistics.totalFiles,
        totalSize: group.statistics.estimatedSize,
        packCount: group.statistics.totalPacks
      }
    }));
  }

  private createSummary(
    startTime: number,
    endTime: number,
    classifiedPacks: ClassifiedPack[],
    matrixData: MatrixGenerationOutput,
    structureData: StructureProposalOutput,
    selectedProposalId: string
  ): Phase3Summary {
    return {
      startTime,
      endTime,
      duration: endTime - startTime,
      totalPacks: classifiedPacks.length,
      matrixEntries: matrixData.statistics.totalEntries,
      proposalsGenerated: structureData.proposals.length,
      recommendedProposal: selectedProposalId,
      taxonomyCoverage: matrixData.statistics.taxonomyCoverage,
      estimatedComplexity: structureData.estimatedComplexity.organizationalComplexity,
      userDecisionPoints: structureData.estimatedComplexity.userDecisionPoints,
      fusionGroupsCreated: matrixData.fusionGroups?.length,
      errors: [],
      warnings: []
    };
  }

  private normalizeDuplicateResolutions(input: any): Map<string, string> {
    if (!input) {
      return new Map();
    }

    if (input instanceof Map) {
      return input;
    }

    if (Array.isArray(input)) {
      return new Map(input);
    }

    if (typeof input === 'object') {
      return new Map(Object.entries(input));
    }

    return new Map();
  }

  /**
   * Extrait les dimensions depuis la matrice pour l'interface Phase3Data
   */
  private extractDimensions(matrix: any, dimensionType: 'type' | 'function' | 'variant') {
    const dimensionMap = new Map<string, number>();

    for (const entry of Object.values(matrix) as any[]) {
      let values: string[] = [];

      switch (dimensionType) {
        case 'type':
          values = [entry.type];
          break;
        case 'function':
          values = entry.functions || [];
          break;
        case 'variant':
          values = entry.variants || [];
          break;
      }

      for (const value of values) {
        dimensionMap.set(value, (dimensionMap.get(value) || 0) + 1);
      }
    }

    return Array.from(dimensionMap.entries())
      .map(([name, count]) => ({
        name,
        count,
        confidence: Math.min(0.95, count / 10) // Confidence basée sur fréquence
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Validation des données d'entrée Phase 2
   */
  validate(input: Phase2Data): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Vérifier structure de base Phase2Data selon PipelineTypes.ts
    if (!input.classification) {
      errors.push('Missing classification data from Phase 2');
    } else {
      const classified = input.classification.classifiedPacks;
      if (!classified || classified.length === 0) {
        errors.push('No classified packs available for matrix generation');
      } else {
        let validClassifications = 0;
        for (const pack of classified) {
          if (pack.classification && pack.classification.confidence > 0) {
            validClassifications++;
          }
        }

        if (validClassifications === 0) {
          errors.push('No packs with valid classifications found');
        } else if (validClassifications < classified.length * 0.5) {
          warnings.push('Less than 50% of packs have valid classifications - matrix quality may be reduced');
        }

        console.log(`📊 [Phase3Controller] Validation: ${validClassifications}/${classified.length} packs with valid classifications`);
      }
    }

    // Vérifier summary et statistics
    if (!input.summary) {
      warnings.push('Missing summary from Phase 2');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      canProceedWithWarnings: true // Phase 3 peut fonctionner avec des warnings
    };
  }

  getName(): string {
    return 'Phase 3 - Matrix & Structure Controller';
  }

  getDescription(): string {
    return 'Génère la matrice adaptative et propose des structures d\'organisation hiérarchiques';
  }

  estimateTime(input: Phase2Data): number {
    const packCount = input.classification?.classifiedPacks?.length || 0;

    // Estimation combinée des 2 steps
    const matrixTime = this.matrixGenerator.estimateTime({
      classifiedPacks: input.classification?.classifiedPacks || []
    });

    const structureTime = 5; // Structure proposal est rapide

    return Math.max(10, matrixTime + structureTime + 2); // +2s overhead
  }

  canRetry(): boolean {
    return true;
  }
}
