/**
 * Pipeline V6 - Types principaux
 * Définit les structures de données échangées entre phases
 */

import {
  DetectedPackV6,
  ReorganizeOperation,
  EnrichedPack,
  FileDistribution,
  DepthAnalysis,
  OrganizationPatterns,
  GlobalStatistics,
  FileEntry,
  DuplicateGroup,
  DuplicateStrategy,
  TagCollection,
  Phase1Summary,
  ClassifiedPack
} from './BusinessTypes';

// ============================================
// NOUVELLE STRUCTURE UNIFIÉE PHASE 1 V2
// ============================================

/**
 * Analyse de structure (statistiques générales)
 */
export interface Phase1AnalysisResult {
  totalPacks: number;
  totalFiles: number;
  totalSize: number;
  fileDistribution: FileDistribution;
  depthAnalysis: DepthAnalysis;
  organizationPatterns: OrganizationPatterns;
  statistics: GlobalStatistics;
}

/**
 * Indexation et doublons
 */
export interface Phase1IndexingResult {
  indexedFiles: number;
  allFiles: FileEntry[];
  duplicates: DuplicateGroup[];
  packIndex: Map<string, FileEntry[]>;
  packDetails: Map<string, DetectedPackV6>;
  duplicateStrategy?: DuplicateStrategy;
  filesToDelete?: string[];
  statistics: {
    uniqueFiles: number;
    duplicateFiles: number;
    wastedSpace: number;
    duplicateRatio: number;
    topDuplicates: Array<{name: string; count: number; size: number}>;
  };
}

/**
 * Métadonnées (optionnel)
 */
export interface Phase1MetadataResult {
  processedFiles: number;
  audioMetadata: Map<string, any>;
  presetMetadata: Map<string, any>;
  extractedTags: TagCollection;
  extractionStats: {
    processedAudio: number;
    processedPresets: number;
    failedExtractions: number;
    averageBpm: number;
    keyDistribution: Map<string, number>;
    extractionTime: number;
  };
}

/**
 * État global du pipeline
 */
export interface PipelineState {
  currentPhase: number; // 0-5
  phaseData: PhaseDataMap;
  errors: PipelineError[];
  startTime: number;
  lastCheckpoint?: PhaseCheckpoint;
  sourcePath: string;
  workingPath?: string; // Chemin après réorganisation
}

/**
 * Map des données de chaque phase
 */
export interface PhaseDataMap {
  phase0?: Phase0Data;  // Preparation
  phase1?: Phase1Data;  // Discovery
  phase2?: Phase2Data;  // Classification
  phase3?: Phase3Data;  // Matrix
  phase4?: Phase4Data;  // Organization
  phase5?: Phase5Data;  // Validation
}

/**
 * Phase 0 - Preparation (Quick Scan + Reorganization)
 */
export interface Phase0Data {
  sourcePath: string;
  
  // Résultat du quick scan
  quickScanResult: {
    detectedPacks: DetectedPackV6[];
    totalSamples: number;
    totalSize: number;
    needsCleanup: boolean;
    chaosScore: number; // 0-1, niveau de désorganisation
    currentStructure: 'chaotic' | 'organized' | 'mixed';
    scanDuration: number; // ms
    packPreview: Array<{
      name: string;
      path: string;
      audioFiles: number;
      size: number;
    }>;
  };
  
  // Plan de réorganisation (après validation utilisateur)
  reorganizationPlan?: {
    operations: ReorganizeOperation[];
    estimatedTime: number;
    conflicts: string[];
    totalOperations: number;
    plannedStats?: any; // Stats détaillées du plan
    planReport?: any;
  };
  
  // Résultat de la réorganisation
  reorganizationResult?: {
    success: boolean;
    movedPacks: number;
    cleanedNames: number;
    unwrappedFolders: number;
    workingPath: string; // Nouveau chemin de travail
    errors: string[];
    duration: number; // ms
  };
}

/**
 * Phase 1 - Discovery (Analyse approfondie) - STRUCTURE UNIFIÉE V2
 * 🎯 SOURCE UNIQUE DE VÉRITÉ pour enrichedPacks
 */
export interface Phase1Data {
  workingPath: string;

  // ✅ SOURCE UNIQUE - Les packs enrichis (utilisé par TOUTES les phases)
  enrichedPacks: EnrichedPack[];

  // Résultats d'analyse (statistiques pour UI)
  analysis: Phase1AnalysisResult;

  // Résultats d'indexation et doublons
  indexing: Phase1IndexingResult;

  // Métadonnées (optionnel)
  metadata?: Phase1MetadataResult;

  // Résumé global
  summary?: Phase1Summary;

  // ============================================
  // COMPATIBILITÉ TEMPORAIRE - À SUPPRIMER V7
  // ============================================

  /** @deprecated Utiliser analysis au lieu de deepAnalysisResult */
  deepAnalysisResult: Phase1AnalysisResult & { enrichedPacks: EnrichedPack[] };

  /** @deprecated Utiliser indexing au lieu de indexingResult */
  indexingResult: Phase1IndexingResult;

  /** @deprecated Utiliser metadata au lieu de metadataResult */
  metadataResult?: Phase1MetadataResult & { enrichedPacks: EnrichedPack[] };
}

/**
 * Phase 2 - Classification
 */
export interface Phase2Data {
  classification: {
    classifiedPacks: ClassifiedPack[];
    quarantinePacks: ClassifiedPack[];
    statistics: Record<string, any>;
    averageConfidence: number;
  };

  // Classification des styles
  classificationResult: {
    classifiedPacks: Array<{
      packId: string;
      packName: string;
      style: string;
      family: string;
      confidence: number;
      method: string;
    }>;
    totalClassified: number;
    averageConfidence: number;
  };
  
  // Gestion quarantaine
  quarantineResult?: {
    quarantinedPacks: Array<{
      packId: string;
      packName: string;
      suggestedStyles: string[];
      resolution?: string;
      finalStyle?: string;
    }>;
    totalQuarantined: number;
    totalResolved: number;
  };

  summary?: Record<string, any>;
}

/**
 * Phase 3 - Matrix & Structure avec fusion intelligente
 */
export interface Phase3Data {
  // Packs classifiés de Phase 2
  classifiedPacks: Array<any>; // ClassifiedPack[] from Phase2
  workingPath?: string;
  sourcePath?: string;

  // Matrice générée avec fusion
  matrixResult: {
    success?: boolean;
    dimensions?: {
      types: Array<{ name: string; count: number; confidence: number }>;
      formats: Array<{ name: string; count: number; confidence: number }>;
      variations: Array<{ name: string; count: number; confidence: number }>;
    };
    statistics?: {
      totalEntries: number;
      uniqueFamilies: number;
      uniqueTypes: number;
    };
    totalDimensions?: number;
    matrixComplexity?: number;
    fusionGroups?: Array<any>; // FusionGroup[]
    folderClusters?: Array<any>; // FolderCluster[]
  };

  // Groupes de fusion intelligente
  fusionGroups: Array<{
    id: string;
    canonical: string;
    confidence: number;
    classification: {
      family: string;
      type: string;
      style: string;
    };
    targetPath: string;
    sourceFiles: Array<{
      packName: string;
      originalPath: string;
      fileCount: number;
      estimatedSize: number;
    }>;
    statistics: {
      totalFiles: number;
      totalSize: number;
      packCount: number;
    };
  }>;

  // Propositions de structure
  structureProposals: Array<{
    id: string;
    name: string;
    description: string;
    targetStructure?: {
      family: boolean;
      type: boolean;
      style: boolean;
      maxDepth: number;
    };
    structure?: string[]; // Legacy: ["Family", "Type", "Style", "Format"]
    statistics?: {
      estimatedFolders: number;
      estimatedFiles: number;
      fusionGroups: number;
      duplicatesResolved: number;
    };
    estimatedFolders?: number; // Legacy
    advantages: string[];
    disadvantages?: string[]; // Legacy
    considerations?: string[]; // New
    preview?: Array<{ path: string; example: string }>;
    score?: number;
  }>;

  // Choix utilisateur
  userChoice?: {
    selectedStructureId: string;
    duplicateStrategy: 'merge' | 'keep-best' | 'keep-all' | 'manual';
    duplicateResolutions?: Map<string, string>; // groupId -> resolution
  };

  // Détection doublons
  duplicatesResult?: {
    groups: Array<{
      id: string;
      files: string[];
      size: number;
      confidence: number;
      suggestedAction: 'merge' | 'keep-best' | 'keep-all';
    }>;
    totalDuplicates: number;
    potentialSavings: number; // bytes
  };

  summary?: Record<string, any>;
}

/**
 * Phase 4 - Organization avec fusion intelligente
 */
export interface Phase4Data {
  targetPath: string;
  success: boolean;

  // Résultat d'organisation complet
  organizationResult: {
    success: boolean;
    startTime: number;
    endTime: number;
    duration: number;
    completedOperations: number;
    failedOperations: number;
    skippedOperations: number;
    createdFolders: number;
    movedFiles: number;
    copiedFiles: number;
    deletedFiles: number;
    errors: Array<{
      id: string;
      operationId: string;
      type: 'filesystem' | 'permission' | 'validation' | 'conflict' | 'fusion';
      severity: 'warning' | 'error' | 'critical';
      message: string;
      source?: string;
      target?: string;
      operation?: string;
      recoverable: boolean;
      recovered: boolean;
      timestamp: number;
      retryCount: number;
    }>;
    recoveredErrors: number;
    finalStructure: {
      totalFolders: number;
      totalFiles: number;
      maxDepth: number;
      totalSize: number;
    };
    spaceSaved: number; // Espace économisé en bytes
    foldersReduced: number; // Nombre de dossiers réduits
  };

  // Résultat de fusion intelligente
  fusionResult: {
    success: boolean;
    fusionGroupsProcessed: number;
    fusionGroupsSuccessful: number;
    fusionGroupsFailed: number;
    groupResults: Array<{
      groupId: string;
      canonical: string;
      targetPath: string;
      success: boolean;
      sourcesFused: number;
      filesMerged: number;
      duplicatesFound: number;
      conflictsResolved: number;
      startTime: number;
      endTime: number;
      duration: number;
      errors: string[];
    }>;
    totalFilesMerged: number;
    duplicatesResolved: number;
    conflictsEncountered: number;
    spaceSaved: number;
  };

  // Résultat de validation
  validationResult: {
    success: boolean;
    allChecks: Array<{
      name: string;
      passed: boolean;
      message: string;
      severity: 'info' | 'warning' | 'error' | 'critical';
      details?: any;
    }>;
    structureIntegrity: boolean;
    fileCountConsistency: boolean;
    fusionCompleteness: boolean;
    orphanedFiles: string[];
    unexpectedFolders: string[];
    missingExpectedFiles: string[];
    duplicateFiles: Array<{
      fileName: string;
      locations: string[];
      sizes: number[];
      identical: boolean;
    }>;
    validationScore: number;
    criticalIssues: number;
    warnings: number;
  };

  // Métriques de performance
  metrics: {
    totalDuration: number;
    planningTime: number;
    executionTime: number;
    validationTime: number;
    operationsPerSecond: number;
    filesPerSecond: number;
    bytesPerSecond: number;
    successRate: number;
    retryRate: number;
    rollbackOccurred: boolean;
    peakMemoryUsage: number;
    diskSpaceUsed: number;
    concurrentOperations: number;
    validationScore: number;
    fusionSuccess: number;
    structureCompliance: number;
  };

  // Résumé pour l'utilisateur
  summary: {
    success: boolean;
    completionRate: number;
    foldersCreated: number;
    filesOrganized: number;
    fusionGroupsProcessed: number;
    totalDuration: number;
    averageSpeed: number;
    structureCompliance: number;
    validationScore: number;
    fusionImpact: {
      groupsUnified: number;
      filesConsolidated: number;
      duplicatesResolved: number;
      spaceSaved: number;
      structureSimplified: boolean;
    };
    successMessage: string;
    recommendations: string[];
    warnings: string[];
  };

  // Erreurs et avertissements globaux
  errors: Array<any>;
  warnings: string[];
}

/**
 * Phase 5 - Final Validation
 * Utilise les types détaillés de Phase5Types.ts
 */
export interface Phase5Data {
  // Validation finale
  validationResult: {
    success: boolean;
    checks: Array<{
      id: string;
      name: string;
      description: string;
      category: 'integrity' | 'performance' | 'structure' | 'quality';
      passed: boolean;
      result?: any;
      message: string;
      executionTime: number;
    }>;
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    warnings: Array<{
      severity: 'warning' | 'error' | 'critical';
      code: string;
      message: string;
      affected: string[];
      suggestedFix?: string;
      autoFixable: boolean;
    }>;
    criticalIssues: Array<{
      severity: 'warning' | 'error' | 'critical';
      code: string;
      message: string;
      affected: string[];
      suggestedFix?: string;
      autoFixable: boolean;
    }>;
    structureIntegrity: {
      allPacksPlaced: boolean;
      noMissingFiles: boolean;
      noDuplicates: boolean;
      correctPermissions: boolean;
      validFolderStructure: boolean;
    };
    organizationGains: {
      spaceSaved: number;
      duplicatesRemoved: number;
      foldersReduced: number;
      organizationScore: number;
    };
  };

  // Rapport final
  finalReport: {
    generatedAt: string;
    pipelineVersion: string;
    reportFormats: string[];
    reportPaths: Map<string, string>;
    executiveSummary: {
      totalProcessingTime: number;
      totalPacks: number;
      totalFiles: number;
      totalSizeProcessed: number;
      packsOrganized: number;
      filesReorganized: number;
      spaceSaved: number;
      duplicatesRemoved: number;
      organizationScore: number;
      qualityImprovement: number;
      overallSuccess: boolean;
      criticalIssuesCount: number;
      warningsCount: number;
    };
    phaseReports: Array<{
      phaseNumber: number;
      phaseName: string;
      startTime: number;
      endTime: number;
      duration: number;
      success: boolean;
      itemsProcessed: number;
      errors: string[];
      warnings: string[];
      phaseMetrics: Record<string, any>;
      contribution: {
        organizationImprovement: number;
        performanceGain: number;
        qualityScore: number;
      };
    }>;
    qualityAnalysis: {
      scores: {
        organization: number;
        structure: number;
        naming: number;
        deduplication: number;
        classification: number;
      };
      overallScore: number;
      grade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';
      beforeAfter: {
        chaosScore: { before: number; after: number };
        organizationLevel: { before: string; after: string };
        efficiency: { before: number; after: number };
      };
      strengths: string[];
      weaknesses: string[];
    };
    recommendations: Array<{
      id: string;
      priority: 'high' | 'medium' | 'low';
      category: 'organization' | 'performance' | 'maintenance' | 'workflow';
      title: string;
      description: string;
      expectedBenefit: string;
      actionSteps: string[];
      estimatedEffort: 'low' | 'medium' | 'high';
      applicableToNextRun: boolean;
    }>;
    attachments: Array<{
      name: string;
      type: 'log' | 'json' | 'csv' | 'image';
      path: string;
      size: number;
      description: string;
    }>;
  };

  // Backup result
  backupResult?: {
    success: boolean;
    backupPath: string;
    backupSize: number;
    compressionRatio: number;
    includedItems: {
      originalStructure: boolean;
      organizationPlan: boolean;
      configFiles: boolean;
      logs: boolean;
    };
    checksumValidated: boolean;
    rollbackTested: boolean;
    createdAt: string;
    expiresAt?: string;
    rollbackAvailable: boolean;
    rollbackInstructions: string[];
  };

  // Métriques globales
  globalMetrics: {
    totalExecutionTime: number;
    averagePhaseTime: number;
    peakMemoryUsage: number;
    diskSpaceUsed: number;
    organizationEfficiency: {
      packsProcessedPerSecond: number;
      filesProcessedPerSecond: number;
      averagePackSize: number;
      largestPackSize: number;
    };
    qualityMetrics: {
      accuracyScore: number;
      consistencyScore: number;
      completenessScore: number;
      maintainabilityScore: number;
    };
    comparisonWithPrevious?: {
      performanceImprovement: number;
      qualityImprovement: number;
      timeReduction: number;
    };
  };
}

/**
 * Checkpoint de phase pour reprise après interruption
 */
export interface PhaseCheckpoint {
  phase: number;
  step: number;
  timestamp: number;
  data: any;
  canResume: boolean;
}

/**
 * Erreur du pipeline
 */
export interface PipelineError {
  phase: number;
  step?: number;
  code: string;
  message: string;
  timestamp: number;
  recoverable: boolean;
  details?: any;
}

/**
 * Résultat d'exécution d'une phase
 */
export interface PhaseResult {
  phase: number;
  success: boolean;
  data: any;
  errors: PipelineError[];
  duration: number;
  canContinue: boolean;
  requiresUserAction: boolean;
}
