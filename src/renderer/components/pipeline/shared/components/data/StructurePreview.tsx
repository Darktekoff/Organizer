/**
 * StructurePreview - Aperçu d'une structure d'organisation
 * Utilisé dans Phase 3 pour le choix de structure
 */

import React from 'react';
import { formatNumber } from '../../utils/formatters';

export interface StructureProposal {
  id: string;
  name: string;
  description: string;
  advantages: string[];
  considerations: string[];
  estimatedFolders: number;
  fusionGroups?: number;
  duplicatesResolved?: number;
  score?: number;
  preview: Array<{
    path: string;
    example: string;
    fileCount?: number;
  }>;
}

interface StructurePreviewProps {
  proposal: StructureProposal;
  previewPacks?: Array<{
    name: string;
    style?: string;
    family?: string;
    type?: string;
  }>;
  isSelected: boolean;
  onSelect: () => void;
  showDetails?: boolean;
  className?: string;
}

export function StructurePreview({
  proposal,
  previewPacks = [],
  isSelected,
  onSelect,
  showDetails = true,
  className = ''
}: StructurePreviewProps) {
  const getScoreColor = (score?: number) => {
    if (!score) return 'text-gray-400';
    if (score >= 0.8) return 'text-green-400';
    if (score >= 0.6) return 'text-blue-400';
    if (score >= 0.4) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getScoreLabel = (score?: number) => {
    if (!score) return 'Non évalué';
    if (score >= 0.8) return 'Excellent';
    if (score >= 0.6) return 'Bon';
    if (score >= 0.4) return 'Moyen';
    return 'Faible';
  };

  return (
    <div
      className={`
        relative p-6 rounded-xl border-2 cursor-pointer transition-all duration-200
        ${isSelected
          ? 'border-blue-500 bg-blue-900/20 shadow-lg shadow-blue-500/20'
          : 'border-gray-600 hover:border-gray-500 hover:bg-gray-700/30'
        }
        ${className}
      `}
      onClick={onSelect}
    >
      {/* Badge sélectionné */}
      {isSelected && (
        <div className="absolute -top-3 -right-3">
          <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center">
            ✓
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-xl font-bold text-white mb-2">{proposal.name}</h3>
          <p className="text-gray-400 text-sm leading-relaxed">{proposal.description}</p>
        </div>

        {/* Score */}
        {proposal.score !== undefined && (
          <div className="text-right ml-4">
            <div className={`text-2xl font-bold ${getScoreColor(proposal.score)}`}>
              {(proposal.score * 100).toFixed(0)}%
            </div>
            <div className="text-xs text-gray-400">{getScoreLabel(proposal.score)}</div>
          </div>
        )}
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="text-lg font-semibold text-white">{formatNumber(proposal.estimatedFolders)}</div>
          <div className="text-xs text-gray-400">Dossiers estimés</div>
        </div>

        {proposal.fusionGroups !== undefined && (
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="text-lg font-semibold text-purple-400">{formatNumber(proposal.fusionGroups)}</div>
            <div className="text-xs text-gray-400">Groupes fusionnés</div>
          </div>
        )}

        {proposal.duplicatesResolved !== undefined && (
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="text-lg font-semibold text-green-400">{formatNumber(proposal.duplicatesResolved)}</div>
            <div className="text-xs text-gray-400">Doublons résolus</div>
          </div>
        )}
      </div>

      {/* Aperçu de la structure */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-white mb-3">Aperçu de la structure :</h4>
        <div className="bg-gray-900/50 rounded-lg p-4 space-y-2 max-h-48 overflow-y-auto">
          {proposal.preview.slice(0, 8).map((item, index) => (
            <div key={index} className="flex items-center space-x-3 text-sm">
              <span className="text-gray-500">📁</span>
              <span className="text-gray-300 font-mono text-xs flex-1">{item.path}</span>
              <span className="text-blue-400">{item.example}</span>
              {item.fileCount && (
                <span className="text-gray-500 text-xs">({item.fileCount})</span>
              )}
            </div>
          ))}
          {proposal.preview.length > 8 && (
            <div className="text-xs text-gray-500 text-center pt-2">
              +{proposal.preview.length - 8} autres dossiers...
            </div>
          )}
        </div>
      </div>

      {/* Avantages et considérations */}
      {showDetails && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Avantages */}
          <div>
            <h4 className="text-sm font-semibold text-green-400 mb-2">✓ Avantages :</h4>
            <ul className="space-y-1">
              {proposal.advantages.map((advantage, index) => (
                <li key={index} className="text-sm text-gray-300 flex items-start space-x-2">
                  <span className="text-green-400 mt-0.5">•</span>
                  <span>{advantage}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Considérations */}
          {proposal.considerations.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-yellow-400 mb-2">⚠ Considérations :</h4>
              <ul className="space-y-1">
                {proposal.considerations.map((consideration, index) => (
                  <li key={index} className="text-sm text-gray-300 flex items-start space-x-2">
                    <span className="text-yellow-400 mt-0.5">•</span>
                    <span>{consideration}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Exemples avec vrais packs */}
      {previewPacks.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-white mb-3">
            Exemples avec vos packs :
          </h4>
          <div className="bg-gray-900/50 rounded-lg p-3 space-y-1 max-h-32 overflow-y-auto">
            {previewPacks.slice(0, 5).map((pack, index) => {
              // Simuler le chemin selon la structure
              const path = proposal.preview[0]?.path
                .replace('{{Family}}', pack.family || 'Electronic')
                .replace('{{Type}}', pack.type || 'Drums')
                .replace('{{Style}}', pack.style || 'Techno');

              return (
                <div key={index} className="text-xs text-gray-400">
                  <span className="text-gray-500">📁</span>
                  <span className="ml-2 font-mono">{path}/</span>
                  <span className="text-blue-400">{pack.name}</span>
                </div>
              );
            })}
            {previewPacks.length > 5 && (
              <div className="text-xs text-gray-500 text-center pt-1">
                +{previewPacks.length - 5} autres exemples...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Comparaison de structures côte à côte
 */
interface StructureComparisonProps {
  proposals: StructureProposal[];
  selectedId?: string;
  onSelect: (proposalId: string) => void;
  previewPacks?: Array<{
    name: string;
    style?: string;
    family?: string;
    type?: string;
  }>;
  className?: string;
}

export function StructureComparison({
  proposals,
  selectedId,
  onSelect,
  previewPacks = [],
  className = ''
}: StructureComparisonProps) {
  return (
    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${className}`}>
      {proposals.map((proposal) => (
        <StructurePreview
          key={proposal.id}
          proposal={proposal}
          previewPacks={previewPacks}
          isSelected={selectedId === proposal.id}
          onSelect={() => onSelect(proposal.id)}
          showDetails={true}
        />
      ))}
    </div>
  );
}