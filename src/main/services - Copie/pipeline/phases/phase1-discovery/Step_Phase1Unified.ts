/**
 * Step_Phase1Unified - Architecture simplifiée pour Phase 1
 * Remplace Step_FromSnapshot + legacy steps par une solution unifiée
 * OBJECTIF : Garantir 135 EnrichedPacks pour Phase 2
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  StepExecutor,
  StepResult,
  ProgressCallback
} from '@shared/interfaces/StepContracts';
import type {
  Phase1Data,
  FileEntry,
  DuplicateGroup,
  Phase1Summary
} from './Phase1Types';
import type { DetectedPackV6, EnrichedPack } from '@shared/interfaces/BusinessTypes';
import { DuplicateStrategy } from '@shared/interfaces/BusinessTypes';

/**
 * Input simplifié - Juste le chemin et snapshot optionnel
 */
export interface Phase1UnifiedInput {
  workingPath: string;
  snapshotPath?: string;
}

/**
 * Output garanti - EnrichedPacks pour Phase 2
 */
export interface Phase1UnifiedOutput extends Phase1Data {
  loadedFromSnapshot: boolean;
  processingTime: number;
}

export class Step_Phase1Unified implements StepExecutor<Phase1UnifiedInput, Phase1UnifiedOutput> {

  getName(): string {
    return 'Phase 1 Unified Loader';
  }

  getDescription(): string {
    return 'Charge et convertit les données snapshot en EnrichedPacks pour Phase 2';
  }

  async execute(
    input: Phase1UnifiedInput,
    onProgress?: ProgressCallback
  ): Promise<StepResult<Phase1UnifiedOutput>> {
    const startTime = Date.now();

    try {
      onProgress?.(5, 'Recherche du snapshot enrichi...');

      // 1. Localiser et charger le snapshot
      const snapshotPath = input.snapshotPath ||
        path.join(input.workingPath, '.audio-organizer', 'structure-reorganized.json');

      const snapshotExists = await fs.access(snapshotPath).then(() => true).catch(() => false);
      if (!snapshotExists) {
        return {
          success: false,
          error: {
            code: 'SNAPSHOT_NOT_FOUND',
            message: `Snapshot enrichi non trouvé: ${snapshotPath}`,
            recoverable: false
          },
          canProceed: false
        };
      }

      onProgress?.(10, 'Chargement du snapshot...');
      console.log('📂 Loading enriched snapshot from:', snapshotPath);

      const snapshotContent = await fs.readFile(snapshotPath, 'utf-8');
      const snapshot = JSON.parse(snapshotContent);

      console.log(`✅ Snapshot loaded: ${snapshot.fileIndex?.length || 0} files indexed`);

      // 2. Extraire et convertir les données
      onProgress?.(30, 'Conversion vers EnrichedPacks...');

      // Convertir fileIndex en FileEntry[]
      const fileEntries = this.convertSnapshotToFileEntries(snapshot.fileIndex || []);
      console.log(`🔄 Converted ${fileEntries.length} files to FileEntry format`);

      // Créer packIndex depuis les fichiers
      const packIndex = this.createPackIndexFromFiles(fileEntries);
      console.log(`📦 Created packIndex with ${packIndex.size} packs`);

      onProgress?.(50, 'Génération des EnrichedPacks...');

      // CONVERSION CRITIQUE : packIndex → EnrichedPack[]
      const enrichedPacks = this.convertPackIndexToEnrichedPacks(packIndex, fileEntries);
      console.log(`✅ Generated ${enrichedPacks.length} EnrichedPacks for Phase 2`);

      // VALIDATION CRITIQUE
      if (enrichedPacks.length === 0) {
        console.error('❌ CRITICAL: No EnrichedPacks generated - Phase 2 will fail!');
        return {
          success: false,
          error: {
            code: 'NO_ENRICHED_PACKS',
            message: 'Aucun pack enrichi généré - données snapshot corrompues?',
            recoverable: false
          },
          canProceed: false
        };
      }

      onProgress?.(70, 'Extraction des doublons...');

      // 3. Extraire les doublons pour l'UI
      const duplicates = this.extractDuplicates(snapshot.duplicates || {});
      console.log(`🔍 Found ${duplicates.length} duplicate groups`);

      onProgress?.(90, 'Finalisation...');

      // 4. Construire le résultat final
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      const result: Phase1UnifiedOutput = {
        workingPath: input.workingPath,

        // ✅ SOURCE UNIQUE - EnrichedPacks garantis pour Phase 2
        enrichedPacks,

        // Analyse pour UI
        analysis: this.buildAnalysis(snapshot, enrichedPacks),

        // Indexation pour UI et gestion doublons
        indexing: {
          indexedFiles: fileEntries.length,
          duplicates,
          duplicateStrategy: DuplicateStrategy.MANUAL_REVIEW,
          filesToDelete: null,
          statistics: this.buildIndexingStatistics(duplicates, fileEntries),
          allFiles: fileEntries,
          packIndex,
          packDetails: new Map() // Pas nécessaire pour Phase 2
        },

        // Métadonnées basiques (pas d'extraction complexe)
        metadata: {
          processedFiles: 0,
          audioMetadata: new Map(),
          presetMetadata: new Map(),
          extractedTags: this.extractBasicTags(enrichedPacks),
          extractionStats: {
            processedAudio: 0,
            processedPresets: 0,
            failedExtractions: 0,
            averageBpm: 0,
            keyDistribution: new Map(),
            extractionTime: 0
          }
        },

        // Résumé pour UI
        summary: this.buildSummary(startTime, endTime, snapshot, duplicates, enrichedPacks),

        // Propriétés dépréciées mais encore requises par le type Phase1Data
        deepAnalysisResult: {
          ...this.buildAnalysis(snapshot, enrichedPacks),
          enrichedPacks
        },
        indexingResult: {
          indexedFiles: fileEntries.length,
          allFiles: fileEntries,
          duplicates: duplicates,
          duplicateStrategy: DuplicateStrategy.MANUAL_REVIEW,
          packIndex: new Map(),
          packDetails: new Map(),
          statistics: {
            uniqueFiles: fileEntries.length - duplicates.reduce((sum, group) => sum + group.files.length, 0),
            duplicateFiles: duplicates.reduce((sum, group) => sum + group.files.length, 0),
            wastedSpace: duplicates.reduce((sum, group) => sum + (group.files.length - 1) * group.sizePerFile, 0),
            duplicateRatio: duplicates.length > 0 ? duplicates.reduce((sum, group) => sum + group.files.length, 0) / fileEntries.length : 0,
            topDuplicates: duplicates.slice(0, 10).map(group => ({
              name: group.files[0]?.name || 'Unknown',
              count: group.files.length,
              size: group.sizePerFile
            }))
          }
        },

        // Métadonnées de chargement
        loadedFromSnapshot: true,
        processingTime
      };

      onProgress?.(100, `Phase 1 terminée - ${enrichedPacks.length} packs prêts`);

      console.log(`✅ Phase1Unified completed in ${processingTime}ms`);
      console.log(`📊 Generated ${enrichedPacks.length} EnrichedPacks for Phase 2`);

      return {
        success: true,
        data: result,
        canProceed: true,
        progress: 100
      };

    } catch (error) {
      console.error('❌ Error in Phase1Unified:', error);
      return {
        success: false,
        error: {
          code: 'PHASE1_UNIFIED_ERROR',
          message: error instanceof Error ? error.message : 'Erreur inconnue',
          recoverable: false
        },
        canProceed: false
      };
    }
  }

  /**
   * Convertit les données snapshot en FileEntry[]
   */
  private convertSnapshotToFileEntries(snapshotFiles: any[]): FileEntry[] {
    return snapshotFiles.map((f: any, index: number) => ({
      id: f.id || `file_${index}`,
      name: f.name,
      path: f.path,
      size: f.size,
      type: this.normalizeFileType(f.type),
      extension: f.extension,
      packId: f.pack || 'unknown',
      relativePath: f.relativePath || f.path || `file_${index}`,
      duplicateKey: f.duplicateKey
    }));
  }

  /**
   * Normalise les types de fichiers
   */
  private normalizeFileType(type: string): 'audio' | 'preset' | 'other' {
    if (type === 'AUDIO') return 'audio';
    if (type === 'PRESET') return 'preset';
    return 'other';
  }

  /**
   * Crée un packIndex depuis les fichiers
   */
  private createPackIndexFromFiles(files: FileEntry[]): Map<string, FileEntry[]> {
    const packIndex = new Map<string, FileEntry[]>();

    for (const file of files) {
      if (!packIndex.has(file.packId)) {
        packIndex.set(file.packId, []);
      }
      packIndex.get(file.packId)!.push(file);
    }

    return packIndex;
  }

  /**
   * MÉTHODE CRITIQUE : Convertit packIndex en EnrichedPack[]
   * DOIT garantir des packs pour Phase 2
   */
  private convertPackIndexToEnrichedPacks(
    packIndex: Map<string, FileEntry[]>,
    allFiles: FileEntry[]
  ): EnrichedPack[] {
    console.log(`🔧 Converting packIndex (${packIndex.size} packs) to EnrichedPacks`);

    if (packIndex.size === 0) {
      console.warn('⚠️ packIndex is empty, attempting reconstruction from files');
      // FALLBACK : Reconstruire depuis les fichiers
      return this.reconstructPacksFromFiles(allFiles);
    }

    const enrichedPacks: EnrichedPack[] = [];

    for (const [packId, packFiles] of packIndex.entries()) {
      const enrichedPack = this.createEnrichedPack(packId, packFiles);
      enrichedPacks.push(enrichedPack);
    }

    console.log(`✅ Successfully converted ${enrichedPacks.length} packs`);

    if (enrichedPacks.length === 0) {
      console.error('❌ CRITICAL: No packs created from packIndex');
    }

    return enrichedPacks;
  }

  /**
   * FALLBACK : Reconstruit les packs depuis les fichiers si packIndex vide
   */
  private reconstructPacksFromFiles(files: FileEntry[]): EnrichedPack[] {
    console.log('🔄 Reconstructing packs from files...');

    const packGroups = new Map<string, FileEntry[]>();

    // Grouper les fichiers par pack
    files.forEach(file => {
      if (!file.packId) {
        console.warn(`⚠️ File without packId: ${file.name}`);
        return;
      }

      if (!packGroups.has(file.packId)) {
        packGroups.set(file.packId, []);
      }
      packGroups.get(file.packId)!.push(file);
    });

    console.log(`🔄 Reconstructed ${packGroups.size} packs from ${files.length} files`);

    if (packGroups.size === 0) {
      console.error('❌ CRITICAL: Could not reconstruct any packs from files');
      return [];
    }

    return Array.from(packGroups.entries()).map(([packId, packFiles]) =>
      this.createEnrichedPack(packId, packFiles)
    );
  }

  /**
   * Crée un EnrichedPack depuis un packId et ses fichiers
   */
  private createEnrichedPack(packId: string, packFiles: FileEntry[]): EnrichedPack {
    const audioFiles = packFiles.filter(f => f.type === 'audio');
    const presetFiles = packFiles.filter(f => f.type === 'preset');
    const totalSize = packFiles.reduce((sum, f) => sum + (f.size || 0), 0);

    // Créer DetectedPackV6 basique
    const originalPack: DetectedPackV6 = {
      name: packId,
      originalName: packId,
      path: '', // Sera rempli si nécessaire
      type: 'COMMERCIAL_PACK',
      confidence: 1,
      reasoning: [],
      audioFiles: audioFiles.length,
      presetFiles: presetFiles.length,
      totalFiles: packFiles.length,
      totalSize,
      structure: {
        subfolders: 0,
        depth: 1,
        hasDocumentation: false,
        hasPresets: presetFiles.length > 0,
        isFlat: true
      },
      needsReorganization: false
    };

    return {
      packId,
      originalPack,
      fileCount: packFiles.length,
      audioFiles: audioFiles.length,
      presetFiles: presetFiles.length,
      totalSize,
      avgBPM: null,
      dominantKey: null,
      tags: this.extractTagsFromPackName(packId),
      hasLoops: this.detectLoops(packId),
      hasOneShots: this.detectOneShots(packId),
      hasPresets: presetFiles.length > 0,
      metadata: {
        audioFormats: this.extractAudioFormats(audioFiles),
        presetFormats: this.extractPresetFormats(presetFiles)
      }
    };
  }

  /**
   * Extrait des tags basiques depuis le nom du pack
   */
  private extractTagsFromPackName(packName: string): string[] {
    const tags: string[] = [];
    const name = packName.toLowerCase();

    // Genres
    if (name.includes('hardstyle')) tags.push('Hardstyle');
    if (name.includes('rawstyle')) tags.push('Rawstyle');
    if (name.includes('hardcore')) tags.push('Hardcore');
    if (name.includes('euphoric')) tags.push('Euphoric');

    // Types
    if (name.includes('kick')) tags.push('Kicks');
    if (name.includes('lead')) tags.push('Leads');
    if (name.includes('vocal')) tags.push('Vocals');
    if (name.includes('bass')) tags.push('Bass');

    return tags;
  }

  /**
   * Détection heuristique des loops
   */
  private detectLoops(packName: string): boolean {
    const name = packName.toLowerCase();
    return name.includes('loop') || name.includes('construction') || name.includes('full');
  }

  /**
   * Détection heuristique des one-shots
   */
  private detectOneShots(packName: string): boolean {
    const name = packName.toLowerCase();
    return name.includes('kick') || name.includes('snare') || name.includes('hit') || name.includes('shot');
  }

  /**
   * Extrait les formats audio d'un groupe de fichiers
   */
  private extractAudioFormats(audioFiles: FileEntry[]): string[] {
    const formats = new Set<string>();
    audioFiles.forEach(f => {
      if (f.extension) formats.add(f.extension);
    });
    return Array.from(formats);
  }

  /**
   * Extrait les formats de presets d'un groupe de fichiers
   */
  private extractPresetFormats(presetFiles: FileEntry[]): string[] {
    const formats = new Set<string>();
    presetFiles.forEach(f => {
      if (f.extension) formats.add(f.extension);
    });
    return Array.from(formats);
  }

  /**
   * Extrait les doublons depuis le snapshot
   */
  private extractDuplicates(duplicatesData: any): DuplicateGroup[] {
    const duplicateGroups = duplicatesData.duplicateGroups || [];

    return duplicateGroups.map((g: any) => ({
      signature: g.key,
      files: g.files || [],
      sizePerFile: g.count > 0 ? g.totalSize / g.count : 0,
      count: g.count || 0,
      totalSize: g.totalSize || 0
    }));
  }

  /**
   * Construit les données d'analyse pour l'UI
   */
  private buildAnalysis(snapshot: any, enrichedPacks: EnrichedPack[]): any {
    const fileIndex = snapshot.fileIndex || [];

    return {
      totalPacks: enrichedPacks.length,
      totalFiles: fileIndex.length,
      totalSize: fileIndex.reduce((sum: number, f: any) => sum + (f.size || 0), 0),
      fileDistribution: {
        audio: {
          total: fileIndex.filter((f: any) => f.type === 'AUDIO').length,
          byExtension: {}
        },
        presets: {
          total: fileIndex.filter((f: any) => f.type === 'PRESET').length,
          byType: {}
        },
        other: fileIndex.filter((f: any) => f.type === 'OTHER').length
      },
      depthAnalysis: {
        maxDepth: 5, // Valeur par défaut
        averageDepth: 3,
        distribution: {}
      },
      organizationPatterns: {
        byType: ['Kicks', 'Leads', 'Vocals'],
        byGenre: ['Hardstyle', 'Rawstyle'],
        byFormat: ['Loops', 'OneShots'],
        taxonomy: {
          detected: true,
          patterns: ['Kicks', 'Leads', 'Hardstyle']
        }
      },
      statistics: {
        averagePackSize: enrichedPacks.length > 0
          ? enrichedPacks.reduce((sum, p) => sum + p.totalSize, 0) / enrichedPacks.length
          : 0,
        largestPack: this.findLargestPack(enrichedPacks),
        smallestPack: this.findSmallestPack(enrichedPacks),
        emptyFolders: 0
      }
    };
  }

  /**
   * Construit les statistiques d'indexation
   */
  private buildIndexingStatistics(duplicates: DuplicateGroup[], files: FileEntry[]): any {
    const totalDuplicates = duplicates.reduce((sum, g) => sum + (g.count || 0), 0);

    return {
      uniqueFiles: files.length - totalDuplicates,
      duplicateFiles: totalDuplicates,
      wastedSpace: duplicates.reduce((sum, g) => sum + ((g as any).totalSize || 0), 0),
      duplicateRatio: files.length > 0 ? totalDuplicates / files.length : 0,
      topDuplicates: duplicates.slice(0, 5).map(g => ({
        name: g.signature || 'Unknown',
        count: g.count || 0,
        size: (g as any).totalSize || 0
      }))
    };
  }

  /**
   * Extrait des tags basiques pour la collection
   */
  private extractBasicTags(enrichedPacks: EnrichedPack[]): any {
    const allTags = new Set<string>();
    const tagFrequency = new Map<string, number>();
    const packTags = new Map<string, string[]>();

    enrichedPacks.forEach(pack => {
      packTags.set(pack.packId, pack.tags);
      pack.tags.forEach(tag => {
        allTags.add(tag);
        tagFrequency.set(tag, (tagFrequency.get(tag) || 0) + 1);
      });
    });

    return {
      allTags,
      tagFrequency,
      packTags,
      suggestedCategories: Array.from(tagFrequency.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag]) => tag)
    };
  }

  /**
   * Construit le résumé de la Phase 1
   */
  private buildSummary(
    startTime: number,
    endTime: number,
    snapshot: any,
    duplicates: DuplicateGroup[],
    enrichedPacks: EnrichedPack[]
  ): Phase1Summary {
    const duplicatesFound = duplicates.reduce((sum, g) => sum + (g.count || 0), 0);
    const wastedSpace = duplicates.reduce((sum, g) => sum + ((g as any).totalSize || 0), 0);

    return {
      startTime,
      endTime,
      duration: endTime - startTime,
      totalPacks: enrichedPacks.length,
      totalFiles: snapshot.fileIndex?.length || 0,
      totalSize: snapshot.fileIndex?.reduce((sum: number, f: any) => sum + (f.size || 0), 0) || 0,
      duplicatesFound,
      duplicatesRemoved: 0,
      spaceRecovered: wastedSpace,
      metadataExtracted: 0,
      errors: [],
      warnings: []
    };
  }

  /**
   * Trouve le pack le plus gros
   */
  private findLargestPack(packs: EnrichedPack[]): string {
    if (packs.length === 0) return '';
    return packs.reduce((largest, pack) =>
      pack.totalSize > largest.totalSize ? pack : largest
    ).packId;
  }

  /**
   * Trouve le pack le plus petit
   */
  private findSmallestPack(packs: EnrichedPack[]): string {
    if (packs.length === 0) return '';
    return packs.reduce((smallest, pack) =>
      pack.totalSize < smallest.totalSize ? pack : smallest
    ).packId;
  }

  validate(input: Phase1UnifiedInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!input.workingPath) {
      errors.push('Le chemin de travail est requis');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  canRetry(): boolean {
    return true;
  }

  estimateTime(input: Phase1UnifiedInput): number {
    return 2; // 2 secondes pour charger depuis le snapshot
  }
}