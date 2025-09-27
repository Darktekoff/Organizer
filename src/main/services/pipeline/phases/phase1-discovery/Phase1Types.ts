/**
 * Phase 1 - Discovery Types
 * Types spécifiques pour la phase de découverte
 */

import { DetectedPackV6, EnrichedPack, DuplicateStrategy } from '@shared/interfaces/BusinessTypes';

// Phase1Data est maintenant dans shared/interfaces/PipelineTypes.ts
export type { Phase1Data } from '@shared/interfaces/PipelineTypes';

// ============================================
// INPUT/OUTPUT pour chaque Step
// ============================================

// Step 1 - Structure Analyzer
export interface StructureAnalysisInput {
  workingPath: string;  // Chemin après réorganisation Phase 0
  packs: DetectedPackV6[];  // Packs détectés et réorganisés
}

export interface StructureAnalysisOutput {
  totalPacks: number;
  totalFiles: number;
  totalSize: number;
  fileDistribution: FileDistribution;
  depthAnalysis: DepthAnalysis;
  organizationPatterns: OrganizationPatterns;
  statistics: GlobalStatistics;
}

// Step 2 - Content Indexer
export interface ContentIndexingInput {
  workingPath: string;
  packs: DetectedPackV6[];
  structure: StructureAnalysisOutput;
}

export type FileEntry = import('@shared/interfaces/BusinessTypes').FileEntry;
export type DuplicateGroup = import('@shared/interfaces/BusinessTypes').DuplicateGroup;
export type TagCollection = import('@shared/interfaces/BusinessTypes').TagCollection;

export interface ContentIndexingOutput {
  indexedFiles: number;
  allFiles: FileEntry[];
  duplicates: DuplicateGroup[];
  packIndex: Map<string, FileEntry[]>;
  packDetails: Map<string, DetectedPackV6>;
  duplicateStrategy?: DuplicateStrategy;
  filesToDelete?: string[];
}

// Step 3 - Metadata Extractor
export interface MetadataExtractionInput {
  allFiles: FileEntry[];
  packIndex: Map<string, FileEntry[]>;
  workingPath: string;
  packDetails: Map<string, DetectedPackV6>;
}

export interface MetadataExtractionOutput {
  processedFiles: number;
  audioMetadata: Map<string, AudioMetadata>;
  presetMetadata: Map<string, PresetMetadata>;
  enrichedPacks: EnrichedPack[];
  extractedTags: TagCollection;
}

// ============================================
// TYPES DE DONNÉES DÉTAILLÉS
// ============================================

export type FileDistribution = import('@shared/interfaces/BusinessTypes').FileDistribution;
export type DepthAnalysis = import('@shared/interfaces/BusinessTypes').DepthAnalysis;
export type OrganizationPatterns = import('@shared/interfaces/BusinessTypes').OrganizationPatterns;
export type GlobalStatistics = import('@shared/interfaces/BusinessTypes').GlobalStatistics;

export interface AudioMetadata {
  fileId: string;
  duration?: number;  // En secondes
  bpm?: number;
  key?: string;  // Tonalité
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
  format?: string;
  hasLoop?: boolean;
  isOneShot?: boolean;
}

export interface PresetMetadata {
  fileId: string;
  synth: 'serum' | 'vital' | 'massive' | 'sylenth' | 'other';
  presetName?: string;
  author?: string;
  category?: string;
  tags?: string[];
  version?: string;
}

// EnrichedPack est maintenant dans shared/interfaces/BusinessTypes.ts

// ============================================
// TYPES POUR LE CONTROLLER
// ============================================

// Phase1Data déplacé dans shared/interfaces/PipelineTypes.ts

export interface Phase1Summary {
  startTime: number;
  endTime: number;
  duration: number;
  totalPacks: number;
  totalFiles: number;
  totalSize: number;
  duplicatesFound: number;
  duplicatesRemoved: number;
  spaceRecovered: number;
  metadataExtracted: number;
  errors: string[];
  warnings: string[];
}

// ============================================
// CONFIGURATION
// ============================================

export interface Phase1Config {
  enableDuplicateDetection: boolean;
  duplicateStrategy: DuplicateStrategy;
  extractMetadata: boolean;
  metadataTimeout: number;  // Timeout par fichier en ms
  maxDepthScan: number;
  ignoredExtensions: string[];
  minPackSize: number;  // Taille minimum pour considérer un pack
}

export const DEFAULT_PHASE1_CONFIG: Phase1Config = {
  enableDuplicateDetection: true,
  duplicateStrategy: DuplicateStrategy.MANUAL_REVIEW,
  extractMetadata: true,
  metadataTimeout: 1000,  // 1 seconde par fichier
  maxDepthScan: 5,
  ignoredExtensions: ['.txt', '.pdf', '.nfo', '.url', '.ini'],
  minPackSize: 1024 * 1024  // 1 MB minimum
};
