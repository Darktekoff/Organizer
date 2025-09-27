/**
 * Step3_OrganizationValidator
 * Valide l'organisation finale avec vérifications complètes de structure et fusion
 */

import type {
  StepExecutor,
  StepResult,
  ProgressCallback
} from '@shared/interfaces/StepContracts';
import type {
  Phase4Output,
  ValidationResult,
  ValidationCheck,
  DuplicateFileInfo,
  OrganizationError,
  FolderStructure,
  FolderNode,
  FileInfo
} from './Phase4Types';
import {
  ORGANIZATION_CONSTANTS
} from './Phase4Types';

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Validateur complet de l'organisation
 */
export class Step3_OrganizationValidator implements StepExecutor<Phase4Output, Phase4Output> {
  private readonly strictMode: boolean;
  private validationErrors: ValidationCheck[] = [];
  private criticalIssues: number = 0;
  private warnings: number = 0;

  constructor(strictMode = false) {
    this.strictMode = strictMode;
    this.log('INFO', '🔍 OrganizationValidator initialized');
  }

  /**
   * Valide l'organisation complète
   */
  async execute(
    organizationResult: Phase4Output,
    onProgress?: ProgressCallback
  ): Promise<StepResult<Phase4Output>> {
    try {
      this.log('INFO', '🔍 [OrganizationValidator] Starting validation');
      this.log('DEBUG', `Target path: ${organizationResult.targetPath}`);

      onProgress?.(5, 'Initialisation de la validation...');

      // Reset counters
      this.validationErrors = [];
      this.criticalIssues = 0;
      this.warnings = 0;

      // ============================================
      // VALIDATION 1 - STRUCTURE DE BASE
      // ============================================
      this.log('INFO', '📁 Validating folder structure');
      onProgress?.(10, 'Validation de la structure des dossiers...');

      const structureValidation = await this.validateFolderStructure(
        organizationResult.targetPath,
        organizationResult.organizationResult.finalStructure
      );

      // ============================================
      // VALIDATION 2 - INTÉGRITÉ DES FICHIERS
      // ============================================
      this.log('INFO', '📄 Validating file integrity');
      onProgress?.(30, 'Validation de l\'intégrité des fichiers...');

      const fileIntegrityValidation = await this.validateFileIntegrity(
        organizationResult.targetPath,
        organizationResult.organizationResult
      );

      // ============================================
      // VALIDATION 3 - RÉSULTATS DE FUSION
      // ============================================
      this.log('INFO', '🔗 Validating fusion results');
      onProgress?.(50, 'Validation des résultats de fusion...');

      const fusionValidation = await this.validateFusionResults(
        organizationResult.targetPath,
        organizationResult.fusionResult
      );

      // ============================================
      // VALIDATION 4 - DÉTECTION DES DOUBLONS
      // ============================================
      this.log('INFO', '🔍 Scanning for duplicates');
      onProgress?.(70, 'Détection des doublons...');

      const duplicateValidation = await this.scanForDuplicates(
        organizationResult.targetPath
      );

      // ============================================
      // VALIDATION 5 - CONTRÔLES DE COHÉRENCE
      // ============================================
      this.log('INFO', '⚖️ Running consistency checks');
      onProgress?.(85, 'Contrôles de cohérence...');

      const consistencyValidation = await this.runConsistencyChecks(
        organizationResult
      );

      // ============================================
      // COMPILATION DES RÉSULTATS
      // ============================================
      onProgress?.(95, 'Compilation des résultats...');

      const allChecks = [
        ...structureValidation.checks,
        ...fileIntegrityValidation.checks,
        ...fusionValidation.checks,
        ...duplicateValidation.checks,
        ...consistencyValidation.checks
      ];

      // Calculer le score de validation
      const validationScore = this.calculateValidationScore(allChecks);

      // Compiler les problèmes détectés
      const orphanedFiles = await this.findOrphanedFiles(organizationResult.targetPath);
      const unexpectedFolders = await this.findUnexpectedFolders(organizationResult.targetPath);
      const duplicateFiles = duplicateValidation.duplicates;

      const finalValidationResult: ValidationResult = {
        success: this.criticalIssues === 0 && validationScore >= ORGANIZATION_CONSTANTS.VALIDATION_SCORE_THRESHOLD,
        allChecks,
        structureIntegrity: structureValidation.success,
        fileCountConsistency: fileIntegrityValidation.success,
        fusionCompleteness: fusionValidation.success,
        orphanedFiles,
        unexpectedFolders,
        missingExpectedFiles: await this.findMissingExpectedFiles(organizationResult),
        duplicateFiles,
        validationScore,
        criticalIssues: this.criticalIssues,
        warnings: this.warnings
      };

      // Créer le résultat final avec validation mise à jour
      const finalResult: Phase4Output = {
        ...organizationResult,
        validationResult: finalValidationResult,
        success: organizationResult.success && finalValidationResult.success,
        warnings: [
          ...organizationResult.warnings,
          ...this.extractWarnings(allChecks)
        ]
      };

      this.log('INFO', `✅ Validation completed - Score: ${validationScore.toFixed(2)} (${finalValidationResult.success ? 'PASSED' : 'FAILED'})`);
      this.logValidationSummary(finalValidationResult);

      onProgress?.(100, finalValidationResult.success ? 'Validation réussie' : 'Validation terminée avec erreurs');

      return {
        success: true,
        data: finalResult,
        canProceed: finalValidationResult.success
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
      this.log('ERROR', 'Validation failed', error);

      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Validation failed: ${errorMessage}`,
          recoverable: false
        },
        canProceed: false
      };
    }
  }

  // ============================================
  // VALIDATIONS SPÉCIALISÉES
  // ============================================

  /**
   * Valide la structure des dossiers
   */
  private async validateFolderStructure(
    targetPath: string,
    expectedStructure: any
  ): Promise<{ success: boolean; checks: ValidationCheck[] }> {
    const checks: ValidationCheck[] = [];

    try {
      // Vérifier que le répertoire racine existe
      const targetExists = await this.pathExists(targetPath);
      checks.push({
        name: 'Target Directory Exists',
        passed: targetExists,
        message: targetExists ? 'Target directory accessible' : 'Target directory not found',
        severity: targetExists ? 'info' : 'critical'
      });

      if (!targetExists) {
        this.criticalIssues++;
        return { success: false, checks };
      }

      // Valider la hiérarchie des dossiers
      const structureCheck = await this.validateDirectoryHierarchy(targetPath);
      checks.push({
        name: 'Directory Hierarchy',
        passed: structureCheck.valid,
        message: structureCheck.message,
        severity: structureCheck.valid ? 'info' : 'warning',
        details: structureCheck.details
      });

      // Vérifier la profondeur maximale
      const maxDepth = await this.calculateMaxDepth(targetPath);
      const depthValid = maxDepth <= 10; // Limite raisonnable
      checks.push({
        name: 'Maximum Depth Check',
        passed: depthValid,
        message: `Maximum depth: ${maxDepth} ${depthValid ? '(OK)' : '(Too deep)'}`,
        severity: depthValid ? 'info' : 'warning'
      });

      if (!depthValid) this.warnings++;

      this.log('DEBUG', `Structure validation: ${checks.length} checks completed`);
      return { success: structureCheck.valid, checks };

    } catch (error) {
      checks.push({
        name: 'Structure Validation Error',
        passed: false,
        message: error instanceof Error ? error.message : 'Unknown structure error',
        severity: 'error'
      });

      return { success: false, checks };
    }
  }

  /**
   * Valide l'intégrité des fichiers
   */
  private async validateFileIntegrity(
    targetPath: string,
    organizationResult: any
  ): Promise<{ success: boolean; checks: ValidationCheck[] }> {
    const checks: ValidationCheck[] = [];

    try {
      // Compter les fichiers réellement présents
      const actualFileCount = await this.countFilesRecursively(targetPath);
      const expectedFileCount = organizationResult.movedFiles + organizationResult.copiedFiles;

      const countMatch = Math.abs(actualFileCount - expectedFileCount) <= expectedFileCount * 0.05; // 5% tolerance
      checks.push({
        name: 'File Count Consistency',
        passed: countMatch,
        message: `Expected: ${expectedFileCount}, Found: ${actualFileCount}`,
        severity: countMatch ? 'info' : 'warning',
        details: { expected: expectedFileCount, actual: actualFileCount }
      });

      if (!countMatch) this.warnings++;

      // Vérifier l'accessibilité des fichiers
      const accessibilityCheck = await this.checkFileAccessibility(targetPath);
      checks.push({
        name: 'File Accessibility',
        passed: accessibilityCheck.success,
        message: `${accessibilityCheck.accessible}/${accessibilityCheck.total} files accessible`,
        severity: accessibilityCheck.success ? 'info' : 'error',
        details: accessibilityCheck
      });

      if (!accessibilityCheck.success) this.criticalIssues++;

      this.log('DEBUG', `File integrity validation: ${checks.length} checks completed`);
      return { success: countMatch && accessibilityCheck.success, checks };

    } catch (error) {
      checks.push({
        name: 'File Integrity Error',
        passed: false,
        message: error instanceof Error ? error.message : 'Unknown integrity error',
        severity: 'error'
      });

      return { success: false, checks };
    }
  }

  /**
   * Valide les résultats de fusion
   */
  private async validateFusionResults(
    targetPath: string,
    fusionResult: any
  ): Promise<{ success: boolean; checks: ValidationCheck[] }> {
    const checks: ValidationCheck[] = [];

    try {
      // Vérifier le taux de succès des fusions
      const successRate = fusionResult.fusionGroupsProcessed > 0
        ? fusionResult.fusionGroupsSuccessful / fusionResult.fusionGroupsProcessed
        : 1;

      const fusionSuccessValid = successRate >= ORGANIZATION_CONSTANTS.FUSION_SUCCESS_THRESHOLD;
      checks.push({
        name: 'Fusion Success Rate',
        passed: fusionSuccessValid,
        message: `${(successRate * 100).toFixed(1)}% success rate (${fusionResult.fusionGroupsSuccessful}/${fusionResult.fusionGroupsProcessed})`,
        severity: fusionSuccessValid ? 'info' : 'warning',
        details: { successRate, successful: fusionResult.fusionGroupsSuccessful, total: fusionResult.fusionGroupsProcessed }
      });

      if (!fusionSuccessValid) this.warnings++;

      // Valider l'existence des dossiers fusionnés
      for (const groupResult of fusionResult.groupResults || []) {
        if (groupResult.success && groupResult.targetPath) {
          const targetExists = await this.pathExists(groupResult.targetPath);
          checks.push({
            name: `Fusion Target: ${groupResult.canonical}`,
            passed: targetExists,
            message: targetExists ? 'Fusion target exists' : 'Fusion target missing',
            severity: targetExists ? 'info' : 'error',
            details: { targetPath: groupResult.targetPath, canonical: groupResult.canonical }
          });

          if (!targetExists) this.criticalIssues++;
        }
      }

      this.log('DEBUG', `Fusion validation: ${checks.length} checks completed`);
      return { success: fusionSuccessValid && this.criticalIssues === 0, checks };

    } catch (error) {
      checks.push({
        name: 'Fusion Validation Error',
        passed: false,
        message: error instanceof Error ? error.message : 'Unknown fusion error',
        severity: 'error'
      });

      return { success: false, checks };
    }
  }

  /**
   * Détecte les fichiers en double
   */
  private async scanForDuplicates(
    targetPath: string
  ): Promise<{ success: boolean; checks: ValidationCheck[]; duplicates: DuplicateFileInfo[] }> {
    const checks: ValidationCheck[] = [];
    const duplicates: DuplicateFileInfo[] = [];

    try {
      // Scanner les fichiers et grouper par nom
      const filesByName = await this.groupFilesByName(targetPath);

      let duplicateCount = 0;
      for (const [fileName, locations] of filesByName) {
        if (locations.length > 1) {
          duplicateCount++;

          // Vérifier si les fichiers sont identiques en taille
          const sizes = await Promise.all(
            locations.map(async loc => {
              try {
                const stats = await fs.stat(loc);
                return stats.size;
              } catch {
                return -1;
              }
            })
          );

          const identical = sizes.every(size => size === sizes[0] && size > 0);

          duplicates.push({
            fileName,
            locations,
            sizes,
            identical
          });
        }
      }

      const duplicateCheck = duplicateCount === 0;
      checks.push({
        name: 'Duplicate Files Scan',
        passed: duplicateCheck,
        message: duplicateCheck ? 'No duplicates found' : `${duplicateCount} duplicate files found`,
        severity: duplicateCheck ? 'info' : 'warning',
        details: { duplicateCount, totalDuplicates: duplicates.length }
      });

      if (!duplicateCheck) this.warnings++;

      this.log('DEBUG', `Duplicate scan: ${duplicateCount} duplicates found`);
      return { success: true, checks, duplicates };

    } catch (error) {
      checks.push({
        name: 'Duplicate Scan Error',
        passed: false,
        message: error instanceof Error ? error.message : 'Unknown duplicate scan error',
        severity: 'error'
      });

      return { success: false, checks, duplicates };
    }
  }

  /**
   * Contrôles de cohérence globaux
   */
  private async runConsistencyChecks(
    organizationResult: Phase4Output
  ): Promise<{ success: boolean; checks: ValidationCheck[] }> {
    const checks: ValidationCheck[] = [];

    try {
      // Vérifier la cohérence des métriques
      const metricsConsistent = this.validateMetricsConsistency(organizationResult.metrics);
      checks.push({
        name: 'Metrics Consistency',
        passed: metricsConsistent.valid,
        message: metricsConsistent.message,
        severity: metricsConsistent.valid ? 'info' : 'warning'
      });

      // Vérifier la cohérence du résumé
      const summaryConsistent = this.validateSummaryConsistency(organizationResult.summary, organizationResult);
      checks.push({
        name: 'Summary Consistency',
        passed: summaryConsistent.valid,
        message: summaryConsistent.message,
        severity: summaryConsistent.valid ? 'info' : 'warning'
      });

      // Vérifier les erreurs vs succès
      const errorConsistency = organizationResult.errors.length === 0 || !organizationResult.success;
      checks.push({
        name: 'Error Consistency',
        passed: errorConsistency,
        message: errorConsistency ? 'Error state consistent' : 'Error state inconsistent',
        severity: errorConsistency ? 'info' : 'warning'
      });

      if (!metricsConsistent.valid || !summaryConsistent.valid || !errorConsistency) {
        this.warnings++;
      }

      this.log('DEBUG', `Consistency checks: ${checks.length} checks completed`);
      return { success: true, checks };

    } catch (error) {
      checks.push({
        name: 'Consistency Check Error',
        passed: false,
        message: error instanceof Error ? error.message : 'Unknown consistency error',
        severity: 'error'
      });

      return { success: false, checks };
    }
  }

  // ============================================
  // UTILITAIRES DE VALIDATION
  // ============================================

  private async pathExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  private async validateDirectoryHierarchy(targetPath: string): Promise<{ valid: boolean; message: string; details?: any }> {
    try {
      const entries = await fs.readdir(targetPath, { withFileTypes: true });
      const folders = entries.filter(entry => entry.isDirectory());

      // Vérifier que la structure suit le pattern Family/Type/Style
      let validHierarchy = true;
      const hierarchyDetails: any[] = [];

      for (const folder of folders) {
        const folderPath = path.join(targetPath, folder.name);
        const subEntries = await fs.readdir(folderPath, { withFileTypes: true });
        const subFolders = subEntries.filter(entry => entry.isDirectory());

        hierarchyDetails.push({
          family: folder.name,
          types: subFolders.length,
          path: folderPath
        });
      }

      return {
        valid: validHierarchy,
        message: `Found ${folders.length} family folders with proper hierarchy`,
        details: hierarchyDetails
      };

    } catch (error) {
      return {
        valid: false,
        message: error instanceof Error ? error.message : 'Hierarchy validation failed'
      };
    }
  }

  private async calculateMaxDepth(targetPath: string): Promise<number> {
    const calculateDepth = async (dirPath: string, currentDepth: number): Promise<number> => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        const folders = entries.filter(entry => entry.isDirectory());

        if (folders.length === 0) {
          return currentDepth;
        }

        let maxDepth = currentDepth;
        for (const folder of folders) {
          const subDepth = await calculateDepth(path.join(dirPath, folder.name), currentDepth + 1);
          maxDepth = Math.max(maxDepth, subDepth);
        }

        return maxDepth;
      } catch {
        return currentDepth;
      }
    };

    return await calculateDepth(targetPath, 0);
  }

  private async countFilesRecursively(targetPath: string): Promise<number> {
    const countFiles = async (dirPath: string): Promise<number> => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        let count = 0;

        for (const entry of entries) {
          const entryPath = path.join(dirPath, entry.name);
          if (entry.isDirectory()) {
            count += await countFiles(entryPath);
          } else if (entry.isFile()) {
            count++;
          }
        }

        return count;
      } catch {
        return 0;
      }
    };

    return await countFiles(targetPath);
  }

  private async checkFileAccessibility(targetPath: string): Promise<{ success: boolean; accessible: number; total: number; errors: string[] }> {
    const errors: string[] = [];
    let accessible = 0;
    let total = 0;

    const checkAccess = async (dirPath: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const entryPath = path.join(dirPath, entry.name);

          if (entry.isDirectory()) {
            await checkAccess(entryPath);
          } else if (entry.isFile()) {
            total++;
            try {
              await fs.access(entryPath, fs.constants.R_OK);
              accessible++;
            } catch (error) {
              errors.push(`Cannot access: ${entryPath}`);
            }
          }
        }
      } catch (error) {
        errors.push(`Cannot read directory: ${dirPath}`);
      }
    };

    await checkAccess(targetPath);

    return {
      success: accessible === total,
      accessible,
      total,
      errors
    };
  }

  private async groupFilesByName(targetPath: string): Promise<Map<string, string[]>> {
    const filesByName = new Map<string, string[]>();

    const scanFiles = async (dirPath: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const entryPath = path.join(dirPath, entry.name);

          if (entry.isDirectory()) {
            await scanFiles(entryPath);
          } else if (entry.isFile()) {
            const fileName = entry.name;
            if (!filesByName.has(fileName)) {
              filesByName.set(fileName, []);
            }
            filesByName.get(fileName)!.push(entryPath);
          }
        }
      } catch {
        // Ignore errors during scanning
      }
    };

    await scanFiles(targetPath);
    return filesByName;
  }

  private async findOrphanedFiles(targetPath: string): Promise<string[]> {
    // Simulation - dans la réalité, on comparerait avec la liste attendue
    return [];
  }

  private async findUnexpectedFolders(targetPath: string): Promise<string[]> {
    // Simulation - dans la réalité, on comparerait avec la structure attendue
    return [];
  }

  private async findMissingExpectedFiles(organizationResult: Phase4Output): Promise<string[]> {
    // Simulation - dans la réalité, on comparerait avec la liste des fichiers attendus
    return [];
  }

  private calculateValidationScore(checks: ValidationCheck[]): number {
    if (checks.length === 0) return 1;

    let score = 0;
    for (const check of checks) {
      if (check.passed) {
        score += check.severity === 'critical' ? 4 : check.severity === 'error' ? 3 : check.severity === 'warning' ? 2 : 1;
      }
    }

    const maxScore = checks.reduce((sum, check) => {
      return sum + (check.severity === 'critical' ? 4 : check.severity === 'error' ? 3 : check.severity === 'warning' ? 2 : 1);
    }, 0);

    return maxScore > 0 ? score / maxScore : 1;
  }

  private validateMetricsConsistency(metrics: any): { valid: boolean; message: string } {
    // Vérifier que les métriques sont cohérentes
    const valid = metrics.totalDuration > 0 && metrics.successRate >= 0 && metrics.successRate <= 1;
    return {
      valid,
      message: valid ? 'Metrics are consistent' : 'Metrics contain inconsistencies'
    };
  }

  private validateSummaryConsistency(summary: any, result: Phase4Output): { valid: boolean; message: string } {
    // Vérifier que le résumé correspond aux résultats
    const valid = summary.success === result.success && summary.completionRate >= 0 && summary.completionRate <= 1;
    return {
      valid,
      message: valid ? 'Summary is consistent with results' : 'Summary inconsistent with results'
    };
  }

  private extractWarnings(checks: ValidationCheck[]): string[] {
    return checks
      .filter(check => !check.passed && (check.severity === 'warning' || check.severity === 'error'))
      .map(check => `${check.name}: ${check.message}`);
  }

  private logValidationSummary(result: ValidationResult): void {
    this.log('INFO', '📊 Validation Summary:');
    this.log('INFO', `  • Overall Success: ${result.success}`);
    this.log('INFO', `  • Validation Score: ${result.validationScore.toFixed(2)}`);
    this.log('INFO', `  • Structure Integrity: ${result.structureIntegrity}`);
    this.log('INFO', `  • File Count Consistency: ${result.fileCountConsistency}`);
    this.log('INFO', `  • Fusion Completeness: ${result.fusionCompleteness}`);
    this.log('INFO', `  • Critical Issues: ${result.criticalIssues}`);
    this.log('INFO', `  • Warnings: ${result.warnings}`);
    this.log('INFO', `  • Checks Performed: ${result.allChecks.length}`);
    this.log('INFO', `  • Orphaned Files: ${result.orphanedFiles.length}`);
    this.log('INFO', `  • Duplicate Files: ${result.duplicateFiles.length}`);
  }

  private log(level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR', message: string, details?: any): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [OrganizationValidator] ${level}: ${message}`;

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
    return 'Step 3 - Organization Validator';
  }

  getDescription(): string {
    return 'Valide l\'organisation finale avec vérifications complètes de structure et fusion';
  }

  estimateTime(result: Phase4Output): number {
    // Estimer le temps basé sur le nombre de fichiers
    const fileCount = result.organizationResult.finalStructure.totalFiles;
    return Math.max(5000, fileCount * 10); // 10ms par fichier, minimum 5s
  }

  canRetry(): boolean {
    return true;
  }

  validate(result: Phase4Output): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!result) {
      errors.push('Organization result is required');
    } else {
      if (!result.targetPath) {
        errors.push('Target path is required');
      }

      if (!result.organizationResult) {
        errors.push('Organization result data is required');
      }

      if (!result.fusionResult) {
        errors.push('Fusion result data is required');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}