/**
 * Pipeline V6 - Barrel export pour interfaces partagées
 * Point d'entrée unique pour tous les types communs
 */

// Types de pipeline (phases, états)
export * from './PipelineTypes';

// Types métier (packs, enriched packs)
export * from './BusinessTypes';

// Contrats d'exécution (steps)
export * from './StepContracts';

// Export de types spécifiques pour faciliter l'import
export type {
  // Pipeline
  PipelineState,
  PhaseDataMap,
  Phase0Data,
  Phase1Data,
  Phase2Data,
  Phase3Data,
  Phase4Data,
  Phase5Data
} from './PipelineTypes';

export type {
  // Business
  PackType,
  DetectedPackV6,
  EnrichedPack
} from './BusinessTypes';

export type {
  // Contracts
  StepExecutor,
  StepResult,
  ValidationResult,
  ProgressCallback,
  UserActionRequired,
  StepMetrics,
  StepError
} from './StepContracts';