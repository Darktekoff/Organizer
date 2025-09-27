/**
 * StepHeader - Header standardisé pour chaque step
 * Affiche titre, numéro, progression et actions
 */

import React from 'react';
import { formatTimeRemaining, formatPercentage } from '../../utils/formatters';
import { StepUIState } from '../../../types/UITypes';

interface StepHeaderProps {
  phase: number;
  step: number;
  title: string;
  description?: string;
  estimatedTime?: string;
  stepState?: StepUIState;
  totalSteps?: number;
  onPause?: () => void;
  onStop?: () => void;
  className?: string;
}

export function StepHeader({
  phase,
  step,
  title,
  description,
  estimatedTime,
  stepState,
  totalSteps,
  onPause,
  onStop,
  className = ''
}: StepHeaderProps) {
  // Couleurs selon le statut
  const getStatusColor = () => {
    switch (stepState?.status) {
      case 'running':
        return 'from-blue-500 to-blue-600';
      case 'completed':
        return 'from-green-500 to-green-600';
      case 'failed':
        return 'from-red-500 to-red-600';
      case 'paused':
        return 'from-yellow-500 to-yellow-600';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  const getStatusIcon = () => {
    switch (stepState?.status) {
      case 'running':
        return '🚀';
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      case 'paused':
        return '⏸️';
      default:
        return '⏳';
    }
  };

  const getStatusText = () => {
    switch (stepState?.status) {
      case 'running':
        return 'En cours';
      case 'completed':
        return 'Terminé';
      case 'failed':
        return 'Échoué';
      case 'paused':
        return 'En pause';
      default:
        return 'En attente';
    }
  };

  return (
    <div className={`bg-gray-800/90 backdrop-blur-sm border-b border-gray-600/50 px-6 py-4 ${className}`}>
      <div className="max-w-screen-xl mx-auto">
        {/* Header principal */}
        <div className="flex items-center justify-between mb-4">
          {/* Titre et statut */}
          <div className="flex items-center space-x-4">
            <div className={`w-12 h-12 bg-gradient-to-br ${getStatusColor()} rounded-xl flex items-center justify-center shadow-lg`}>
              <span className="text-white text-xl">
                {getStatusIcon()}
              </span>
            </div>

            <div>
              <div className="flex items-center space-x-3">
                <h2 className="text-xl font-bold text-white">
                  Phase {phase} - Step {step}
                </h2>
                <span className="text-sm px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-medium">
                  {getStatusText()}
                </span>
                {totalSteps && (
                  <span className="text-sm text-gray-400">
                    ({step}/{totalSteps})
                  </span>
                )}
              </div>

              <h3 className="text-lg text-gray-300 mt-1">{title}</h3>

              {description && (
                <p className="text-sm text-gray-400 mt-1">{description}</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-3">
            {stepState?.status === 'running' && onPause && (
              <button
                onClick={onPause}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg font-medium transition-all duration-200 flex items-center space-x-2"
              >
                <span>⏸️</span>
                <span>Pause</span>
              </button>
            )}

            {onStop && (
              <button
                onClick={onStop}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-all duration-200 flex items-center space-x-2"
              >
                <span>⏹️</span>
                <span>Arrêter</span>
              </button>
            )}
          </div>
        </div>

        {/* Barre de progression et infos */}
        <div className="space-y-3">
          {/* Progression du step */}
          {stepState && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-400">
                  Progression du step
                </span>
                <span className="text-sm font-medium text-white">
                  {stepState.progress.toFixed(0)}%
                </span>
              </div>

              <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${getStatusColor()} transition-all duration-300 ease-out`}
                  style={{ width: `${stepState.progress}%` }}
                />
              </div>

              {stepState.message && (
                <p className="text-sm text-gray-400 mt-2">
                  {stepState.message}
                </p>
              )}
            </div>
          )}

          {/* Infos temporelles */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-6">
              {estimatedTime && (
                <div className="flex items-center space-x-2 text-gray-400">
                  <span>⏱️</span>
                  <span>Temps estimé: {estimatedTime}</span>
                </div>
              )}

              {stepState?.startTime && (
                <div className="flex items-center space-x-2 text-gray-400">
                  <span>🕐</span>
                  <span>
                    Démarré: {new Date(stepState.startTime).toLocaleTimeString('fr-FR')}
                  </span>
                </div>
              )}

              {stepState?.endTime && (
                <div className="flex items-center space-x-2 text-gray-400">
                  <span>🏁</span>
                  <span>
                    Terminé: {new Date(stepState.endTime).toLocaleTimeString('fr-FR')}
                  </span>
                </div>
              )}
            </div>

            {/* Temps restant estimé */}
            {stepState?.status === 'running' && estimatedTime && stepState.startTime && (
              <div className="text-gray-300">
                <span className="text-gray-400">ETA: </span>
                {(() => {
                  const estimatedMs = parseEstimatedTime(estimatedTime);
                  const elapsedMs = Date.now() - stepState.startTime;
                  const remainingMs = Math.max(0, estimatedMs - elapsedMs);
                  return formatTimeRemaining(remainingMs);
                })()}
              </div>
            )}
          </div>

          {/* Erreurs et warnings */}
          {stepState?.errors && stepState.errors.length > 0 && (
            <div className="bg-red-900/30 border border-red-600/50 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-red-400">❌</span>
                <span className="text-sm font-medium text-red-300">
                  Erreurs ({stepState.errors.length})
                </span>
              </div>
              <ul className="text-sm text-red-200 space-y-1">
                {stepState.errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {stepState?.warnings && stepState.warnings.length > 0 && (
            <div className="bg-yellow-900/30 border border-yellow-600/50 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-yellow-400">⚠️</span>
                <span className="text-sm font-medium text-yellow-300">
                  Avertissements ({stepState.warnings.length})
                </span>
              </div>
              <ul className="text-sm text-yellow-200 space-y-1">
                {stepState.warnings.map((warning, index) => (
                  <li key={index}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Parse une chaîne de temps estimé en millisecondes
 */
function parseEstimatedTime(timeStr: string): number {
  const match = timeStr.match(/(\d+)([a-z]+)/i);
  if (!match) return 0;

  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 'ms': return value;
    case 's': return value * 1000;
    case 'min': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    default: return value * 1000;
  }
}