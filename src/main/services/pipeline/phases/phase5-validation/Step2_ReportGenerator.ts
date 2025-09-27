/**
 * Step 2 - Report Generator
 * Génération de rapports complets multi-formats avec analyses détaillées
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
  FinalReport,
  ExecutiveSummary,
  PhaseReport,
  QualityAnalysis,
  Recommendation,
  ReportAttachment,
  ReportOptions,
  GlobalMetrics
} from './Phase5Types';

/**
 * Input pour la génération de rapport
 */
export interface ReportGenerationInput {
  targetPath: string;
  validationResult: any;
  allPhaseData: any;
  globalMetrics: GlobalMetrics;
  options?: ReportOptions;
}

/**
 * Output de la génération de rapport
 */
export interface ReportGenerationOutput extends FinalReport {}

export class Step2_ReportGenerator implements StepExecutor<ReportGenerationInput, ReportGenerationOutput> {

  async execute(
    input: ReportGenerationInput,
    onProgress?: ProgressCallback
  ): Promise<StepResult<ReportGenerationOutput>> {
    try {
      onProgress?.(0, '📊 Démarrage génération rapport...');

      const { targetPath, validationResult, allPhaseData, globalMetrics, options } = input;
      const reportFormats = options?.formats || ['json', 'markdown'];
      const reportPaths = new Map<string, string>();

      // 1. Génération résumé exécutif
      onProgress?.(10, '📋 Génération résumé exécutif...');
      const executiveSummary = this.generateExecutiveSummary(allPhaseData, validationResult, globalMetrics);

      // 2. Génération rapports par phase
      onProgress?.(25, '📁 Génération rapports par phase...');
      const phaseReports = this.generatePhaseReports(allPhaseData);

      // 3. Analyse qualité
      onProgress?.(40, '🎯 Analyse qualité...');
      const qualityAnalysis = this.generateQualityAnalysis(targetPath, allPhaseData, validationResult);

      // 4. Génération recommandations
      onProgress?.(55, '💡 Génération recommandations...');
      const recommendations = this.generateRecommendations(validationResult, qualityAnalysis, allPhaseData);

      // 5. Préparation pièces jointes
      onProgress?.(70, '📎 Préparation pièces jointes...');
      const attachments = this.prepareAttachments(targetPath, allPhaseData);

      // 6. Assemblage rapport final
      onProgress?.(80, '📖 Assemblage rapport final...');
      const finalReport: FinalReport = {
        generatedAt: new Date().toISOString(),
        pipelineVersion: 'V6.0.0',
        reportFormats: reportFormats,
        reportPaths,
        executiveSummary,
        phaseReports,
        qualityAnalysis,
        recommendations,
        attachments
      };

      // 7. Export multi-formats
      onProgress?.(90, '💾 Export multi-formats...');
      await this.exportReports(finalReport, targetPath, reportFormats, reportPaths);

      onProgress?.(100, '✅ Rapport généré avec succès');

      return {
        success: true,
        data: { ...finalReport, reportPaths },
        canProceed: true,
        metrics: {
          startTime: Date.now(),
          endTime: Date.now(),
          itemsProcessed: reportFormats.length,
          processingSpeed: reportFormats.length / 1
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'REPORT_GENERATION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown report generation error',
          recoverable: true
        },
        canProceed: false
      };
    }
  }

  /**
   * Génère le résumé exécutif
   */
  private generateExecutiveSummary(
    allPhaseData: any,
    validationResult: any,
    globalMetrics: GlobalMetrics
  ): ExecutiveSummary {
    const phase4Data = allPhaseData?.phase4?.organizationResult || {};
    const phase1Data = allPhaseData?.phase1 || {};
    const phase0Data = allPhaseData?.phase0 || {};

    return {
      // Métriques globales
      totalProcessingTime: globalMetrics.totalExecutionTime,
      totalPacks: phase1Data.summary?.totalPacks || 0,
      totalFiles: phase1Data.summary?.totalFiles || 0,
      totalSizeProcessed: phase1Data.summary?.totalSize || 0,

      // Résultats organisation
      packsOrganized: phase4Data.completedOperations || 0,
      filesReorganized: phase4Data.filesProcessed || 0,
      spaceSaved: validationResult?.organizationGains?.spaceSaved || 0,
      duplicatesRemoved: validationResult?.organizationGains?.duplicatesRemoved || 0,

      // Qualité finale
      organizationScore: validationResult?.organizationGains?.organizationScore || 0,
      qualityImprovement: this.calculateQualityImprovement(allPhaseData),

      // Statut global
      overallSuccess: validationResult?.success || false,
      criticalIssuesCount: validationResult?.criticalIssues?.length || 0,
      warningsCount: validationResult?.warnings?.length || 0
    };
  }

  /**
   * Génère les rapports détaillés par phase
   */
  private generatePhaseReports(allPhaseData: any): PhaseReport[] {
    const phases = [
      { number: 0, name: 'Phase 0 - Preparation', data: allPhaseData?.phase0 },
      { number: 1, name: 'Phase 1 - Discovery', data: allPhaseData?.phase1 },
      { number: 2, name: 'Phase 2 - Classification', data: allPhaseData?.phase2 },
      { number: 3, name: 'Phase 3 - Matrix & Structure', data: allPhaseData?.phase3 },
      { number: 4, name: 'Phase 4 - Organization', data: allPhaseData?.phase4 }
    ];

    return phases.map(phase => {
      const phaseData = phase.data || {};
      const organizationResult = phaseData.organizationResult || {};
      const summary = phaseData.summary || {};

      return {
        phaseNumber: phase.number,
        phaseName: phase.name,

        // Timing
        startTime: organizationResult.startTime || Date.now(),
        endTime: organizationResult.endTime || Date.now(),
        duration: organizationResult.duration || 0,

        // Résultats
        success: organizationResult.success !== false,
        itemsProcessed: organizationResult.completedOperations || summary.totalPacks || 0,
        errors: organizationResult.errors || [],
        warnings: organizationResult.warnings || [],

        // Métriques spécifiques
        phaseMetrics: this.extractPhaseMetrics(phase.number, phaseData),

        // Contribution aux objectifs
        contribution: this.calculatePhaseContribution(phase.number, phaseData)
      };
    });
  }

  /**
   * Génère l'analyse qualité
   */
  private generateQualityAnalysis(
    targetPath: string,
    allPhaseData: any,
    validationResult: any
  ): QualityAnalysis {
    // Calcul des scores par dimension
    const scores = {
      organization: this.calculateOrganizationScore(validationResult),
      structure: this.calculateStructureScore(targetPath, allPhaseData),
      naming: this.calculateNamingScore(allPhaseData),
      deduplication: this.calculateDeduplicationScore(allPhaseData),
      classification: this.calculateClassificationScore(allPhaseData)
    };

    // Score global
    const overallScore = Object.values(scores).reduce((sum, score) => sum + score, 0) / Object.keys(scores).length;
    const grade = this.calculateGrade(overallScore);

    // Comparaison avant/après
    const beforeAfter = {
      chaosScore: {
        before: allPhaseData?.phase0?.quickScanResult?.chaosScore || 0.5,
        after: Math.max(0, 1 - (overallScore / 100))
      },
      organizationLevel: {
        before: allPhaseData?.phase0?.quickScanResult?.currentStructure || 'chaotic',
        after: overallScore > 80 ? 'organized' : overallScore > 60 ? 'mixed' : 'chaotic'
      },
      efficiency: {
        before: 30,
        after: overallScore
      }
    };

    // Points forts et faibles
    const strengths = this.identifyStrengths(scores, allPhaseData);
    const weaknesses = this.identifyWeaknesses(scores, validationResult);

    return {
      scores,
      overallScore,
      grade,
      beforeAfter,
      strengths,
      weaknesses
    };
  }

  /**
   * Génère les recommandations
   */
  private generateRecommendations(
    validationResult: any,
    qualityAnalysis: QualityAnalysis,
    allPhaseData: any
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Recommandations basées sur les problèmes détectés
    if (validationResult?.warnings?.length > 0) {
      recommendations.push({
        id: 'fix_warnings',
        priority: 'medium',
        category: 'maintenance',
        title: 'Corriger les avertissements détectés',
        description: `${validationResult.warnings.length} avertissements ont été détectés et nécessitent une attention.`,
        expectedBenefit: 'Amélioration de la stabilité et de la cohérence',
        actionSteps: [
          'Examiner chaque avertissement en détail',
          'Prioriser les corrections selon l\'impact',
          'Appliquer les corrections automatiques disponibles'
        ],
        estimatedEffort: 'low',
        applicableToNextRun: true
      });
    }

    // Recommandations basées sur les scores qualité
    if (qualityAnalysis.scores.organization < 80) {
      recommendations.push({
        id: 'improve_organization',
        priority: 'high',
        category: 'organization',
        title: 'Améliorer l\'organisation des packs',
        description: 'Le score d\'organisation peut être amélioré avec une structure plus cohérente.',
        expectedBenefit: 'Accès plus rapide aux samples et meilleure productivité',
        actionSteps: [
          'Réviser la taxonomie de classification',
          'Ajuster les règles de fusion intelligente',
          'Optimiser la structure des dossiers'
        ],
        estimatedEffort: 'medium',
        applicableToNextRun: true
      });
    }

    if (qualityAnalysis.scores.deduplication < 90) {
      recommendations.push({
        id: 'optimize_deduplication',
        priority: 'high',
        category: 'performance',
        title: 'Optimiser la déduplication',
        description: 'Des doublons pourraient encore être présents ou mal détectés.',
        expectedBenefit: 'Économie d\'espace disque et réduction de la confusion',
        actionSteps: [
          'Régler la sensibilité de détection des doublons',
          'Examiner les faux positifs',
          'Améliorer les algorithmes de comparaison'
        ],
        estimatedEffort: 'medium',
        applicableToNextRun: true
      });
    }

    // Recommandations de maintenance
    recommendations.push({
      id: 'regular_maintenance',
      priority: 'low',
      category: 'maintenance',
      title: 'Maintenance régulière recommandée',
      description: 'Planifier une maintenance régulière pour maintenir la qualité d\'organisation.',
      expectedBenefit: 'Prévention de la dégradation de l\'organisation',
      actionSteps: [
        'Exécuter le pipeline tous les 3-6 mois',
        'Surveiller l\'ajout de nouveaux packs',
        'Maintenir la taxonomie à jour'
      ],
      estimatedEffort: 'low',
      applicableToNextRun: false
    });

    return recommendations.slice(0, 10); // Limiter à 10 recommandations
  }

  /**
   * Prépare les pièces jointes
   */
  private prepareAttachments(targetPath: string, allPhaseData: any): ReportAttachment[] {
    const attachments: ReportAttachment[] = [];

    try {
      // Logs détaillés (si disponibles)
      const logPath = path.join(targetPath, '..', 'pipeline-logs.txt');
      if (fs.existsSync(logPath)) {
        const stats = fs.statSync(logPath);
        attachments.push({
          name: 'Pipeline Logs',
          type: 'log',
          path: logPath,
          size: stats.size,
          description: 'Logs détaillés de l\'exécution du pipeline'
        });
      }

      // Données raw JSON
      const jsonPath = path.join(targetPath, '..', 'pipeline-data.json');
      attachments.push({
        name: 'Raw Pipeline Data',
        type: 'json',
        path: jsonPath,
        size: 0, // Sera calculé lors de l'écriture
        description: 'Données brutes de toutes les phases du pipeline'
      });

    } catch (error) {
      console.warn('⚠️ Erreur préparation pièces jointes:', error.message);
    }

    return attachments;
  }

  /**
   * Exporte les rapports dans différents formats
   */
  private async exportReports(
    finalReport: FinalReport,
    targetPath: string,
    formats: string[],
    reportPaths: Map<string, string>
  ): Promise<void> {
    const reportDir = path.join(targetPath, '..', 'reports');

    // Créer le dossier reports
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    for (const format of formats) {
      const fileName = `pipeline-report-${timestamp}.${format}`;
      const filePath = path.join(reportDir, fileName);

      switch (format) {
        case 'json':
          await this.exportJSON(finalReport, filePath);
          break;
        case 'markdown':
          await this.exportMarkdown(finalReport, filePath);
          break;
        case 'html':
          await this.exportHTML(finalReport, filePath);
          break;
      }

      reportPaths.set(format, filePath);
    }
  }

  /**
   * Export au format JSON
   */
  private async exportJSON(report: FinalReport, filePath: string): Promise<void> {
    const jsonContent = JSON.stringify(report, null, 2);
    fs.writeFileSync(filePath, jsonContent, 'utf8');
  }

  /**
   * Export au format Markdown
   */
  private async exportMarkdown(report: FinalReport, filePath: string): Promise<void> {
    const md = this.generateMarkdownContent(report);
    fs.writeFileSync(filePath, md, 'utf8');
  }

  /**
   * Export au format HTML
   */
  private async exportHTML(report: FinalReport, filePath: string): Promise<void> {
    const html = this.generateHTMLContent(report);
    fs.writeFileSync(filePath, html, 'utf8');
  }

  /**
   * Génère le contenu Markdown
   */
  private generateMarkdownContent(report: FinalReport): string {
    const { executiveSummary, qualityAnalysis, phaseReports, recommendations } = report;

    return `# 📊 Rapport Pipeline Samples Organizer V6

**Généré le:** ${new Date(report.generatedAt).toLocaleString()}
**Version Pipeline:** ${report.pipelineVersion}

## 📋 Résumé Exécutif

### Métriques Globales
- **Temps total de traitement:** ${Math.round(executiveSummary.totalProcessingTime / 1000)}s
- **Packs traités:** ${executiveSummary.totalPacks}
- **Fichiers traités:** ${executiveSummary.totalFiles}
- **Taille totale:** ${this.formatBytes(executiveSummary.totalSizeProcessed)}

### Résultats Organisation
- **Packs organisés:** ${executiveSummary.packsOrganized}
- **Fichiers réorganisés:** ${executiveSummary.filesReorganized}
- **Espace économisé:** ${this.formatBytes(executiveSummary.spaceSaved)}
- **Doublons supprimés:** ${executiveSummary.duplicatesRemoved}

### Qualité Finale
- **Score d'organisation:** ${executiveSummary.organizationScore}/100
- **Amélioration qualité:** +${executiveSummary.qualityImprovement}%
- **Note globale:** ${qualityAnalysis.grade}

### Statut
- **Succès global:** ${executiveSummary.overallSuccess ? '✅ OUI' : '❌ NON'}
- **Problèmes critiques:** ${executiveSummary.criticalIssuesCount}
- **Avertissements:** ${executiveSummary.warningsCount}

## 📈 Analyse Qualité

### Scores par Dimension
- **Organisation:** ${qualityAnalysis.scores.organization}/100
- **Structure:** ${qualityAnalysis.scores.structure}/100
- **Nommage:** ${qualityAnalysis.scores.naming}/100
- **Déduplication:** ${qualityAnalysis.scores.deduplication}/100
- **Classification:** ${qualityAnalysis.scores.classification}/100

### Comparaison Avant/Après
- **Score chaos:** ${qualityAnalysis.beforeAfter.chaosScore.before} → ${qualityAnalysis.beforeAfter.chaosScore.after}
- **Niveau organisation:** ${qualityAnalysis.beforeAfter.organizationLevel.before} → ${qualityAnalysis.beforeAfter.organizationLevel.after}
- **Efficacité:** ${qualityAnalysis.beforeAfter.efficiency.before}% → ${qualityAnalysis.beforeAfter.efficiency.after}%

## 📁 Rapport par Phase

${phaseReports.map(phase => `
### ${phase.phaseName}
- **Durée:** ${Math.round(phase.duration / 1000)}s
- **Succès:** ${phase.success ? '✅' : '❌'}
- **Éléments traités:** ${phase.itemsProcessed}
- **Erreurs:** ${phase.errors.length}
- **Avertissements:** ${phase.warnings.length}
`).join('')}

## 💡 Recommandations

${recommendations.map((rec, index) => `
### ${index + 1}. ${rec.title} (${rec.priority.toUpperCase()})

**Catégorie:** ${rec.category}
**Description:** ${rec.description}
**Bénéfice attendu:** ${rec.expectedBenefit}
**Effort estimé:** ${rec.estimatedEffort}

**Actions à prendre:**
${rec.actionSteps.map(step => `- ${step}`).join('\n')}
`).join('')}

---

*Rapport généré automatiquement par Samples Organizer Pipeline V6*
`;
  }

  /**
   * Génère le contenu HTML
   */
  private generateHTMLContent(report: FinalReport): string {
    // Version simplifiée HTML
    return `<!DOCTYPE html>
<html>
<head>
    <title>Pipeline Report - ${new Date(report.generatedAt).toLocaleDateString()}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        h1 { color: #2c3e50; }
        h2 { color: #34495e; border-bottom: 2px solid #ecf0f1; }
        .metric { background: #ecf0f1; padding: 10px; margin: 5px 0; border-radius: 5px; }
        .success { color: #27ae60; }
        .warning { color: #f39c12; }
        .error { color: #e74c3c; }
    </style>
</head>
<body>
    <h1>📊 Rapport Pipeline Samples Organizer V6</h1>
    <p><strong>Généré le:</strong> ${new Date(report.generatedAt).toLocaleString()}</p>

    <h2>📋 Résumé Exécutif</h2>
    <div class="metric">Score d'organisation: ${report.executiveSummary.organizationScore}/100</div>
    <div class="metric">Packs traités: ${report.executiveSummary.totalPacks}</div>
    <div class="metric">Espace économisé: ${this.formatBytes(report.executiveSummary.spaceSaved)}</div>
    <div class="metric ${report.executiveSummary.overallSuccess ? 'success' : 'error'}">
        Statut: ${report.executiveSummary.overallSuccess ? 'Succès' : 'Échec'}
    </div>

    <h2>📈 Analyse Qualité</h2>
    <div class="metric">Note globale: ${report.qualityAnalysis.grade}</div>
    <div class="metric">Score organisation: ${report.qualityAnalysis.scores.organization}/100</div>
    <div class="metric">Score structure: ${report.qualityAnalysis.scores.structure}/100</div>

    <h2>💡 Recommandations</h2>
    <ul>
    ${report.recommendations.map(rec => `
        <li><strong>${rec.title}</strong> (${rec.priority})<br>
        ${rec.description}</li>
    `).join('')}
    </ul>
</body>
</html>`;
  }

  // ============================================
  // MÉTHODES UTILITAIRES
  // ============================================

  private calculateQualityImprovement(allPhaseData: any): number {
    const initialChaos = allPhaseData?.phase0?.quickScanResult?.chaosScore || 0.5;
    const improvement = Math.max(0, (1 - initialChaos) * 100);
    return Math.round(improvement);
  }

  private extractPhaseMetrics(phaseNumber: number, phaseData: any): Record<string, any> {
    const base = {
      phaseNumber,
      executionTime: phaseData?.duration || 0,
      success: phaseData?.success !== false
    };

    switch (phaseNumber) {
      case 0:
        return { ...base, packsDetected: phaseData?.quickScanResult?.detectedPacks?.length || 0 };
      case 1:
        return { ...base, filesIndexed: phaseData?.indexingResult?.indexedFiles || 0 };
      case 2:
        return { ...base, packsClassified: phaseData?.classificationResult?.totalClassified || 0 };
      case 3:
        return { ...base, fusionGroups: phaseData?.fusionGroups?.length || 0 };
      case 4:
        return { ...base, operationsCompleted: phaseData?.organizationResult?.completedOperations || 0 };
      default:
        return base;
    }
  }

  private calculatePhaseContribution(phaseNumber: number, phaseData: any) {
    // Calculs simplifiés pour l'exemple
    return {
      organizationImprovement: phaseNumber * 20,
      performanceGain: phaseNumber * 15,
      qualityScore: Math.min(80 + phaseNumber * 5, 100)
    };
  }

  private calculateOrganizationScore(validationResult: any): number {
    return validationResult?.organizationGains?.organizationScore || 70;
  }

  private calculateStructureScore(targetPath: string, allPhaseData: any): number {
    // Score basé sur la structure créée
    try {
      const items = fs.readdirSync(targetPath, { withFileTypes: true });
      const folders = items.filter(item => item.isDirectory()).length;
      return Math.min(folders * 10, 100);
    } catch {
      return 50;
    }
  }

  private calculateNamingScore(allPhaseData: any): number {
    const cleanedNames = allPhaseData?.phase0?.reorganizationResult?.cleanedNames || 0;
    return Math.min(80 + cleanedNames * 2, 100);
  }

  private calculateDeduplicationScore(allPhaseData: any): number {
    const duplicatesRemoved = allPhaseData?.phase3?.duplicatesResult?.totalDuplicates || 0;
    return duplicatesRemoved > 0 ? 90 : 70;
  }

  private calculateClassificationScore(allPhaseData: any): number {
    const classified = allPhaseData?.phase2?.classificationResult?.totalClassified || 0;
    const confidence = allPhaseData?.phase2?.classificationResult?.averageConfidence || 0.7;
    return Math.round(confidence * 100);
  }

  private calculateGrade(score: number): QualityAnalysis['grade'] {
    if (score >= 90) return 'A+';
    if (score >= 85) return 'A';
    if (score >= 80) return 'B+';
    if (score >= 75) return 'B';
    if (score >= 70) return 'C+';
    if (score >= 65) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  }

  private identifyStrengths(scores: QualityAnalysis['scores'], allPhaseData: any): string[] {
    const strengths: string[] = [];

    if (scores.organization >= 80) {
      strengths.push('Excellente organisation des packs');
    }
    if (scores.deduplication >= 90) {
      strengths.push('Déduplication très efficace');
    }
    if (scores.classification >= 85) {
      strengths.push('Classification précise et cohérente');
    }
    if (scores.structure >= 80) {
      strengths.push('Structure de dossiers bien organisée');
    }

    return strengths;
  }

  private identifyWeaknesses(scores: QualityAnalysis['scores'], validationResult: any): string[] {
    const weaknesses: string[] = [];

    if (scores.organization < 60) {
      weaknesses.push('Organisation générale peut être améliorée');
    }
    if (scores.deduplication < 70) {
      weaknesses.push('Détection des doublons à optimiser');
    }
    if (validationResult?.criticalIssues?.length > 0) {
      weaknesses.push('Problèmes critiques détectés');
    }
    if (scores.naming < 70) {
      weaknesses.push('Cohérence du nommage à améliorer');
    }

    return weaknesses;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Méthodes interface StepExecutor
  validate(input: ReportGenerationInput): StepValidationResult {
    const errors: string[] = [];

    if (!input.targetPath) {
      errors.push('Target path is required');
    }

    if (!input.validationResult) {
      errors.push('Validation result is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  getName(): string {
    return 'Report Generator';
  }

  getDescription(): string {
    return 'Génération de rapports complets multi-formats avec analyses détaillées';
  }

  estimateTime(input: ReportGenerationInput): number {
    return 60; // 1 minute estimation
  }

  canRetry(): boolean {
    return true;
  }
}