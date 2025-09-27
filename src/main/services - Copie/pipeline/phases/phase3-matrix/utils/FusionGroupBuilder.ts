/**
 * FusionGroupBuilder - Construit les groupes de fusion depuis les clusters détectés
 * Génère les chemins cibles et gère les conflits de fusion
 */

import type { ClassifiedPack } from '@shared/interfaces/BusinessTypes';
import type { EnrichedPack } from '@shared/interfaces/BusinessTypes';
import type { FolderCluster, FolderPath } from './FolderClusterEngine';
import { TaxonomyLoader } from './TaxonomyLoader';

export interface FusionGroup {
  id: string;
  canonical: string;
  targetPath: string;
  classification: {
    family: string;
    style: string;
    type: string;
    format?: string;
    variant?: string;
  };
  sourceFiles: SourceFileMapping[];
  statistics: FusionStatistics;
  confidence: number;
  metadata: {
    clusterInfo: {
      avgSimilarity: number;
      packCount: number;
      originalPaths: string[];
    };
  };
}

export interface SourceFileMapping {
  packId: string;
  packName: string;
  originalPath: string;
  fileCount: number;
  estimatedSize: number;
  confidence: number;
}

export interface FusionStatistics {
  totalFiles: number;
  totalPacks: number;
  estimatedSize: number;
  duplicateRisk: number; // 0-1 : risque de doublons
  complexityScore: number; // 0-1 : complexité de la fusion
}

export interface ConflictResolution {
  groupId1: string;
  groupId2: string;
  conflictType: 'overlap' | 'ambiguous' | 'duplicate';
  resolution: 'merge' | 'split' | 'ignore' | 'manual';
  confidence: number;
  reason: string;
}

export interface FusionBuilderConfig {
  minGroupSize?: number;
  maxGroupSize?: number;
  conflictThreshold?: number;
  useFullPath?: boolean;
  preservePackStructure?: boolean;
}

export class FusionGroupBuilder {
  private config: Required<FusionBuilderConfig>;
  private taxonomy: any;
  private groupCounter = 0;

  constructor(config?: FusionBuilderConfig) {
    this.config = {
      minGroupSize: 1,
      maxGroupSize: 1000,
      conflictThreshold: 0.3,
      useFullPath: true,
      preservePackStructure: false,
      ...config
    };
  }

  /**
   * Initialise avec la taxonomie
   */
  async initialize(taxonomyPath?: string): Promise<void> {
    this.taxonomy = await TaxonomyLoader.load(taxonomyPath);
  }

  /**
   * Construit les groupes de fusion depuis les clusters
   */
  async buildFusionGroups(
    clusters: FolderCluster[],
    packs: ClassifiedPack[]
  ): Promise<FusionGroup[]> {
    console.log(`[FusionBuilder] Building fusion groups from ${clusters.length} clusters`);

    const fusionGroups: FusionGroup[] = [];

    // Créer un index des packs par ID pour accès rapide
    const packIndex = new Map(packs.map(p => [p.packId, p]));

    // Traiter chaque cluster
    for (const cluster of clusters) {
      // Ignorer les clusters trop petits ou trop grands
      if (cluster.members.length < this.config.minGroupSize ||
          cluster.members.length > this.config.maxGroupSize) {
        continue;
      }

      // Analyser le contexte du cluster pour déterminer la classification
      const classification = this.analyzeClusterClassification(cluster, packIndex);

      // Générer le chemin cible
      const targetPath = this.generateTargetPath(cluster, classification);

      // Créer les mappings de fichiers sources
      const sourceFiles = this.createSourceMappings(cluster, packIndex);

      // Calculer les statistiques
      const statistics = this.calculateStatistics(sourceFiles, cluster);

      // Créer le groupe de fusion
      const fusionGroup: FusionGroup = {
        id: `fusion_${++this.groupCounter}`,
        canonical: cluster.canonical,
        targetPath,
        classification,
        sourceFiles,
        statistics,
        confidence: cluster.confidence,
        metadata: {
          clusterInfo: {
            avgSimilarity: cluster.statistics.avgSimilarity,
            packCount: cluster.statistics.packCount,
            originalPaths: cluster.members.map(m => m.path)
          }
        }
      };

      fusionGroups.push(fusionGroup);
    }

    console.log(`[FusionBuilder] Created ${fusionGroups.length} fusion groups`);

    // Résoudre les conflits entre groupes
    const conflicts = await this.resolveConflicts(fusionGroups);

    // Appliquer les résolutions de conflits
    const resolvedGroups = this.applyConflictResolutions(fusionGroups, conflicts);

    return resolvedGroups;
  }

  /**
   * Analyse la classification d'un cluster basé sur ses membres
   */
  private analyzeClusterClassification(
    cluster: FolderCluster,
    packIndex: Map<string, ClassifiedPack>
  ): FusionGroup['classification'] {
    // Agrégation des classifications des packs contenant ce cluster
    const classifications = new Map<string, number>();
    const families = new Map<string, number>();
    const styles = new Map<string, number>();
    const types = new Map<string, number>();

    for (const member of cluster.members) {
      const pack = packIndex.get(member.packId);
      if (!pack?.classification) continue;

      // Compter les occurrences
      const classKey = `${pack.classification.family}-${pack.classification.style}`;
      classifications.set(classKey, (classifications.get(classKey) || 0) + 1);

      families.set(pack.classification.family, (families.get(pack.classification.family) || 0) + 1);
      styles.set(pack.classification.style, (styles.get(pack.classification.style) || 0) + 1);

      // Analyser le type depuis le chemin
      const detectedType = this.detectTypeFromPath(member.path);
      if (detectedType) {
        types.set(detectedType, (types.get(detectedType) || 0) + 1);
      }
    }

    // Sélectionner les valeurs majoritaires
    const family = this.getMostFrequent(families) || 'Unknown';
    const style = this.getMostFrequent(styles) || 'Unknown';
    const type = this.getMostFrequent(types) || this.inferTypeFromName(cluster.canonical);

    // Déterminer format et variant depuis le nom canonique et les chemins
    const samplePath = cluster.members.length > 0 ? cluster.members[0].path : '';
    const format = this.detectFormat(cluster.canonical, samplePath);
    const variant = this.detectVariant(cluster.canonical);

    return { family, style, type, format, variant };
  }

  /**
   * Obtient l'élément le plus fréquent d'une Map
   */
  private getMostFrequent(map: Map<string, number>): string | undefined {
    let maxCount = 0;
    let mostFrequent: string | undefined;

    for (const [key, count] of map) {
      if (count > maxCount) {
        maxCount = count;
        mostFrequent = key;
      }
    }

    return mostFrequent;
  }

  /**
   * Détecte le type depuis un chemin
   */
  private detectTypeFromPath(path: string): string | undefined {
    const pathLower = path.toLowerCase();

    // Mapping basique des types courants
    const typePatterns = [
      { pattern: /\bkick/i, type: 'KICKS' },
      { pattern: /\bbass/i, type: 'BASS' },
      { pattern: /\bsynth/i, type: 'SYNTHS' },
      { pattern: /\bperc/i, type: 'PERC' },
      { pattern: /\bfx|effect/i, type: 'FX' },
      { pattern: /\bvocal/i, type: 'VOCALS' },
      { pattern: /\bpad/i, type: 'PADS' },
      { pattern: /\blead/i, type: 'LEADS' },
      { pattern: /\bsnare/i, type: 'SNARES' },
      { pattern: /\bhihat|hat/i, type: 'HIHATS' },
      { pattern: /\barp/i, type: 'ARPS' },
      { pattern: /\bchord/i, type: 'CHORDS' },
      { pattern: /\bdrum/i, type: 'DRUMS' },
      { pattern: /\btop/i, type: 'TOPS' },
      { pattern: /\batmos/i, type: 'ATMOSPHERES' }
    ];

    for (const { pattern, type } of typePatterns) {
      if (pattern.test(pathLower)) {
        return type;
      }
    }

    return undefined;
  }

  /**
   * Infère le type depuis le nom
   */
  private inferTypeFromName(name: string): string {
    const type = this.detectTypeFromPath(name);
    return type || 'OTHER';
  }

  /**
   * Détecte le format
   */
  private detectFormat(name: string, path: string): string | undefined {
    const combined = `${name} ${path}`.toLowerCase();

    const formatPatterns = [
      { pattern: /\bone[\s_-]?shot/i, format: 'OneShot' },
      { pattern: /\bloop/i, format: 'Loop' },
      { pattern: /\bmidi/i, format: 'MIDI' },
      { pattern: /\bpreset/i, format: 'Preset' },
      { pattern: /\bstem/i, format: 'Stem' },
      { pattern: /\bmulti/i, format: 'Multi' },
      { pattern: /\blayer/i, format: 'Layer' },
      { pattern: /\bfill/i, format: 'Fill' },
      { pattern: /\bbreak/i, format: 'Break' }
    ];

    for (const { pattern, format } of formatPatterns) {
      if (pattern.test(combined)) {
        return format;
      }
    }

    return undefined;
  }

  /**
   * Détecte le variant
   */
  private detectVariant(name: string): string | undefined {
    const nameLower = name.toLowerCase();

    const variantPatterns = [
      { pattern: /\bclean/i, variant: 'Clean' },
      { pattern: /\bdirty/i, variant: 'Dirty' },
      { pattern: /\bwet/i, variant: 'Wet' },
      { pattern: /\bdry/i, variant: 'Dry' },
      { pattern: /\bhard/i, variant: 'Hard' },
      { pattern: /\bsoft/i, variant: 'Soft' },
      { pattern: /\bdark/i, variant: 'Dark' },
      { pattern: /\bbright/i, variant: 'Bright' },
      { pattern: /\bpunchy/i, variant: 'Punchy' },
      { pattern: /\bfat/i, variant: 'Fat' }
    ];

    for (const { pattern, variant } of variantPatterns) {
      if (pattern.test(nameLower)) {
        return variant;
      }
    }

    return undefined;
  }

  /**
   * Génère le chemin cible pour un groupe de fusion
   */
  private generateTargetPath(
    cluster: FolderCluster,
    classification: FusionGroup['classification']
  ): string {
    const pathParts = [];

    // Structure : /Family/Type/Style/Format/Canonical/
    if (this.config.useFullPath) {
      pathParts.push(this.sanitizePath(classification.family));
      pathParts.push(this.sanitizePath(classification.type));
      pathParts.push(this.sanitizePath(classification.style));

      if (classification.format) {
        pathParts.push(this.sanitizePath(classification.format));
      }

      pathParts.push(this.sanitizePath(cluster.canonical));

      if (classification.variant) {
        pathParts.push(this.sanitizePath(classification.variant));
      }
    } else {
      // Version simplifiée : /Type/Style/Canonical/
      pathParts.push(this.sanitizePath(classification.type));
      pathParts.push(this.sanitizePath(classification.style));
      pathParts.push(this.sanitizePath(cluster.canonical));
    }

    return '/' + pathParts.join('/');
  }

  /**
   * Nettoie un nom pour utilisation dans un chemin
   */
  private sanitizePath(name: string): string {
    return name
      .replace(/[<>:"|?*]/g, '_')  // Caractères illégaux
      .replace(/\s+/g, '_')         // Espaces → underscores
      .replace(/_+/g, '_')          // Multiple underscores → single
      .replace(/^_|_$/g, '');       // Trim underscores
  }

  /**
   * Crée les mappings des fichiers sources
   */
  private createSourceMappings(
    cluster: FolderCluster,
    packIndex: Map<string, ClassifiedPack>
  ): SourceFileMapping[] {
    const mappings: SourceFileMapping[] = [];

    // Grouper par pack
    const byPack = new Map<string, FolderPath[]>();
    for (const member of cluster.members) {
      if (!byPack.has(member.packId)) {
        byPack.set(member.packId, []);
      }
      byPack.get(member.packId)!.push(member);
    }

    // Créer un mapping par pack
    for (const [packId, members] of byPack) {
      const pack = packIndex.get(packId);
      if (!pack) continue;

      const fileCount = members.reduce((sum, m) => sum + (m.fileCount || 0), 0);
      const estimatedSize = fileCount * 500000; // ~500KB par fichier en moyenne

      mappings.push({
        packId,
        packName: pack.name,
        originalPath: members[0].path, // Chemin représentatif
        fileCount,
        estimatedSize,
        confidence: cluster.confidence
      });
    }

    return mappings;
  }

  /**
   * Calcule les statistiques du groupe
   */
  private calculateStatistics(
    sourceFiles: SourceFileMapping[],
    cluster: FolderCluster
  ): FusionStatistics {
    const totalFiles = sourceFiles.reduce((sum, sf) => sum + sf.fileCount, 0);
    const totalPacks = sourceFiles.length;
    const estimatedSize = sourceFiles.reduce((sum, sf) => sum + sf.estimatedSize, 0);

    // Risque de doublons : basé sur la similarité moyenne
    const duplicateRisk = cluster.statistics.avgSimilarity > 0.9 ? 0.8 :
                          cluster.statistics.avgSimilarity > 0.8 ? 0.5 :
                          cluster.statistics.avgSimilarity > 0.7 ? 0.3 : 0.1;

    // Score de complexité : basé sur le nombre de sources et la variabilité
    const complexityScore = Math.min(1, (totalPacks * 0.1) + (1 - cluster.statistics.cohesion) * 0.5);

    return {
      totalFiles,
      totalPacks,
      estimatedSize,
      duplicateRisk,
      complexityScore
    };
  }

  /**
   * Résout les conflits entre groupes de fusion
   */
  async resolveConflicts(groups: FusionGroup[]): Promise<ConflictResolution[]> {
    const conflicts: ConflictResolution[] = [];

    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const conflict = this.detectConflict(groups[i], groups[j]);

        if (conflict) {
          conflicts.push(conflict);
        }
      }
    }

    console.log(`[FusionBuilder] Detected ${conflicts.length} conflicts to resolve`);

    return conflicts;
  }

  /**
   * Détecte un conflit entre deux groupes
   */
  private detectConflict(group1: FusionGroup, group2: FusionGroup): ConflictResolution | null {
    // Vérifier chevauchement de chemins cibles
    if (group1.targetPath === group2.targetPath) {
      return {
        groupId1: group1.id,
        groupId2: group2.id,
        conflictType: 'duplicate',
        resolution: 'merge',
        confidence: 0.9,
        reason: 'Same target path'
      };
    }

    // Vérifier chevauchement de fichiers sources
    const overlap = this.calculateOverlap(group1.sourceFiles, group2.sourceFiles);
    if (overlap > this.config.conflictThreshold) {
      return {
        groupId1: group1.id,
        groupId2: group2.id,
        conflictType: 'overlap',
        resolution: overlap > 0.7 ? 'merge' : 'manual',
        confidence: overlap,
        reason: `${Math.round(overlap * 100)}% file overlap`
      };
    }

    // Vérifier similarité de noms canoniques
    if (this.areSimilarNames(group1.canonical, group2.canonical)) {
      return {
        groupId1: group1.id,
        groupId2: group2.id,
        conflictType: 'ambiguous',
        resolution: 'manual',
        confidence: 0.5,
        reason: 'Similar canonical names'
      };
    }

    return null;
  }

  /**
   * Calcule le chevauchement entre deux ensembles de fichiers sources
   */
  private calculateOverlap(sources1: SourceFileMapping[], sources2: SourceFileMapping[]): number {
    const packs1 = new Set(sources1.map(s => s.packId));
    const packs2 = new Set(sources2.map(s => s.packId));

    const intersection = new Set([...packs1].filter(x => packs2.has(x)));
    const union = new Set([...packs1, ...packs2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Vérifie si deux noms sont similaires
   */
  private areSimilarNames(name1: string, name2: string): boolean {
    const norm1 = name1.toLowerCase().replace(/[_\-\s]/g, '');
    const norm2 = name2.toLowerCase().replace(/[_\-\s]/g, '');

    // Distance de Levenshtein simple
    const distance = this.levenshteinDistance(norm1, norm2);
    const maxLen = Math.max(norm1.length, norm2.length);

    return maxLen > 0 && (distance / maxLen) < 0.3;
  }

  /**
   * Distance de Levenshtein simple
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Applique les résolutions de conflits
   */
  private applyConflictResolutions(
    groups: FusionGroup[],
    conflicts: ConflictResolution[]
  ): FusionGroup[] {
    const resolvedGroups = [...groups];
    const toRemove = new Set<string>();

    for (const conflict of conflicts) {
      if (conflict.resolution === 'merge') {
        const group1 = resolvedGroups.find(g => g.id === conflict.groupId1);
        const group2 = resolvedGroups.find(g => g.id === conflict.groupId2);

        if (group1 && group2) {
          // Fusionner group2 dans group1
          this.mergeGroups(group1, group2);
          toRemove.add(group2.id);
        }
      }
      // Les autres résolutions ('split', 'manual', 'ignore') sont laissées telles quelles
    }

    // Retirer les groupes fusionnés
    return resolvedGroups.filter(g => !toRemove.has(g.id));
  }

  /**
   * Fusionne deux groupes
   */
  private mergeGroups(target: FusionGroup, source: FusionGroup): void {
    // Fusionner les fichiers sources
    target.sourceFiles.push(...source.sourceFiles);

    // Mettre à jour les statistiques
    target.statistics.totalFiles += source.statistics.totalFiles;
    target.statistics.totalPacks += source.statistics.totalPacks;
    target.statistics.estimatedSize += source.statistics.estimatedSize;
    target.statistics.duplicateRisk = Math.max(target.statistics.duplicateRisk, source.statistics.duplicateRisk);
    target.statistics.complexityScore = (target.statistics.complexityScore + source.statistics.complexityScore) / 2;

    // Moyenne de confiance
    target.confidence = (target.confidence + source.confidence) / 2;

    // Mettre à jour les métadonnées
    target.metadata.clusterInfo.originalPaths.push(...source.metadata.clusterInfo.originalPaths);
    target.metadata.clusterInfo.packCount += source.metadata.clusterInfo.packCount;
    target.metadata.clusterInfo.avgSimilarity =
      (target.metadata.clusterInfo.avgSimilarity + source.metadata.clusterInfo.avgSimilarity) / 2;
  }
}
