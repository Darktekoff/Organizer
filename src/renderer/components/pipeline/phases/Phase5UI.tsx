import React from 'react';
import type { Phase5Data } from '@shared/interfaces/PipelineTypes';
import type { Phase5UserChoices, PhaseUIProps } from '../types/UITypes';

export function Phase5UI({
  phaseNumber = 5,
  data,
  userChoices,
  onComplete,
  onBack,
  onStop,
  onProceed
}: PhaseUIProps<Phase5Data>) {
  const handleFinish = () => {
    const choices: Phase5UserChoices = {
      validateFinalResults: true,
      selectedReportFormats: data?.finalReport?.reportFormats ?? ['json'],
      backupConfirmed: Boolean(data?.backupResult?.success),
      ...userChoices
    };
    onComplete?.(data ?? null, choices);
    onProceed?.();
  };

  const validation = data?.validationResult;
  const report = data?.finalReport;
  const backup = data?.backupResult;

  return (
    <section className="h-full flex flex-col bg-slate-900 text-slate-100">
      <header className="px-6 py-4 border-b border-slate-800">
        <h1 className="text-2xl font-semibold">Phase {phaseNumber} · Validation finale</h1>
        <p className="text-sm text-slate-400">
          Synthèse des contrôles d'intégrité et génération des rapports de clôture.
        </p>
      </header>

      <main className="flex-1 overflow-auto px-6 py-6 space-y-6">
        <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-3">
          <h2 className="text-lg font-medium text-slate-100">Contrôles effectués</h2>
          {validation ? (
            <ul className="text-sm text-slate-300 space-y-2">
              <li>• Vérifications totales : {validation.totalChecks}</li>
              <li>• Succès : {validation.passedChecks}</li>
              <li>• Échecs : {validation.failedChecks}</li>
              <li>• Avertissements : {validation.warnings.length}</li>
            </ul>
          ) : (
            <p className="text-sm text-slate-400">Aucun contrôle disponible.</p>
          )}
        </section>

        {report && (
          <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-3">
            <h2 className="text-lg font-medium text-slate-100">Rapport final</h2>
            <p className="text-sm text-slate-300">
              Formats générés : {report.reportFormats.join(', ')}
            </p>
            <p className="text-sm text-slate-400">
              Score global : {report.executiveSummary.overallSuccess ? 'Succès' : 'À vérifier'}
            </p>
          </section>
        )}

        {backup && (
          <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-3">
            <h2 className="text-lg font-medium text-slate-100">Backup</h2>
            <ul className="text-sm text-slate-300 space-y-1">
              <li>• Statut : {backup.success ? 'Réussi' : 'Échec'}</li>
              <li>• Emplacement : {backup.backupPath}</li>
              <li>• Taille : {(backup.backupSize / (1024 * 1024)).toFixed(1)} Mo</li>
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
            Annuler
          </button>
        </div>
        <button
          type="button"
          onClick={handleFinish}
          disabled={!data}
          className="px-5 py-2 rounded-lg bg-lime-600 text-white font-medium hover:bg-lime-500 disabled:bg-slate-700 disabled:text-slate-400"
        >
          Terminer le pipeline
        </button>
      </footer>
    </section>
  );
}
