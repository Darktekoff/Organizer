/**
 * Phase 0 Controller - Preparation
 * Contrôleur pour le quick scan et la réorganisation
 */

import type {
  PhaseController,
  StepResult,
  ProgressCallback
} from '@shared/interfaces/StepContracts';
import type { Phase0Data } from '@shared/interfaces/PipelineTypes';
import { Step1_QuickScan } from './Step1_QuickScan';
import { Step2_CleanReorganize } from './Step2_CleanReorganize';
import { DirectorySnapshot } from '../../shared/utils/DirectorySnapshot';
import * as fs from 'fs';
import * as path from 'path';

export interface Phase0Input {
  sourcePath: string;
  config?: {
    maxDepth?: number;
    excludePatterns?: string[];
    minAudioFiles?: number;
    createBackup?: boolean;
    cleanNames?: boolean;
    unwrapFolders?: boolean;
    debugMode?: boolean; // Pour activer les logs détaillés
  };
  resumeFromStep?: number;
  previousStepData?: any;
}

export class Phase0Controller implements PhaseController<Phase0Input, Phase0Data> {
  private step1: Step1_QuickScan;
  private step2: Step2_CleanReorganize;

  constructor() {
    this.step1 = new Step1_QuickScan();
    this.step2 = new Step2_CleanReorganize();
  }

  getName(): string {
    return 'Phase 0 - Preparation';
  }

  getDescription(): string {
    return 'Quick scan et réorganisation initiale des samples';
  }

  async execute(
    input: Phase0Input,
    onProgress?: ProgressCallback
  ): Promise<StepResult<Phase0Data>> {
    console.log('🔍 Phase0Controller execute started with input:', input);

    try {
      console.log('🚀 Starting real Phase 0 execution...');

      // NOUVEAU: Vérifier si la réorganisation a déjà été faite
      const alreadyReorganized = this.checkIfAlreadyReorganized(input.sourcePath);

      if (alreadyReorganized) {
        console.log('✅ Folder already reorganized! Skipping to next phase...');

        // Charger les données existantes depuis les fichiers JSON
        const existingData = this.loadExistingReorganizationData(input.sourcePath);

        if (existingData) {
          console.log('📂 Reconstructing Phase0Data from existing files...');
          console.log('✅ Phase0Data reconstructed successfully');

          return {
            success: true,
            data: existingData,
            canProceed: true
          };
        }
      }

      let step1Result: any;

      // Si on reprend à partir de Step 2 ou 3, utiliser les données précédentes
      if ((input.resumeFromStep === 2 || input.resumeFromStep === 3) && input.previousStepData) {
        console.log(`🔄 Resuming Phase 0 from Step ${input.resumeFromStep} with previous data`);
        step1Result = { success: true, data: input.previousStepData };
        onProgress?.(50, `Reprise à partir du Step ${input.resumeFromStep}...`);
      } else {
        // IMPORTANT: Capturer le snapshot AVANT Step1 pour StructureBasedDetector
        console.log('📸 Capturing initial directory snapshot...');
        this.captureInitialSnapshot(input.sourcePath);

        // STEP 1: Quick Scan
        console.log('🔍 Starting Step 1: Quick Scan');
        onProgress?.(5, 'Démarrage du scan rapide...');
        step1Result = await this.step1.execute({
          sourcePath: input.sourcePath,
          config: input.config
        }, (progress, message) => {
          onProgress?.(5 + (progress * 0.45), message || 'Scan en cours...');
        });

        if (!step1Result.success) {
          return {
            success: false,
            error: step1Result.error,
            canProceed: false
          };
        }

        // Si Step1 demande une action utilisateur, on la transmet
        console.log('🔍 Step1 result:', {
          success: step1Result.success,
          hasData: !!step1Result.data,
          hasUserActionRequired: !!step1Result.userActionRequired,
          canProceed: step1Result.canProceed
        });

        if (step1Result.userActionRequired) {
          console.log('⏸️ Phase 0 requires user action!');
          return {
            success: true,
            data: {
              sourcePath: input.sourcePath,
              quickScanResult: {
                detectedPacks: step1Result.data!.detectedPacks,
                totalSamples: step1Result.data!.totalSamples,
                totalSize: step1Result.data!.totalSize,
                needsCleanup: step1Result.data!.needsCleanup,
                chaosScore: step1Result.data!.chaosScore,
                currentStructure: step1Result.data!.currentStructure,
                scanDuration: step1Result.data!.scanDuration,
                packPreview: step1Result.data!.packPreview
              }
            },
            canProceed: false,
            userActionRequired: step1Result.userActionRequired
          };
        }
      }

      // STEP 2: Clean & Reorganize
      console.log('🔍 Phase 0 - Starting Step 2: Clean & Reorganize');
      console.log('📋 Step 2 Input data:', {
        detectedPacks: (step1Result.data as any)?.detectedPacks?.length || (step1Result.data as any)?.quickScanResult?.detectedPacks?.length || 0,
        sourcePath: input.sourcePath
      });

      onProgress?.(50, 'Démarrage de la réorganisation...');

      const quickScanData = (step1Result.data as any)?.detectedPacks
        ? step1Result.data
        : (step1Result.data as any)?.quickScanResult;

      if (!quickScanData || !quickScanData.detectedPacks) {
        throw new Error('Quick scan data unavailable for Phase 0 step 2');
      }

      // Snapshot déjà capturé avant Step1

      const quickScanSummary = {
        totalSamples: quickScanData.totalSamples,
        totalSize: quickScanData.totalSize,
        needsCleanup: quickScanData.needsCleanup,
        chaosScore: quickScanData.chaosScore,
        currentStructure: quickScanData.currentStructure,
        scanDuration: quickScanData.scanDuration,
        packPreview: quickScanData.packPreview
      };

      // IMPORTANT: Step2 attend un format spécifique avec detectedPacks et sourcePath
      const step2Result = await this.step2.execute({
        detectedPacks: quickScanData.detectedPacks,
        sourcePath: input.sourcePath,
        userConfirmed: true, // Ajouté après notre fix
        proceedWithExecution: input.resumeFromStep === 3, // TRUE si on reprend pour exécution (step 3)
        quickScanSummary,
        config: input.config
      }, (progress, message) => {
        console.log(`📊 Step 2 Progress: ${progress}% - ${message}`);
        onProgress?.(50 + (progress * 0.45), message || 'Réorganisation en cours...');
      });

      console.log('✅ Step 2 completed:', {
        success: step2Result.success,
        error: step2Result.error,
        dataReceived: !!step2Result.data,
        hasUserActionRequired: !!step2Result.userActionRequired
      });

      if (!step2Result.success) {
        return {
          success: false,
          error: step2Result.error,
          canProceed: false
        };
      }

      // Vérifier si Step2 demande une action utilisateur (validation du plan)
      if (step2Result.userActionRequired) {
        console.log('⏸️ Step 2 requires user action for plan validation');

        // Créer les données Phase0 avec le PLAN (pas l'exécution)
        const phase0DataWithPlan: Phase0Data = {
          sourcePath: input.sourcePath,
          quickScanResult: {
            detectedPacks: quickScanData.detectedPacks,
            totalSamples: quickScanData.totalSamples,
            totalSize: quickScanData.totalSize,
            needsCleanup: quickScanData.needsCleanup,
            chaosScore: quickScanData.chaosScore,
            currentStructure: quickScanData.currentStructure,
            scanDuration: quickScanData.scanDuration,
            packPreview: quickScanData.packPreview
          },
          reorganizationPlan: {
            operations: step2Result.data!.operations,
            estimatedTime: step2Result.data!.plannedStats?.estimatedTime || 5000,
            conflicts: [],
            totalOperations: step2Result.data!.operations.length,
            plannedStats: step2Result.data!.plannedStats,
            planReport: step2Result.data!.planReport
          }
        };

        return {
          success: true,
          data: phase0DataWithPlan,
          canProceed: false,
          userActionRequired: step2Result.userActionRequired
        };
      }

      onProgress?.(100, 'Phase 0 terminée avec succès !');

      // Si on arrive ici, c'est que Step2 a EXÉCUTÉ la réorganisation
      // IMPORTANT: Mettre à jour les noms des packs avec les nouveaux noms après réorganisation
      const updatedPacks = this.updatePackNamesAfterReorganization(
        quickScanData.detectedPacks,
        step2Result.data!.operations
      );

      const phase0Data: Phase0Data = {
        sourcePath: input.sourcePath,
        quickScanResult: {
          detectedPacks: updatedPacks,
          totalSamples: quickScanData.totalSamples,
          totalSize: quickScanData.totalSize,
          needsCleanup: quickScanData.needsCleanup,
          chaosScore: quickScanData.chaosScore,
          currentStructure: quickScanData.currentStructure,
          scanDuration: quickScanData.scanDuration,
          packPreview: quickScanData.packPreview
        },
        reorganizationPlan: {
          operations: step2Result.data!.operations,
          estimatedTime: step2Result.data!.plannedStats?.estimatedTime || 5000,
          conflicts: [],
          totalOperations: step2Result.data!.operations.length,
          plannedStats: step2Result.data!.plannedStats
        },
        reorganizationResult: {
          success: step2Result.success,
          movedPacks: step2Result.data!.movedPacks,
          cleanedNames: step2Result.data!.cleanedNames,
          unwrappedFolders: step2Result.data!.unwrappedFolders,
          workingPath: step2Result.data!.workingPath,
          errors: step2Result.data!.errors,
          duration: 2500
        }
      };

      console.log('✅ Phase0Controller real execution completed successfully');

      // NOUVEAU : Capturer snapshot POST-réorganisation
      console.log('📸 Capturing POST-reorganization snapshot...');
      this.capturePostReorganizationSnapshot(
        step2Result.data!.workingPath,
        phase0Data
      );

      return {
        success: true,
        data: phase0Data,
        canProceed: true
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PHASE0_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          recoverable: false
        },
        canProceed: false
      };
    }
  }

  /**
   * NOUVEAU: Vérifie si le dossier a déjà été réorganisé
   */
  private checkIfAlreadyReorganized(sourcePath: string): boolean {
    try {
      const snapshotDir = path.join(sourcePath, '.audio-organizer');

      // LE SEUL VRAI INDICATEUR: structure-reorganized.json existe ET la réorg a vraiment eu lieu
      const hasReorganizedSnapshot = fs.existsSync(path.join(snapshotDir, 'structure-reorganized.json'));

      if (hasReorganizedSnapshot) {
        console.log('🔍 Detected previous reorganization markers:');
        console.log('  ✅ structure-reorganized.json found - reorganization completed');
      }

      return hasReorganizedSnapshot;

    } catch (error) {
      console.error('[Phase0] Error checking reorganization status:', error);
      return false;
    }
  }

  /**
   * NOUVEAU: Charge les données de réorganisation existantes
   */
  private loadExistingReorganizationData(sourcePath: string): Phase0Data | null {
    try {
      const snapshotDir = path.join(sourcePath, '.audio-organizer');

      // Charger structure-proposee.json pour les infos de réorg
      const proposedPath = path.join(snapshotDir, 'structure-proposee.json');
      const proposedContent = fs.readFileSync(proposedPath, 'utf-8');
      const proposedData = JSON.parse(proposedContent);

      // Charger structure-detection.json pour les packs détectés
      const detectionPath = path.join(snapshotDir, 'structure-detection.json');
      const detectionContent = fs.readFileSync(detectionPath, 'utf-8');
      const detectionData = JSON.parse(detectionContent);

      console.log('📂 Reconstructing Phase0Data from existing files...');

      // Reconstruire Phase0Data à partir des fichiers existants
      const phase0Data: Phase0Data = {
        sourcePath: sourcePath,
        quickScanResult: {
          detectedPacks: detectionData.detectedPacks || [],
          totalSamples: detectionData.totalAudioFiles || 0,
          totalSize: detectionData.totalSize || 0,
          needsCleanup: true,
          chaosScore: 0.5,
          currentStructure: 'organized',
          scanDuration: 0,
          packPreview: []
        },
        reorganizationPlan: {
          operations: proposedData.operations || [],
          estimatedTime: 5000,
          conflicts: [],
          totalOperations: proposedData.operations?.length || 0,
          plannedStats: proposedData.stats
        },
        reorganizationResult: {
          success: true,
          movedPacks: proposedData.stats?.moveOperations || 0,
          cleanedNames: proposedData.stats?.cleanOperations || 0,
          unwrappedFolders: proposedData.stats?.unwrapOperations || 0,
          workingPath: sourcePath, // Le dossier a déjà été réorganisé in-place
          errors: [],
          duration: 0
        }
      };

      console.log('✅ Phase0Data reconstructed successfully');
      return phase0Data;

    } catch (error) {
      console.error('[Phase0] Error loading existing reorganization data:', error);
      return null;
    }
  }

  private captureInitialSnapshot(sourcePath: string): void {
    try {
      const normalizedSource = path.normalize(sourcePath);
      if (!fs.existsSync(normalizedSource)) {
        console.warn('[Phase0] Source path does not exist, snapshot skipped');
        return;
      }

      const snapshotDir = path.join(normalizedSource, '.audio-organizer');
      const snapshotPath = path.join(snapshotDir, 'structure-originale.json');

      if (fs.existsSync(snapshotPath)) {
        return;
      }

      console.log(`[Phase0] Capturing initial directory snapshot to ${snapshotPath}`);
      const snapshot = DirectorySnapshot.capture(normalizedSource, {
        followSymlinks: false
      });
      DirectorySnapshot.save(snapshot, snapshotPath);

      // Générer aussi la version allégée pour la détection (6 niveaux pour les bundles complexes)
      const lightSnapshotPath = path.join(snapshotDir, 'structure-detection.json');
      console.log(`[Phase0] Generating lightweight detection snapshot to ${lightSnapshotPath}`);
      const lightSnapshot = DirectorySnapshot.captureLightweight(normalizedSource, 6);
      DirectorySnapshot.saveLightweight(lightSnapshot, lightSnapshotPath);
    } catch (error) {
      console.warn('[Phase0] Failed to capture initial snapshot:', error);
    }
  }

  validate(input: Phase0Input): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!input.sourcePath) {
      errors.push('Source path is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  canRetry(): boolean {
    return true;
  }

  estimateTime(input: Phase0Input): number {
    return 60; // 60 secondes estimation
  }

  /**
   * Met à jour les noms des packs avec les nouveaux noms après réorganisation
   */
  private updatePackNamesAfterReorganization(
    originalPacks: any[],
    operations: any[]
  ): any[] {
    // Créer un mapping des anciens noms vers les nouveaux noms
    const nameMapping = new Map<string, string>();

    for (const operation of operations) {
      if (operation.type === 'MOVE' || operation.type === 'CLEAN_NAME') {
        // Extraire les noms de dossiers depuis les chemins
        const oldFolderName = operation.sourcePath.split(/[\\/]/).pop();
        const newFolderName = operation.targetPath.split(/[\\/]/).pop();

        if (oldFolderName && newFolderName && oldFolderName !== newFolderName) {
          nameMapping.set(oldFolderName, newFolderName);
        }
      }
    }

    // Mettre à jour les noms des packs
    return originalPacks.map(pack => {
      const newName = nameMapping.get(pack.name);
      if (newName) {
        console.log(`🔄 Updating pack name: "${pack.name}" → "${newName}"`);
        return {
          ...pack,
          name: newName,
          originalName: pack.name // Garder l'ancien nom pour référence
        };
      }
      return pack;
    });
  }

  /**
   * Capture un snapshot ENRICHI après la réorganisation avec indexation complète
   */
  private capturePostReorganizationSnapshot(workingPath: string, phase0Data: Phase0Data): void {
    try {
      const normalizedPath = path.normalize(workingPath);
      if (!fs.existsSync(normalizedPath)) {
        console.warn('[Phase0] Working path does not exist, POST snapshot skipped');
        return;
      }

      const snapshotDir = path.join(normalizedPath, '.audio-organizer');
      const postSnapshotPath = path.join(snapshotDir, 'structure-reorganized.json');

      console.log('[Phase0] Capturing enriched POST-reorganization snapshot with full indexation...');

      // 1. Capturer la structure de base
      const postSnapshot = DirectorySnapshot.captureLightweight(normalizedPath, 10);

      // 2. NOUVEAU: Créer l'index complet de tous les fichiers
      console.log('[Phase0] Creating complete file index...');
      const fileIndex = this.createCompleteFileIndex(normalizedPath);

      // 3. NOUVEAU: Détecter les doublons
      console.log('[Phase0] Detecting duplicates...');
      const duplicateAnalysis = this.detectDuplicatesInIndex(fileIndex);

      // 4. NOUVEAU: Créer index par extension
      console.log('[Phase0] Creating extension index...');
      const extensionIndex = this.createExtensionIndex(fileIndex);

      // 5. Mapping des transformations ET découverte des vrais packs depuis le filesystem
      let packMapping = phase0Data.quickScanResult.detectedPacks.map(pack => ({
        originalName: pack.name,
        originalPath: pack.path,
        newName: pack.name.replace(/_\d+$/, '').replace(/\s+/g, ' ').trim(),
        audioFiles: pack.audioFiles,
        totalSize: pack.totalSize,
        type: pack.type
      }));

      // Si packMapping est vide ou incomplet, découvrir les vrais dossiers
      if (packMapping.length === 0) {
        console.log('🔍 PackMapping empty, discovering real packs from filesystem...');
        try {
          const entries = fs.readdirSync(normalizedPath, { withFileTypes: true });
          const realPackFolders = entries
            .filter(entry => entry.isDirectory() && entry.name !== '.audio-organizer')
            .map(dir => dir.name);

          packMapping = realPackFolders.map((folderName, index) => ({
            originalName: folderName,
            originalPath: path.join(normalizedPath, folderName),
            newName: folderName,
            audioFiles: this.countAudioFilesInPack(path.join(normalizedPath, folderName)),
            totalSize: this.calculatePackSize(path.join(normalizedPath, folderName)),
            type: 'pack'
          }));

          console.log(`✅ Discovered ${packMapping.length} real pack folders from filesystem`);
        } catch (error) {
          console.warn('Error discovering real packs:', error);
        }
      }

      // 6. Créer le snapshot ENRICHI avec TOUT l'index
      const enrichedSnapshot = {
        ...postSnapshot,

        // Index complet de tous les fichiers (remplace Step2_ContentIndexer)
        fileIndex: fileIndex,

        // Analyse des doublons (remplace détection Phase1)
        duplicates: duplicateAnalysis,

        // Index par extension pour recherche rapide
        extensionIndex: extensionIndex,

        // Métadonnées et mapping
        metadata: {
          capturedAt: new Date().toISOString(),
          phase: 'post-reorganization-enriched',
          totalPacks: phase0Data.reorganizationResult?.movedPacks,
          cleanedNames: phase0Data.reorganizationResult?.cleanedNames,
          unwrappedFolders: phase0Data.reorganizationResult?.unwrappedFolders,
          totalFiles: fileIndex.length,
          totalDuplicates: duplicateAnalysis.totalDuplicates,
          wastedSpace: duplicateAnalysis.wastedSpace,
          packMapping: packMapping
        }
      };

      // Sauvegarder le snapshot enrichi
      fs.writeFileSync(postSnapshotPath, JSON.stringify(enrichedSnapshot, null, 2), 'utf-8');
      console.log(`✅ [Phase0] Enriched POST-reorganization snapshot saved: ${postSnapshotPath}`);
      console.log(`📊 Indexed ${fileIndex.length} files, found ${duplicateAnalysis.totalDuplicates} duplicates`);

      // Ajouter le path du snapshot dans phase0Data pour Phase 1
      (phase0Data as any).postReorganizationSnapshot = postSnapshotPath;

    } catch (error) {
      console.error('[Phase0] Failed to capture enriched POST-reorganization snapshot:', error);
    }
  }

  /**
   * NOUVEAU: Crée un index complet de tous les fichiers
   */
  private createCompleteFileIndex(rootPath: string): any[] {
    const fileIndex: any[] = [];

    const audioExtensions = new Set(['.wav', '.aiff', '.aif', '.flac', '.mp3', '.ogg', '.m4a']);
    const presetExtensions = new Set(['.fxp', '.fxb', '.nmsv', '.vital', '.serum', '.serumpack']);

    const scanDirectory = (dirPath: string, packName: string = '') => {
      try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue; // Skip hidden files

          const fullPath = path.join(dirPath, entry.name);

          if (entry.isDirectory()) {
            // Si c'est un dossier racine, c'est un pack
            const isPackRoot = dirPath === rootPath;
            const currentPackName = isPackRoot ? entry.name : packName;

            scanDirectory(fullPath, currentPackName);
          } else if (entry.isFile()) {
            const stats = fs.statSync(fullPath);
            const extension = path.extname(entry.name).toLowerCase();

            let fileType = 'other';
            if (audioExtensions.has(extension)) fileType = 'audio';
            else if (presetExtensions.has(extension)) fileType = 'preset';

            fileIndex.push({
              name: entry.name,
              path: fullPath,
              relativePath: path.relative(rootPath, fullPath),
              size: stats.size,
              type: fileType,
              extension: extension,
              pack: packName || 'Unknown',
              mtime: stats.mtimeMs,
              duplicateKey: `${entry.name}_${stats.size}` // Clé pour détection doublons
            });
          }
        }
      } catch (error) {
        console.warn(`[Phase0] Error scanning directory ${dirPath}:`, error);
      }
    };

    scanDirectory(rootPath);
    return fileIndex;
  }

  /**
   * NOUVEAU: Détecte les doublons dans l'index
   */
  private detectDuplicatesInIndex(fileIndex: any[]): any {
    const duplicateMap = new Map<string, any[]>();

    // Grouper par clé de duplication (nom + taille)
    for (const file of fileIndex) {
      if (file.type !== 'audio') continue; // Seulement pour les fichiers audio

      const key = file.duplicateKey;
      if (!duplicateMap.has(key)) {
        duplicateMap.set(key, []);
      }
      duplicateMap.get(key)!.push(file);
    }

    // Garder seulement les groupes avec + d'1 fichier
    const duplicateGroups = Array.from(duplicateMap.entries())
      .filter(([key, files]) => files.length > 1)
      .map(([key, files]) => ({
        key: key,
        count: files.length,
        totalSize: files.reduce((sum, f) => sum + f.size, 0),
        wastedSize: files.reduce((sum, f) => sum + f.size, 0) - files[0].size, // Taille gaspillée
        files: files.map(f => ({
          path: f.relativePath,
          pack: f.pack,
          size: f.size
        }))
      }));

    const totalDuplicates = duplicateGroups.reduce((sum, group) => sum + (group.count - 1), 0);
    const wastedSpace = duplicateGroups.reduce((sum, group) => sum + group.wastedSize, 0);

    return {
      totalDuplicates,
      wastedSpace,
      duplicateGroups: duplicateGroups,
      duplicateRatio: totalDuplicates / Math.max(1, fileIndex.filter(f => f.type === 'audio').length)
    };
  }

  /**
   * NOUVEAU: Crée un index par extension pour recherche rapide
   */
  private createExtensionIndex(fileIndex: any[]): any {
    const extensionIndex = new Map<string, number>();
    const packIndex = new Map<string, any[]>();

    for (const file of fileIndex) {
      // Index par extension
      extensionIndex.set(file.extension, (extensionIndex.get(file.extension) || 0) + 1);

      // Index par pack
      if (!packIndex.has(file.pack)) {
        packIndex.set(file.pack, []);
      }
      packIndex.get(file.pack)!.push(file);
    }

    return {
      byExtension: Object.fromEntries(extensionIndex),
      byPack: Object.fromEntries(packIndex),
      totalFiles: fileIndex.length,
      audioFiles: fileIndex.filter(f => f.type === 'audio').length,
      presetFiles: fileIndex.filter(f => f.type === 'preset').length,
      otherFiles: fileIndex.filter(f => f.type === 'other').length
    };
  }

  /**
   * NOUVEAU: Compte les fichiers audio dans un pack
   */
  private countAudioFilesInPack(packPath: string): number {
    const audioExtensions = new Set(['.wav', '.aiff', '.aif', '.flac', '.mp3', '.ogg', '.m4a']);
    let count = 0;

    const scanDir = (dirPath: string) => {
      try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue;

          const fullPath = path.join(dirPath, entry.name);
          if (entry.isDirectory()) {
            scanDir(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (audioExtensions.has(ext)) {
              count++;
            }
          }
        }
      } catch (error) {
        // Ignorer les erreurs d'accès
      }
    };

    scanDir(packPath);
    return count;
  }

  /**
   * NOUVEAU: Calcule la taille totale d'un pack
   */
  private calculatePackSize(packPath: string): number {
    let totalSize = 0;

    const scanDir = (dirPath: string) => {
      try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue;

          const fullPath = path.join(dirPath, entry.name);
          if (entry.isDirectory()) {
            scanDir(fullPath);
          } else if (entry.isFile()) {
            const stats = fs.statSync(fullPath);
            totalSize += stats.size;
          }
        }
      } catch (error) {
        // Ignorer les erreurs d'accès
      }
    };

    scanDir(packPath);
    return totalSize;
  }

}
