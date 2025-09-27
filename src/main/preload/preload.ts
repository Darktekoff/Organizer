import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI } from '@shared/interfaces/ElectronAPI';

// Define the API that will be available to the renderer
const electronAPI: ElectronAPI = {
  // File system operations
  selectDirectory: () => ipcRenderer.invoke('fs:select-directory'),
  openFolder: (folderPath: string) => ipcRenderer.invoke('fs:open-folder', folderPath),

  // Pipeline V6 operations
  pipeline: {
    initialize: (sourcePath: string) => ipcRenderer.invoke('pipeline:initialize', sourcePath),
    executePhase: (phase: number, data: any) => ipcRenderer.invoke('pipeline:execute-phase', phase, data),
    continuePhase: (phase: number, fromStep: number, data: any) => ipcRenderer.invoke('pipeline:continue-phase', phase, fromStep, data),
    getPhaseData: (phase: number) => ipcRenderer.invoke('pipeline:get-phase-data', phase),
    getState: () => ipcRenderer.invoke('pipeline:get-state'),
    stop: () => ipcRenderer.invoke('pipeline:stop'),
  },

  // Event listeners for pipeline updates
  onPipelinePhaseStart: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('pipeline:phase-start', callback);
  },

  onPipelinePhaseComplete: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('pipeline:phase-complete', callback);
  },

  onPipelinePhaseUserActionRequired: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('pipeline:phase-user-action-required', callback);
  },

  onPipelinePhaseError: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('pipeline:phase-error', callback);
  },

  onPipelinePhaseProgress: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('pipeline:phase-progress', callback);
  },

  // Cleanup listeners
  removePipelineListeners: () => {
    ipcRenderer.removeAllListeners('pipeline:phase-start');
    ipcRenderer.removeAllListeners('pipeline:phase-complete');
    ipcRenderer.removeAllListeners('pipeline:phase-user-action-required');
    ipcRenderer.removeAllListeners('pipeline:phase-error');
    ipcRenderer.removeAllListeners('pipeline:phase-progress');
  }
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

console.log('🔌 Preload script loaded for Audio Organizer V6');
