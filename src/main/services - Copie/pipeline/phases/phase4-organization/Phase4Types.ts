/**
 * Phase 4 - Organization Types
 * Types et interfaces pour l'organisation physique des fichiers avec fusion intelligente
 */

import type { FusionGroup } from '../phase3-matrix/utils/FusionGroupBuilder';
import type { StructureProposal } from '../phase3-matrix/Phase3Types';

// ============================================
// INTERFACES PRINCIPALES
// ============================================

/**
 * Input pour Phase 4 - Données de Phase 3 + choix utilisateur
 */
export interface Phase4Input {
  // Données Phase 3
  selectedStructure: StructureProposal;
  fusionGroups: FusionGroup[];
  classifiedPacks: any[]; // ClassifiedPack[] from Phase 2
  workingPath: string;

  // Configuration utilisateur
  targetPath: string;
  organizationOptions: OrganizationOptions;
}

/**
 * Options de configuration pour l'organisation
 */
export interface OrganizationOptions {
  // Gestion fusion
  enableFusion: boolean;
  fusionStrategy: 'auto' | 'confirm-per-group' | 'manual';

  // Gestion conflits
  conflictResolution: 'rename' | 'overwrite' | 'skip' | 'ask';

  // Options avancées
  preservePackStructure: boolean;
  createBackup: boolean;
  enableRollback: boolean;
  maxParallelOperations: number;

  // Validation
  validateAfterEachStep: boolean;
  strictValidation: boolean;
}

/**
 * Output de Phase 4 - Résultat complet de l'organisation
 */
export interface Phase4Output {
  success: boolean;
  targetPath: string;

  // Résultats organisation
  organizationResult: OrganizationResult;

  // Résultats fusion
  fusionResult: FusionResult;

  // Validation finale
  validationResult: ValidationResult;

  // Métriques
  metrics: OrganizationMetrics;

  // Logs et erreurs
  errors: OrganizationError[];
  warnings: string[];

  // Résumé
  summary: OrganizationSummary;
}

// ============================================
// PLANNING
// ============================================

/**
 * Plan d'organisation détaillé généré par Step1
 */
export interface OrganizationPlan {
  id: string;
  targetPath: string;
  estimatedDuration: number; // ms
  estimatedComplexity: number; // 0-1

  // Opérations planifiées
  operations: OrganizationOperation[];

  // Fusion operations
  fusionOperations: FusionOperation[];

  // Structure à créer
  folderStructure: FolderStructure;

  // Statistiques prévisionelles
  estimatedStats: {
    foldersToCreate: number;
    filesToMove: number;
    filesToCopy: number;
    fusionGroups: number;
    totalFiles: number;
    estimatedSize: number; // bytes
  };

  // Risques identifiés
  risks: PlanRisk[];

  // Checkpoints pour rollback
  checkpoints: string[];
}

/**
 * Opération atomique d'organisation
 */
export interface OrganizationOperation {
  id: string;
  type: 'create_folder' | 'move_file' | 'copy_file' | 'delete_file' | 'fusion_merge';
  priority: number; // 0-10, plus élevé = plus prioritaire

  // Détails opération
  source?: string; // path source
  target: string;  // path destination
  metadata?: any;  // métadonnées additionnelles

  // Dépendances
  dependencies: string[]; // IDs d'opérations à effectuer avant

  // Gestion erreurs
  retryable: boolean;
  maxRetries: number;
  rollbackable: boolean;

  // Estimation
  estimatedDuration: number; // ms
  estimatedSize: number; // bytes si applicable
}

/**
 * Opération de fusion spécialisée
 */
export interface FusionOperation {
  id: string;
  fusionGroupId: string;
  canonical: string;
  targetPath: string;

  // Sources à fusionner
  sources: FusionSource[];

  // Configuration fusion
  mergeStrategy: 'merge_all' | 'priority_based' | 'conflict_resolution';
  conflictHandling: 'rename_duplicates' | 'keep_newest' | 'keep_largest';

  // Validation
  expectedFileCount: number;
  duplicateRisk: number; // 0-1
}

export interface FusionSource {
  packId: string;
  packName: string;
  originalPath: string;
  fileCount: number;
  estimatedSize: number;
  priority: number; // Pour résolution conflits
}

// ============================================
// EXECUTION
// ============================================

/**
 * Résultat de l'exécution de l'organisation
 */
export interface OrganizationResult {
  success: boolean;
  startTime: number;
  endTime: number;
  duration: number;

  // Opérations effectuées
  completedOperations: number;
  failedOperations: number;
  skippedOperations: number;

  // Structure créée
  createdFolders: number;
  movedFiles: number;
  copiedFiles: number;
  deletedFiles: number;

  // Erreurs
  errors: OrganizationError[];
  recoveredErrors: number;

  // État final
  finalStructure: {
    totalFolders: number;
    totalFiles: number;
    maxDepth: number;
    totalSize: number; // bytes
  };
}

/**
 * Résultat de la fusion intelligente
 */
export interface FusionResult {
  success: boolean;
  fusionGroupsProcessed: number;
  fusionGroupsSuccessful: number;
  fusionGroupsFailed: number;

  // Détails par groupe
  groupResults: FusionGroupResult[];

  // Statistiques fusion
  totalFilesMerged: number;
  duplicatesResolved: number;
  conflictsEncountered: number;
  spaceSaved: number; // bytes économisés par fusion
}

export interface FusionGroupResult {
  groupId: string;
  canonical: string;
  targetPath: string;
  success: boolean;

  // Statistiques
  sourcesFused: number;
  filesMerged: number;
  duplicatesFound: number;
  conflictsResolved: number;

  // Temps
  startTime: number;
  endTime: number;
  duration: number;

  // Erreurs spécifiques
  errors: string[];
}

// ============================================
// VALIDATION
// ============================================

/**
 * Résultat de la validation finale
 */
export interface ValidationResult {
  success: boolean;
  allChecks: ValidationCheck[];

  // Sanity checks
  structureIntegrity: boolean;
  fileCountConsistency: boolean;
  fusionCompleteness: boolean;

  // Détection problèmes
  orphanedFiles: string[];
  unexpectedFolders: string[];
  missingExpectedFiles: string[];
  duplicateFiles: DuplicateFileInfo[];

  // Métriques validation
  validationScore: number; // 0-1
  criticalIssues: number;
  warnings: number;
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  details?: any;
}

export interface DuplicateFileInfo {
  fileName: string;
  locations: string[];
  sizes: number[];
  identical: boolean; // Contenu identique ou juste nom
}

// ============================================
// MONITORING & MÉTRIQUES
// ============================================

/**
 * Progress tracking en temps réel
 */
export interface OrganizationProgress {
  // Progress global
  overallProgress: number; // 0-100
  currentPhase: 'planning' | 'execution' | 'validation' | 'completed';
  currentOperation: string;

  // Progress par step
  planningProgress: number;
  executionProgress: number;
  validationProgress: number;

  // Statistiques temps réel
  operationsCompleted: number;
  operationsTotal: number;
  filesProcessed: number;
  filesTotal: number;

  // Performance
  averageOperationTime: number; // ms
  estimatedTimeRemaining: number; // ms
  operationsPerSecond: number;

  // État actuel
  currentOperationId: string;
  currentOperationType: string;
  lastCompletedOperation: string;
}

/**
 * Métriques complètes de performance
 */
export interface OrganizationMetrics {
  // Temps
  totalDuration: number;
  planningTime: number;
  executionTime: number;
  validationTime: number;

  // Performance
  operationsPerSecond: number;
  filesPerSecond: number;
  bytesPerSecond: number;

  // Efficacité
  successRate: number; // 0-1
  retryRate: number;
  rollbackOccurred: boolean;

  // Resources
  peakMemoryUsage: number; // bytes
  diskSpaceUsed: number; // bytes
  concurrentOperations: number;

  // Qualité
  validationScore: number; // 0-1
  fusionSuccess: number; // 0-1
  structureCompliance: number; // 0-1
}

// ============================================
// STRUCTURES AUXILIAIRES
// ============================================

/**
 * Structure hiérarchique des dossiers
 */
export interface FolderStructure {
  root: FolderNode;
  totalDepth: number;
  totalFolders: number;
  totalFiles: number;
}

export interface FolderNode {
  name: string;
  path: string;
  level: number;

  // Contenu
  files: FileInfo[];
  subfolders: FolderNode[];

  // Métadonnées
  expectedFileCount: number;
  actualFileCount: number;
  fusionSource?: boolean; // Si créé par fusion

  // État
  created: boolean;
  validated: boolean;
}

export interface FileInfo {
  name: string;
  originalPath: string;
  targetPath: string;
  size: number;

  // Source
  sourcePackId: string;
  sourcePackName: string;
  originalLocation: string;

  // État
  moved: boolean;
  validated: boolean;

  // Métadonnées
  type?: string; // 'KICK', 'BASS', etc.
  format?: string; // 'wav', 'mp3', etc.
  function?: string;
  fusionSource?: boolean;
}

/**
 * Erreur d'organisation avec contexte
 */
export interface OrganizationError {
  id: string;
  operationId: string;
  type: 'filesystem' | 'permission' | 'validation' | 'conflict' | 'fusion';
  severity: 'warning' | 'error' | 'critical';

  // Détails erreur
  message: string;
  details?: any;
  stackTrace?: string;

  // Context
  source?: string;
  target?: string;
  operation?: string;

  // Récupération
  recoverable: boolean;
  recovered: boolean;
  recoveryAction?: string;

  // Timing
  timestamp: number;
  retryCount: number;
}

/**
 * Risque identifié pendant la planification
 */
export interface PlanRisk {
  id: string;
  type: 'conflict' | 'permission' | 'space' | 'complexity' | 'fusion';
  severity: 'low' | 'medium' | 'high' | 'critical';

  description: string;
  impact: string;
  mitigation: string;

  // Contexte
  affectedOperations: string[];
  affectedPaths: string[];

  // Probabilité
  probability: number; // 0-1
  impactScore: number; // 0-1
}

/**
 * Résumé final de l'organisation
 */
export interface OrganizationSummary {
  // État global
  success: boolean;
  completionRate: number; // 0-1

  // Résultats principaux
  foldersCreated: number;
  filesOrganized: number;
  fusionGroupsProcessed: number;

  // Performance
  totalDuration: number;
  averageSpeed: number; // files/sec

  // Qualité
  structureCompliance: number; // 0-1
  validationScore: number; // 0-1

  // Impact fusion intelligente
  fusionImpact: {
    groupsUnified: number;
    filesConsolidated: number;
    duplicatesResolved: number;
    spaceSaved: number;
    structureSimplified: boolean;
  };

  // Messages utilisateur
  successMessage: string;
  recommendations: string[];
  warnings: string[];
}

// ============================================
// CONFIGURATION PAR DÉFAUT
// ============================================

export const DEFAULT_ORGANIZATION_OPTIONS: OrganizationOptions = {
  enableFusion: true,
  fusionStrategy: 'auto',
  conflictResolution: 'rename',
  preservePackStructure: false,
  createBackup: true,
  enableRollback: true,
  maxParallelOperations: 5,
  validateAfterEachStep: true,
  strictValidation: false
};

export const ORGANIZATION_CONSTANTS = {
  MAX_RETRY_ATTEMPTS: 3,
  CHECKPOINT_INTERVAL: 100, // opérations
  VALIDATION_SAMPLE_SIZE: 0.1, // 10% des fichiers
  MAX_CONCURRENT_OPERATIONS: 10,
  PROGRESS_UPDATE_INTERVAL: 1000, // ms

  // Seuils de performance
  MIN_OPERATIONS_PER_SECOND: 5,
  MAX_OPERATION_TIME: 30000, // ms
  CRITICAL_ERROR_THRESHOLD: 10, // erreurs critiques max

  // Validation
  STRUCTURE_COMPLIANCE_THRESHOLD: 0.95,
  FUSION_SUCCESS_THRESHOLD: 0.90,
  VALIDATION_SCORE_THRESHOLD: 0.85
} as const;
