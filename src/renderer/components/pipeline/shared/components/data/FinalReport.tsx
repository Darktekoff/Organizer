/**
 * FinalReport - Rapport final interactif avec visualisations
 * Utilisé dans Phase 5 pour afficher les résultats complets
 */

import React, { useState } from 'react';
import { formatBytes, formatDuration, formatNumber, formatPercentage } from '../../utils/formatters';
import { CircularProgress } from './ProgressBar';

export interface FinalReportData {
  generatedAt: string;
  pipelineVersion: string;
  executiveSummary: {
    totalProcessingTime: number;
    totalPacks: number;
    totalFiles: number;
    totalSizeProcessed: number;
    packsOrganized: number;
    filesReorganized: number;
    spaceSaved: number;
    duplicatesRemoved: number;
    organizationScore: number;
    qualityImprovement: number;
    overallSuccess: boolean;
    criticalIssuesCount: number;
    warningsCount: number;
  };
  phaseReports: Array<{
    phaseNumber: number;
    phaseName: string;
    duration: number;
    success: boolean;
    itemsProcessed: number;
    contribution: {
      organizationImprovement: number;
      performanceGain: number;
      qualityScore: number;
    };
  }>;
  qualityAnalysis: {
    scores: {
      organization: number;
      structure: number;
      naming: number;
      deduplication: number;
      classification: number;
    };
    overallScore: number;
    grade: string;
    beforeAfter: {
      chaosScore: { before: number; after: number };
      organizationLevel: { before: string; after: string };
      efficiency: { before: number; after: number };
    };
    strengths: string[];
    weaknesses: string[];
  };
  recommendations: Array<{
    id: string;
    priority: 'high' | 'medium' | 'low';
    category: string;
    title: string;
    description: string;
    expectedBenefit: string;
    actionSteps: string[];
    estimatedEffort: string;
  }>;
}

interface FinalReportProps {
  reportData: FinalReportData;
  onExport?: (format: 'json' | 'markdown' | 'html') => void;
  onRollback?: () => void;
  showExportOptions?: boolean;
  showRollbackOption?: boolean;
  className?: string;
}

export function FinalReport({
  reportData,
  onExport,
  onRollback,
  showExportOptions = true,
  showRollbackOption = true,
  className = ''
}: FinalReportProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'phases' | 'quality' | 'recommendations'>('summary');

  const { executiveSummary, phaseReports, qualityAnalysis, recommendations } = reportData;

  const getGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return 'text-green-400';
    if (grade.startsWith('B')) return 'text-blue-400';
    if (grade.startsWith('C')) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-blue-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-2">
              {executiveSummary.overallSuccess ? '✅ Pipeline terminé avec succès !' : '⚠️ Pipeline terminé avec des problèmes'}
            </h2>
            <p className="text-green-100">
              Généré le {new Date(reportData.generatedAt).toLocaleString('fr-FR')} • Pipeline V6
            </p>
          </div>

          <div className="text-right">
            <div className="text-4xl font-bold">{qualityAnalysis.overallScore.toFixed(0)}%</div>
            <div className={`text-xl font-semibold ${getGradeColor(qualityAnalysis.grade)}`}>
              Note: {qualityAnalysis.grade}
            </div>
          </div>
        </div>
      </div>

      {/* Métriques principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800/50 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-400">{formatNumber(executiveSummary.totalPacks)}</div>
          <div className="text-sm text-gray-400">Packs traités</div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-400">{formatNumber(executiveSummary.packsOrganized)}</div>
          <div className="text-sm text-gray-400">Packs organisés</div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-400">{formatBytes(executiveSummary.spaceSaved)}</div>
          <div className="text-sm text-gray-400">Espace économisé</div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-400">{formatDuration(executiveSummary.totalProcessingTime)}</div>
          <div className="text-sm text-gray-400">Temps total</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between bg-gray-800/30 rounded-lg p-4">
        <div className="flex items-center space-x-4">
          {showExportOptions && onExport && (
            <>
              <span className="text-sm text-gray-400">Exporter le rapport :</span>
              <div className="flex space-x-2">
                <button
                  onClick={() => onExport('json')}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm transition-colors"
                >
                  JSON
                </button>
                <button
                  onClick={() => onExport('markdown')}
                  className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-sm transition-colors"
                >
                  Markdown
                </button>
                <button
                  onClick={() => onExport('html')}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-sm transition-colors"
                >
                  HTML
                </button>
              </div>
            </>
          )}
        </div>

        {showRollbackOption && onRollback && (
          <button
            onClick={onRollback}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors"
          >
            🔄 Rollback complet
          </button>
        )}
      </div>

      {/* Onglets */}
      <div className="border-b border-gray-600">
        <nav className="flex space-x-8">
          {[
            { id: 'summary', label: 'Résumé', icon: '📊' },
            { id: 'phases', label: 'Phases', icon: '🔄' },
            { id: 'quality', label: 'Qualité', icon: '⭐' },
            { id: 'recommendations', label: 'Recommandations', icon: '💡' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2
                ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
                }
              `}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Contenu des onglets */}
      <div className="min-h-96">
        {activeTab === 'summary' && (
          <div className="space-y-6">
            {/* Amélioration qualité */}
            <div className="bg-gray-800/30 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Amélioration de l'organisation</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <CircularProgress
                    value={qualityAnalysis.beforeAfter.efficiency.before}
                    size={100}
                    variant="error"
                    label="Avant"
                  />
                </div>
                <div className="flex items-center justify-center">
                  <div className="text-4xl">➡️</div>
                </div>
                <div className="text-center">
                  <CircularProgress
                    value={qualityAnalysis.beforeAfter.efficiency.after}
                    size={100}
                    variant="success"
                    label="Après"
                  />
                </div>
              </div>
              <div className="text-center mt-4">
                <div className="text-2xl font-bold text-green-400">
                  +{(qualityAnalysis.beforeAfter.efficiency.after - qualityAnalysis.beforeAfter.efficiency.before).toFixed(0)}%
                </div>
                <div className="text-sm text-gray-400">d'amélioration</div>
              </div>
            </div>

            {/* Statistiques détaillées */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-800/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-3">Fichiers traités</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total fichiers:</span>
                    <span className="text-white">{formatNumber(executiveSummary.totalFiles)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Réorganisés:</span>
                    <span className="text-green-400">{formatNumber(executiveSummary.filesReorganized)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Doublons supprimés:</span>
                    <span className="text-purple-400">{formatNumber(executiveSummary.duplicatesRemoved)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-3">Problèmes détectés</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Problèmes critiques:</span>
                    <span className={executiveSummary.criticalIssuesCount > 0 ? 'text-red-400' : 'text-green-400'}>
                      {executiveSummary.criticalIssuesCount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Avertissements:</span>
                    <span className={executiveSummary.warningsCount > 0 ? 'text-yellow-400' : 'text-green-400'}>
                      {executiveSummary.warningsCount}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'phases' && (
          <div className="space-y-4">
            {phaseReports.map((phase) => (
              <div key={phase.phaseNumber} className="bg-gray-800/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-white">
                    Phase {phase.phaseNumber}: {phase.phaseName}
                  </h3>
                  <div className="flex items-center space-x-3">
                    <span className={`px-2 py-1 rounded text-xs ${phase.success ? 'bg-green-600' : 'bg-red-600'} text-white`}>
                      {phase.success ? 'Succès' : 'Échec'}
                    </span>
                    <span className="text-sm text-gray-400">
                      {formatDuration(phase.duration)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-lg font-semibold text-blue-400">{phase.contribution.qualityScore}%</div>
                    <div className="text-xs text-gray-400">Score qualité</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-green-400">{phase.contribution.organizationImprovement}%</div>
                    <div className="text-xs text-gray-400">Amélioration org.</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-purple-400">{formatNumber(phase.itemsProcessed)}</div>
                    <div className="text-xs text-gray-400">Éléments traités</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'quality' && (
          <div className="space-y-6">
            {/* Scores par dimension */}
            <div className="bg-gray-800/30 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Scores par dimension</h3>
              <div className="space-y-4">
                {Object.entries(qualityAnalysis.scores).map(([dimension, score]) => (
                  <div key={dimension} className="flex items-center space-x-4">
                    <div className="w-32 text-sm text-gray-400 capitalize">{dimension}:</div>
                    <div className="flex-1 bg-gray-700 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${score}%` }}
                      />
                    </div>
                    <div className="w-12 text-sm font-semibold text-white">{score}%</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Forces et faiblesses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-800/30 rounded-lg p-4">
                <h4 className="font-semibold text-green-400 mb-3">✓ Points forts</h4>
                <ul className="space-y-2">
                  {qualityAnalysis.strengths.map((strength, index) => (
                    <li key={index} className="text-sm text-gray-300 flex items-start space-x-2">
                      <span className="text-green-400 mt-0.5">•</span>
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {qualityAnalysis.weaknesses.length > 0 && (
                <div className="bg-gray-800/30 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-400 mb-3">⚠ Points à améliorer</h4>
                  <ul className="space-y-2">
                    {qualityAnalysis.weaknesses.map((weakness, index) => (
                      <li key={index} className="text-sm text-gray-300 flex items-start space-x-2">
                        <span className="text-yellow-400 mt-0.5">•</span>
                        <span>{weakness}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'recommendations' && (
          <div className="space-y-4">
            {recommendations.map((rec) => (
              <div key={rec.id} className="bg-gray-800/30 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-white">{rec.title}</h3>
                      <span className={`px-2 py-1 rounded text-xs ${getPriorityColor(rec.priority)}`}>
                        {rec.priority}
                      </span>
                      <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">
                        {rec.category}
                      </span>
                    </div>
                    <p className="text-gray-400 text-sm mb-3">{rec.description}</p>
                    <div className="text-sm text-green-400 mb-3">
                      <strong>Bénéfice attendu:</strong> {rec.expectedBenefit}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-white mb-2">Actions recommandées:</h4>
                  <ul className="space-y-1">
                    {rec.actionSteps.map((step, index) => (
                      <li key={index} className="text-sm text-gray-300 flex items-start space-x-2">
                        <span className="text-blue-400 mt-0.5">{index + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}

            {recommendations.length === 0 && (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">🎉</div>
                <h3 className="text-xl font-semibold text-white mb-2">Aucune recommandation</h3>
                <p className="text-gray-400">Votre organisation est parfaite !</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}