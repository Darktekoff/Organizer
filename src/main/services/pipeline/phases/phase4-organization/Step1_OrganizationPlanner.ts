/**
 * Step1_OrganizationPlanner
 * Génère le plan détaillé d'organisation avec fusion intelligente
 */

import type {
  StepExecutor,
  StepResult,
  ProgressCallback
} from '@shared/interfaces/StepContracts';
import type {
  Phase4Input,
  OrganizationPlan,
  OrganizationOperation,
  FusionOperation,
  FusionSource,
  FileInfo,
  FolderStructure,
  FolderNode,
  PlanRisk
} from './Phase4Types';
import {
  ORGANIZATION_CONSTANTS
} from './Phase4Types';
import type { FusionGroup } from '../phase3-matrix/utils/FusionGroupBuilder';
import type { StructureProposal } from '../phase3-matrix/Phase3Types';
import { MatrixAnalyzer } from '../phase3-matrix/utils/MatrixAnalyzer';
import { TaxonomyLoader } from '../phase3-matrix/utils/TaxonomyLoader';

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

type FolderRecord = {
  path: string;
  parent: string | null;
  files: FileInfo[];
  children: Set<string>;
};

/**
 * Planificateur d'organisation avec fusion intelligente
 */
export class Step1_OrganizationPlanner implements StepExecutor<Phase4Input, OrganizationPlan> {
  private currentInput?: Phase4Input;
  private operations: OrganizationOperation[] = [];
  private fusionOperations: FusionOperation[] = [];
  private folderStructure?: FolderStructure;
  private detectedRisks: PlanRisk[] = [];
  private taxonomyFormats: Map<string, string[]> = new Map();
  private taxonomyLoaded = false;
  private readonly typeAliasMap = new Map<string, string>([
    ['PERCUSSION', 'PERC'],
    ['MELODY', 'SYNTHS'],
    ['DRUMS', 'DRUM_LOOPS'],
    ['DRUM', 'DRUM_LOOPS'],
    ['VOX', 'VOCALS'],
    ['VOCAL', 'VOCALS'],
    ['PADS', 'SYNTHS'],
    ['BASSLINE', 'BASS'],
    ['SNARE', 'PERC'],
    ['CLAP', 'PERC']
  ]);
  private readonly fallbackFunctionName = 'Misc';

  /**
   * Génère le plan complet d'organisation
   */
  async execute(
    input: Phase4Input,
    onProgress?: ProgressCallback
  ): Promise<StepResult<OrganizationPlan>> {
    const startTime = Date.now();

    try {
      this.log('INFO', '📋 [OrganizationPlanner] Starting organization planning');
      this.log('DEBUG', `Input: structure=${input.selectedStructure.name}, fusionGroups=${input.fusionGroups.length}, targetPath=${input.targetPath}`);

      this.currentInput = input;
      this.operations = [];
      this.fusionOperations = [];
      this.detectedRisks = [];

      onProgress?.(10, 'Analyse de la structure cible...');

      // 1. Analyser la structure de destination
      this.log('INFO', '🔍 Analyzing target structure');
      const structureAnalysis = await this.analyzeTargetStructure(input.selectedStructure, input.targetPath);
      this.folderStructure = structureAnalysis;

      onProgress?.(25, 'Planification des opérations de fusion...');

      // 2. Planifier les opérations de fusion intelligente
      this.log('INFO', '🔗 Planning intelligent fusion operations');
      const fusionPlan = await this.planFusionOperations(input.fusionGroups, input.targetPath);
      this.fusionOperations = fusionPlan;

      onProgress?.(50, 'Génération des opérations d\'organisation...');

      // 3. Générer les opérations d'organisation
      this.log('INFO', '⚡ Generating organization operations');
      const {
        operations: organizationOps,
        folderStructure
      } = await this.generateOrganizationOperations(
        input.selectedStructure,
        input.classifiedPacks,
        input.targetPath,
        input.workingPath
      );
      this.operations = organizationOps;
      this.folderStructure = folderStructure;

      onProgress?.(75, 'Analyse des risques...');

      // 4. Analyser les risques et conflits
      this.log('INFO', '⚠️ Analyzing risks and conflicts');
      const risks = await this.analyzeRisks();
      this.detectedRisks = risks;

      onProgress?.(90, 'Finalisation du plan...');

      // 5. Construire le plan final
      const plan = this.buildOrganizationPlan(input.targetPath, startTime);

      this.log('INFO', `✅ Planning completed: ${plan.operations.length} operations, ${plan.fusionOperations.length} fusion operations`);
      this.logPlanSummary(plan);

      onProgress?.(100, 'Plan d\'organisation généré');

      return {
        success: true,
        data: plan,
        canProceed: true
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('ERROR', 'Planning failed', error);

      return {
        success: false,
        error: {
          code: 'ORGANIZATION_PLANNING_ERROR',
          message: `Planning failed: ${errorMessage}`,
          recoverable: true
        },
        canProceed: false
      };
    }
  }

  /**
   * Analyse la structure de destination et crée la hiérarchie
   */
  private async analyzeTargetStructure(
    structure: StructureProposal,
    targetPath: string
  ): Promise<FolderStructure> {
    this.log('DEBUG', `Analyzing structure: ${structure.hierarchy.join(' → ')}`);

    const rootNode: FolderNode = {
      name: path.basename(targetPath),
      path: targetPath,
      level: 0,
      files: [],
      subfolders: [],
      expectedFileCount: 0,
      actualFileCount: 0,
      created: false,
      validated: false
    };
    const folderStructure: FolderStructure = {
      root: rootNode,
      totalDepth: 1,
      totalFolders: 1,
      totalFiles: 0 // Sera calculé lors de l'assignation des fichiers
    };

    this.log('DEBUG', 'Structure analyzed: root initialized');
    return folderStructure;
  }

  /**
   * Génère les nœuds de la hiérarchie selon la structure proposée
   */
  private async generateHierarchyNodes(
    parentNode: FolderNode,
    structure: StructureProposal
  ): Promise<void> {
    // Pour une structure réelle, nous aurions besoin des données de classification
    // Pour l'instant, créons une structure exemple basée sur la hiérarchie

    const hierarchyLevels = structure.hierarchy; // ['Family', 'Type', 'Style', 'Function']

    // Exemple de familles/types courants (seraient normalement extraits des données)
    const sampleFamilies = ['Hard_Dance', 'Bass_Music', 'Techno'];
    const sampleTypes = ['KICKS', 'BASS', 'SYNTHS', 'PERCUSSION'];
    const sampleStyles = ['Hardstyle', 'Rawstyle', 'Dubstep'];
    const sampleFunctions = ['Full_Kicks', 'Top_Kicks', 'Sub_Bass'];

    if (parentNode.level < hierarchyLevels.length - 1) {
      const currentLevelType = hierarchyLevels[parentNode.level + 1];
      let sampleValues: string[] = [];

      switch (currentLevelType) {
        case 'Family':
          sampleValues = sampleFamilies;
          break;
        case 'Type':
          sampleValues = sampleTypes;
          break;
        case 'Style':
          sampleValues = sampleStyles;
          break;
        case 'Function':
          sampleValues = sampleFunctions;
          break;
      }

      // Créer les sous-dossiers
      for (const value of sampleValues.slice(0, 3)) { // Limiter à 3 pour l'exemple
        const childNode: FolderNode = {
          name: value,
          path: path.join(parentNode.path, value),
          level: parentNode.level + 1,
          files: [],
          subfolders: [],
          expectedFileCount: 0,
          actualFileCount: 0,
          created: false,
          validated: false
        };

        parentNode.subfolders.push(childNode);

        // Récursion pour les niveaux suivants
        await this.generateHierarchyNodes(childNode, structure);
      }
    }
  }

  /**
   * Planifie les opérations de fusion intelligente
   */
  private async planFusionOperations(
    fusionGroups: FusionGroup[],
    targetPath: string
  ): Promise<FusionOperation[]> {
    const operations: FusionOperation[] = [];

    this.log('DEBUG', `Planning ${fusionGroups.length} fusion operations`);

    for (const group of fusionGroups) {
      this.log('DEBUG', `Planning fusion for group: ${group.canonical} (${group.sourceFiles.length} sources)`);

      // Construire le chemin de destination basé sur la classification
      const destinationPath = path.join(
        targetPath,
        group.classification.family,
        group.classification.type,
        group.classification.style,
        group.canonical
      );

      // Préparer les sources de fusion
      const sources: FusionSource[] = group.sourceFiles.map((source, index) => ({
        packId: source.packId || `pack_${index}`,
        packName: source.packName,
        originalPath: source.originalPath,
        fileCount: source.fileCount,
        estimatedSize: source.fileCount * 1024 * 1024, // Estimation 1MB par fichier
        priority: index // Premier source = priorité plus élevée
      }));

      const fusionOp: FusionOperation = {
        id: this.generateOperationId('fusion'),
        fusionGroupId: group.id,
        canonical: group.canonical,
        targetPath: destinationPath,
        sources,
        mergeStrategy: 'merge_all',
        conflictHandling: 'rename_duplicates',
        expectedFileCount: sources.reduce((sum, s) => sum + s.fileCount, 0),
        duplicateRisk: this.estimateDuplicateRisk(sources)
      };

      operations.push(fusionOp);

      this.log('DEBUG', `Fusion operation planned: ${fusionOp.canonical} → ${fusionOp.targetPath} (${fusionOp.expectedFileCount} files)`);
    }

    this.log('INFO', `✅ Planned ${operations.length} fusion operations`);
    return operations;
  }

  /**
   * Génère les opérations d'organisation standard
   */
  private async generateOrganizationOperations(
    structure: StructureProposal,
    classifiedPacks: any[],
    targetPath: string,
    workingPath: string
  ): Promise<{ operations: OrganizationOperation[]; folderStructure: FolderStructure }>
  {
    await this.ensureTaxonomyLoaded();

    const { fileOperations, folderRecords } = await this.buildFileOperationsFromClassifiedPacks(
      structure,
      classifiedPacks,
      targetPath,
      workingPath
    );

    const folderOps = this.buildFolderCreationOperationsFromRecords(folderRecords, targetPath);
    const folderStructure = this.buildFolderStructureFromRecords(folderRecords, targetPath);

    const operations = [...folderOps, ...fileOperations];

    this.log('DEBUG', `Generated ${operations.length} organization operations (${folderOps.length} folders, ${fileOperations.length} files)`);

    return {
      operations,
      folderStructure
    };
  }

  /**
   * Analyse les risques du plan
   */
  private async analyzeRisks(): Promise<PlanRisk[]> {
    const risks: PlanRisk[] = [];

    // 1. Risques de conflits de noms
    const nameConflicts = this.detectNameConflicts();
    if (nameConflicts > 0) {
      risks.push({
        id: this.generateRiskId(),
        type: 'conflict',
        severity: 'medium',
        description: `${nameConflicts} conflits de noms potentiels détectés`,
        impact: 'Certains fichiers pourraient être renommés automatiquement',
        mitigation: 'Utiliser la stratégie de renommage automatique',
        affectedOperations: [],
        affectedPaths: [],
        probability: 0.7,
        impactScore: 0.3
      });
    }

    // 2. Risques de complexité de fusion
    const complexFusions = this.fusionOperations.filter(op => op.sources.length > 5).length;
    if (complexFusions > 0) {
      risks.push({
        id: this.generateRiskId(),
        type: 'fusion',
        severity: 'medium',
        description: `${complexFusions} opérations de fusion complexes (>5 sources)`,
        impact: 'Temps d\'exécution prolongé et risque de conflits',
        mitigation: 'Traitement séquentiel des opérations complexes',
        affectedOperations: [],
        affectedPaths: [],
        probability: 0.8,
        impactScore: 0.4
      });
    }

    // 3. Risque d'espace disque
    const totalSize = this.estimateTotalSize();
    if (totalSize > 10 * 1024 * 1024 * 1024) { // 10GB
      risks.push({
        id: this.generateRiskId(),
        type: 'space',
        severity: 'high',
        description: 'Opération nécessite plus de 10GB d\'espace disque',
        impact: 'Risque de manque d\'espace durant l\'organisation',
        mitigation: 'Vérifier l\'espace disponible avant exécution',
        affectedOperations: [],
        affectedPaths: [],
        probability: 0.5,
        impactScore: 0.8
      });
    }

    this.log('DEBUG', `Risk analysis: ${risks.length} risks detected`);
    return risks;
  }

  /**
   * Construit le plan final
   */
  private buildOrganizationPlan(targetPath: string, startTime: number): OrganizationPlan {
    const endTime = Date.now();
    const totalOperations = this.operations.length + this.fusionOperations.length;

    const plan: OrganizationPlan = {
      id: this.generatePlanId(),
      targetPath,
      estimatedDuration: this.estimateTotalDuration(),
      estimatedComplexity: this.calculateComplexity(),
      operations: this.operations,
      fusionOperations: this.fusionOperations,
      folderStructure: this.folderStructure!,
      estimatedStats: {
        foldersToCreate: this.operations.filter(op => op.type === 'create_folder').length,
        filesToMove: this.operations.filter(op => op.type === 'move_file').length,
        filesToCopy: this.operations.filter(op => op.type === 'copy_file').length,
        fusionGroups: this.fusionOperations.length,
        totalFiles: this.fusionOperations.reduce((sum, op) => sum + op.expectedFileCount, 0),
        estimatedSize: this.estimateTotalSize()
      },
      risks: this.detectedRisks,
      checkpoints: this.generateCheckpoints()
    };

    return plan;
  }

  // ============================================
  // UTILITAIRES
  // ============================================

  private generateOperationId(type: string): string {
    return `${type}_${crypto.randomBytes(4).toString('hex')}`;
  }

  private generateRiskId(): string {
    return `risk_${crypto.randomBytes(4).toString('hex')}`;
  }

  private generatePlanId(): string {
    return `plan_${crypto.randomBytes(8).toString('hex')}`;
  }

  private async buildFileOperationsFromClassifiedPacks(
    _structure: StructureProposal,
    classifiedPacks: any[],
    targetPath: string,
    workingPath: string
  ): Promise<{ folderRecords: Map<string, FolderRecord>; fileOperations: OrganizationOperation[] }> {
    const folderRecords = new Map<string, FolderRecord>();
    const fileOperations: OrganizationOperation[] = [];

    const normalizedTarget = path.normalize(targetPath);
    this.ensureFolderRecord(folderRecords, normalizedTarget, normalizedTarget);

    for (const pack of classifiedPacks) {
      try {
        const sourcePath = await this.resolvePackSourcePath(pack, workingPath);
        if (!sourcePath) {
          this.log('WARN', `No source path found for pack ${pack?.packId || 'unknown'}`);
          continue;
        }

        const classification = pack?.classification || {};
        const familySegment = this.sanitizeSegment(classification.family || 'Unknown_Family');
        const styleSegment = this.sanitizeSegment(classification.style || 'Unknown_Style');

        const packTypeInfo = this.resolvePackType(pack);
        const detectedTypeEntries = this.buildDetectedTypeEntries(pack);

        const files = await this.scanSourceFiles(sourcePath);
        if (files.length === 0) {
          this.log('WARN', `No files found for pack ${pack?.packId || sourcePath}`);
        }

        for (const file of files) {
          const { fileName, dirSegments } = this.splitRelativePath(file.relativePath);
          const typeMatch = this.matchDetectedType(detectedTypeEntries, dirSegments);
          const effectiveType = typeMatch?.canonicalType || packTypeInfo.canonicalType;
          const typeSegment = this.sanitizeSegment(effectiveType || 'Unknown_Type');

          const functionMatch = this.matchFunctionSegment(effectiveType, dirSegments, typeMatch?.pathSegments);
          const resolvedFunction = functionMatch?.name || this.resolveFallbackFunction(effectiveType);
          const functionSegment = this.sanitizeSegment(resolvedFunction);

          const remainingSegments = this.computeRemainingSegments(
            dirSegments,
            typeMatch?.pathSegments,
            functionMatch?.index
          );

          const targetDir = path.join(
            normalizedTarget,
            familySegment,
            typeSegment,
            styleSegment,
            functionSegment,
            ...remainingSegments
          );

          this.ensureFolderRecord(folderRecords, targetDir, normalizedTarget);

          const targetFilePath = path.join(targetDir, fileName);

          const fileInfo: FileInfo = {
            name: fileName,
            originalPath: file.absolutePath,
            targetPath: targetFilePath,
            size: file.size,
            sourcePackId: pack?.packId || 'unknown',
            sourcePackName: pack?.originalPack?.name || pack?.packId || 'Unknown pack',
            originalLocation: file.absolutePath,
            moved: false,
            validated: false,
            type: effectiveType,
            format: path.extname(targetFilePath).replace('.', ''),
            function: resolvedFunction,
            fusionSource: false
          };

          folderRecords.get(targetDir)!.files.push(fileInfo);

          const moveOp: OrganizationOperation = {
            id: this.generateOperationId('move_file'),
            type: 'move_file',
            priority: 5,
            source: file.absolutePath,
            target: targetFilePath,
            dependencies: [],
            retryable: true,
            maxRetries: 3,
            rollbackable: true,
            estimatedDuration: Math.max(50, Math.min(1500, Math.round(file.size / 2048))),
            estimatedSize: file.size,
            metadata: {
              packId: pack?.packId,
              family: classification.family,
              style: classification.style,
              type: effectiveType,
              function: resolvedFunction
            }
          };

          fileOperations.push(moveOp);
        }
      } catch (error) {
        this.log('ERROR', `Failed to build operations for pack ${pack?.packId || 'unknown'}`, error);
      }
    }

    this.pruneEmptyFolders(folderRecords, normalizedTarget);

    return {
      folderRecords,
      fileOperations
    };
  }

  private buildFolderCreationOperationsFromRecords(
    folderRecords: Map<string, FolderRecord>,
    rootPath: string
  ): OrganizationOperation[] {
    const operations: OrganizationOperation[] = [];
    const normalizedRoot = path.normalize(rootPath);

    const folders = Array.from(folderRecords.values())
      .filter(record => path.normalize(record.path) !== normalizedRoot)
      .sort((a, b) => this.getPathDepth(a.path) - this.getPathDepth(b.path));

    for (const record of folders) {
      operations.push({
        id: this.generateOperationId('create_folder'),
        type: 'create_folder',
        priority: Math.max(1, 10 - this.getPathDepth(record.path)),
        target: record.path,
        dependencies: [],
        retryable: true,
        maxRetries: 3,
        rollbackable: true,
        estimatedDuration: 100,
        estimatedSize: 0
      });
    }

    return operations;
  }

  private buildFolderStructureFromRecords(
    folderRecords: Map<string, FolderRecord>,
    rootPath: string
  ): FolderStructure {
    const normalizedRoot = path.normalize(rootPath);

    const buildNode = (folderPath: string, level: number): FolderNode => {
      const record = folderRecords.get(folderPath);
      if (!record) {
        return {
          name: path.basename(folderPath),
          path: folderPath,
          level,
          files: [],
          subfolders: [],
          expectedFileCount: 0,
          actualFileCount: 0,
          created: false,
          validated: false
        };
      }

      const childNodes = Array.from(record.children)
        .sort((a, b) => a.localeCompare(b))
        .map(child => buildNode(child, level + 1));

      const expectedFileCount = record.files.length + childNodes.reduce((sum, child) => sum + child.expectedFileCount, 0);

      return {
        name: path.basename(folderPath),
        path: folderPath,
        level,
        files: record.files,
        subfolders: childNodes,
        expectedFileCount,
        actualFileCount: 0,
        created: false,
        validated: false
      };
    };

    const rootNode = buildNode(normalizedRoot, 0);

    const computeDepth = (node: FolderNode): number => {
      if (node.subfolders.length === 0) {
        return node.level + 1;
      }
      return Math.max(...node.subfolders.map(sub => computeDepth(sub)));
    };

    const totalFiles = Array.from(folderRecords.values()).reduce((sum, record) => sum + record.files.length, 0);

    return {
      root: rootNode,
      totalDepth: computeDepth(rootNode),
      totalFolders: folderRecords.size,
      totalFiles
    };
  }

  private ensureFolderRecord(folderRecords: Map<string, FolderRecord>, dirPath: string, rootPath: string): FolderRecord {
    const normalized = path.normalize(dirPath);
    if (folderRecords.has(normalized)) {
      return folderRecords.get(normalized)!;
    }

    const parent = this.getParentFolder(normalized);
    const record: FolderRecord = {
      path: normalized,
      parent,
      files: [],
      children: new Set<string>()
    };

    folderRecords.set(normalized, record);

    const normalizedRoot = path.normalize(rootPath);
    if (parent && parent !== normalized && parent.startsWith(normalizedRoot)) {
      const parentRecord = this.ensureFolderRecord(folderRecords, parent, normalizedRoot);
      parentRecord.children.add(normalized);
    }

    return record;
  }

  private getParentFolder(dirPath: string): string | null {
    const normalized = path.normalize(dirPath);
    const parent = path.dirname(normalized);
    if (parent === normalized) {
      return null;
    }
    return parent;
  }

  private getPathDepth(dirPath: string): number {
    const normalized = path.normalize(dirPath);
    const withoutDrive = normalized.replace(/^([A-Za-z]:\\|\\)/, '');
    return withoutDrive.split(path.sep).filter(Boolean).length;
  }

  private sanitizeSegment(segment: string): string {
    const trimmed = (segment || '')
      .replace(/[_]+/g, ' ')
      .trim();

    const cleaned = trimmed
      .replace(/[<>:"/\\|?*]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\.+$/g, '')
      .trim();

    if (!cleaned) {
      return 'Unknown';
    }

    return cleaned;
  }

  private splitRelativePath(relativePath: string): { fileName: string; dirSegments: string[] } {
    const segments = relativePath.split(/[\\/]+/).filter(Boolean);
    if (segments.length === 0) {
      return { fileName: relativePath, dirSegments: [] };
    }
    const fileName = segments[segments.length - 1];
    const dirSegments = segments.slice(0, -1);
    return { fileName, dirSegments };
  }

  private resolvePackType(pack: any): { canonicalType: string } {
    try {
      const matrixKey = MatrixAnalyzer.generateMatrixKey(pack, 'UNKNOWN');
      const canonicalType = this.resolveCanonicalType(matrixKey.type || 'UNKNOWN');
      return { canonicalType };
    } catch {
      const classificationType = this.resolveCanonicalType(pack?.classification?.type || 'UNKNOWN');
      return { canonicalType: classificationType };
    }
  }

  private buildDetectedTypeEntries(pack: any): Array<{ canonicalType: string; pathSegments: string[][] }> {
    const result: Array<{ canonicalType: string; pathSegments: string[][] }> = [];
    const detectedTypes = pack?.internalStructure?.detectedTypes as Record<string, { paths?: string[] }> | undefined;

    if (!detectedTypes) {
      return result;
    }

    for (const [rawType, info] of Object.entries(detectedTypes)) {
      if (!info?.paths || info.paths.length === 0) {
        continue;
      }

      const canonicalType = this.resolveCanonicalType(rawType);
      const pathSegments = info.paths
        .map(pathStr => pathStr.split(/[\\/]+/).filter(Boolean))
        .filter(segments => segments.length > 0);

      if (pathSegments.length > 0) {
        result.push({ canonicalType, pathSegments });
      }
    }

    return result;
  }

  private matchDetectedType(
    detectedEntries: Array<{ canonicalType: string; pathSegments: string[][] }>,
    dirSegments: string[]
  ): { canonicalType: string; pathSegments: string[] } | undefined {
    let bestMatch: { canonicalType: string; pathSegments: string[] } | undefined;

    for (const entry of detectedEntries) {
      for (const candidate of entry.pathSegments) {
        if (candidate.length === 0 || candidate.length > dirSegments.length) {
          continue;
        }

        if (this.pathStartsWith(dirSegments, candidate)) {
          if (!bestMatch || candidate.length > bestMatch.pathSegments.length) {
            bestMatch = { canonicalType: entry.canonicalType, pathSegments: candidate };
          }
        }
      }
    }

    return bestMatch;
  }

  private matchFunctionSegment(
    type: string | undefined,
    dirSegments: string[],
    matchedTypeSegments?: string[]
  ): { name: string; index: number } | undefined {
    const canonicalType = this.resolveCanonicalType(type || 'UNKNOWN');
    const candidateFunctions = this.getFunctionsForType(canonicalType);
    if (candidateFunctions.length === 0 || dirSegments.length === 0) {
      return undefined;
    }

    const preferredStart = matchedTypeSegments && matchedTypeSegments.length > 0
      ? Math.max(0, matchedTypeSegments.length - 1)
      : 0;

    const search = (start: number, end: number) => {
      for (let i = start; i < end; i++) {
        const segment = dirSegments[i];
        const normalizedSegment = this.normalizeForComparison(segment);
        const match = candidateFunctions.find(fn => this.normalizeForComparison(fn) === normalizedSegment);
        if (match) {
          return { name: match, index: i };
        }
      }
      return undefined;
    };

    const primaryMatch = search(preferredStart, dirSegments.length);
    if (primaryMatch) {
      return primaryMatch;
    }

    return search(0, dirSegments.length);
  }

  private computeRemainingSegments(
    dirSegments: string[],
    matchedTypeSegments?: string[],
    functionIndex?: number
  ): string[] {
    if (typeof functionIndex === 'number' && functionIndex >= 0) {
      return dirSegments.slice(functionIndex + 1);
    }

    if (matchedTypeSegments && matchedTypeSegments.length > 0) {
      return dirSegments.slice(matchedTypeSegments.length);
    }

    return dirSegments.slice();
  }

  private async ensureTaxonomyLoaded(): Promise<void> {
    if (this.taxonomyLoaded) {
      return;
    }

    try {
      const taxonomyInfo = await TaxonomyLoader.load();
      this.taxonomyFormats = new Map(Object.entries(taxonomyInfo.formats || {}));
      this.taxonomyLoaded = true;
    } catch (error) {
      this.log('WARN', `Failed to load taxonomy information: ${error instanceof Error ? error.message : error}`);
      this.taxonomyFormats = new Map();
      this.taxonomyLoaded = true;
    }
  }

  private pruneEmptyFolders(folderRecords: Map<string, FolderRecord>, rootPath: string): void {
    const normalizedRoot = path.normalize(rootPath);

    const computeTotals = (currentPath: string): number => {
      const record = folderRecords.get(currentPath);
      if (!record) {
        return 0;
      }

      let total = record.files.length;
      for (const childPath of Array.from(record.children)) {
        const childRecord = folderRecords.get(childPath);
        if (!childRecord) {
          record.children.delete(childPath);
          continue;
        }

        const childTotal = computeTotals(childPath);
        if (childTotal === 0) {
          record.children.delete(childPath);
          folderRecords.delete(childPath);
        } else {
          total += childTotal;
        }
      }

      return total;
    };

    computeTotals(normalizedRoot);

    for (const folderPath of Array.from(folderRecords.keys())) {
      if (folderPath === normalizedRoot) {
        continue;
      }

      const record = folderRecords.get(folderPath);
      if (!record) {
        continue;
      }

      if (record.files.length === 0 && record.children.size === 0) {
        if (record.parent && folderRecords.has(record.parent)) {
          folderRecords.get(record.parent)!.children.delete(folderPath);
        }
        folderRecords.delete(folderPath);
      }
    }
  }

  private resolveCanonicalType(rawType: string | undefined): string {
    if (!rawType) {
      return 'UNKNOWN';
    }

    const upper = rawType.toString().toUpperCase();
    if (this.typeAliasMap.has(upper)) {
      return this.typeAliasMap.get(upper)!;
    }
    return upper;
  }

  private getFunctionsForType(type: string): string[] {
    const canonical = this.resolveCanonicalType(type);
    if (this.taxonomyFormats.has(canonical)) {
      return this.taxonomyFormats.get(canonical)!;
    }
    return [];
  }

  private resolveFallbackFunction(type: string | undefined): string {
    const canonical = this.resolveCanonicalType(type || 'UNKNOWN');
    const functions = this.getFunctionsForType(canonical);
    if (functions.length > 0) {
      return functions[0];
    }

    return MatrixAnalyzer.resolveDefaultFunctionForType(canonical) || this.fallbackFunctionName;
  }

  private pathStartsWith(target: string[], candidate: string[]): boolean {
    if (candidate.length > target.length) {
      return false;
    }

    for (let i = 0; i < candidate.length; i++) {
      if (this.normalizeForComparison(candidate[i]) !== this.normalizeForComparison(target[i])) {
        return false;
      }
    }

    return true;
  }

  private normalizeForComparison(input: string): string {
    return input
      .replace(/[_\s-]+/g, '')
      .replace(/\./g, '')
      .toLowerCase();
  }

  private async scanSourceFiles(root: string): Promise<Array<{ absolutePath: string; relativePath: string; size: number }>> {
    const results: Array<{ absolutePath: string; relativePath: string; size: number }> = [];

    const traverse = async (current: string, base: string): Promise<void> => {
      let entries;
      try {
        entries = await fs.readdir(current, { withFileTypes: true });
      } catch (error) {
        this.log('WARN', `Unable to read directory ${current}: ${error instanceof Error ? error.message : error}`);
        return;
      }

      for (const entry of entries) {
        const absolutePath = path.join(current, entry.name);
        const relativePath = path.relative(base, absolutePath);

        if (entry.isDirectory()) {
          await traverse(absolutePath, base);
        } else {
          try {
            const stats = await fs.stat(absolutePath);
            results.push({
              absolutePath,
              relativePath,
              size: stats.size
            });
          } catch (error) {
            this.log('WARN', `Unable to stat file ${absolutePath}: ${error instanceof Error ? error.message : error}`);
          }
        }
      }
    };

    await traverse(root, root);
    return results;
  }

  private async resolvePackSourcePath(pack: any, workingPath: string): Promise<string | null> {
    const candidates: Array<string | undefined> = [
      pack?.originalPack?.path,
      pack?.originalPack?.originalPath,
      pack?.originalPack?.sourcePath,
      pack?.packPath,
      workingPath ? path.join(workingPath, pack?.packId || '') : undefined
    ];

    for (const candidate of candidates) {
      if (!candidate) continue;
      try {
        const stats = await fs.stat(candidate);
        if (stats.isDirectory()) {
          return path.normalize(candidate);
        }
      } catch (error) {
        continue;
      }
    }

    return null;
  }

  private detectNameConflicts(): number {
    const targetPaths = new Set<string>();
    let conflicts = 0;

    for (const op of this.operations) {
      if (targetPaths.has(op.target)) {
        conflicts++;
      } else {
        targetPaths.add(op.target);
      }
    }

    return conflicts;
  }

  private estimateDuplicateRisk(sources: FusionSource[]): number {
    // Plus il y a de sources, plus le risque de doublons est élevé
    return Math.min(sources.length / 10, 0.9);
  }

  private estimateTotalSize(): number {
    const operationSize = this.operations.reduce((sum, op) => sum + (op.estimatedSize || 0), 0);
    const fusionSize = this.fusionOperations.reduce((sum, op) =>
      sum + op.sources.reduce((sourceSum, source) => sourceSum + source.estimatedSize, 0)
    , 0);
    return operationSize + fusionSize;
  }

  private estimateTotalDuration(): number {
    const operationTime = this.operations.reduce((sum, op) => sum + op.estimatedDuration, 0);
    const fusionTime = this.fusionOperations.length * 5000; // 5s par fusion
    return operationTime + fusionTime;
  }

  private calculateComplexity(): number {
    const operationComplexity = this.operations.length / 1000; // 0-1
    const fusionComplexity = this.fusionOperations.reduce((sum, op) => sum + op.sources.length, 0) / 100;
    return Math.min(operationComplexity + fusionComplexity, 1);
  }

  private generateCheckpoints(): string[] {
    const checkpoints: string[] = [];
    const interval = Math.max(1, Math.floor(this.operations.length / 10));

    for (let i = 0; i < this.operations.length; i += interval) {
      checkpoints.push(this.operations[i].id);
    }

    return checkpoints;
  }

  private logPlanSummary(plan: OrganizationPlan): void {
    this.log('INFO', '📊 Plan Summary:');
    this.log('INFO', `  • Total operations: ${plan.operations.length}`);
    this.log('INFO', `  • Fusion operations: ${plan.fusionOperations.length}`);
    this.log('INFO', `  • Estimated duration: ${(plan.estimatedDuration / 1000).toFixed(2)}s`);
    this.log('INFO', `  • Complexity: ${plan.estimatedComplexity.toFixed(2)}`);
    this.log('INFO', `  • Risks detected: ${plan.risks.length}`);
    this.log('INFO', `  • Estimated files: ${plan.estimatedStats.totalFiles}`);
    this.log('INFO', `  • Estimated size: ${(plan.estimatedStats.estimatedSize / 1024 / 1024).toFixed(2)} MB`);
  }

  private log(level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR', message: string, details?: any): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [OrganizationPlanner] ${level}: ${message}`;

    switch (level) {
      case 'DEBUG':
        console.debug(logMessage, details || '');
        break;
      case 'INFO':
        console.log(logMessage, details || '');
        break;
      case 'WARN':
        console.warn(logMessage, details || '');
        break;
      case 'ERROR':
        console.error(logMessage, details || '');
        break;
    }
  }

  // Interface StepExecutor
  getName(): string {
    return 'Step 1 - Organization Planner';
  }

  getDescription(): string {
    return 'Génère le plan détaillé d\'organisation avec fusion intelligente';
  }

  estimateTime(input: Phase4Input): number {
    const baseTime = 5; // 5s base
    const fusionTime = input.fusionGroups.length * 2; // 2s par groupe fusion
    const estimatedFolders = input.selectedStructure.statistics?.estimatedFolders || 100;
    const structureTime = estimatedFolders * 0.1; // 0.1s par dossier

    return Math.max(baseTime, baseTime + fusionTime + structureTime);
  }

  canRetry(): boolean {
    return true;
  }

  validate(input: Phase4Input): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!input.targetPath) {
      errors.push('Target path is required');
    }

    if (!input.selectedStructure) {
      errors.push('Selected structure is required');
    }

    if (!input.organizationOptions) {
      errors.push('Organization options are required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
