/**
 * Pipeline V6 Provider - State Management
 * Gère l'état global du pipeline avec React Context
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import {
  UIState,
  PipelineV6ContextType,
  PipelineV6ProviderProps,
  PipelineV6Config,
  PhaseConfig,
  UserAction,
  PhaseResult,
  NavigationState,
  ProgressState
} from './types/UITypes';
import { PipelineError } from '@shared/interfaces/PipelineTypes';

/**
 * Configuration par défaut du Pipeline V6
 */
const DEFAULT_CONFIG: PipelineV6Config = {
  phases: [
    {
      phaseNumber: 0,
      phaseName: 'Preparation',
      description: 'Quick scan et réorganisation préliminaire',
      icon: '🔍',
      color: 'blue',
      steps: [
        { id: 1, name: 'Quick Scan', description: 'Scan rapide et détection des packs', estimatedTime: '15s', component: null as any, canSkip: false, requiresUserAction: true },
        { id: 2, name: 'Clean & Reorganize', description: 'Nettoyage et réorganisation des fichiers', estimatedTime: '30s', component: null as any, canSkip: false, requiresUserAction: false }
      ],
      estimatedTotalTime: '45s',
      canSkip: false
    },
    {
      phaseNumber: 1,
      phaseName: 'Discovery',
      description: 'Analyse approfondie et indexation',
      icon: '🔬',
      color: 'green',
      steps: [
        { id: 1, name: 'Structure Analyzer', description: 'Analyse de la structure des dossiers', estimatedTime: '30s', component: null as any, canSkip: false, requiresUserAction: true },
        { id: 2, name: 'Content Indexer', description: 'Indexation du contenu des samples', estimatedTime: '45s', component: null as any, canSkip: false, requiresUserAction: false },
        { id: 3, name: 'Metadata Extractor', description: 'Extraction des métadonnées audio', estimatedTime: '60s', component: null as any, canSkip: false, requiresUserAction: true }
      ],
      estimatedTotalTime: '135s',
      canSkip: false
    },
    {
      phaseNumber: 2,
      phaseName: 'Classification',
      description: 'Classification automatique et quarantaine',
      icon: '🧠',
      color: 'purple',
      steps: [
        { id: 1, name: 'Style Classifier', description: 'Classification automatique des styles musicaux', estimatedTime: '30s', component: null as any, canSkip: false, requiresUserAction: true },
        { id: 2, name: 'Quarantine Handler', description: 'Gestion des packs incertains', estimatedTime: '60s', component: null as any, canSkip: false, requiresUserAction: true }
      ],
      estimatedTotalTime: '90s',
      canSkip: false
    },
    {
      phaseNumber: 3,
      phaseName: 'Matrix & Structure',
      description: 'Génération matrice et choix structure',
      icon: '📊',
      color: 'orange',
      steps: [
        { id: 1, name: 'Matrix Generator', description: 'Génération de la matrice organisationnelle', estimatedTime: '20s', component: null as any, canSkip: false, requiresUserAction: true },
        { id: 2, name: 'Structure Proposal', description: 'Propositions de structures intelligentes', estimatedTime: '180s', component: null as any, canSkip: false, requiresUserAction: true },
        { id: 3, name: 'Duplicate Detection', description: 'Détection avancée de doublons', estimatedTime: '120s', component: null as any, canSkip: false, requiresUserAction: true }
      ],
      estimatedTotalTime: '320s',
      canSkip: false
    },
    {
      phaseNumber: 4,
      phaseName: 'Organization',
      description: 'Organisation fichiers et fusion intelligente',
      icon: '📁',
      color: 'indigo',
      steps: [
        { id: 1, name: 'Organization Planner', description: 'Planification des opérations d\'organisation', estimatedTime: '120s', component: null as any, canSkip: false, requiresUserAction: false },
        { id: 2, name: 'Organization Executor', description: 'Exécution de l\'organisation physique', estimatedTime: '90s', component: null as any, canSkip: false, requiresUserAction: false },
        { id: 3, name: 'Organization Validator', description: 'Validation de l\'organisation réalisée', estimatedTime: '30s', component: null as any, canSkip: false, requiresUserAction: true }
      ],
      estimatedTotalTime: '240s',
      canSkip: false
    },
    {
      phaseNumber: 5,
      phaseName: 'Final Validation',
      description: 'Validation finale, rapports et backup',
      icon: '✅',
      color: 'green',
      steps: [
        { id: 1, name: 'Final Validator', description: '14 contrôles d\'intégrité complets', estimatedTime: '45s', component: null as any, canSkip: false, requiresUserAction: true },
        { id: 2, name: 'Report Generator', description: 'Génération rapports multi-formats', estimatedTime: '30s', component: null as any, canSkip: false, requiresUserAction: true },
        { id: 3, name: 'Backup Manager', description: 'Backup intelligent avec rollback', estimatedTime: '60s', component: null as any, canSkip: false, requiresUserAction: true }
      ],
      estimatedTotalTime: '135s',
      canSkip: false
    }
  ],
  theme: {
    primaryColor: '#3B82F6',
    secondaryColor: '#6366F1',
    errorColor: '#EF4444',
    warningColor: '#F59E0B',
    successColor: '#10B981'
  },
  features: {
    allowPause: true,
    allowStop: true,
    allowBackNavigation: true,
    persistState: true,
    showProgress: true,
    showTimeEstimates: true
  }
};

/**
 * Actions pour le reducer
 */
type UIAction =
  | { type: 'SET_PHASE'; phase: number }
  | { type: 'SET_LOADING'; loading: boolean; message?: string }
  | { type: 'SET_PROGRESS'; progress: ProgressState }
  | { type: 'SET_PHASE_DATA'; phase: number; data: any }
  | { type: 'SET_USER_CHOICES'; phase: number; choices: any }
  | { type: 'ADD_ERROR'; error: PipelineError }
  | { type: 'ADD_WARNING'; warning: string }
  | { type: 'CLEAR_ERRORS' }
  | { type: 'SET_RUNNING'; running: boolean }
  | { type: 'SET_SOURCE_PATH'; path: string }
  | { type: 'SET_WORKING_PATH'; path: string }
  | { type: 'ADD_PENDING_VALIDATION'; validation: string }
  | { type: 'REMOVE_PENDING_VALIDATION'; validation: string }
  | { type: 'SET_PENDING_USER_ACTION'; phase: number; payload: any }
  | { type: 'CLEAR_PENDING_USER_ACTION'; phase: number }
  | { type: 'RESET_STATE' };

/**
 * État initial
 */
const initialState: UIState = {
  currentPhase: 0,
  isRunning: false,
  canNavigateBack: false,
  canNavigateNext: false,
  sourcePath: '',
  errors: [],
  warnings: [],
  loading: false,
  userChoices: {},
  pendingValidations: [],
  pendingUserActions: {},
  // Phase data - explicitly initialize to undefined for proper state updates
  phase0Data: undefined,
  phase1Data: undefined,
  phase2Data: undefined,
  phase3Data: undefined,
  phase4Data: undefined,
  phase5Data: undefined
};

/**
 * Reducer pour gérer l'état UI
 */
function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'SET_PHASE':
      return {
        ...state,
        currentPhase: action.phase,
        canNavigateBack: action.phase > 0,
        canNavigateNext: false // Will be set when phase completes
      };

    case 'SET_LOADING':
      return {
        ...state,
        loading: action.loading,
        loadingMessage: action.message
      };

    case 'SET_PROGRESS':
      return {
        ...state,
        progress: action.progress
      };

    case 'SET_PHASE_DATA':
      return {
        ...state,
        [`phase${action.phase}Data`]: action.data
      };

    case 'SET_USER_CHOICES':
      return {
        ...state,
        userChoices: {
          ...state.userChoices,
          [`phase${action.phase}`]: action.choices
        }
      };

    case 'ADD_ERROR':
      return {
        ...state,
        errors: [...state.errors, action.error]
      };

    case 'ADD_WARNING':
      return {
        ...state,
        warnings: [...state.warnings, action.warning]
      };

    case 'CLEAR_ERRORS':
      return {
        ...state,
        errors: [],
        warnings: []
      };

    case 'SET_RUNNING':
      return {
        ...state,
        isRunning: action.running
      };

    case 'SET_SOURCE_PATH':
      return {
        ...state,
        sourcePath: action.path
      };

    case 'SET_WORKING_PATH':
      return {
        ...state,
        workingPath: action.path
      };

    case 'ADD_PENDING_VALIDATION':
      return {
        ...state,
        pendingValidations: [...state.pendingValidations, action.validation]
      };

    case 'REMOVE_PENDING_VALIDATION':
      return {
        ...state,
        pendingValidations: state.pendingValidations.filter(v => v !== action.validation)
      };

    case 'SET_PENDING_USER_ACTION':
      return {
        ...state,
        pendingUserActions: {
          ...state.pendingUserActions,
          [action.phase]: action.payload
        }
      };

    case 'CLEAR_PENDING_USER_ACTION': {
      const { [action.phase]: _, ...rest } = state.pendingUserActions;
      return {
        ...state,
        pendingUserActions: rest
      };
    }

    case 'RESET_STATE':
      return initialState;

    default:
      return state;
  }
}

/**
 * Context React
 */
const PipelineV6Context = createContext<PipelineV6ContextType>({} as PipelineV6ContextType);

/**
 * Provider Component
 */
export function PipelineV6Provider({
  children,
  sourcePath,
  initialConfig,
  config,
  onComplete,
  onError,
  onCancel
}: PipelineV6ProviderProps) {
  const resolvedSourcePath = sourcePath ?? initialConfig?.libraryPath ?? '';

  const [state, dispatch] = useReducer(uiReducer, {
    ...initialState,
    sourcePath: resolvedSourcePath
  });

  const hasInitializedRef = useRef(false);
  const initializingPromiseRef = useRef<Promise<void> | null>(null);

  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  const getPhaseData = useCallback((phase: number) => {
    const key = `phase${phase}Data`;
    return (state as any)[key];
  }, [state]);

  const getCurrentPhaseData = useCallback(() => {
    return getPhaseData(state.currentPhase);
  }, [getPhaseData, state.currentPhase]);

  const getUserChoices = useCallback((phase: number) => {
    return (state.userChoices as any)[`phase${phase}`];
  }, [state.userChoices]);

  // Synchronise le chemin source provenant des props / config initiale
  useEffect(() => {
    if (!resolvedSourcePath && state.sourcePath) {
      // Chemin effacé : réinitialiser l'état source
      hasInitializedRef.current = false;
      initializingPromiseRef.current = null;
      dispatch({ type: 'SET_SOURCE_PATH', path: '' });
      return;
    }

    if (resolvedSourcePath && resolvedSourcePath !== state.sourcePath) {
      hasInitializedRef.current = false;
      initializingPromiseRef.current = null;
      dispatch({ type: 'SET_SOURCE_PATH', path: resolvedSourcePath });
    }
  }, [resolvedSourcePath, state.sourcePath]);

  const ensurePipelineInitialized = useCallback(async () => {
    if (hasInitializedRef.current && !initializingPromiseRef.current) {
      return;
    }

    if (!state.sourcePath) {
      throw new Error('Aucun chemin source défini pour le pipeline');
    }

    if (!window.electronAPI?.pipeline?.initialize) {
      throw new Error('API pipeline.initialize indisponible');
    }

    if (!initializingPromiseRef.current) {
      initializingPromiseRef.current = window.electronAPI.pipeline.initialize(state.sourcePath)
        .then(() => {
          hasInitializedRef.current = true;
        })
        .catch(error => {
          hasInitializedRef.current = false;
          throw error;
        })
        .finally(() => {
          initializingPromiseRef.current = null;
        });
    }

    return initializingPromiseRef.current;
  }, [state.sourcePath]);

  useEffect(() => {
    if (!state.sourcePath) {
      return;
    }

    ensurePipelineInitialized().catch(error => {
      console.error('Erreur lors de l\'initialisation du pipeline:', error);
      const pipelineError: PipelineError = {
        phase: 0,
        code: 'INITIALIZATION_FAILED',
        message: error instanceof Error ? error.message : 'Pipeline initialization failed',
        timestamp: Date.now(),
        recoverable: false,
        details: error
      };
      dispatch({ type: 'ADD_ERROR', error: pipelineError });
      onError?.(pipelineError);
    });
  }, [state.sourcePath, ensurePipelineInitialized, onError]);

  // Setup event listeners pour la communication bidirectionnelle
  useEffect(() => {
    if (!window.electronAPI) return;

    const handlePhaseStart = (event: any, data: { phase: number }) => {
      dispatch({ type: 'SET_PHASE', phase: data.phase });
      dispatch({ type: 'SET_RUNNING', running: true });
    };

    const handlePhaseComplete = (event: any, data: { phase: number; result: any }) => {
      console.log('🔥 FRONTEND: Phase complete received for phase', data.phase);

      // Store phase data
      if (data.result.data !== undefined) {
        dispatch({ type: 'SET_PHASE_DATA', phase: data.phase, data: data.result.data });
      }
      dispatch({ type: 'SET_LOADING', loading: false });

      // Check if user action is required before advancing
      const requiresUserAction = data.result?.userActionRequired ||
                                data.result?.data?.userActionRequired ||
                                data.result?.requiresUserAction;

      console.log('🔥 Phase complete - requires user action?', requiresUserAction);
      console.log('🔥 DEBUG - Full data.result:', JSON.stringify(data.result, null, 2));

      if (requiresUserAction) {
        console.log('🔥 NOT AUTO-ADVANCING - user action required for phase', data.phase);
        // Do not advance, wait for user validation
        return;
      }

      // Only advance if no user action required and not last phase
      if (data.phase < 5) {
        console.log('🔥 AUTO-ADVANCING from phase', data.phase, 'to phase', data.phase + 1, '(no user action required)');
        dispatch({ type: 'SET_PHASE', phase: data.phase + 1 });
      }
    };

    const handlePhaseUserActionRequired = (event: any, data: { phase: number; result: any }) => {
      console.log('🎯 FRONTEND: Phase user action required received for phase', data.phase, 'with data:', data);
      console.log('🎯 data.result:', data.result);
      console.log('🎯 data.result.data:', data.result.data);

      // Store the phase data but DO NOT advance to next phase
      if (data.result.data !== undefined) {
        dispatch({ type: 'SET_PHASE_DATA', phase: data.phase, data: data.result.data });
      }
      dispatch({ type: 'SET_LOADING', loading: false });
      dispatch({ type: 'SET_RUNNING', running: false });
      dispatch({ type: 'SET_PENDING_USER_ACTION', phase: data.phase, payload: data.result.userActionRequired });

      // Add a pending validation to prevent automatic advancement
      const validationKey = `phase${data.phase}-user-action`;
      dispatch({ type: 'ADD_PENDING_VALIDATION', validation: validationKey });

      console.log('⏸️ Phase execution paused for user validation');
    };

    const handlePhaseError = (event: any, data: { phase: number; error: any }) => {
      dispatch({ type: 'ADD_ERROR', error: data.error });
      dispatch({ type: 'SET_LOADING', loading: false });
      dispatch({ type: 'SET_RUNNING', running: false });
    };

    const handlePhaseProgress = (event: any, data: { phase: number; progress: number; message: string }) => {
      dispatch({
        type: 'SET_PROGRESS',
        progress: {
          phase: data.phase,
          step: 0,
          totalSteps: 100,
          percentage: data.progress,
          message: data.message
        }
      });
    };

    // Attacher les listeners
    window.electronAPI.onPipelinePhaseStart?.(handlePhaseStart);
    window.electronAPI.onPipelinePhaseComplete?.(handlePhaseComplete);
    window.electronAPI.onPipelinePhaseUserActionRequired?.(handlePhaseUserActionRequired);
    window.electronAPI.onPipelinePhaseError?.(handlePhaseError);
    window.electronAPI.onPipelinePhaseProgress?.(handlePhaseProgress);

    // Cleanup lors du démontage
    return () => {
      window.electronAPI.removePipelineListeners?.();
    };
  }, []);

  /**
   * Navigation vers une phase
   */
  const goToPhase = useCallback((phase: number) => {
    if (phase >= 0 && phase <= 5) {
      dispatch({ type: 'SET_PHASE', phase });
    }
  }, []);

  /**
   * Exécution d'une phase
   */
  const executePhase = useCallback(async (phase: number): Promise<void> => {
    dispatch({ type: 'SET_RUNNING', running: true });
    dispatch({ type: 'SET_LOADING', loading: true, message: `Exécution Phase ${phase}...` });

    try {
      await ensurePipelineInitialized();

      // Communication avec le backend via Electron IPC
      const result = await window.electronAPI?.pipeline?.executePhase?.(phase, {
        sourcePath: state.sourcePath,
        workingPath: state.workingPath,
        phaseData: getPhaseData(phase),
        userChoices: getUserChoices(phase)
      });

      if (result?.success) {
        dispatch({ type: 'SET_PHASE_DATA', phase, data: result.data });
        dispatch({ type: 'SET_LOADING', loading: false });

        // Do NOT auto-advance! Phase advancement should be handled by:
        // 1. Backend events (phase:complete or phase:user-action-required)
        // 2. User explicit validation via proceedAfterUserValidation
        console.log(`✅ Phase ${phase} executed successfully, but NOT auto-advancing`);
      } else {
        throw new Error(result?.error || `Phase ${phase} failed`);
      }
    } catch (error) {
      const pipelineError: PipelineError = {
        phase,
        code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
        recoverable: true
      };

      dispatch({ type: 'ADD_ERROR', error: pipelineError });
      dispatch({ type: 'SET_LOADING', loading: false });
      onError?.(pipelineError);
    } finally {
      dispatch({ type: 'SET_RUNNING', running: false });
    }
  }, [ensurePipelineInitialized, getPhaseData, getUserChoices, state.sourcePath, state.workingPath, onError]);

  /**
   * Arrêt du pipeline
   */
  const stopPipeline = useCallback(async () => {
    try {
      // Appel IPC pour arrêter le pipeline backend
      await window.electronAPI?.pipeline?.stop?.();
    } catch (error) {
      console.error('Erreur lors de l\'arrêt du pipeline:', error);
    }

    dispatch({ type: 'SET_RUNNING', running: false });
    dispatch({ type: 'SET_LOADING', loading: false });
    onCancel?.();
  }, [onCancel]);

  /**
   * Pause du pipeline
   */
  const pausePipeline = useCallback(() => {
    dispatch({ type: 'SET_RUNNING', running: false });
    dispatch({ type: 'ADD_WARNING', warning: 'Pipeline en pause' });
  }, []);

  /**
   * Reprise du pipeline
   */
  const resumePipeline = useCallback(() => {
    dispatch({ type: 'SET_RUNNING', running: true });
  }, []);

  /**
   * Soumission des choix utilisateur
   */
  const submitUserChoices = useCallback((phase: number, choices: any) => {
    dispatch({ type: 'SET_USER_CHOICES', phase, choices });
  }, []);

  /**
   * Procéder après validation utilisateur
   */
  const proceedAfterUserValidation = useCallback((phase: number) => {
    console.log(`✅ User validation completed for phase ${phase}, proceeding...`);

    // Remove pending validation
    const validationKey = `phase${phase}-user-action`;
    dispatch({ type: 'REMOVE_PENDING_VALIDATION', validation: validationKey });

    // Only advance to next phase if not the last phase
    if (phase < 5) {
      dispatch({ type: 'SET_PHASE', phase: phase + 1 });
    }
  }, []);

  /**
   * Continuer l'exécution de la phase actuelle après validation utilisateur
   */
  const continueCurrentPhase = useCallback(async (phase: number, payload?: any) => {
    console.log(`🔄 Continuing execution of phase ${phase} after user validation...`);

    // Remove pending validation
    const validationKey = `phase${phase}-user-action`;
    dispatch({ type: 'REMOVE_PENDING_VALIDATION', validation: validationKey });

    // Set loading state
    dispatch({ type: 'SET_LOADING', loading: true, message: 'Continuation de la phase...' });
    dispatch({ type: 'SET_RUNNING', running: true });

    try {
      await ensurePipelineInitialized();
      let result;

      if (phase === 0) {
        const phase0Data = getPhaseData(0);
        if (!phase0Data?.quickScanResult) {
          throw new Error('Phase 0 data not available for continuation');
        }

        // Vérifier si on a déjà un plan généré
        if (payload === 'execute-reorganization' && phase0Data.reorganizationPlan) {
          // Step 2->3: Exécuter le plan déjà généré
          console.log('🔄 Using continuePhase for Phase 0 Step 3 - Execute reorganization');
          result = await window.electronAPI.pipeline.continuePhase(phase, 3, phase0Data.quickScanResult);
        } else {
          // Step 1->2: Générer le plan
          console.log('🔄 Using continuePhase for Phase 0 Step 2 - Generate plan');
          result = await window.electronAPI.pipeline.continuePhase(phase, 2, phase0Data.quickScanResult);
        }
      } else if (phase === 1 && state.pendingUserActions[1]) {
        console.log('🔄 Continuing Phase 1 with duplicate resolution', payload);
        // Phase 1 reprend après gestion des doublons
        result = await window.electronAPI.pipeline.continuePhase(phase, 1, {
          userAction: payload,
          pendingState: getPhaseData(phase), // Utiliser les vraies données Phase 1
          phaseData: getPhaseData(phase)
        });
      } else if (phase === 2 && state.pendingUserActions[2]) {
        console.log('🔄 Continuing Phase 2 with user action', payload);
        result = await window.electronAPI.pipeline.continuePhase(phase, 2, {
          userAction: payload,
          pendingState: state.pendingUserActions[2]?.defaultValue?.input,
          phaseData: getPhaseData(phase)
        });
      } else if (phase === 3 && state.pendingUserActions[3]) {
        console.log('🔄 Continuing Phase 3 with structure selection', payload);
        result = await window.electronAPI.pipeline.continuePhase(phase, 2, {
          userAction: payload,
          pendingState: state.pendingUserActions[3]?.defaultValue?.pendingState,
          phaseData: getPhaseData(phase)
        });
      } else {
        const phaseData = getPhaseData(phase);
        if (!phaseData) {
          throw new Error(`No data available to continue phase ${phase}`);
        }
        result = await window.electronAPI.pipeline.continuePhase(phase, 1, {
          payload,
          phaseData
        });
      }

      if (result?.success) {
        dispatch({ type: 'SET_PHASE_DATA', phase, data: result.data });
        dispatch({ type: 'SET_LOADING', loading: false });
        console.log(`✅ Phase ${phase} continuation successful`);
      } else {
        throw new Error(result?.error || `Phase ${phase} continuation failed`);
      }

    } catch (error) {
      console.error(`❌ Error continuing phase ${phase}:`, error);

      const pipelineError: PipelineError = {
        phase,
        code: 'CONTINUATION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
        recoverable: true
      };

      dispatch({ type: 'ADD_ERROR', error: pipelineError });
      dispatch({ type: 'SET_LOADING', loading: false });
      onError?.(pipelineError);
    } finally {
      dispatch({ type: 'SET_RUNNING', running: false });
      dispatch({ type: 'CLEAR_PENDING_USER_ACTION', phase });
    }
  }, [ensurePipelineInitialized, getPhaseData, onError, state.pendingUserActions]);

  /**
   * Validation d'un step
   */
  const validateStep = useCallback(async (phase: number, step: number, data: any) => {
    const validationKey = `phase${phase}-step${step}`;
    dispatch({ type: 'ADD_PENDING_VALIDATION', validation: validationKey });

    try {
      // Validation logic here
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate validation

      dispatch({ type: 'REMOVE_PENDING_VALIDATION', validation: validationKey });

      return {
        validated: true,
        canProceed: true
      };
    } catch (error) {
      dispatch({ type: 'REMOVE_PENDING_VALIDATION', validation: validationKey });
      return {
        validated: false,
        canProceed: false,
        message: error instanceof Error ? error.message : 'Validation failed'
      };
    }
  }, []);

  /**
   * Récupération des données de phase courante
   */
  /**
   * Récupération des données de phase depuis le backend
   */
  const loadPhaseDataFromBackend = useCallback(async (phase: number) => {
    try {
      const data = await window.electronAPI?.pipeline?.getPhaseData?.(phase);
      if (data) {
        dispatch({ type: 'SET_PHASE_DATA', phase, data });
      }
      return data;
    } catch (error) {
      console.error(`Erreur lors du chargement des données phase ${phase}:`, error);
      return null;
    }
  }, []);

  /**
   * Récupération des choix utilisateur d'une phase
   */
  /**
   * Helpers de navigation
   */
  const canNavigateBack = useCallback(() => {
    return state.currentPhase > 0 && !state.isRunning;
  }, [state.currentPhase, state.isRunning]);

  const canNavigateNext = useCallback(() => {
    return state.currentPhase < 5 && !state.isRunning && state.pendingValidations.length === 0;
  }, [state.currentPhase, state.isRunning, state.pendingValidations]);

  const canStop = useCallback(() => {
    return finalConfig.features.allowStop;
  }, [finalConfig.features.allowStop]);

  const canPause = useCallback(() => {
    return finalConfig.features.allowPause && state.isRunning;
  }, [finalConfig.features.allowPause, state.isRunning]);

  /**
   * Context value
   */
  const contextValue: PipelineV6ContextType = {
    state,
    config: finalConfig,
    goToPhase,
    executePhase,
    stopPipeline,
    pausePipeline,
    resumePipeline,
    submitUserChoices,
    proceedAfterUserValidation,
    continueCurrentPhase,
    validateStep,
    getCurrentPhaseData,
    getPhaseData,
    loadPhaseDataFromBackend,
    getUserChoices,
    canNavigateBack,
    canNavigateNext,
    canStop,
    canPause
  };

  return (
    <PipelineV6Context.Provider value={contextValue}>
      {children}
    </PipelineV6Context.Provider>
  );
}

/**
 * Hook pour utiliser le context
 */
export function usePipelineV6Context(): PipelineV6ContextType {
  const context = useContext(PipelineV6Context);
  if (!context) {
    throw new Error('usePipelineV6Context must be used within a PipelineV6Provider');
  }
  return context;
}
