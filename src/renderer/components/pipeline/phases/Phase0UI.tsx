import React from 'react';
import type { Phase0Data } from '@shared/interfaces/PipelineTypes';
import type { PhaseUIProps, Phase0UserChoices } from '../types/UITypes';

export function Phase0UI({
  phaseNumber = 0,
  data,
  userChoices,
  onComplete,
  onBack,
  onStop,
  isLoading,
  loadingMessage,
  onContinue
}: PhaseUIProps<Phase0Data>) {
  // Déterminer à quelle étape on est (maintenant 3 étapes)
  const hasQuickScan = data?.quickScanResult;
  const hasReorganizationPlan = data?.reorganizationPlan;
  const hasReorganization = data?.reorganizationResult;

  const currentStep = hasReorganization ? 3 : hasReorganizationPlan ? 2 : hasQuickScan ? 1 : 0;
  const planReport = data?.reorganizationPlan?.planReport as
    | {
        tone: 'calm' | 'energetic' | 'urgent';
        headline: string;
        narrative: string[];
        chaosLevel: {
          score: number;
          label: string;
          description: string;
          indicator: 'low' | 'medium' | 'high';
        };
        cards: Array<{ label: string; value: string; hint?: string; accent?: 'muted' | 'warning' | 'success' }>;
        actionPlan: string[];
        callToAction: string;
      }
    | undefined;

  const renderCardAccent = (accent?: 'muted' | 'warning' | 'success') => {
    switch (accent) {
      case 'warning':
        return 'bg-amber-500/10 border border-amber-400/40 text-amber-200';
      case 'success':
        return 'bg-emerald-500/10 border border-emerald-400/30 text-emerald-200';
      case 'muted':
        return 'bg-slate-900/60 border border-slate-700 text-slate-200';
      default:
        return 'bg-slate-900/60 border border-slate-800 text-slate-100';
    }
  };

  const handleApprove = () => {
    const choices: Phase0UserChoices = {
      validateQuickScan: true,
      approveReorganizationPlan: true,
      reorganizationApproved: true,
      ...userChoices
    };
    onComplete?.(data ?? null, choices);

    // Selon l'étape, utiliser différentes méthodes
    if (currentStep === 1) {
      // Step 1 -> 2: Générer le plan (continuer normalement)
      onContinue?.();
    } else if (currentStep === 2) {
      // Step 2 -> 3: Exécuter le plan (utiliser continuePhase)
      onContinue?.('execute-reorganization');
    } else {
      // Autres cas
      onContinue?.();
    }
  };

  return (
    <section className="h-full flex flex-col bg-slate-900 text-slate-100">
      <header className="px-6 py-4 border-b border-slate-800">
        <h1 className="text-2xl font-semibold">Phase {phaseNumber} · Préparation</h1>
        <p className="text-sm text-slate-400">
          {currentStep === 1
            ? "Étape 1/3 : Validation du scan initial"
            : currentStep === 2
            ? "Étape 2/3 : Validation du plan de réorganisation"
            : currentStep === 3
            ? "Étape 3/3 : Exécution terminée"
            : "Préparation - Scan et planification"}
        </p>
      </header>

      <main className="flex-1 overflow-auto px-6 py-6 space-y-6">
        {/* Indicateur d'étapes */}
        {!isLoading && (
          <div className="flex items-center justify-center space-x-3 mb-6">
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-lg ${currentStep >= 1 ? 'bg-blue-900/50 border border-blue-500' : 'bg-slate-800/50 border border-slate-700'}`}>
              <span className={`text-sm font-medium ${currentStep >= 1 ? 'text-blue-300' : 'text-slate-400'}`}>
                {currentStep >= 1 ? '✅' : '1️⃣'} Scan
              </span>
            </div>
            <span className="text-slate-500">→</span>
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-lg ${currentStep >= 2 ? 'bg-blue-900/50 border border-blue-500' : 'bg-slate-800/50 border border-slate-700'}`}>
              <span className={`text-sm font-medium ${currentStep >= 2 ? 'text-blue-300' : 'text-slate-400'}`}>
                {currentStep >= 2 ? '✅' : '2️⃣'} Plan
              </span>
            </div>
            <span className="text-slate-500">→</span>
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-lg ${currentStep >= 3 ? 'bg-blue-900/50 border border-blue-500' : 'bg-slate-800/50 border border-slate-700'}`}>
              <span className={`text-sm font-medium ${currentStep >= 3 ? 'text-blue-300' : 'text-slate-400'}`}>
                {currentStep >= 3 ? '✅' : '3️⃣'} Exécution
              </span>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-300">{loadingMessage || 'Traitement en cours…'}</p>
          </div>
        ) : (
          <>
            <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-3">
              <h2 className="text-lg font-medium text-slate-100">Résumé du scan rapide</h2>
              {data?.quickScanResult ? (
                <ul className="text-sm text-slate-300 space-y-2">
                  <li>• Packs détectés : {data.quickScanResult.detectedPacks.length}</li>
                  <li>• Samples totaux : {data.quickScanResult.totalSamples}</li>
                  <li>• Taille totale : {(data.quickScanResult.totalSize / (1024 * 1024)).toFixed(1)} Mo</li>
                  <li>
                    • Score de chaos : {(data.quickScanResult.chaosScore * 100).toFixed(0)}%
                    {data.quickScanResult.needsCleanup ? ' (nettoyage recommandé)' : ''}
                  </li>
                  <li>• Structure actuelle : {data.quickScanResult.currentStructure}</li>
                </ul>
              ) : (
                <p className="text-sm text-slate-400">En attente du résultat du scan.</p>
              )}
            </section>

            <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-3">
              <h2 className="text-lg font-medium text-slate-100">
                {currentStep === 3 ? 'Résultats de la réorganisation' : 'Plan de réorganisation'}
              </h2>
              {currentStep === 3 && data?.reorganizationResult ? (
                <ul className="text-sm text-slate-300 space-y-2">
                  <li>✅ Packs déplacés : {data.reorganizationResult.movedPacks}</li>
                  <li>✅ Noms nettoyés : {data.reorganizationResult.cleanedNames}</li>
                  <li>✅ Folders unwrap : {data.reorganizationResult.unwrappedFolders}</li>
                  <li>✅ Dossier de travail : {data.reorganizationResult.workingPath}</li>
                </ul>
              ) : currentStep === 2 && data?.reorganizationPlan ? (
                <div className="space-y-4">
                  {planReport ? (
                    <>
                      <div
                        className={`rounded-xl border p-4 ${
                          planReport.tone === 'urgent'
                            ? 'border-red-500/50 bg-red-500/10'
                            : planReport.tone === 'energetic'
                            ? 'border-blue-500/40 bg-blue-500/10'
                            : 'border-slate-700 bg-slate-900/60'
                        }`}
                      >
                        <h3 className="text-lg font-semibold text-slate-100">{planReport.headline}</h3>
                        <div className="mt-2 space-y-1 text-sm text-slate-300">
                          {planReport.narrative.map((sentence, idx) => (
                            <p key={idx}>{sentence}</p>
                          ))}
                        </div>

                        <div className="mt-4 grid gap-4 lg:grid-cols-2">
                          <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
                            <div className="text-xs uppercase tracking-wide text-slate-400">Niveau de chaos</div>
                            <div className="mt-1 flex items-center justify-between text-sm text-slate-200">
                              <span>{planReport.chaosLevel.label}</span>
                              <span>{Math.round((planReport.chaosLevel.score ?? 0) * 100)}%</span>
                            </div>
                            <div className="mt-2 h-2 w-full rounded-full bg-slate-800">
                              <div
                                className={`h-full rounded-full ${
                                  planReport.chaosLevel.indicator === 'high'
                                    ? 'bg-red-500'
                                    : planReport.chaosLevel.indicator === 'medium'
                                    ? 'bg-yellow-400'
                                    : 'bg-emerald-400'
                                }`}
                                style={{ width: `${Math.max(8, Math.round((planReport.chaosLevel.score ?? 0) * 100))}%` }}
                              />
                            </div>
                            <p className="mt-2 text-xs text-slate-400">{planReport.chaosLevel.description}</p>
                          </div>

                        </div>
                      </div>

                      {planReport.cards?.length ? (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {planReport.cards.map(card => (
                            <div
                              key={card.label}
                              className={`rounded-lg px-4 py-3 text-sm ${renderCardAccent(card.accent)}`}
                            >
                              <div className="text-xs uppercase tracking-wide text-slate-400">{card.label}</div>
                              <div className="mt-1 text-lg font-semibold text-slate-100">{card.value}</div>
                              {card.hint && <div className="text-xs text-slate-400">{card.hint}</div>}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {planReport.actionPlan?.length ? (
                        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
                          <div className="text-sm font-medium text-slate-200">Plan d'action</div>
                          <ul className="mt-2 space-y-1 text-sm text-slate-300">
                            {planReport.actionPlan.map((action, idx) => (
                              <li key={idx} className="flex items-start space-x-2">
                                <span className="mt-0.5 text-blue-400">•</span>
                                <span>{action}</span>
                              </li>
                            ))}
                          </ul>
                          <div className="mt-3 rounded-lg bg-blue-500/10 px-3 py-2 text-sm text-blue-200">
                            {planReport.callToAction}
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : null}

                  <div className="space-y-3">
                    <div className="text-sm font-medium text-blue-300">Détails du plan :</div>
                    <ul className="text-sm text-slate-300 space-y-1 max-h-40 overflow-y-auto">
                      {data.reorganizationPlan.operations.map((op, idx) => (
                        <li key={idx} className="flex items-start space-x-2">
                          <span className="text-blue-400 mt-0.5">•</span>
                          <span>{op.type}: {op.sourcePath.split(/[\\/]/).pop()} → {op.targetPath.split(/[\\/]/).pop()}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="bg-slate-900/50 rounded-lg p-3 space-y-2 text-xs text-slate-300">
                      <div className="text-slate-400">Statistiques :</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>📁 {data.reorganizationPlan.plannedStats?.moveOperations || 0} déplacements</div>
                        <div>✏️ {data.reorganizationPlan.plannedStats?.cleanOperations || 0} nettoyages</div>
                        <div>📂 {data.reorganizationPlan.plannedStats?.unwrapOperations || 0} dépaquetages</div>
                        <div>🗑️ {data.reorganizationPlan.plannedStats?.deleteOperations || 0} suppressions</div>
                        <div>
                          ⏱️ Temps estimé :
                          {' '}
                          {data.reorganizationPlan.plannedStats?.estimatedTimeSeconds
                            ? `${data.reorganizationPlan.plannedStats.estimatedTimeSeconds}s`
                            : '≈30s'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">
                  {currentStep === 1 ? 'En attente de génération du plan...' : 'Analyse en cours...'}
                </p>
              )}
            </section>
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
          onClick={handleApprove}
          disabled={currentStep === 0 || (currentStep === 1 && !data?.quickScanResult) || (currentStep === 2 && !data?.reorganizationPlan)}
          className="px-5 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-400"
        >
          {currentStep === 1
            ? "Générer le plan de réorganisation"
            : currentStep === 2
            ? "Exécuter la réorganisation"
            : currentStep === 3
            ? "Continuer vers Phase 1"
            : "Démarrer le scan"}
        </button>
      </footer>
    </section>
  );
}
