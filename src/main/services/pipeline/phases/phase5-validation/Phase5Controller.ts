/**
 * Phase5Controller - Final Validation
 * Orchestrateur final pour validation, rapport et backup
 */

import type {
  PhaseController,
  StepResult,
  ProgressCallback
} from '@shared/interfaces/StepContracts';
import type { Phase4Data, Phase5Data } from '@shared/interfaces/PipelineTypes';
import type {
  Phase5Input,
  Phase5Output,
  ValidationResult,
  FinalReport,
  BackupResult,
  GlobalMetrics,
  Phase5Config
} from './Phase5Types';
import { DEFAULT_PHASE5_CONFIG } from './Phase5Types';

import { Step1_FinalValidator, type FinalValidationInput } from './Step1_FinalValidator';
import { Step2_ReportGenerator, type ReportGenerationInput } from './Step2_ReportGenerator';
import { Step3_BackupManager, type BackupManagementInput } from './Step3_BackupManager';

/**
 * Contrôleur Phase 5 - Final Validation & Reporting
 */
export class Phase5Controller implements PhaseController<Phase5Input, Phase5Data> {
  private readonly config: Phase5Config;
  private readonly validator: Step1_FinalValidator;
  private readonly reportGenerator: Step2_ReportGenerator;
  private readonly backupManager: Step3_BackupManager;

  // État interne
  private validationResult: ValidationResult | null = null;
  private finalReport: FinalReport | null = null;
  private backupResult: BackupResult | null = null;

  constructor(config: Partial<Phase5Config> = {}) {
    this.config = { ...DEFAULT_PHASE5_CONFIG, ...config };

    this.validator = new Step1_FinalValidator();
    this.reportGenerator = new Step2_ReportGenerator();
    this.backupManager = new Step3_BackupManager();

    if (this.config.enableDetailedLogging) {
      console.log('🔧 Phase5Controller initialisé avec config:', {
        validation: this.config.validation.enableStrictChecks,
        reporting: this.config.reporting.formats,
        backup: this.config.backup.enabled
      });
    }
  }

  getName(): string {
    return 'Phase 5 - Final Validation';
  }

  getDescription(): string {
    return 'Validation finale, génération de rapports et sauvegarde sécurisée';
  }

  async execute(
    input: Phase5Input,
    onProgress?: ProgressCallback
  ): Promise<StepResult<Phase5Data>> {
    const startTime = Date.now();

    try {
      onProgress?.(0, '📋 Démarrage Phase 5 - Final Validation...');

      if (this.config.enableDetailedLogging) {
        console.log('🚀 Phase 5 démarrée avec input:', {
          targetPath: input.targetPath,
          hasOrganizationResult: !!input.organizationResult,
          phasesData: Object.keys(input.allPhaseData || {}),
          config: Object.keys(input.config || {})
        });
      }

      // Validation des prérequis
      const validation = this.validate(input);
      if (!validation.valid) {
        throw new Error(`Validation input échouée: ${validation.errors.join(', ')}`);
      }

      // Calcul des métriques globales
      onProgress?.(5, '📊 Calcul métriques globales...');
      const globalMetrics = this.calculateGlobalMetrics(input, startTime);

      // ================================
      // STEP 1: VALIDATION FINALE
      // ================================
      onProgress?.(10, '🔍 Step 1/3 - Validation finale...');

      if (this.config.enableDetailedLogging) {
        console.log('📋 Démarrage validation finale avec options:', this.config.validation);
      }

      const validationInput: FinalValidationInput = {
        targetPath: input.targetPath,
        organizationResult: input.organizationResult,
        allPhaseData: input.allPhaseData,
        options: this.config.validation
      };

      const validationStepResult = await this.validator.execute(validationInput, (progress, message) => {
        onProgress?.(10 + (progress * 0.3), message || 'Validation en cours...');
      });

      if (!validationStepResult.success) {
        throw new Error(`Validation échouée: ${validationStepResult.error?.message}`);
      }

      this.validationResult = validationStepResult.data!;

      if (this.config.enableDetailedLogging) {
        console.log('✅ Validation terminée:', {
          success: this.validationResult.success,
          checksTotal: this.validationResult.totalChecks,
          checksPassed: this.validationResult.passedChecks,
          warnings: this.validationResult.warnings.length,
          criticalIssues: this.validationResult.criticalIssues.length,
          organizationScore: this.validationResult.organizationGains.organizationScore
        });
      }

      // Vérifier si on peut continuer malgré les problèmes
      if (this.validationResult.criticalIssues.length > this.config.validation.thresholds.maxCriticalIssues) {
        throw new Error(`Trop de problèmes critiques détectés (${this.validationResult.criticalIssues.length}/${this.config.validation.thresholds.maxCriticalIssues})`);
      }

      // ================================
      // STEP 2: GÉNÉRATION RAPPORT
      // ================================
      onProgress?.(40, '📊 Step 2/3 - Génération rapport...');

      if (this.config.enableDetailedLogging) {
        console.log('📄 Démarrage génération rapport avec formats:', this.config.reporting.formats);
      }

      const reportInput: ReportGenerationInput = {
        targetPath: input.targetPath,
        validationResult: this.validationResult,
        allPhaseData: input.allPhaseData,
        globalMetrics,
        options: this.config.reporting
      };

      const reportStepResult = await this.reportGenerator.execute(reportInput, (progress, message) => {
        onProgress?.(40 + (progress * 0.3), message || 'Génération rapport...');
      });

      if (!reportStepResult.success) {
        console.warn('⚠️ Génération rapport échouée:', reportStepResult.error?.message);
        // Continuer sans rapport (non critique)
      } else {
        this.finalReport = reportStepResult.data!;

        if (this.config.enableDetailedLogging) {
          console.log('📄 Rapport généré:', {
            formats: Array.from(this.finalReport.reportPaths.keys()),
            recommendations: this.finalReport.recommendations.length,
            executiveSummary: {
              totalPacks: this.finalReport.executiveSummary.totalPacks,
              organizationScore: this.finalReport.executiveSummary.organizationScore,
              overallSuccess: this.finalReport.executiveSummary.overallSuccess
            }
          });
        }
      }

      // ================================
      // STEP 3: BACKUP ET ROLLBACK
      // ================================
      onProgress?.(70, '💾 Step 3/3 - Backup et rollback...');

      if (this.config.backup.enabled) {
        if (this.config.enableDetailedLogging) {
          console.log('💾 Démarrage backup avec options:', {
            compression: this.config.backup.compressionEnabled,
            retention: this.config.backup.retentionDays,
            includeItems: {
              structure: this.config.backup.includeOriginalStructure,
              plan: this.config.backup.includeOrganizationPlan,
              config: this.config.backup.includeConfigFiles,
              logs: this.config.backup.includeLogs
            }
          });
        }

        const backupInput: BackupManagementInput = {
          targetPath: input.targetPath,
          organizationResult: input.organizationResult,
          finalReport: this.finalReport,
          allPhaseData: input.allPhaseData,
          options: this.config.backup
        };

        const backupStepResult = await this.backupManager.execute(backupInput, (progress, message) => {
          onProgress?.(70 + (progress * 0.25), message || 'Backup en cours...');
        });

        if (!backupStepResult.success) {
          console.warn('⚠️ Backup échoué:', backupStepResult.error?.message);
          // Continuer sans backup (non critique)
        } else {
          this.backupResult = backupStepResult.data!;

          if (this.config.enableDetailedLogging) {
            console.log('💾 Backup créé:', {
              path: this.backupResult.backupPath,
              size: `${Math.round(this.backupResult.backupSize / 1024 / 1024 * 100) / 100} MB`,
              compression: `${this.backupResult.compressionRatio}%`,
              rollbackAvailable: this.backupResult.rollbackAvailable
            });
          }
        }
      } else {
        if (this.config.enableDetailedLogging) {
          console.log('⏭️ Backup désactivé dans la configuration');
        }
      }

      // ================================
      // FINALISATION PHASE 5
      // ================================
      onProgress?.(95, '🎯 Finalisation Phase 5...');

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Construire le résultat final Phase 5
      const phase5Data: Phase5Data = {
        validationResult: this.validationResult,
        finalReport: this.finalReport || this.createEmptyReport(),
        backupResult: this.backupResult || undefined,
        globalMetrics: {
          ...globalMetrics,
          totalExecutionTime: duration
        }
      };

      if (this.config.enableDetailedLogging) {
        console.log('🎯 Phase 5 terminée avec succès:', {
          duration: `${Math.round(duration / 1000 * 100) / 100}s`,
          validationSuccess: this.validationResult.success,
          reportGenerated: !!this.finalReport,
          backupCreated: !!this.backupResult,
          organizationScore: this.validationResult.organizationGains.organizationScore,
          overallSuccess: phase5Data.validationResult.success && !phase5Data.validationResult.criticalIssues.length
        });
      }

      onProgress?.(100, '✅ Phase 5 terminée avec succès');

      return {
        success: this.validationResult.success,
        data: phase5Data,
        canProceed: this.validationResult.criticalIssues.length === 0,
        metrics: {
          startTime,
          endTime,
          duration,
          itemsProcessed: this.validationResult.totalChecks,
          processingSpeed: this.validationResult.totalChecks / (duration / 1000)
        }
      };

    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      if (this.config.enableDetailedLogging) {
        console.error('❌ Phase 5 échouée:', {
          error: error.message,
          duration: `${Math.round(duration / 1000 * 100) / 100}s`,
          step: this.getCurrentStep()
        });
      }

      return {
        success: false,
        error: {
          code: 'PHASE5_EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown Phase 5 error',
          recoverable: true,
          details: error
        },
        canProceed: false,
        metrics: {
          startTime,
          endTime,
          duration,
          itemsProcessed: 0,
          processingSpeed: 0
        }
      };
    }
  }

  /**
   * Validation des données d'entrée
   */
  validate(input: Phase5Input): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validation chemin cible
    if (!input.targetPath) {
      errors.push('Target path is required');
    }

    // Validation résultat organisation Phase 4
    if (!input.organizationResult) {
      errors.push('Organization result from Phase 4 is required');
    }

    // Validation données phases
    if (!input.allPhaseData || Object.keys(input.allPhaseData).length === 0) {
      errors.push('Phase data is required for reporting');
    }

    // Validation configuration
    if (input.config?.reportFormats && input.config.reportFormats.length === 0) {
      errors.push('At least one report format must be specified');
    }

    // Validation seuils
    if (this.config.validation.thresholds.minOrganizationScore < 0 ||
        this.config.validation.thresholds.minOrganizationScore > 100) {
      errors.push('Organization score threshold must be between 0 and 100');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  canRetry(): boolean {
    return true;
  }

  estimateTime(input: Phase5Input): number {
    let estimate = 60; // Base: 1 minute

    // Ajouter temps pour validation
    if (this.config.validation.enableStrictChecks) {
      estimate += 60;
    }

    // Ajouter temps pour génération rapport
    estimate += this.config.reporting.formats.length * 30;

    // Ajouter temps pour backup
    if (this.config.backup.enabled) {
      estimate += 120; // 2 minutes
      if (this.config.backup.compressionEnabled) {
        estimate += 60; // +1 minute pour compression
      }
    }

    return estimate;
  }

  // ============================================
  // MÉTHODES UTILITAIRES
  // ============================================

  /**
   * Calcule les métriques globales du pipeline
   */
  private calculateGlobalMetrics(input: Phase5Input, startTime: number): GlobalMetrics {
    const allPhaseData = input.allPhaseData || {};

    // Calculer temps total d'exécution
    let totalExecutionTime = 0;
    const phaseTimes: number[] = [];

    for (let phase = 0; phase <= 4; phase++) {
      const phaseKey = `phase${phase}` as keyof typeof allPhaseData;
      const phaseData = allPhaseData[phaseKey];
      const duration = phaseData?.duration || phaseData?.organizationResult?.duration || 0;
      phaseTimes.push(duration);
      totalExecutionTime += duration;
    }

    const averagePhaseTime = phaseTimes.length > 0 ? phaseTimes.reduce((a, b) => a + b, 0) / phaseTimes.length : 0;

    // Métriques d'efficacité
    const phase1Data = allPhaseData.phase1 || {};
    const phase4Data = allPhaseData.phase4?.organizationResult || {};

    const totalPacks = phase1Data.summary?.totalPacks || 0;
    const totalFiles = phase1Data.summary?.totalFiles || 0;
    const completedOperations = phase4Data.completedOperations || 0;

    const organizationEfficiency = {
      packsProcessedPerSecond: totalExecutionTime > 0 ? totalPacks / (totalExecutionTime / 1000) : 0,
      filesProcessedPerSecond: totalExecutionTime > 0 ? totalFiles / (totalExecutionTime / 1000) : 0,
      averagePackSize: totalFiles > 0 && totalPacks > 0 ? totalFiles / totalPacks : 0,
      largestPackSize: 0 // À calculer si nécessaire
    };

    // Métriques de qualité
    const qualityMetrics = {
      accuracyScore: 85, // Score par défaut, à améliorer
      consistencyScore: 80,
      completenessScore: Math.min((completedOperations / Math.max(totalPacks, 1)) * 100, 100),
      maintainabilityScore: 75
    };

    return {
      totalExecutionTime,
      averagePhaseTime,
      peakMemoryUsage: 0, // À implémenter si nécessaire
      diskSpaceUsed: input.organizationResult?.spaceSaved || 0,
      organizationEfficiency,
      qualityMetrics
    };
  }

  /**
   * Crée un rapport vide en cas d'échec
   */
  private createEmptyReport(): FinalReport {
    return {
      generatedAt: new Date().toISOString(),
      pipelineVersion: 'V6.0.0',
      reportFormats: [],
      reportPaths: new Map(),
      executiveSummary: {
        totalProcessingTime: 0,
        totalPacks: 0,
        totalFiles: 0,
        totalSizeProcessed: 0,
        packsOrganized: 0,
        filesReorganized: 0,
        spaceSaved: 0,
        duplicatesRemoved: 0,
        organizationScore: 0,
        qualityImprovement: 0,
        overallSuccess: false,
        criticalIssuesCount: 1,
        warningsCount: 0
      },
      phaseReports: [],
      qualityAnalysis: {
        scores: {
          organization: 0,
          structure: 0,
          naming: 0,
          deduplication: 0,
          classification: 0
        },
        overallScore: 0,
        grade: 'F',
        beforeAfter: {
          chaosScore: { before: 1, after: 1 },
          organizationLevel: { before: 'chaotic', after: 'chaotic' },
          efficiency: { before: 0, after: 0 }
        },
        strengths: [],
        weaknesses: ['Génération rapport échouée']
      },
      recommendations: [],
      attachments: []
    };
  }

  /**
   * Obtient l'étape actuelle pour le debugging
   */
  private getCurrentStep(): string {
    if (!this.validationResult) return 'validation';
    if (!this.finalReport) return 'reporting';
    if (!this.backupResult && this.config.backup.enabled) return 'backup';
    return 'completion';
  }

  /**
   * Obtient l'état actuel du contrôleur
   */
  getState() {
    return {
      validationComplete: !!this.validationResult,
      reportGenerated: !!this.finalReport,
      backupCreated: !!this.backupResult,
      config: this.config
    };
  }

  /**
   * Nettoyage des ressources
   */
  async cleanup(): Promise<void> {
    this.validationResult = null;
    this.finalReport = null;
    this.backupResult = null;

    if (this.config.enableDetailedLogging) {
      console.log('🧹 Phase5Controller nettoyé');
    }
  }
}