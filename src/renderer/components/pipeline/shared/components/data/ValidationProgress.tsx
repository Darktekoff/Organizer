/**
 * ValidationProgress - Affichage progression des 14 vérifications
 * Utilisé dans Phase 5 pour montrer le statut des validations
 */

import React from 'react';
import { formatDuration } from '../../utils/formatters';

export interface ValidationCheck {
  id: string;
  name: string;
  description: string;
  category: 'integrity' | 'performance' | 'structure' | 'quality';
  passed: boolean;
  result?: any;
  message: string;
  executionTime: number;
  startTime?: number;
  endTime?: number;
  status?: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
}

interface ValidationProgressProps {
  checks: ValidationCheck[];
  currentCheck?: string;
  onCheckDetail?: (checkId: string) => void;
  showDetails?: boolean;
  className?: string;
}

export function ValidationProgress({
  checks,
  currentCheck,
  onCheckDetail,
  showDetails = true,
  className = ''
}: ValidationProgressProps) {
  const getStatusIcon = (check: ValidationCheck) => {
    if (currentCheck === check.id) return '🔄';
    if (check.status === 'running') return '⚡';
    if (check.passed) return '✅';
    if (check.status === 'failed') return '❌';
    if (check.status === 'skipped') return '⏭️';
    return '⏳';
  };

  const getStatusColor = (check: ValidationCheck) => {
    if (currentCheck === check.id) return 'border-blue-500 bg-blue-900/20';
    if (check.status === 'running') return 'border-yellow-500 bg-yellow-900/20';
    if (check.passed) return 'border-green-500 bg-green-900/20';
    if (check.status === 'failed') return 'border-red-500 bg-red-900/20';
    if (check.status === 'skipped') return 'border-gray-500 bg-gray-900/20';
    return 'border-gray-600 bg-gray-800/30';
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'integrity': return '🔒';
      case 'performance': return '⚡';
      case 'structure': return '🏗️';
      case 'quality': return '⭐';
      default: return '🔍';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'integrity': return 'text-blue-400';
      case 'performance': return 'text-yellow-400';
      case 'structure': return 'text-purple-400';
      case 'quality': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  // Grouper par catégorie
  const checksByCategory = checks.reduce((acc, check) => {
    if (!acc[check.category]) acc[check.category] = [];
    acc[check.category].push(check);
    return acc;
  }, {} as Record<string, ValidationCheck[]>);

  // Statistiques globales
  const stats = {
    total: checks.length,
    passed: checks.filter(c => c.passed).length,
    failed: checks.filter(c => c.status === 'failed').length,
    running: checks.filter(c => c.status === 'running' || currentCheck === c.id).length,
    pending: checks.filter(c => c.status === 'pending').length
  };

  const overallProgress = ((stats.passed + stats.failed) / stats.total) * 100;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header avec progression globale */}
      <div className="bg-gray-800/50 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white">Validation finale - 14 vérifications</h3>
          <div className="text-right">
            <div className="text-2xl font-bold text-white">{stats.passed}/{stats.total}</div>
            <div className="text-sm text-gray-400">vérifications réussies</div>
          </div>
        </div>

        {/* Barre de progression globale */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>Progression globale</span>
            <span>{overallProgress.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-lg font-semibold text-green-400">{stats.passed}</div>
            <div className="text-xs text-gray-400">Réussies</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-red-400">{stats.failed}</div>
            <div className="text-xs text-gray-400">Échecs</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-yellow-400">{stats.running}</div>
            <div className="text-xs text-gray-400">En cours</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-400">{stats.pending}</div>
            <div className="text-xs text-gray-400">En attente</div>
          </div>
        </div>
      </div>

      {/* Vérifications par catégorie */}
      <div className="space-y-6">
        {Object.entries(checksByCategory).map(([category, categoryChecks]) => {
          const categoryStats = {
            passed: categoryChecks.filter(c => c.passed).length,
            total: categoryChecks.length
          };

          return (
            <div key={category} className="space-y-3">
              {/* Header de catégorie */}
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{getCategoryIcon(category)}</span>
                <h4 className={`text-lg font-semibold capitalize ${getCategoryColor(category)}`}>
                  {category} ({categoryStats.passed}/{categoryStats.total})
                </h4>
                <div className="flex-1 bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      category === 'integrity' ? 'bg-blue-500' :
                      category === 'performance' ? 'bg-yellow-500' :
                      category === 'structure' ? 'bg-purple-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${(categoryStats.passed / categoryStats.total) * 100}%` }}
                  />
                </div>
              </div>

              {/* Checks de la catégorie */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {categoryChecks.map((check) => (
                  <div
                    key={check.id}
                    className={`
                      relative p-4 rounded-lg border-2 transition-all duration-200
                      ${getStatusColor(check)}
                      ${onCheckDetail ? 'cursor-pointer hover:shadow-lg' : ''}
                      ${currentCheck === check.id ? 'animate-pulse' : ''}
                    `}
                    onClick={() => onCheckDetail?.(check.id)}
                  >
                    {/* En cours indicator */}
                    {currentCheck === check.id && (
                      <div className="absolute -top-1 -right-1">
                        <div className="w-4 h-4 bg-blue-500 rounded-full animate-ping"></div>
                      </div>
                    )}

                    <div className="flex items-start space-x-3">
                      <div className="text-2xl flex-shrink-0">
                        {getStatusIcon(check)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h5 className="font-medium text-white mb-1">{check.name}</h5>
                        <p className="text-sm text-gray-400 mb-2">{check.description}</p>

                        {/* Message de résultat */}
                        <div className={`text-sm ${
                          check.passed ? 'text-green-300' :
                          check.status === 'failed' ? 'text-red-300' :
                          check.status === 'running' ? 'text-blue-300' :
                          'text-gray-400'
                        }`}>
                          {check.message}
                        </div>

                        {/* Temps d'exécution */}
                        {check.executionTime > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            Exécuté en {formatDuration(check.executionTime)}
                          </div>
                        )}

                        {/* Détails du résultat */}
                        {showDetails && check.result && (
                          <div className="mt-2 p-2 bg-gray-900/50 rounded text-xs">
                            <pre className="text-gray-400 overflow-x-auto">
                              {typeof check.result === 'object'
                                ? JSON.stringify(check.result, null, 2)
                                : check.result
                              }
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Résumé final */}
      {stats.running === 0 && stats.pending === 0 && (
        <div className={`
          rounded-lg p-6 border-2
          ${stats.failed === 0
            ? 'border-green-500 bg-green-900/20'
            : 'border-yellow-500 bg-yellow-900/20'
          }
        `}>
          <div className="flex items-center space-x-4">
            <div className="text-4xl">
              {stats.failed === 0 ? '🎉' : '⚠️'}
            </div>
            <div>
              <h3 className={`text-xl font-semibold ${
                stats.failed === 0 ? 'text-green-300' : 'text-yellow-300'
              }`}>
                {stats.failed === 0
                  ? 'Toutes les vérifications sont réussies !'
                  : `${stats.failed} vérification(s) ont échoué`
                }
              </h3>
              <p className="text-gray-400">
                {stats.failed === 0
                  ? 'Votre organisation est validée et prête à utiliser.'
                  : 'Consultez les détails des échecs pour résoudre les problèmes.'
                }
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Composant simplifié pour affichage rapide du statut
 */
interface ValidationStatusProps {
  checks: ValidationCheck[];
  currentCheck?: string;
  compact?: boolean;
  className?: string;
}

export function ValidationStatus({
  checks,
  currentCheck,
  compact = false,
  className = ''
}: ValidationStatusProps) {
  const stats = {
    total: checks.length,
    passed: checks.filter(c => c.passed).length,
    failed: checks.filter(c => c.status === 'failed').length,
    running: checks.filter(c => c.status === 'running' || currentCheck === c.id).length
  };

  const progress = ((stats.passed + stats.failed) / stats.total) * 100;

  if (compact) {
    return (
      <div className={`flex items-center space-x-3 ${className}`}>
        <div className="w-20 bg-gray-700 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-sm text-gray-400">
          {stats.passed}/{stats.total}
        </span>
        {stats.running > 0 && (
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-gray-800/30 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-white">Validation en cours</span>
        <span className="text-sm text-gray-400">{stats.passed}/{stats.total}</span>
      </div>

      <div className="w-full bg-gray-700 rounded-full h-3 mb-3">
        <div
          className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{stats.running > 0 ? 'En cours...' : 'Terminé'}</span>
        <span>{progress.toFixed(0)}%</span>
      </div>
    </div>
  );
}