/**
 * PhaseNavigation - Navigation principale entre phases
 * Breadcrumb avec indication phase actuelle/complétées
 */

import React from 'react';
import { NavigationProps } from '../../../types/UITypes';

interface PhaseNavigationProps extends Omit<NavigationProps, 'totalPhases'> {
  totalPhases?: number;
  showProgress?: boolean;
  compact?: boolean;
  className?: string;
}

const PHASE_CONFIG = [
  {
    number: 0,
    name: 'Preparation',
    shortName: 'Prep',
    icon: '🔍',
    color: 'blue',
    description: 'Quick scan et réorganisation'
  },
  {
    number: 1,
    name: 'Discovery',
    shortName: 'Disc',
    icon: '🔬',
    color: 'green',
    description: 'Analyse approfondie'
  },
  {
    number: 2,
    name: 'Classification',
    shortName: 'Class',
    icon: '🧠',
    color: 'purple',
    description: 'Classification automatique'
  },
  {
    number: 3,
    name: 'Matrix & Structure',
    shortName: 'Matrix',
    icon: '📊',
    color: 'orange',
    description: 'Génération matrice et choix structure'
  },
  {
    number: 4,
    name: 'Organization',
    shortName: 'Org',
    icon: '📁',
    color: 'indigo',
    description: 'Organisation et fusion'
  },
  {
    number: 5,
    name: 'Final Validation',
    shortName: 'Valid',
    icon: '✅',
    color: 'green',
    description: 'Validation finale et rapports'
  }
];

const COLOR_CLASSES = {
  blue: {
    bg: 'bg-blue-600',
    hover: 'hover:bg-blue-500',
    border: 'border-blue-600',
    text: 'text-blue-600'
  },
  green: {
    bg: 'bg-green-600',
    hover: 'hover:bg-green-500',
    border: 'border-green-600',
    text: 'text-green-600'
  },
  purple: {
    bg: 'bg-purple-600',
    hover: 'hover:bg-purple-500',
    border: 'border-purple-600',
    text: 'text-purple-600'
  },
  orange: {
    bg: 'bg-orange-600',
    hover: 'hover:bg-orange-500',
    border: 'border-orange-600',
    text: 'text-orange-600'
  },
  indigo: {
    bg: 'bg-indigo-600',
    hover: 'hover:bg-indigo-500',
    border: 'border-indigo-600',
    text: 'text-indigo-600'
  }
};

export function PhaseNavigation({
  currentPhase,
  totalPhases = 6,
  navigationState,
  onNavigate,
  onStop,
  onPause,
  showProgress = true,
  compact = false,
  className = ''
}: PhaseNavigationProps) {
  const phases = PHASE_CONFIG.slice(0, totalPhases);
  const currentPhaseConfig = phases[currentPhase];

  const getPhaseStatus = (phaseNumber: number) => {
    if (phaseNumber < currentPhase) return 'completed';
    if (phaseNumber === currentPhase) return 'current';
    return 'pending';
  };

  const canNavigateToPhase = (phaseNumber: number) => {
    // Peut naviguer vers phases précédentes si navigation arrière autorisée
    if (phaseNumber < currentPhase) return navigationState.canGoBack;
    // Peut naviguer vers phase courante
    if (phaseNumber === currentPhase) return true;
    // Ne peut pas naviguer vers phases futures
    return false;
  };

  const getPhaseButtonClasses = (phase: typeof PHASE_CONFIG[0], status: string) => {
    const colors = COLOR_CLASSES[phase.color as keyof typeof COLOR_CLASSES] || COLOR_CLASSES.blue;
    const canNavigate = canNavigateToPhase(phase.number);

    if (status === 'current') {
      return `${colors.bg} text-white shadow-lg transform scale-105`;
    } else if (status === 'completed') {
      return `bg-green-600 text-white ${canNavigate ? `${colors.hover} cursor-pointer` : 'cursor-default'}`;
    } else {
      return 'bg-gray-700 text-gray-400 cursor-not-allowed';
    }
  };

  if (compact) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        {/* Indicateur compact */}
        <div className="flex items-center space-x-1">
          {phases.map((phase) => {
            const status = getPhaseStatus(phase.number);
            return (
              <button
                key={phase.number}
                onClick={() => canNavigateToPhase(phase.number) && onNavigate(phase.number)}
                disabled={!canNavigateToPhase(phase.number)}
                className={`
                  w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all duration-200
                  ${getPhaseButtonClasses(phase, status)}
                `}
                title={`Phase ${phase.number}: ${phase.name}`}
              >
                {phase.number}
              </button>
            );
          })}
        </div>

        {/* Progression */}
        {showProgress && (
          <div className="flex items-center space-x-2 text-sm text-gray-400">
            <span>{currentPhase + 1}/{totalPhases}</span>
            <div className="w-16 bg-gray-700 rounded-full h-1.5">
              <div
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${((currentPhase + 1) / totalPhases) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-gray-800/90 backdrop-blur-sm border-b border-gray-600/50 ${className}`}>
      <div className="max-w-screen-xl mx-auto px-6 py-4">
        {/* Header avec titre phase actuelle */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className={`w-12 h-12 ${COLOR_CLASSES[currentPhaseConfig?.color as keyof typeof COLOR_CLASSES]?.bg || 'bg-blue-600'} rounded-xl flex items-center justify-center shadow-lg`}>
              <span className="text-white text-xl">
                {currentPhaseConfig?.icon || '🔍'}
              </span>
            </div>

            <div>
              <h2 className="text-xl font-bold text-white">
                Phase {currentPhase}: {currentPhaseConfig?.name || 'Inconnue'}
              </h2>
              <p className="text-sm text-gray-400">
                {currentPhaseConfig?.description || 'Phase en cours'}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-3">
            {navigationState.canPause && onPause && (
              <button
                onClick={onPause}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg font-medium transition-all duration-200 flex items-center space-x-2"
              >
                <span>⏸️</span>
                <span>Pause</span>
              </button>
            )}

            {navigationState.canStop && onStop && (
              <button
                onClick={onStop}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-all duration-200 flex items-center space-x-2"
              >
                <span>⏹️</span>
                <span>Arrêter</span>
              </button>
            )}
          </div>
        </div>

        {/* Breadcrumb des phases */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {phases.map((phase, index) => {
              const status = getPhaseStatus(phase.number);
              const canNavigate = canNavigateToPhase(phase.number);

              return (
                <React.Fragment key={phase.number}>
                  <button
                    onClick={() => canNavigate && onNavigate(phase.number)}
                    disabled={!canNavigate}
                    className={`
                      flex items-center space-x-3 px-4 py-2 rounded-lg transition-all duration-200
                      ${getPhaseButtonClasses(phase, status)}
                      ${canNavigate ? 'hover:transform hover:scale-105' : ''}
                    `}
                    title={phase.description}
                  >
                    <span className="text-lg">{phase.icon}</span>
                    <div className="text-left">
                      <div className="font-bold text-sm">Phase {phase.number}</div>
                      <div className="text-xs opacity-90">{phase.shortName}</div>
                    </div>
                    {status === 'completed' && (
                      <span className="text-xs">✓</span>
                    )}
                  </button>

                  {/* Séparateur */}
                  {index < phases.length - 1 && (
                    <div className="flex items-center">
                      <div className={`w-6 h-0.5 ${
                        phase.number < currentPhase ? 'bg-green-500' : 'bg-gray-600'
                      } transition-colors duration-300`} />
                      <div className="w-2 h-2 bg-gray-600 rounded-full mx-1" />
                      <div className={`w-6 h-0.5 ${
                        phase.number + 1 <= currentPhase ? 'bg-green-500' : 'bg-gray-600'
                      } transition-colors duration-300`} />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Progression globale */}
          {showProgress && (
            <div className="text-right">
              <div className="text-sm font-medium text-white mb-1">
                {Math.round(((currentPhase + 1) / totalPhases) * 100)}% terminé
              </div>
              <div className="w-32 bg-gray-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${((currentPhase + 1) / totalPhases) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Version minimaliste pour sidebar ou espaces restreints
 */
interface MiniPhaseNavigationProps {
  currentPhase: number;
  totalPhases?: number;
  onNavigate: (phase: number) => void;
  canGoBack?: boolean;
  className?: string;
}

export function MiniPhaseNavigation({
  currentPhase,
  totalPhases = 6,
  onNavigate,
  canGoBack = true,
  className = ''
}: MiniPhaseNavigationProps) {
  const phases = PHASE_CONFIG.slice(0, totalPhases);
  const buttonClasses = (phase: typeof PHASE_CONFIG[0], status: string, canNavigate: boolean) => {
    const colors = COLOR_CLASSES[phase.color as keyof typeof COLOR_CLASSES] || COLOR_CLASSES.blue;

    if (status === 'current') {
      return `${colors.bg} text-white shadow-lg transform scale-105`;
    }

    if (status === 'completed') {
      return `bg-green-600 text-white ${canNavigate ? `${colors.hover} cursor-pointer` : 'cursor-default'}`;
    }

    return 'bg-gray-700 text-gray-400 cursor-not-allowed';
  };

  return (
    <div className={`flex flex-col space-y-2 ${className}`}>
      {phases.map((phase) => {
        const status = currentPhase === phase.number ? 'current' :
                      currentPhase > phase.number ? 'completed' : 'pending';
        const canNavigate = phase.number < currentPhase ? canGoBack :
                          phase.number === currentPhase;

        return (
          <button
            key={phase.number}
            onClick={() => canNavigate && onNavigate(phase.number)}
            disabled={!canNavigate}
            className={`
              w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-all duration-200
              ${buttonClasses(phase, status, canNavigate)}
              ${canNavigate ? 'hover:transform hover:scale-105' : ''}
            `}
            title={phase.description}
          >
            <span className="text-sm">{phase.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-xs truncate">{phase.shortName}</div>
            </div>
            {status === 'completed' && (
              <span className="text-xs">✓</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
