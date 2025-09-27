/**
 * HomeView - Page d'accueil propre pour Audio Organizer V6
 */

import React, { useState } from 'react';

interface HomeViewProps {
  onNavigate: (view: string, data?: any) => void;
}

export function HomeView({ onNavigate }: HomeViewProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  const handleSelectDirectory = async () => {
    try {
      const result = await window.electronAPI.selectDirectory();
      if (!result.canceled && result.filePaths.length > 0) {
        const path = result.filePaths[0];
        setSelectedPath(path);
        console.log('📁 Dossier sélectionné:', path);
      }
    } catch (error) {
      console.error('Erreur lors de la sélection du dossier:', error);
    }
  };

  const handleStartPipeline = async () => {
    if (!selectedPath) return;

    try {
      setIsInitializing(true);
      // Initialiser le pipeline backend
      await window.electronAPI.pipeline.initialize(selectedPath);
      console.log('✅ Pipeline backend initialisé avec:', selectedPath);

      // Naviguer vers l'interface pipeline avec le selectedPath
      onNavigate('pipeline-v6', { libraryPath: selectedPath });
    } catch (error) {
      console.error('Erreur lors du démarrage du pipeline:', error);
    } finally {
      setIsInitializing(false);
    }
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="container mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Audio Organizer V6
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Organisez votre bibliothèque de samples avec l'intelligence artificielle
          </p>
        </div>

        {/* Actions principales */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-12">
          {/* Pipeline V6 */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-8 border border-gray-700 hover:border-blue-500 transition-all">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold">Pipeline V6</h3>
            </div>
            <p className="text-gray-300 mb-6">
              Lancez le processus complet d'organisation automatique de vos samples
            </p>

            {/* Sélection du dossier */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Dossier à organiser:
              </label>
              {selectedPath ? (
                <div className="flex items-center justify-between bg-gray-700/50 rounded-lg p-3 mb-3">
                  <div className="flex items-center min-w-0 flex-1">
                    <svg className="w-5 h-5 text-blue-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <span className="text-sm text-gray-200 truncate" title={selectedPath}>
                      {selectedPath}
                    </span>
                  </div>
                  <button
                    onClick={handleSelectDirectory}
                    className="ml-3 text-blue-400 hover:text-blue-300 text-sm flex-shrink-0"
                  >
                    Changer
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleSelectDirectory}
                  className="w-full bg-gray-700/50 hover:bg-gray-600/50 border-2 border-dashed border-gray-600 hover:border-blue-500 rounded-lg p-6 transition-all text-gray-300 hover:text-white"
                >
                  <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <div className="text-sm">Cliquez pour choisir un dossier</div>
                </button>
              )}
            </div>

            {/* Bouton de lancement */}
            <button
              onClick={handleStartPipeline}
              disabled={!selectedPath || isInitializing}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
                selectedPath && !isInitializing
                  ? 'bg-blue-500 hover:bg-blue-600 text-white'
                  : 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isInitializing ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Initialisation...
                </div>
              ) : selectedPath ? (
                'Démarrer le Pipeline V6'
              ) : (
                'Choisissez d\'abord un dossier'
              )}
            </button>

            <div className="text-sm text-blue-400 mt-4">
              6 phases · IA avancée · Organisation intelligente
            </div>
          </div>

          {/* Paramètres */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-8 border border-gray-700 hover:border-purple-500 transition-all cursor-pointer group"
               onClick={() => onNavigate('settings')}>
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold">Paramètres</h3>
            </div>
            <p className="text-gray-300 mb-4">
              Configurez l'application selon vos préférences
            </p>
            <div className="text-sm text-purple-400">
              API · Préférences · Avancé
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-gray-800/30 rounded-lg p-6 border border-gray-700">
            <div className="text-3xl mb-3">🎵</div>
            <h4 className="text-lg font-semibold mb-2">6 Phases Intelligentes</h4>
            <p className="text-gray-400 text-sm">Analyse complète de votre bibliothèque</p>
          </div>
          <div className="bg-gray-800/30 rounded-lg p-6 border border-gray-700">
            <div className="text-3xl mb-3">🤖</div>
            <h4 className="text-lg font-semibold mb-2">IA Avancée</h4>
            <p className="text-gray-400 text-sm">Classification automatique par GPT-4</p>
          </div>
          <div className="bg-gray-800/30 rounded-lg p-6 border border-gray-700">
            <div className="text-3xl mb-3">⚡</div>
            <h4 className="text-lg font-semibold mb-2">Organisation Rapide</h4>
            <p className="text-gray-400 text-sm">Structure intelligente en quelques minutes</p>
          </div>
        </div>

        {/* Informations Version */}
        <div className="text-center">
          <div className="inline-block bg-gray-800/30 backdrop-blur-sm rounded-lg px-6 py-3 border border-gray-700">
            <div className="flex items-center space-x-4 text-sm text-gray-400">
              <span>Version 6.0.0</span>
              <span>•</span>
              <span>Pipeline V6</span>
              <span>•</span>
              <span>IA GPT-4</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}