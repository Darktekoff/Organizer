/**
 * Step 2 - Clean & Reorganize
 * Nettoie et réorganise les packs après validation utilisateur
 */

import * as fs from 'fs';
import * as path from 'path';
import { StepExecutor, StepResult, ValidationResult, ProgressCallback } from '@shared/interfaces/StepContracts';
import { DetectedPackV6, ReorganizeOperation } from '@shared/interfaces/BusinessTypes';
import { NameCleanerV6 } from '../../shared/cleaners/NameCleanerV6';
import { ProposedStructureGenerator } from '../../shared/utils/ProposedStructureGenerator';

const AUDIO_EXTENSIONS = new Set([
  '.wav',
  '.aiff',
  '.aif',
  '.flac',
  '.mp3',
  '.ogg',
  '.m4a'
]);

const PRESET_EXTENSIONS = new Set([
  '.fxp', '.fxb', '.nmsv', '.vital', '.serum', '.serumpack', '.serumpreset', '.h2p', '.spf', '.ksd'
]);

interface QuickScanSummary {
  totalSamples: number;
  totalSize: number;
  needsCleanup: boolean;
  chaosScore: number;
  currentStructure: 'chaotic' | 'organized' | 'mixed';
  scanDuration: number;
  packPreview: Array<{
    name: string;
    path: string;
    audioFiles: number;
    size: number;
  }>;
}


interface PlanReportCard {
  label: string;
  value: string;
  hint?: string;
  accent?: 'muted' | 'warning' | 'success';
}

interface FriendlyPlanReport {
  tone: 'calm' | 'energetic' | 'urgent';
  headline: string;
  narrative: string[];
  chaosLevel: {
    score: number;
    label: string;
    description: string;
    indicator: 'low' | 'medium' | 'high';
  };
  cards: PlanReportCard[];
  actionPlan: string[];
  callToAction: string;
}

/**
 * Input pour la réorganisation
 */
export interface CleanReorganizeInput {
  detectedPacks: DetectedPackV6[];
  sourcePath: string;
  userConfirmed?: boolean; // Optionnel maintenant
  proceedWithExecution?: boolean; // Nouveau: contrôle si on exécute ou juste planifie
  quickScanSummary?: QuickScanSummary;
  config?: {
    workingPath?: string;
    createBackup?: boolean;
    cleanNames?: boolean;
    unwrapFolders?: boolean;
    dryRun?: boolean;
  };
}

/**
 * Output de la réorganisation
 */
export interface CleanReorganizeOutput {
  success: boolean;
  movedPacks: number;
  cleanedNames: number;
  unwrappedFolders: number;
  deletedContainers: number;
  workingPath: string;
  errors: string[];
  warnings: string[];
  operations: ReorganizeOperation[];
  backupPath?: string;
  rollbackAvailable: boolean;
  plannedStats?: any; // Stats du plan généré
  planReport?: FriendlyPlanReport;
}

export class Step2_CleanReorganize implements StepExecutor<CleanReorganizeInput, CleanReorganizeOutput> {
  private debugMode: boolean = false; // Flag pour contrôler la verbosité des logs

  /**
   * Active/désactive le mode debug pour contrôler la verbosité des logs
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  async execute(input: CleanReorganizeInput, onProgress?: ProgressCallback): Promise<StepResult<CleanReorganizeOutput>> {
    if (this.debugMode) {
      console.log('🚀 Step2_CleanReorganize.execute() called with:', {
        detectedPacksCount: input.detectedPacks?.length,
        sourcePath: input.sourcePath,
        userConfirmed: input.userConfirmed,
        proceedWithExecution: input.proceedWithExecution,
        config: input.config
      });
    }

    const {
      detectedPacks,
      sourcePath,
      userConfirmed = false,
      proceedWithExecution = false,
      quickScanSummary,
      config = {}
    } = input;
    const {
      workingPath = sourcePath, // Réorganiser sur place par défaut
      createBackup = false, // ❌ DÉSACTIVÉ - Éviter de copier 20+ GB !
      cleanNames = true,
      unwrapFolders = true,
      dryRun = false
    } = config;

    if (this.debugMode) {
      console.log('📋 Step 2 Configuration:', {
        workingPath,
        createBackup,
        cleanNames,
        unwrapFolders,
        dryRun,
        proceedWithExecution
      });
    }

    try {
      if (this.debugMode) {
        console.log('🔧 Step 2: Planning reorganization...');
      }
      onProgress?.(0, 'Planification de la réorganisation...');

      // Toujours planifier les opérations d'abord
      onProgress?.(10, 'Planification des opérations...');
      if (this.debugMode) {
        console.log('🔧 Step 2: About to plan operations...');
      }

      // Planifier toutes les opérations
      const operations = await this.planOperations(detectedPacks, sourcePath, workingPath, {
        cleanNames,
        unwrapFolders
      });

      // Afficher un résumé concis au lieu du log verbeux
      this.logPlanSummary(operations, detectedPacks.length);
      onProgress?.(50, `${operations.length} opérations planifiées`);

      // Si on n'a PAS encore la confirmation utilisateur, on retourne le plan pour validation
      if (!proceedWithExecution) {
        console.log('⏸️ Step 2: Waiting for user validation...');
        onProgress?.(100, 'En attente de validation utilisateur...');

        const stats = this.calculatePlanStats(operations, detectedPacks.length);
        const planReport = this.buildFriendlyPlanReport({
          detectedPacks,
          operations,
          quickScanSummary
        });

        // 🆕 Générer et sauvegarder la structure proposée après planification
        try {
          console.log('📄 Génération de la structure proposée...');
          const proposedStructure = await ProposedStructureGenerator.generate(
            sourcePath,
            operations
          );

          const proposedPath = await ProposedStructureGenerator.save(proposedStructure);
          console.log(`📄 Structure proposée sauvegardée: ${path.basename(proposedPath)}`);
        } catch (error) {
          console.warn(`⚠️ Impossible de générer la structure proposée: ${error}`);
          // Ne pas faire échouer tout le processus pour ça
        }

        return {
          success: true,
          data: {
            success: true,
            movedPacks: 0,
            cleanedNames: 0,
            unwrappedFolders: 0,
            deletedContainers: 0,
            workingPath,
            errors: [],
            warnings: [],
            operations,
            rollbackAvailable: false,
            plannedStats: stats,
            planReport
          },
          progress: 100,
          canProceed: false,
          userActionRequired: {
            type: 'confirmation',
            title: planReport.headline,
            message: planReport.callToAction,
            defaultValue: { planReport },
            required: true,
            canSkip: false
          }
        };
      }

      // Si on a la confirmation, on exécute vraiment
      console.log('✅ Step 2: User confirmed, executing reorganization...');
      onProgress?.(60, 'Exécution de la réorganisation...');

      // Créer le dossier de travail seulement si différent du source
      if (!dryRun && workingPath !== sourcePath) {
        await this.ensureWorkingDirectory(workingPath);
      }

      let backupPath: string | undefined;

      // Créer un backup si demandé
      if (createBackup && !dryRun) {
        onProgress?.(65, 'Création du backup...');
        backupPath = await this.createBackup(sourcePath);
        onProgress?.(70, 'Backup créé');
      }

      // Exécuter les opérations
      const executionResult = await this.executeOperations(operations, dryRun, (opProgress) => {
        onProgress?.(70 + (opProgress * 0.25), 'Réorganisation en cours...');
      });

      onProgress?.(90, 'Finalisation...');

      // 5. Vérifier l'intégrité
      const verification = await this.verifyReorganization(workingPath, detectedPacks);

      onProgress?.(100, 'Réorganisation terminée');

      const plannedStats = this.calculatePlanStats(operations, detectedPacks.length);

      const result: CleanReorganizeOutput = {
        success: executionResult.success,
        movedPacks: executionResult.movedPacks,
        cleanedNames: executionResult.cleanedNames,
        unwrappedFolders: executionResult.unwrappedFolders,
        deletedContainers: executionResult.deletedContainers,
        workingPath,
        errors: [...executionResult.errors, ...verification.errors],
        warnings: [...executionResult.warnings, ...verification.warnings],
        operations,
        backupPath,
        rollbackAvailable: !!backupPath,
        plannedStats
      };

      return {
        success: result.success,
        data: result,
        progress: 100,
        canProceed: result.success,
        metrics: {
          startTime: Date.now(),
          endTime: Date.now(),
          duration: 0,
          itemsProcessed: operations.length,
          processingSpeed: operations.length / 1
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'REORGANIZATION_ERROR',
          message: error.message,
          details: error,
          recoverable: true,
          suggestedAction: 'Vérifier les permissions et l\'espace disque'
        },
        progress: 0,
        canProceed: false
      };
    }
  }

  validate(input: CleanReorganizeInput): ValidationResult {
    const errors = [];
    const warnings = [];

    if (!input.detectedPacks || input.detectedPacks.length === 0) {
      errors.push({
        field: 'detectedPacks',
        message: 'Aucun pack détecté à réorganiser'
      });
    }

    if (!input.sourcePath || !fs.existsSync(input.sourcePath)) {
      errors.push({
        field: 'sourcePath',
        message: 'Le chemin source n\'existe pas'
      });
    }

    if (input.config?.workingPath && fs.existsSync(input.config.workingPath)) {
      warnings.push('Le dossier de travail existe déjà, il sera écrasé');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      canProceedWithWarnings: true
    };
  }

  getName(): string {
    return 'Clean & Reorganize';
  }

  getDescription(): string {
    return 'Nettoie et réorganise les packs au niveau racine avec noms propres';
  }

  estimateTime(input: CleanReorganizeInput): number {
    const packCount = input.detectedPacks?.length || 0;
    return Math.max(30, packCount * 2); // 2 secondes par pack minimum
  }

  canRetry(): boolean {
    return true;
  }

  /**
   * Crée un chemin de travail temporaire
   */
  private calculatePlanStats(operations: ReorganizeOperation[], packCount: number): any {
    const stats = {
      totalOperations: operations.length,
      moveOperations: operations.filter(op => op.type === 'move').length,
      renameOperations: operations.filter(op => op.type === 'rename').length,
      cleanOperations: operations.filter(op => op.type === 'clean').length,
      unwrapOperations: operations.filter(op => op.type === 'unwrap').length,
      createDirOperations: operations.filter(op => op.type === 'create_dir').length,
      deleteOperations: operations.filter(op => op.type === 'delete').length,
      estimatedTimeSeconds: Math.ceil(operations.length * 0.5),
      estimatedTime: Math.ceil(operations.length * 0.5) * 1000,
      totalSize: operations.reduce((sum, op) => sum + (op.size || 0), 0),
      packCount
    };
    return stats;
  }


  private buildFriendlyPlanReport(params: {
    detectedPacks: DetectedPackV6[];
    operations: ReorganizeOperation[];
    quickScanSummary?: QuickScanSummary;
  }): FriendlyPlanReport {
    const { detectedPacks, operations, quickScanSummary } = params;

    const packCount = detectedPacks.length;
    const totalSamples = quickScanSummary?.totalSamples
      ?? detectedPacks.reduce((sum, pack) => sum + (pack.audioFiles || 0), 0);
    const totalSizeBytes = quickScanSummary?.totalSize
      ?? detectedPacks.reduce((sum, pack) => sum + (pack.totalSize || 0), 0);

    const chaosScore = quickScanSummary?.chaosScore ?? 0.5;
    let indicator: 'low' | 'medium' | 'high';
    if (chaosScore >= 0.6) {
      indicator = 'high';
    } else if (chaosScore >= 0.3) {
      indicator = 'medium';
    } else {
      indicator = 'low';
    }

    const chaosLabel = indicator === 'high'
      ? 'Bordel organisé'
      : indicator === 'medium'
        ? 'À remettre d\'aplomb'
        : 'Déjà bien rangé';

    const chaosDescription = indicator === 'high'
      ? 'Le dossier mélange bundles, wrappers et noms incohérents. On va tout démêler.'
      : indicator === 'medium'
        ? 'Il y a quelques couches inutiles et des noms douteux. Un petit rafraîchissement s\'impose.'
        : 'La base est saine, on passe un coup de polish pour que tout soit nickel.';

    const tone: FriendlyPlanReport['tone'] = indicator === 'high'
      ? 'urgent'
      : indicator === 'medium'
        ? 'energetic'
        : 'calm';

    const moveOps = operations.filter(op => op.type === 'move').length;
    const cleanOps = operations.filter(op => op.type === 'clean').length;
    const unwrapOps = operations.filter(op => op.type === 'unwrap').length;
    const deleteOps = operations.filter(op => op.type === 'delete').length;

    const narrative: string[] = [];
    if (indicator === 'high') {
      narrative.push('Ok, j\'ai analysé ton dossier : c\'est un joyeux bazar.');
      narrative.push('On va extraire les packs enfermés dans des bundles et remettre tout à plat.');
    } else if (indicator === 'medium') {
      narrative.push('J\'ai repéré plusieurs couches inutiles et des noms pas super clairs.');
      narrative.push('On va simplifier tout ça pour que chaque pack soit accessible directement.');
    } else {
      narrative.push('Bonne nouvelle, la structure de base est déjà propre.');
      narrative.push('Je te propose tout de même de nettoyer les noms et de garder une base impeccable.');
    }

    const scanDurationSeconds = quickScanSummary?.scanDuration
      ? Math.max(1, Math.round(quickScanSummary.scanDuration / 1000))
      : undefined;

    const cards: PlanReportCard[] = [
      {
        label: 'Samples détectés',
        value: this.formatNumber(totalSamples),
        hint: scanDurationSeconds ? `Analysés en ${scanDurationSeconds} s` : undefined
      },
      {
        label: 'Packs identifiés',
        value: this.formatNumber(packCount)
      },
      {
        label: 'Volume total',
        value: this.formatBytes(totalSizeBytes || 0)
      }
    ];

    const actionPlan: string[] = [];
    if (unwrapOps > 0) {
      actionPlan.push(`Extraire ${this.formatNumber(unwrapOps)} bundle(s) pour remonter les packs au niveau racine.`);
    }
    if (cleanOps > 0) {
      actionPlan.push(`Nettoyer ${this.formatNumber(cleanOps)} nom(s) de dossier pour virer underscores & majuscules criardes.`);
    }
    if (moveOps > 0) {
      actionPlan.push(`Déplacer ${this.formatNumber(moveOps)} dossier(s) pour obtenir une structure plate et lisible.`);
    }
    if (deleteOps > 0) {
      actionPlan.push(`Supprimer ${this.formatNumber(deleteOps)} conteneur(s) désormais vide(s).`);
    }
    if (actionPlan.length === 0) {
      actionPlan.push('Vérifier la structure et valider que tout est déjà prêt.');
    }

    const callToAction = indicator === 'high'
      ? 'On lance le grand nettoyage ? Je m\'occupe de remettre chaque pack à la bonne place.'
      : indicator === 'medium'
        ? 'On s\'y met ? Je vais simplifier la hiérarchie et clarifier les noms en quelques clics.'
        : 'On finalise ? Je passe un coup de polish pour que ton dossier reste exemplaire.';

    return {
      tone,
      headline: indicator === 'high'
        ? 'Prêt à dompter le chaos ?'
        : indicator === 'medium'
          ? 'On range ça proprement ?'
          : 'Un petit polish et c\'est parfait',
      narrative,
      chaosLevel: {
        score: chaosScore,
        label: chaosLabel,
        description: chaosDescription,
        indicator
      },
      cards,
      actionPlan,
      callToAction
    };
  }

  private formatNumber(value: number): string {
    if (!Number.isFinite(value)) {
      return '0';
    }
    return new Intl.NumberFormat('fr-FR').format(Math.max(0, Math.round(value)));
  }

  private formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) {
      return '0 o';
    }

    const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
    let index = 0;
    let value = bytes;

    while (value >= 1024 && index < units.length - 1) {
      value /= 1024;
      index++;
    }

    return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
  }

  private createWorkingPath(sourcePath: string): string {
    const parentDir = path.dirname(sourcePath);
    const baseName = path.basename(sourcePath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return path.join(parentDir, `${baseName}_reorganized_${timestamp}`);
  }

  /**
   * Assure que le dossier de travail existe
   */
  private async ensureWorkingDirectory(workingPath: string): Promise<void> {
    if (!fs.existsSync(workingPath)) {
      fs.mkdirSync(workingPath, { recursive: true });
    }
  }

  /**
   * Planifie toutes les opérations de réorganisation
   */
  private async planOperations(
    detectedPacks: DetectedPackV6[],
    sourcePath: string,
    workingPath: string,
    options: { cleanNames: boolean; unwrapFolders: boolean }
  ): Promise<ReorganizeOperation[]> {
    if (this.debugMode) {
      console.log('🎯 planOperations() called with:', {
        packsCount: detectedPacks.length,
        sourcePath,
        workingPath,
        options
      });
    }

    const operations: ReorganizeOperation[] = [];
    let priority = 0;
    const PRIORITY_BASE = 1000; // Base priority for regular operations
    const PRIORITY_DELETE = 9000; // High priority for delete operations (executed last)
    const handledPaths = new Set<string>();
    const packIndex = new Map<string, DetectedPackV6>();

    for (const pack of detectedPacks) {
      packIndex.set(this.normalizePath(pack.path), pack);
    }

    if (this.debugMode) {
      console.log('📦 Processing packs for operations...');
    }

    // CORRECTION CRITIQUE: Identifier d'abord tous les bundles et leurs relations
    // avant de commencer le traitement pour éviter le conflit handledPaths
    const bundleRelations = new Map<string, DetectedPackV6[]>();
    for (const pack of detectedPacks) {
      if (options.unwrapFolders && (pack.type === 'WRAPPER_FOLDER' || pack.type === 'BUNDLE_CONTAINER')) {
        const normalizedPackPath = this.normalizePath(pack.path);
        const nestedPacks = this.findNestedDetectedPacks(pack, detectedPacks, packIndex);
        if (this.debugMode) {
          console.log(`🔍 Bundle analysis: ${pack.name} (${pack.type}) -> ${nestedPacks.length} nested packs found`);
        }

        if (nestedPacks.length > 0) {
          bundleRelations.set(normalizedPackPath, nestedPacks);
        }
      }
    }

    // PHASE 1: Traiter d'abord tous les bundles avec leurs opérations unwrap/delete
    if (this.debugMode) {
      console.log(`🎁 Processing ${bundleRelations.size} bundles for unwrapping...`);
    }
    for (const [bundlePath, nestedPacks] of bundleRelations) {
      const bundle = packIndex.get(bundlePath);
      if (!bundle || handledPaths.has(bundlePath)) {
        continue;
      }

      if (this.debugMode) {
        console.log(`  📦 Bundle ${bundle.name}: unwrapping ${nestedPacks.length} nested packs`);
      }

      // Créer opérations unwrap pour chaque sous-pack
      nestedPacks.forEach((innerPack, index) => {
        const normalizedInner = this.normalizePath(innerPack.path);
        if (handledPaths.has(normalizedInner)) {
          return;
        }

        let targetName = innerPack.name;
        const originalName = targetName;

        if (options.cleanNames) {
          const cleanedName = NameCleanerV6.cleanSingleName(targetName);
          if (cleanedName !== targetName) {
            operations.push({
              id: `clean_${innerPack.id || `${bundle.id}_nested_${index}`}`,
              type: 'clean',
              sourcePath: originalName,
              targetPath: cleanedName,
              reason: 'Name cleaning applied',
              priority: PRIORITY_BASE + priority++
            });
            targetName = cleanedName;
          }
        }

        operations.push({
          id: `unwrap_${innerPack.id || `${bundle.id}_nested_${index}`}`,
          type: 'unwrap',
          sourcePath: innerPack.path,
          targetPath: path.join(workingPath, targetName),
          reason: `Extraction depuis ${path.basename(bundle.path)}`,
          priority: priority++
        });

        handledPaths.add(normalizedInner);
      });

      // Créer opération delete pour le bundle vide
      operations.push({
        id: `cleanup_${bundle.id}`,
        type: 'delete',
        sourcePath: bundle.path,
        targetPath: '',
        reason: 'Suppression du bundle après extraction',
        priority: PRIORITY_DELETE + priority++
      });

      handledPaths.add(bundlePath);
    }

    // PHASE 2: Traiter les packs restants avec des opérations move/clean normales
    if (this.debugMode) {
      console.log('📁 Processing remaining packs for move operations...');
    }
    for (let i = 0; i < detectedPacks.length; i++) {
      const pack = detectedPacks[i];
      if (this.debugMode) {
        console.log(`  📦 Pack ${i + 1}/${detectedPacks.length}: ${pack.name} (${pack.type})`);
      }
      const normalizedPackPath = this.normalizePath(pack.path);

      // Skip si déjà traité dans les bundles
      if (handledPaths.has(normalizedPackPath)) {
        if (this.debugMode) {
          console.log(`    ↳ Skipped (already handled in bundle unwrapping)`);
        }
        continue;
      }

      // RÈGLE CRITIQUE: Seuls les WRAPPER_FOLDER et BUNDLE_CONTAINER doivent être unwrappés
      // Les COMMERCIAL_PACK doivent rester intacts (ne PAS être unwrappés)
      const shouldUnwrap = options.unwrapFolders && (
        pack.type === 'WRAPPER_FOLDER'
        || pack.type === 'BUNDLE_CONTAINER'
      );

      // Fallback: Si c'est un bundle/wrapper qui n'a pas été traité en phase 1,
      // essayer de trouver des dossiers enfants directs
      if (shouldUnwrap) {
        const fallbackDirectories = this.findImmediatePackLikeFolders(pack.path);
        if (fallbackDirectories.length > 0) {
          if (this.debugMode) {
            console.log(`    ↳ Fallback unwrap: ${fallbackDirectories.length} immediate pack-like folders found`);
          }

          fallbackDirectories.forEach((dirPath, index) => {
            const normalizedInner = this.normalizePath(dirPath);
            if (handledPaths.has(normalizedInner)) {
              return;
            }

            let targetName = path.basename(dirPath);
            const originalName = targetName;

            if (options.cleanNames) {
              const cleanedName = NameCleanerV6.cleanSingleName(targetName);
              if (cleanedName !== targetName) {
                operations.push({
                  id: `clean_${pack.id}_fallback_${index}`,
                  type: 'clean',
                  sourcePath: originalName,
                  targetPath: cleanedName,
                  reason: 'Name cleaning applied',
                  priority: PRIORITY_BASE + priority++
                });
                targetName = cleanedName;
              }
            }

            operations.push({
              id: `unwrap_${pack.id}_fallback_${index}`,
              type: 'unwrap',
              sourcePath: dirPath,
              targetPath: path.join(workingPath, targetName),
              reason: `Extraction fallback depuis ${path.basename(pack.path)}`,
              priority: priority++
            });

            handledPaths.add(normalizedInner);
          });

          operations.push({
            id: `cleanup_${pack.id}`,
            type: 'delete',
            sourcePath: pack.path,
            targetPath: '',
            reason: 'Suppression du bundle après extraction',
            priority: PRIORITY_DELETE + priority++
          });

          handledPaths.add(normalizedPackPath);
          continue;
        }
      }

      // Traitement normal: move/clean
      let targetName = pack.name;
      const originalName = targetName;

      if (options.cleanNames) {
        const cleanedName = NameCleanerV6.cleanSingleName(targetName);
        if (cleanedName !== targetName) {
          operations.push({
            id: `clean_${pack.id}`,
            type: 'clean',
            sourcePath: originalName,
            targetPath: cleanedName,
            reason: 'Name cleaning applied',
            priority: priority++
          });
          targetName = cleanedName;
        }
      }

      const finalTargetPath = path.join(workingPath, targetName);

      operations.push({
        id: `move_${pack.id}`,
        type: 'move',
        sourcePath: pack.path,
        targetPath: finalTargetPath,
        reason: 'Move to root level',
        priority: PRIORITY_BASE + priority++
      });

      handledPaths.add(normalizedPackPath);
    }

    if (this.debugMode) {
      console.log(`✅ planOperations() completed: ${operations.length} operations created`);
      console.log(`   📊 Operations breakdown:`);
      console.log(`      Move: ${operations.filter(op => op.type === 'move').length}`);
      console.log(`      Clean: ${operations.filter(op => op.type === 'clean').length}`);
      console.log(`      Unwrap: ${operations.filter(op => op.type === 'unwrap').length}`);
      console.log(`      Delete: ${operations.filter(op => op.type === 'delete').length}`);
    }

    return operations;
  }

  private findNestedDetectedPacks(
    parentPack: DetectedPackV6,
    allPacks: DetectedPackV6[],
    packIndex: Map<string, DetectedPackV6>
  ): DetectedPackV6[] {
    const parentPath = this.normalizePath(parentPack.path);
    const nested = allPacks.filter(inner => {
      if (inner === parentPack) {
        return false;
      }
      const normalizedInner = this.normalizePath(inner.path);
      return normalizedInner.startsWith(parentPath + path.sep);
    });

    nested.sort((a, b) => {
      const depthA = this.getPathDepth(this.normalizePath(a.path)) - this.getPathDepth(parentPath);
      const depthB = this.getPathDepth(this.normalizePath(b.path)) - this.getPathDepth(parentPath);
      return depthA - depthB;
    });

    return nested;
  }

  private findImmediatePackLikeFolders(wrapperPath: string): string[] {
    try {
      const items = fs.readdirSync(wrapperPath, { withFileTypes: true });
      const candidates: string[] = [];

      for (const item of items) {
        if (!item.isDirectory()) {
          continue;
        }

        const dirPath = path.join(wrapperPath, item.name);
        if (this.containsPackContent(dirPath, 0, 1)) {
          candidates.push(dirPath);
        }
      }

      return candidates;
    } catch (error) {
      return [];
    }
  }

  /**
   * Exécute toutes les opérations
   */
  private async executeOperations(
    operations: ReorganizeOperation[],
    dryRun: boolean,
    onProgress?: (progress: number) => void
  ): Promise<{
    success: boolean;
    movedPacks: number;
    cleanedNames: number;
    unwrappedFolders: number;
    deletedContainers: number;
    errors: string[];
    warnings: string[];
  }> {
    const result = {
      success: true,
      movedPacks: 0,
      cleanedNames: 0,
      unwrappedFolders: 0,
      deletedContainers: 0,
      errors: [],
      warnings: []
    };

    // Trier par priorité (handle undefined priorities)
    const sortedOps = operations.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

    for (let i = 0; i < sortedOps.length; i++) {
      const op = sortedOps[i];
      onProgress?.((i / sortedOps.length) * 100);

      try {
        if (!dryRun) {
          await this.executeOperation(op);
        }

        // Compter les types d'opérations
        switch (op.type) {
          case 'move':
            result.movedPacks++;
            break;
          case 'clean':
            result.cleanedNames++;
            break;
          case 'unwrap':
            result.unwrappedFolders++;
            break;
          case 'delete':
            result.deletedContainers++;
            break;
        }

      } catch (error) {
        result.errors.push(`Operation ${op.id} failed: ${error.message}`);
        result.success = false;
      }
    }

    return result;
  }

  /**
   * Exécute une opération individuelle
   */
  private async executeOperation(operation: ReorganizeOperation): Promise<void> {
    switch (operation.type) {
      case 'move':
        await this.moveFolder(operation.sourcePath, operation.targetPath);
        break;
      case 'unwrap':
        await this.unwrapFolder(operation.sourcePath, operation.targetPath);
        break;
      case 'clean':
        // Le nettoyage est juste un changement de nom, déjà appliqué dans la planification
        break;
      case 'delete':
        await this.deleteFolder(operation.sourcePath);
        break;
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  /**
   * Déplace un dossier
   */
  private async moveFolder(source: string, target: string): Promise<void> {
    if (!fs.existsSync(source)) {
      throw new Error(`Source folder does not exist: ${source}`);
    }

    // Créer le dossier parent si nécessaire
    const parentDir = path.dirname(target);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // Gérer les conflits de noms
    let finalTarget = target;
    let counter = 1;
    while (fs.existsSync(finalTarget)) {
      const ext = path.extname(target);
      const basename = path.basename(target, ext);
      const dirname = path.dirname(target);
      finalTarget = path.join(dirname, `${basename}_${counter}${ext}`);
      counter++;
    }

    // Déplacer (ou copier si cross-device)
    try {
      fs.renameSync(source, finalTarget);
    } catch (error) {
      // Si rename échoue (cross-device), copier puis supprimer
      await this.copyFolderRecursive(source, finalTarget);
      fs.rmSync(source, { recursive: true, force: true });
    }
  }

  /**
   * Déballe un dossier wrapper
   */
  private async unwrapFolder(sourcePath: string, targetPath: string): Promise<void> {
    await this.moveFolder(sourcePath, targetPath);
  }

  /**
   * Copie récursive d'un dossier
   */
  private async copyFolderRecursive(source: string, target: string): Promise<void> {
    const stats = fs.statSync(source);

    if (stats.isDirectory()) {
      fs.mkdirSync(target, { recursive: true });
      const files = fs.readdirSync(source);

      for (const file of files) {
        const srcPath = path.join(source, file);
        const targetPath = path.join(target, file);
        await this.copyFolderRecursive(srcPath, targetPath);
      }
    } else {
      fs.copyFileSync(source, target);
    }
  }

  private async deleteFolder(folderPath: string): Promise<void> {
    try {
      if (!folderPath || !fs.existsSync(folderPath)) {
        return;
      }

      fs.rmSync(folderPath, { recursive: true, force: true });
    } catch (error) {
      throw new Error(`Unable to remove wrapper folder ${folderPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private containsPackContent(dirPath: string, depth = 0, maxDepth = 3): boolean {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);

        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (AUDIO_EXTENSIONS.has(ext) || PRESET_EXTENSIONS.has(ext)) {
            return true;
          }
        } else if (entry.isDirectory() && depth < maxDepth) {
          if (this.containsPackContent(entryPath, depth + 1, maxDepth)) {
            return true;
          }
        }
      }
    } catch (error) {
      return false;
    }

    return false;
  }

  private normalizePath(targetPath: string): string {
    return path.normalize(targetPath);
  }

  private getPathDepth(targetPath: string): number {
    return this.normalizePath(targetPath)
      .split(path.sep)
      .filter(Boolean)
      .length;
  }

  /**
   * Crée un backup du dossier source
   */
  private async createBackup(sourcePath: string): Promise<string> {
    const parentDir = path.dirname(sourcePath);
    const baseName = path.basename(sourcePath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupPath = path.join(parentDir, `${baseName}_backup_${timestamp}`);

    await this.copyFolderRecursive(sourcePath, backupPath);
    return backupPath;
  }

  /**
   * Vérifie l'intégrité de la réorganisation
   */
  private async verifyReorganization(
    workingPath: string, 
    originalPacks: DetectedPackV6[]
  ): Promise<{ errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      if (!fs.existsSync(workingPath)) {
        errors.push('Working directory does not exist after reorganization');
        return { errors, warnings };
      }

      const workingItems = fs.readdirSync(workingPath, { withFileTypes: true });
      const workingDirs = workingItems.filter(item => item.isDirectory());

      // Vérifier que nous avons un nombre raisonnable de dossiers
      if (workingDirs.length === 0) {
        errors.push('No folders found in working directory');
      } else if (workingDirs.length < originalPacks.length * 0.8) {
        warnings.push(`Fewer folders than expected (${workingDirs.length} < ${originalPacks.length})`);
      }

      // Vérifier que chaque dossier contient du contenu
      for (const dir of workingDirs) {
        const dirPath = path.join(workingPath, dir.name);
        try {
          const items = fs.readdirSync(dirPath);
          if (items.length === 0) {
            warnings.push(`Empty folder detected: ${dir.name}`);
          }
        } catch (error) {
          errors.push(`Cannot read folder: ${dir.name}`);
        }
      }

    } catch (error) {
      errors.push(`Verification failed: ${error.message}`);
    }

    return { errors, warnings };
  }

  /**
   * Affiche un résumé concis de la planification
   */
  private logPlanSummary(operations: ReorganizeOperation[], packCount: number): void {
    const moveCount = operations.filter(op => op.type === 'move').length;
    const unwrapCount = operations.filter(op => op.type === 'unwrap').length;
    const cleanCount = operations.filter(op => op.type === 'clean').length;

    console.log(`📋 Plan: ${packCount} packs → ${operations.length} opérations (${moveCount} déplacements, ${unwrapCount} dépaquetages, ${cleanCount} nettoyages)`);
  }
}
