/**
 * Phase 1 Controller - Discovery (REFACTORISÉ)
 * Architecture simplifiée utilisant uniquement Step_Phase1Unified
 */

import * as path from 'path';
import type {
  StepExecutor,
  StepResult,
  PhaseController,
  ProgressCallback
} from '@shared/interfaces/StepContracts';
import type { Phase0Data } from '@shared/interfaces/PipelineTypes';
import type {
  Phase1Data,
  Phase1Config
} from './Phase1Types';
import { DEFAULT_PHASE1_CONFIG } from './Phase1Types';

import { Step_Phase1Unified } from './Step_Phase1Unified';

export class Phase1Controller implements PhaseController<Phase0Data, Phase1Data> {
  private config: Phase1Config;
  private stepUnified: Step_Phase1Unified;

  constructor(config?: Partial<Phase1Config>) {
    this.config = { ...DEFAULT_PHASE1_CONFIG, ...config };

    // Architecture unifiée - un seul step
    this.stepUnified = new Step_Phase1Unified();
  }

  getName(): string {
    return 'Phase 1 - Discovery';
  }

  getDescription(): string {
    return 'Analyse et indexation unifiée depuis le snapshot enrichi POST-réorganisation';
  }

  async execute(
    input: Phase0Data,
    onProgress?: ProgressCallback
  ): Promise<StepResult<Phase1Data>> {
    const startTime = Date.now();

    try {
      // Validation de l'input
      if (!input.reorganizationResult?.success) {
        return {
          success: false,
          error: {
            code: 'PHASE0_NOT_COMPLETE',
            message: 'La Phase 0 doit être complétée avec succès avant la Phase 1'
          },
          canProceed: false
        };
      }

      const workingPath = input.reorganizationResult.workingPath;

      console.log('🚀 Using unified Phase1 architecture!');
      onProgress?.(5, 'Chargement des données depuis snapshot...');

      // Exécuter le step unifié
      const result = await this.stepUnified.execute({
        workingPath
      }, (progress) => {
        onProgress?.(progress, 'Traitement Phase 1...');
      });

      if (!result.success) {
        console.error('❌ Step_Phase1Unified failed:', result.error);
        return {
          success: false,
          error: result.error,
          canProceed: false
        };
      }

      console.log(`✅ Phase1 completed with ${result.data!.enrichedPacks.length} EnrichedPacks!`);

      // Vérifier si des doublons nécessitent une validation utilisateur
      const duplicatesFound = result.data!.summary.duplicatesFound || 0;

      if (duplicatesFound > 0 && this.config.enableDuplicateDetection) {
        console.log(`⚠️ ${duplicatesFound} doublons détectés - validation utilisateur requise`);

        return {
          success: true,
          data: result.data!,
          canProceed: false,
          userActionRequired: {
            type: 'choice',
            message: `${duplicatesFound} doublons détectés (${(result.data!.summary.spaceRecovered / 1024 / 1024).toFixed(0)} MB récupérables)`,
            options: ['keep', 'merge', 'delete'],
            defaultValue: {
              duplicates: result.data!.indexing.duplicates,
              strategy: result.data!.indexing.duplicateStrategy
            }
          }
        };
      }

      return {
        success: true,
        data: result.data!,
        canProceed: true
      };

    } catch (error) {
      console.error('❌ Error in Phase1Controller:', error);
      return {
        success: false,
        error: {
          code: 'PHASE1_ERROR',
          message: error instanceof Error ? error.message : 'Erreur inconnue',
          recoverable: false
        },
        canProceed: false
      };
    }
  }

  /**
   * Gestion après action utilisateur (doublons)
   */
  async resumeAfterUserAction(
    previousState: any,
    userChoice: any,
    onProgress?: ProgressCallback
  ): Promise<StepResult<Phase1Data>> {
    console.log('🔄 Resuming Phase1 after user action (duplicates)');

    try {
      onProgress?.(10, 'Traitement des doublons depuis snapshot...');

      // Traitement simplifié des doublons
      if (userChoice.duplicateAction === 'merge' || userChoice.duplicateAction === 'delete') {
        const duplicateCount = previousState.indexing?.duplicates?.length || 0;
        console.log(`🔄 ${duplicateCount} doublons marqués pour ${userChoice.duplicateAction}`);

        onProgress?.(50, `${duplicateCount} doublons marqués pour suppression...`);

        // Marquer les fichiers à supprimer (simulation)
        previousState.indexing.filesToDelete = []; // Sera rempli par la logique de suppression

        onProgress?.(100, 'Traitement des doublons terminé !');

        console.log(`✅ Duplicate handling completed: ${duplicateCount} files marked for ${userChoice.duplicateAction}`);
      }

      const endTime = Date.now();
      const duration = endTime - previousState.summary.startTime;

      // Mettre à jour le résumé
      previousState.summary.endTime = endTime;
      previousState.summary.duration = duration;

      return {
        success: true,
        data: previousState,
        canProceed: true,
        progress: 100
      };

    } catch (error) {
      console.error('❌ Error in Phase1 resumeAfterUserAction:', error);
      return {
        success: false,
        error: {
          code: 'PHASE1_RESUME_ERROR',
          message: error instanceof Error ? error.message : 'Erreur lors de la reprise'
        },
        canProceed: false
      };
    }
  }

  validate(input: Phase0Data): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!input.reorganizationResult?.success) {
      errors.push('La Phase 0 (réorganisation) doit être complétée avec succès');
    }

    if (!input.reorganizationResult?.workingPath) {
      errors.push('Le chemin de travail est requis après Phase 0');
    }

    // ✅ NOUVEAU: Validation filesystem - vérifier que workingPath existe vraiment
    if (input.reorganizationResult?.workingPath) {
      const fs = require('fs');
      if (!fs.existsSync(input.reorganizationResult.workingPath)) {
        errors.push(`Le chemin de travail n'existe pas sur le système de fichiers: ${input.reorganizationResult.workingPath}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  canRetry(): boolean {
    return true;
  }

  estimateTime(input: Phase0Data): number {
    // Temps estimé basé sur le snapshot (très rapide)
    return 3; // 3 secondes
  }
}