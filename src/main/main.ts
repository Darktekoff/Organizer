import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

// Import Pipeline V6 Controller
import { PipelineController } from './services/pipeline/PipelineController';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let mainWindow: BrowserWindow;
let pipelineController: PipelineController;
let pipelineEventsRegistered = false;

const registerPipelineEventForwarders = () => {
  if (!pipelineController || pipelineEventsRegistered) {
    return;
  }

  pipelineController.on('phase:start', (phase: number) => {
    mainWindow.webContents.send('pipeline:phase-start', { phase });
  });

  pipelineController.on('phase:complete', (phase: number, result: any) => {
    mainWindow.webContents.send('pipeline:phase-complete', { phase, result });
  });

  pipelineController.on('phase:user-action-required', (phase: number, result: any) => {
    console.log('📡 Main process forwarding phase:user-action-required to renderer for phase', phase);
    mainWindow.webContents.send('pipeline:phase-user-action-required', { phase, result });
  });

  pipelineController.on('phase:error', (phase: number, error: any) => {
    mainWindow.webContents.send('pipeline:phase-error', { phase, error });
  });

  pipelineController.on('phase:progress', (phase: number, progress: number, message: string) => {
    mainWindow.webContents.send('pipeline:phase-progress', { phase, progress, message });
  });

  pipelineEventsRegistered = true;
};

// Function to create main window
const createWindow = (): void => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    height: 900,
    width: 1400,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'Audio Organizer V6',
    icon: undefined, // Pas d'icône pour l'instant
    resizable: true,
    minimizable: true,
    maximizable: true,
    closable: true,
  });

  // Load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open the DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
};

// Initialize Pipeline V6
const initializePipeline = (): void => {
  try {
    pipelineController = new PipelineController();
    pipelineEventsRegistered = false;
    registerPipelineEventForwarders();
    console.log('✅ Pipeline V6 Controller initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Pipeline V6 Controller:', error);
  }
};

// App event listeners
app.whenReady().then(() => {
  createWindow();
  initializePipeline();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers for Pipeline V6
ipcMain.handle('pipeline:initialize', async (event, sourcePath: string) => {
  try {
    if (!pipelineController) {
      throw new Error('Pipeline Controller not created');
    }
    pipelineController.initialize(sourcePath);
    registerPipelineEventForwarders();

    return { success: true, message: 'Pipeline initialized successfully' };
  } catch (error) {
    console.error('Error initializing pipeline:', error);
    throw error;
  }
});

ipcMain.handle('pipeline:execute-phase', async (event, phase: number, data: any) => {
  try {
    if (!pipelineController) {
      throw new Error('Pipeline not initialized');
    }
    return await pipelineController.executePhase(phase, data);
  } catch (error) {
    console.error(`Error executing phase ${phase}:`, error);
    throw error;
  }
});

ipcMain.handle('pipeline:get-phase-data', async (event, phase: number) => {
  try {
    if (!pipelineController) {
      throw new Error('Pipeline not initialized');
    }
    return await pipelineController.getPhaseData(phase);
  } catch (error) {
    console.error(`Error getting phase ${phase} data:`, error);
    throw error;
  }
});

ipcMain.handle('pipeline:continue-phase', async (event, phase: number, fromStep: number, data: any) => {
  try {
    if (!pipelineController) {
      throw new Error('Pipeline not initialized');
    }
    console.log(`📡 IPC handler: pipeline:continue-phase - phase ${phase}, fromStep ${fromStep}`);

    // Pour Phase 0, utiliser le système de reprise existant
    if (phase === 0 && (fromStep === 2 || fromStep === 3)) {
      const additionalData = {
        resumeFromStep: fromStep,
        previousStepData: data
      };
      return await pipelineController.executePhase(phase, additionalData);
    }

    // Pour Phase 1, si on a userAction ou payload avec duplicateAction, c'est une reprise après doublons
    if (phase === 1 && (data?.userAction || data?.payload?.duplicateAction)) {
      console.log('🔄 Detected Phase 1 user action, using resumeAfterUserAction');

      // Adapter le format : userAction peut être dans payload
      const userChoice = data.userAction || data.payload;
      const previousState = data.pendingState || data.phaseData;

      console.log('🔧 DEBUG main.ts - userChoice:', userChoice);
      console.log('🔧 DEBUG main.ts - previousState keys:', Object.keys(previousState || {}));

      return await pipelineController.resumeAfterUserAction(
        phase,
        userChoice,
        previousState
      );
    }

    // Pour Phase 2, si on a userAction c'est une reprise après quarantaine
    if (phase === 2 && data?.userAction) {
      console.log('🔄 Detected Phase 2 user action, using resumeAfterUserAction');
      return await pipelineController.resumeAfterUserAction(
        phase,
        data.userAction,
        data.pendingState
      );
    }

    // Pour Phase 3, reprendre après sélection de structure
    if (phase === 3 && data?.userAction) {
      console.log('🔄 Detected Phase 3 user action, using resumeAfterUserAction');
      return await pipelineController.resumeAfterUserAction(
        phase,
        data.userAction,
        data.pendingState
      );
    }

    // Pour les autres cas, exécution normale avec données additionnelles
    return await pipelineController.executePhase(phase, data);
  } catch (error) {
    console.error(`Error continuing phase ${phase} from step ${fromStep}:`, error);
    throw error;
  }
});

ipcMain.handle('pipeline:get-state', async () => {
  try {
    if (!pipelineController) {
      throw new Error('Pipeline not initialized');
    }
    return pipelineController.getState();
  } catch (error) {
    console.error('Error getting pipeline state:', error);
    throw error;
  }
});

ipcMain.handle('pipeline:stop', async () => {
  try {
    if (pipelineController) {
      await pipelineController.cleanup();
      pipelineEventsRegistered = false;
    }
    return { success: true };
  } catch (error) {
    console.error('Error stopping pipeline:', error);
    throw error;
  }
});

// Basic file system operations
ipcMain.handle('fs:select-directory', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    return result;
  } catch (error) {
    console.error('Error selecting directory:', error);
    throw error;
  }
});

ipcMain.handle('fs:open-folder', async (event, folderPath: string) => {
  try {
    await shell.openPath(folderPath);
    return { success: true };
  } catch (error) {
    console.error('Error opening folder:', error);
    throw error;
  }
});

console.log('🚀 Audio Organizer V6 - Main process started');
