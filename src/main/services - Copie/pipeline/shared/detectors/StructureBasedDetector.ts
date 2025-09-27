/**
 * StructureBasedDetector - Détecteur hiérarchique intelligent
 * Analyse niveau 1 (packs individuels + bundles) puis sous-packs niveau 2.
 */

import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';

export interface DirectoryNode {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
  mtime: number;
  children?: DirectoryNode[];
}

export interface DetectedPack {
  name: string;
  path: string;
  type: 'pack' | 'bundle';
  audioFiles: number;
  totalSize: number;
  subPacks?: DetectedPack[];
  confidence: number;
  detectionReason: string[];
  scoreBreakdown?: PackScoreBreakdown;
}

export interface DetectionResult {
  detectedPacks: DetectedPack[];
  totalPacks: number;
  bundlesFound: number;
  analysisStats: DetectionStats;
}

interface DetectionStats {
  level1Entities: number;
  individualPacks: number;
  bundlesDetected: number;
  subPacksInBundles: number;
  totalCommercialPacks: number;
  falsePositivesFiltered: number;
  foldersAnalyzed: number;
  directWavFiles: number;
  organizedFolders: number;
  namePatternMatches: number;
}

interface PackScoreBreakdown {
  nameScore: number;
  keywordScore: number;
  structureScore: number;
  labelScore: number;
  directContentScore: number;
  sizeScore: number;
}

interface PackEvaluationOptions {
  threshold: number;
  minAudioFiles: number;
  minSizeBytes: number;
  minAudioRatio: number;
  context: 'level1' | 'bundle';
}

interface PackStatContribution {
  namePatternMatches: number;
  organizedFolders: number;
  directWavFiles: number;
}

interface PackEvaluationResult {
  detectedPack: DetectedPack | null;
  totalScore: number;
  breakdown: PackScoreBreakdown;
  positiveReasons: string[];
  statContribution: PackStatContribution;
  contentValidation: { valid: boolean; reason?: string };
  meta: {
    namePatternMatched: boolean;
    matchedKeywords: string[];
    matchedLabels: string[];
    organizedFolderCount: number;
    directWavCount: number;
    audioFileCount: number;
    totalSizeBytes: number;
  };
}

interface BundleAnalysisResult {
  subPacks: DetectedPack[];
  contributions: PackStatContribution[];
  evaluations: Array<{
    name: string;
    score: number;
    accepted: boolean;
    validationFailure?: string;
  }>;
  totalCandidates: number;
}

interface BundleIndicators {
  matchedKeywords: string[];
  labelHint: boolean;
}

export class StructureBasedDetector {
  private static readonly MB = 1024 * 1024;
  private static readonly GB = StructureBasedDetector.MB * 1024;
  private static readonly PACK_THRESHOLD = 45;
  private static readonly SUBPACK_THRESHOLD = 35;
  private static readonly KNOWN_LABELS = [
    'OPS',
    'ON POINT SAMPLES',
    'INDUSTRIAL STRENGTH',
    'INDUSTRIAL STRENGHT',
    'SINGOMAKERS',
    'BIG EDM',
    'NS AUDIO',
    'FRAGMENT AUDIO',
    'SCREECH HOUSE',
    'THERACORDS',
    'XTREME',
    'SUBSEKT'
  ];

  private taxonomy: any;
  private flatTaxonomyKeywords: string[] = [];
  private bundleKeywords: string[] = [];
  private readonly debugMode: boolean;

  constructor(private taxonomyPath?: string, debugMode = false) {
    this.debugMode = debugMode;
    this.loadTaxonomy();
  }

  private loadTaxonomy(): void {
    try {
      const defaultPath = path.join(__dirname, '../taxonomies/pack-detection-v6.yaml');
      const yamlPath = this.taxonomyPath || defaultPath;
      const yamlContent = fs.readFileSync(yamlPath, 'utf8');
      this.taxonomy = yaml.load(yamlContent) as any;
    } catch (error) {
      console.error('Erreur chargement taxonomie:', error);
      this.taxonomy = {};
    }

    const categories = this.taxonomy?.categories || {};
    const keywordSet = new Set<string>();
    const bundleKeywords = categories.BUNDLE_KEYWORDS ?? [];

    for (const category of Object.values(categories)) {
      if (Array.isArray(category)) {
        for (const entry of category) {
          if (typeof entry === 'string') {
            keywordSet.add(entry.toUpperCase());
          }
        }
      }
    }

    this.flatTaxonomyKeywords = Array.from(keywordSet);
    this.bundleKeywords = Array.isArray(bundleKeywords)
      ? bundleKeywords.map((keyword: string) => keyword.toUpperCase())
      : [
          'BUNDLE',
          'COLLECTION',
          'SUITE',
          'COMPILATION',
          'ALL IN ONE',
          'COMPLETE',
          'MEGA PACK',
          'MEGA_PACK',
          'ULTIMATE',
          'MASTER',
          'PREMIUM',
          'DELUXE'
        ];
  }

  async execute(
    input: {
      sourcePath: string;
      snapshotPath: string;
      maxDepth?: number;
      excludePatterns?: string[];
      minAudioFiles?: number;
    },
    onProgress?: (progress: number, message?: string) => void
  ): Promise<{
    success: boolean;
    data?: {
      detectedPacks: DetectedPack[];
      totalPacks: number;
      bundlesFound: number;
      analysisStats: DetectionStats;
    };
    error?: any;
  }> {
    try {
      onProgress?.(0, 'Chargement de la structure JSON...');

      if (!fs.existsSync(input.snapshotPath)) {
        throw new Error(`Structure JSON non trouvée: ${input.snapshotPath}`);
      }

      const jsonContent = fs.readFileSync(input.snapshotPath, 'utf8');
      const rootNode = JSON.parse(jsonContent) as DirectoryNode;

      onProgress?.(50, 'Analyse de la structure...');

      const result = this.analyzeStructure(rootNode);

      onProgress?.(100, 'Analyse terminée');

      return {
        success: true,
        data: {
          detectedPacks: result.detectedPacks,
          totalPacks: result.totalPacks,
          bundlesFound: result.bundlesFound,
          analysisStats: result.analysisStats
        }
      };
    } catch (error) {
      console.error('[StructureBasedDetector] Erreur:', error);
      return {
        success: false,
        error
      };
    }
  }

  analyzeStructure(rootNode: DirectoryNode): DetectionResult {
    this.logDebug('Analyse hiérarchique niveau 1 -> niveau 2');

    const result: DetectionResult = {
      detectedPacks: [],
      totalPacks: 0,
      bundlesFound: 0,
      analysisStats: {
        level1Entities: 0,
        individualPacks: 0,
        bundlesDetected: 0,
        subPacksInBundles: 0,
        totalCommercialPacks: 0,
        falsePositivesFiltered: 0,
        foldersAnalyzed: 0,
        directWavFiles: 0,
        organizedFolders: 0,
        namePatternMatches: 0
      }
    };

    if (!rootNode.children || rootNode.children.length === 0) {
      this.logDebug('Structure racine sans contenu.');
      return result;
    }

    const level1Directories = rootNode.children.filter(child => child.type === 'directory');
    result.analysisStats.level1Entities = level1Directories.length;
    result.analysisStats.foldersAnalyzed = level1Directories.length;

    for (const dir of level1Directories) {
      const detection = this.analyzeFirstLevel(dir, result.analysisStats);

      if (detection) {
        result.detectedPacks.push(detection);

        if (detection.type === 'bundle') {
          result.analysisStats.bundlesDetected++;
          result.bundlesFound++;
          const subCount = detection.subPacks?.length ?? 0;
          result.analysisStats.subPacksInBundles += subCount;
          result.analysisStats.totalCommercialPacks += subCount;
        } else {
          result.analysisStats.individualPacks++;
          result.analysisStats.totalCommercialPacks++;
        }

        this.logDebug(`✅ ${detection.type.toUpperCase()} détecté: ${detection.name}`);
      } else {
        result.analysisStats.falsePositivesFiltered++;
      }
    }

    result.totalPacks = result.analysisStats.totalCommercialPacks;
    this.logDebug(
      `Résumé: ${result.analysisStats.individualPacks} packs individuels, ` +
        `${result.analysisStats.bundlesDetected} bundles, ` +
        `${result.analysisStats.subPacksInBundles} sous-packs`
    );

    return result;
  }

  private analyzeFirstLevel(directory: DirectoryNode, stats: DetectionStats): DetectedPack | null {
    // Les bundles sont détectés avant les packs pour éviter la confusion pack/bundle.
    const bundleCandidate = this.evaluateBundleCandidate(directory, stats);
    if (bundleCandidate) {
      return bundleCandidate;
    }

    const packEvaluation = this.evaluatePackCandidate(directory, {
      threshold: StructureBasedDetector.PACK_THRESHOLD,
      minAudioFiles: 30,
      minSizeBytes: 50 * StructureBasedDetector.MB,
      minAudioRatio: 0.3,
      context: 'level1'
    });

    this.logPackEvaluation(directory.name, packEvaluation, StructureBasedDetector.PACK_THRESHOLD, 'niveau-1');

    if (packEvaluation.detectedPack) {
      this.applyStatContribution(stats, packEvaluation.statContribution);
      return packEvaluation.detectedPack;
    }

    return null;
  }

  private evaluateBundleCandidate(directory: DirectoryNode, stats: DetectionStats): DetectedPack | null {
    const subDirectories = directory.children?.filter(child => child.type === 'directory') ?? [];

    if (subDirectories.length < 3) {
      return null;
    }

    const indicators = this.checkBundleIndicators(directory.name);
    const totalSize = this.calculateTotalSize(directory);
    const audioFiles = this.countTotalAudioFiles(directory);

    const bundleAnalysis = this.analyzeBundleContents(directory, subDirectories);
    const subPackCount = bundleAnalysis.subPacks.length;
    const ratio = subDirectories.length > 0 ? subPackCount / subDirectories.length : 0;

    const isLargeCollection = totalSize >= 5 * StructureBasedDetector.GB || audioFiles >= 5000 || subDirectories.length >= 15;
    const hasKeywordSupport = indicators.matchedKeywords.length > 0;
    const hasLabelSupport = indicators.labelHint;

    const qualifies =
      (hasKeywordSupport && ratio >= 0.5 && subPackCount >= 3) ||
      (isLargeCollection && ratio >= 0.6) ||
      (hasLabelSupport && ratio >= 0.6 && subPackCount >= 5);

    if (!qualifies) {
      this.logDebug(
        `[BUNDLE?] ${directory.name} -> ratio ${(ratio * 100).toFixed(1)}% (${subPackCount}/${subDirectories.length}) non suffisant`
      );
      return null;
    }

    for (const contribution of bundleAnalysis.contributions) {
      this.applyStatContribution(stats, contribution);
    }

    const reasons: string[] = [];
    if (hasKeywordSupport) {
      reasons.push(`Mot-clé bundle: ${indicators.matchedKeywords.join(', ')}`);
    }
    if (hasLabelSupport) {
      reasons.push('Label majeur détecté dans le nom');
    }
    reasons.push(`${subPackCount}/${subDirectories.length} sous-dossiers reconnus comme packs (${(ratio * 100).toFixed(1)}%)`);
    reasons.push(`${audioFiles} fichiers audio agrégés dans le bundle`);
    reasons.push(`Taille totale ${(totalSize / StructureBasedDetector.GB).toFixed(2)} GB`);

    const detection: DetectedPack = {
      name: directory.name,
      path: directory.path,
      type: 'bundle',
      audioFiles,
      totalSize,
      subPacks: bundleAnalysis.subPacks,
      confidence: Math.min(100, Math.round(ratio * 100) + (hasKeywordSupport ? 5 : 0)),
      detectionReason: reasons
    };

    this.logDebug(`→ Bundle confirmé: ${directory.name} (${subPackCount} sous-packs)`);
    return detection;
  }

  private analyzeBundleContents(directory: DirectoryNode, subDirectories: DirectoryNode[]): BundleAnalysisResult {
    const subPacks: DetectedPack[] = [];
    const contributions: PackStatContribution[] = [];
    const evaluations: BundleAnalysisResult['evaluations'] = [];

    for (const subDir of subDirectories) {
      const evaluation = this.evaluatePackCandidate(subDir, {
        threshold: StructureBasedDetector.SUBPACK_THRESHOLD,
        minAudioFiles: 15,
        minSizeBytes: 20 * StructureBasedDetector.MB,
        minAudioRatio: 0.25,
        context: 'bundle'
      });

      this.logPackEvaluation(subDir.name, evaluation, StructureBasedDetector.SUBPACK_THRESHOLD, 'bundle');

      evaluations.push({
        name: subDir.name,
        score: evaluation.totalScore,
        accepted: Boolean(evaluation.detectedPack),
        validationFailure: evaluation.contentValidation.valid ? undefined : evaluation.contentValidation.reason
      });

      if (evaluation.detectedPack) {
        subPacks.push(evaluation.detectedPack);
        contributions.push(evaluation.statContribution);
      }
    }

    this.logDebug(
      `[BUNDLE ANALYSE] ${directory.name}: ${subPacks.length}/${subDirectories.length} sous-dossiers validés`
    );

    return {
      subPacks,
      contributions,
      evaluations,
      totalCandidates: subDirectories.length
    };
  }

  private evaluatePackCandidate(directory: DirectoryNode, options: PackEvaluationOptions): PackEvaluationResult {
    const breakdown: PackScoreBreakdown = {
      nameScore: 0,
      keywordScore: 0,
      structureScore: 0,
      labelScore: 0,
      directContentScore: 0,
      sizeScore: 0
    };

    const positiveReasons: string[] = [];

    const nameScoring = this.scoreNamePattern(directory.name);
    breakdown.nameScore = nameScoring.score;
    if (nameScoring.score > 0) {
      positiveReasons.push(...nameScoring.reasons);
    }

    const keywordScoring = this.scoreCommercialKeywords(directory.name);
    breakdown.keywordScore = keywordScoring.score;
    if (keywordScoring.score > 0) {
      positiveReasons.push(`Mots-clés commerciaux: ${keywordScoring.matchedKeywords.join(', ')}`);
    }

    const labelScoring = this.scoreLabelIndicators(directory.name);
    breakdown.labelScore = labelScoring.score;
    if (labelScoring.score > 0) {
      positiveReasons.push(`Label reconnu: ${labelScoring.matchedLabels.join(', ')}`);
    }

    const organizedFolderCount = this.countOrganizedFolders(directory);
    if (organizedFolderCount >= 2) {
      breakdown.structureScore = Math.min(20, 8 + (organizedFolderCount - 2) * 3);
      positiveReasons.push(`Structure organisée (${organizedFolderCount} dossiers taxonomiques)`);
    } else if (organizedFolderCount === 1) {
      breakdown.structureScore = 6;
      positiveReasons.push('Structure organisée minimale (1 dossier identifié)');
    }

    const directWavCount = this.countDirectWavFiles(directory);
    if (directWavCount >= 10) {
      breakdown.directContentScore = 15;
      positiveReasons.push(`${directWavCount} fichiers WAV au premier niveau`);
    } else if (directWavCount >= 5) {
      breakdown.directContentScore = 8;
      positiveReasons.push(`${directWavCount} fichiers WAV au premier niveau`);
    }

    const totalSizeBytes = this.calculateTotalSize(directory);
    if (totalSizeBytes >= options.minSizeBytes) {
      breakdown.sizeScore = 10;
      positiveReasons.push(`Taille substantielle ${(totalSizeBytes / StructureBasedDetector.MB).toFixed(0)} MB`);
    } else if (totalSizeBytes >= options.minSizeBytes * 0.6) {
      breakdown.sizeScore = 6;
      positiveReasons.push(`Taille ${Math.round(totalSizeBytes / StructureBasedDetector.MB)} MB`);
    }

    const audioFileCount = this.countTotalAudioFiles(directory);
    if (audioFileCount > 0) {
      positiveReasons.push(`${audioFileCount} fichiers audio détectés`);
    }

    const totalScore = Math.min(
      breakdown.nameScore +
        breakdown.keywordScore +
        breakdown.structureScore +
        breakdown.labelScore +
        breakdown.directContentScore +
        breakdown.sizeScore,
      100
    );

    const totalFiles = this.countTotalFiles(directory);
    const contentValidation = this.validateRealContent(
      {
        audioFiles: audioFileCount,
        totalFiles,
        totalSizeBytes,
        directWavCount
      },
      options
    );

    let detectedPack: DetectedPack | null = null;
    const statContribution: PackStatContribution = {
      namePatternMatches: nameScoring.score > 0 ? 1 : 0,
      organizedFolders: organizedFolderCount,
      directWavFiles: directWavCount
    };

    if (totalScore >= options.threshold && contentValidation.valid) {
      detectedPack = {
        name: directory.name,
        path: directory.path,
        type: 'pack',
        audioFiles: audioFileCount,
        totalSize: totalSizeBytes,
        confidence: totalScore,
        detectionReason: positiveReasons,
        scoreBreakdown: breakdown
      };
    }

    return {
      detectedPack,
      totalScore,
      breakdown,
      positiveReasons,
      statContribution,
      contentValidation,
      meta: {
        namePatternMatched: nameScoring.matchedPattern,
        matchedKeywords: keywordScoring.matchedKeywords,
        matchedLabels: labelScoring.matchedLabels,
        organizedFolderCount,
        directWavCount,
        audioFileCount,
        totalSizeBytes
      }
    };
  }

  private validateRealContent(
    content: { audioFiles: number; totalFiles: number; totalSizeBytes: number; directWavCount: number },
    options: Pick<PackEvaluationOptions, 'minAudioFiles' | 'minSizeBytes' | 'minAudioRatio'>
  ): { valid: boolean; reason?: string } {
    if (content.audioFiles === 0 && content.directWavCount === 0) {
      return { valid: false, reason: 'Aucun fichier audio détecté' };
    }

    if (content.audioFiles < options.minAudioFiles && content.totalSizeBytes < options.minSizeBytes) {
      return {
        valid: false,
        reason: `Contenu insuffisant (${content.audioFiles} audio / ${(content.totalSizeBytes / StructureBasedDetector.MB).toFixed(1)} MB)`
      };
    }

    const ratio = content.totalFiles > 0 ? content.audioFiles / content.totalFiles : 0;
    if (ratio < options.minAudioRatio && content.directWavCount < 5) {
      return {
        valid: false,
        reason: `Ratio audio trop faible (${(ratio * 100).toFixed(1)}%)`
      };
    }

    return { valid: true };
  }

  private scoreNamePattern(folderName: string): { score: number; reasons: string[]; matchedPattern: boolean } {
    const reasons: string[] = [];
    let score = 0;
    let matchedPattern = false;

    const artistTitlePattern = /^[^-]+ - [^-]+/;
    if (artistTitlePattern.test(folderName)) {
      score += 30;
      matchedPattern = true;
      reasons.push('Nom format "Artiste - Titre"');
    }

    const volumePattern = /(\bVol(?:ume)?\.?\s*\d+)|(\bV\s*\d+)|(\bPart\s*\d+)/i;
    if (volumePattern.test(folderName)) {
      score = Math.min(40, score + 12);
      reasons.push('Numérotation Vol./Part détectée');
    }

    const editionPattern = /(Edition|Series|Suite|Collection)/i;
    if (!matchedPattern && editionPattern.test(folderName)) {
      score = Math.max(score, 18);
      reasons.push('Nom suggérant une édition/série');
    }

    return { score: Math.min(score, 40), reasons, matchedPattern };
  }

  private scoreCommercialKeywords(folderName: string): { score: number; matchedKeywords: string[] } {
    const keywords = [
      'pack',
      'sample',
      'kit',
      'collection',
      'bundle',
      'suite',
      'essentials',
      'essential',
      'ultimate',
      'premium',
      'exclusive',
      'tools',
      'soundset',
      'sound pack',
      'construction kit'
    ];

    const normalizedName = folderName.toLowerCase();
    const matchedKeywords = keywords.filter(keyword => normalizedName.includes(keyword));

    let score = 0;
    if (matchedKeywords.length > 0) {
      score = 15 + Math.min(10, (matchedKeywords.length - 1) * 5);
    }

    return { score: Math.min(score, 25), matchedKeywords };
  }

  private scoreLabelIndicators(folderName: string): { score: number; matchedLabels: string[] } {
    const upperName = folderName.toUpperCase();
    const matchedLabels = StructureBasedDetector.KNOWN_LABELS.filter(label => upperName.includes(label));
    const score = matchedLabels.length > 0 ? 15 : 0;
    return { score, matchedLabels };
  }

  private checkBundleIndicators(folderName: string): BundleIndicators {
    const upperName = folderName.toUpperCase();
    const matchedKeywords = this.bundleKeywords.filter(keyword => upperName.includes(keyword));
    const labelHint = StructureBasedDetector.KNOWN_LABELS.some(label => upperName.includes(label));
    return { matchedKeywords, labelHint };
  }

  private applyStatContribution(stats: DetectionStats, contribution: PackStatContribution): void {
    stats.namePatternMatches += contribution.namePatternMatches;
    stats.organizedFolders += contribution.organizedFolders;
    stats.directWavFiles += contribution.directWavFiles;
  }

  private logPackEvaluation(
    folderName: string,
    evaluation: PackEvaluationResult,
    threshold: number,
    context: string
  ): void {
    if (!this.debugMode) {
      return;
    }

    const { breakdown, totalScore, positiveReasons, contentValidation } = evaluation;

    console.log(`[SCORE DETAIL][${context}] ${folderName}`);
    console.log(`  - Nom: ${breakdown.nameScore} pts`);
    console.log(`  - Mots-clés: ${breakdown.keywordScore} pts`);
    console.log(`  - Structure: ${breakdown.structureScore} pts`);
    console.log(`  - Labels: ${breakdown.labelScore} pts`);
    console.log(`  - Contenu direct: ${breakdown.directContentScore} pts`);
    console.log(`  - Taille: ${breakdown.sizeScore} pts`);
    console.log(`  - TOTAL: ${totalScore} pts (seuil ${threshold}) => ${evaluation.detectedPack ? 'ACCEPTÉ' : 'REFUSÉ'}`);

    if (positiveReasons.length > 0) {
      console.log(`  - Raisons: ${positiveReasons.join(' | ')}`);
    }

    if (!contentValidation.valid && contentValidation.reason) {
      console.log(`  - Validation contenu: ${contentValidation.reason}`);
    }
  }

  private logDebug(message: string): void {
    if (this.debugMode) {
      console.log(`[StructureBasedDetector][DEBUG] ${message}`);
    }
  }

  private countOrganizedFolders(directory: DirectoryNode): number {
    if (!directory.children) {
      return 0;
    }

    const subFolders = directory.children.filter(child => child.type === 'directory');

    let organizedCount = 0;
    for (const folder of subFolders) {
      const folderName = folder.name.toUpperCase();
      if (this.flatTaxonomyKeywords.some(keyword => folderName.includes(keyword))) {
        organizedCount++;
      }
    }

    return organizedCount;
  }

  private countDirectWavFiles(directory: DirectoryNode): number {
    if (!directory.children) {
      return 0;
    }

    return directory.children.filter(
      child => child.type === 'file' && /\.(wav|wave)$/i.test(child.name)
    ).length;
  }

  private countTotalAudioFiles(directory: DirectoryNode): number {
    if (!directory.children) {
      return 0;
    }

    let count = 0;

    for (const child of directory.children) {
      if (child.type === 'file' && /\.(wav|mp3|aif|aiff|flac|ogg)$/i.test(child.name)) {
        count++;
      } else if (child.type === 'directory') {
        count += this.countTotalAudioFiles(child);
      }
    }

    return count;
  }

  private countTotalFiles(directory: DirectoryNode): number {
    if (!directory.children) {
      return 0;
    }

    let count = 0;

    for (const child of directory.children) {
      if (child.type === 'file') {
        count++;
      } else if (child.type === 'directory') {
        count += this.countTotalFiles(child);
      }
    }

    return count;
  }

  private calculateTotalSize(directory: DirectoryNode): number {
    if (!directory.children) {
      return directory.size ?? 0;
    }

    let totalSize = 0;

    for (const child of directory.children) {
      if (child.type === 'file') {
        totalSize += child.size ?? 0;
      } else if (child.type === 'directory') {
        totalSize += this.calculateTotalSize(child);
      }
    }

    return totalSize;
  }
}

