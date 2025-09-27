/**
 * Pipeline V6 - Types UI Frontend
 * Types spécifiques à l'interface utilisateur
 */

import {
  Phase0Data,
  Phase1Data,
  Phase2Data,
  Phase3Data,
  Phase4Data,
  Phase5Data,
  PipelineError
} from '@shared/interfaces/PipelineTypes';

/**
 * État global de l'interface Pipeline V6
 */
export interface UIState {
  // Navigation
  currentPhase: number; // 0-5
  isRunning: boolean;
  canNavigateBack: boolean;
  canNavigateNext: boolean;

  // Données des phases
  phase0Data?: Phase0Data;
  phase1Data?: Phase1Data;
  phase2Data?: Phase2Data;
  phase3Data?: Phase3Data;
  phase4Data?: Phase4Data;
  phase5Data?: Phase5Data;

  // État global
  sourcePath: string;
  workingPath?: string;
  errors: PipelineError[];
  warnings: string[];

  // UI State
  loading: boolean;
  loadingMessage?: string;
  progress?: ProgressState;

  // User interactions
  userChoices: UserChoicesMap;
  pendingValidations: string[];
  pendingUserActions: Record<number, any>;
}

/**
 * Map des choix utilisateur par phase
 */
export interface UserChoicesMap {
  phase0?: Phase0UserChoices;
  phase1?: Phase1UserChoices;
  phase2?: Phase2UserChoices;
  phase3?: Phase3UserChoices;
  phase4?: Phase4UserChoices;
  phase5?: Phase5UserChoices;
}

/**
 * Choix utilisateur Phase 0 - Preparation
 */
export interface Phase0UserChoices {
  validateQuickScan: boolean;
  approveReorganizationPlan: boolean;
  reorganizationApproved: boolean;
}

/**
 * Choix utilisateur Phase 1 - Discovery
 */
export interface Phase1UserChoices {
  validateDeepAnalysis: boolean;
  acknowledgeIndexingResults: boolean;
  duplicateAction?: 'keep' | 'merge' | 'delete';
  selectedDuplicates?: string[];
}

/**
 * Choix utilisateur Phase 2 - Classification
 */
export interface Phase2UserChoices {
  validateAutoClassification: boolean;
  quarantineResolutions: Map<string, string>; // packId -> selectedStyle
  allQuarantineResolved: boolean;
}

/**
 * Choix utilisateur Phase 3 - Matrix & Structure
 */
export interface Phase3UserChoices {
  selectedStructureId?: string;
  duplicateStrategy: 'merge' | 'keep-best' | 'keep-all' | 'manual';
  duplicateResolutions: Map<string, string>; // groupId -> resolution
  matrixValidated: boolean;
}

/**
 * Choix utilisateur Phase 4 - Organization
 */
export interface Phase4UserChoices {
  confirmOrganization: boolean;
  pauseRequested: boolean;
  stopRequested: boolean;
}

/**
 * Choix utilisateur Phase 5 - Final Validation
 */
export interface Phase5UserChoices {
  validateFinalResults: boolean;
  selectedReportFormats: ('json' | 'markdown' | 'html')[];
  backupConfirmed: boolean;
  rollbackRequested?: boolean;
}

/**
 * État de progression globale
 */
export interface ProgressState {
  phase: number;
  step: number;
  totalSteps: number;
  percentage: number;
  message: string;
  estimatedTimeRemaining?: number;
  currentOperation?: string;
}

/**
 * Props standardisées pour chaque PhaseUI
 */
export interface PhaseUIProps<T = any> {
  phaseNumber?: number; // 0-5
  data?: T; // Phase0Data, Phase1Data, etc.
  userChoices?: any; // Phase-specific user choices
  onComplete?: (result: any, userChoices: any) => void;
  onBack?: () => void;
  onStop?: () => void;
  onPause?: () => void;
  isLoading?: boolean;
  loadingMessage?: string;
  progress?: ProgressState;
  onProceed?: () => void;
  onContinue?: (payload?: any) => Promise<void> | void;

  // Pour compatibilité avec les composants existants
  phaseData?: {
    data?: T;
    isRunning?: boolean;
    currentOperation?: string;
    error?: string;
    pendingAction?: any;
  };
  onPhaseUpdate?: (updates: Partial<T>) => void;
  onNavigate?: (direction: 'next' | 'previous' | 'complete' | 'restart') => void;
  onUserChoice?: (choice: string, value: any) => void;
}

/**
 * État d'un step individuel
 */
export interface StepUIState {
  stepNumber: number;
  stepName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  progress: number; // 0-100
  message?: string;
  estimatedTime?: number;
  startTime?: number;
  endTime?: number;
  errors: string[];
  warnings: string[];
}

/**
 * Props pour les composants Step
 */
export interface StepUIProps<T = any> {
  stepNumber: number;
  stepName: string;
  data: T;
  onComplete: (result: any) => void;
  onBack?: () => void;
  onPause?: () => void;
  isActive: boolean;
  isCompleted: boolean;
  estimatedTime?: string;
}

/**
 * Configuration d'un step
 */
export interface StepConfig {
  id: number;
  name: string;
  description: string;
  estimatedTime: string;
  component: React.ComponentType<StepUIProps>;
  canSkip: boolean;
  requiresUserAction: boolean;
}

/**
 * Configuration d'une phase
 */
export interface PhaseConfig {
  phaseNumber: number;
  phaseName: string;
  description: string;
  icon: string;
  color: string;
  steps: StepConfig[];
  estimatedTotalTime: string;
  canSkip: boolean;
}

/**
 * Résultat de validation utilisateur
 */
export interface UserValidationResult {
  validated: boolean;
  choices?: Record<string, any>;
  message?: string;
  canProceed: boolean;
}

/**
 * État de navigation
 */
export interface NavigationState {
  canGoBack: boolean;
  canGoNext: boolean;
  canStop: boolean;
  canPause: boolean;
  nextPhase?: number;
  previousPhase?: number;
  completedPhases: number[];
}

/**
 * Props pour les composants de navigation
 */
export interface NavigationProps {
  currentPhase: number;
  totalPhases: number;
  navigationState: NavigationState;
  onNavigate: (phase: number) => void;
  onStop: () => void;
  onPause?: () => void;
}

/**
 * Action utilisateur générique
 */
export interface UserAction {
  type: 'validate' | 'choose' | 'confirm' | 'cancel' | 'skip';
  phase: number;
  step?: number;
  data?: any;
  timestamp: number;
}

/**
 * Callbacks pour les événements UI
 */
export interface UICallbacks {
  onPhaseComplete: (phase: number, result: any, userChoices: any) => void;
  onPhaseStart: (phase: number) => void;
  onStepComplete: (phase: number, step: number, result: any) => void;
  onUserAction: (action: UserAction) => void;
  onError: (error: PipelineError) => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
}

/**
 * Configuration globale du Pipeline V6 UI
 */
export interface PipelineV6Config {
  phases: PhaseConfig[];
  theme: {
    primaryColor: string;
    secondaryColor: string;
    errorColor: string;
    warningColor: string;
    successColor: string;
  };
  features: {
    allowPause: boolean;
    allowStop: boolean;
    allowBackNavigation: boolean;
    persistState: boolean;
    showProgress: boolean;
    showTimeEstimates: boolean;
  };
}

/**
 * Context type pour le Provider
 */
export interface PipelineV6ContextType {
  // State
  state: UIState;
  config: PipelineV6Config;

  // Actions
  goToPhase: (phase: number) => void;
  executePhase: (phase: number) => Promise<void>;
  stopPipeline: () => void;
  pausePipeline: () => void;
  resumePipeline: () => void;

  // User interactions
  submitUserChoices: (phase: number, choices: any) => void;
  proceedAfterUserValidation: (phase: number) => void;
  continueCurrentPhase: (phase: number, payload?: any) => Promise<void>;
  validateStep: (phase: number, step: number, data: any) => Promise<UserValidationResult>;

  // Data getters
  getCurrentPhaseData: () => any;
  getPhaseData: (phase: number) => any;
  loadPhaseDataFromBackend: (phase: number) => Promise<any>;
  getUserChoices: (phase: number) => any;

  // Navigation helpers
  canNavigateBack: () => boolean;
  canNavigateNext: () => boolean;
  canStop: () => boolean;
  canPause: () => boolean;
}

/**
 * Props pour le PipelineV6Provider
 */
export interface PipelineV6ProviderProps {
  children: React.ReactNode;
  sourcePath?: string;
  initialConfig?: {
    libraryPath?: string;
    mode?: 'quick' | 'advanced' | 'custom';
    previousResults?: any;
  };
  config?: Partial<PipelineV6Config>;
  onComplete?: (result: any) => void;
  onError?: (error: PipelineError) => void;
  onCancel?: () => void;
}

/**
 * Type pour les résultats de phase
 */
export type PhaseResult<T = any> = {
  success: boolean;
  data: T;
  userChoices: any;
  errors: PipelineError[];
  warnings: string[];
  duration: number;
  canContinue: boolean;
};

/**
 * Événements émis par le Pipeline
 */
export interface PipelineEvents {
  'phase-start': { phase: number };
  'phase-complete': { phase: number; result: PhaseResult };
  'phase-error': { phase: number; error: PipelineError };
  'step-start': { phase: number; step: number };
  'step-complete': { phase: number; step: number; result: any };
  'step-error': { phase: number; step: number; error: PipelineError };
  'user-action': { action: UserAction };
  'pipeline-complete': { result: any };
  'pipeline-error': { error: PipelineError };
  'pipeline-cancelled': {};
}

/**
 * Hook return type pour usePipelineV6
 */
export interface UsePipelineV6Return {
  // State
  state: UIState;
  currentPhase: number;
  isRunning: boolean;
  loading: boolean;

  // Actions
  startPipeline: (sourcePath: string) => Promise<void>;
  goToPhase: (phase: number) => void;
  executePhase: (phase: number) => Promise<PhaseResult>;
  stopPipeline: () => void;
  pausePipeline: () => void;
  resumePipeline: () => void;
  continueCurrentPhase: (phase: number, payload?: any) => Promise<void>;

  // Data
  getCurrentPhaseData: () => any;
  getPhaseData: (phase: number) => any;
  submitUserChoices: (phase: number, choices: any) => void;
  proceedAfterUserValidation: (phase: number) => void;

  // Navigation
  canNavigateBack: boolean;
  canNavigateNext: boolean;
  navigationState: NavigationState;

  // Events
  on: (event: keyof PipelineEvents, callback: (data: any) => void) => void;
  off: (event: keyof PipelineEvents, callback: (data: any) => void) => void;
}
