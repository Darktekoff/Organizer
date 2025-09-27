/**
 * Types de compatibilité pour les composants Phase UI
 * Ce fichier sert d'adaptateur entre les anciennes et nouvelles interfaces
 */

import { PhaseUIProps } from './UITypes';

/**
 * Interface étendue pour la compatibilité des composants Phase
 */
export interface PhaseUIPropsExtended<T = any> extends PhaseUIProps<T> {
  phaseData?: {
    data?: T;
    isRunning?: boolean;
    currentOperation?: string;
    error?: string;
  };
  onPhaseUpdate?: (updates: Partial<T>) => void;
  onNavigate?: (direction: 'next' | 'previous' | 'complete' | 'restart') => void;
  onUserChoice?: (choice: string, value: any) => void;
}

/**
 * Adaptateur pour convertir les props standards vers les props étendues
 */
export function adaptPhaseProps<T>(props: PhaseUIProps<T>): PhaseUIPropsExtended<T> {
  return {
    ...props,
    phaseData: {
      data: props.data,
      isRunning: props.isLoading,
      currentOperation: props.loadingMessage,
      error: undefined
    },
    onPhaseUpdate: (updates: Partial<T>) => {
      // Adapter vers onComplete avec les mises à jour partielles
      const updatedData = { ...props.data, ...updates };
      props.onComplete(updatedData, props.userChoices);
    },
    onNavigate: (direction: string) => {
      switch (direction) {
        case 'next':
          props.onComplete(props.data, props.userChoices);
          break;
        case 'previous':
          props.onBack();
          break;
        case 'complete':
          props.onComplete(props.data, props.userChoices);
          break;
        case 'restart':
          props.onStop();
          break;
      }
    },
    onUserChoice: (choice: string, value: any) => {
      const updatedChoices = { ...props.userChoices, [choice]: value };
      props.onComplete(props.data, updatedChoices);
    }
  };
}

/**
 * Hook pour utiliser les props adaptées dans les composants
 */
export function usePhasePropsAdapter<T>(props: PhaseUIProps<T>): PhaseUIPropsExtended<T> {
  return adaptPhaseProps(props);
}