/**
 * Step 3 - Execute Reorganization
 * Exécute le plan de réorganisation validé par l'utilisateur
 */

import * as fs from 'fs';
import * as path from 'path';
import { StepExecutor, StepResult, ValidationResult, ProgressCallback } from '@shared/interfaces/StepContracts';
import { DetectedPackV6, ReorganizeOperation } from '@shared/interfaces/BusinessTypes';

/**
 * Input pour l'exécution de la réorganisation
 */
export interface ExecuteReorganizationInput {
  operations: ReorganizeOperation[];
  workingPath: string;
  sourcePath: string;
  config?: {
    createBackup?: boolean;
    dryRun?: boolean;
  };
}

/**
 * Output de l'exécution
 */
export interface ExecuteReorganizationOutput {
  success: boolean;
  movedPacks: number;
  cleanedNames: number;
  unwrappedFolders: number;
  workingPath: string;
  errors: string[];
  warnings: string[];
  operations: ReorganizeOperation[];
  backupPath?: string;
  rollbackAvailable: boolean;
  executionDuration: number;
}

export class Step3_ExecuteReorganization implements StepExecutor<ExecuteReorganizationInput, ExecuteReorganizationOutput> {

  async execute(input: ExecuteReorganizationInput, onProgress?: ProgressCallback): Promise<StepResult<ExecuteReorganizationOutput>> {
    console.log('🚀 Step3_ExecuteReorganization.execute() called with:', {
      operationsCount: input.operations?.length,
      workingPath: input.workingPath,
      sourcePath: input.sourcePath,
      config: input.config
    });

    const { operations, workingPath, sourcePath, config = {} } = input;
    const { createBackup = true, dryRun = false } = config;

    const startTime = Date.now();

    try {
      onProgress?.(0, 'Initialisation de l\'exécution...');

      // Créer le dossier de travail
      if (!dryRun) {
        await this.ensureWorkingDirectory(workingPath);
      }
      onProgress?.(10, 'Dossier de travail créé');

      let backupPath: string | undefined;

      // Créer un backup si demandé
      if (createBackup && !dryRun) {
        onProgress?.(15, 'Création du backup...');
        backupPath = await this.createBackup(sourcePath);
        onProgress?.(25, 'Backup créé');
      }

      // Exécuter les opérations
      onProgress?.(30, 'Début de l\'exécution des opérations...');
      const executionResult = await this.executeOperations(operations, dryRun, (opProgress) => {
        onProgress?.(30 + (opProgress * 0.6), 'Exécution en cours...');
      });

      onProgress?.(90, 'Vérification de l\'intégrité...');

      // Vérifier l'intégrité
      const verification = await this.verifyExecution(workingPath, operations);

      onProgress?.(100, 'Exécution terminée');

      const endTime = Date.now();
      const executionDuration = endTime - startTime;

      const result: ExecuteReorganizationOutput = {
        success: executionResult.success,
        movedPacks: executionResult.movedPacks,
        cleanedNames: executionResult.cleanedNames,
        unwrappedFolders: executionResult.unwrappedFolders,
        workingPath,
        errors: [...executionResult.errors, ...verification.errors],
        warnings: [...executionResult.warnings, ...verification.warnings],
        operations,
        backupPath,
        rollbackAvailable: !!backupPath,
        executionDuration
      };

      return {
        success: result.success,
        data: result,
        progress: 100,
        canProceed: result.success,
        metrics: {
          startTime,
          endTime,
          duration: executionDuration,
          itemsProcessed: operations.length,
          processingSpeed: operations.length / (executionDuration / 1000)
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
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

  validate(input: ExecuteReorganizationInput): ValidationResult {
    const errors = [];
    const warnings = [];

    if (!input.operations || input.operations.length === 0) {
      errors.push({
        field: 'operations',
        message: 'Aucune opération à exécuter'
      });
    }

    if (!input.workingPath) {
      errors.push({
        field: 'workingPath',
        message: 'Le chemin de travail est requis'
      });
    }

    if (!input.sourcePath || !fs.existsSync(input.sourcePath)) {
      errors.push({
        field: 'sourcePath',
        message: 'Le chemin source n\'existe pas'
      });
    }

    if (input.workingPath && fs.existsSync(input.workingPath)) {
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
    return 'Execute Reorganization';
  }

  getDescription(): string {
    return 'Exécute le plan de réorganisation validé par l\'utilisateur';
  }

  estimateTime(input: ExecuteReorganizationInput): number {
    const operationCount = input.operations?.length || 0;
    return Math.max(30, operationCount * 2); // 2 secondes par opération minimum
  }

  canRetry(): boolean {
    return true;
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
    errors: string[];
    warnings: string[];
  }> {
    const result = {
      success: true,
      movedPacks: 0,
      cleanedNames: 0,
      unwrappedFolders: 0,
      errors: [],
      warnings: []
    };

    // Trier par priorité
    const sortedOps = operations.sort((a, b) => a.priority - b.priority);

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
  private async unwrapFolder(wrapperPath: string, targetPath: string): Promise<void> {
    const innerPacks = this.findInnerPacks(wrapperPath);
    if (innerPacks.length === 0) {
      throw new Error(`No inner packs found in wrapper: ${wrapperPath}`);
    }

    // Déplacer le contenu du premier pack interne
    await this.moveFolder(innerPacks[0], targetPath);
  }

  /**
   * Trouve les packs à l'intérieur d'un wrapper
   */
  private findInnerPacks(wrapperPath: string): string[] {
    try {
      const items = fs.readdirSync(wrapperPath, { withFileTypes: true });
      const subdirs = items.filter(item => item.isDirectory());

      return subdirs.map(dir => path.join(wrapperPath, dir.name));
    } catch (error) {
      return [];
    }
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
   * Vérifie l'intégrité de l'exécution
   */
  private async verifyExecution(
    workingPath: string,
    operations: ReorganizeOperation[]
  ): Promise<{ errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      if (!fs.existsSync(workingPath)) {
        errors.push('Working directory does not exist after execution');
        return { errors, warnings };
      }

      const workingItems = fs.readdirSync(workingPath, { withFileTypes: true });
      const workingDirs = workingItems.filter(item => item.isDirectory());

      // Vérifier que nous avons des dossiers
      if (workingDirs.length === 0) {
        errors.push('No folders found in working directory after execution');
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

      // Vérifier que toutes les opérations move ont bien eu lieu
      const moveOps = operations.filter(op => op.type === 'move');
      for (const op of moveOps) {
        if (!fs.existsSync(op.targetPath)) {
          errors.push(`Move operation failed: ${op.targetPath} not found`);
        }
      }

    } catch (error) {
      errors.push(`Verification failed: ${error.message}`);
    }

    return { errors, warnings };
  }
}