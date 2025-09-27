/**
 * Phase 3 - Matrix & Structure Types
 * Types spécifiques pour la génération de matrice et proposition de structure
 */

import type { ClassifiedPack } from '@shared/interfaces/BusinessTypes';
import type { FusionGroup } from './utils/FusionGroupBuilder';

// Phase3Data est maintenant dans shared/interfaces/PipelineTypes.ts
export type { Phase3Data } from '@shared/interfaces/PipelineTypes';

// ============================================
// INPUT/OUTPUT pour chaque Step
// ============================================

// Step 1 - Matrix Generator
export interface MatrixGenerationInput {
  classifiedPacks: ClassifiedPack[];
  taxonomyPath?: string;
  enableFusion?: boolean; // NOUVEAU: Active la fusion intelligente
}

export interface MatrixGenerationOutput {
  adaptiveMatrix: AdaptiveMatrix;
  statistics: MatrixStatistics;
  taxonomyInfo: TaxonomyInfo;
  fusionGroups?: FusionGroup[]; // NOUVEAU: Groupes de fusion détectés
  folderClusters?: FolderClusterInfo[]; // NOUVEAU: Clusters de dossiers similaires
}

// Step 2 - Structure Proposal
export interface StructureProposalInput {
  adaptiveMatrix: AdaptiveMatrix;
  classifiedPacks: ClassifiedPack[];
  statistics: MatrixStatistics;
  fusionGroups?: FusionGroup[]; // NOUVEAU: Utilise les groupes de fusion
}

export interface StructureProposalOutput {
  proposals: StructureProposal[];
  recommendations: StructureRecommendation;
  estimatedComplexity: ComplexityMetrics;
}

// ============================================
// MATRICE ADAPTATIVE
// ============================================

/**
 * Matrice adaptative - Clé = "Family|Type|Style"
 */
export interface AdaptiveMatrix {
  [key: string]: MatrixEntry;
}

export interface MatrixEntry {
  // Taxonomie (source YAML)
  family: string;
  type: string;  // KICKS, BASS, SYNTHS, etc.
  style: string;

  // Patterns découverts
  functions: string[];     // One Shot, Loop, Layer, etc.
  variants: string[];      // Standard, Pitched, Heavy, etc.
  contexts: string[];      // Main, Breakdown, Buildup, etc.

  // Statistiques
  packCount: number;
  totalFiles: number;
  avgConfidence: number;
  examples: string[];      // Noms de packs exemples

  // Métadonnées
  taxonomySource: boolean; // true si Family/Style vient du YAML
  discovered: boolean;     // true si découvert par analyse
  fusionInfo?: FusionInfo; // NOUVEAU: Info de fusion si applicable
}

export interface MatrixStatistics {
  totalEntries: number;
  uniqueFamilies: number;
  uniqueTypes: number;
  uniqueStyles: number;
  discoveredFunctions: number;
  discoveredVariants: number;
  taxonomyCoverage: number;  // % packs matchés avec taxonomie
  matrixComplexity: number;  // Score de complexité 0-1
  fusionGroups?: number; // NOUVEAU: Nombre de groupes de fusion
  clustersDetected?: number; // NOUVEAU: Nombre de clusters détectés
}

// ============================================
// TAXONOMIE
// ============================================

export interface TaxonomyInfo {
  version: string;
  families: TaxonomyFamily[];
  types: string[];
  formats: TaxonomyFormats;
  loadedAt: number;
  source: string;
}

export interface TaxonomyFamily {
  name: string;
  id: string;
  styles: string[];
  color?: string;
}

export interface TaxonomyFormats {
  [type: string]: string[]; // "KICKS": ["Full_Kicks", "Tok", "Punch"]
}

// ============================================
// PROPOSITIONS DE STRUCTURE
// ============================================

export interface StructureProposal {
  id: string;
  name: string;
  description: string;

  // Hiérarchie proposée
  hierarchy: string[];     // ["Family", "Type", "Style", "Function"]
  levels: number;

  // Métriques
  estimatedFolders: number;
  avgFilesPerFolder: number;
  maxDepth: number;
  balanceScore: number;    // 0-1, équilibrage des dossiers
  statistics?: {
    estimatedFolders: number;
    estimatedFiles: number;
    fusionGroups: number;
    duplicatesResolved: number;
  };

  // Avantages/Inconvénients
  advantages: string[];
  disadvantages: string[];

  // Preview
  preview: StructurePreviewNode[];

  // Compatibilité
  compatibilityScore: number; // 0-1, avec patterns existants
  fusionEnabled?: boolean; // NOUVEAU: Si la fusion est utilisée
}

export interface StructurePreviewNode {
  level: number;
  name: string;
  path: string;
  estimatedFiles: number;
  examples: string[];
  children?: Map<string, StructurePreviewNode> | StructurePreviewNode[];
  isFusionNode?: boolean; // NOUVEAU: Si c'est un nœud de fusion
  fusionSources?: string[]; // NOUVEAU: Sources fusionnées
}

export interface StructureRecommendation {
  recommendedId: string;
  reason: string;
  confidence: number;
  alternatives: Array<{
    id: string;
    reason: string;
    score: number;
  }>;
}

export interface ComplexityMetrics {
  organizationalComplexity: number; // 0-1
  userDecisionPoints: number;
  estimatedTimeMinutes: number;
  riskFactors: string[];
  fusionComplexity?: number; // NOUVEAU: Complexité de fusion
}

// ============================================
// UTILITAIRES
// ============================================

/**
 * Combinaison Family+Type+Style pour génération clés matrice
 */
export interface MatrixKey {
  family: string;
  type: string;
  style: string;
  key: string;  // "Family|Type|Style"
}

/**
 * Pattern découvert dans un pack
 */
export interface DiscoveredPattern {
  packId: string;
  type: 'function' | 'variant' | 'context';
  value: string;
  confidence: number;
  source: 'filename' | 'folder' | 'structure';
  examples: string[];
}

/**
 * Configuration pour la génération de matrice
 */
export interface MatrixConfig {
  minPackCountForEntry: number;     // Minimum packs pour créer entry (défaut: 1)
  minConfidenceThreshold: number;   // Seuil confiance minimum (défaut: 0.6)
  maxDiscoveredPatterns: number;    // Max patterns découverts par type (défaut: 20)
  enableContextDetection: boolean;  // Détecter contextes (Main, Breakdown, etc.)
  taxonomyRequired: boolean;        // Require taxonomie match (défaut: false)
  // NOUVEAU: Options de fusion
  enableFolderFusion?: boolean;
  fusionSimilarityThreshold?: number;
  maxFusionGroupSize?: number;
}

/**
 * Configuration pour propositions de structure
 */
export interface ProposalConfig {
  maxProposals: number;           // Max propositions générées (défaut: 3)
  minFilesPerFolder: number;      // Min fichiers par dossier (défaut: 5)
  maxFilesPerFolder: number;      // Max fichiers par dossier (défaut: 100)
  balanceWeight: number;          // Poids équilibrage dans scoring (défaut: 0.3)
  compatibilityWeight: number;    // Poids compatibilité dans scoring (défaut: 0.4)
  simplicityWeight: number;       // Poids simplicité dans scoring (défaut: 0.3)
  // NOUVEAU: Options de fusion dans les propositions
  considerFusionInProposals?: boolean;
  fusionWeight?: number;
}

// ============================================
// SUMMARY ET RÉSULTATS
// ============================================

/**
 * Summary de Phase 3
 */
export interface Phase3Summary {
  startTime: number;
  endTime: number;
  duration: number;
  totalPacks: number;
  matrixEntries: number;
  proposalsGenerated: number;
  recommendedProposal: string;
  taxonomyCoverage: number;
  estimatedComplexity: number;
  userDecisionPoints: number;
  // NOUVEAU: Statistiques de fusion
  fusionGroupsCreated?: number;
  foldersToMerge?: number;
  estimatedSpaceSaved?: number;
  errors: string[];
  warnings: string[];
}

// NOUVEAU: Information de fusion pour une entrée de matrice
export interface FusionInfo {
  fusionGroupId: string;
  clusteredPaths: string[];
  canonicalPath: string;
  similarity: number;
  mergedFromPacks: number;
}

// NOUVEAU: Information sur les clusters de dossiers
export interface FolderClusterInfo {
  id: string;
  canonical: string;
  members: string[];
  avgSimilarity: number;
  packCount: number;
  fileCount: number;
}
