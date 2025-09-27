/**
 * Pipeline V6 - Contrôleur principal
 * Orchestrateur qui coordonne toutes les phases du pipeline
 */

import { PipelineState, PhaseDataMap, PhaseResult, PipelineError } from '@shared/interfaces/PipelineTypes';
import { PhaseController, PhaseExecutionResult } from '@shared/interfaces/StepContracts';
import { DetectionConfig, ReorganizationConfig } from '@shared/interfaces/BusinessTypes';

/**
 * Configuration du pipeline
 */
export interface PipelineConfig {
  detection?: DetectionConfig;
  reorganization?: ReorganizationConfig;
  enableLogging?: boolean;
  enableMetrics?: boolean;
  enableBackup?: boolean;
}

/**
 * Contrôleur principal du Pipeline V6
 */
export class PipelineController {
  private state: PipelineState;
  private phaseControllers: Map<number, PhaseController> = new Map();
  private config: PipelineConfig;
  private eventCallbacks: Map<string, Function[]> = new Map();

  constructor(sourcePath?: string, config: PipelineConfig = {}) {
    this.config = {
      enableLogging: true,
      enableMetrics: true,
      enableBackup: true,
      ...config
    };

    if (sourcePath) {
      this.initializeState(sourcePath);
    }
    this.registerPhaseControllers();
    this.setupEventHandlers();
  }

  /**
   * Initialise l'état du pipeline
   */
  private initializeState(sourcePath: string): void {
    this.state = {
      currentPhase: 0,
      phaseData: {},
      errors: [],
      startTime: Date.now(),
      sourcePath
    };
  }

  /**
   * Initialise le pipeline avec un sourcePath (appelé après sélection utilisateur)
   */
  public initialize(sourcePath: string): void {
    this.initializeState(sourcePath);
    console.log(`✅ Pipeline V6 initialized with sourcePath: ${sourcePath}`);
  }

  /**
   * Enregistre les contrôleurs de phase
   * Note: Ils seront importés dynamiquement pour éviter les dépendances circulaires
   */
  private async registerPhaseControllers(): Promise<void> {
    // Les contrôleurs seront enregistrés dynamiquement lors de l'exécution
    // pour éviter les imports circulaires
  }

  /**
   * Configure les gestionnaires d'événements
   */
  private setupEventHandlers(): void {
    this.on('phase:start', (phase: number) => {
      if (this.config.enableLogging) {
        console.log(`🚀 Phase ${phase} démarrée`);
      }
    });

    this.on('phase:complete', (phase: number, result: PhaseResult) => {
      if (this.config.enableLogging) {
        console.log(`✅ Phase ${phase} terminée en ${result.duration}ms`);
      }
    });

    this.on('phase:error', (phase: number, error: PipelineError) => {
      if (this.config.enableLogging) {
        console.error(`❌ Phase ${phase} échouée: ${error.message}`);
      }
    });
  }

  /**
   * Exécute une phase spécifique
   */
  async executePhase(phaseNumber: number, additionalData?: any): Promise<PhaseResult> {
    console.log(`🚀 Starting executePhase ${phaseNumber}`);

    if (!this.canExecutePhase(phaseNumber)) {
      throw new Error(`Cannot execute phase ${phaseNumber}. Prerequisites not met.`);
    }

    this.emit('phase:start', phaseNumber);
    const startTime = Date.now();

    try {
      // Charger le contrôleur de phase dynamiquement
      console.log(`📦 Loading controller for phase ${phaseNumber}`);
      const controller = await this.getPhaseController(phaseNumber);
      console.log(`✅ Controller loaded for phase ${phaseNumber}: ${controller.getName()}`);

      // Préparer les données d'entrée
      console.log(`📝 Preparing input data for phase ${phaseNumber}`);
      const baseInputData = this.getPhaseInput(phaseNumber);

      // Fusionner avec les données additionnelles si fournies
      const inputData = additionalData ? { ...baseInputData, ...additionalData } : baseInputData;
      console.log(`✅ Input data prepared:`, inputData);
      
      // Exécuter la phase
      console.log(`⚙️  Starting execution of phase ${phaseNumber}`);
      const executionResult = await controller.execute(inputData, (progress, message) => {
        console.log(`📊 Phase ${phaseNumber} progress: ${progress}% - ${message}`);
        this.emit('phase:progress', phaseNumber, progress, message);
      });
      console.log(`🎯 Phase ${phaseNumber} execution completed:`, executionResult.success);

      // Traiter le résultat
      const result: PhaseResult = {
        phase: phaseNumber,
        success: executionResult.success,
        data: executionResult.data,
        errors: [],
        duration: Date.now() - startTime,
        canContinue: executionResult.success && !executionResult.userActionRequired,
        requiresUserAction: !!executionResult.userActionRequired
      };

      if (!executionResult.success && executionResult.error) {
        const error: PipelineError = {
          phase: phaseNumber,
          step: 0, // Default step number
          code: 'PHASE_EXECUTION_ERROR',
          message: executionResult.error.message,
          timestamp: Date.now(),
          recoverable: executionResult.error.recoverable || true,
          details: executionResult.error.details
        };
        
        result.errors.push(error);
        this.state.errors.push(error);
        this.emit('phase:error', phaseNumber, error);
      } else {
        // Sauvegarder les données de la phase
        this.updateState(phaseNumber, result.data);

        // Si action utilisateur requise, émettre un événement différent
        if (executionResult.userActionRequired) {
          console.log('🔔 PipelineController emitting phase:user-action-required for phase', phaseNumber);
          this.emit('phase:user-action-required', phaseNumber, {
            ...result,
            userActionRequired: executionResult.userActionRequired
          });
        } else {
          console.log('🔔 PipelineController emitting phase:complete for phase', phaseNumber);
          this.emit('phase:complete', phaseNumber, result);
        }
      }

      return result;

    } catch (error) {
      const pipelineError: PipelineError = {
        phase: phaseNumber,
        code: 'PHASE_CONTROLLER_ERROR',
        message: error.message,
        timestamp: Date.now(),
        recoverable: false,
        details: error
      };

      this.state.errors.push(pipelineError);
      this.emit('phase:error', phaseNumber, pipelineError);

      return {
        phase: phaseNumber,
        success: false,
        data: null,
        errors: [pipelineError],
        duration: Date.now() - startTime,
        canContinue: false,
        requiresUserAction: false
      };
    }
  }

  /**
   * Reprend l'exécution d'une phase après une action utilisateur
   */
  async resumeAfterUserAction(phaseNumber: number, userChoice: any, previousState?: any): Promise<PhaseResult> {
    console.log(`🔄 Resuming phase ${phaseNumber} after user action`);

    if (!this.canExecutePhase(phaseNumber)) {
      throw new Error(`Cannot resume phase ${phaseNumber}. Prerequisites not met.`);
    }

    this.emit('phase:resume', phaseNumber);
    const startTime = Date.now();

    try {
      // Charger le contrôleur de phase
      const controller = await this.getPhaseController(phaseNumber);

      // Vérifier si le contrôleur a une méthode resumeAfterUserAction
      if (typeof (controller as any).resumeAfterUserAction === 'function') {
        console.log(`🔄 Using resumeAfterUserAction for phase ${phaseNumber}`);

        // Utiliser directement previousState (maintenant c'est les bonnes données Phase 1)
        console.log('🔧 DEBUG PipelineController.resumeAfterUserAction - previousState keys:', Object.keys(previousState || {}));
        const state = previousState;

        const executionResult = await (controller as any).resumeAfterUserAction(
          state,
          userChoice,
          (progress: number, message: string) => {
            console.log(`📊 Phase ${phaseNumber} resume progress: ${progress}% - ${message}`);
            this.emit('phase:progress', phaseNumber, progress, message);
          }
        );

        // Traiter le résultat
        const result: PhaseResult = {
          phase: phaseNumber,
          success: executionResult.success,
          data: executionResult.data,
          errors: [],
          duration: Date.now() - startTime,
          canContinue: executionResult.success && !executionResult.userActionRequired,
          requiresUserAction: !!executionResult.userActionRequired
        };

        if (executionResult.success) {
          // Sauvegarder les données de la phase
          this.updateState(phaseNumber, result.data);
          this.emit('phase:complete', phaseNumber, result);
        } else if (executionResult.error) {
          const error: PipelineError = {
            phase: phaseNumber,
            step: 0,
            code: 'PHASE_RESUME_ERROR',
            message: executionResult.error.message,
            timestamp: Date.now(),
            recoverable: true
          };
          result.errors.push(error);
          this.emit('phase:error', phaseNumber, error);
        }

        return result;
      } else {
        // Fallback: re-exécuter la phase normalement avec userChoice
        console.log(`⚠️  Phase ${phaseNumber} controller doesn't have resumeAfterUserAction, falling back to executePhase`);
        return await this.executePhase(phaseNumber, { userChoice, previousState });
      }

    } catch (error) {
      const pipelineError: PipelineError = {
        phase: phaseNumber,
        step: 0,
        code: 'PHASE_RESUME_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error during phase resume',
        timestamp: Date.now(),
        recoverable: true
      };

      this.emit('phase:error', phaseNumber, pipelineError);

      return {
        phase: phaseNumber,
        success: false,
        data: null,
        errors: [pipelineError],
        duration: Date.now() - startTime,
        canContinue: false,
        requiresUserAction: false
      };
    }
  }

  /**
   * Charge dynamiquement un contrôleur de phase
   */
  private async getPhaseController(phaseNumber: number): Promise<PhaseController> {
    if (this.phaseControllers.has(phaseNumber)) {
      return this.phaseControllers.get(phaseNumber)!;
    }

    let controller: PhaseController;

    switch (phaseNumber) {
      case 0:
        const { Phase0Controller } = await import('./phases/phase0-preparation/Phase0Controller');
        controller = new Phase0Controller();
        break;
      
      case 1:
        const { Phase1Controller } = await import('./phases/phase1-discovery/Phase1Controller');
        controller = new Phase1Controller();
        break;
      
      case 2:
        const { Phase2Controller } = await import('./phases/phase2-classification/Phase2Controller');
        controller = new Phase2Controller();
        break;
      
      case 3:
        const { Phase3Controller } = await import('./phases/phase3-matrix/Phase3Controller');
        controller = new Phase3Controller();
        break;

      case 4:
        const { Phase4Controller } = await import('./phases/phase4-organization/Phase4Controller');
        controller = new Phase4Controller();
        break;

      case 5:
        const { Phase5Controller } = await import('./phases/phase5-validation/Phase5Controller');
        controller = new Phase5Controller();
        break;
      
      default:
        throw new Error(`Unknown phase number: ${phaseNumber}`);
    }

    this.phaseControllers.set(phaseNumber, controller);
    return controller;
  }

  /**
   * Vérifie si une phase peut être exécutée
   */
  canExecutePhase(phaseNumber: number): boolean {
    // Phase 0 peut toujours être exécutée
    if (phaseNumber === 0) {
      return true;
    }

    // Les autres phases nécessitent que la phase précédente soit complète
    const previousPhase = phaseNumber - 1;
    return this.isPhaseComplete(previousPhase);
  }

  /**
   * Vérifie si une phase est complète
   */
  isPhaseComplete(phaseNumber: number): boolean {
    return this.state.phaseData[`phase${phaseNumber}` as keyof PhaseDataMap] !== undefined;
  }

  /**
   * Obtient les données d'entrée pour une phase
   */
  private getPhaseInput(phaseNumber: number): any {
    switch (phaseNumber) {
      case 0:
        return {
          sourcePath: this.state.sourcePath,
          config: this.config
        };
      
      case 1:
        // Phase1Controller attend Phase0Data complet selon l'interface
        return this.state.phaseData.phase0;
      
      case 2:
        // Phase2Controller attend Phase1Data complet selon l'interface
        return this.state.phaseData.phase1;
      
      case 3:
        // Phase3Controller attend Phase2Data complet selon l'interface
        return this.state.phaseData.phase2;
      
      case 4:
        const phase3Data = this.state.phaseData.phase3;
        return {
          ...(phase3Data || {}),
          structureChoice: phase3Data?.userChoice,
          duplicatesResolution: phase3Data?.duplicatesResult,
          workingPath: phase3Data?.workingPath
            || this.state.phaseData.phase1?.workingPath
            || this.state.sourcePath,
          sourcePath: this.state.sourcePath,
          config: this.config
        };

      case 5:
        return {
          targetPath: this.state.phaseData.phase4?.targetPath,
          organizationResult: this.state.phaseData.phase4?.organizationResult,
          allPhaseData: this.state.phaseData,
          config: this.config
        };
      
      default:
        return {};
    }
  }

  /**
   * Met à jour l'état avec les données d'une phase
   */
  private updateState(phaseNumber: number, data: any): void {
    const phaseKey = `phase${phaseNumber}` as keyof PhaseDataMap;
    this.state.phaseData[phaseKey] = data as any;
    this.state.currentPhase = Math.max(this.state.currentPhase, phaseNumber);

    // Créer un checkpoint pour reprise
    this.state.lastCheckpoint = {
      phase: phaseNumber,
      step: 0,
      timestamp: Date.now(),
      data,
      canResume: true
    };
  }

  /**
   * Exécute le pipeline complet
   */
  async runFullPipeline(): Promise<{ success: boolean; results: PhaseResult[] }> {
    const results: PhaseResult[] = [];
    
    for (let phase = 0; phase <= 5; phase++) {
      const result = await this.executePhase(phase);
      results.push(result);
      
      if (!result.success || !result.canContinue) {
        return { success: false, results };
      }
      
      if (result.requiresUserAction) {
        // Pause pour action utilisateur
        this.emit('pipeline:paused', phase, result.data);
        return { success: true, results }; // Succès partiel
      }
    }
    
    this.emit('pipeline:complete', results);
    return { success: true, results };
  }

  /**
   * Reprend le pipeline depuis le dernier checkpoint
   */
  async resumePipeline(): Promise<{ success: boolean; results: PhaseResult[] }> {
    if (!this.state.lastCheckpoint?.canResume) {
      throw new Error('No resumable checkpoint available');
    }

    const startPhase = this.state.lastCheckpoint.phase + 1;
    const results: PhaseResult[] = [];

    for (let phase = startPhase; phase <= 5; phase++) {
      const result = await this.executePhase(phase);
      results.push(result);
      
      if (!result.success || !result.canContinue) {
        return { success: false, results };
      }
    }

    return { success: true, results };
  }

  /**
   * Obtient l'état actuel du pipeline
   */
  getState(): Readonly<PipelineState> {
    return { ...this.state };
  }

  /**
   * Obtient les données de toutes les phases
   */
  getAllPhasesData(): Readonly<PhaseDataMap> {
    return { ...this.state.phaseData };
  }

  /**
   * Obtient les données d'une phase spécifique
   */
  getPhaseData<T>(phaseNumber: number): T | undefined {
    const phaseKey = `phase${phaseNumber}` as keyof PhaseDataMap;
    return this.state.phaseData[phaseKey] as T;
  }

  /**
   * Reset le pipeline
   */
  reset(): void {
    this.state.currentPhase = 0;
    this.state.phaseData = {};
    this.state.errors = [];
    this.state.lastCheckpoint = undefined;
    this.phaseControllers.clear();
  }

  /**
   * Gestionnaire d'événements
   */
  on(event: string, callback: Function): void {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, []);
    }
    this.eventCallbacks.get(event)!.push(callback);
  }

  /**
   * Émet un événement
   */
  private emit(event: string, ...args: any[]): void {
    const callbacks = this.eventCallbacks.get(event) || [];
    callbacks.forEach(callback => {
      try {
        callback(...args);
      } catch (error) {
        console.error(`Error in event callback for ${event}:`, error);
      }
    });
  }

  /**
   * Nettoie les ressources
   */
  async cleanup(): Promise<void> {
    this.phaseControllers.clear();
    this.eventCallbacks.clear();
  }
}
