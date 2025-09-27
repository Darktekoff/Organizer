/**
 * Step 1 - Style Classifier
 * Classification automatique des styles musicaux avec taxonomie V6
 */

import type {
  StepExecutor,
  StepResult,
  ProgressCallback
} from '@shared/interfaces/StepContracts';
import type {
  StyleClassificationInput,
  StyleClassificationOutput,
  ClassifiedPack,
  Classification,
  ClassificationStatistics,
  Phase2Config
} from './Phase2Types';
import { ClassificationMethod } from '@shared/interfaces/BusinessTypes';
import type { EnrichedPack } from '@shared/interfaces/BusinessTypes';
import { ClassifierV8, BatchClassificationResult } from './ClassifierV8';

export class Step1_StyleClassifier implements StepExecutor<StyleClassificationInput, StyleClassificationOutput> {
  private config: Phase2Config;
  private classifier: ClassifierV8;
  private processedPacks: number = 0;
  private totalPacks: number = 0;

  constructor(config: Phase2Config) {
    this.config = config;
    this.classifier = new ClassifierV8(config);
  }

  getName(): string {
    return 'Style Classifier';
  }

  getDescription(): string {
    return 'Classification automatique des styles musicaux avec taxonomie et règles intelligentes';
  }

  async execute(
    input: StyleClassificationInput,
    onProgress?: ProgressCallback
  ): Promise<StepResult<StyleClassificationOutput>> {
    try {
      const { enrichedPacks, workingPath } = input;

      // Validation défensive
      if (!enrichedPacks || !Array.isArray(enrichedPacks)) {
        return {
          success: false,
          error: {
            code: 'INVALID_ENRICHED_PACKS',
            message: 'enrichedPacks est undefined ou n\'est pas un tableau'
          },
          canProceed: false
        };
      }

      this.totalPacks = enrichedPacks.length;
      this.processedPacks = 0;

      onProgress?.(5, 'Initialisation du classifier...');

      // Initialiser le classifier avec la taxonomie
      await this.classifier.initialize();

      onProgress?.(10, `Classification de ${this.totalPacks} packs...`);

      // Utiliser le nouveau batch processing de ClassifierV8
      const startTime = Date.now();
      const batchResult = await this.classifier.classifyPacksBatch(enrichedPacks);

      // Convertir les résultats en ClassifiedPack avec mise à jour du progrès
      const classifiedPacks: ClassifiedPack[] = [];
      const quarantinePacks: ClassifiedPack[] = [];
      let processed = 0;

      // Traiter tous les packs classifiés (succès et quarantaine)
      for (const [packId, result] of batchResult.classifiedPacks) {
        // Retrouver le pack original
        const originalPack = enrichedPacks.find(p => p.packId === packId);
        if (!originalPack) continue;

        const classifiedPack = this.createClassifiedPack(originalPack);
        classifiedPack.classification = result.classification;

        if (result.needsManualReview || !result.classification ||
            (result.classification.confidence < this.config.confidenceThreshold)) {
          // Pack en quarantaine
          classifiedPack.quarantineReason = result.quarantineReason ||
            (result.classification
              ? `Confiance trop faible (${(result.classification.confidence * 100).toFixed(1)}%)`
              : 'Aucune classification trouvée');
          classifiedPack.needsManualReview = true;
          quarantinePacks.push(classifiedPack);
        } else {
          // Pack classifié avec succès
          classifiedPacks.push(classifiedPack);
        }

        processed++;
        const progress = 10 + ((processed / this.totalPacks) * 80);
        onProgress?.(progress, `Classification: ${processed}/${this.totalPacks} packs`);
      }

      this.processedPacks = processed;
      const errors: string[] = []; // Pas d'erreurs spécifiques dans la nouvelle structure

      onProgress?.(90, 'Calcul des statistiques...');

      // Calculer les statistiques
      const processingTime = Date.now() - startTime;
      const statistics = this.calculateStatistics(
        classifiedPacks,
        quarantinePacks,
        processingTime,
        errors
      );

      // Calculer la distribution des familles
      const familyDistribution = this.calculateFamilyDistribution(classifiedPacks);

      // Calculer la confiance moyenne
      const averageConfidence = this.calculateAverageConfidence(classifiedPacks);

      onProgress?.(100, 'Classification terminée');

      const output: StyleClassificationOutput = {
        classifiedPacks,
        quarantinePacks,
        statistics,
        averageConfidence,
        familyDistribution
      };

      return {
        success: true,
        data: output,
        progress: 100,
        canProceed: true,
        metrics: {
          startTime,
          endTime: Date.now(),
          itemsProcessed: this.processedPacks,
          processingSpeed: this.processedPacks / (processingTime / 1000)
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CLASSIFICATION_ERROR',
          message: error instanceof Error ? error.message : 'Erreur lors de la classification',
          details: error
        },
        canProceed: false
      };
    }
  }


  /**
   * Crée un ClassifiedPack depuis un EnrichedPack
   */
  private createClassifiedPack(pack: EnrichedPack): ClassifiedPack {
    return {
      ...pack,
      classifiedAt: new Date(),
      needsManualReview: false
    } as ClassifiedPack;
  }

  /**
   * Calcule les statistiques de classification
   */
  private calculateStatistics(
    classifiedPacks: ClassifiedPack[],
    quarantinePacks: ClassifiedPack[],
    processingTime: number,
    errors: string[]
  ): ClassificationStatistics {
    const totalPacks = classifiedPacks.length + quarantinePacks.length;
    const methodDistribution = new Map<ClassificationMethod, number>();

    // Compter les méthodes utilisées
    for (const pack of classifiedPacks) {
      if (pack.classification) {
        const method = pack.classification.method;
        methodDistribution.set(method, (methodDistribution.get(method) || 0) + 1);
      }
    }

    // Calculer la confiance moyenne
    const confidences = classifiedPacks
      .map(p => p.classification?.confidence || 0)
      .filter(c => c > 0);

    const averageConfidence = confidences.length > 0
      ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
      : 0;

    return {
      totalPacks,
      classifiedPacks: classifiedPacks.length,
      quarantinePacks: quarantinePacks.length,
      averageConfidence,
      methodDistribution,
      familyDistribution: new Map(), // Sera calculé séparément
      processingTime,
      errors,
      warnings: quarantinePacks.length > totalPacks * 0.3
        ? [`Taux de quarantaine élevé: ${((quarantinePacks.length / totalPacks) * 100).toFixed(1)}%`]
        : []
    };
  }

  /**
   * Calcule la distribution des familles
   */
  private calculateFamilyDistribution(classifiedPacks: ClassifiedPack[]): Map<string, number> {
    const distribution = new Map<string, number>();

    for (const pack of classifiedPacks) {
      if (pack.classification) {
        const family = pack.classification.family;
        distribution.set(family, (distribution.get(family) || 0) + 1);
      }
    }

    return distribution;
  }

  /**
   * Calcule la confiance moyenne
   */
  private calculateAverageConfidence(classifiedPacks: ClassifiedPack[]): number {
    const confidences = classifiedPacks
      .map(p => p.classification?.confidence || 0)
      .filter(c => c > 0);

    return confidences.length > 0
      ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
      : 0;
  }

  validate(input: StyleClassificationInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!input.enrichedPacks || input.enrichedPacks.length === 0) {
      errors.push('Aucun pack enrichi à classifier');
    }

    if (!input.workingPath) {
      errors.push('Le chemin de travail est requis');
    }

    if (!input.config) {
      errors.push('La configuration Phase 2 est requise');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  canRetry(): boolean {
    return true;
  }

  estimateTime(input: StyleClassificationInput): number {
    // ~0.5 seconde par pack pour la classification
    const packs = input.enrichedPacks?.length || 0;
    return Math.ceil(packs * 0.5);
  }
}
