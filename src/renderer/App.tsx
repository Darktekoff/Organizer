import React, { useState } from 'react';
import { HomeView } from './components/home/HomeView';
import { SettingsView } from './components/settings/SettingsView';
import { PipelineV6Provider } from './components/pipeline/PipelineV6Provider';
import { PipelineV6Workflow } from './components/pipeline/PipelineV6Workflow';
import './styles/globals.css';

export type AppView =
  | 'home'
  | 'pipeline-v6'
  | 'settings';

export interface AppState {
  currentView: AppView;
  libraryPath?: string;
  pipelineMode?: 'quick' | 'advanced' | 'custom';
  previousResults?: any;
}

function App() {
  const [appState, setAppState] = useState<AppState>({
    currentView: 'home'
  });

  const navigate = (view: AppView, data?: Partial<AppState>) => {
    setAppState(prev => ({
      ...prev,
      currentView: view,
      ...data
    }));
  };

  const renderView = () => {
    switch (appState.currentView) {
      case 'home':
        return <HomeView onNavigate={navigate} />;

      case 'pipeline-v6':
        return (
          <PipelineV6Provider
            sourcePath={appState.libraryPath}
            initialConfig={{
              libraryPath: appState.libraryPath || '',
              mode: appState.pipelineMode || 'advanced',
              previousResults: appState.previousResults
            }}
          >
            <PipelineV6Workflow
              sourcePath={appState.libraryPath || ''}
              onComplete={(result) => {
                console.log('Pipeline V6 completed:', result);
                navigate('home', { previousResults: result });
              }}
              onCancel={() => navigate('home')}
            />
          </PipelineV6Provider>
        );

      case 'settings':
        return <SettingsView onNavigate={navigate} />;

      default:
        return <HomeView onNavigate={navigate} />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Navigation Bar */}
      <div className="bg-gray-800/90 backdrop-blur-sm border-b border-gray-600/50 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-lg">🎵</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Samples Organizer Pro</h1>
              {appState.currentView === 'pipeline-v6' && (
                <div className="text-sm text-blue-400">Pipeline V6 - Organisation intelligente</div>
              )}
              {appState.libraryPath && (
                <div className="text-xs text-gray-400 truncate max-w-md">
                  📁 {appState.libraryPath}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Indicateur de statut Pipeline V6 */}
          {appState.currentView === 'pipeline-v6' && (
            <div className="px-3 py-1 bg-blue-900/30 border border-blue-500/30 rounded-lg">
              <span className="text-sm text-blue-400">🔄 Pipeline actif</span>
            </div>
          )}

          {appState.currentView !== 'home' && (
            <button
              onClick={() => navigate('home')}
              className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-all duration-200"
            >
              🏠 Accueil
            </button>
          )}

          {appState.currentView !== 'settings' && (
            <button
              onClick={() => navigate('settings')}
              className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-all duration-200"
            >
              ⚙️ Paramètres
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {renderView()}
      </main>
    </div>
  );
}

export default App;
