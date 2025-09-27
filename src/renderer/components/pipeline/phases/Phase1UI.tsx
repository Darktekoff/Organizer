import React, { useState } from 'react';
import type { Phase1Data } from '@shared/interfaces/PipelineTypes';
import type { Phase1UserChoices, PhaseUIProps } from '../types/UITypes';

function formatNumber(value: number | undefined): string {
  if (value === undefined) return '—';
  return value.toLocaleString('fr-FR');
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function Phase1UI({
  phaseNumber = 1,
  data,
  userChoices,
  onComplete,
  onBack,
  onStop,
  isLoading,
  loadingMessage,
  onProceed,
  onContinue
}: PhaseUIProps<Phase1Data>) {
  const [showDuplicates, setShowDuplicates] = useState(false);

  const hasDuplicates = !!(data?.indexingResult?.duplicates && data.indexingResult.duplicates.length > 0);
  const duplicatesRequireAction = hasDuplicates && !data?.indexingResult?.filesToDelete;

  const submitDuplicateChoice = (action: 'keep' | 'merge' | 'delete') => {
    const choices: Phase1UserChoices = {
      validateDeepAnalysis: true,
      acknowledgeIndexingResults: true,
      duplicateAction: action,
      ...userChoices
    };

    onComplete?.(data ?? null, choices);
    setShowDuplicates(false);
    setTimeout(() => {
      onContinue?.(choices);
    }, 50);
  };

  const proceedWithoutDuplicates = () => {
    const choices: Phase1UserChoices = {
      validateDeepAnalysis: true,
      acknowledgeIndexingResults: true,
      ...userChoices
    };
    onComplete?.(data ?? null, choices);
    onProceed?.();
  };

  return (
    <section className="h-full flex flex-col bg-slate-900 text-slate-100">
      <header className="px-6 py-4 border-b border-slate-800">
        <h1 className="text-2xl font-semibold">Phase {phaseNumber} · Discovery</h1>
        <p className="text-sm text-slate-400">
          Analyse approfondie des packs et indexation des fichiers détectés.
        </p>
      </header>

      <main className="flex-1 overflow-auto px-6 py-6 space-y-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-300">{loadingMessage || 'Analyse en cours…'}</p>
          </div>
        ) : (
          <>
            <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-3">
              <h2 className="text-lg font-medium text-slate-100">Analyse approfondie</h2>
              {data?.analysis ? (
                <ul className="text-sm text-slate-300 space-y-2">
                  <li>• Packs analysés : {formatNumber(data.analysis.totalPacks)}</li>
                  <li>• Fichiers totaux : {formatNumber(data.analysis.totalFiles)}</li>
                  <li>• Taille totale : {(data.analysis.totalSize / (1024 * 1024)).toFixed(1)} Mo</li>
                  <li>• Niveaux détectés : max {data.analysis.depthAnalysis.maxDepth}</li>
                </ul>
              ) : data?.deepAnalysisResult ? (
                <ul className="text-sm text-slate-300 space-y-2">
                  <li>• Packs analysés : {formatNumber(data.deepAnalysisResult.totalPacks)}</li>
                  <li>• Fichiers totaux : {formatNumber(data.deepAnalysisResult.totalFiles)}</li>
                  <li>• Taille totale : {(data.deepAnalysisResult.totalSize / (1024 * 1024)).toFixed(1)} Mo</li>
                  <li>• Niveaux détectés : max {data.deepAnalysisResult.depthAnalysis.maxDepth}</li>
                </ul>
              ) : (
                <p className="text-sm text-slate-400">En attente des résultats d'analyse.</p>
              )}
            </section>

            <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-3">
              <h2 className="text-lg font-medium text-slate-100">Indexation</h2>
              {data?.indexingResult ? (
                <ul className="text-sm text-slate-300 space-y-2">
                  <li>• Fichiers indexés : {formatNumber(data.indexingResult.indexedFiles)}</li>
                  <li>• Groupes de doublons : {formatNumber(data.indexingResult.duplicates.length)}</li>
                  <li>• Stratégie appliquée : {data.indexingResult.duplicateStrategy || 'aucune'}</li>
                </ul>
              ) : (
                <p className="text-sm text-slate-400">Aucun index disponible pour l'instant.</p>
              )}
            </section>

            {data?.summary && (
              <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-2 text-sm text-slate-300">
                <h2 className="text-lg font-medium text-slate-100">Résumé Phase 1</h2>
                <ul className="space-y-1">
                  <li>• Durée : {Math.round((data.summary.duration || 0) / 1000)} s</li>
                  <li>• Doublons détectés : {formatNumber(data.summary.duplicatesFound)}</li>
                  <li>• Espace récupérable : {(data.summary.spaceRecovered / (1024 * 1024)).toFixed(1)} Mo</li>
                </ul>
              </section>
            )}

            {/* Section Doublons */}
            {duplicatesRequireAction && (
              <section className="bg-amber-900/20 border border-amber-700 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium text-amber-200">⚠️ Doublons Détectés</h2>
                  <button
                    type="button"
                    onClick={() => setShowDuplicates(!showDuplicates)}
                    className="px-3 py-1 text-sm bg-amber-800/50 hover:bg-amber-700/50 rounded-lg text-amber-200 transition-colors"
                  >
                    {showDuplicates ? 'Masquer' : 'Afficher'} ({data.indexingResult.duplicates.length} groupes)
                  </button>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-amber-300">
                    {data.indexingResult.duplicates.length} groupes de fichiers identiques trouvés.
                    Choisissez comment les traiter :
                  </p>

                  <div className="grid gap-2 md:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => submitDuplicateChoice('keep')}
                      className="px-3 py-2 text-sm rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-200 border border-slate-700 text-left"
                    >
                      <span className="font-medium block">Garder tous les fichiers</span>
                      <span className="text-xs text-slate-400">Aucun changement, les doublons restent intacts.</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => submitDuplicateChoice('merge')}
                      className="px-3 py-2 text-sm rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-200 border border-emerald-500 text-left"
                    >
                      <span className="font-medium block">Fusionner les doublons</span>
                      <span className="text-xs text-emerald-100/70">Conserve la meilleure version (chemin le plus pertinent).</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => submitDuplicateChoice('delete')}
                      className="px-3 py-2 text-sm rounded-lg bg-rose-600/15 hover:bg-rose-600/25 text-rose-200 border border-rose-500 text-left"
                    >
                      <span className="font-medium block">Supprimer les doublons</span>
                      <span className="text-xs text-rose-100/70">Supprime les copies, garde la version la plus récente.</span>
                    </button>
                  </div>
                </div>

                {showDuplicates && (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {data.indexingResult.duplicates.map((group, index) => (
                      <div key={group.signature || index} className="bg-slate-800/50 rounded-lg p-3 space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-400">Groupe {index + 1}</span>
                              <span className="text-xs text-amber-400">
                                {group.files.length} copies • {formatFileSize(group.sizePerFile)}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 space-y-1">
                              {group.files.slice(0, 3).map((file, fileIndex) => (
                                <div key={fileIndex} className="truncate">
                                  {file.path.split(/[\\\/]/).slice(-2).join('/')}
                                </div>
                              ))}
                              {group.files.length > 3 && (
                                <div className="text-slate-500">+{group.files.length - 3} autres...</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>

      <footer className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
        <div className="space-x-3">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            Retour
          </button>
          <button
            type="button"
            onClick={onStop}
            className="px-4 py-2 rounded-lg border border-red-600 text-red-300 hover:bg-red-900/40"
          >
            Arrêter
          </button>
        </div>
        {duplicatesRequireAction ? null : (
          <button
            type="button"
            onClick={proceedWithoutDuplicates}
            disabled={!data || isLoading}
            className="px-5 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-400"
          >
            Continuer vers Phase 2
          </button>
        )}
      </footer>
    </section>
  );
}
