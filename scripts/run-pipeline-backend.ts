#!/usr/bin/env tsx
/**
 * Exécution Backend Directe du Pipeline V6
 *
 * Ce script exécute le pipeline complet en backend (sans Electron UI)
 * pour permettre l'analyse automatisée de la classification.
 *
 * Usage: npx tsx scripts/run-pipeline-backend.ts
 */

// ✅ CRITICAL: Charger les variables d'environnement (.env) AVANT tout import
import * as path from 'path';
import * as fs from 'fs';

// Charger dotenv depuis node_modules
const dotenvPath = path.join(__dirname, '..', 'node_modules', 'dotenv');
const dotenv = require(dotenvPath);

// Charger le .env depuis le dossier Organizer
const envPath = path.join(__dirname, '..', '.env');
const envResult = dotenv.config({ path: envPath });

if (envResult.error) {
  console.warn(`⚠️  Fichier .env non trouvé à: ${envPath}`);
  console.warn('   La classification IA sera désactivée');
} else {
  console.log(`✅ Variables d'environnement chargées depuis: ${envPath}`);
  console.log(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'Définie ✓' : 'Manquante ✗'}`);
}

// Import direct des contrôleurs (pas d'Electron, juste Node.js)
import { Phase0Controller } from '../src/main/services/pipeline/phases/phase0-preparation/Phase0Controller';
import { Phase1Controller } from '../src/main/services/pipeline/phases/phase1-discovery/Phase1Controller';
import { Phase2Controller } from '../src/main/services/pipeline/phases/phase2-classification/Phase2Controller';

import type { Phase0Data, Phase1Data, Phase2Data } from '../src/shared/interfaces/PipelineTypes';

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  testDataPath: path.join(__dirname, '..', 'test-data'),
  reportsPath: path.join(__dirname, '..', 'reports'),
  autoValidate: true,
  duplicateStrategy: 'merge',
  quarantineStrategy: 'auto-accept',
  logLevel: 'detailed' as const
};

interface PipelineResults {
  phase0?: Phase0Data;
  phase1?: Phase1Data;
  phase2?: Phase2Data;
  timings: {
    phase0: number;
    phase1: number;
    phase2: number;
    total: number;
  };
  success: boolean;
  errors: any[];
}

// ============================================
// LOGGER
// ============================================

class Logger {
  private startTime: number;
  private logFile: string;

  constructor(logPath: string) {
    this.startTime = Date.now();
    this.logFile = logPath;

    fs.writeFileSync(this.logFile, `Pipeline Backend Execution - ${new Date().toISOString()}\n\n`);
  }

  log(message: string, emoji: string = '•') {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(2);
    const line = `[${elapsed}s] ${emoji} ${message}`;

    console.log(line);
    fs.appendFileSync(this.logFile, line + '\n');
  }

  section(title: string) {
    const separator = '━'.repeat(60);
    console.log(`\n${separator}`);
    console.log(title);
    console.log(separator);

    fs.appendFileSync(this.logFile, `\n${separator}\n${title}\n${separator}\n`);
  }

  error(message: string, error?: any) {
    const line = `❌ ERROR: ${message}`;
    console.error(line);
    if (error) console.error(error);

    fs.appendFileSync(this.logFile, line + '\n');
    if (error) {
      fs.appendFileSync(this.logFile, JSON.stringify(error, null, 2) + '\n');
    }
  }
}

// ============================================
// UTILITIES
// ============================================

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// ============================================
// PHASE EXECUTION
// ============================================

async function executePhase0(
  controller: Phase0Controller,
  sourcePath: string,
  logger: Logger
): Promise<Phase0Data> {
  logger.log('Initialisation Phase 0...', '🔧');

  // Progress callback
  const onProgress = (progress: number, message?: string) => {
    if (progress % 25 === 0 || progress === 100) {
      logger.log(`Progress: ${progress}% ${message || ''}`, '  ');
    }
  };

  // Step 1: Execute initial scan
  logger.log('Exécution du quick scan...', '  ');
  let result = await controller.execute({
    sourcePath,
    config: {
      maxDepth: 10,
      createBackup: false,
      cleanNames: true,
      unwrapFolders: true
    }
  }, onProgress);

  if (!result.success) {
    throw new Error(`Phase 0 failed: ${result.error?.message}`);
  }

  // Si action utilisateur requise (validation plan)
  if (result.userActionRequired) {
    logger.log('Action utilisateur requise - Auto-validation activée', '⚡');

    // Re-execute avec proceedWithExecution = true
    result = await controller.execute({
      sourcePath,
      resumeFromStep: 3,
      previousStepData: result.data,
      config: {
        maxDepth: 10,
        createBackup: false,
        cleanNames: true,
        unwrapFolders: true
      }
    }, onProgress);

    if (!result.success) {
      throw new Error(`Phase 0 execution failed: ${result.error?.message}`);
    }
  }

  logger.log(`Phase 0 terminée: ${result.data!.quickScanResult.detectedPacks.length} packs détectés`, '✓');

  return result.data!;
}

async function executePhase1(
  controller: Phase1Controller,
  phase0Data: Phase0Data,
  logger: Logger
): Promise<Phase1Data> {
  logger.log('Initialisation Phase 1...', '📊');

  const onProgress = (progress: number, message?: string) => {
    if (progress % 25 === 0 || progress === 100) {
      logger.log(`Progress: ${progress}% ${message || ''}`, '  ');
    }
  };

  // Execute Phase 1
  let result = await controller.execute(phase0Data, onProgress);

  if (!result.success) {
    throw new Error(`Phase 1 failed: ${result.error?.message}`);
  }

  // Si doublons détectés
  if (result.userActionRequired) {
    logger.log('Doublons détectés - Auto-merge activé', '⚡');

    const userChoice = {
      duplicateAction: CONFIG.duplicateStrategy
    };

    result = await controller.resumeAfterUserAction(
      result.data!,
      userChoice,
      onProgress
    );

    if (!result.success) {
      throw new Error(`Phase 1 resume failed: ${result.error?.message}`);
    }
  }

  logger.log(`Phase 1 terminée: ${result.data!.enrichedPacks.length} EnrichedPacks générés`, '✓');

  return result.data!;
}

async function executePhase2(
  controller: Phase2Controller,
  phase1Data: Phase1Data,
  logger: Logger
): Promise<Phase2Data> {
  logger.log('Initialisation Phase 2...', '🎨');

  const onProgress = (progress: number, message?: string) => {
    if (progress % 25 === 0 || progress === 100) {
      logger.log(`Progress: ${progress}% ${message || ''}`, '  ');
    }
  };

  // Execute Phase 2
  let result = await controller.execute(phase1Data, onProgress);

  if (!result.success) {
    throw new Error(`Phase 2 failed: ${result.error?.message}`);
  }

  // Si quarantaine - on l'accepte pour ce test
  if (result.userActionRequired) {
    const quarantinePacks = result.data!.classification.quarantinePacks || [];
    logger.log(`Quarantaine détectée: ${quarantinePacks.length} packs`, '⚠️');
    logger.log('(Packs en quarantaine acceptés tels quels pour ce test)', '  ');

    // Pour ce test automatisé, on accepte les packs en quarantaine
    // sans faire de classification manuelle supplémentaire
    // Les résultats seront analysés dans le rapport
  }

  logger.log(`Phase 2 terminée: ${result.data!.classificationResult.totalClassified} packs classifiés`, '✓');

  return result.data!;
}

// ============================================
// REPORT GENERATION
// ============================================

function generateReport(results: PipelineResults): any {
  const { phase0, phase1, phase2, timings } = results;

  if (!phase2) {
    throw new Error('Phase 2 data is missing');
  }

  // Extraire les détails de classification
  const classifiedPacks = phase2.classification.classifiedPacks || [];
  const quarantinedPacks = phase2.classification.quarantinePacks || [];
  const allPacks = [...classifiedPacks, ...quarantinedPacks];

  // Distribution par famille
  const familyDistribution = new Map<string, number>();
  classifiedPacks.forEach((pack: any) => {
    const family = pack.classification?.family || 'Unknown';
    familyDistribution.set(family, (familyDistribution.get(family) || 0) + 1);
  });

  // Statistiques
  const confidences = classifiedPacks.map((p: any) => p.classification?.confidence || 0);
  const avgConfidence = confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;

  // Issues
  const issues: any[] = [];
  classifiedPacks.forEach((pack: any) => {
    const conf = pack.classification?.confidence || 0;
    if (conf < 0.5) {
      issues.push({
        severity: 'warning',
        packId: pack.packId,
        packName: pack.originalPack?.name || pack.packId,
        message: `Faible confiance: ${(conf * 100).toFixed(0)}%`
      });
    }
  });

  // Recommandations
  const recommendations: string[] = [];
  const quarantineCount = phase2.classification.quarantinePacks?.length || 0;
  const totalPacks = classifiedPacks.length + quarantineCount;

  if (quarantineCount > totalPacks * 0.2) {
    recommendations.push('Taux de quarantaine élevé (>20%) - Enrichir la taxonomie');
  }
  if (avgConfidence < 0.7) {
    recommendations.push('Confiance moyenne faible (<0.7) - Ajouter plus de règles contextuelles');
  }

  return {
    metadata: {
      timestamp: new Date().toISOString(),
      testDataPath: CONFIG.testDataPath,
      pipelineVersion: 'V6',
      totalDuration: timings.total
    },
    summary: {
      totalPacks: allPacks.length,
      classifiedPacks: classifiedPacks.length,
      quarantinedPacks: quarantinedPacks.length,
      averageConfidence: avgConfidence,
      familyDistribution: Object.fromEntries(familyDistribution)
    },
    packDetails: classifiedPacks.map((pack: any) => ({
      packId: pack.packId,
      packName: pack.originalPack?.name || pack.packId,
      classification: {
        family: pack.classification?.family || 'Unknown',
        style: pack.classification?.style || 'Unknown',
        confidence: pack.classification?.confidence || 0,
        method: pack.classification?.method || 'UNKNOWN'
      },
      bundleInfo: pack.bundleInfo,
      tags: pack.tags || [],
      fileCount: pack.fileCount || 0,
      audioFiles: pack.audioFiles || 0,
      presetFiles: pack.presetFiles || 0,
      isQuarantined: false
    })),
    quarantineDetails: quarantinedPacks.map((pack: any) => ({
      packId: pack.packId,
      packName: pack.originalPack?.name || pack.packId,
      reason: pack.quarantineReason || 'Unknown reason',
      bundleInfo: pack.bundleInfo,
      tags: pack.tags || [],
      fileCount: pack.fileCount || 0,
      audioFiles: pack.audioFiles || 0,
      presetFiles: pack.presetFiles || 0
    })),
    issues,
    recommendations,
    timings
  };
}

function saveReportJSON(report: any, outputPath: string) {
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
}

function saveReportMarkdown(report: any, outputPath: string) {
  let md = `# 📊 Rapport de Classification Pipeline V6 - Backend Direct\n\n`;
  md += `**Généré:** ${report.metadata.timestamp}\n`;
  md += `**Source:** ${report.metadata.testDataPath}\n`;
  md += `**Durée totale:** ${(report.metadata.totalDuration / 1000).toFixed(2)}s\n\n`;

  md += `## 📈 Résumé Global\n\n`;
  md += `- **Total packs:** ${report.summary.totalPacks}\n`;
  md += `- **Classifiés:** ${report.summary.classifiedPacks}\n`;
  md += `- **Quarantaine:** ${report.summary.quarantinedPacks}\n`;
  md += `- **Confiance moyenne:** ${(report.summary.averageConfidence * 100).toFixed(1)}%\n\n`;

  md += `## 🎵 Distribution par Famille\n\n`;
  const sortedFamilies = Object.entries(report.summary.familyDistribution)
    .sort((a: any, b: any) => b[1] - a[1]);

  sortedFamilies.forEach(([family, count]: [string, any]) => {
    const percentage = ((count / report.summary.totalPacks) * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(count / 2));
    md += `- **${family}:** ${count} packs (${percentage}%) ${bar}\n`;
  });

  md += `\n## 📦 Classification Détaillée (Top 30)\n\n`;
  md += `| # | Pack | Famille | Style | Confiance | Méthode |\n`;
  md += `|---|------|---------|-------|-----------|----------|\n`;

  report.packDetails.slice(0, 30).forEach((pack: any, idx: number) => {
    const conf = (pack.classification.confidence * 100).toFixed(0);
    const emoji = conf >= 70 ? '✅' : conf >= 50 ? '🟡' : '🔴';
    md += `| ${idx + 1} | ${pack.packName} | ${pack.classification.family} | ${pack.classification.style} | ${conf}% ${emoji} | ${pack.classification.method} |\n`;
  });

  if (report.packDetails.length > 30) {
    md += `\n_... et ${report.packDetails.length - 30} autres packs (voir JSON)_\n`;
  }

  // Section Quarantaine
  if (report.quarantineDetails && report.quarantineDetails.length > 0) {
    md += `\n## ⚠️ Packs en Quarantaine (${report.quarantineDetails.length})\n\n`;
    md += `| # | Pack | Raison | Bundle |\n`;
    md += `|---|------|--------|--------|\n`;

    report.quarantineDetails.slice(0, 20).forEach((pack: any, idx: number) => {
      const bundleName = pack.bundleInfo?.bundleName || 'N/A';
      const reason = pack.reason || 'Unknown';
      md += `| ${idx + 1} | ${pack.packName} | ${reason} | ${bundleName} |\n`;
    });

    if (report.quarantineDetails.length > 20) {
      md += `\n_... et ${report.quarantineDetails.length - 20} autres packs en quarantaine (voir JSON)_\n`;
    }
  }

  if (report.issues.length > 0) {
    md += `\n## ⚠️ Issues (${report.issues.length})\n\n`;
    report.issues.slice(0, 10).forEach((issue: any) => {
      md += `- **${issue.packName}:** ${issue.message}\n`;
    });
    if (report.issues.length > 10) {
      md += `\n_... et ${report.issues.length - 10} autres issues_\n`;
    }
  }

  if (report.recommendations.length > 0) {
    md += `\n## 💡 Recommandations\n\n`;
    report.recommendations.forEach((rec: string, idx: number) => {
      md += `${idx + 1}. ${rec}\n`;
    });
  }

  md += `\n## ⏱️ Performance\n\n`;
  md += `- **Phase 0:** ${(report.timings.phase0 / 1000).toFixed(2)}s\n`;
  md += `- **Phase 1:** ${(report.timings.phase1 / 1000).toFixed(2)}s\n`;
  md += `- **Phase 2:** ${(report.timings.phase2 / 1000).toFixed(2)}s\n`;
  md += `- **Total:** ${(report.timings.total / 1000).toFixed(2)}s\n\n`;

  const score = (report.summary.classifiedPacks / report.summary.totalPacks) * 100;
  let grade = 'F';
  if (score >= 90) grade = 'A+';
  else if (score >= 85) grade = 'A';
  else if (score >= 80) grade = 'B+';
  else if (score >= 75) grade = 'B';
  else if (score >= 70) grade = 'C+';
  else if (score >= 60) grade = 'C';
  else if (score >= 50) grade = 'D';

  md += `## 📊 Score de Classification\n\n`;
  md += `**Score:** ${score.toFixed(1)}% - **Grade:** ${grade}\n\n`;

  md += `---\n\n`;
  md += `_Rapport généré automatiquement par le backend pipeline_\n`;

  fs.writeFileSync(outputPath, md);
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').slice(0, -5);

  ensureDir(CONFIG.reportsPath);
  const logPath = path.join(CONFIG.reportsPath, `backend-execution-${timestamp}.log`);
  const logger = new Logger(logPath);

  logger.section('🚀 Exécution Backend du Pipeline V6');
  logger.log(`Source: ${CONFIG.testDataPath}`, '📁');
  logger.log(`Mode: Auto-validation activée`, '⚙️');

  const results: PipelineResults = {
    timings: { phase0: 0, phase1: 0, phase2: 0, total: 0 },
    success: false,
    errors: []
  };

  const totalStartTime = Date.now();

  try {
    // Vérifier que test-data existe
    if (!fs.existsSync(CONFIG.testDataPath)) {
      throw new Error(`Test data not found at: ${CONFIG.testDataPath}\nRun: npm run generate-test-data`);
    }

    // ====================================
    // PHASE 0: PREPARATION
    // ====================================
    logger.section('🔧 Phase 0 - Préparation');
    const phase0Start = Date.now();

    const phase0Controller = new Phase0Controller();
    results.phase0 = await executePhase0(phase0Controller, CONFIG.testDataPath, logger);

    results.timings.phase0 = Date.now() - phase0Start;
    logger.log(`Durée: ${(results.timings.phase0 / 1000).toFixed(2)}s`, '⏱️');

    // ====================================
    // PHASE 1: DISCOVERY
    // ====================================
    logger.section('📊 Phase 1 - Discovery');
    const phase1Start = Date.now();

    const phase1Controller = new Phase1Controller();
    results.phase1 = await executePhase1(phase1Controller, results.phase0, logger);

    results.timings.phase1 = Date.now() - phase1Start;
    logger.log(`Durée: ${(results.timings.phase1 / 1000).toFixed(2)}s`, '⏱️');

    // ====================================
    // PHASE 2: CLASSIFICATION
    // ====================================
    logger.section('🎨 Phase 2 - Classification');
    const phase2Start = Date.now();

    const phase2Controller = new Phase2Controller();
    results.phase2 = await executePhase2(phase2Controller, results.phase1, logger);

    results.timings.phase2 = Date.now() - phase2Start;
    logger.log(`Durée: ${(results.timings.phase2 / 1000).toFixed(2)}s`, '⏱️');

    // ====================================
    // GÉNÉRATION RAPPORT
    // ====================================
    logger.section('📄 Génération du Rapport');

    results.timings.total = Date.now() - totalStartTime;
    results.success = true;

    const report = generateReport(results);

    const jsonPath = path.join(CONFIG.reportsPath, `classification-backend-${timestamp}.json`);
    const mdPath = path.join(CONFIG.reportsPath, `classification-backend-${timestamp}.md`);

    saveReportJSON(report, jsonPath);
    saveReportMarkdown(report, mdPath);

    logger.log(`JSON: ${path.basename(jsonPath)}`, '✓');
    logger.log(`MD: ${path.basename(mdPath)}`, '✓');

    // ====================================
    // RÉSUMÉ FINAL
    // ====================================
    logger.section('✅ EXÉCUTION TERMINÉE');
    logger.log(`Durée totale: ${(results.timings.total / 1000).toFixed(2)}s`, '⏱️');
    logger.log('', '');

    logger.log('📊 RÉSUMÉ CLASSIFICATION:', '');
    logger.log(`   Total packs: ${report.summary.totalPacks}`, '');
    logger.log(`   Classifiés: ${report.summary.classifiedPacks} (${((report.summary.classifiedPacks / report.summary.totalPacks) * 100).toFixed(1)}%)`, '');
    logger.log(`   Confiance: ${(report.summary.averageConfidence * 100).toFixed(1)}%`, '');
    logger.log('', '');

    logger.log('🎵 TOP 5 FAMILLES:', '');
    const sortedFamilies = Object.entries(report.summary.familyDistribution)
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 5);

    sortedFamilies.forEach(([family, count]: [string, any]) => {
      const percentage = ((count / report.summary.totalPacks) * 100).toFixed(0);
      logger.log(`   ${family}: ${count} packs (${percentage}%)`, '');
    });

    if (report.issues.length > 0) {
      logger.log('', '');
      logger.log(`⚠️ Issues: ${report.issues.length}`, '');
    }

    if (report.recommendations.length > 0) {
      logger.log('', '');
      logger.log('💡 Recommendations:', '');
      report.recommendations.forEach((rec: string) => {
        logger.log(`   - ${rec}`, '');
      });
    }

    logger.log('', '');
    logger.log(`📄 Rapport complet: ${path.basename(mdPath)}`, '');

  } catch (error) {
    logger.error('Pipeline execution failed', error);
    results.success = false;
    results.errors.push(error);
    throw error;
  }
}

// ============================================
// ENTRY POINT
// ============================================

if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ Succès!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Échec:', error.message);
      process.exit(1);
    });
}

export { main };
