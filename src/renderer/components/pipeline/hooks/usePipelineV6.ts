/**
 * Hook principal Pipeline V6
 * Interface unique pour toutes les interactions backend
 */

import { useCallback, useEffect, useState } from 'react';
import { usePipelineV6Context } from '../PipelineV6Provider';
import {
  UsePipelineV6Return,
  PhaseResult,
  NavigationState,
  PipelineEvents
} from '../types/UITypes';
import { PipelineError } from '@shared/interfaces/PipelineTypes';

/**
 * Type pour les event listeners
 */
type EventListener = (data: any) => void;

/**
 * Hook principal pour utiliser le Pipeline V6
 */
export function usePipelineV6(): UsePipelineV6Return {
  const context = usePipelineV6Context();
  const [eventListeners, setEventListeners] = useState<Map<keyof PipelineEvents, EventListener[]>>(new Map());

  /**
   * Démarrage du pipeline
   */
  const startPipeline = useCallback(async (sourcePath: string): Promise<void> => {
    try {
      // Émettre événement de démarrage
      emitEvent('phase-start', { phase: 0 });

      // Initialiser le pipeline avec le chemin source
      context.goToPhase(0);

      // Auto-start sera géré par PipelineV6Workflow
      console.log('📍 Pipeline initialisé, en attente du démarrage par Workflow');

    } catch (error) {
      const pipelineError: PipelineError = {
        phase: 0,
        code: 'START_FAILED',
        message: error instanceof Error ? error.message : 'Failed to start pipeline',
        timestamp: Date.now(),
        recoverable: true
      };

      emitEvent('pipeline-error', { error: pipelineError });
      throw error;
    }
  }, [context]);

  /**
   * Exécution d'une phase avec événements
   */
  const executePhase = useCallback(async (phase: number): Promise<PhaseResult> => {
    try {
      emitEvent('phase-start', { phase });

      await context.executePhase(phase);

      const result: PhaseResult = {
        success: true,
        data: context.getPhaseData(phase),
        userChoices: context.getUserChoices(phase),
        errors: context.state.errors.filter(e => e.phase === phase),
        warnings: context.state.warnings,
        duration: 0, // TODO: Track actual duration
        canContinue: phase < 5
      };

      emitEvent('phase-complete', { phase, result });

      return result;

    } catch (error) {
      const pipelineError: PipelineError = {
        phase,
        code: 'PHASE_EXECUTION_FAILED',
        message: error instanceof Error ? error.message : 'Phase execution failed',
        timestamp: Date.now(),
        recoverable: true
      };

      emitEvent('phase-error', { phase, error: pipelineError });

      return {
        success: false,
        data: null,
        userChoices: null,
        errors: [pipelineError],
        warnings: [],
        duration: 0,
        canContinue: false
      };
    }
  }, [context]);

  /**
   * Navigation vers une phase
   */
  const goToPhase = useCallback((phase: number) => {
    const oldPhase = context.state.currentPhase;
    context.goToPhase(phase);

    emitEvent('phase-start', { phase });

    // Si on revient en arrière, émettre un événement spécial
    if (phase < oldPhase) {
      emitEvent('user-action', {
        action: {
          type: 'navigate',
          phase,
          data: { previousPhase: oldPhase },
          timestamp: Date.now()
        }
      });
    }
  }, [context]);

  /**
   * Soumission des choix utilisateur
   */
  const submitUserChoices = useCallback((phase: number, choices: any) => {
    context.submitUserChoices(phase, choices);

    emitEvent('user-action', {
      action: {
        type: 'choose',
        phase,
        data: choices,
        timestamp: Date.now()
      }
    });
  }, [context]);

  /**
   * Procéder après validation utilisateur
   */
  const proceedAfterUserValidation = useCallback((phase: number) => {
    context.proceedAfterUserValidation(phase);

    emitEvent('user-action', {
      action: {
        type: 'validate',
        phase,
        data: { validated: true },
        timestamp: Date.now()
      }
    });
  }, [context]);

  /**
   * Récupération des données de phase courante
   */
  const getCurrentPhaseData = useCallback(() => {
    return context.getCurrentPhaseData();
  }, [context]);

  /**
   * Récupération des données d'une phase spécifique
   */
  const getPhaseData = useCallback((phase: number) => {
    return context.getPhaseData(phase);
  }, [context]);

  /**
   * Arrêt du pipeline
   */
  const stopPipeline = useCallback(() => {
    context.stopPipeline();
    emitEvent('pipeline-cancelled', {});

    emitEvent('user-action', {
      action: {
        type: 'cancel',
        phase: context.state.currentPhase,
        timestamp: Date.now()
      }
    });
  }, [context]);

  /**
   * Pause du pipeline
   */
  const pausePipeline = useCallback(() => {
    context.pausePipeline();

    emitEvent('user-action', {
      action: {
        type: 'pause',
        phase: context.state.currentPhase,
        timestamp: Date.now()
      }
    });
  }, [context]);

  /**
   * Reprise du pipeline
   */
  const resumePipeline = useCallback(() => {
    context.resumePipeline();

    emitEvent('user-action', {
      action: {
        type: 'resume',
        phase: context.state.currentPhase,
        timestamp: Date.now()
      }
    });
  }, [context]);

  /**
   * État de navigation
   */
  const navigationState: NavigationState = {
    canGoBack: context.state.canNavigateBack,
    canGoNext: context.state.canNavigateNext,
    canStop: context.canStop(),
    canPause: context.canPause(),
    nextPhase: context.state.currentPhase < 5 ? context.state.currentPhase + 1 : undefined,
    previousPhase: context.state.currentPhase > 0 ? context.state.currentPhase - 1 : undefined,
    completedPhases: Array.from({ length: context.state.currentPhase }, (_, i) => i)
  };

  /**
   * Émission d'événements
   */
  const emitEvent = useCallback((event: keyof PipelineEvents, data: any) => {
    const listeners = eventListeners.get(event) || [];
    listeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }, [eventListeners]);

  /**
   * Ajout d'un listener d'événement
   */
  const on = useCallback((event: keyof PipelineEvents, callback: EventListener) => {
    setEventListeners(prev => {
      const newMap = new Map(prev);
      const listeners = newMap.get(event) || [];
      newMap.set(event, [...listeners, callback]);
      return newMap;
    });
  }, []);

  /**
   * Suppression d'un listener d'événement
   */
  const off = useCallback((event: keyof PipelineEvents, callback: EventListener) => {
    setEventListeners(prev => {
      const newMap = new Map(prev);
      const listeners = newMap.get(event) || [];
      const filteredListeners = listeners.filter(l => l !== callback);

      if (filteredListeners.length === 0) {
        newMap.delete(event);
      } else {
        newMap.set(event, filteredListeners);
      }

      return newMap;
    });
  }, []);

  /**
   * Nettoyage des listeners à la destruction du composant
   */
  useEffect(() => {
    return () => {
      setEventListeners(new Map());
    };
  }, []);

  /**
   * Auto-emit pipeline-complete quand phase 5 est terminée
   */
  useEffect(() => {
    if (context.state.currentPhase === 5 && context.state.phase5Data) {
      const finalResult = {
        phases: [
          context.state.phase0Data,
          context.state.phase1Data,
          context.state.phase2Data,
          context.state.phase3Data,
          context.state.phase4Data,
          context.state.phase5Data
        ],
        userChoices: context.state.userChoices,
        errors: context.state.errors,
        warnings: context.state.warnings,
        totalDuration: 0, // TODO: Calculate total duration
        success: context.state.errors.length === 0
      };

      emitEvent('pipeline-complete', { result: finalResult });
    }
  }, [context.state.currentPhase, context.state.phase5Data, context.state, emitEvent]);

  /**
   * Return object du hook
   */
  return {
    // State
    state: context.state,
    currentPhase: context.state.currentPhase,
    isRunning: context.state.isRunning,
    loading: context.state.loading,

    // Actions
    startPipeline,
    goToPhase,
    executePhase,
    stopPipeline,
    pausePipeline,
    resumePipeline,
    continueCurrentPhase: context.continueCurrentPhase,

    // Data
    getCurrentPhaseData,
    getPhaseData,
    submitUserChoices,
    proceedAfterUserValidation,

    // Navigation
    canNavigateBack: context.canNavigateBack(),
    canNavigateNext: context.canNavigateNext(),
    navigationState,

    // Events
    on,
    off
  };
}

/**
 * Hook pour écouter les événements du pipeline
 */
export function usePipelineEvents() {
  const { on, off } = usePipelineV6();

  /**
   * Hook pour écouter un événement spécifique
   */
  const useEvent = useCallback((event: keyof PipelineEvents, callback: EventListener) => {
    useEffect(() => {
      on(event, callback);
      return () => off(event, callback);
    }, [callback]);
  }, [on, off]);

  return { useEvent };
}

/**
 * Hook pour suivre la progression du pipeline
 */
export function usePipelineProgress() {
  const { state } = usePipelineV6();
  const [totalProgress, setTotalProgress] = useState(0);

  useEffect(() => {
    // Calculer la progression totale basée sur les phases complétées
    const completedPhases = state.currentPhase;
    const progress = (completedPhases / 6) * 100;
    setTotalProgress(progress);
  }, [state.currentPhase]);

  return {
    currentPhase: state.currentPhase,
    totalPhases: 6,
    totalProgress,
    progress: state.progress,
    isRunning: state.isRunning,
    loading: state.loading,
    loadingMessage: state.loadingMessage
  };
}

/**
 * Hook pour la validation utilisateur
 */
export function usePipelineValidation() {
  const { state, submitUserChoices } = usePipelineV6();

  const validatePhase = useCallback((phase: number, choices: any) => {
    submitUserChoices(phase, choices);
  }, [submitUserChoices]);

  const hasValidation = useCallback((phase: number) => {
    return state.pendingValidations.some(v => v.startsWith(`phase${phase}`));
  }, [state.pendingValidations]);

  const getValidationStatus = useCallback((phase: number) => {
    const userChoices = (state.userChoices as any)[`phase${phase}`];
    return {
      hasChoices: !!userChoices,
      choices: userChoices,
      isPending: hasValidation(phase)
    };
  }, [state.userChoices, hasValidation]);

  return {
    validatePhase,
    hasValidation,
    getValidationStatus,
    pendingValidations: state.pendingValidations
  };
}
