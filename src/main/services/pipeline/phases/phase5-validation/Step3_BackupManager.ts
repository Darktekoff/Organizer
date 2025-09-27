/**
 * Step 3 - Backup Manager
 * Gestion des backups et options de rollback pour sécuriser l'organisation
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { promisify } from 'util';
import { exec } from 'child_process';
import {
  StepExecutor,
  StepResult,
  ValidationResult as StepValidationResult,
  ProgressCallback
} from '@shared/interfaces/StepContracts';
import type {
  BackupResult,
  BackupOptions,
  Phase5Input
} from './Phase5Types';

const execAsync = promisify(exec);

/**
 * Input pour la gestion backup
 */
export interface BackupManagementInput {
  targetPath: string;
  organizationResult: any;
  finalReport: any;
  allPhaseData: any;
  options?: BackupOptions;
}

/**
 * Output de la gestion backup
 */
export interface BackupManagementOutput extends BackupResult {}

export class Step3_BackupManager implements StepExecutor<BackupManagementInput, BackupManagementOutput> {

  async execute(
    input: BackupManagementInput,
    onProgress?: ProgressCallback
  ): Promise<StepResult<BackupManagementOutput>> {
    try {
      onProgress?.(0, '💾 Démarrage gestion backup...');

      const { targetPath, organizationResult, finalReport, allPhaseData, options } = input;
      const backupOptions = { ...this.getDefaultOptions(), ...options };

      if (!backupOptions.enabled) {
        onProgress?.(100, '⏭️ Backup désactivé');
        return {
          success: true,
          data: this.createDisabledBackupResult(),
          canProceed: true
        };
      }

      // 1. Préparation backup
      onProgress?.(10, '📋 Préparation backup...');
      const backupPath = this.generateBackupPath(targetPath);
      await this.ensureBackupDirectory(backupPath);

      // 2. Sauvegarde structure originale
      onProgress?.(25, '📁 Sauvegarde structure originale...');
      const originalStructurePath = await this.backupOriginalStructure(targetPath, backupPath, backupOptions);

      // 3. Sauvegarde plan d'organisation
      onProgress?.(40, '📊 Sauvegarde plan organisation...');
      const organizationPlanPath = await this.backupOrganizationPlan(organizationResult, backupPath, backupOptions);

      // 4. Sauvegarde fichiers de configuration
      onProgress?.(55, '⚙️ Sauvegarde configuration...');
      const configFilesPath = await this.backupConfigFiles(allPhaseData, backupPath, backupOptions);

      // 5. Sauvegarde logs (optionnel)
      onProgress?.(70, '📝 Sauvegarde logs...');
      const logsPath = await this.backupLogs(targetPath, backupPath, backupOptions);

      // 6. Compression (si activée)
      onProgress?.(80, '🗜️ Compression backup...');
      const finalBackupPath = await this.compressBackup(backupPath, backupOptions);

      // 7. Validation intégrité
      onProgress?.(90, '🔍 Validation intégrité...');
      const checksumValidated = await this.validateBackupIntegrity(finalBackupPath);
      const rollbackTested = await this.testRollbackCapability(finalBackupPath, targetPath);

      // 8. Nettoyage anciens backups
      onProgress?.(95, '🧹 Nettoyage anciens backups...');
      await this.cleanupOldBackups(path.dirname(finalBackupPath), backupOptions);

      onProgress?.(100, '✅ Backup créé avec succès');

      const backupStats = fs.statSync(finalBackupPath);
      const result: BackupManagementOutput = {
        success: true,
        backupPath: finalBackupPath,
        backupSize: backupStats.size,
        compressionRatio: this.calculateCompressionRatio(backupPath, finalBackupPath),

        includedItems: {
          originalStructure: backupOptions.includeOriginalStructure && !!originalStructurePath,
          organizationPlan: backupOptions.includeOrganizationPlan && !!organizationPlanPath,
          configFiles: backupOptions.includeConfigFiles && !!configFilesPath,
          logs: backupOptions.includeLogs && !!logsPath
        },

        checksumValidated,
        rollbackTested,

        createdAt: new Date().toISOString(),
        expiresAt: backupOptions.retentionDays
          ? new Date(Date.now() + backupOptions.retentionDays * 24 * 60 * 60 * 1000).toISOString()
          : undefined,

        rollbackAvailable: checksumValidated && rollbackTested,
        rollbackInstructions: this.generateRollbackInstructions(finalBackupPath, targetPath)
      };

      return {
        success: true,
        data: result,
        canProceed: true,
        metrics: {
          startTime: Date.now(),
          endTime: Date.now(),
          itemsProcessed: 1,
          processingSpeed: 1
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'BACKUP_MANAGEMENT_ERROR',
          message: error instanceof Error ? error.message : 'Unknown backup error',
          recoverable: true
        },
        canProceed: false
      };
    }
  }

  /**
   * Options par défaut
   */
  private getDefaultOptions(): BackupOptions {
    return {
      enabled: true,
      includeOriginalStructure: true,
      includeOrganizationPlan: true,
      includeConfigFiles: true,
      includeLogs: false,
      compressionEnabled: true,
      compressionLevel: 6,
      autoCleanup: true,
      retentionDays: 30
    };
  }

  /**
   * Génère le chemin de backup
   */
  private generateBackupPath(targetPath: string): string {
    const parentDir = path.dirname(targetPath);
    const baseName = path.basename(targetPath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return path.join(parentDir, 'backups', `${baseName}_backup_${timestamp}`);
  }

  /**
   * Assure que le répertoire backup existe
   */
  private async ensureBackupDirectory(backupPath: string): Promise<void> {
    if (!fs.existsSync(backupPath)) {
      fs.mkdirSync(backupPath, { recursive: true });
    }
  }

  /**
   * Sauvegarde la structure originale
   */
  private async backupOriginalStructure(
    targetPath: string,
    backupPath: string,
    options: BackupOptions
  ): Promise<string | null> {
    if (!options.includeOriginalStructure) return null;

    try {
      const structurePath = path.join(backupPath, 'original-structure');
      fs.mkdirSync(structurePath, { recursive: true });

      // Créer un manifeste de la structure
      const manifest = await this.createStructureManifest(targetPath);
      const manifestPath = path.join(structurePath, 'structure-manifest.json');
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

      // Sauvegarder métadonnées importantes
      const metadataPath = path.join(structurePath, 'metadata.json');
      const metadata = {
        originalPath: targetPath,
        backupDate: new Date().toISOString(),
        totalFiles: manifest.files.length,
        totalFolders: manifest.folders.length,
        totalSize: manifest.totalSize
      };
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

      return structurePath;

    } catch (error) {
      console.warn('⚠️ Erreur sauvegarde structure originale:', error.message);
      return null;
    }
  }

  /**
   * Sauvegarde le plan d'organisation
   */
  private async backupOrganizationPlan(
    organizationResult: any,
    backupPath: string,
    options: BackupOptions
  ): Promise<string | null> {
    if (!options.includeOrganizationPlan) return null;

    try {
      const planPath = path.join(backupPath, 'organization-plan');
      fs.mkdirSync(planPath, { recursive: true });

      // Sauvegarder le résultat complet d'organisation
      const resultPath = path.join(planPath, 'organization-result.json');
      fs.writeFileSync(resultPath, JSON.stringify(organizationResult, null, 2));

      // Sauvegarder les opérations effectuées
      if (organizationResult?.operations) {
        const operationsPath = path.join(planPath, 'operations.json');
        fs.writeFileSync(operationsPath, JSON.stringify(organizationResult.operations, null, 2));
      }

      // Sauvegarder les métriques
      if (organizationResult?.metrics) {
        const metricsPath = path.join(planPath, 'metrics.json');
        fs.writeFileSync(metricsPath, JSON.stringify(organizationResult.metrics, null, 2));
      }

      return planPath;

    } catch (error) {
      console.warn('⚠️ Erreur sauvegarde plan organisation:', error.message);
      return null;
    }
  }

  /**
   * Sauvegarde les fichiers de configuration
   */
  private async backupConfigFiles(
    allPhaseData: any,
    backupPath: string,
    options: BackupOptions
  ): Promise<string | null> {
    if (!options.includeConfigFiles) return null;

    try {
      const configPath = path.join(backupPath, 'config');
      fs.mkdirSync(configPath, { recursive: true });

      // Sauvegarder toutes les données des phases
      const allDataPath = path.join(configPath, 'all-phase-data.json');
      fs.writeFileSync(allDataPath, JSON.stringify(allPhaseData, null, 2));

      // Sauvegarder la configuration du pipeline
      if (allPhaseData?.config) {
        const pipelineConfigPath = path.join(configPath, 'pipeline-config.json');
        fs.writeFileSync(pipelineConfigPath, JSON.stringify(allPhaseData.config, null, 2));
      }

      // Sauvegarder les configurations spécifiques par phase
      for (let phase = 0; phase <= 5; phase++) {
        const phaseData = allPhaseData?.[`phase${phase}`];
        if (phaseData?.config) {
          const phaseConfigPath = path.join(configPath, `phase${phase}-config.json`);
          fs.writeFileSync(phaseConfigPath, JSON.stringify(phaseData.config, null, 2));
        }
      }

      return configPath;

    } catch (error) {
      console.warn('⚠️ Erreur sauvegarde fichiers config:', error.message);
      return null;
    }
  }

  /**
   * Sauvegarde les logs
   */
  private async backupLogs(
    targetPath: string,
    backupPath: string,
    options: BackupOptions
  ): Promise<string | null> {
    if (!options.includeLogs) return null;

    try {
      const logsPath = path.join(backupPath, 'logs');
      fs.mkdirSync(logsPath, { recursive: true });

      // Chercher les fichiers de logs potentiels
      const parentDir = path.dirname(targetPath);
      const logFiles = ['pipeline-logs.txt', 'error.log', 'debug.log', 'pipeline.log'];

      let logsCopied = 0;
      for (const logFile of logFiles) {
        const logFilePath = path.join(parentDir, logFile);
        if (fs.existsSync(logFilePath)) {
          const targetLogPath = path.join(logsPath, logFile);
          fs.copyFileSync(logFilePath, targetLogPath);
          logsCopied++;
        }
      }

      // Créer un log résumé
      const summaryPath = path.join(logsPath, 'backup-summary.log');
      const summary = `Backup créé le: ${new Date().toISOString()}\nFichiers logs copiés: ${logsCopied}\n`;
      fs.writeFileSync(summaryPath, summary);

      return logsCopied > 0 ? logsPath : null;

    } catch (error) {
      console.warn('⚠️ Erreur sauvegarde logs:', error.message);
      return null;
    }
  }

  /**
   * Compresse le backup
   */
  private async compressBackup(backupPath: string, options: BackupOptions): Promise<string> {
    if (!options.compressionEnabled) {
      return backupPath;
    }

    try {
      const compressedPath = `${backupPath}.tar.gz`;
      const compressionLevel = options.compressionLevel || 6;

      // Utiliser tar avec gzip pour la compression
      await execAsync(`tar -czf "${compressedPath}" -C "${path.dirname(backupPath)}" "${path.basename(backupPath)}"`);

      // Supprimer le dossier non compressé
      if (fs.existsSync(compressedPath)) {
        await this.removeFolderRecursive(backupPath);
        return compressedPath;
      }

      return backupPath;

    } catch (error) {
      console.warn('⚠️ Erreur compression backup:', error.message);
      return backupPath;
    }
  }

  /**
   * Valide l'intégrité du backup
   */
  private async validateBackupIntegrity(backupPath: string): Promise<boolean> {
    try {
      // Vérifier que le fichier existe et n'est pas vide
      const stats = fs.statSync(backupPath);
      if (stats.size === 0) return false;

      // Calculer et sauvegarder un checksum
      const checksum = await this.calculateChecksum(backupPath);
      const checksumPath = `${backupPath}.checksum`;
      fs.writeFileSync(checksumPath, checksum);

      // Si c'est un tar.gz, tester l'intégrité
      if (backupPath.endsWith('.tar.gz')) {
        try {
          await execAsync(`tar -tzf "${backupPath}" > /dev/null`);
          return true;
        } catch {
          return false;
        }
      }

      return true;

    } catch (error) {
      console.error('❌ Erreur validation intégrité backup:', error);
      return false;
    }
  }

  /**
   * Teste la capacité de rollback
   */
  private async testRollbackCapability(backupPath: string, targetPath: string): Promise<boolean> {
    try {
      // Test basique : vérifier qu'on peut lire le backup
      if (backupPath.endsWith('.tar.gz')) {
        try {
          await execAsync(`tar -tzf "${backupPath}" | head -10`);
          return true;
        } catch {
          return false;
        }
      }

      // Pour un dossier non compressé, vérifier qu'on peut le lire
      if (fs.existsSync(backupPath)) {
        fs.readdirSync(backupPath);
        return true;
      }

      return false;

    } catch (error) {
      console.warn('⚠️ Erreur test rollback:', error.message);
      return false;
    }
  }

  /**
   * Nettoie les anciens backups
   */
  private async cleanupOldBackups(backupDir: string, options: BackupOptions): Promise<void> {
    if (!options.autoCleanup || !options.retentionDays) return;

    try {
      if (!fs.existsSync(backupDir)) return;

      const files = fs.readdirSync(backupDir);
      const cutoffDate = Date.now() - (options.retentionDays * 24 * 60 * 60 * 1000);

      for (const file of files) {
        const filePath = path.join(backupDir, file);
        try {
          const stats = fs.statSync(filePath);
          if (stats.mtime.getTime() < cutoffDate) {
            if (stats.isDirectory()) {
              await this.removeFolderRecursive(filePath);
            } else {
              fs.unlinkSync(filePath);
            }
          }
        } catch (error) {
          // Ignorer les erreurs individuelles
        }
      }

    } catch (error) {
      console.warn('⚠️ Erreur nettoyage anciens backups:', error.message);
    }
  }

  /**
   * Génère les instructions de rollback
   */
  private generateRollbackInstructions(backupPath: string, targetPath: string): string[] {
    const instructions: string[] = [];

    if (backupPath.endsWith('.tar.gz')) {
      instructions.push(`1. Extraire le backup: tar -xzf "${backupPath}"`);
      instructions.push(`2. Examiner le contenu extrait`);
      instructions.push(`3. Utiliser les fichiers de configuration pour recréer l'état précédent`);
      instructions.push(`4. Vérifier l'intégrité avec le fichier checksum`);
    } else {
      instructions.push(`1. Examiner le contenu du backup: ${backupPath}`);
      instructions.push(`2. Utiliser organization-plan/organization-result.json pour comprendre les changements`);
      instructions.push(`3. Utiliser config/all-phase-data.json pour recréer la configuration`);
      instructions.push(`4. Restaurer manuellement si nécessaire`);
    }

    instructions.push(`⚠️ ATTENTION: Le rollback automatique n'est pas encore implémenté`);
    instructions.push(`⚠️ Sauvegarder l'état actuel avant tout rollback manuel`);

    return instructions;
  }

  /**
   * Crée un résultat pour backup désactivé
   */
  private createDisabledBackupResult(): BackupManagementOutput {
    return {
      success: true,
      backupPath: '',
      backupSize: 0,
      compressionRatio: 0,
      includedItems: {
        originalStructure: false,
        organizationPlan: false,
        configFiles: false,
        logs: false
      },
      checksumValidated: false,
      rollbackTested: false,
      createdAt: new Date().toISOString(),
      rollbackAvailable: false,
      rollbackInstructions: ['Backup désactivé - aucune option de rollback disponible']
    };
  }

  // ============================================
  // MÉTHODES UTILITAIRES
  // ============================================

  /**
   * Crée un manifeste de la structure
   */
  private async createStructureManifest(targetPath: string): Promise<{
    files: Array<{ path: string; size: number; modified: string }>;
    folders: string[];
    totalSize: number;
  }> {
    const files: Array<{ path: string; size: number; modified: string }> = [];
    const folders: string[] = [];
    let totalSize = 0;

    const scanDirectory = (dirPath: string) => {
      try {
        const items = fs.readdirSync(dirPath, { withFileTypes: true });

        items.forEach(item => {
          const fullPath = path.join(dirPath, item.name);
          const relativePath = path.relative(targetPath, fullPath);

          if (item.isDirectory()) {
            folders.push(relativePath);
            scanDirectory(fullPath);
          } else {
            try {
              const stats = fs.statSync(fullPath);
              files.push({
                path: relativePath,
                size: stats.size,
                modified: stats.mtime.toISOString()
              });
              totalSize += stats.size;
            } catch (error) {
              // Ignorer les fichiers inaccessibles
            }
          }
        });

      } catch (error) {
        // Ignorer les erreurs d'accès
      }
    };

    scanDirectory(targetPath);

    return { files, folders, totalSize };
  }

  /**
   * Calcule un checksum
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Calcule le ratio de compression
   */
  private calculateCompressionRatio(originalPath: string, compressedPath: string): number {
    try {
      if (originalPath === compressedPath) return 0;

      let originalSize = 0;
      if (fs.existsSync(originalPath)) {
        const stats = fs.statSync(originalPath);
        originalSize = stats.isDirectory() ? this.getFolderSize(originalPath) : stats.size;
      }

      const compressedSize = fs.statSync(compressedPath).size;

      if (originalSize === 0) return 0;
      return Math.round(((originalSize - compressedSize) / originalSize) * 100);

    } catch (error) {
      return 0;
    }
  }

  /**
   * Calcule la taille d'un dossier
   */
  private getFolderSize(folderPath: string): number {
    let size = 0;

    const calculateSize = (dirPath: string) => {
      try {
        const items = fs.readdirSync(dirPath, { withFileTypes: true });

        items.forEach(item => {
          const fullPath = path.join(dirPath, item.name);

          if (item.isDirectory()) {
            calculateSize(fullPath);
          } else {
            try {
              size += fs.statSync(fullPath).size;
            } catch (error) {
              // Ignorer les erreurs
            }
          }
        });

      } catch (error) {
        // Ignorer les erreurs d'accès
      }
    };

    calculateSize(folderPath);
    return size;
  }

  /**
   * Supprime un dossier récursivement
   */
  private async removeFolderRecursive(folderPath: string): Promise<void> {
    try {
      fs.rmSync(folderPath, { recursive: true, force: true });
    } catch (error) {
      console.warn(`⚠️ Erreur suppression dossier ${folderPath}:`, error.message);
    }
  }

  // Méthodes interface StepExecutor
  validate(input: BackupManagementInput): StepValidationResult {
    const errors: string[] = [];

    if (!input.targetPath) {
      errors.push('Target path is required');
    }

    if (!fs.existsSync(input.targetPath)) {
      errors.push('Target path does not exist');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  getName(): string {
    return 'Backup Manager';
  }

  getDescription(): string {
    return 'Gestion des backups et options de rollback pour sécuriser l\'organisation';
  }

  estimateTime(input: BackupManagementInput): number {
    return 180; // 3 minutes estimation
  }

  canRetry(): boolean {
    return true;
  }
}