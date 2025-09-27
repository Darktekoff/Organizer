/**
 * Phase 0 - Types spécifiques pour la phase de préparation
 * Quick scan et réorganisation initiale
 */

import type { DetectedPackV6 } from '@shared/interfaces/BusinessTypes';

// Phase0Data est maintenant dans shared/interfaces/PipelineTypes.ts
export type { Phase0Data } from '@shared/interfaces/PipelineTypes';

/**
 * Résultat du quick scan
 */
export interface QuickScanResult {
  detectedPacks: DetectedPackV6[];
  totalSamples: number;
  totalSize: number;
  needsCleanup: boolean;
  chaosScore: number; // 0-1, niveau de désorganisation
  currentStructure: 'chaotic' | 'organized' | 'mixed';
  scanDuration: number; // ms
}

/**
 * Plan de réorganisation
 */
export interface ReorganizationPlan {
  operations: ReorganizeOperation[];
  estimatedTime: number;
  conflicts: string[];
  totalOperations: number;
  spaceRequired: number;
}

/**
 * Opération de réorganisation
 */
export interface ReorganizeOperation {
  type: 'move' | 'rename' | 'clean' | 'unwrap' | 'create_dir' | 'delete';
  sourcePath: string;
  targetPath: string;
  reason: string;
  priority: number; // 1-5, 1 = haute priorité
  size?: number;
}

/**
 * Résultat de la réorganisation
 */
export interface ReorganizationResult {
  success: boolean;
  workingPath: string; // Nouveau chemin de travail
  movedPacks: number;
  cleanedNames: number;
  unwrappedFolders: number;
  errors: string[];
  warnings: string[];
  rollbackInfo?: RollbackInfo;
}

/**
 * Informations pour rollback
 */
export interface RollbackInfo {
  originalPath: string;
  backupPath?: string;
  operations: ReorganizeOperation[];
  timestamp: number;
}
