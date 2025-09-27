/**
 * Pipeline V6 - Contrats des Steps
 * Interface commune que TOUS les steps doivent implémenter
 */

/**
 * Callback de progression
 */
export type ProgressCallback = (progress: number, message?: string) => void;

/**
 * Interface principale pour tous les steps
 */
export interface StepExecutor<TInput, TOutput> {
  execute(input: TInput, onProgress?: ProgressCallback): Promise<StepResult<TOutput>>;
  validate(input: TInput): { valid: boolean; errors: string[] };
  getName(): string;
  getDescription(): string;
  estimateTime(input: TInput): number;
  canRetry(): boolean;
}

/**
 * Résultat de l'exécution d'un step
 */
export interface StepResult<T> {
  success: boolean;
  data?: T;
  error?: StepError;
  progress?: number;
  canProceed: boolean;
  userActionRequired?: UserActionRequired;
  metrics?: StepMetrics;
}

/**
 * Erreur lors de l'exécution
 */
export interface StepError {
  code: string;
  message: string;
  details?: any;
  recoverable?: boolean; // Ajouté pour compatibilité PackDetectorV6
  cause?: string;
  suggestedAction?: string;
}

/**
 * Métriques de performance
 */
export interface StepMetrics {
  startTime: number;
  endTime: number;
  itemsProcessed: number;
  processingSpeed: number;
  duration?: number; // Ajouté pour compatibilité PackDetectorV6
  memoryUsed?: number;
  cacheHits?: number;
}

/**
 * Action utilisateur requise
 */
export interface UserActionRequired {
  type: 'choice' | 'confirmation' | 'input' | 'quarantine';
  message: string;
  options?: string[];
  defaultValue?: any;
  title?: string;
  required?: boolean;
  canSkip?: boolean;
}

/**
 * Interface pour les contrôleurs de phase
 */
export interface PhaseController<TInput = any, TOutput = any> {
  getName(): string;
  getDescription(): string;
  execute(input: TInput, onProgress?: ProgressCallback): Promise<StepResult<TOutput>>;
  validate(input: TInput): { valid: boolean; errors: string[] };
  canRetry(): boolean;
  estimateTime(input: TInput): number;
}

/**
 * Résultat d'exécution de phase
 */
export interface PhaseExecutionResult {
  phaseNumber: number;
  phaseName: string;
  success: boolean;
  data?: any;
  error?: StepError;
  userActionRequired?: UserActionRequired;
  metrics?: StepMetrics;
}

/**
 * Résultat de validation
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
  canProceedWithWarnings?: boolean; // Ajouté pour compatibilité PackDetectorV6
  suggestions?: string[];
}