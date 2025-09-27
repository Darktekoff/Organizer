/**
 * PackDetectorV7Adapter - Wrapper pour intégrer PackDetectorV7 dans le pipeline existant
 *
 * Fait le pont entre :
 * - PackDetectorV7 (nouvelles interfaces)
 * - Pipeline existant (DetectedPackV6, StepExecutor)
 */

import { PackDetectorV7, DetectedPack as V7DetectedPack } from './PackDetectorV7';
import { LightweightSnapshotEntry } from '../utils/DirectorySnapshot';
import type { StepExecutor, StepResult, ValidationResult, ProgressCallback } from '@shared/interfaces/StepContracts';
import type { DetectedPackV6, PackType } from '@shared/interfaces/BusinessTypes';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Input pour le détecteur adapté
 */
export interface PackDetectorV7Input {
  sourcePath: string;
  snapshotPath: string;
  maxDepth?: number;
  excludePatterns?: string[];
  minAudioFiles?: number;
}

/**
 * Output pour le détecteur adapté
 */
export interface PackDetectorV7Output {
  detectedPacks: DetectedPackV6[];
  totalAudioFiles: number;
  totalPresetFiles: number;
  totalFolders: number;
  scanDuration: number;
}

/**
 * Wrapper qui adapte PackDetectorV7 pour le pipeline existant
 */
export class PackDetectorV7Adapter implements StepExecutor<PackDetectorV7Input, PackDetectorV7Output> {
  private detector: PackDetectorV7;

  constructor() {
    this.detector = new PackDetectorV7();
  }

  async execute(input: PackDetectorV7Input, onProgress?: ProgressCallback): Promise<StepResult<PackDetectorV7Output>> {
    const startTime = Date.now();

    try {
      onProgress?.(10, 'Chargement du snapshot JSON...');

      // Charger le snapshot lightweight
      if (!fs.existsSync(input.snapshotPath)) {
        throw new Error(`Snapshot non trouvé: ${input.snapshotPath}`);
      }

      const snapshotContent = fs.readFileSync(input.snapshotPath, 'utf-8');
      const lightSnapshot = JSON.parse(snapshotContent) as LightweightSnapshotEntry;

      onProgress?.(30, 'Détection des packs avec PackDetectorV7...');

      // Convertir LightweightSnapshotEntry vers DirectoryNode
      const rootNode = this.convertSnapshot(lightSnapshot);

      // Utiliser PackDetectorV7
      const v7Result = this.detector.detect(rootNode);

      onProgress?.(80, 'Conversion vers format pipeline...');

      // Convertir les résultats vers DetectedPackV6
      const detectedPacks = v7Result.detectedPacks.map(pack => this.convertToV6Pack(pack));

      const scanDuration = Date.now() - startTime;

      // Calculer les statistiques (éviter le double comptage bundle + sous-packs)
      const finalPacks = detectedPacks.filter(pack => pack.type !== 'BUNDLE_CONTAINER');
      const totalAudioFiles = finalPacks.reduce((sum, pack) => sum + pack.audioFiles, 0);
      const totalPresetFiles = finalPacks.reduce((sum, pack) => sum + pack.presetFiles, 0);
      const totalSize = finalPacks.reduce((sum, pack) => sum + pack.totalSize, 0);

      onProgress?.(100, `Détection terminée: ${detectedPacks.length} packs trouvés`);

      return {
        success: true,
        data: {
          detectedPacks,
          totalAudioFiles,
          totalPresetFiles,
          totalFolders: v7Result.totalScanned,
          scanDuration
        },
        progress: 100,
        canProceed: true,
        metrics: {
          startTime,
          endTime: Date.now(),
          duration: scanDuration,
          itemsProcessed: v7Result.totalScanned,
          processingSpeed: v7Result.totalScanned / (scanDuration / 1000)
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PACK_DETECTOR_V7_ERROR',
          message: error.message,
          details: error,
          recoverable: true,
          suggestedAction: 'Vérifier que le snapshot JSON est valide'
        },
        progress: 0,
        canProceed: false
      };
    }
  }

  /**
   * Convertir LightweightSnapshotEntry vers DirectoryNode (format V7)
   */
  private convertSnapshot(snapshot: LightweightSnapshotEntry): any {
    return {
      path: snapshot.path,
      name: snapshot.name,
      type: snapshot.type,
      audioFileCount: snapshot.audioFileCount,
      presetFileCount: snapshot.presetFileCount || 0, // Fallback si pas encore dans le snapshot
      totalSize: snapshot.totalSize,
      mtime: snapshot.mtime,
      children: snapshot.children?.map(child => this.convertSnapshot(child))
    };
  }

  /**
   * Convertir DetectedPack V7 vers DetectedPackV6
   */
  private convertToV6Pack(v7Pack: V7DetectedPack): DetectedPackV6 {
    // Mapper le type V7 vers PackType V6
    const typeMapping: Record<string, PackType> = {
      'pack': 'COMMERCIAL_PACK',
      'bundle': 'BUNDLE_CONTAINER'
    };

    return {
      id: uuidv4(),
      name: v7Pack.name,
      originalName: v7Pack.name,
      path: v7Pack.path,
      type: typeMapping[v7Pack.type] || 'COMMERCIAL_PACK',
      confidence: v7Pack.score / 100, // Convertir score 0-100 vers 0-1
      reasoning: v7Pack.reasoning,
      audioFiles: v7Pack.audioFiles,
      presetFiles: v7Pack.presetFiles,
      totalFiles: Math.round(v7Pack.audioFiles / 0.7), // Estimation
      totalSize: v7Pack.totalSize,
      structure: {
        subfolders: v7Pack.subPacks?.length || 0,
        depth: this.calculateDepth(v7Pack.path),
        hasDocumentation: false, // Pas calculé dans V7
        hasPresets: v7Pack.presetFiles > 0,
        isFlat: (v7Pack.subPacks?.length || 0) === 0,
        audioFiles: v7Pack.audioFiles,
        presetFiles: v7Pack.presetFiles,
        totalFiles: Math.round(v7Pack.audioFiles / 0.7)
      },
      needsReorganization: v7Pack.type === 'bundle',
      isCommercial: v7Pack.score >= 60, // Score élevé = commercial
      shouldExtract: v7Pack.type === 'bundle',
      shouldRecurseInside: v7Pack.type !== 'bundle',
      detectedAt: new Date().toISOString()
    };
  }

  /**
   * Calculer la profondeur d'un chemin
   */
  private calculateDepth(filePath: string): number {
    return filePath.split(path.sep).length - 1;
  }

  validate(input: PackDetectorV7Input): ValidationResult {
    const errors = [];
    const warnings = [];

    if (!input.sourcePath) {
      errors.push({
        field: 'sourcePath',
        message: 'Le chemin source est requis'
      });
    }

    if (!input.snapshotPath) {
      errors.push({
        field: 'snapshotPath',
        message: 'Le chemin du snapshot est requis'
      });
    } else if (!fs.existsSync(input.snapshotPath)) {
      errors.push({
        field: 'snapshotPath',
        message: 'Le fichier snapshot n\'existe pas',
        value: input.snapshotPath
      });
    }

    if (input.maxDepth && input.maxDepth > 10) {
      warnings.push('Une profondeur > 10 peut être lente');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      canProceedWithWarnings: true
    };
  }

  getName(): string {
    return 'Pack Detector V7 (Optimized)';
  }

  getDescription(): string {
    return 'Détecteur de packs minimal et robuste basé sur scoring simple';
  }

  estimateTime(input: PackDetectorV7Input): number {
    return 10; // Plus rapide avec le JSON pré-calculé
  }

  canRetry(): boolean {
    return true;
  }
}