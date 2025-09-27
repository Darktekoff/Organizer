import React from 'react';
import type { Phase2Data } from '@shared/interfaces/PipelineTypes';
import type { Phase2UserChoices, PhaseUIProps } from '../types/UITypes';

export function Phase2UI({
  phaseNumber = 2,
  data,
  userChoices,
  onComplete,
  onBack,
  onStop,
  isLoading,
  loadingMessage,
  onProceed,
  onContinue,
  phaseData
}: PhaseUIProps<Phase2Data>) {
  const pendingAction = phaseData?.pendingAction;
  const [resolutionMode, setResolutionMode] = React.useState<'ACCEPT_SUGGESTIONS' | 'CLASSIFY_MANUAL' | 'SKIP_ALL'>('ACCEPT_SUGGESTIONS');

  const handleConfirm = () => {
    const choices: Phase2UserChoices = {
      validateAutoClassification: true,
      quarantineResolutions: new Map<string, string>(),
      allQuarantineResolved: Boolean(data?.quarantineResult?.totalResolved),
      ...userChoices
    };
    onComplete?.(data ?? null, choices);
    if (pendingAction) {
      onContinue?.({ mode: resolutionMode });
    } else {
      onProceed?.();
    }
  };

  return (
    <section className="h-full flex flex-col bg-slate-900 text-slate-100">
      <header className="px-6 py-4 border-b border-slate-800">
        <h1 className="text-2xl font-semibold">Phase {phaseNumber} · Classification</h1>
        <p className="text-sm text-slate-400">
          Validation des résultats de classification et traitement de la quarantaine.
        </p>
      </header>

      <main className="flex-1 overflow-auto px-6 py-6 space-y-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-300">{loadingMessage || 'Classification en cours…'}</p>
          </div>
        ) : (
          <>
            <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-3">
              <h2 className="text-lg font-medium text-slate-100">Résultats automatiques</h2>
              {data?.classificationResult ? (
                <>
                  <ul className="text-sm text-slate-300 space-y-2">
                    <li>• Packs classifiés : {data.classificationResult.totalClassified}</li>
                    <li>• Confiance moyenne : {(data.classificationResult.averageConfidence * 100).toFixed(1)}%</li>
                  </ul>

                  {data.classificationResult.classifiedPacks?.length ? (
                    <div className="mt-4 space-y-2">
                      <div className="text-xs uppercase tracking-wide text-slate-400">Détails par pack</div>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {data.classificationResult.classifiedPacks.map(pack => (
                          <div
                            key={pack.packId}
                            className="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-200"
                          >
                            <div className="text-slate-100 font-semibold truncate" title={pack.packName}>
                              {pack.packName || pack.packId}
                            </div>
                            <div className="mt-1 text-xs text-slate-400 uppercase tracking-wide">
                              Style détecté
                            </div>
                            <div className="text-sm text-blue-300">
                              {pack.style || 'Inconnu'}
                            </div>
                            <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                              <span>{pack.family || 'Famille inconnue'}</span>
                              <span>{(pack.confidence * 100).toFixed(0)}%</span>
                            </div>
                            <div className="mt-1 text-[11px] text-slate-500">
                              Méthode : {pack.method || 'auto'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-slate-400">Aucun résultat disponible.</p>
              )}
            </section>

            {data?.quarantineResult && (
              <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-3">
                <h2 className="text-lg font-medium text-slate-100">Quarantaine</h2>
                <ul className="text-sm text-slate-300 space-y-2">
                  <li>• Packs en quarantaine : {data.quarantineResult.totalQuarantined}</li>
                  <li>• Packs résolus : {data.quarantineResult.totalResolved}</li>
                </ul>
              </section>
            )}

            {pendingAction && (
              <section className="bg-purple-900/20 border border-purple-600/40 rounded-xl p-5 space-y-4">
                <header className="space-y-1">
                  <h2 className="text-lg font-medium text-purple-200">Action requise</h2>
                  <p className="text-sm text-purple-300">{pendingAction.message}</p>
                </header>

                <div className="space-y-3">
                  {(pendingAction.defaultValue?.quarantinePacks || []).map((pack: any) => (
                    <div key={pack.packId} className="bg-purple-900/30 border border-purple-700/30 rounded-lg p-3">
                      <div className="text-sm font-semibold text-purple-100">{pack.packName}</div>
                      <div className="text-xs text-purple-300">{pack.reason}</div>
                      {pack.suggestions?.length > 0 && (
                        <div className="mt-2 text-xs text-purple-200">
                          Suggestions : {pack.suggestions.map((s: any) => `${s.style} (${Math.round((s.confidence || 0) * 100)}%)`).join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-3 md:space-y-0">
                  <label className="text-sm text-purple-200">Choisir une résolution :</label>
                  <select
                    value={resolutionMode}
                    onChange={(e) => setResolutionMode(e.target.value as any)}
                    className="bg-purple-950/60 border border-purple-700 text-purple-100 rounded px-3 py-2 text-sm"
                  >
                    <option value="ACCEPT_SUGGESTIONS">Accepter les suggestions proposées</option>
                    <option value="CLASSIFY_MANUAL">Marquer pour revue manuelle</option>
                    <option value="SKIP_ALL">Ignorer et passer</option>
                  </select>
                </div>
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
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!data}
          className="px-5 py-2 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-400"
        >
          {pendingAction ? 'Appliquer la résolution' : 'Continuer vers Phase 3'}
        </button>
      </footer>
    </section>
  );
}
