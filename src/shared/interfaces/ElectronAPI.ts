export interface PipelineBridgeAPI {
  initialize: (sourcePath: string) => Promise<any>;
  executePhase: (phase: number, data: any) => Promise<any>;
  continuePhase: (phase: number, fromStep: number, data: any) => Promise<any>;
  getPhaseData: (phase: number) => Promise<any>;
  getState: () => Promise<any>;
  stop: () => Promise<{ success: boolean } | void>;
}

export interface PipelineEventPayload {
  phase: number;
  result?: any;
  error?: any;
  progress?: number;
  message?: string;
}

export interface ElectronAPI {
  selectDirectory: () => Promise<any>;
  openFolder: (folderPath: string) => Promise<any>;
  pipeline: PipelineBridgeAPI;
  onPipelinePhaseStart?: (callback: (event: unknown, data: PipelineEventPayload) => void) => void;
  onPipelinePhaseComplete?: (callback: (event: unknown, data: PipelineEventPayload) => void) => void;
  onPipelinePhaseUserActionRequired?: (callback: (event: unknown, data: PipelineEventPayload) => void) => void;
  onPipelinePhaseError?: (callback: (event: unknown, data: PipelineEventPayload) => void) => void;
  onPipelinePhaseProgress?: (callback: (event: unknown, data: PipelineEventPayload) => void) => void;
  removePipelineListeners?: () => void;
}
