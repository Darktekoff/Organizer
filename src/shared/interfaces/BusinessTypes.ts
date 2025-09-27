/**
 * Pipeline V6 - Types métier partagés
 * Définit les entités métier du domaine musical
 */

/**
 * Type de pack détecté
 */
export type PackType =
  | 'COMMERCIAL_PACK'      // Pack commercial final (Artist - Title)
  | 'BUNDLE_CONTAINER'     // Conteneur avec plusieurs packs
  | 'ORGANIZATION_FOLDER'  // Dossier de rangement générique
  | 'PERSONAL_COLLECTION'  // Collection perso flat
  | 'WRAPPER_FOLDER'       // Dossier wrapper (contient 1 seul sous-dossier)
  | 'UNKNOWN';             // Indéterminé

/**
 * Pack détecté (version V6)
 */
export interface DetectedPackV6 {
  // Identification
  id?: string;
  name: string;
  originalName: string;
  path: string;

  // Classification
  type: PackType;
  confidence: number; // 0-1
  reasoning: string[];

  // Statistiques
  audioFiles: number;
  presetFiles: number;
  totalFiles: number;
  totalSize: number;

  structure: PackStructure;

  // Métadonnées
  needsReorganization: boolean;
  taxonomyMatches?: string[]; // Catégories détectées
  isCommercial?: boolean;
  shouldExtract?: boolean;
  shouldRecurseInside?: boolean;
  detectedAt?: string;
}

/**
 * Breakdown des presets par type de synthétiseur
 */
export interface PresetBreakdown {
  serum: number;
  massive: number;
  vital: number;
  sylenth1: number;
  others: number;
  total: number;
}

/**
 * Structure détaillée d'un pack
 */
export interface PackStructure {
  subfolders: number;
  depth: number;
  hasDocumentation: boolean;
  hasPresets: boolean;
  isFlat: boolean;
  audioFiles?: number;
  presetFiles?: number;
  documentFiles?: number;
  totalFiles?: number;
  avgDepth?: number;
  organizationType?: 'flat' | 'by-type' | 'by-instrument' | 'mixed';
  maxDepth?: number;
  averageSubfolderSize?: number;
  largestSubfolder?: number;
  presetBreakdown?: PresetBreakdown;
}

/**
 * Pack enrichi avec métadonnées additionnelles
 * Généré en Phase 1 après analyse approfondie
 */
export interface EnrichedPack {
  packId: string;
  originalPack: DetectedPackV6;
  fileCount: number;
  audioFiles: number;
  presetFiles: number;
  totalSize: number;
  avgBPM?: number;
  dominantKey?: string;
  tags: string[];
  hasLoops: boolean;
  hasOneShots: boolean;
  hasPresets: boolean;
  metadata: {
    audioFormats: string[];
    presetFormats: string[];
    bpmRange?: { min: number; max: number };
  };
  // Structure interne détectée pour Phase 3
  internalStructure?: {
    detectedFolders: string[];
    detectedTypes: Record<string, { paths?: string[]; fileCount?: number }>;
    detectedFormats: string[];
    folderCount: number;
    maxDepth: number;
    organizationStyle: 'flat' | 'hierarchical' | 'mixed';
  };
  // Ajouté pour Phase 2
  classification?: ClassificationDetails;
  // Informations contextuelles sur le bundle parent pour classification contextuelle
  bundleInfo?: BundleInfo;
}

/**
 * Informations contextuelles sur le bundle parent d'un pack
 * Utilisé pour la classification contextuelle en Phase 2
 */
export interface BundleInfo {
  bundleName: string;           // Nom du bundle parent (ex: "OPS - The Ultimate Harder-Style Production Bundle")
  bundlePath: string;           // Chemin complet vers le bundle
  siblingPacks: string[];       // Autres packs du même bundle pour validation contextuelle
  bundleKeywords: string[];     // Keywords extraits du nom de bundle pour classification
}

export interface FileEntry {
  id: string;
  path: string;
  name: string;
  extension: string;
  size: number;
  packId: string;
  relativePath: string;
  type: 'audio' | 'preset' | 'other';
  createdAt?: Date;
  modifiedAt?: Date;
}

export interface DuplicateGroup {
  signature: string;
  files: FileEntry[];
  count: number;
  sizePerFile: number;
  totalWaste: number;
  suggestedKeep?: string;
}

export enum DuplicateStrategy {
  KEEP_FIRST = 'KEEP_FIRST',
  KEEP_BEST_PATH = 'KEEP_BEST_PATH',
  KEEP_NEWEST = 'KEEP_NEWEST',
  MANUAL_REVIEW = 'MANUAL_REVIEW',
  SKIP = 'SKIP'
}

export interface TagCollection {
  allTags: Set<string>;
  tagFrequency: Map<string, number>;
  packTags: Map<string, string[]>;
  suggestedCategories: string[];
}

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

export interface FileDistribution {
  audio: {
    wav: number;
    mp3: number;
    flac: number;
    other: number;
    total: number;
  };
  presets: {
    serum: number;
    vital: number;
    massive: number;
    other: number;
    total: number;
  };
  other: number;
}

export interface DepthAnalysis {
  maxDepth: number;
  avgDepth: number;
  flatPacks: number;
  deepPacks: number;
  distribution: Record<number, number>;
}

export interface OrganizationPatterns {
  hasTypesFolders: boolean;
  hasFormatsFolders: boolean;
  hasBPMFolders: boolean;
  hasKeyFolders: boolean;
  detectedPatterns: string[];
}

export interface GlobalStatistics {
  avgFilesPerPack: number;
  avgSizePerPack: number;
  largestPack: { name: string; size: number };
  smallestPack: { name: string; size: number };
  totalUniqueExtensions: number;
  mostCommonExtension: string;
}

export enum ClassificationMethod {
  LEXICAL = 'LEXICAL',
  CONTEXTUAL = 'CONTEXTUAL',
  TAXONOMIC = 'TAXONOMIC',
  MANUAL = 'MANUAL',
  AI = 'AI',
  AI_FALLBACK = 'AI_FALLBACK'
}

export interface AlternativeClassification {
  family: string;
  style: string;
  confidence: number;
  reason: string;
}

export interface ClassificationDetails {
  family: string;
  style: string;
  subStyle?: string;
  confidence: number;
  method: ClassificationMethod;
  reasoning?: string | string[];
  matchedKeywords?: string[];
  appliedRules?: string[];
  alternatives?: AlternativeClassification[];
}

export interface ClassifiedPack extends EnrichedPack {
  name?: string;
  classification?: ClassificationDetails;
  classifiedAt: Date;
  quarantineReason?: string;
  needsManualReview: boolean;
  suggestedActions?: string[];
  userOverride?: ClassificationDetails;
}

/**
 * Opération de réorganisation
 */
export interface ReorganizeOperation {
  id?: string;
  type: 'move' | 'rename' | 'clean' | 'unwrap' | 'create_dir' | 'delete';
  sourcePath: string;
  targetPath: string;
  reason: string;
  priority?: number;
  size?: number;
}

/**
 * Pack analysé en profondeur (Phase 1)
 */
export interface AnalyzedPack extends DetectedPackV6 {
  // Analyse approfondie
  contentAnalysis: {
    audioFormats: Map<string, number>; // .wav -> count
    presetFormats: Map<string, number>; // .fxp -> count
    averageFileSize: number;
    totalDuration?: number; // seconds
  };

  // Organisation interne
  internalStructure: {
    categories: string[]; // KICKS, BASS, etc.
    hasOrganization: boolean;
    organizationType?: 'by-type' | 'by-instrument' | 'by-style' | 'mixed' | 'flat';
  };

  // Qualité
  quality: {
    hasReadme: boolean;
    hasLicense: boolean;
    hasMetadata: boolean;
    professionalScore: number; // 0-1
  };
}

/**
 * Distribution des types de fichiers
 */
export interface FileTypeDistribution {
  audio: {
    total: number;
    byExtension: Map<string, number>;
    percentage: number;
  };
  preset: {
    total: number;
    byExtension: Map<string, number>;
    percentage: number;
  };
  midi: {
    total: number;
    percentage: number;
  };
  document: {
    total: number;
    types: string[];
  };
}

/**
 * Configuration pour la détection de packs
 */
export interface DetectionConfig {
  quickScan?: boolean;
  maxDepth?: number;
  minAudioFiles?: number;
  minPackSize?: number; // bytes
  skipHidden?: boolean;
  includePresets?: boolean;
  extensions?: {
    audio?: string[];
    preset?: string[];
  };
}

/**
 * Configuration pour la réorganisation
 */
export interface ReorganizationConfig {
  targetPath?: string;
  cleanNames?: boolean;
  unwrapFolders?: boolean;
  mergeSimilar?: boolean;
  createBackup?: boolean;
  dryRun?: boolean;
  conflictStrategy?: 'skip' | 'rename' | 'overwrite' | 'ask';
}
