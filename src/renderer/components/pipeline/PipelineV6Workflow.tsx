/**
 * Pipeline V6 Workflow - Container principal
 * Layout principal avec navigation et rendu conditionnel des phases
 */

import React, { useEffect, useState, useRef } from 'react';
import { usePipelineV6, usePipelineProgress } from './hooks/usePipelineV6';
import { PhaseUIProps } from './types/UITypes';

// Import des composants phases
import { Phase0UI } from './phases/Phase0UI';
import { Phase1UI } from './phases/Phase1UI';
import { Phase2UI } from './phases/Phase2UI';
import { Phase3UI } from './phases/Phase3UI';
import { Phase4UI } from './phases/Phase4UI';
import { Phase5UI } from './phases/Phase5UI';

// Import des composants partagés (sera créé dans session 2)
// import { PhaseNavigation } from './shared/components/layout/PhaseNavigation';
// import { StepContainer } from './shared/components/layout/StepContainer';

interface PipelineV6WorkflowProps {
  sourcePath: string;
  onComplete?: (result: any) => void;
  onCancel?: () => void;
  onError?: (error: any) => void;
}

/**
 * Composant temporaire pour les phases non encore implémentées
 */
function PhaseUIPlaceholder({
  phaseNumber,
  data,
  userChoices,
  onComplete,
  onBack,
  onStop
}: PhaseUIProps) {
  const phaseName = [
    'Preparation',
    'Discovery',
    'Classification',
    'Matrix & Structure',
    'Organization',
    'Final Validation'
  ][phaseNumber];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <div className="max-w-2xl mx-auto text-center">
        <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl mx-auto mb-8 flex items-center justify-center shadow-2xl">
          <span className="text-6xl">
            {['🔍', '🔬', '🧠', '📊', '📁', '✅'][phaseNumber]}
          </span>
        </div>

        <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          Phase {phaseNumber}: {phaseName}
        </h2>

        <p className="text-xl text-gray-300 mb-8">
          Cette phase sera implémentée dans les prochaines sessions de développement.
        </p>

        <div className="bg-gray-800/50 rounded-xl p-6 mb-8">
          <h3 className="text-lg font-semibold mb-4">Données Phase:</h3>
          <pre className="text-sm text-gray-400 text-left overflow-auto max-h-40">
            {JSON.stringify(data || {}, null, 2)}
          </pre>
        </div>

        <div className="bg-gray-700/50 rounded-xl p-6 mb-8">
          <h3 className="text-lg font-semibold mb-4">Choix Utilisateur:</h3>
          <pre className="text-sm text-gray-400 text-left overflow-auto max-h-40">
            {JSON.stringify(userChoices || {}, null, 2)}
          </pre>
        </div>

        <div className="flex space-x-4 justify-center">
          <button
            onClick={onBack}
            disabled={phaseNumber === 0}
            className="px-6 py-3 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-800 disabled:text-gray-500 rounded-xl font-medium transition-all duration-200"
          >
            ← Précédent
          </button>

          <button
            onClick={() => onComplete?.({}, {})}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-xl font-medium transition-all duration-200 transform hover:scale-105"
          >
            Continuer (Simulation) →
          </button>

          <button
            onClick={onStop}
            className="px-6 py-3 bg-red-600 hover:bg-red-500 rounded-xl font-medium transition-all duration-200"
          >
            Arrêter
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Navigation temporaire simple
 */
function SimplePhaseNavigation({
  currentPhase,
  totalPhases,
  onNavigate,
  canGoBack,
  canGoNext
}: {
  currentPhase: number;
  totalPhases: number;
  onNavigate: (phase: number) => void;
  canGoBack: boolean;
  canGoNext: boolean;
}) {
  const phaseNames = [
    'Preparation',
    'Discovery',
    'Classification',
    'Matrix & Structure',
    'Organization',
    'Final Validation'
  ];

  return (
    <div className="bg-gray-800/90 backdrop-blur-sm border-b border-gray-600/50 px-6 py-4">
      <div className="max-w-screen-xl mx-auto">
        <div className="flex items-center justify-between">
          {/* Titre de la phase actuelle */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white text-xl">
                  {['🔍', '🔬', '🧠', '📊', '📁', '✅'][currentPhase]}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  Phase {currentPhase}: {phaseNames[currentPhase]}
                </h2>
                <div className="text-sm text-gray-400">
                  Pipeline V6 - Développement en cours
                </div>
              </div>
            </div>
          </div>

          {/* Breadcrumb simple */}
          <div className="flex items-center space-x-2">
            {Array.from({ length: totalPhases }, (_, i) => (
              <button
                key={i}
                onClick={() => onNavigate(i)}
                disabled={i > currentPhase || (!canGoBack && i < currentPhase)}
                className={`
                  w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold transition-all duration-200
                  ${i === currentPhase
                    ? 'bg-blue-600 text-white shadow-lg'
                    : i < currentPhase
                      ? 'bg-green-600 text-white hover:bg-green-500 cursor-pointer'
                      : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  }
                `}
                title={`Phase ${i}: ${phaseNames[i]}`}
              >
                {i}
              </button>
            ))}
          </div>
        </div>

        {/* Barre de progression */}
        <div className="mt-4">
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${((currentPhase + 1) / totalPhases) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>Phase {currentPhase} / {totalPhases - 1}</span>
            <span>{Math.round(((currentPhase + 1) / totalPhases) * 100)}% complété</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Container principal du Pipeline V6
 */
export function PipelineV6Workflow({
  sourcePath,
  onComplete,
  onCancel,
  onError
}: PipelineV6WorkflowProps) {
  const {
    state,
    currentPhase,
    isRunning,
    loading,
    goToPhase,
    executePhase,
    stopPipeline,
    getCurrentPhaseData,
    submitUserChoices,
    proceedAfterUserValidation,
    continueCurrentPhase,
    canNavigateBack,
    canNavigateNext,
    navigationState
  } = usePipelineV6();

  const { totalProgress, loadingMessage } = usePipelineProgress();

  // Auto-start pipeline au montage (une seule fois)
  const [hasAutoStarted, setHasAutoStarted] = useState(false);
  const previousPhaseRef = useRef(currentPhase);

  useEffect(() => {
    const previous = previousPhaseRef.current;
    previousPhaseRef.current = currentPhase;

    if (currentPhase === previous) {
      return;
    }

    if (currentPhase > previous && !isRunning) {
      const phaseData = getCurrentPhaseData();
      if (!phaseData) {
        executePhase(currentPhase).catch(error => {
          console.error('❌ Auto execute phase failed:', error);
          onError?.(error);
        });
      }
    }
  }, [currentPhase, executePhase, getCurrentPhaseData, isRunning, onError]);

  useEffect(() => {
    if (sourcePath && !hasAutoStarted && currentPhase === 0 && !isRunning) {
      // Démarrer automatiquement Phase 0 une seule fois
      console.log('🚀 Auto-start Phase 0 avec sourcePath:', sourcePath);
      setHasAutoStarted(true);
      executePhase(0);
    }
  }, [sourcePath, hasAutoStarted, currentPhase, isRunning, executePhase]);

  /**
   * Gestion de la completion d'une phase
   */
  const handlePhaseComplete = async (result: any, userChoices: any) => {
    try {
      // Sauvegarder les choix utilisateur
      if (userChoices) {
        submitUserChoices(currentPhase, userChoices);
      }

      // Si dernière phase, terminer le pipeline
      if (currentPhase === 5) {
        onComplete?.(result);
      } else {
        // Ne PAS procéder automatiquement ! L'utilisateur doit valider explicitement.
        console.log('✅ Phase completed, but waiting for explicit user validation before advancing');
        // L'avancement se fera seulement quand l'utilisateur clique sur un bouton de validation
        // via proceedAfterUserValidation appelé explicitement
      }
    } catch (error) {
      onError?.(error);
    }
  };

  /**
   * Gestion du retour en arrière
   */
  const handleBack = () => {
    if (canNavigateBack) {
      goToPhase(currentPhase - 1);
    }
  };

  /**
   * Gestion de l'arrêt
   */
  const handleStop = () => {
    stopPipeline();
    onCancel?.();
  };

  /**
   * Rendu de la phase actuelle
   */
  const renderCurrentPhase = () => {
    const phaseData = getCurrentPhaseData();
    const userChoices = (state.userChoices as any)[`phase${currentPhase}`];

    const phaseProps: PhaseUIProps = {
      phaseNumber: currentPhase,
      data: phaseData,
      userChoices,
      onComplete: handlePhaseComplete,
      onBack: handleBack,
      onStop: handleStop,
      isLoading: loading,
      loadingMessage,
      progress: state.progress,
      onProceed: () => proceedAfterUserValidation(currentPhase),
      onContinue: (payload?: any) => continueCurrentPhase(currentPhase, payload),
      phaseData: {
        data: phaseData,
        isRunning: state.isRunning && state.currentPhase === currentPhase,
        currentOperation: state.progress?.currentOperation,
        pendingAction: state.pendingUserActions[currentPhase]
      }
    };

    // Rendu des vraies Phase UI
    switch (currentPhase) {
      case 0:
        return <Phase0UI {...phaseProps} />;
      case 1:
        return <Phase1UI {...phaseProps} />;
      case 2:
        return <Phase2UI {...phaseProps} />;
      case 3:
        return <Phase3UI {...phaseProps} />;
      case 4:
        return <Phase4UI {...phaseProps} />;
      case 5:
        return <Phase5UI {...phaseProps} />;
      default:
        return <PhaseUIPlaceholder {...phaseProps} />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Navigation principale */}
      <SimplePhaseNavigation
        currentPhase={currentPhase}
        totalPhases={6}
        onNavigate={goToPhase}
        canGoBack={canNavigateBack}
        canGoNext={canNavigateNext}
      />

      {/* Contenu principal */}
      <main className="flex-1 overflow-auto">
        {renderCurrentPhase()}
      </main>

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md mx-4 text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Pipeline en cours</h3>
            <p className="text-gray-600">{loadingMessage || 'Traitement en cours...'}</p>

            {state.progress && (
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${state.progress.percentage}%` }}
                  />
                </div>
                <p className="text-sm text-gray-500">{state.progress.message}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
