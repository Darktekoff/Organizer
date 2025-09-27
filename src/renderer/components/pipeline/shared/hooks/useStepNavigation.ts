/**
 * Hook pour la navigation entre steps d'une phase
 * Gère l'état et la logique de navigation step-by-step
 */

import { useState, useCallback, useEffect } from 'react';
import { StepUIState, StepConfig } from '../../types/UITypes';

interface UseStepNavigationProps {
  steps: StepConfig[];
  initialStep?: number;
  onStepComplete?: (stepNumber: number, result: any) => void;
  onPhaseComplete?: (result: any) => void;
  onStepStart?: (stepNumber: number) => void;
}

interface UseStepNavigationReturn {
  // État actuel
  currentStep: number;
  currentStepConfig: StepConfig | undefined;
  stepStates: Map<number, StepUIState>;
  totalSteps: number;

  // Navigation
  canGoNext: boolean;
  canGoPrevious: boolean;
  canComplete: boolean;
  isFirstStep: boolean;
  isLastStep: boolean;

  // Actions
  goToStep: (stepNumber: number) => void;
  nextStep: () => void;
  previousStep: () => void;
  completeCurrentStep: (result: any) => void;
  forcePhaseComplete: (result: any) => void;
  markStepFailed: (stepNumber: number, error: string) => void;
  resetStep: (stepNumber: number) => void;

  // État des steps
  getStepState: (stepNumber: number) => StepUIState;
  updateStepProgress: (stepNumber: number, progress: number, message?: string) => void;
  setStepRunning: (stepNumber: number, message?: string) => void;
  setStepCompleted: (stepNumber: number, message?: string) => void;

  // Helpers
  getCompletedSteps: () => number[];
  getFailedSteps: () => number[];
  getTotalProgress: () => number;
  getEstimatedTimeRemaining: () => number | null;
}

/**
 * Hook principal pour navigation des steps
 */
export function useStepNavigation({
  steps,
  initialStep = 1,
  onStepComplete,
  onPhaseComplete,
  onStepStart
}: UseStepNavigationProps): UseStepNavigationReturn {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [stepStates, setStepStates] = useState<Map<number, StepUIState>>(() => {
    const initialStates = new Map<number, StepUIState>();

    steps.forEach(step => {
      initialStates.set(step.id, {
        stepNumber: step.id,
        stepName: step.name,
        status: step.id === initialStep ? 'running' : 'pending',
        progress: 0,
        errors: [],
        warnings: []
      });
    });

    return initialStates;
  });

  // Configuration du step actuel
  const currentStepConfig = steps.find(step => step.id === currentStep);

  // États calculés
  const totalSteps = steps.length;
  const isFirstStep = currentStep === steps[0]?.id;
  const isLastStep = currentStep === steps[steps.length - 1]?.id;

  // Logique de navigation
  const canGoPrevious = !isFirstStep &&
    (stepStates.get(currentStep)?.status === 'pending' ||
     stepStates.get(currentStep)?.status === 'failed');

  const canGoNext = !isLastStep &&
    (stepStates.get(currentStep)?.status === 'completed');

  const canComplete = isLastStep &&
    (stepStates.get(currentStep)?.status === 'completed');

  /**
   * Met à jour l'état d'un step
   */
  const updateStepState = useCallback((stepNumber: number, updates: Partial<StepUIState>) => {
    console.log('🔍 updateStepState called for step:', stepNumber, 'updates:', updates);
    setStepStates(prev => {
      const newStates = new Map(prev);
      const currentState = newStates.get(stepNumber);

      if (currentState) {
        const newState = {
          ...currentState,
          ...updates
        };
        newStates.set(stepNumber, newState);
        console.log('🔍 updateStepState - step', stepNumber, 'new state:', newState);
      }

      return newStates;
    });
  }, []);

  /**
   * Navigation vers un step spécifique
   */
  const goToStep = useCallback((stepNumber: number) => {
    console.log('🔍 goToStep called:', {
      from: currentStep,
      to: stepNumber,
      currentStepState: stepStates.get(currentStep)?.status,
      targetStepState: stepStates.get(stepNumber)?.status
    });

    const targetStep = steps.find(step => step.id === stepNumber);
    if (!targetStep) {
      console.log('❌ goToStep: Target step not found:', stepNumber);
      return;
    }

    // Vérifier si on peut naviguer vers ce step
    const currentStepState = stepStates.get(currentStep);
    const targetStepState = stepStates.get(stepNumber);

    // Allow navigation to next step if current step is completed
    if (stepNumber > currentStep && targetStepState?.status === 'pending') {
      // Check if current step is completed - if so, allow navigation to next pending step
      if (stepNumber === currentStep + 1 && currentStepState?.status === 'completed') {
        console.log('✅ goToStep: Allowing navigation to next step (current completed)');
        // Allow navigation to immediate next step when current is completed
      } else {
        console.log('❌ goToStep: Navigation blocked - not immediate next or current not completed');
        // Ne peut pas aller vers un step non accessible (skip multiple steps)
        return;
      }
    }

    console.log('🚀 goToStep: Setting currentStep to', stepNumber);
    setCurrentStep(stepNumber);

    // Marquer le step comme en cours s'il n'est pas complété
    if (targetStepState?.status !== 'completed') {
      updateStepState(stepNumber, {
        status: 'running',
        startTime: Date.now()
      });
    }

    onStepStart?.(stepNumber);
  }, [steps, stepStates, currentStep, updateStepState, onStepStart]);

  /**
   * Step suivant
   */
  const nextStep = useCallback(() => {
    console.log('🔍 nextStep called - currentStep:', currentStep);
    const currentIndex = steps.findIndex(step => step.id === currentStep);
    console.log('🔍 nextStep - currentIndex:', currentIndex, 'totalSteps:', steps.length);

    if (currentIndex < steps.length - 1) {
      const nextStepId = steps[currentIndex + 1].id;
      console.log('🔍 nextStep - calling goToStep with nextStepId:', nextStepId);
      goToStep(nextStepId);
    } else {
      console.log('🔍 nextStep - already at last step, cannot advance');
    }
  }, [steps, currentStep, goToStep]);

  /**
   * Step précédent
   */
  const previousStep = useCallback(() => {
    const currentIndex = steps.findIndex(step => step.id === currentStep);
    if (currentIndex > 0) {
      const prevStepId = steps[currentIndex - 1].id;
      goToStep(prevStepId);
    }
  }, [steps, currentStep, goToStep]);

  /**
   * Compléter le step actuel
   */
  const completeCurrentStep = useCallback((result: any) => {
    console.log('🚨 completeCurrentStep called for step', currentStep, 'isLastStep:', isLastStep, 'result:', result);
    const endTime = Date.now();
    const currentState = stepStates.get(currentStep);
    const duration = currentState?.startTime ? endTime - currentState.startTime : 0;

    updateStepState(currentStep, {
      status: 'completed',
      progress: 100,
      endTime,
      message: 'Terminé avec succès'
    });

    onStepComplete?.(currentStep, result);

    // Si c'est le dernier step ET qu'aucune action utilisateur n'est requise, terminer la phase
    if (isLastStep) {
      // Vérifier si le résultat demande une action utilisateur
      const requiresUserAction = result?.userActionRequired ||
                                result?.requiresUserAction ||
                                (result?.data && result.data.userActionRequired);

      console.log('🚨 Last step completed. UserAction required?', requiresUserAction);

      if (requiresUserAction) {
        console.log('🚨 NOT CALLING onPhaseComplete because user action is required!');
        // Ne pas appeler onPhaseComplete, attendre l'action utilisateur
        return;
      } else {
        console.log('🚨 CALLING onPhaseComplete because no user action required');
        onPhaseComplete?.(result);
      }
    } else {
      // Sinon, passer au step suivant automatiquement avec délai pour synchronisation
      console.log('🚨 completeCurrentStep: Scheduling nextStep() with delay to allow state sync');
      setTimeout(() => {
        console.log('🚨 Delayed nextStep() execution - currentStep:', currentStep);
        nextStep();
      }, 100); // Réduit à 100ms pour être plus réactif
    }
  }, [currentStep, stepStates, updateStepState, onStepComplete, isLastStep, onPhaseComplete, nextStep]);

  // EFFET AUTOMATIQUE: Avancer au step suivant quand le step actuel devient completed
  useEffect(() => {
    const currentStepState = stepStates.get(currentStep);
    if (currentStepState?.status === 'completed' && !isLastStep) {
      console.log('🚀 AUTO-ADVANCE: Current step', currentStep, 'is completed, advancing to next step');
      const nextStepNumber = currentStep + 1;
      const nextStepState = stepStates.get(nextStepNumber);

      if (nextStepState?.status === 'pending') {
        setTimeout(() => {
          console.log('🚀 AUTO-ADVANCE: Executing goToStep from', currentStep, 'to', nextStepNumber);
          goToStep(nextStepNumber);
        }, 50); // Très court délai pour la réactivité
      }
    }
  }, [currentStep, stepStates, isLastStep, goToStep]);

  /**
   * Forcer la completion d'une phase après validation utilisateur
   */
  const forcePhaseComplete = useCallback((result: any) => {
    console.log('🚨 forcePhaseComplete called - user validated, proceeding to onPhaseComplete');
    onPhaseComplete?.(result);
  }, [onPhaseComplete]);

  /**
   * Marquer un step comme échoué
   */
  const markStepFailed = useCallback((stepNumber: number, error: string) => {
    updateStepState(stepNumber, {
      status: 'failed',
      endTime: Date.now(),
      errors: [error],
      message: error
    });
  }, [updateStepState]);

  /**
   * Reset un step
   */
  const resetStep = useCallback((stepNumber: number) => {
    const stepConfig = steps.find(step => step.id === stepNumber);
    if (stepConfig) {
      updateStepState(stepNumber, {
        status: 'pending',
        progress: 0,
        message: undefined,
        startTime: undefined,
        endTime: undefined,
        errors: [],
        warnings: []
      });
    }
  }, [steps, updateStepState]);

  /**
   * Récupérer l'état d'un step
   */
  const getStepState = useCallback((stepNumber: number): StepUIState => {
    return stepStates.get(stepNumber) || {
      stepNumber,
      stepName: 'Unknown',
      status: 'pending',
      progress: 0,
      errors: [],
      warnings: []
    };
  }, [stepStates]);

  /**
   * Mettre à jour la progression d'un step
   */
  const updateStepProgress = useCallback((stepNumber: number, progress: number, message?: string) => {
    updateStepState(stepNumber, {
      progress: Math.min(100, Math.max(0, progress)),
      message
    });
  }, [updateStepState]);

  /**
   * Marquer un step comme en cours
   */
  const setStepRunning = useCallback((stepNumber: number, message?: string) => {
    updateStepState(stepNumber, {
      status: 'running',
      startTime: Date.now(),
      message
    });
  }, [updateStepState]);

  /**
   * Marquer un step comme complété
   */
  const setStepCompleted = useCallback((stepNumber: number, message?: string) => {
    console.log('🔍 setStepCompleted called for step:', stepNumber, 'message:', message);
    updateStepState(stepNumber, {
      status: 'completed',
      progress: 100,
      endTime: Date.now(),
      message: message || 'Terminé avec succès'
    });
    console.log('🔍 setStepCompleted - step', stepNumber, 'marked as completed');
  }, [updateStepState]);

  /**
   * Obtenir les steps complétés
   */
  const getCompletedSteps = useCallback((): number[] => {
    return Array.from(stepStates.entries())
      .filter(([_, state]) => state.status === 'completed')
      .map(([stepNumber, _]) => stepNumber);
  }, [stepStates]);

  /**
   * Obtenir les steps échoués
   */
  const getFailedSteps = useCallback((): number[] => {
    return Array.from(stepStates.entries())
      .filter(([_, state]) => state.status === 'failed')
      .map(([stepNumber, _]) => stepNumber);
  }, [stepStates]);

  /**
   * Calculer la progression totale
   */
  const getTotalProgress = useCallback((): number => {
    const totalProgress = Array.from(stepStates.values())
      .reduce((sum, state) => sum + state.progress, 0);

    return totalProgress / (steps.length * 100) * 100;
  }, [stepStates, steps.length]);

  /**
   * Estimer le temps restant
   */
  const getEstimatedTimeRemaining = useCallback((): number | null => {
    const completedSteps = getCompletedSteps();
    if (completedSteps.length === 0) return null;

    const totalEstimatedTime = steps.reduce((sum, step) => {
      const timeStr = step.estimatedTime;
      const timeMs = parseEstimatedTime(timeStr);
      return sum + timeMs;
    }, 0);

    const completedTime = completedSteps.reduce((sum, stepNumber) => {
      const step = steps.find(s => s.id === stepNumber);
      if (step) {
        return sum + parseEstimatedTime(step.estimatedTime);
      }
      return sum;
    }, 0);

    const currentStepState = stepStates.get(currentStep);
    if (currentStepState && currentStepState.startTime) {
      const currentStepConfig = steps.find(s => s.id === currentStep);
      if (currentStepConfig) {
        const estimatedStepTime = parseEstimatedTime(currentStepConfig.estimatedTime);
        const elapsedStepTime = Date.now() - currentStepState.startTime;
        const remainingStepTime = Math.max(0, estimatedStepTime - elapsedStepTime);

        return (totalEstimatedTime - completedTime - elapsedStepTime) + remainingStepTime;
      }
    }

    return totalEstimatedTime - completedTime;
  }, [steps, stepStates, currentStep, getCompletedSteps]);

  return {
    // État actuel
    currentStep,
    currentStepConfig,
    stepStates,
    totalSteps,

    // Navigation
    canGoNext,
    canGoPrevious,
    canComplete,
    isFirstStep,
    isLastStep,

    // Actions
    goToStep,
    nextStep,
    previousStep,
    completeCurrentStep,
    forcePhaseComplete,
    markStepFailed,
    resetStep,

    // État des steps
    getStepState,
    updateStepProgress,
    setStepRunning,
    setStepCompleted,

    // Helpers
    getCompletedSteps,
    getFailedSteps,
    getTotalProgress,
    getEstimatedTimeRemaining
  };
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
    default: return value * 1000; // Par défaut, considérer comme des secondes
  }
}