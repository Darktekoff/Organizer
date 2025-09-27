/**
 * StepContainer - Wrapper standardisé pour les steps
 * Gère padding, spacing, transitions et états loading/error
 */

import React from 'react';
import { StepHeader } from './StepHeader';
import { StepUIState } from '../../../types/UITypes';

interface StepContainerProps {
  // Props StepHeader
  phase: number;
  step: number;
  title: string;
  description?: string;
  estimatedTime?: string;
  stepState?: StepUIState;
  totalSteps?: number;

  // Props Container
  children: React.ReactNode;
  isLoading?: boolean;
  loadingMessage?: string;
  error?: string;
  className?: string;

  // Actions
  onPause?: () => void;
  onStop?: () => void;
  onRetry?: () => void;
}

export function StepContainer({
  // StepHeader props
  phase,
  step,
  title,
  description,
  estimatedTime,
  stepState,
  totalSteps,

  // Container props
  children,
  isLoading = false,
  loadingMessage,
  error,
  className = '',

  // Actions
  onPause,
  onStop,
  onRetry
}: StepContainerProps) {
  return (
    <div className={`flex flex-col h-full bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 ${className}`}>
      {/* Header du step */}
      <StepHeader
        phase={phase}
        step={step}
        title={title}
        description={description}
        estimatedTime={estimatedTime}
        stepState={stepState}
        totalSteps={totalSteps}
        onPause={onPause}
        onStop={onStop}
      />

      {/* Contenu principal */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-screen-xl mx-auto p-6">
          {/* Gestion des erreurs globales */}
          {error && (
            <div className="mb-6 bg-red-900/30 border border-red-600/50 rounded-xl p-6">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xl">❌</span>
                </div>

                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-red-300 mb-2">
                    Erreur lors de l'exécution
                  </h3>
                  <p className="text-red-200 mb-4">{error}</p>

                  {onRetry && (
                    <button
                      onClick={onRetry}
                      className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-all duration-200 flex items-center space-x-2"
                    >
                      <span>🔄</span>
                      <span>Réessayer</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Loading overlay pour le contenu */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-2xl mb-8">
                <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
              </div>

              <h3 className="text-2xl font-bold text-white mb-4">
                {loadingMessage || 'Traitement en cours...'}
              </h3>

              <div className="flex items-center space-x-2 text-gray-400">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>

              <p className="text-gray-400 mt-4 text-center max-w-md">
                Veuillez patienter pendant que nous traitons vos données.
                Cette opération peut prendre quelques moments.
              </p>
            </div>
          ) : (
            /* Contenu normal avec animation d'entrée */
            <div className="animate-fadeIn">
              {children}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/**
 * Version simplifiée sans header pour certains cas d'usage
 */
interface SimpleStepContainerProps {
  children: React.ReactNode;
  isLoading?: boolean;
  loadingMessage?: string;
  error?: string;
  onRetry?: () => void;
  className?: string;
}

export function SimpleStepContainer({
  children,
  isLoading = false,
  loadingMessage,
  error,
  onRetry,
  className = ''
}: SimpleStepContainerProps) {
  return (
    <div className={`flex flex-col h-full bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 ${className}`}>
      <main className="flex-1 overflow-auto">
        <div className="max-w-screen-xl mx-auto p-6">
          {/* Gestion des erreurs */}
          {error && (
            <div className="mb-6 bg-red-900/30 border border-red-600/50 rounded-xl p-6">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xl">❌</span>
                </div>

                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-red-300 mb-2">
                    Une erreur est survenue
                  </h3>
                  <p className="text-red-200 mb-4">{error}</p>

                  {onRetry && (
                    <button
                      onClick={onRetry}
                      className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-all duration-200 flex items-center space-x-2"
                    >
                      <span>🔄</span>
                      <span>Réessayer</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Contenu */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-2xl mb-8">
                <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
              </div>

              <h3 className="text-2xl font-bold text-white mb-4">
                {loadingMessage || 'Chargement...'}
              </h3>

              <div className="flex items-center space-x-2 text-gray-400">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          ) : (
            <div className="animate-fadeIn">
              {children}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/**
 * Container pour les résumés de phase
 */
interface PhaseSummaryContainerProps {
  phase: number;
  phaseName: string;
  children: React.ReactNode;
  onValidate?: () => void;
  onBack?: () => void;
  canValidate?: boolean;
  validationMessage?: string;
  className?: string;
}

export function PhaseSummaryContainer({
  phase,
  phaseName,
  children,
  onValidate,
  onBack,
  canValidate = true,
  validationMessage,
  className = ''
}: PhaseSummaryContainerProps) {
  return (
    <div className={`flex flex-col h-full bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 ${className}`}>
      {/* Header spécial pour résumé */}
      <div className="bg-gray-800/90 backdrop-blur-sm border-b border-gray-600/50 px-6 py-4">
        <div className="max-w-screen-xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white text-xl">📋</span>
              </div>

              <div>
                <h2 className="text-xl font-bold text-white">
                  Résumé Phase {phase}: {phaseName}
                </h2>
                <p className="text-gray-400 text-sm">
                  Vérifiez les résultats avant de continuer
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {onBack && (
                <button
                  onClick={onBack}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium transition-all duration-200"
                >
                  ← Retour
                </button>
              )}

              {onValidate && (
                <button
                  onClick={onValidate}
                  disabled={!canValidate}
                  className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 ${
                    canValidate
                      ? 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white transform hover:scale-105'
                      : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Valider et continuer →
                </button>
              )}
            </div>
          </div>

          {validationMessage && (
            <div className="mt-4 bg-blue-900/30 border border-blue-600/50 rounded-lg p-3">
              <p className="text-blue-200 text-sm">{validationMessage}</p>
            </div>
          )}
        </div>
      </div>

      {/* Contenu */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-screen-xl mx-auto p-6">
          <div className="animate-fadeIn">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}