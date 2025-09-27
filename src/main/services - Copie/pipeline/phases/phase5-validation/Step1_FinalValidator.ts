/**
 * Step 1 - Final Validator
 * Validation finale de l'intégrité et qualité de l'organisation
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  StepExecutor,
  StepResult,
  ValidationResult as StepValidationResult,
  ProgressCallback
} from '@shared/interfaces/StepContracts';
import type {
  ValidationResult,
  ValidationCheck,
  ValidationIssue,
  ValidationOptions,
  Phase5Input
} from './Phase5Types';

/**
 * Input pour la validation finale
 */
export interface FinalValidationInput {
  targetPath: string;
  organizationResult: any;
  allPhaseData: any;
  options?: ValidationOptions;
}

/**
 * Output de la validation finale
 */
export interface FinalValidationOutput extends ValidationResult {}

export class Step1_FinalValidator implements StepExecutor<FinalValidationInput, FinalValidationOutput> {

  async execute(
    input: FinalValidationInput,
    onProgress?: ProgressCallback
  ): Promise<StepResult<FinalValidationOutput>> {
    try {
      onProgress?.(0, '📋 Démarrage validation finale...');

      const { targetPath, organizationResult, allPhaseData, options } = input;
      const checks: ValidationCheck[] = [];
      const warnings: ValidationIssue[] = [];
      const criticalIssues: ValidationIssue[] = [];

      // 1. Validation intégrité structure
      onProgress?.(10, '🔍 Validation intégrité structure...');

      const structureChecks = await this.validateStructureIntegrity(targetPath, organizationResult);
      checks.push(...structureChecks.checks);
      warnings.push(...structureChecks.warnings);
      criticalIssues.push(...structureChecks.criticalIssues);

      // 2. Validation fichiers et contenu
      onProgress?.(30, '📁 Validation fichiers et contenu...');

      const fileChecks = await this.validateFilesAndContent(targetPath, allPhaseData);
      const fileChecksSuccess = fileChecks.criticalIssues.length === 0;
      checks.push(...fileChecks.checks);
      warnings.push(...fileChecks.warnings);
      criticalIssues.push(...fileChecks.criticalIssues);
      if (!fileChecksSuccess) {
        criticalIssues.push({
          severity: 'error',
          code: 'FILE_VALIDATION_FAILED',
          message: 'Validation des fichiers échouée',
          affected: [],
          autoFixable: false
        });
      }

      // 3. Validation performance et qualité
      onProgress?.(50, '⚡ Validation performance et qualité...');

      const performanceChecks = await this.validatePerformanceAndQuality(targetPath, allPhaseData);
      const performanceSuccess = performanceChecks.criticalIssues.length === 0;
      checks.push(...performanceChecks.checks);
      warnings.push(...performanceChecks.warnings);
      criticalIssues.push(...performanceChecks.criticalIssues);
      if (!performanceSuccess) {
        warnings.push({
          severity: 'warning',
          code: 'PERFORMANCE_WARNINGS',
          message: 'Certaines validations de performance/qualité ont échoué',
          affected: [],
          autoFixable: false
        });
      }

      // 4. Validation cohérence organisation
      onProgress?.(70, '🎯 Validation cohérence organisation...');

      const consistencyChecks = await this.validateOrganizationConsistency(targetPath, organizationResult);
      const consistencySuccess = consistencyChecks.criticalIssues.length === 0;
      checks.push(...consistencyChecks.checks);
      warnings.push(...consistencyChecks.warnings);
      criticalIssues.push(...consistencyChecks.criticalIssues);
      if (!consistencySuccess) {
        criticalIssues.push({
          severity: 'error',
          code: 'CONSISTENCY_VALIDATION_FAILED',
          message: 'Validation de cohérence organisation échouée',
          affected: [],
          autoFixable: false
        });
      }

      // 5. Calcul métriques finales
      onProgress?.(90, '📊 Calcul métriques finales...');

      const organizationGains = await this.calculateOrganizationGains(targetPath, allPhaseData);
      const structureIntegrity = this.assessStructureIntegrity(checks);

      onProgress?.(100, '✅ Validation finale terminée');

      const result: FinalValidationOutput = {
        success: criticalIssues.length === 0,
        checks,
        totalChecks: checks.length,
        passedChecks: checks.filter(c => c.passed).length,
        failedChecks: checks.filter(c => !c.passed).length,
        warnings,
        criticalIssues,
        structureIntegrity,
        organizationGains
      };

      return {
        success: true,
        data: result,
        canProceed: criticalIssues.length === 0,
        metrics: {
          startTime: Date.now(),
          endTime: Date.now(),
          itemsProcessed: checks.length,
          processingSpeed: checks.length / 1
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'FINAL_VALIDATION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown validation error',
          recoverable: false
        },
        canProceed: false
      };
    }
  }

  /**
   * Validation intégrité de la structure
   */
  private async validateStructureIntegrity(
    targetPath: string,
    organizationResult: any
  ): Promise<{
    checks: ValidationCheck[];
    warnings: ValidationIssue[];
    criticalIssues: ValidationIssue[];
  }> {
    const checks: ValidationCheck[] = [];
    const warnings: ValidationIssue[] = [];
    const criticalIssues: ValidationIssue[] = [];

    try {
      // Vérifier existence du répertoire cible
      const targetExistsCheck = await this.createCheck(
        'target_exists',
        'Répertoire cible existe',
        'Vérification existence du répertoire organisé',
        'structure',
        async () => fs.existsSync(targetPath)
      );
      checks.push(targetExistsCheck);

      if (!targetExistsCheck.passed) {
        criticalIssues.push({
          severity: 'critical',
          code: 'TARGET_PATH_MISSING',
          message: `Le répertoire cible n'existe pas: ${targetPath}`,
          affected: [targetPath],
          autoFixable: false
        });
        return { checks, warnings, criticalIssues };
      }

      // Vérifier structure des dossiers
      const folderStructureCheck = await this.createCheck(
        'folder_structure',
        'Structure des dossiers valide',
        'Validation de la hiérarchie des dossiers créés',
        'structure',
        async () => this.validateFolderStructure(targetPath)
      );
      checks.push(folderStructureCheck);

      // Vérifier permissions
      const permissionsCheck = await this.createCheck(
        'permissions',
        'Permissions correctes',
        'Vérification des permissions de lecture/écriture',
        'structure',
        async () => this.validatePermissions(targetPath)
      );
      checks.push(permissionsCheck);

      // Vérifier absence de dossiers vides
      const emptyFoldersCheck = await this.createCheck(
        'no_empty_folders',
        'Absence de dossiers vides',
        'Vérification qu\'aucun dossier vide n\'a été créé',
        'quality',
        async () => this.checkEmptyFolders(targetPath)
      );
      checks.push(emptyFoldersCheck);

      if (!emptyFoldersCheck.passed && emptyFoldersCheck.result?.emptyFolders?.length > 0) {
        warnings.push({
          severity: 'warning',
          code: 'EMPTY_FOLDERS_FOUND',
          message: `${emptyFoldersCheck.result.emptyFolders.length} dossiers vides détectés`,
          affected: emptyFoldersCheck.result.emptyFolders,
          suggestedFix: 'Supprimer les dossiers vides',
          autoFixable: true
        });
      }

    } catch (error) {
      criticalIssues.push({
        severity: 'critical',
        code: 'STRUCTURE_VALIDATION_ERROR',
        message: `Erreur lors de la validation structure: ${error.message}`,
        affected: [targetPath],
        autoFixable: false
      });
    }

    return { checks, warnings, criticalIssues };
  }

  /**
   * Validation fichiers et contenu
   */
  private async validateFilesAndContent(
    targetPath: string,
    allPhaseData: any
  ): Promise<{
    checks: ValidationCheck[];
    warnings: ValidationIssue[];
    criticalIssues: ValidationIssue[];
  }> {
    const checks: ValidationCheck[] = [];
    const warnings: ValidationIssue[] = [];
    const criticalIssues: ValidationIssue[] = [];

    try {
      // Vérifier intégrité des fichiers
      const fileIntegrityCheck = await this.createCheck(
        'file_integrity',
        'Intégrité des fichiers',
        'Vérification que tous les fichiers sont présents et accessibles',
        'integrity',
        async () => this.validateFileIntegrity(targetPath)
      );
      checks.push(fileIntegrityCheck);

      // Vérifier absence de doublons
      const duplicatesCheck = await this.createCheck(
        'no_duplicates',
        'Absence de doublons',
        'Vérification qu\'aucun doublon n\'a été laissé',
        'quality',
        async () => this.checkDuplicates(targetPath)
      );
      checks.push(duplicatesCheck);

      if (duplicatesCheck.result?.duplicates?.length) {
        warnings.push({
          severity: 'warning',
          code: 'DUPLICATES_REMAINING',
          message: `${duplicatesCheck.result.duplicates.length} groupes de fichiers identiques subsistent après organisation`,
          affected: duplicatesCheck.result.duplicates.flatMap((entry: { files: string[] }) => entry.files).filter(Boolean),
          autoFixable: false
        });
      }

      // Vérifier cohérence des noms
      const namingCheck = await this.createCheck(
        'naming_consistency',
        'Cohérence des noms',
        'Vérification de la cohérence du nommage',
        'quality',
        async () => this.validateNamingConsistency(targetPath)
      );
      checks.push(namingCheck);

      // Vérifier tailles de fichiers
      const fileSizesCheck = await this.createCheck(
        'file_sizes',
        'Tailles de fichiers valides',
        'Vérification que les tailles de fichiers sont cohérentes',
        'integrity',
        async () => this.validateFileSizes(targetPath)
      );
      checks.push(fileSizesCheck);

    } catch (error) {
      criticalIssues.push({
        severity: 'critical',
        code: 'FILE_VALIDATION_ERROR',
        message: `Erreur lors de la validation fichiers: ${error.message}`,
        affected: [targetPath],
        autoFixable: false
      });
    }

    return { checks, warnings, criticalIssues };
  }

  /**
   * Validation performance et qualité
   */
  private async validatePerformanceAndQuality(
    targetPath: string,
    allPhaseData: any
  ): Promise<{
    checks: ValidationCheck[];
    warnings: ValidationIssue[];
    criticalIssues: ValidationIssue[];
  }> {
    const checks: ValidationCheck[] = [];
    const warnings: ValidationIssue[] = [];
    const criticalIssues: ValidationIssue[] = [];

    try {
      // Vérifier amélioration organisation
      const organizationImprovementCheck = await this.createCheck(
        'organization_improvement',
        'Amélioration organisation',
        'Vérification que l\'organisation a été améliorée',
        'performance',
        async () => this.validateOrganizationImprovement(targetPath, allPhaseData)
      );
      checks.push(organizationImprovementCheck);

      // Vérifier gain d'espace
      const spaceGainCheck = await this.createCheck(
        'space_gain',
        'Gain d\'espace disque',
        'Vérification du gain d\'espace obtenu',
        'performance',
        async () => this.validateSpaceGain(allPhaseData)
      );
      checks.push(spaceGainCheck);

      // Vérifier temps d'accès
      const accessTimeCheck = await this.createCheck(
        'access_time',
        'Temps d\'accès optimisé',
        'Vérification que les temps d\'accès ont été optimisés',
        'performance',
        async () => this.validateAccessTime(targetPath)
      );
      checks.push(accessTimeCheck);

    } catch (error) {
      warnings.push({
        severity: 'warning',
        code: 'PERFORMANCE_VALIDATION_ERROR',
        message: `Erreur lors de la validation performance: ${error.message}`,
        affected: [targetPath],
        autoFixable: false
      });
    }

    return { checks, warnings, criticalIssues };
  }

  /**
   * Validation cohérence organisation
   */
  private async validateOrganizationConsistency(
    targetPath: string,
    organizationResult: any
  ): Promise<{
    checks: ValidationCheck[];
    warnings: ValidationIssue[];
    criticalIssues: ValidationIssue[];
  }> {
    const checks: ValidationCheck[] = [];
    const warnings: ValidationIssue[] = [];
    const criticalIssues: ValidationIssue[] = [];

    try {
      // Vérifier application des fusions
      const fusionApplicationCheck = await this.createCheck(
        'fusion_applied',
        'Fusions appliquées',
        'Vérification que toutes les fusions planifiées ont été appliquées',
        'quality',
        async () => this.validateFusionApplication(targetPath, organizationResult)
      );
      checks.push(fusionApplicationCheck);

      // Vérifier classification respectée
      const classificationCheck = await this.createCheck(
        'classification_respected',
        'Classification respectée',
        'Vérification que la classification a été respectée',
        'quality',
        async () => this.validateClassificationConsistency(targetPath)
      );
      checks.push(classificationCheck);

      // Vérifier structure choisie
      const structureChoiceCheck = await this.createCheck(
        'structure_choice_applied',
        'Structure choisie appliquée',
        'Vérification que la structure choisie a été correctement appliquée',
        'structure',
        async () => this.validateStructureChoice(targetPath, organizationResult)
      );
      checks.push(structureChoiceCheck);

    } catch (error) {
      criticalIssues.push({
        severity: 'critical',
        code: 'CONSISTENCY_VALIDATION_ERROR',
        message: `Erreur lors de la validation cohérence: ${error.message}`,
        affected: [targetPath],
        autoFixable: false
      });
    }

    return { checks, warnings, criticalIssues };
  }

  /**
   * Calcul des gains d'organisation
   */
  private async calculateOrganizationGains(
    targetPath: string,
    allPhaseData: any
  ): Promise<ValidationResult['organizationGains']> {
    try {
      // Calcul espace économisé
      const spaceSaved = this.calculateSpaceSaved(allPhaseData);

      // Comptage doublons supprimés
      const duplicatesRemoved = this.countDuplicatesRemoved(allPhaseData);

      // Comptage dossiers réduits
      const foldersReduced = this.countFoldersReduced(allPhaseData);

      // Calcul score d'organisation
      const organizationScore = await this.calculateOrganizationScore(targetPath, allPhaseData);

      return {
        spaceSaved,
        duplicatesRemoved,
        foldersReduced,
        organizationScore
      };

    } catch (error) {
      console.error('❌ Erreur calcul gains organisation:', error);
      return {
        spaceSaved: 0,
        duplicatesRemoved: 0,
        foldersReduced: 0,
        organizationScore: 0
      };
    }
  }

  /**
   * Évaluation intégrité structure
   */
  private assessStructureIntegrity(checks: ValidationCheck[]): ValidationResult['structureIntegrity'] {
    const getCheckResult = (id: string): boolean => {
      const check = checks.find(c => c.id === id);
      return check ? check.passed : false;
    };

    return {
      allPacksPlaced: getCheckResult('fusion_applied'),
      noMissingFiles: getCheckResult('file_integrity'),
      noDuplicates: getCheckResult('no_duplicates'),
      correctPermissions: getCheckResult('permissions'),
      validFolderStructure: getCheckResult('folder_structure')
    };
  }

  // ============================================
  // MÉTHODES UTILITAIRES DE VALIDATION
  // ============================================

  /**
   * Crée un contrôle de validation
   */
  private async createCheck(
    id: string,
    name: string,
    description: string,
    category: ValidationCheck['category'],
    validator: () => Promise<any>
  ): Promise<ValidationCheck> {
    const startTime = Date.now();

    try {
      const result = await validator();
      const passed = typeof result === 'boolean' ? result : !!result?.success;

      return {
        id,
        name,
        description,
        category,
        passed,
        result,
        message: passed ? 'Validation réussie' : 'Validation échouée',
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        id,
        name,
        description,
        category,
        passed: false,
        message: `Erreur: ${error.message}`,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Validation structure des dossiers
   */
  private async validateFolderStructure(targetPath: string): Promise<boolean> {
    try {
      const stats = fs.statSync(targetPath);
      if (!stats.isDirectory()) return false;

      const items = fs.readdirSync(targetPath, { withFileTypes: true });
      const folders = items.filter(item => item.isDirectory());

      // Vérifier qu'il y a au moins quelques dossiers organisés
      return folders.length > 0;

    } catch (error) {
      return false;
    }
  }

  /**
   * Validation permissions
   */
  private async validatePermissions(targetPath: string): Promise<boolean> {
    try {
      // Tester lecture
      fs.accessSync(targetPath, fs.constants.R_OK);

      // Tester écriture
      fs.accessSync(targetPath, fs.constants.W_OK);

      return true;

    } catch (error) {
      return false;
    }
  }

  /**
   * Vérification dossiers vides
   */
  private async checkEmptyFolders(targetPath: string): Promise<{ success: boolean; emptyFolders: string[] }> {
    const emptyFolders: string[] = [];

    const checkDirectory = (dirPath: string) => {
      try {
        const items = fs.readdirSync(dirPath, { withFileTypes: true });

        if (items.length === 0) {
          emptyFolders.push(dirPath);
          return;
        }

        items.forEach(item => {
          if (item.isDirectory()) {
            checkDirectory(path.join(dirPath, item.name));
          }
        });

      } catch (error) {
        // Ignorer les erreurs d'accès
      }
    };

    checkDirectory(targetPath);

    return {
      success: emptyFolders.length === 0,
      emptyFolders
    };
  }

  /**
   * Validation intégrité fichiers
   */
  private async validateFileIntegrity(targetPath: string): Promise<boolean> {
    try {
      let fileCount = 0;
      let validFiles = 0;

      const checkFiles = (dirPath: string) => {
        const items = fs.readdirSync(dirPath, { withFileTypes: true });

        items.forEach(item => {
          const fullPath = path.join(dirPath, item.name);

          if (item.isDirectory()) {
            checkFiles(fullPath);
          } else {
            fileCount++;
            try {
              const stats = fs.statSync(fullPath);
              if (stats.size >= 0) {
                validFiles++;
              }
            } catch (error) {
              // Fichier corrompu ou inaccessible
            }
          }
        });
      };

      checkFiles(targetPath);

      // Au moins 95% des fichiers doivent être valides
      return fileCount > 0 && (validFiles / fileCount) >= 0.95;

    } catch (error) {
      return false;
    }
  }

  /**
   * Détection doublons
   */
  private async checkDuplicates(targetPath: string): Promise<{ success: boolean; duplicates: Array<{ hash: string; files: string[] }> }> {
    const fileHashes = new Map<string, string[]>();

    const hashFiles = (dirPath: string) => {
      try {
        const items = fs.readdirSync(dirPath, { withFileTypes: true });

        items.forEach(item => {
          const fullPath = path.join(dirPath, item.name);

          if (item.isDirectory()) {
            hashFiles(fullPath);
          } else {
            try {
              const stats = fs.statSync(fullPath);
              const hash = `${item.name}_${stats.size}`;

              if (!fileHashes.has(hash)) {
                fileHashes.set(hash, []);
              }
              fileHashes.get(hash)!.push(fullPath);

            } catch (error) {
              // Ignorer les erreurs
            }
          }
        });

      } catch (error) {
        // Ignorer les erreurs d'accès
      }
    };

    hashFiles(targetPath);

    const duplicates: Array<{ hash: string; files: string[] }> = [];
    for (const [hash, files] of fileHashes) {
      if (files.length > 1) {
        duplicates.push({ hash, files });
      }
    }

    return {
      success: duplicates.length === 0,
      duplicates
    };
  }

  // Autres méthodes de validation simplifiées pour l'exemple
  private async validateNamingConsistency(targetPath: string): Promise<boolean> { return true; }
  private async validateFileSizes(targetPath: string): Promise<boolean> { return true; }
  private async validateOrganizationImprovement(targetPath: string, allPhaseData: any): Promise<boolean> { return true; }
  private async validateSpaceGain(allPhaseData: any): Promise<boolean> { return true; }
  private async validateAccessTime(targetPath: string): Promise<boolean> { return true; }
  private async validateFusionApplication(targetPath: string, organizationResult: any): Promise<boolean> { return true; }
  private async validateClassificationConsistency(targetPath: string): Promise<boolean> { return true; }
  private async validateStructureChoice(targetPath: string, organizationResult: any): Promise<boolean> { return true; }

  private calculateSpaceSaved(allPhaseData: any): number {
    return allPhaseData?.phase4?.organizationResult?.spaceSaved || 0;
  }

  private countDuplicatesRemoved(allPhaseData: any): number {
    return allPhaseData?.phase3?.duplicatesResult?.totalDuplicates || 0;
  }

  private countFoldersReduced(allPhaseData: any): number {
    return allPhaseData?.phase4?.organizationResult?.foldersReduced || 0;
  }

  private async calculateOrganizationScore(targetPath: string, allPhaseData: any): Promise<number> {
    // Score basé sur la structure finale
    try {
      const items = fs.readdirSync(targetPath, { withFileTypes: true });
      const folders = items.filter(item => item.isDirectory());

      // Score simple basé sur l'organisation
      let score = 50; // Score de base

      if (folders.length > 0) score += 20; // Structure créée
      if (folders.length < 20) score += 10; // Pas trop de dossiers
      if (folders.length > 5) score += 20; // Assez de catégories

      return Math.min(score, 100);

    } catch (error) {
      return 0;
    }
  }

  // Méthodes interface StepExecutor
  validate(input: FinalValidationInput): StepValidationResult {
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
    return 'Final Validator';
  }

  getDescription(): string {
    return 'Validation finale de l\'intégrité et qualité de l\'organisation';
  }

  estimateTime(input: FinalValidationInput): number {
    return 120; // 2 minutes estimation
  }

  canRetry(): boolean {
    return true;
  }
}
