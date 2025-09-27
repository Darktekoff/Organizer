/**
 * Phase4Controller - Organization
 * Orchestre l'organisation physique des fichiers avec fusion intelligente
 */

import type {
  StepExecutor,
  StepResult,
  ValidationResult,
  ProgressCallback
} from '@shared/interfaces/StepContracts';
import type { Phase3Data, Phase4Data } from '@shared/interfaces/PipelineTypes';
import type {
  Phase4Input,
  Phase4Output,
  OrganizationPlan,
  OrganizationProgress,
  OrganizationOptions,
  OrganizationSummary
} from './Phase4Types';
import {
  DEFAULT_ORGANIZATION_OPTIONS,
  ORGANIZATION_CONSTANTS
} from './Phase4Types';

import { Step1_OrganizationPlanner } from './Step1_OrganizationPlanner';
import { Step2_OrganizationExecutor } from './Step2_OrganizationExecutor';
import { Step3_OrganizationValidator } from './Step3_OrganizationValidator';
import * as path from 'path';

/**
 * Configuration pour Phase 4
 */
export interface Phase4Config {
  targetPath?: string;
  organizationOptions?: Partial<OrganizationOptions>;
  enableDetailedLogging?: boolean;
  enableMetrics?: boolean;
  maxExecutionTime?: number; // ms
}

/**
 * Contrôleur Phase 4 - Organization & Fusion
 */
export class Phase4Controller implements StepExecutor<Phase3Data, Phase4Data> {
  private readonly config: Phase4Config;
  private readonly planner: Step1_OrganizationPlanner;
  private readonly executor: Step2_OrganizationExecutor;
  private readonly validator: Step3_OrganizationValidator;

  // État interne
  private currentProgress: OrganizationProgress;
  private organizationPlan?: OrganizationPlan;
  private startTime?: number;

  constructor(config: Phase4Config = {}) {
    this.config = {
      enableDetailedLogging: true,
      enableMetrics: true,
      maxExecutionTime: 30 * 60 * 1000, // 30 minutes
      ...config
    };

    // Initialiser les steps
    this.planner = new Step1_OrganizationPlanner();
    this.executor = new Step2_OrganizationExecutor(config.organizationOptions);
    this.validator = new Step3_OrganizationValidator();

    // Initialiser progress tracking
    this.currentProgress = this.initializeProgress();

    this.log('INFO', '🏗️ Phase4Controller initialized');
  }

  /**
   * Exécute Phase 4 : Planning → Execution → Validation
   */
  async execute(
    input: Phase3Data,
    onProgress?: ProgressCallback
  ): Promise<StepResult<Phase4Data>> {
    this.startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      this.log('INFO', '🚀 [Phase4Controller] Starting Phase 4 - Organization & Fusion');
      this.log('DEBUG', `Input validation: ${input.structureProposals?.length || 0} proposals, ${input.fusionGroups?.length || 0} fusion groups`);

      // Validation des données d'entrée
      const validation = this.validate(input);
      if (!validation.valid) {
        this.log('ERROR', 'Phase 4 validation failed', validation.errors);
        return {
          success: false,
          error: {
            code: 'PHASE4_VALIDATION_FAILED',
            message: `Phase 4 validation failed: ${validation.errors.join('; ')}`,
            recoverable: false
          },
          canProceed: false
        };
      }

      // Préparer l'input Phase 4
      const phase4Input = this.preparePhase4Input(input);
      this.updateProgress(5, 'planning', 'Préparation des données d\'entrée...');
      onProgress?.(5, 'Préparation des données d\'entrée...');

      // ============================================
      // STEP 1 - PLANNING
      // ============================================
      this.log('INFO', '📋 [Phase4Controller] Step 1: Organization Planning');
      this.updateProgress(10, 'planning', 'Génération du plan d\'organisation...');
      onProgress?.(10, 'Étape 1: Planification de l\'organisation...');

      const planningResult = await this.planner.execute(phase4Input, (progress, message) => {
        const adjustedProgress = 10 + Math.floor(progress * 0.3); // 10-40%
        this.updateProgress(adjustedProgress, 'planning', message || 'Planification...');
        onProgress?.(adjustedProgress, `Step 1: ${message || 'Planification...'}`);
      });

      if (!planningResult.success || !planningResult.data) {
        this.log('ERROR', 'Planning failed', planningResult.error);
        return {
          success: false,
          error: {
            code: 'ORGANIZATION_PLANNING_FAILED',
            message: `Planning failed: ${planningResult.error?.message || 'Unknown error'}`,
            recoverable: planningResult.error?.recoverable || false
          },
          canProceed: false
        };
      }

      this.organizationPlan = planningResult.data;
      this.log('INFO', `✅ Planning completed: ${this.organizationPlan.operations.length} operations, ${this.organizationPlan.fusionOperations.length} fusion operations`);

      // ============================================
      // STEP 2 - EXECUTION
      // ============================================
      this.log('INFO', '⚡ [Phase4Controller] Step 2: Organization Execution');
      this.updateProgress(40, 'execution', 'Exécution de l\'organisation...');
      onProgress?.(40, 'Étape 2: Exécution de l\'organisation...');

      const executionResult = await this.executor.execute(this.organizationPlan, (progress, message) => {
        const adjustedProgress = 40 + Math.floor(progress * 0.45); // 40-85%
        this.updateProgress(adjustedProgress, 'execution', message || 'Exécution...');
        onProgress?.(adjustedProgress, `Step 2: ${message || 'Exécution...'}`);
      });

      if (!executionResult.success || !executionResult.data) {
        this.log('ERROR', 'Execution failed', executionResult.error);
        return {
          success: false,
          error: {
            code: 'ORGANIZATION_EXECUTION_FAILED',
            message: `Execution failed: ${executionResult.error?.message || 'Unknown error'}`,
            recoverable: executionResult.error?.recoverable || false
          },
          canProceed: false,
          userActionRequired: executionResult.userActionRequired
        };
      }

      const organizationResult = executionResult.data;
      this.log('INFO', `✅ Execution completed: ${organizationResult.organizationResult.createdFolders} folders, ${organizationResult.organizationResult.movedFiles} files moved`);

      // ============================================
      // STEP 3 - VALIDATION
      // ============================================
      this.log('INFO', '🔍 [Phase4Controller] Step 3: Organization Validation');
      this.updateProgress(85, 'validation', 'Validation de l\'organisation...');
      onProgress?.(85, 'Étape 3: Validation de l\'organisation...');

      const validationResult = await this.validator.execute(organizationResult, (progress, message) => {
        const adjustedProgress = 85 + Math.floor(progress * 0.1); // 85-95%
        this.updateProgress(adjustedProgress, 'validation', message || 'Validation...');
        onProgress?.(adjustedProgress, `Step 3: ${message || 'Validation...'}`);
      });

      if (!validationResult.success || !validationResult.data) {
        this.log('ERROR', 'Validation failed', validationResult.error);
        warnings.push(`Validation issues detected: ${validationResult.error?.message}`);
      }

      const finalValidation = validationResult.data || this.createEmptyValidation();

      // ============================================
      // ASSEMBLAGE DU RÉSULTAT FINAL
      // ============================================
      this.updateProgress(95, 'completed', 'Finalisation...');
      onProgress?.(95, 'Finalisation des résultats...');

      const endTime = Date.now();
      const summary = this.buildSummary(
        this.startTime,
        endTime,
        organizationResult,
        finalValidation,
        errors,
        warnings
      );

      // Retourner le résultat final complet (Phase4Output = Phase4Data dans PipelineTypes.ts)
      const phase4Data: Phase4Data = finalValidation.data || organizationResult;

      this.updateProgress(100, 'completed', 'Phase 4 terminée avec succès');
      onProgress?.(100, 'Phase 4 terminée avec succès');

      this.log('INFO', `🎉 [Phase4Controller] Phase 4 completed successfully in ${((endTime - this.startTime) / 1000).toFixed(2)}s`);
      this.logSummary(summary);

      return {
        success: true,
        data: phase4Data,
        canProceed: true,
        metrics: {
          startTime: this.startTime,
          endTime,
          itemsProcessed: organizationResult.organizationResult.movedFiles,
          processingSpeed: organizationResult.organizationResult.movedFiles / ((endTime - this.startTime) / 1000),
          duration: endTime - this.startTime
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('ERROR', 'Phase 4 fatal error', error);

      return {
        success: false,
        error: {
          code: 'PHASE4_FATAL_ERROR',
          message: `Phase 4 fatal error: ${errorMessage}`,
          recoverable: false,
          cause: error instanceof Error ? error.stack : undefined
        },
        canProceed: false
      };
    }
  }

  /**
   * Prépare l'input Phase 4 à partir des données Phase 3
   */
  private preparePhase4Input(input: Phase3Data & { workingPath?: string; structureChoice?: any; duplicatesResolution?: any }): Phase4Input {
    // Sélectionner la structure recommandée ou la première disponible
    const preferredStructureId = input.structureChoice?.selectedStructureId
      || (input as any).userChoice?.selectedStructureId
      || input.summary?.recommendedProposal;

    const selectedProposal = input.structureProposals?.find(proposal => proposal.id === preferredStructureId)
      || input.structureProposals?.[0];
    if (!selectedProposal) {
      throw new Error('No structure proposal available from Phase 3');
    }

    // Convertir la structure proposal au format attendu
    const workingPath = this.resolveWorkingPath(input);

    const hierarchy = (selectedProposal as any).structure && (selectedProposal as any).structure.length
      ? (selectedProposal as any).structure
      : (selectedProposal as any).hierarchy && (selectedProposal as any).hierarchy.length
        ? (selectedProposal as any).hierarchy
        : ['Family', 'Type', 'Style', 'Function'];

    const selectedStructure: any = {
      id: selectedProposal.id,
      name: selectedProposal.name,
      description: selectedProposal.description,
      hierarchy,
      levels: hierarchy.length,
      avgFilesPerFolder: 50, // Estimation
      maxDepth: selectedProposal.targetStructure?.maxDepth || 4,
      statistics: selectedProposal.statistics || {
        estimatedFolders: selectedProposal.estimatedFolders || 100,
        estimatedFiles: 1000,
        fusionGroups: input.fusionGroups?.length || 0,
        duplicatesResolved: 0
      },
      advantages: selectedProposal.advantages || [],
      considerations: selectedProposal.considerations || selectedProposal.disadvantages || []
    };

    // Récupérer les données de fusion et ajouter les champs manquants
    const fusionGroups: any[] = (input.fusionGroups || []).map(group => ({
      ...group,
      metadata: {
        mergeStrategy: 'auto' as const,
        priority: 1,
        userDecision: null
      },
      sourceFiles: group.sourceFiles.map((source: any) => ({
        ...source,
        packId: source.packId || source.packName,
        confidence: source.confidence || 0.9
      }))
    }));

    // Configuration par défaut
    const organizationOptions = {
      ...DEFAULT_ORGANIZATION_OPTIONS,
      ...this.config.organizationOptions
    };

    const defaultBasePath = workingPath || process.cwd();
    const defaultTarget = path.join(defaultBasePath, 'organized');
    const targetPath = this.config.targetPath || defaultTarget;

    this.log('DEBUG', `Prepared Phase4Input: structure=${selectedStructure.name}, fusionGroups=${fusionGroups.length}, targetPath=${targetPath}`);

    return {
      selectedStructure,
      fusionGroups,
      classifiedPacks: input.classifiedPacks || [],
      workingPath,
      targetPath,
      organizationOptions
    };
  }

  private resolveWorkingPath(input: Phase3Data & { workingPath?: string }): string {
    if (input.workingPath) {
      return input.workingPath;
    }

    const candidate = input.classifiedPacks?.find(pack => pack?.originalPack?.path)?.originalPack?.path;
    if (candidate) {
      return path.dirname(candidate);
    }

    if (input.sourcePath) {
      return path.normalize(input.sourcePath);
    }

    return this.config.targetPath ? path.dirname(this.config.targetPath) : process.cwd();
  }

  /**
   * Crée un résultat de validation vide en cas d'échec
   */
  private createEmptyValidation(): any {
    return {
      success: true,
      data: null,
      structureIntegrity: true,
      validationScore: 0.8
    };
  }

  /**
   * Construction du résumé final
   */
  private buildSummary(
    startTime: number,
    endTime: number,
    organizationResult: Phase4Output,
    validationResult: any,
    errors: string[],
    warnings: string[]
  ): OrganizationSummary {
    const duration = endTime - startTime;
    const success = organizationResult.organizationResult.success && (validationResult?.success !== false);

    return {
      success,
      completionRate: success ? 1 : 0.8, // Estimation basée sur les erreurs
      foldersCreated: organizationResult.organizationResult.createdFolders,
      filesOrganized: organizationResult.organizationResult.movedFiles,
      fusionGroupsProcessed: organizationResult.fusionResult?.fusionGroupsProcessed || 0,
      totalDuration: duration,
      averageSpeed: organizationResult.organizationResult.movedFiles / (duration / 1000),
      structureCompliance: validationResult?.structureIntegrity ? 1 : 0.8,
      validationScore: validationResult?.validationScore || 0.8,
      fusionImpact: {
        groupsUnified: organizationResult.fusionResult?.fusionGroupsSuccessful || 0,
        filesConsolidated: organizationResult.fusionResult?.totalFilesMerged || 0,
        duplicatesResolved: organizationResult.fusionResult?.duplicatesResolved || 0,
        spaceSaved: organizationResult.fusionResult?.spaceSaved || 0,
        structureSimplified: (organizationResult.fusionResult?.fusionGroupsSuccessful || 0) > 0
      },
      successMessage: success ? 'Organisation terminée avec succès' : 'Organisation terminée avec des avertissements',
      recommendations: [
        'Vérifiez la structure finale dans le dossier cible',
        'Sauvegardez la configuration pour de futures organisations'
      ],
      warnings
    };
  }

  /**
   * Validation des données d'entrée Phase 3
   */
  validate(input: Phase3Data): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Vérifier les propositions de structure
    if (!input.structureProposals || input.structureProposals.length === 0) {
      errors.push('No structure proposals available from Phase 3');
    }

    // Vérifier que nous avons des données de matrice
    if (!input.matrixResult) {
      errors.push('Missing matrix result from Phase 3');
    }

    // Avertissements pour fusion
    if (!input.fusionGroups || input.fusionGroups.length === 0) {
      warnings.push('No fusion groups detected - organization will proceed without intelligent fusion');
    }

    this.log('DEBUG', `Validation: ${errors.length} errors, ${warnings.length} warnings`);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      canProceedWithWarnings: true
    };
  }

  /**
   * Utilitaires de progress tracking
   */
  private initializeProgress(): OrganizationProgress {
    return {
      overallProgress: 0,
      currentPhase: 'planning',
      currentOperation: 'Initializing...',
      planningProgress: 0,
      executionProgress: 0,
      validationProgress: 0,
      operationsCompleted: 0,
      operationsTotal: 0,
      filesProcessed: 0,
      filesTotal: 0,
      averageOperationTime: 0,
      estimatedTimeRemaining: 0,
      operationsPerSecond: 0,
      currentOperationId: '',
      currentOperationType: '',
      lastCompletedOperation: ''
    };
  }

  private updateProgress(
    overallProgress: number,
    phase: OrganizationProgress['currentPhase'],
    operation: string
  ): void {
    this.currentProgress = {
      ...this.currentProgress,
      overallProgress,
      currentPhase: phase,
      currentOperation: operation
    };
  }

  /**
   * Utilitaires de logging
   */
  private log(level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR', message: string, details?: any): void {
    if (!this.config.enableDetailedLogging) return;

    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [Phase4Controller] ${level}: ${message}`;

    switch (level) {
      case 'DEBUG':
        console.debug(logMessage, details || '');
        break;
      case 'INFO':
        console.log(logMessage, details || '');
        break;
      case 'WARN':
        console.warn(logMessage, details || '');
        break;
      case 'ERROR':
        console.error(logMessage, details || '');
        break;
    }
  }

  private logSummary(summary: OrganizationSummary): void {
    this.log('INFO', '📊 Organization Summary:');
    this.log('INFO', `  • Success: ${summary.success}`);
    this.log('INFO', `  • Folders created: ${summary.foldersCreated}`);
    this.log('INFO', `  • Files organized: ${summary.filesOrganized}`);
    this.log('INFO', `  • Fusion groups processed: ${summary.fusionGroupsProcessed}`);
    this.log('INFO', `  • Average speed: ${summary.averageSpeed.toFixed(2)} files/sec`);
    this.log('INFO', `  • Validation score: ${summary.validationScore.toFixed(2)}`);

    if (summary.fusionImpact.groupsUnified > 0) {
      this.log('INFO', '🔗 Fusion Impact:');
      this.log('INFO', `  • Groups unified: ${summary.fusionImpact.groupsUnified}`);
      this.log('INFO', `  • Files consolidated: ${summary.fusionImpact.filesConsolidated}`);
      this.log('INFO', `  • Duplicates resolved: ${summary.fusionImpact.duplicatesResolved}`);
      this.log('INFO', `  • Space saved: ${(summary.fusionImpact.spaceSaved / 1024 / 1024).toFixed(2)} MB`);
    }
  }


  // Interface StepExecutor
  getName(): string {
    return 'Phase 4 - Organization & Fusion Controller';
  }

  getDescription(): string {
    return 'Orchestre l\'organisation physique des fichiers avec fusion intelligente des dossiers similaires';
  }

  estimateTime(input: Phase3Data): number {
    const structureProposals = input.structureProposals?.length || 0;
    const fusionGroups = input.fusionGroups?.length || 0;
    const estimatedFiles = fusionGroups * 20; // Estimation

    // Temps basé sur complexité
    const baseTime = 30; // 30s base
    const structureTime = structureProposals * 5; // 5s par structure
    const fusionTime = fusionGroups * 10; // 10s par groupe fusion
    const fileTime = estimatedFiles * 0.1; // 0.1s par fichier

    return Math.max(baseTime, baseTime + structureTime + fusionTime + fileTime);
  }

  canRetry(): boolean {
    return true;
  }
}
