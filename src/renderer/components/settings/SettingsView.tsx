/**
 * SettingsView - Page de paramètres propre pour Audio Organizer V6
 */

import React, { useState } from 'react';

interface SettingsViewProps {
  onNavigate: (view: string) => void;
}

export function SettingsView({ onNavigate }: SettingsViewProps) {
  const [apiKey, setApiKey] = useState('');
  const [savedApiKey, setSavedApiKey] = useState(false);

  const handleSaveApiKey = () => {
    if (apiKey.trim()) {
      // Ici on sauvegarderait la clé API
      setSavedApiKey(true);
      setTimeout(() => setSavedApiKey(false), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="container mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center mb-8">
          <button
            onClick={() => onNavigate('home')}
            className="mr-4 p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">
            Paramètres
          </h1>
        </div>

        <div className="max-w-4xl mx-auto space-y-8">
          {/* API Configuration */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-8 border border-gray-700">
            <h2 className="text-2xl font-semibold mb-6 flex items-center">
              <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-3L8.257 12.257A6 6 0 0112 5.257v0A6 6 0 0118 9z" />
                </svg>
              </div>
              Configuration API
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Clé API OpenAI
                </label>
                <div className="flex space-x-3">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="flex-1 px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none text-white"
                  />
                  <button
                    onClick={handleSaveApiKey}
                    className={`px-6 py-3 rounded-lg font-medium transition-all ${
                      savedApiKey
                        ? 'bg-green-500 text-white'
                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }`}
                  >
                    {savedApiKey ? '✓ Sauvé' : 'Sauver'}
                  </button>
                </div>
                <p className="text-sm text-gray-400 mt-2">
                  Nécessaire pour la classification IA des samples
                </p>
              </div>
            </div>
          </div>

          {/* Pipeline Settings */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-8 border border-gray-700">
            <h2 className="text-2xl font-semibold mb-6 flex items-center">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              Paramètres Pipeline
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-300">Performance</h3>
                <div className="space-y-3">
                  <label className="flex items-center space-x-3">
                    <input type="checkbox" defaultChecked className="w-4 h-4 text-blue-500 bg-gray-700 border-gray-600 rounded focus:ring-blue-500" />
                    <span className="text-gray-300">Mode parallèle activé</span>
                  </label>
                  <label className="flex items-center space-x-3">
                    <input type="checkbox" defaultChecked className="w-4 h-4 text-blue-500 bg-gray-700 border-gray-600 rounded focus:ring-blue-500" />
                    <span className="text-gray-300">Cache intelligent</span>
                  </label>
                  <label className="flex items-center space-x-3">
                    <input type="checkbox" className="w-4 h-4 text-blue-500 bg-gray-700 border-gray-600 rounded focus:ring-blue-500" />
                    <span className="text-gray-300">Mode debug</span>
                  </label>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-300">Classification</h3>
                <div className="space-y-3">
                  <label className="flex items-center space-x-3">
                    <input type="checkbox" defaultChecked className="w-4 h-4 text-blue-500 bg-gray-700 border-gray-600 rounded focus:ring-blue-500" />
                    <span className="text-gray-300">Analyse sémantique</span>
                  </label>
                  <label className="flex items-center space-x-3">
                    <input type="checkbox" defaultChecked className="w-4 h-4 text-blue-500 bg-gray-700 border-gray-600 rounded focus:ring-blue-500" />
                    <span className="text-gray-300">Recherche web</span>
                  </label>
                  <label className="flex items-center space-x-3">
                    <input type="checkbox" className="w-4 h-4 text-blue-500 bg-gray-700 border-gray-600 rounded focus:ring-blue-500" />
                    <span className="text-gray-300">Mode conservateur</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* About */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-8 border border-gray-700">
            <h2 className="text-2xl font-semibold mb-6 flex items-center">
              <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              À propos
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium text-gray-300 mb-3">Version</h3>
                <div className="space-y-2 text-sm text-gray-400">
                  <div>Audio Organizer: <span className="text-white">6.0.0</span></div>
                  <div>Pipeline: <span className="text-white">V6</span></div>
                  <div>IA: <span className="text-white">GPT-4</span></div>
                  <div>Build: <span className="text-white">2024.09.17</span></div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-300 mb-3">Développement</h3>
                <div className="space-y-2 text-sm text-gray-400">
                  <div>Créé par: <span className="text-white">djdar</span></div>
                  <div>Framework: <span className="text-white">Electron + React</span></div>
                  <div>IA: <span className="text-white">OpenAI GPT-4</span></div>
                  <div>License: <span className="text-white">MIT</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-center space-x-4">
            <button
              onClick={() => onNavigate('home')}
              className="px-8 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Retour à l'accueil
            </button>
            <button
              onClick={() => onNavigate('pipeline-v6')}
              className="px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              Lancer Pipeline V6
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}