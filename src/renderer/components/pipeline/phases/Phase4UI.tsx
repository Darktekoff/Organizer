import React from 'react';
import type { Phase4Data } from '@shared/interfaces/PipelineTypes';
import type { Phase4UserChoices, PhaseUIProps } from '../types/UITypes';

export function Phase4UI({
  phaseNumber = 4,
  data,
  userChoices,
  onComplete,
  onBack,
  onStop,
  onProceed
}: PhaseUIProps<Phase4Data>) {
  const handleConfirm = () => {
    const choices: Phase4UserChoices = {
      confirmOrganization: true,
      pauseRequested: false,
      stopRequested: false,
      ...userChoices
    };
    onComplete?.(data ?? null, choices);
    onProceed?.();
  };

  return (
    <section className="h-full flex flex-col bg-slate-900 text-slate-100">
      <header className="px-6 py-4 border-b border-slate-800">
        <h1 className="text-2xl font-semibold">Phase {phaseNumber} · Organization</h1>
        <p className="text-sm text-slate-400">
          Vérification de l'exécution des opérations et validation de la structure finale.
        </p>
      </header>

      <main className="flex-1 overflow-auto px-6 py-6 space-y-6">
        <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-3">
          <h2 className="text-lg font-medium text-slate-100">Organisation physique</h2>
          {data?.organizationResult ? (
            <ul className="text-sm text-slate-300 space-y-2">
              <li>• Opérations terminées : {data.organizationResult.completedOperations}</li>
              <li>• Fichiers déplacés : {data.organizationResult.movedFiles}</li>
              <li>• Fichiers supprimés : {data.organizationResult.deletedFiles}</li>
              <li>• Espace économisé : {(data.organizationResult.spaceSaved / (1024 * 1024)).toFixed(1)} Mo</li>
            </ul>
          ) : (
            <p className="text-sm text-slate-400">Aucun résultat disponible.</p>
          )}
        </section>

        {data?.fusionResult && (
          <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-3">
            <h2 className="text-lg font-medium text-slate-100">Fusion intelligente</h2>
            <ul className="text-sm text-slate-300 space-y-2">
              <li>• Groupes fusionnés : {data.fusionResult.fusionGroupsSuccessful}</li>
              <li>• Fichiers fusionnés : {data.fusionResult.totalFilesMerged}</li>
              <li>• Conflits résolus : {data.fusionResult.conflictsEncountered}</li>
            </ul>
          </section>
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
          className="px-5 py-2 rounded-lg bg-sky-600 text-white font-medium hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-400"
        >
          Continuer vers Phase 5
        </button>
      </footer>
    </section>
  );
}
