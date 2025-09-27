/**
 * Step1_MatrixGenerator - Génère la matrice adaptative
 * Analyse les packs classifiés + taxonomie pour créer AdaptiveMatrix
 */

import type { StepExecutor, StepResult, ValidationResult, ProgressCallback } from '@shared/interfaces/StepContracts';
import type {
  MatrixGenerationInput,
  MatrixGenerationOutput,
  AdaptiveMatrix,
  MatrixEntry,
  MatrixStatistics,
  MatrixConfig,
  DiscoveredPattern,
  FolderClusterInfo,
  FusionInfo
} from './Phase3Types';
import type { ClassifiedPack } from '@shared/interfaces/BusinessTypes';
import { TaxonomyLoader } from './utils/TaxonomyLoader';
import { MatrixAnalyzer } from './utils/MatrixAnalyzer';
import { FolderSimilarityMatcher, PathContext } from './utils/FolderSimilarityMatcher';
import { FolderClusterEngine, FolderPath, FolderCluster } from './utils/FolderClusterEngine';
import { FusionGroupBuilder, FusionGroup } from './utils/FusionGroupBuilder';

/**
 * Step 1 - Générateur de matrice adaptative
 */
export class Step1_MatrixGenerator implements StepExecutor<MatrixGenerationInput, MatrixGenerationOutput> {
  private readonly config: MatrixConfig;

  constructor(config: Partial<MatrixConfig> = {}) {
    this.config = {
      minPackCountForEntry: 1,
      minConfidenceThreshold: 0.6,
      maxDiscoveredPatterns: 20,
      enableContextDetection: true,
      taxonomyRequired: false,
      // Configuration fusion par défaut
      enableFolderFusion: true,
      fusionSimilarityThreshold: 0.65,
      maxFusionGroupSize: 50,
      ...config
    };
  }

  /**
   * Exécute la génération de matrice
   */
  async execute(
    input: MatrixGenerationInput,
    onProgress?: ProgressCallback
  ): Promise<StepResult<MatrixGenerationOutput>> {
    const startTime = Date.now();

    try {
      // Validation
      const validation = this.validate(input);
      if (!validation.valid) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: validation.errors.join('; ')
          },
          canProceed: false
        };
      }

      onProgress?.(10, 'Chargement taxonomie...');

      // 1. Charger la taxonomie
      const taxonomy = await TaxonomyLoader.load(input.taxonomyPath);

      onProgress?.(25, 'Analyse des packs classifiés...');

      // 2. Analyser les packs pour générer les entrées de matrice
      const matrixEntries = new Map<string, MatrixEntry>();
      const allPatterns: DiscoveredPattern[] = [];

      const totalPacks = input.classifiedPacks.length;
      let processedPacks = 0;

      for (const pack of input.classifiedPacks) {
        try {
          // Générer clé de matrice
          const matrixKey = MatrixAnalyzer.generateMatrixKey(pack);

          // Analyser patterns dans ce pack
          const patterns = MatrixAnalyzer.analyzePackPatterns(pack);
          allPatterns.push(...patterns);

          // Créer ou mettre à jour l'entrée de matrice
          if (!matrixEntries.has(matrixKey.key)) {
            matrixEntries.set(matrixKey.key, this.createMatrixEntry(matrixKey, taxonomy));
          }

          const entry = matrixEntries.get(matrixKey.key)!;
          this.updateMatrixEntry(entry, pack, patterns);

          processedPacks++;
          const progress = 25 + Math.floor((processedPacks / totalPacks) * 50);
          onProgress?.(progress, `Analysé ${processedPacks}/${totalPacks} packs`);

        } catch (error) {
          console.warn(`[MatrixGenerator] Failed to process pack ${pack.packId}:`, error);
          // Continue avec les autres packs
        }
      }

      onProgress?.(80, 'Agrégation des patterns découverts...');

      // 3. NOUVEAU : Fusion intelligente des dossiers (si activée)
      let fusionGroups: FusionGroup[] = [];
      let folderClusters: FolderCluster[] = [];

      if (this.config.enableFolderFusion && (input.enableFusion !== false)) {
        onProgress?.(75, 'Analyse des dossiers pour fusion...');

        const fusionResults = await this.performIntelligentFusion(
          input.classifiedPacks,
          onProgress
        );

        fusionGroups = fusionResults.fusionGroups;
        folderClusters = fusionResults.clusters;

        // Enrichir la matrice avec les informations de fusion
        this.enrichMatrixWithFusion(matrixEntries, fusionGroups);
      }

      // 4. Agréger les patterns découverts globalement
      const aggregatedPatterns = MatrixAnalyzer.aggregatePatterns(allPatterns);

      // 5. Enrichir les entrées avec les patterns globaux
      this.enrichMatrixWithGlobalPatterns(matrixEntries, aggregatedPatterns);

      onProgress?.(90, 'Calcul des statistiques...');

      // 6. Filtrer les entrées selon config
      const filteredMatrix = this.filterMatrixEntries(matrixEntries);

      // 7. Calculer statistiques (incluant fusion)
      const statistics = this.calculateStatistics(
        filteredMatrix,
        taxonomy,
        allPatterns,
        fusionGroups,
        folderClusters
      );

      onProgress?.(100, 'Matrice générée avec succès');

      const endTime = Date.now();

      return {
        success: true,
        data: {
          adaptiveMatrix: Object.fromEntries(filteredMatrix),
          statistics,
          taxonomyInfo: taxonomy,
          // NOUVEAU: Résultats de fusion
          fusionGroups: fusionGroups.length > 0 ? fusionGroups : undefined,
          folderClusters: folderClusters.length > 0 ?
            folderClusters.map(cluster => this.clusterToInfo(cluster)) : undefined
        },
        canProceed: true,
        metrics: {
          startTime,
          endTime,
          itemsProcessed: input.classifiedPacks.length,
          processingSpeed: input.classifiedPacks.length / ((endTime - startTime) / 1000),
          duration: endTime - startTime
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[MatrixGenerator] Fatal error:', error);

      return {
        success: false,
        error: {
          code: 'MATRIX_GENERATION_FAILED',
          message: `Matrix generation failed: ${errorMessage}`,
          recoverable: true
        },
        canProceed: false
      };
    }
  }

  /**
   * Crée une nouvelle entrée de matrice
   */
  private createMatrixEntry(matrixKey: any, taxonomy: any): MatrixEntry {
    // Vérifier si Family/Style viennent de la taxonomie
    const family = TaxonomyLoader.findFamily(taxonomy, matrixKey.family);
    const taxonomySource = !!family;

    return {
      family: matrixKey.family,
      type: matrixKey.type,
      style: matrixKey.style,
      functions: [],
      variants: [],
      contexts: [],
      packCount: 0,
      totalFiles: 0,
      avgConfidence: 0,
      examples: [],
      taxonomySource,
      discovered: false
    };
  }

  /**
   * Met à jour une entrée de matrice avec un pack
   */
  private updateMatrixEntry(
    entry: MatrixEntry,
    pack: ClassifiedPack,
    patterns: DiscoveredPattern[]
  ): void {
    entry.packCount++;
    entry.totalFiles += pack.fileCount || 0;
    entry.avgConfidence = (entry.avgConfidence * (entry.packCount - 1) + (pack.classification?.confidence || 0)) / entry.packCount;

    // Ajouter exemple si pas déjà présent
    if (entry.examples.length < 5 && !entry.examples.includes(pack.packId)) {
      entry.examples.push(pack.packId);
    }

    // Ajouter les patterns découverts
    for (const pattern of patterns) {
      if (pattern.confidence >= this.config.minConfidenceThreshold) {
        switch (pattern.type) {
          case 'function':
            if (!entry.functions.includes(pattern.value)) {
              entry.functions.push(pattern.value);
            }
            break;
          case 'variant':
            if (!entry.variants.includes(pattern.value)) {
              entry.variants.push(pattern.value);
            }
            break;
          case 'context':
            if (this.config.enableContextDetection && !entry.contexts.includes(pattern.value)) {
              entry.contexts.push(pattern.value);
            }
            break;
        }
      }
    }

    // Marquer comme découvert si pas de source taxonomique
    if (!entry.taxonomySource) {
      entry.discovered = true;
    }
  }

  /**
   * Enrichit la matrice avec les patterns globaux découverts
   */
  private enrichMatrixWithGlobalPatterns(
    matrixEntries: Map<string, MatrixEntry>,
    globalPatterns: { functions: string[]; variants: string[]; contexts: string[] }
  ): void {
    // Pour chaque entrée, ajouter les patterns globaux manquants avec faible priorité
    for (const entry of matrixEntries.values()) {
      // Limiter l'enrichissement aux entrées qui ont au moins quelques packs
      if (entry.packCount < 2) continue;

      // Ajouter functions globales manquantes (avec parcimonie)
      for (const func of globalPatterns.functions.slice(0, 3)) {
        if (!entry.functions.includes(func) && entry.functions.length < 8) {
          entry.functions.push(func);
        }
      }

      // Ajouter variants globales manquantes
      for (const variant of globalPatterns.variants.slice(0, 2)) {
        if (!entry.variants.includes(variant) && entry.variants.length < 5) {
          entry.variants.push(variant);
        }
      }
    }
  }

  /**
   * Filtre les entrées de matrice selon la configuration
   */
  private filterMatrixEntries(matrixEntries: Map<string, MatrixEntry>): Map<string, MatrixEntry> {
    const filtered = new Map<string, MatrixEntry>();

    for (const [key, entry] of matrixEntries) {
      // Filtrer par nombre minimum de packs
      if (entry.packCount >= this.config.minPackCountForEntry) {
        // Trier les arrays pour consistance
        entry.functions.sort();
        entry.variants.sort();
        entry.contexts.sort();

        // Limiter le nombre de patterns découverts
        if (entry.functions.length > this.config.maxDiscoveredPatterns) {
          entry.functions = entry.functions.slice(0, this.config.maxDiscoveredPatterns);
        }
        if (entry.variants.length > this.config.maxDiscoveredPatterns) {
          entry.variants = entry.variants.slice(0, this.config.maxDiscoveredPatterns);
        }

        filtered.set(key, entry);
      }
    }

    return filtered;
  }

  /**
   * NOUVEAU: Effectue la fusion intelligente des dossiers
   */
  private async performIntelligentFusion(
    packs: ClassifiedPack[],
    onProgress?: ProgressCallback
  ): Promise<{ fusionGroups: FusionGroup[]; clusters: FolderCluster[] }> {
    console.log('[MatrixGenerator] Starting intelligent folder fusion');

    // 1. Extraire tous les chemins de dossiers depuis les packs
    const folderPaths = this.extractFolderPaths(packs);
    console.log(`[MatrixGenerator] Extracted ${folderPaths.length} folder paths`);

    if (folderPaths.length === 0) {
      return { fusionGroups: [], clusters: [] };
    }

    onProgress?.(76, `Clustering ${folderPaths.length} dossiers...`);

    // 2. Créer le moteur de clustering
    const similarityMatcher = new FolderSimilarityMatcher();
    const clusterEngine = new FolderClusterEngine(similarityMatcher, {
      similarityThreshold: this.config.fusionSimilarityThreshold,
      maxClusterSize: this.config.maxFusionGroupSize,
      algorithm: 'adaptive'
    });

    // 3. Effectuer le clustering
    const clusters = await clusterEngine.createClusters(folderPaths);
    console.log(`[MatrixGenerator] Created ${clusters.length} clusters`);

    onProgress?.(78, 'Génération des groupes de fusion...');

    // 4. Construire les groupes de fusion
    const fusionBuilder = new FusionGroupBuilder({
      minGroupSize: 2, // Au moins 2 sources pour fusionner
      maxGroupSize: this.config.maxFusionGroupSize,
      useFullPath: true
    });

    await fusionBuilder.initialize(); // Charge la taxonomie

    const fusionGroups = await fusionBuilder.buildFusionGroups(clusters, packs);
    console.log(`[MatrixGenerator] Created ${fusionGroups.length} fusion groups`);

    onProgress?.(79, 'Fusion intelligente terminée');

    return { fusionGroups, clusters };
  }

  /**
   * NOUVEAU: Extrait tous les chemins de dossiers depuis les packs
   */
  private extractFolderPaths(packs: ClassifiedPack[]): FolderPath[] {
    const folderPaths: FolderPath[] = [];
    const pathIds = new Set<string>(); // Éviter doublons

    for (const pack of packs) {
      const detectedTypes = pack.internalStructure?.detectedTypes as
        | Record<string, { paths?: string[]; fileCount?: number }>
        | undefined;

      if (detectedTypes) {
        for (const [type, info] of Object.entries(detectedTypes)) {
          if (info.paths && info.paths.length > 0) {
            for (const path of info.paths) {
              const pathId = `${pack.packId}:${path}`;

              if (!pathIds.has(pathId)) {
                pathIds.add(pathId);

                // Extraire le nom du dossier final
                const folderName = path.split('/').pop() || path;

                // Créer le contexte
                const context: PathContext = {
                  parentPath: path.split('/').slice(0, -1).join('/') || '',
                  depth: path.split('/').length,
                  siblings: this.getSiblingPaths(pack, path)
                };

                folderPaths.push({
                  id: pathId,
                  path,
                  folderName,
                  context,
                  packId: pack.packId,
                  fileCount: info.fileCount || 0
                });
              }
            }
          }
        }
      } else {
        // Fallback : utiliser le nom du pack comme chemin unique
        const pathId = `${pack.packId}:${pack.name}`;

        if (!pathIds.has(pathId)) {
          pathIds.add(pathId);

          folderPaths.push({
            id: pathId,
            path: pack.name,
            folderName: pack.name,
            context: {
              parentPath: '',
              depth: 1,
              siblings: []
            },
            packId: pack.packId,
            fileCount: pack.fileCount || 0
          });
        }
      }
    }

    return folderPaths;
  }

  /**
   * NOUVEAU: Obtient les chemins siblings d'un chemin dans un pack
   */
  private getSiblingPaths(pack: ClassifiedPack, targetPath: string): string[] {
    if (!pack.internalStructure?.detectedTypes) return [];

    const targetParent = targetPath.split('/').slice(0, -1).join('/');
    const siblings: string[] = [];

    for (const info of Object.values(pack.internalStructure.detectedTypes)) {
      if (info.paths) {
        for (const path of info.paths) {
          const pathParent = path.split('/').slice(0, -1).join('/');
          if (pathParent === targetParent && path !== targetPath) {
            siblings.push(path.split('/').pop() || path);
          }
        }
      }
    }

    return siblings;
  }

  /**
   * NOUVEAU: Enrichit la matrice avec les informations de fusion
   */
  private enrichMatrixWithFusion(
    matrixEntries: Map<string, MatrixEntry>,
    fusionGroups: FusionGroup[]
  ): void {
    // Créer un index des groupes de fusion par pack
    const fusionIndex = new Map<string, FusionGroup[]>();

    for (const group of fusionGroups) {
      for (const source of group.sourceFiles) {
        if (!fusionIndex.has(source.packId)) {
          fusionIndex.set(source.packId, []);
        }
        fusionIndex.get(source.packId)!.push(group);
      }
    }

    // Enrichir les entrées de matrice
    for (const [key, entry] of matrixEntries) {
      // Trouver si cette entrée bénéficie de fusion
      const packIds = entry.examples; // Les exemples contiennent les packIds

      for (const packId of packIds) {
        const relatedGroups = fusionIndex.get(packId);

        if (relatedGroups && relatedGroups.length > 0) {
          // Prendre le premier groupe pertinent
          const fusionGroup = relatedGroups[0];

          entry.fusionInfo = {
            fusionGroupId: fusionGroup.id,
            clusteredPaths: fusionGroup.metadata.clusterInfo.originalPaths,
            canonicalPath: fusionGroup.targetPath,
            similarity: fusionGroup.confidence,
            mergedFromPacks: fusionGroup.statistics.totalPacks
          };

          break; // Une seule fusion par entrée
        }
      }
    }
  }

  /**
   * NOUVEAU: Convertit un cluster en FolderClusterInfo
   */
  private clusterToInfo(cluster: FolderCluster): FolderClusterInfo {
    return {
      id: cluster.id,
      canonical: cluster.canonical,
      members: cluster.members.map(m => m.path),
      avgSimilarity: cluster.statistics.avgSimilarity,
      packCount: cluster.statistics.packCount,
      fileCount: cluster.statistics.totalFiles
    };
  }

  /**
   * Calcule les statistiques de la matrice générée
   */
  private calculateStatistics(
    matrix: Map<string, MatrixEntry>,
    taxonomy: any,
    allPatterns: DiscoveredPattern[],
    fusionGroups?: FusionGroup[],
    clusters?: FolderCluster[]
  ): MatrixStatistics {
    const entries = Array.from(matrix.values());

    const uniqueFamilies = new Set(entries.map(e => e.family)).size;
    const uniqueTypes = new Set(entries.map(e => e.type)).size;
    const uniqueStyles = new Set(entries.map(e => e.style)).size;

    const discoveredFunctions = new Set(
      entries.flatMap(e => e.functions)
    ).size;

    const discoveredVariants = new Set(
      entries.flatMap(e => e.variants)
    ).size;

    // Calcul couverture taxonomique
    const taxonomicEntries = entries.filter(e => e.taxonomySource);
    const taxonomyCoverage = taxonomicEntries.length / entries.length;

    // Calcul complexité (basé sur le nombre total de combinaisons possibles)
    const avgFunctionsPerEntry = entries.reduce((sum, e) => sum + e.functions.length, 0) / entries.length;
    const avgVariantsPerEntry = entries.reduce((sum, e) => sum + e.variants.length, 0) / entries.length;
    const matrixComplexity = Math.min(1.0, (avgFunctionsPerEntry * avgVariantsPerEntry) / 20);

    return {
      totalEntries: matrix.size,
      uniqueFamilies,
      uniqueTypes,
      uniqueStyles,
      discoveredFunctions,
      discoveredVariants,
      taxonomyCoverage,
      matrixComplexity,
      // NOUVEAU: Statistiques de fusion
      fusionGroups: fusionGroups?.length || 0,
      clustersDetected: clusters?.length || 0
    };
  }

  /**
   * Validation des données d'entrée
   */
  validate(input: MatrixGenerationInput): ValidationResult {
    const errors: string[] = [];

    if (!input.classifiedPacks || input.classifiedPacks.length === 0) {
      errors.push('No classified packs provided');
    }

    // Vérifier que les packs ont des classifications
    let validClassifications = 0;
    for (const pack of input.classifiedPacks || []) {
      if (pack.classification && pack.classification.family && pack.classification.style) {
        validClassifications++;
      }
    }

    if (validClassifications === 0) {
      errors.push('No packs with valid classifications found');
    }

    if (this.config.taxonomyRequired && validClassifications < input.classifiedPacks.length * 0.8) {
      errors.push('Too many packs without taxonomic classification (taxonomy required)');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: [],
      canProceedWithWarnings: errors.length === 0
    };
  }

  getName(): string {
    return 'Matrix Generator V6';
  }

  getDescription(): string {
    return 'Génère la matrice adaptative depuis les packs classifiés et la taxonomie YAML';
  }

  estimateTime(input: MatrixGenerationInput): number {
    const packCount = input.classifiedPacks?.length || 0;

    // Estimation : ~0.1s par pack + overhead taxonomie
    return Math.max(2, Math.ceil(packCount * 0.1 + 3));
  }

  canRetry(): boolean {
    return true;
  }
}
