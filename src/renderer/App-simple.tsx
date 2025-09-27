import React from 'react';
import './styles/globals.css';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="container mx-auto px-6 py-12">
        <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          🎵 Audio Organizer V6
        </h1>
        <p className="text-xl text-gray-300">
          Test simple - l'application fonctionne !
        </p>
        <div className="mt-8 p-6 bg-gray-800 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">✅ Statut</h2>
          <ul className="space-y-2 text-gray-300">
            <li>✅ React chargé</li>
            <li>✅ Tailwind CSS chargé</li>
            <li>✅ Styles appliqués</li>
            <li>✅ Interface visible</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default App;