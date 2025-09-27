/**
 * Step 2 - Quarantine Handler
 * Gestion des packs non-classifiés avec suggestions et actions utilisateur
 */

import type {
  StepExecutor,
  StepResult,
  ProgressCallback,
  UserActionRequired
} from '@shared/interfaces/StepContracts';
import type {
  QuarantineHandlingInput,
  QuarantineHandlingOutput,
  ClassifiedPack,
  QuarantineAction,
  StyleSuggestion,
  Classification,
  ClassificationStatistics,
  StyleClassificationOutput
} from './Phase2Types';
import { QuarantineActionType, ClassificationMethod } from './Phase2Types';
import { ClassifierV6 } from './ClassifierV6';

export class Step2_QuarantineHandler implements StepExecutor<QuarantineHandlingInput, QuarantineHandlingOutput> {
  private classifier?: ClassifierV6;
  private processedPacks: number = 0;
  private totalPacks: number = 0;

  getName(): string {
    return 'Quarantine Handler';
  }

  getDescription(): string {
    return 'Gestion des packs en quarantaine avec suggestions et résolution utilisateur';
  }

  async execute(
    input: QuarantineHandlingInput,
    onProgress?: ProgressCallback
  ): Promise<StepResult<QuarantineHandlingOutput>> {
    try {
      const { quarantinePacks, classifiedPacks, suggestions } = input;

      // Validation défensive
      if (!quarantinePacks || !Array.isArray(quarantinePacks)) {
        return {
          success: false,
          error: {
            code: 'INVALID_QUARANTINE_PACKS',
            message: 'quarantinePacks est undefined ou n\'est pas un tableau'
          },
          canProceed: false
        };
      }

      if (!classifiedPacks || !Array.isArray(classifiedPacks)) {
        return {
          success: false,
          error: {
            code: 'INVALID_CLASSIFIED_PACKS',
            message: 'classifiedPacks est undefined ou n\'est pas un tableau'
          },
          canProceed: false
        };
      }

      this.totalPacks = quarantinePacks.length;
      this.processedPacks = 0;

      // Si pas de quarantaine, on continue directement
      if (quarantinePacks.length === 0) {
        onProgress?.(100, 'Aucun pack en quarantaine');

        return {
          success: true,
          data: {
            resolvedPacks: [],
            remainingQuarantine: [],
            userActions: [],
            finalStatistics: this.calculateFinalStatistics(classifiedPacks, [])
          },
          progress: 100,
          canProceed: true
        };
      }

      onProgress?.(10, `Analyse de ${quarantinePacks.length} packs en quarantaine...`);

      // Générer des suggestions pour les packs en quarantaine
      const enhancedSuggestions = await this.generateEnhancedSuggestions(
        quarantinePacks,
        suggestions,
        onProgress
      );

      // Vérifier s'il y a des résolutions automatiques possibles
      const autoResolvable = await this.identifyAutoResolvable(quarantinePacks, enhancedSuggestions);

      onProgress?.(80, 'Préparation de l\'interface de résolution...');

      // Si tous les packs peuvent être résolus automatiquement
      if (autoResolvable.length === quarantinePacks.length) {
        const resolvedPacks = await this.applyAutoResolution(autoResolvable, enhancedSuggestions);

        onProgress?.(100, 'Quarantaine résolue automatiquement');

        return {
          success: true,
          data: {
            resolvedPacks,
            remainingQuarantine: [],
            userActions: resolvedPacks.map(pack => ({
              packId: pack.packId,
              action: QuarantineActionType.ACCEPT_SUGGESTION,
              userChoice: pack.classification!,
              reason: 'Résolution automatique haute confiance',
              timestamp: new Date()
            })),
            finalStatistics: this.calculateFinalStatistics(classifiedPacks, resolvedPacks)
          },
          progress: 100,
          canProceed: true
        };
      }

      // Sinon, demander une action utilisateur
      onProgress?.(90, 'Préparation de l\'interface utilisateur...');

      const userActionData = this.prepareUserActionData(
        quarantinePacks,
        classifiedPacks,
        enhancedSuggestions
      );

      onProgress?.(100, 'En attente de résolution utilisateur...');

      return {
        success: true,
        data: {
          resolvedPacks: [],
          remainingQuarantine: quarantinePacks,
          userActions: [],
          finalStatistics: this.calculateFinalStatistics(classifiedPacks, [])
        },
        progress: 100,
        canProceed: false,
        userActionRequired: {
          type: 'quarantine',
          message: `${quarantinePacks.length} packs nécessitent une classification manuelle`,
          options: ['CLASSIFY_MANUAL', 'ACCEPT_SUGGESTIONS', 'SKIP_ALL'],
          defaultValue: userActionData
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'QUARANTINE_HANDLER_ERROR',
          message: error instanceof Error ? error.message : 'Erreur lors de la gestion de quarantaine',
          details: error
        },
        canProceed: false
      };
    }
  }

  /**
   * Génère des suggestions améliorées pour les packs en quarantaine
   */
  private async generateEnhancedSuggestions(
    quarantinePacks: ClassifiedPack[],
    existingSuggestions: Map<string, StyleSuggestion[]>,
    onProgress?: ProgressCallback
  ): Promise<Map<string, StyleSuggestion[]>> {
    const enhancedSuggestions = new Map(existingSuggestions);

    // Initialiser le classifier si nécessaire
    if (!this.classifier) {
      this.classifier = new ClassifierV6({
        confidenceThreshold: 0.3, // Plus bas pour les suggestions
        enableAIFallback: false,
        enableContextualRules: true,
        maxQuarantineSize: 100,
        skipConfidenceThreshold: 0.8
      });
      await this.classifier.initialize();
    }

    for (let i = 0; i < quarantinePacks.length; i++) {
      const pack = quarantinePacks[i];

      if (!enhancedSuggestions.has(pack.packId)) {
        // Générer de nouvelles suggestions
        const suggestions = await this.generateSuggestionsForPack(pack);
        enhancedSuggestions.set(pack.packId, suggestions);
      } else {
        // Améliorer les suggestions existantes
        const currentSuggestions = enhancedSuggestions.get(pack.packId) || [];
        const additionalSuggestions = await this.generateSuggestionsForPack(pack);

        // Fusionner et déduplicquer
        const allSuggestions = [...currentSuggestions, ...additionalSuggestions];
        const uniqueSuggestions = this.deduplicateSuggestions(allSuggestions);
        enhancedSuggestions.set(pack.packId, uniqueSuggestions);
      }

      this.processedPacks++;
      const progress = 10 + ((this.processedPacks / this.totalPacks) * 60);
      onProgress?.(progress, `Suggestions: ${this.processedPacks}/${this.totalPacks}`);
    }

    return enhancedSuggestions;
  }

  /**
   * Génère des suggestions pour un pack spécifique
   */
  private async generateSuggestionsForPack(pack: ClassifiedPack): Promise<StyleSuggestion[]> {
    const suggestions: StyleSuggestion[] = [];

    if (!this.classifier) return suggestions;

    try {
      // Tenter une classification avec seuil plus bas
      const classification = await this.classifier.classifyPack(pack);

     if (classification) {
        const reasoning = classification.reasoning;
        const reasoningText = Array.isArray(reasoning)
          ? reasoning.join(', ')
          : reasoning ?? '';
        suggestions.push({
          family: classification.family,
          style: classification.style,
          confidence: classification.confidence,
          source: 'lexical',
          explanation: `Classification automatique: ${reasoningText}`
        });
      }

      // Générer des alternatives
      const alternatives = await this.classifier.generateAlternatives(pack, classification);
      for (const alt of alternatives) {
        suggestions.push({
          family: alt.family,
          style: alt.style,
          confidence: alt.confidence,
          source: 'similarity',
          explanation: alt.reason
        });
      }

      // Suggestions basées sur le contenu
      const contentSuggestions = this.generateContentBasedSuggestions(pack);
      suggestions.push(...contentSuggestions);

    } catch (error) {
      console.warn(`Erreur génération suggestions pour ${pack.packId}:`, error);
    }

    // Trier par confiance et limiter à 5 suggestions
    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
  }

  /**
   * Génère des suggestions basées sur le contenu du pack
   */
  private generateContentBasedSuggestions(pack: ClassifiedPack): StyleSuggestion[] {
    const suggestions: StyleSuggestion[] = [];
    const packName = pack.packId.toLowerCase();

    // Suggestions basées sur le BPM
    if (pack.avgBPM) {
      if (pack.avgBPM >= 140 && pack.avgBPM <= 155) {
        suggestions.push({
          family: 'Hard Dance',
          style: 'Hardstyle',
          confidence: 0.7,
          source: 'contextual',
          explanation: `BPM ${pack.avgBPM} typique du Hardstyle`
        });
      } else if (pack.avgBPM >= 70 && pack.avgBPM <= 85) {
        suggestions.push({
          family: 'Bass Music',
          style: 'Dubstep',
          confidence: 0.6,
          source: 'contextual',
          explanation: `BPM ${pack.avgBPM} typique du Dubstep`
        });
      }
    }

    // Suggestions basées sur les presets
    if (pack.hasPresets && pack.metadata.presetFormats.includes('serum')) {
      suggestions.push({
        family: 'Bass Music',
        style: 'Future_Bass',
        confidence: 0.5,
        source: 'contextual',
        explanation: 'Presets Serum suggèrent du Bass Music'
      });
    }

    // Suggestions basées sur la structure
    if (pack.hasLoops && pack.hasOneShots && pack.audioFiles > 50) {
      suggestions.push({
        family: 'Electronic',
        style: 'House',
        confidence: 0.4,
        source: 'contextual',
        explanation: 'Structure complète suggère un pack House'
      });
    }

    return suggestions;
  }

  /**
   * Identifie les packs qui peuvent être résolus automatiquement
   */
  private async identifyAutoResolvable(
    quarantinePacks: ClassifiedPack[],
    suggestions: Map<string, StyleSuggestion[]>
  ): Promise<ClassifiedPack[]> {
    const autoResolvable: ClassifiedPack[] = [];

    for (const pack of quarantinePacks) {
      const packSuggestions = suggestions.get(pack.packId) || [];

      // Si une suggestion a une confiance très élevée (>85%)
      const highConfidenceSuggestion = packSuggestions.find(s => s.confidence > 0.85);

      if (highConfidenceSuggestion) {
        autoResolvable.push(pack);
      }
    }

    return autoResolvable;
  }

  /**
   * Applique la résolution automatique
   */
  private async applyAutoResolution(
    resolvablePacks: ClassifiedPack[],
    suggestions: Map<string, StyleSuggestion[]>
  ): Promise<ClassifiedPack[]> {
    const resolvedPacks: ClassifiedPack[] = [];

    for (const pack of resolvablePacks) {
      const packSuggestions = suggestions.get(pack.packId) || [];
      const bestSuggestion = packSuggestions[0]; // Le premier est le meilleur

      if (bestSuggestion) {
        const resolvedPack = { ...pack };
        resolvedPack.classification = {
          family: bestSuggestion.family,
          style: bestSuggestion.style,
          confidence: bestSuggestion.confidence,
          method: ClassificationMethod.AI_FALLBACK,
          reasoning: [bestSuggestion.explanation],
          matchedKeywords: [],
          appliedRules: ['auto_resolution_high_confidence']
        };
        resolvedPack.needsManualReview = false;
        resolvedPack.quarantineReason = undefined;

        resolvedPacks.push(resolvedPack);
      }
    }

    return resolvedPacks;
  }

  /**
   * Prépare les données pour l'action utilisateur
   */
  private prepareUserActionData(
    quarantinePacks: ClassifiedPack[],
    classifiedPacks: ClassifiedPack[],
    suggestions: Map<string, StyleSuggestion[]>
  ): any {
    return {
      // Structure attendue par l'UI Phase2UI.tsx
      quarantinePacks: quarantinePacks.map(pack => ({
        packId: pack.packId,
        packName: pack.name || pack.packId, // Utiliser le nom si disponible
        reason: pack.quarantineReason || 'Classification incertaine',
        audioFiles: pack.audioFiles,
        presetFiles: pack.presetFiles,
        avgBPM: pack.avgBPM,
        tags: pack.tags,
        suggestions: suggestions.get(pack.packId) || []
      })),
      // Données pour le traitement backend
      input: {
        quarantine: quarantinePacks,
        classified: classifiedPacks,
        suggestions: Array.from(suggestions.entries()).map(([packId, sugg]) => ({
          packId,
          suggestions: sugg
        }))
      }
    };
  }

  /**
   * Déduplique les suggestions
   */
  private deduplicateSuggestions(suggestions: StyleSuggestion[]): StyleSuggestion[] {
    const seen = new Set<string>();
    return suggestions.filter(suggestion => {
      const key = `${suggestion.family}|${suggestion.style}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Calcule les statistiques finales
   */
  private calculateFinalStatistics(
    classifiedPacks: ClassifiedPack[],
    resolvedPacks: ClassifiedPack[]
  ): ClassificationStatistics {
    const allPacks = [...classifiedPacks, ...resolvedPacks];
    const totalPacks = allPacks.length;

    const methodDistribution = new Map();
    const familyDistribution = new Map();

    for (const pack of allPacks) {
      if (pack.classification) {
        // Méthodes
        const method = pack.classification.method;
        methodDistribution.set(method, (methodDistribution.get(method) || 0) + 1);

        // Familles
        const family = pack.classification.family;
        familyDistribution.set(family, (familyDistribution.get(family) || 0) + 1);
      }
    }

    const confidences = allPacks
      .map(p => p.classification?.confidence || 0)
      .filter(c => c > 0);

    const averageConfidence = confidences.length > 0
      ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
      : 0;

    return {
      totalPacks,
      classifiedPacks: allPacks.length,
      quarantinePacks: 0, // Plus de quarantaine après résolution
      averageConfidence,
      methodDistribution,
      familyDistribution,
      processingTime: 0,
      errors: [],
      warnings: []
    };
  }

  /**
   * Traite une action utilisateur pour résoudre la quarantaine
   */
  async handleUserAction(
    previousData: QuarantineHandlingInput,
    userAction: any
  ): Promise<QuarantineHandlingOutput> {
    // Cette méthode sera appelée après l'action utilisateur
    // Pour l'instant, on retourne une structure basique
    return {
      resolvedPacks: [],
      remainingQuarantine: previousData.quarantinePacks,
      userActions: [],
      finalStatistics: this.calculateFinalStatistics(previousData.classifiedPacks, [])
    };
  }

  validate(input: QuarantineHandlingInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!input.quarantinePacks) {
      errors.push('Les packs en quarantaine sont requis');
    }

    if (!input.classifiedPacks) {
      errors.push('Les packs classifiés sont requis');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  canRetry(): boolean {
    return true;
  }

  estimateTime(input: QuarantineHandlingInput): number {
    // ~1 seconde par pack en quarantaine pour générer les suggestions
    const quarantinePacks = input.quarantinePacks?.length || 0;
    return Math.ceil(quarantinePacks * 1);
  }
}
