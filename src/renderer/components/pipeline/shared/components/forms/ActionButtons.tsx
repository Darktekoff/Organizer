/**
 * ActionButtons - Boutons de navigation standardisés
 * Précédent/Suivant/Stop avec états disabled et loading
 */

import React from 'react';

interface ActionButtonsProps {
  // Actions principales
  onBack?: () => void;
  onNext?: () => void;
  onStop?: () => void;
  onPause?: () => void;
  onRetry?: () => void;
  onSkip?: () => void;

  // États
  canGoBack?: boolean;
  canGoNext?: boolean;
  canStop?: boolean;
  canPause?: boolean;
  canRetry?: boolean;
  canSkip?: boolean;

  // Loading states
  isLoading?: boolean;
  isProcessing?: boolean;
  loadingMessage?: string;

  // Labels personnalisés
  backLabel?: string;
  nextLabel?: string;
  stopLabel?: string;
  pauseLabel?: string;
  retryLabel?: string;
  skipLabel?: string;

  // Variantes
  layout?: 'horizontal' | 'vertical' | 'split';
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'glass' | 'gradient';

  // Style
  className?: string;
  primaryAction?: 'next' | 'stop' | 'retry' | 'pause';
}

export function ActionButtons({
  // Actions
  onBack,
  onNext,
  onStop,
  onPause,
  onRetry,
  onSkip,

  // États
  canGoBack = true,
  canGoNext = true,
  canStop = true,
  canPause = false,
  canRetry = false,
  canSkip = false,

  // Loading
  isLoading = false,
  isProcessing = false,
  loadingMessage,

  // Labels
  backLabel = 'Précédent',
  nextLabel = 'Suivant',
  stopLabel = 'Arrêter',
  pauseLabel = 'Pause',
  retryLabel = 'Réessayer',
  skipLabel = 'Ignorer',

  // Apparence
  layout = 'horizontal',
  size = 'md',
  variant = 'default',
  className = '',
  primaryAction = 'next'
}: ActionButtonsProps) {

  const SIZE_CLASSES = {
    sm: {
      button: 'px-4 py-2 text-sm',
      icon: 'text-sm'
    },
    md: {
      button: 'px-6 py-3 text-base',
      icon: 'text-base'
    },
    lg: {
      button: 'px-8 py-4 text-lg',
      icon: 'text-lg'
    }
  };

  const VARIANT_CLASSES = {
    default: {
      primary: 'bg-blue-600 hover:bg-blue-500 text-white',
      secondary: 'bg-gray-600 hover:bg-gray-500 text-white',
      danger: 'bg-red-600 hover:bg-red-500 text-white',
      warning: 'bg-yellow-600 hover:bg-yellow-500 text-white'
    },
    glass: {
      primary: 'bg-blue-600/80 backdrop-blur-sm hover:bg-blue-500/90 text-white',
      secondary: 'bg-gray-600/80 backdrop-blur-sm hover:bg-gray-500/90 text-white',
      danger: 'bg-red-600/80 backdrop-blur-sm hover:bg-red-500/90 text-white',
      warning: 'bg-yellow-600/80 backdrop-blur-sm hover:bg-yellow-500/90 text-white'
    },
    gradient: {
      primary: 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white',
      secondary: 'bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-500 hover:to-gray-600 text-white',
      danger: 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white',
      warning: 'bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white'
    }
  };

  const baseButtonClasses = `
    ${SIZE_CLASSES[size].button}
    font-medium rounded-lg transition-all duration-200
    disabled:opacity-50 disabled:cursor-not-allowed
    flex items-center justify-center space-x-2
    transform hover:scale-105 disabled:transform-none
    shadow-lg hover:shadow-xl disabled:shadow-md
  `;

  const getButtonClasses = (type: 'primary' | 'secondary' | 'danger' | 'warning') => {
    return `${baseButtonClasses} ${VARIANT_CLASSES[variant][type]}`;
  };

  const renderButton = (
    type: 'back' | 'next' | 'stop' | 'pause' | 'retry' | 'skip',
    icon: string,
    label: string,
    onClick?: () => void,
    enabled?: boolean,
    styleType: 'primary' | 'secondary' | 'danger' | 'warning' = 'secondary'
  ) => {
    const isPrimary = primaryAction === type || (type === 'next' && primaryAction === 'next');
    const buttonType = isPrimary ? 'primary' : styleType;

    return (
      <button
        key={type}
        onClick={onClick}
        disabled={!enabled || isLoading || isProcessing}
        className={getButtonClasses(buttonType)}
      >
        {isLoading && type === 'next' ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>{loadingMessage || 'Chargement...'}</span>
          </>
        ) : (
          <>
            <span className={SIZE_CLASSES[size].icon}>{icon}</span>
            <span>{label}</span>
          </>
        )}
      </button>
    );
  };

  const buttons = [
    // Bouton Retour
    onBack && renderButton(
      'back',
      '←',
      backLabel,
      onBack,
      canGoBack && !isProcessing,
      'secondary'
    ),

    // Bouton Réessayer (si erreur)
    onRetry && canRetry && renderButton(
      'retry',
      '🔄',
      retryLabel,
      onRetry,
      true,
      'warning'
    ),

    // Bouton Ignorer (si applicable)
    onSkip && canSkip && renderButton(
      'skip',
      '⏭️',
      skipLabel,
      onSkip,
      !isProcessing,
      'secondary'
    ),

    // Bouton Pause (si en cours)
    onPause && canPause && renderButton(
      'pause',
      '⏸️',
      pauseLabel,
      onPause,
      isProcessing,
      'warning'
    ),

    // Bouton Suivant/Continuer
    onNext && renderButton(
      'next',
      isProcessing ? '⚡' : '→',
      isProcessing ? 'En cours...' : nextLabel,
      onNext,
      canGoNext,
      'primary'
    ),

    // Bouton Arrêter
    onStop && renderButton(
      'stop',
      '⏹️',
      stopLabel,
      onStop,
      canStop,
      'danger'
    )
  ].filter(Boolean);

  if (layout === 'vertical') {
    return (
      <div className={`flex flex-col space-y-3 ${className}`}>
        {buttons}
      </div>
    );
  }

  if (layout === 'split') {
    const leftButtons = buttons.slice(0, Math.ceil(buttons.length / 2));
    const rightButtons = buttons.slice(Math.ceil(buttons.length / 2));

    return (
      <div className={`flex items-center justify-between ${className}`}>
        <div className="flex items-center space-x-3">
          {leftButtons}
        </div>
        <div className="flex items-center space-x-3">
          {rightButtons}
        </div>
      </div>
    );
  }

  // Layout horizontal (default)
  return (
    <div className={`flex items-center justify-center space-x-4 ${className}`}>
      {buttons}
    </div>
  );
}

/**
 * Boutons d'action spécialisés pour différents contextes
 */

// Boutons pour les steps
interface StepActionButtonsProps {
  onPrevious?: () => void;
  onNext?: () => void;
  onComplete?: () => void;
  onSkip?: () => void;

  canPrevious?: boolean;
  canNext?: boolean;
  canComplete?: boolean;
  canSkip?: boolean;

  isLastStep?: boolean;
  isProcessing?: boolean;
  className?: string;
}

export function StepActionButtons({
  onPrevious,
  onNext,
  onComplete,
  onSkip,
  canPrevious = true,
  canNext = true,
  canComplete = true,
  canSkip = false,
  isLastStep = false,
  isProcessing = false,
  className = ''
}: StepActionButtonsProps) {
  return (
    <ActionButtons
      onBack={onPrevious}
      onNext={isLastStep ? onComplete : onNext}
      onSkip={onSkip}
      canGoBack={canPrevious}
      canGoNext={isLastStep ? canComplete : canNext}
      canSkip={canSkip}
      nextLabel={isLastStep ? 'Terminer' : 'Suivant'}
      isProcessing={isProcessing}
      layout="horizontal"
      className={className}
    />
  );
}

// Boutons pour les phases
interface PhaseActionButtonsProps {
  onBackToPhase?: () => void;
  onValidatePhase?: () => void;
  onStopPipeline?: () => void;

  canGoBack?: boolean;
  canValidate?: boolean;
  isValidating?: boolean;
  validationMessage?: string;
  className?: string;
}

export function PhaseActionButtons({
  onBackToPhase,
  onValidatePhase,
  onStopPipeline,
  canGoBack = true,
  canValidate = true,
  isValidating = false,
  validationMessage,
  className = ''
}: PhaseActionButtonsProps) {
  return (
    <ActionButtons
      onBack={onBackToPhase}
      onNext={onValidatePhase}
      onStop={onStopPipeline}
      canGoBack={canGoBack}
      canGoNext={canValidate}
      nextLabel="Valider et continuer"
      isLoading={isValidating}
      loadingMessage={validationMessage || 'Validation en cours...'}
      primaryAction="next"
      variant="gradient"
      layout="split"
      className={className}
    />
  );
}

// Boutons de confirmation
interface ConfirmActionButtonsProps {
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  isConfirming?: boolean;
  confirmVariant?: 'primary' | 'danger' | 'warning';
  className?: string;
}

export function ConfirmActionButtons({
  onConfirm,
  onCancel,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  isConfirming = false,
  confirmVariant = 'primary',
  className = ''
}: ConfirmActionButtonsProps) {
  const variantMap = {
    primary: 'next',
    danger: 'stop',
    warning: 'pause'
  } as const;

  return (
    <ActionButtons
      onNext={confirmVariant === 'primary' ? onConfirm : undefined}
      onStop={confirmVariant === 'danger' ? onConfirm : undefined}
      onPause={confirmVariant === 'warning' ? onConfirm : undefined}
      onBack={onCancel}
      nextLabel={confirmVariant === 'primary' ? confirmLabel : undefined}
      stopLabel={confirmVariant === 'danger' ? confirmLabel : undefined}
      pauseLabel={confirmVariant === 'warning' ? confirmLabel : undefined}
      backLabel={cancelLabel}
      isLoading={isConfirming}
      primaryAction={variantMap[confirmVariant]}
      layout="horizontal"
      className={className}
    />
  );
}

/**
 * Groupe de boutons flottants pour actions rapides
 */
interface FloatingActionButtonsProps {
  actions: Array<{
    icon: string;
    label: string;
    onClick: () => void;
    variant?: 'default' | 'primary' | 'danger' | 'success';
    disabled?: boolean;
  }>;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  className?: string;
}

export function FloatingActionButtons({
  actions,
  position = 'bottom-right',
  className = ''
}: FloatingActionButtonsProps) {
  const positionClasses = {
    'bottom-right': 'fixed bottom-6 right-6',
    'bottom-left': 'fixed bottom-6 left-6',
    'top-right': 'fixed top-6 right-6',
    'top-left': 'fixed top-6 left-6'
  };

  const variantClasses = {
    default: 'bg-gray-600 hover:bg-gray-500',
    primary: 'bg-blue-600 hover:bg-blue-500',
    danger: 'bg-red-600 hover:bg-red-500',
    success: 'bg-green-600 hover:bg-green-500'
  };

  return (
    <div className={`${positionClasses[position]} flex flex-col space-y-3 z-50 ${className}`}>
      {actions.map((action, index) => (
        <button
          key={index}
          onClick={action.onClick}
          disabled={action.disabled}
          className={`
            w-14 h-14 rounded-full text-white shadow-lg hover:shadow-xl
            transition-all duration-200 transform hover:scale-110
            disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
            flex items-center justify-center
            ${variantClasses[action.variant || 'default']}
          `}
          title={action.label}
        >
          <span className="text-xl">{action.icon}</span>
        </button>
      ))}
    </div>
  );
}
