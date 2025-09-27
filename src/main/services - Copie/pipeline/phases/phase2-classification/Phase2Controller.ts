/**
 * Phase 2 Controller - Classification
 * Orchestre la classification des styles musicaux avec gestion de quarantaine
 */

import type {
  StepExecutor,
  StepResult,
  PhaseController,
  ProgressCallback
} from '@shared/interfaces/StepContracts';
import type { Phase1Data } from '@shared/interfaces/PipelineTypes';
import type {
  Phase2Data,
  Phase2Summary,
  Phase2Config,
  StyleClassificationOutput,
  QuarantineHandlingOutput,
  ClassifiedPack,
  StyleSuggestion
} from './Phase2Types';
import { DEFAULT_PHASE2_CONFIG } from './Phase2Types';

import { Step1_StyleClassifier } from './Step1_StyleClassifier';
import { Step2_QuarantineHandler } from './Step2_QuarantineHandler';

export class Phase2Controller implements PhaseController<Phase1Data, Phase2Data> {
  private config: Phase2Config;
  private step1: Step1_StyleClassifier;
  private step2: Step2_QuarantineHandler;

  constructor(config?: Partial<Phase2Config>) {
    this.config = { ...DEFAULT_PHASE2_CONFIG, ...config };

    // Initialisation des steps
    this.step1 = new Step1_StyleClassifier(this.config);
    this.step2 = new Step2_QuarantineHandler();
  }

  getName(): string {
    return 'Phase 2 - Classification';
  }

  getDescription(): string {
    return 'Classification automatique des styles musicaux avec gestion intelligente de la quarantaine';
  }

  async execute(
    input: Phase1Data,
    onProgress?: ProgressCallback
  ): Promise<StepResult<Phase2Data>> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validation de l'input
      const validation = await this.validate(input);
      if (!validation.valid) {
        return {
          success: false,
          error: {
            code: 'PHASE1_DATA_INVALID',
            message: `Données Phase 1 invalides: ${validation.errors.join(', ')}`
          },
          canProceed: false
        };
      }

      // ✅ NOUVELLE STRUCTURE UNIFIÉE V2 - SOURCE UNIQUE
      const enrichedPacks = input.enrichedPacks;
      const workingPath = input.workingPath;

      // =========================================
      // Step 1: Classification des styles
      // =========================================
      onProgress?.(10, 'Classification automatique des styles...');

      const classificationResult = await this.step1.execute({
        enrichedPacks,
        workingPath,
        config: this.config
      }, (progress) => {
        // Mapper le progress du step sur 10-60%
        onProgress?.(10 + (progress * 0.5), 'Classification en cours...');
      });

      if (!classificationResult.success) {
        return {
          success: false,
          error: classificationResult.error,
          canProceed: false
        };
      }

      const classificationData = classificationResult.data!;

      console.log('🔧 DEBUG - classificationData:', {
        hasClassifiedPacks: !!classificationData.classifiedPacks,
        classifiedPacksLength: classificationData.classifiedPacks?.length,
        hasQuarantinePacks: !!classificationData.quarantinePacks,
        quarantinePacksLength: classificationData.quarantinePacks?.length,
      });

      // =========================================
      // Step 2: Gestion de la quarantaine
      // =========================================
      onProgress?.(60, 'Gestion de la quarantaine...');

      // Si pas de quarantaine, on peut passer directement
      if (classificationData.quarantinePacks && classificationData.quarantinePacks.length === 0) {
        onProgress?.(100, 'Aucune quarantaine - Classification terminée');

        const endTime = Date.now();
        const summary = this.buildSummary(
          startTime,
          endTime,
          classificationData,
          undefined,
          errors,
          warnings
        );

        return {
          success: true,
          data: {
            classification: {
              classifiedPacks: classificationData.classifiedPacks,
              quarantinePacks: classificationData.quarantinePacks,
              statistics: classificationData.statistics,
              averageConfidence: classificationData.averageConfidence
            },
            classificationResult: {
              classifiedPacks: classificationData.classifiedPacks.map(pack => ({
                packId: pack.packId,
                packName: pack.originalPack?.name || pack.packId,
                style: pack.classification?.style || 'Unknown',
                family: pack.classification?.family || 'Unknown',
                confidence: pack.classification?.confidence || 0,
                method: pack.classification?.method || 'MANUAL'
              })),
              totalClassified: classificationData.classifiedPacks.length,
              averageConfidence: classificationData.averageConfidence
            },
            quarantineResult: undefined,
            summary
          },
          progress: 100,
          canProceed: true,
          metrics: {
            startTime,
            endTime,
            itemsProcessed: enrichedPacks.length,
            processingSpeed: enrichedPacks.length / ((endTime - startTime) / 1000)
          }
        };
      }

      // Générer des suggestions pour la quarantaine
      const suggestions = new Map(); // Sera enrichi dans le step

      // Validation défensive avant d'appeler step2
      if (!classificationData.quarantinePacks || !classificationData.classifiedPacks) {
        return {
          success: false,
          error: {
            code: 'INVALID_CLASSIFICATION_DATA',
            message: 'Données de classification invalides pour la quarantaine'
          },
          canProceed: false
        };
      }

      const quarantineResult = await this.step2.execute({
        quarantinePacks: classificationData.quarantinePacks,
        classifiedPacks: classificationData.classifiedPacks,
        suggestions
      }, (progress) => {
        // Mapper le progress du step sur 60-100%
        onProgress?.(60 + (progress * 0.4), 'Gestion quarantaine...');
      });

      if (!quarantineResult.success) {
        return {
          success: false,
          error: quarantineResult.error,
          canProceed: false
        };
      }

      // Si action utilisateur requise, on retourne les données partielles
      if (quarantineResult.userActionRequired) {
        const quarantineData = quarantineResult.data!;
        const endTime = Date.now();
        const defaultValue = quarantineResult.userActionRequired.defaultValue;

        const suggestionsByPack = new Map<string, StyleSuggestion[]>();
        if (defaultValue?.input?.suggestions) {
          for (const entry of defaultValue.input.suggestions) {
            if (entry?.packId) {
              suggestionsByPack.set(entry.packId, entry.suggestions || []);
            }
          }
        }

        const summary = this.buildSummary(
          startTime,
          endTime,
          classificationData,
          quarantineData,
          [],
          []
        );

        const phase2Data = this.toPhase2Data(
          classificationData,
          quarantineData,
          summary,
          {
            suggestionsByPack
          }
        );

        return {
          success: true,
          data: phase2Data,
          canProceed: false,
          userActionRequired: quarantineResult.userActionRequired,
          progress: 80
        };
      }

      // =========================================
      // Compilation des résultats finaux
      // =========================================
      const quarantineData = quarantineResult.data!;
      const endTime = Date.now();

      const summary = this.buildSummary(
        startTime,
        endTime,
        classificationData,
        quarantineData,
        errors,
        warnings
      );

      onProgress?.(100, 'Classification terminée');

      // Convertir vers le format PipelineTypes.Phase2Data
      const phase2Data = this.toPhase2Data(classificationData, quarantineData, summary);

      return {
        success: true,
        data: phase2Data,
        canProceed: true,
        progress: 100,
        metrics: {
          startTime,
          endTime,
          itemsProcessed: enrichedPacks.length,
          processingSpeed: enrichedPacks.length / ((endTime - startTime) / 1000)
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PHASE2_ERROR',
          message: error instanceof Error ? error.message : 'Erreur inconnue',
          details: error
        },
        canProceed: false
      };
    }
  }

  /**
   * Construit le résumé de la Phase 2
   */
  private buildSummary(
    startTime: number,
    endTime: number,
    classification: StyleClassificationOutput,
    quarantineHandling?: QuarantineHandlingOutput,
    errors: string[] = [],
    warnings: string[] = []
  ): Phase2Summary {
    const duration = endTime - startTime;

    // Compter les packs finaux
    const resolvedQuarantine = quarantineHandling?.resolvedPacks.length || 0;
    const totalClassified = classification.classifiedPacks.length + resolvedQuarantine;

    // Déterminer la famille la plus commune
    const allFamilyDistrib = new Map(classification.familyDistribution);
    if (quarantineHandling?.finalStatistics.familyDistribution) {
      for (const [family, count] of quarantineHandling.finalStatistics.familyDistribution) {
        allFamilyDistrib.set(family, (allFamilyDistrib.get(family) || 0) + count);
      }
    }

    const mostCommonFamily = Array.from(allFamilyDistrib.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';

    // Compter les interventions utilisateur
    const userInterventions = quarantineHandling?.userActions.length || 0;

    // Lister les méthodes utilisées
    const methodsUsed = Array.from(classification.statistics.methodDistribution.keys());

    return {
      startTime,
      endTime,
      duration,
      totalPacks: classification.statistics.totalPacks,
      classifiedPacks: totalClassified,
      quarantinePacks: classification.quarantinePacks.length,
      resolvedQuarantine,
      averageConfidence: classification.averageConfidence,
      mostCommonFamily,
      methodsUsed,
      userInterventions,
      errors,
      warnings
    };
  }

  validate(input: Phase1Data): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // ✅ NOUVELLE STRUCTURE UNIFIÉE V2 - Validation simplifiée
    console.log('🔧 DEBUG Phase2 - input.enrichedPacks exists:', !!input.enrichedPacks);
    console.log('🔧 DEBUG Phase2 - input.enrichedPacks?.length:', input.enrichedPacks?.length);

    if (!input.enrichedPacks || input.enrichedPacks.length === 0) {
      console.log('❌ DEBUG Phase2 - enrichedPacks is missing or empty!');
      errors.push('Les packs enrichis sont requis pour la classification');
    }

    if (!input.indexing) {
      errors.push('Les résultats d\'indexation sont requis (Phase 1 indexing)');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  canRetry(): boolean {
    return true;
  }

  estimateTime(input: Phase1Data): number {
    // ~0.5s par pack pour classification + 1s par pack en quarantaine
    const packs = input.enrichedPacks?.length || 0;
    const estimatedQuarantine = Math.ceil(packs * 0.2); // Estimation 20% en quarantaine
    return Math.ceil(packs * 0.5 + estimatedQuarantine * 1);
  }

  /**
   * Méthode pour reprendre après une action utilisateur (quarantaine)
   */
  async resumeAfterUserAction(
    previousState: any,
    userChoice: any,
    onProgress?: ProgressCallback
  ): Promise<StepResult<Phase2Data>> {
    // Reprendre le Step 2 avec le choix utilisateur
    const updatedQuarantineResult = await this.step2.handleUserAction(
      previousState.quarantine,
      userChoice
    );

    // Finaliser la Phase 2 avec les données mises à jour
    const endTime = Date.now();
    const summary = this.buildSummary(
      previousState.startTime,
      endTime,
      previousState.classification,
      updatedQuarantineResult,
      [],
      []
    );

    return {
      success: true,
      data: this.toPhase2Data(previousState.classification, updatedQuarantineResult, summary),
      canProceed: true,
      progress: 100
    };
  }

  private toPhase2Data(
    classificationData: StyleClassificationOutput,
    quarantineData?: QuarantineHandlingOutput,
    summary?: Phase2Summary,
    options?: { suggestionsByPack?: Map<string, StyleSuggestion[]> }
  ): Phase2Data {
    const resolvedPacks = quarantineData?.resolvedPacks ?? [];
    const remainingQuarantine = quarantineData?.remainingQuarantine ?? classificationData.quarantinePacks;
    const finalClassifiedPacks = [...classificationData.classifiedPacks, ...resolvedPacks];
    const suggestionsByPack = options?.suggestionsByPack ?? new Map<string, StyleSuggestion[]>();
    const resolvedLookup = new Map(resolvedPacks.map(pack => [pack.packId, pack]));

    const finalStatistics = quarantineData?.finalStatistics ?? classificationData.statistics;
    const combinedAverageConfidence = finalStatistics.averageConfidence;

    const quarantineResult =
      remainingQuarantine.length > 0 || resolvedPacks.length > 0
        ? {
            quarantinedPacks: remainingQuarantine.map(pack => ({
              packId: pack.packId,
              packName: pack.originalPack?.name || pack.packId,
              suggestedStyles: (suggestionsByPack.get(pack.packId) || []).map(s => s.style),
              resolution: resolvedLookup.has(pack.packId) ? 'auto' : undefined,
              finalStyle: resolvedLookup.get(pack.packId)?.classification?.style
            })),
            totalQuarantined: remainingQuarantine.length,
            totalResolved: resolvedPacks.length
          }
        : undefined;

    return {
      classification: {
        classifiedPacks: finalClassifiedPacks,
        quarantinePacks: remainingQuarantine,
        statistics: finalStatistics,
        averageConfidence: combinedAverageConfidence
      },
      classificationResult: {
        classifiedPacks: finalClassifiedPacks.map(pack => this.toSummaryPack(pack)),
        totalClassified: finalClassifiedPacks.length,
        averageConfidence: combinedAverageConfidence
      },
      quarantineResult,
      summary
    };
  }

  private toSummaryPack(pack: ClassifiedPack) {
    return {
      packId: pack.packId,
      packName: pack.originalPack?.name || pack.packId,
      style: pack.classification?.style || 'Unknown',
      family: pack.classification?.family || 'Unknown',
      confidence: pack.classification?.confidence || 0,
      method: pack.classification?.method || 'MANUAL'
    };
  }
}
