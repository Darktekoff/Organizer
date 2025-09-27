/**
 * ProgressBar - Barres de progression avec labels
 * Support plusieurs modes (indéterminé, pourcentage, étapes)
 */

import React from 'react';
import { formatPercentage, formatTimeRemaining } from '../../utils/formatters';

interface ProgressBarProps {
  // Progression
  value?: number; // 0-100 pour mode pourcentage
  max?: number; // Pour mode custom
  mode?: 'percentage' | 'indeterminate' | 'steps' | 'custom';

  // Steps (pour mode steps)
  currentStep?: number;
  totalSteps?: number;
  stepNames?: string[];

  // Apparence
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  showLabel?: boolean;
  showPercentage?: boolean;
  animated?: boolean;

  // Contenu
  label?: string;
  description?: string;
  estimatedTimeRemaining?: number;

  // Style
  className?: string;
  barClassName?: string;
}

const SIZE_CLASSES = {
  sm: 'h-2',
  md: 'h-3',
  lg: 'h-4',
  xl: 'h-6'
};

const VARIANT_CLASSES = {
  default: 'bg-blue-500',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
  info: 'bg-cyan-500'
};

const BACKGROUND_CLASSES = {
  default: 'bg-gray-700',
  success: 'bg-gray-700',
  warning: 'bg-gray-700',
  error: 'bg-gray-700',
  info: 'bg-gray-700'
};

export function ProgressBar({
  value = 0,
  max = 100,
  mode = 'percentage',
  currentStep = 0,
  totalSteps = 1,
  stepNames = [],
  size = 'md',
  variant = 'default',
  showLabel = true,
  showPercentage = true,
  animated = true,
  label,
  description,
  estimatedTimeRemaining,
  className = '',
  barClassName = ''
}: ProgressBarProps) {
  // Calculs selon le mode
  const getProgressValue = () => {
    switch (mode) {
      case 'steps':
        return (currentStep / totalSteps) * 100;
      case 'custom':
        return (value / max) * 100;
      case 'indeterminate':
        return 100;
      default:
        return Math.min(100, Math.max(0, value));
    }
  };

  const progressValue = getProgressValue();

  // Texte de pourcentage
  const getPercentageText = () => {
    switch (mode) {
      case 'steps':
        return `${currentStep}/${totalSteps}`;
      case 'custom':
        return `${value}/${max}`;
      case 'indeterminate':
        return '';
      default:
        return `${Math.round(progressValue)}%`;
    }
  };

  // Label principal
  const getMainLabel = () => {
    if (label) return label;

    switch (mode) {
      case 'steps':
        return stepNames[currentStep - 1] || `Étape ${currentStep}`;
      case 'indeterminate':
        return 'Traitement en cours...';
      default:
        return 'Progression';
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Header avec label et pourcentage */}
      {(showLabel || showPercentage) && (
        <div className="flex items-center justify-between">
          {showLabel && (
            <div>
              <div className="text-sm font-medium text-white">
                {getMainLabel()}
              </div>
              {description && (
                <div className="text-xs text-gray-400 mt-1">
                  {description}
                </div>
              )}
            </div>
          )}

          {showPercentage && mode !== 'indeterminate' && (
            <div className="text-sm font-medium text-gray-300">
              {getPercentageText()}
            </div>
          )}
        </div>
      )}

      {/* Barre de progression */}
      <div className={`w-full ${BACKGROUND_CLASSES[variant]} rounded-full ${SIZE_CLASSES[size]} overflow-hidden ${barClassName}`}>
        <div
          className={`
            ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} rounded-full transition-all duration-300 ease-out
            ${mode === 'indeterminate' && animated ? 'animate-pulse' : ''}
            ${animated ? 'transition-all duration-500' : ''}
          `}
          style={{
            width: mode === 'indeterminate' ? '100%' : `${progressValue}%`
          }}
        />
      </div>

      {/* Info supplémentaire */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        {mode === 'steps' && stepNames.length > 0 && (
          <div>
            Prochaine étape: {stepNames[currentStep] || 'Terminé'}
          </div>
        )}

        {estimatedTimeRemaining !== undefined && estimatedTimeRemaining > 0 && (
          <div>
            Temps restant: {formatTimeRemaining(estimatedTimeRemaining)}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Barre de progression multi-segments pour les phases
 */
interface MultiProgressBarProps {
  segments: Array<{
    label: string;
    value: number;
    max: number;
    variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
    status?: 'pending' | 'running' | 'completed' | 'failed';
  }>;
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
  className?: string;
}

export function MultiProgressBar({
  segments,
  size = 'md',
  showLabels = true,
  className = ''
}: MultiProgressBarProps) {
  const totalMax = segments.reduce((sum, segment) => sum + segment.max, 0);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Labels des segments */}
      {showLabels && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {segments.map((segment, index) => (
            <div key={index} className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${VARIANT_CLASSES[segment.variant || 'default']}`} />
              <span className="text-sm text-gray-300">{segment.label}</span>
              <span className="text-xs text-gray-400">
                ({segment.value}/{segment.max})
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Barre multi-segments */}
      <div className={`w-full bg-gray-700 rounded-full ${SIZE_CLASSES[size]} overflow-hidden flex`}>
        {segments.map((segment, index) => {
          const segmentWidth = (segment.max / totalMax) * 100;
          const fillWidth = (segment.value / segment.max) * 100;

          return (
            <div
              key={index}
              className="relative"
              style={{ width: `${segmentWidth}%` }}
            >
              <div className={`${SIZE_CLASSES[size]} bg-gray-600`} />
              <div
                className={`
                  absolute top-0 left-0 ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[segment.variant || 'default']}
                  transition-all duration-500 ease-out
                `}
                style={{ width: `${fillWidth}%` }}
              />
            </div>
          );
        })}
      </div>

      {/* Progression globale */}
      <div className="text-center">
        <div className="text-sm text-gray-300">
          {(() => {
            const totalValue = segments.reduce((sum, segment) => sum + segment.value, 0);
            const globalProgress = (totalValue / totalMax) * 100;
            return `Progression globale: ${Math.round(globalProgress)}%`;
          })()}
        </div>
      </div>
    </div>
  );
}

/**
 * Barre de progression circulaire
 */
interface CircularProgressProps {
  value: number; // 0-100
  size?: number; // en pixels
  strokeWidth?: number;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  showPercentage?: boolean;
  label?: string;
  className?: string;
}

export function CircularProgress({
  value,
  size = 120,
  strokeWidth = 8,
  variant = 'default',
  showPercentage = true,
  label,
  className = ''
}: CircularProgressProps) {
  const normalizedValue = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (normalizedValue / 100) * circumference;

  const STROKE_COLORS = {
    default: '#3B82F6',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#06B6D4'
  };

  return (
    <div className={`flex flex-col items-center space-y-2 ${className}`}>
      <div className="relative">
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
        >
          {/* Cercle de fond */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#374151"
            strokeWidth={strokeWidth}
            fill="transparent"
          />

          {/* Cercle de progression */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={STROKE_COLORS[variant]}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500 ease-out"
          />
        </svg>

        {/* Texte central */}
        {showPercentage && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">
                {Math.round(normalizedValue)}%
              </div>
              {label && (
                <div className="text-xs text-gray-400 mt-1">
                  {label}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Barre de progression avec animation de pulsation
 */
interface PulsingProgressBarProps {
  isActive: boolean;
  label?: string;
  color?: string;
  className?: string;
}

export function PulsingProgressBar({
  isActive,
  label = 'Traitement en cours...',
  color = 'bg-blue-500',
  className = ''
}: PulsingProgressBarProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <div className="text-sm font-medium text-white">
          {label}
        </div>
      )}

      <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
        <div className={`
          h-full ${color} transition-all duration-300
          ${isActive ? 'animate-pulse w-full' : 'w-0'}
        `} />
      </div>

      {isActive && (
        <div className="flex items-center space-x-2 text-gray-400">
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
        </div>
      )}
    </div>
  );
}