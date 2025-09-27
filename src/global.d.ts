declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

import type { ElectronAPI } from '../shared/interfaces/ElectronAPI';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
