/**
 * Step 1 - Quick Scan
 * Scanner rapidement le dossier source et détecter les packs
 */

import { StepExecutor, StepResult, ValidationResult, ProgressCallback } from '@shared/interfaces/StepContracts';
import { PackDetectorV7Adapter } from '../../shared/detectors/PackDetectorV7Adapter';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Input pour le quick scan
 */
export interface QuickScanInput {
  sourcePath: string;
  config?: {
    maxDepth?: number;
    excludePatterns?: string[];
    minAudioFiles?: number;
  };
}

/**
 * Output du quick scan
 */
export interface QuickScanOutput {
  detectedPacks: any[];
  totalSamples: number;
  totalSize: number;
  needsCleanup: boolean;
  chaosScore: number;
  currentStructure: 'chaotic' | 'organized' | 'mixed';
  scanDuration: number;
  packPreview: Array<{
    name: string;
    path: string;
    audioFiles: number;
    size: number;
  }>;
  // Ajouté pour Step2
  sourcePath: string;
}

export class Step1_QuickScan implements StepExecutor<QuickScanInput, QuickScanOutput> {
  private v7Detector: PackDetectorV7Adapter;

  constructor() {
    this.v7Detector = new PackDetectorV7Adapter();
    console.log('🚀 Step1_QuickScan initialisé avec PackDetectorV7 UNIQUEMENT - PAS DE FALLBACK');
  }

  async execute(input: QuickScanInput, onProgress?: ProgressCallback): Promise<StepResult<QuickScanOutput>> {
    const { sourcePath, config = {} } = input;
    const { maxDepth = 4, excludePatterns = [], minAudioFiles = 10 } = config;

    try {
      onProgress?.(10, 'Initialisation du scan...');

      // UNIQUEMENT PackDetectorV7 - PAS DE FALLBACK
      console.log('🚀 Tentative avec PackDetectorV7 UNIQUEMENT (pas de fallback)...');

      const detectionSnapshotPath = path.join(sourcePath, '.audio-organizer', 'structure-detection.json');

      if (!fs.existsSync(detectionSnapshotPath)) {
        throw new Error(`❌ ERREUR FATALE: Snapshot lightweight non trouvé: ${detectionSnapshotPath}`);
      }

      const detectionResult = await this.v7Detector.execute({
        sourcePath,
        snapshotPath: detectionSnapshotPath,
        maxDepth,
        excludePatterns,
        minAudioFiles
      }, (progress, message) => {
        onProgress?.(10 + (progress * 0.7), `[V7] ${message || 'Détection V7 en cours...'}`);
      });

      if (!detectionResult.success) {
        throw new Error(`❌ ERREUR FATALE: PackDetectorV7 a échoué: ${detectionResult.error || 'Raison inconnue'}`);
      }

      if (!detectionResult.data?.detectedPacks || detectionResult.data.detectedPacks.length === 0) {
        throw new Error('❌ ERREUR FATALE: PackDetectorV7 n\'a trouvé aucun pack');
      }

      console.log(`✅ PackDetectorV7 RÉUSSI: ${detectionResult.data.detectedPacks.length} packs détectés`);
      const usedDetector = 'PackDetectorV7';

      console.log(`🎯 Détection terminée avec ${usedDetector}: ${detectionResult.data?.detectedPacks.length} packs`);

      onProgress?.(80, 'Analyse de la structure...');

      const { detectedPacks, totalAudioFiles } = detectionResult.data!;
      
      // Calculer le score de chaos
      const chaosScore = this.calculateChaosScore(detectedPacks);
      
      // Déterminer la structure actuelle
      const currentStructure = this.determineCurrentStructure(chaosScore);
      
      // Créer l'aperçu des packs
      const packPreview = detectedPacks.slice(0, 10).map(pack => ({
        name: pack.name,
        path: pack.path,
        audioFiles: pack.audioFiles,
        size: pack.totalSize || 0
      }));

      onProgress?.(100, 'Scan terminé');

      const result: QuickScanOutput = {
        detectedPacks,
        totalSamples: totalAudioFiles,
        totalSize: detectedPacks.filter(pack => pack.type !== 'BUNDLE_CONTAINER').reduce((sum, pack) => sum + (pack.totalSize || 0), 0),
        needsCleanup: chaosScore > 0.3,
        chaosScore,
        currentStructure,
        scanDuration: detectionResult.metrics?.duration || 0,
        packPreview,
        // Le plan sera généré par Step2
        // Ajouter pour Step2
        sourcePath
      };

      return {
        success: true,
        data: result,
        progress: 100,
        canProceed: true,
        metrics: detectionResult.metrics
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'QUICK_SCAN_ERROR',
          message: error.message,
          details: error,
          recoverable: true,
          suggestedAction: 'Vérifier les permissions du dossier source'
        },
        progress: 0,
        canProceed: false
      };
    }
  }

  validate(input: QuickScanInput): ValidationResult {
    const errors = [];
    const warnings = [];

    if (!input.sourcePath) {
      errors.push({
        field: 'sourcePath',
        message: 'Le chemin source est requis'
      });
    }

    if (input.config?.maxDepth && input.config.maxDepth > 8) {
      warnings.push('Une profondeur maximale > 8 peut ralentir considérablement le scan');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      canProceedWithWarnings: true
    };
  }

  getName(): string {
    return 'Quick Scan';
  }

  getDescription(): string {
    return 'Scan rapide du dossier source pour détecter les packs de samples';
  }

  estimateTime(input: QuickScanInput): number {
    // Estimation : 30 secondes pour un dossier moyen
    return 30;
  }

  canRetry(): boolean {
    return true;
  }

  /**
   * Calcule le score de chaos basé sur la structure détectée
   */
  private calculateChaosScore(detectedPacks: any[]): number {
    if (detectedPacks.length === 0) return 0;

    let chaosFactors = 0;
    let totalFactors = 0;

    // Facteur 1: Nombre de wrappers (dossiers inutiles)
    const wrapperCount = detectedPacks.filter(p => p.type === 'WRAPPER_FOLDER').length;
    const wrapperRatio = wrapperCount / detectedPacks.length;
    chaosFactors += wrapperRatio * 0.3;
    totalFactors += 0.3;

    // Facteur 2: Niveau de profondeur moyen
    const avgDepth = detectedPacks.reduce((sum, p) => sum + (p.structure?.depth || 0), 0) / detectedPacks.length;
    const depthScore = Math.min(avgDepth / 5, 1); // Normaliser sur 5 niveaux max
    chaosFactors += depthScore * 0.4;
    totalFactors += 0.4;

    // Facteur 3: Packs avec peu de structure interne
    const flatPacks = detectedPacks.filter(p => p.structure?.isFlat).length;
    const flatRatio = flatPacks / detectedPacks.length;
    chaosFactors += flatRatio * 0.3;
    totalFactors += 0.3;

    return Math.min(chaosFactors / totalFactors, 1);
  }

  /**
   * Détermine la structure actuelle basée sur le score de chaos
   */
  private determineCurrentStructure(chaosScore: number): 'chaotic' | 'organized' | 'mixed' {
    if (chaosScore > 0.7) return 'chaotic';
    if (chaosScore < 0.3) return 'organized';
    return 'mixed';
  }
}
