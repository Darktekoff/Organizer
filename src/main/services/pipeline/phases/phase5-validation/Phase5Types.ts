/**
 * Phase 5 - Validation Types
 * Types et interfaces pour la validation finale et génération de rapports
 */

import type { Phase4Data } from '@shared/interfaces/PipelineTypes';

// ============================================
// INTERFACES PRINCIPALES
// ============================================

/**
 * Input pour Phase 5 - Données de Phase 4 + configuration pipeline
 */
export interface Phase5Input {
  // Données Phase 4
  organizationResult: Phase4Data['organizationResult'];
  targetPath: string;

  // Toutes les données des phases précédentes pour le rapport
  allPhaseData: {
    phase0?: any;
    phase1?: any;
    phase2?: any;
    phase3?: any;
    phase4?: any;
  };

  // Configuration pipeline
  config: {
    enableDetailedReports?: boolean;
    reportFormats?: ('json' | 'markdown' | 'html')[];
    enableBackup?: boolean;
    compressionLevel?: number;
    maxReportSize?: number; // MB
  };
}

/**
 * Output complet Phase 5
 */
export interface Phase5Output {
  // Validation finale
  validationResult: ValidationResult;

  // Rapport final généré
  finalReport: FinalReport;

  // Backup et rollback
  backupResult?: BackupResult;

  // Métriques globales
  globalMetrics: GlobalMetrics;
}

// ============================================
// VALIDATION FINALE
// ============================================

/**
 * Résultat validation finale
 */
export interface ValidationResult {
  success: boolean;

  // Contrôles effectués
  checks: ValidationCheck[];
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;

  // Problèmes détectés
  warnings: ValidationIssue[];
  criticalIssues: ValidationIssue[];

  // Intégrité structure
  structureIntegrity: {
    allPacksPlaced: boolean;
    noMissingFiles: boolean;
    noDuplicates: boolean;
    correctPermissions: boolean;
    validFolderStructure: boolean;
  };

  // Gains mesurés
  organizationGains: {
    spaceSaved: number; // bytes
    duplicatesRemoved: number;
    foldersReduced: number;
    organizationScore: number; // 0-100
  };
}

/**
 * Contrôle de validation individuel
 */
export interface ValidationCheck {
  id: string;
  name: string;
  description: string;
  category: 'integrity' | 'performance' | 'structure' | 'quality';
  passed: boolean;
  result?: any;
  message: string;
  executionTime: number; // ms
}

/**
 * Problème détecté lors de la validation
 */
export interface ValidationIssue {
  severity: 'warning' | 'error' | 'critical';
  code: string;
  message: string;
  affected: string[]; // Fichiers ou dossiers affectés
  suggestedFix?: string;
  autoFixable: boolean;
}

// ============================================
// GÉNÉRATION RAPPORTS
// ============================================

/**
 * Rapport final complet
 */
export interface FinalReport {
  // Métadonnées rapport
  generatedAt: string; // ISO timestamp
  pipelineVersion: string;
  reportFormats: string[];
  reportPaths: Map<string, string>; // format → path

  // Résumé exécutif
  executiveSummary: ExecutiveSummary;

  // Détails par phase
  phaseReports: PhaseReport[];

  // Analyse qualité
  qualityAnalysis: QualityAnalysis;

  // Recommandations
  recommendations: Recommendation[];

  // Annexes
  attachments: ReportAttachment[];
}

/**
 * Résumé exécutif
 */
export interface ExecutiveSummary {
  // Métriques globales
  totalProcessingTime: number; // ms
  totalPacks: number;
  totalFiles: number;
  totalSizeProcessed: number; // bytes

  // Résultats organisation
  packsOrganized: number;
  filesReorganized: number;
  spaceSaved: number; // bytes
  duplicatesRemoved: number;

  // Qualité finale
  organizationScore: number; // 0-100
  qualityImprovement: number; // %

  // Statut global
  overallSuccess: boolean;
  criticalIssuesCount: number;
  warningsCount: number;
}

/**
 * Rapport détaillé par phase
 */
export interface PhaseReport {
  phaseNumber: number;
  phaseName: string;

  // Timing
  startTime: number;
  endTime: number;
  duration: number; // ms

  // Résultats
  success: boolean;
  itemsProcessed: number;
  errors: string[];
  warnings: string[];

  // Métriques spécifiques
  phaseMetrics: Record<string, any>;

  // Contribution aux objectifs
  contribution: {
    organizationImprovement: number; // %
    performanceGain: number; // %
    qualityScore: number; // 0-100
  };
}

/**
 * Analyse qualité finale
 */
export interface QualityAnalysis {
  // Scores par dimension
  scores: {
    organization: number; // 0-100
    structure: number; // 0-100
    naming: number; // 0-100
    deduplication: number; // 0-100
    classification: number; // 0-100
  };

  // Score global
  overallScore: number; // 0-100
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';

  // Comparaison avant/après
  beforeAfter: {
    chaosScore: { before: number; after: number };
    organizationLevel: { before: string; after: string };
    efficiency: { before: number; after: number };
  };

  // Points forts et faibles
  strengths: string[];
  weaknesses: string[];
}

/**
 * Recommandation d'amélioration
 */
export interface Recommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: 'organization' | 'performance' | 'maintenance' | 'workflow';
  title: string;
  description: string;
  expectedBenefit: string;
  actionSteps: string[];
  estimatedEffort: 'low' | 'medium' | 'high';
  applicableToNextRun: boolean;
}

/**
 * Pièce jointe rapport
 */
export interface ReportAttachment {
  name: string;
  type: 'log' | 'json' | 'csv' | 'image';
  path: string;
  size: number; // bytes
  description: string;
}

// ============================================
// BACKUP ET ROLLBACK
// ============================================

/**
 * Résultat création backup
 */
export interface BackupResult {
  success: boolean;
  backupPath: string;
  backupSize: number; // bytes
  compressionRatio: number; // %

  // Contenu backup
  includedItems: {
    originalStructure: boolean;
    organizationPlan: boolean;
    configFiles: boolean;
    logs: boolean;
  };

  // Intégrité
  checksumValidated: boolean;
  rollbackTested: boolean;

  // Métadonnées
  createdAt: string; // ISO timestamp
  expiresAt?: string; // ISO timestamp

  // Options rollback
  rollbackAvailable: boolean;
  rollbackInstructions: string[];
}

// ============================================
// MÉTRIQUES GLOBALES
// ============================================

/**
 * Métriques complètes du pipeline
 */
export interface GlobalMetrics {
  // Performance globale
  totalExecutionTime: number; // ms
  averagePhaseTime: number; // ms
  peakMemoryUsage: number; // bytes
  diskSpaceUsed: number; // bytes

  // Efficacité organisation
  organizationEfficiency: {
    packsProcessedPerSecond: number;
    filesProcessedPerSecond: number;
    averagePackSize: number; // bytes
    largestPackSize: number; // bytes
  };

  // Qualité résultats
  qualityMetrics: {
    accuracyScore: number; // %
    consistencyScore: number; // %
    completenessScore: number; // %
    maintainabilityScore: number; // %
  };

  // Historique comparatif
  comparisonWithPrevious?: {
    performanceImprovement: number; // %
    qualityImprovement: number; // %
    timeReduction: number; // %
  };
}

// ============================================
// CONFIGURATION
// ============================================

/**
 * Options de validation
 */
export interface ValidationOptions {
  enableStrictChecks: boolean;
  enablePerformanceTests: boolean;
  enableIntegrityValidation: boolean;
  allowMinorIssues: boolean;

  // Seuils
  thresholds: {
    minOrganizationScore: number; // 0-100
    maxWarningsAllowed: number;
    maxCriticalIssues: number;
    minSpaceSaving: number; // bytes
  };
}

/**
 * Options génération rapport
 */
export interface ReportOptions {
  formats: ('json' | 'markdown' | 'html')[];
  includeDetailedMetrics: boolean;
  includePhaseTimeline: boolean;
  includeQualityAnalysis: boolean;
  includeRecommendations: boolean;

  // Personnalisation
  customSections?: string[];
  excludeSections?: string[];
  branding?: {
    logo?: string;
    footer?: string;
    theme?: 'light' | 'dark' | 'auto';
  };
}

/**
 * Options backup
 */
export interface BackupOptions {
  enabled: boolean;
  includeOriginalStructure: boolean;
  includeOrganizationPlan: boolean;
  includeConfigFiles: boolean;
  includeLogs: boolean;

  // Compression
  compressionEnabled: boolean;
  compressionLevel: number; // 1-9

  // Rétention
  autoCleanup: boolean;
  retentionDays?: number;
  maxBackupSize?: number; // bytes
}

/**
 * Configuration complète Phase 5
 */
export interface Phase5Config {
  validation: ValidationOptions;
  reporting: ReportOptions;
  backup: BackupOptions;

  // Comportement
  enableDetailedLogging: boolean;
  enableMetrics: boolean;
  enableProgressTracking: boolean;

  // Limites
  maxExecutionTime: number; // ms
  maxMemoryUsage: number; // bytes
  maxReportSize: number; // bytes
}

// ============================================
// CONSTANTES
// ============================================

export const DEFAULT_PHASE5_CONFIG: Phase5Config = {
  validation: {
    enableStrictChecks: true,
    enablePerformanceTests: true,
    enableIntegrityValidation: true,
    allowMinorIssues: true,
    thresholds: {
      minOrganizationScore: 70,
      maxWarningsAllowed: 10,
      maxCriticalIssues: 0,
      minSpaceSaving: 1024 * 1024 // 1MB
    }
  },

  reporting: {
    formats: ['json', 'markdown'],
    includeDetailedMetrics: true,
    includePhaseTimeline: true,
    includeQualityAnalysis: true,
    includeRecommendations: true
  },

  backup: {
    enabled: true,
    includeOriginalStructure: true,
    includeOrganizationPlan: true,
    includeConfigFiles: true,
    includeLogs: false,
    compressionEnabled: true,
    compressionLevel: 6,
    autoCleanup: true,
    retentionDays: 30
  },

  enableDetailedLogging: true,
  enableMetrics: true,
  enableProgressTracking: true,

  maxExecutionTime: 300000, // 5 minutes
  maxMemoryUsage: 512 * 1024 * 1024, // 512MB
  maxReportSize: 10 * 1024 * 1024 // 10MB
};

export const VALIDATION_CONSTANTS = {
  MIN_ORGANIZATION_SCORE: 50,
  MAX_ALLOWED_WARNINGS: 20,
  MAX_ALLOWED_CRITICAL_ISSUES: 3,

  QUALITY_GRADES: {
    90: 'A+',
    85: 'A',
    80: 'B+',
    75: 'B',
    70: 'C+',
    65: 'C',
    50: 'D',
    0: 'F'
  } as Record<number, string>,

  REPORT_LIMITS: {
    MAX_RECOMMENDATIONS: 20,
    MAX_ATTACHMENTS: 10,
    MAX_PHASE_REPORTS: 6
  }
};