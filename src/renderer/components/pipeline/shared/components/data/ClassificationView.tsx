/**
 * ClassificationView - Affichage des résultats de classification
 * Utilisé dans Phase 2 pour montrer les packs classifiés
 */

import React, { useState, useMemo } from 'react';
import { PackList, ClassifiedPack } from './PackList';
import { formatConfidence, formatPercentage } from '../../utils/formatters';

interface ClassificationViewProps {
  classifiedPacks: ClassifiedPack[];
  onPackAction?: (pack: ClassifiedPack, action: string) => void;
  onPackSelect?: (pack: ClassifiedPack, selected: boolean) => void;
  selectedPacks?: string[];
  showStats?: boolean;
  groupBy?: 'style' | 'family' | 'confidence' | 'method';
  className?: string;
}

export function ClassificationView({
  classifiedPacks,
  onPackAction,
  onPackSelect,
  selectedPacks = [],
  showStats = true,
  groupBy = 'style',
  className = ''
}: ClassificationViewProps) {
  const [filterConfidence, setFilterConfidence] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [filterMethod, setFilterMethod] = useState<'all' | 'lexical' | 'contextual' | 'ai' | 'manual'>('all');

  // Statistiques
  const stats = useMemo(() => {
    const total = classifiedPacks.length;
    const byStyle = classifiedPacks.reduce((acc, pack) => {
      if (pack.style) {
        acc[pack.style] = (acc[pack.style] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const byConfidence = {
      high: classifiedPacks.filter(p => (p.confidence || 0) >= 0.8).length,
      medium: classifiedPacks.filter(p => (p.confidence || 0) >= 0.5 && (p.confidence || 0) < 0.8).length,
      low: classifiedPacks.filter(p => (p.confidence || 0) < 0.5).length
    };

    const averageConfidence = classifiedPacks.reduce((sum, pack) => sum + (pack.confidence || 0), 0) / total;

    const quarantined = classifiedPacks.filter(p => p.isQuarantined).length;

    return {
      total,
      byStyle,
      byConfidence,
      averageConfidence,
      quarantined
    };
  }, [classifiedPacks]);

  // Filtrage
  const filteredPacks = useMemo(() => {
    return classifiedPacks.filter(pack => {
      // Filtre par confiance
      if (filterConfidence !== 'all') {
        const confidence = pack.confidence || 0;
        if (filterConfidence === 'high' && confidence < 0.8) return false;
        if (filterConfidence === 'medium' && (confidence < 0.5 || confidence >= 0.8)) return false;
        if (filterConfidence === 'low' && confidence >= 0.5) return false;
      }

      // Filtre par méthode
      if (filterMethod !== 'all' && pack.method !== filterMethod) {
        return false;
      }

      return true;
    });
  }, [classifiedPacks, filterConfidence, filterMethod]);

  // Groupement
  const [groupByState, setGroupByState] = useState(groupBy);

  const groupedPacks = useMemo(() => {
    const groups = filteredPacks.reduce((acc, pack) => {
      let key: string;
      switch (groupByState) {
        case 'style':
          key = pack.style || 'Non classifié';
          break;
        case 'family':
          key = pack.family || 'Famille inconnue';
          break;
        case 'confidence':
          const conf = pack.confidence || 0;
          key = conf >= 0.8 ? 'Confiance élevée' : conf >= 0.5 ? 'Confiance moyenne' : 'Confiance faible';
          break;
        case 'method':
          key = pack.method || 'Méthode inconnue';
          break;
        default:
          key = 'Tous';
      }

      if (!acc[key]) acc[key] = [];
      acc[key].push(pack);
      return acc;
    }, {} as Record<string, ClassifiedPack[]>);

    // Trier les groupes par nombre de packs
    return Object.entries(groups)
      .sort(([, a], [, b]) => b.length - a.length)
      .reduce((acc, [key, packs]) => {
        acc[key] = packs;
        return acc;
      }, {} as Record<string, ClassifiedPack[]>);
  }, [filteredPacks, groupByState]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Statistiques */}
      {showStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-sm text-gray-400">Packs classifiés</div>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-400">{stats.byConfidence.high}</div>
            <div className="text-sm text-gray-400">Confiance élevée</div>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-400">
              {(stats.averageConfidence * 100).toFixed(0)}%
            </div>
            <div className="text-sm text-gray-400">Confiance moyenne</div>
          </div>

          {stats.quarantined > 0 && (
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-400">{stats.quarantined}</div>
              <div className="text-sm text-gray-400">En quarantaine</div>
            </div>
          )}
        </div>
      )}

      {/* Filtres */}
      <div className="flex items-center space-x-4 bg-gray-800/30 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-400">Confiance:</label>
          <select
            value={filterConfidence}
            onChange={(e) => setFilterConfidence(e.target.value as any)}
            className="bg-gray-700 text-white rounded px-3 py-1 text-sm"
          >
            <option value="all">Toutes</option>
            <option value="high">Élevée (≥80%)</option>
            <option value="medium">Moyenne (50-79%)</option>
            <option value="low">Faible (&lt;50%)</option>
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-400">Méthode:</label>
          <select
            value={filterMethod}
            onChange={(e) => setFilterMethod(e.target.value as any)}
            className="bg-gray-700 text-white rounded px-3 py-1 text-sm"
          >
            <option value="all">Toutes</option>
            <option value="lexical">Lexicale</option>
            <option value="contextual">Contextuelle</option>
            <option value="ai">IA</option>
            <option value="manual">Manuelle</option>
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-400">Grouper par:</label>
          <select
            value={groupByState}
            onChange={(e) => setGroupByState(e.target.value as any)}
            className="bg-gray-700 text-white rounded px-3 py-1 text-sm"
          >
            <option value="style">Style</option>
            <option value="family">Famille</option>
            <option value="confidence">Confiance</option>
            <option value="method">Méthode</option>
          </select>
        </div>
      </div>

      {/* Répartition par style */}
      {groupByState === 'style' && Object.keys(stats.byStyle).length > 0 && (
        <div className="bg-gray-800/30 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Répartition par style</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.entries(stats.byStyle)
              .sort(([, a], [, b]) => b - a)
              .map(([style, count]) => (
                <div key={style} className="bg-gray-700/50 rounded-lg p-3">
                  <div className="font-medium text-white">{style}</div>
                  <div className="text-sm text-gray-400">
                    {count} packs ({formatPercentage(count, stats.total)})
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Groupes de packs */}
      <div className="space-y-6">
        {Object.entries(groupedPacks).map(([groupName, packs]) => (
          <div key={groupName} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white">
                {groupName} ({packs.length})
              </h3>

              {/* Statistiques du groupe */}
              {packs.length > 0 && (
                <div className="flex items-center space-x-4 text-sm text-gray-400">
                  <span>
                    Confiance moyenne: {(packs.reduce((sum, p) => sum + (p.confidence || 0), 0) / packs.length * 100).toFixed(0)}%
                  </span>
                  {packs.filter(p => p.isQuarantined).length > 0 && (
                    <span className="text-yellow-400">
                      {packs.filter(p => p.isQuarantined).length} en quarantaine
                    </span>
                  )}
                </div>
              )}
            </div>

            <PackList
              packs={packs}
              variant="default"
              selectable={!!onPackSelect}
              selectedPacks={selectedPacks}
              onPackClick={onPackAction ? (pack) => onPackAction(pack, 'view') : undefined}
              onPackSelect={onPackSelect}
              onPackAction={onPackAction}
              showSearch={false}
              showStats={false}
              pageSize={20}
            />
          </div>
        ))}
      </div>

      {/* Message si aucun résultat */}
      {Object.keys(groupedPacks).length === 0 && (
        <div className="text-center py-16">
          <div className="w-24 h-24 bg-gray-700 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🔍</span>
          </div>
          <h3 className="text-xl font-medium text-gray-300 mb-2">Aucun pack trouvé</h3>
          <p className="text-gray-400">
            Essayez de modifier les filtres pour voir plus de résultats.
          </p>
        </div>
      )}
    </div>
  );
}
