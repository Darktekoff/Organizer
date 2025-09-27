import React, { useMemo, useState, useEffect } from 'react';
import type { Phase3Data } from '@shared/interfaces/PipelineTypes';
import type { Phase3UserChoices, PhaseUIProps } from '../types/UITypes';

export function Phase3UI({
  phaseNumber = 3,
  data,
  userChoices,
  onComplete,
  onBack,
  onStop,
  onProceed,
  onContinue,
  phaseData
}: PhaseUIProps<Phase3Data>) {
  const pendingAction = phaseData?.pendingAction;

  const proposalsFromPending = useMemo(() => {
    if (!pendingAction?.defaultValue?.proposals) return undefined;
    return pendingAction.defaultValue.proposals as Array<{
      id: string;
      name: string;
      description: string;
      hierarchy: string[];
      estimatedFolders: number;
      avgFilesPerFolder: number;
      advantages: string[];
      disadvantages: string[];
      statistics: { estimatedFolders: number; estimatedFiles: number; fusionGroups: number; duplicatesResolved: number };
      preview: Array<{ path: string; estimatedFiles: number; examples: string[] }>;
      balanceScore: number;
      compatibilityScore: number;
      maxDepth: number;
    }>;
  }, [pendingAction]);

  const recommendedStructureId = useMemo(() => {
    if (pendingAction?.defaultValue?.recommendedId) return pendingAction.defaultValue.recommendedId as string;
    if (data?.userChoice?.selectedStructureId) return data.userChoice.selectedStructureId;
    if (data?.summary?.recommendedProposal) return data.summary.recommendedProposal;
    if (proposalsFromPending?.[0]) return proposalsFromPending[0].id;
    if (data?.structureProposals?.[0]) return data.structureProposals[0].id;
    return undefined;
  }, [data, pendingAction, proposalsFromPending]);

  const [selectedStructureId, setSelectedStructureId] = useState<string | undefined>(recommendedStructureId);
  const [duplicateStrategy, setDuplicateStrategy] = useState<'merge' | 'keep-best' | 'keep-all' | 'manual'>(
    'merge'
  );

  useEffect(() => {
    setSelectedStructureId(recommendedStructureId);
  }, [recommendedStructureId]);

  const handleProceed = () => {
    const selectedId = data?.structureProposals?.[0]?.id;
    const choices: Phase3UserChoices = {
      duplicateStrategy: 'merge',
      duplicateResolutions: new Map<string, string>(),
      matrixValidated: true,
      selectedStructureId: selectedId,
      ...userChoices
    };
    onComplete?.(data ?? null, choices);
    onProceed?.();
  };

  const handleConfirmSelection = () => {
    if (!selectedStructureId) return;

    const choices: Phase3UserChoices = {
      duplicateStrategy,
      duplicateResolutions: new Map<string, string>(),
      matrixValidated: true,
      selectedStructureId,
      ...userChoices
    };

    onComplete?.(data ?? null, choices);
    onContinue?.({
      selectedStructureId,
      duplicateStrategy
    });
  };

  const renderProposalSummary = () => {
    const proposals = proposalsFromPending ?? data?.structureProposals;

    if (!proposals || proposals.length === 0) {
      return <p className="text-sm text-slate-400">Aucune proposition disponible pour le moment.</p>;
    }

    return (
      <ul className="text-sm text-slate-300 space-y-3">
        {proposals.map(proposal => {
          const isSelected = selectedStructureId === proposal.id;
          const isRecommended = proposal.id === recommendedStructureId;

          return (
            <li
              key={proposal.id}
              className={`border rounded-lg p-4 transition-colors ${
                isSelected ? 'border-emerald-500 bg-emerald-500/5' : 'border-slate-700'
              }`}
            >
              {pendingAction ? (
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="structure-choice"
                    value={proposal.id}
                    checked={isSelected}
                    onChange={() => setSelectedStructureId(proposal.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-100">{proposal.name}</span>
                      {isRecommended && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-600/20 text-emerald-300">
                          Recommandé
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">{proposal.description}</p>
                    <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                      <span>Dossiers estimés : {proposal.statistics?.estimatedFolders ?? proposal.estimatedFolders ?? '—'}</span>
                      <span>
                        Fichiers :{' '}
                        {proposal.statistics?.estimatedFiles
                          ?? Math.round((proposal as any).avgFilesPerFolder * (proposal as any).estimatedFolders)
                          ?? '—'}
                      </span>
                      <span>Niveaux : {(proposal as any).hierarchy?.length ?? (proposal as any).structure?.length ?? '—'}</span>
                    </div>
                    {proposal.advantages && proposal.advantages.length > 0 && (
                      <div className="text-xs text-emerald-300">
                        ✅ {proposal.advantages.slice(0, 2).join(' · ')}
                      </div>
                    )}
                    {proposal.disadvantages && proposal.disadvantages.length > 0 && (
                      <div className="text-xs text-rose-300">
                        ⚠️ {proposal.disadvantages.slice(0, 2).join(' · ')}
                      </div>
                    )}
                  </div>
                </label>
              ) : (
                <div>
                  <div className="font-medium text-slate-100">{proposal.name}</div>
                  <div className="text-xs text-slate-400">{proposal.description}</div>
                  {(proposal as any).statistics && (
                    <div className="text-xs text-slate-500 mt-1">
                      Dossiers estimés : {(proposal as any).statistics.estimatedFolders ?? '—'} · Fichiers :{' '}
                      {(proposal as any).statistics.estimatedFiles ?? '—'}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    );
  };

  const renderDuplicateStrategySelector = () => (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-3">
      <h2 className="text-lg font-medium text-slate-100">Stratégie de gestion des doublons</h2>
      <p className="text-sm text-slate-400">
        Choisissez comment les éventuels doublons seront traités lors de l'organisation finale.
      </p>
      <div className="grid gap-2 text-sm text-slate-300">
        {[
          { id: 'merge', label: 'Fusionner automatiquement les doublons similaires' },
          { id: 'keep-best', label: 'Conserver la meilleure version détectée' },
          { id: 'keep-all', label: 'Conserver toutes les versions (aucune fusion)' },
          { id: 'manual', label: 'Décider manuellement pendant l’organisation' }
        ].map(option => (
          <label key={option.id} className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="duplicate-strategy"
              value={option.id}
              checked={duplicateStrategy === option.id}
              onChange={() => setDuplicateStrategy(option.id as typeof duplicateStrategy)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <section className="h-full flex flex-col bg-slate-900 text-slate-100">
      <header className="px-6 py-4 border-b border-slate-800">
        <h1 className="text-2xl font-semibold">Phase {phaseNumber} · Matrix & Structure</h1>
        <p className="text-sm text-slate-400">
          Choix de la structure cible et consolidation des regroupements intelligents.
        </p>
      </header>

      <main className="flex-1 overflow-auto px-6 py-6 space-y-6">
        <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-3">
          <h2 className="text-lg font-medium text-slate-100">Synthèse des propositions</h2>
          {renderProposalSummary()}
        </section>

        <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-3">
          <h2 className="text-lg font-medium text-slate-100">Fusion intelligente</h2>
          {data?.fusionGroups ? (
            <p className="text-sm text-slate-300">
              Groupes potentiels : {data.fusionGroups.length}
            </p>
          ) : (
            <p className="text-sm text-slate-400">Aucun groupe détecté.</p>
          )}
        </section>

        {pendingAction && renderDuplicateStrategySelector()}
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
        {pendingAction ? (
          <button
            type="button"
            onClick={handleConfirmSelection}
            disabled={!selectedStructureId}
            className="px-5 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-400"
          >
            Valider la structure sélectionnée
          </button>
        ) : (
          <button
            type="button"
            onClick={handleProceed}
            disabled={!data}
            className="px-5 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-400"
          >
            Continuer vers Phase 4
          </button>
        )}
      </footer>
    </section>
  );
}
