/**
 * PackList - Composant ultra-réutilisé pour afficher des listes de packs
 * Props flexibles selon le contexte (classification, doublons, etc.)
 */

import React, { useState, useMemo } from 'react';
import { formatBytes, formatConfidence, generateColorFromString, truncatePath } from '../../utils/formatters';

// Types pour les packs selon différents contextes
export interface BasePack {
  id: string;
  name: string;
  path: string;
  size: number;
  audioFiles?: number;
  presetFiles?: number;
  totalFiles?: number;
}

export interface ClassifiedPack extends BasePack {
  style?: string;
  family?: string;
  confidence?: number;
  method?: 'lexical' | 'contextual' | 'ai' | 'manual';
  suggestedStyles?: string[];
  isQuarantined?: boolean;
}

export interface AnalyzedPack extends BasePack {
  fileTypes?: Record<string, number>;
  complexity?: number;
  structure?: string;
  lastModified?: number;
}

export interface DuplicatePack extends BasePack {
  duplicateOf?: string;
  similarity?: number;
  hash?: string;
  groupId?: string;
}

export type PackVariant = BasePack | ClassifiedPack | AnalyzedPack | DuplicatePack;

interface PackListProps<T extends PackVariant = PackVariant> {
  // Données
  packs: T[];
  loading?: boolean;
  error?: string;

  // Apparence
  variant?: 'default' | 'grid' | 'detailed' | 'compact';
  showSearch?: boolean;
  showFilters?: boolean;
  showStats?: boolean;
  selectable?: boolean;
  multiSelect?: boolean;

  // Colonnes personnalisées
  columns?: Array<{
    key: string;
    label: string;
    render?: (pack: T) => React.ReactNode;
    sortable?: boolean;
    width?: string;
  }>;

  // Filtres
  filters?: Record<string, any>;
  onFiltersChange?: (filters: Record<string, any>) => void;

  // Actions
  onPackClick?: (pack: T) => void;
  onPackSelect?: (pack: T, selected: boolean) => void;
  onPackAction?: (pack: T, action: string) => void;
  selectedPacks?: string[];

  // Tri
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSortChange?: (sortBy: string, order: 'asc' | 'desc') => void;

  // Pagination
  pageSize?: number;
  showPagination?: boolean;

  // Style
  className?: string;
  emptyMessage?: string;
}

export function PackList<T extends PackVariant = PackVariant>({
  packs,
  loading = false,
  error,
  variant = 'default',
  showSearch = true,
  showFilters = false,
  showStats = true,
  selectable = false,
  multiSelect = false,
  columns,
  filters = {},
  onFiltersChange,
  onPackClick,
  onPackSelect,
  onPackAction,
  selectedPacks = [],
  sortBy = 'name',
  sortOrder = 'asc',
  onSortChange,
  pageSize = 50,
  showPagination = true,
  className = '',
  emptyMessage = 'Aucun pack trouvé'
}: PackListProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [localFilters, setLocalFilters] = useState(filters);

  // Filtrage et tri
  const filteredAndSortedPacks = useMemo(() => {
    let result = [...packs];

    // Recherche textuelle
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(pack =>
        pack.name.toLowerCase().includes(search) ||
        pack.path.toLowerCase().includes(search) ||
        ('style' in pack && pack.style?.toLowerCase().includes(search)) ||
        ('family' in pack && pack.family?.toLowerCase().includes(search))
      );
    }

    // Filtres personnalisés
    Object.entries(localFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== '' && value !== null) {
        result = result.filter(pack => {
          const packValue = (pack as any)[key];
          if (Array.isArray(value)) {
            return value.includes(packValue);
          }
          if (typeof value === 'string') {
            return packValue?.toString().toLowerCase().includes(value.toLowerCase());
          }
          return packValue === value;
        });
      }
    });

    // Tri
    result.sort((a, b) => {
      const aValue = (a as any)[sortBy];
      const bValue = (b as any)[sortBy];

      let comparison = 0;
      if (aValue < bValue) comparison = -1;
      else if (aValue > bValue) comparison = 1;

      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [packs, searchTerm, localFilters, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedPacks.length / pageSize);
  const paginatedPacks = filteredAndSortedPacks.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Statistiques
  const stats = useMemo(() => {
    const totalSize = filteredAndSortedPacks.reduce((sum, pack) => sum + pack.size, 0);
    const totalAudioFiles = filteredAndSortedPacks.reduce((sum, pack) => sum + (pack.audioFiles || 0), 0);

    // Stats spécifiques selon le type
    const classifiedPacks = filteredAndSortedPacks.filter(pack => 'style' in pack && pack.style);
    const quarantinedPacks = filteredAndSortedPacks.filter(pack => 'isQuarantined' in pack && pack.isQuarantined);

    return {
      total: filteredAndSortedPacks.length,
      totalSize,
      totalAudioFiles,
      classified: classifiedPacks.length,
      quarantined: quarantinedPacks.length
    };
  }, [filteredAndSortedPacks]);

  // Gestion de la sélection
  const handlePackSelect = (pack: T, selected: boolean) => {
    onPackSelect?.(pack, selected);
  };

  const isPackSelected = (packId: string) => selectedPacks.includes(packId);

  // Rendu d'un pack selon le variant
  const renderPack = (pack: T) => {
    switch (variant) {
      case 'grid':
        return renderPackGrid(pack);
      case 'detailed':
        return renderPackDetailed(pack);
      case 'compact':
        return renderPackCompact(pack);
      default:
        return renderPackDefault(pack);
    }
  };

  const renderPackDefault = (pack: T) => {
    const colors = generateColorFromString(pack.name);
    const isClassified = 'style' in pack && pack.style;
    const isQuarantined = 'isQuarantined' in pack && pack.isQuarantined;

    return (
      <div
        key={pack.id}
        className={`
          flex items-center space-x-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700/50
          hover:bg-gray-700/50 transition-all duration-200 cursor-pointer
          ${isPackSelected(pack.id) ? 'ring-2 ring-blue-500 bg-blue-900/20' : ''}
          ${isQuarantined ? 'border-yellow-500/50' : ''}
        `}
        onClick={() => onPackClick?.(pack)}
      >
        {/* Checkbox de sélection */}
        {selectable && (
          <input
            type="checkbox"
            checked={isPackSelected(pack.id)}
            onChange={(e) => {
              e.stopPropagation();
              handlePackSelect(pack, e.target.checked);
            }}
            className="w-4 h-4 text-blue-600 rounded"
          />
        )}

        {/* Icône */}
        <div className={`w-12 h-12 ${colors.bg} ${colors.border} border rounded-xl flex items-center justify-center flex-shrink-0`}>
          <span className={`text-xl ${colors.text}`}>
            {isQuarantined ? '❓' : isClassified ? '🎵' : '📦'}
          </span>
        </div>

        {/* Contenu principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            <h3 className="text-white font-medium truncate">{pack.name}</h3>

            {/* Badges */}
            {isClassified && (
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                {(pack as ClassifiedPack).style}
              </span>
            )}

            {isQuarantined && (
              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                Quarantaine
              </span>
            )}

            {'confidence' in pack && pack.confidence !== undefined && (
              <span className={`px-2 py-1 text-xs rounded-full ${formatConfidence(pack.confidence).bgColor} ${formatConfidence(pack.confidence).color}`}>
                {(pack.confidence * 100).toFixed(0)}%
              </span>
            )}
          </div>

          <div className="flex items-center space-x-4 text-sm text-gray-400">
            <span>{formatBytes(pack.size)}</span>
            {pack.audioFiles && (
              <span>{pack.audioFiles} audio</span>
            )}
            <span className="truncate">{truncatePath(pack.path, 40)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2">
          {onPackAction && (
            <div className="flex space-x-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPackAction(pack, 'view');
                }}
                className="p-2 text-gray-400 hover:text-blue-400 rounded-lg hover:bg-gray-700 transition-colors"
                title="Voir détails"
              >
                👁️
              </button>

              {isQuarantined && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPackAction(pack, 'resolve');
                  }}
                  className="p-2 text-gray-400 hover:text-green-400 rounded-lg hover:bg-gray-700 transition-colors"
                  title="Résoudre"
                >
                  ✅
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPackGrid = (pack: T) => {
    const colors = generateColorFromString(pack.name);
    const isClassified = 'style' in pack && pack.style;
    const isQuarantined = 'isQuarantined' in pack && pack.isQuarantined;

    return (
      <div
        key={pack.id}
        className={`
          p-4 bg-gray-800/50 rounded-lg border border-gray-700/50
          hover:bg-gray-700/50 transition-all duration-200 cursor-pointer
          ${isPackSelected(pack.id) ? 'ring-2 ring-blue-500 bg-blue-900/20' : ''}
          ${isQuarantined ? 'border-yellow-500/50' : ''}
        `}
        onClick={() => onPackClick?.(pack)}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          {selectable && (
            <input
              type="checkbox"
              checked={isPackSelected(pack.id)}
              onChange={(e) => {
                e.stopPropagation();
                handlePackSelect(pack, e.target.checked);
              }}
              className="w-4 h-4 text-blue-600 rounded"
            />
          )}

          <div className={`w-10 h-10 ${colors.bg} rounded-lg flex items-center justify-center ml-auto`}>
            <span className={`text-lg ${colors.text}`}>
              {isQuarantined ? '❓' : isClassified ? '🎵' : '📦'}
            </span>
          </div>
        </div>

        {/* Contenu */}
        <div className="space-y-2">
          <h3 className="text-white font-medium text-sm line-clamp-2">{pack.name}</h3>

          <div className="text-xs text-gray-400 space-y-1">
            <div>{formatBytes(pack.size)}</div>
            {pack.audioFiles && <div>{pack.audioFiles} fichiers audio</div>}
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-1">
            {isClassified && (
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                {(pack as ClassifiedPack).style}
              </span>
            )}

            {isQuarantined && (
              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                Quarantaine
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderPackDetailed = (pack: T) => {
    // Version détaillée avec plus d'infos
    return renderPackDefault(pack); // Pour l'instant, même chose
  };

  const renderPackCompact = (pack: T) => {
    const isSelected = isPackSelected(pack.id);

    return (
      <div
        key={pack.id}
        className={`
          flex items-center space-x-3 p-2 rounded hover:bg-gray-800/50 transition-colors cursor-pointer
          ${isSelected ? 'bg-blue-900/20' : ''}
        `}
        onClick={() => onPackClick?.(pack)}
      >
        {selectable && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              handlePackSelect(pack, e.target.checked);
            }}
            className="w-3 h-3 text-blue-600 rounded"
          />
        )}

        <div className="flex-1 min-w-0">
          <div className="text-sm text-white truncate">{pack.name}</div>
          <div className="text-xs text-gray-400">{formatBytes(pack.size)}</div>
        </div>

        {'style' in pack && pack.style && (
          <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">
            {pack.style}
          </span>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">Chargement des packs...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-900/30 border border-red-600/50 rounded-lg p-6 ${className}`}>
        <div className="flex items-center space-x-3">
          <span className="text-red-400 text-xl">❌</span>
          <div>
            <h3 className="text-red-300 font-medium">Erreur de chargement</h3>
            <p className="text-red-200 text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header avec recherche et stats */}
      <div className="flex items-center justify-between">
        {showSearch && (
          <div className="flex-1 max-w-md">
            <input
              type="text"
              placeholder="Rechercher des packs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}

        {showStats && (
          <div className="flex items-center space-x-4 text-sm text-gray-400">
            <span>{stats.total} packs</span>
            <span>{formatBytes(stats.totalSize)}</span>
            {stats.totalAudioFiles > 0 && (
              <span>{stats.totalAudioFiles} audio</span>
            )}
            {stats.classified > 0 && (
              <span>{stats.classified} classifiés</span>
            )}
            {stats.quarantined > 0 && (
              <span className="text-yellow-400">{stats.quarantined} en quarantaine</span>
            )}
          </div>
        )}
      </div>

      {/* Liste des packs */}
      {filteredAndSortedPacks.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-24 h-24 bg-gray-700 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">📦</span>
          </div>
          <h3 className="text-xl font-medium text-gray-300 mb-2">Aucun pack trouvé</h3>
          <p className="text-gray-400">{emptyMessage}</p>
        </div>
      ) : (
        <div className={`
          ${variant === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' : 'space-y-3'}
        `}>
          {paginatedPacks.map(renderPack)}
        </div>
      )}

      {/* Pagination */}
      {showPagination && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-400">
            Affichage {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredAndSortedPacks.length)} sur {filteredAndSortedPacks.length}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded text-sm transition-colors"
            >
              Précédent
            </button>

            <span className="text-sm text-gray-400">
              Page {currentPage} sur {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded text-sm transition-colors"
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </div>
  );
}