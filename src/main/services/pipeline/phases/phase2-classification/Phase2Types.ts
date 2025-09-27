/**
 * Phase 2 - Classification Types
 * Types pour la classification des styles musicaux avec quarantaine
 */

import type {
  EnrichedPack,
  ClassifiedPack,
  ClassificationDetails,
  ClassificationMethod,
  AlternativeClassification
} from '@shared/interfaces/BusinessTypes';

// ============================================
// INPUT/OUTPUT pour chaque Step
// ============================================

// Step 1 - Style Classifier
export interface StyleClassificationInput {
  enrichedPacks: EnrichedPack[];
  workingPath: string;
  config: Phase2Config;
}

export interface StyleClassificationOutput {
  classifiedPacks: ClassifiedPack[];
  quarantinePacks: ClassifiedPack[];
  statistics: ClassificationStatistics;
  averageConfidence: number;
  familyDistribution: Map<string, number>;
}

// Step 2 - Quarantine Handler
export interface QuarantineHandlingInput {
  quarantinePacks: ClassifiedPack[];
  classifiedPacks: ClassifiedPack[];
  suggestions: Map<string, StyleSuggestion[]>;
}

export interface QuarantineHandlingOutput {
  resolvedPacks: ClassifiedPack[];
  remainingQuarantine: ClassifiedPack[];
  userActions: QuarantineAction[];
  finalStatistics: ClassificationStatistics;
}

// ============================================
// TYPES DE CLASSIFICATION
// ============================================

export type Classification = ClassificationDetails;
export { ClassificationMethod } from '@shared/interfaces/BusinessTypes';
export type { ClassifiedPack, AlternativeClassification };

// ============================================
// QUARANTAINE
// ============================================

export interface QuarantineAction {
  packId: string;
  action: QuarantineActionType;
  userChoice?: Classification;
  reason: string;
  timestamp: Date;
}

export enum QuarantineActionType {
  CLASSIFY_MANUAL = 'CLASSIFY_MANUAL',     // Classification manuelle
  ACCEPT_SUGGESTION = 'ACCEPT_SUGGESTION', // Accepter une suggestion
  SKIP = 'SKIP',                           // Ignorer pour l'instant
  RESEARCH_WEB = 'RESEARCH_WEB',           // Recherche web pour info
  MERGE_WITH_EXISTING = 'MERGE_WITH_EXISTING' // Fusionner avec pack existant
}

export interface StyleSuggestion {
  family: string;
  style: string;
  confidence: number;
  source: 'lexical' | 'contextual' | 'similarity' | 'user_history';
  explanation: string;
}

// ============================================
// TAXONOMIE ET RÈGLES
// ============================================

export interface MusicTaxonomy {
  families: MusicFamily[];
  styleSynonyms: Map<string, string>;
  classificationRules: ClassificationRules;
  keywordPatterns: KeywordPattern[];
}

export interface MusicFamily {
  id: string;
  name: string;
  styles: string[];
  keywords: string[];
  keywordWeights?: Map<string, number>;
  excludeKeywords?: string[];
  confidence: number;
  color?: string; // Pour l'UI
}

export interface ClassificationRules {
  priorityPatterns: PriorityPattern[];
  familyExclusions: Map<string, string[]>;
  styleOverrides: Map<string, string>;
  contextualRules: ContextualRule[];
}

export interface PriorityPattern {
  pattern: string;
  family: string;
  style: string;
  priority: number; // 1-5, 5 = haute priorité
  confidence: number;
}

export interface ContextualRule {
  condition: 'folder_structure' | 'file_count' | 'file_types' | 'pack_size';
  value: any;
  classification: {
    family: string;
    style: string;
    confidence: number;
  };
}

export interface KeywordPattern {
  keywords: string[];
  family: string;
  style?: string;
  weight: number;
  requiresAll?: boolean; // Si true, tous les mots-clés doivent être présents
  keywordWeights?: Map<string, number>;
}

// ============================================
// STATISTIQUES
// ============================================

export interface ClassificationStatistics {
  totalPacks: number;
  classifiedPacks: number;
  quarantinePacks: number;
  averageConfidence: number;
  methodDistribution: Map<ClassificationMethod, number>;
  familyDistribution: Map<string, number>;
  processingTime: number; // ms
  errors: string[];
  warnings: string[];
}

// ============================================
// CONFIGURATION
// ============================================

export interface Phase2Config {
  confidenceThreshold: number;      // Seuil pour quarantaine (0.6 par défaut)
  enableAIFallback: boolean;        // Utiliser l'IA en dernier recours
  enableContextualRules: boolean;   // Utiliser les règles contextuelles
  maxQuarantineSize: number;        // Nombre max de packs en quarantaine
  taxonomyPath?: string;            // Chemin vers la taxonomie personnalisée
  userHistoryPath?: string;         // Chemin vers l'historique utilisateur
  skipConfidenceThreshold: number;  // Seuil pour skip automatique (0.9)
}

export const DEFAULT_PHASE2_CONFIG: Phase2Config = {
  confidenceThreshold: 0.6,
  enableAIFallback: true, // ✅ Réactivé pour les cas difficiles et améliorer la précision
  enableContextualRules: true,
  maxQuarantineSize: 50,
  skipConfidenceThreshold: 0.9
};

// ============================================
// DONNÉES DE PHASE
// ============================================

// Phase2Data est maintenant dans shared/interfaces/PipelineTypes.ts
export type { Phase2Data } from '@shared/interfaces/PipelineTypes';

export interface Phase2Summary {
  startTime: number;
  endTime: number;
  duration: number;
  totalPacks: number;
  classifiedPacks: number;
  quarantinePacks: number;
  resolvedQuarantine: number;
  averageConfidence: number;
  mostCommonFamily: string;
  methodsUsed: ClassificationMethod[];
  userInterventions: number;
  errors: string[];
  warnings: string[];
}
