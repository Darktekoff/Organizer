/**
 * ChoiceDialog - Dialogs pour choix utilisateur
 * Choix de structure, classification manuelle, confirmations
 */

import React, { useState, useEffect } from 'react';
import { ActionButtons } from './ActionButtons';

interface ChoiceOption {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  recommended?: boolean;
  preview?: React.ReactNode;
  metadata?: Record<string, any>;
}

interface ChoiceDialogProps {
  // Contenu
  title: string;
  description?: string;
  options: ChoiceOption[];

  // Comportement
  multiSelect?: boolean;
  required?: boolean;
  defaultSelected?: string | string[];

  // Actions
  onSelect: (selected: string | string[]) => void;
  onCancel?: () => void;

  // Apparence
  variant?: 'default' | 'structure' | 'classification' | 'confirmation';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showPreview?: boolean;

  // État
  isOpen: boolean;
  isLoading?: boolean;

  className?: string;
}

export function ChoiceDialog({
  title,
  description,
  options,
  multiSelect = false,
  required = true,
  defaultSelected,
  onSelect,
  onCancel,
  variant = 'default',
  size = 'md',
  showPreview = false,
  isOpen,
  isLoading = false,
  className = ''
}: ChoiceDialogProps) {
  const [selected, setSelected] = useState<string | string[]>(
    multiSelect ? (Array.isArray(defaultSelected) ? defaultSelected : []) : (defaultSelected as string || '')
  );

  const [previewOption, setPreviewOption] = useState<ChoiceOption | null>(null);

  useEffect(() => {
    if (isOpen && defaultSelected) {
      setSelected(defaultSelected);
    }
  }, [isOpen, defaultSelected]);

  const handleOptionClick = (optionId: string) => {
    if (multiSelect) {
      const currentSelected = selected as string[];
      if (currentSelected.includes(optionId)) {
        setSelected(currentSelected.filter(id => id !== optionId));
      } else {
        setSelected([...currentSelected, optionId]);
      }
    } else {
      setSelected(optionId);
    }
  };

  const handleConfirm = () => {
    if (required && (!selected || (Array.isArray(selected) && selected.length === 0))) {
      return;
    }
    onSelect(selected);
  };

  const isSelected = (optionId: string): boolean => {
    if (multiSelect) {
      return (selected as string[]).includes(optionId);
    }
    return selected === optionId;
  };

  const canConfirm = !required || (selected && (!Array.isArray(selected) || selected.length > 0));

  const SIZE_CLASSES = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl'
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`
        bg-gray-800 rounded-xl shadow-2xl border border-gray-600
        ${SIZE_CLASSES[size]} w-full max-h-[90vh] overflow-hidden
        ${className}
      `}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-600">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">{title}</h2>
              {description && (
                <p className="text-gray-400 text-sm mt-1">{description}</p>
              )}
            </div>

            {onCancel && (
              <button
                onClick={onCancel}
                className="text-gray-400 hover:text-white p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-auto">
          {/* Options */}
          <div className="p-6">
            <div className={`
              ${variant === 'structure' ? 'space-y-4' : 'grid gap-4'}
              ${variant === 'default' && options.length <= 3 ? 'grid-cols-1' : ''}
              ${variant === 'default' && options.length > 3 ? 'grid-cols-2' : ''}
              ${variant === 'classification' ? 'grid-cols-3' : ''}
            `}>
              {options.map((option) => (
                <div
                  key={option.id}
                  className={`
                    relative p-4 rounded-lg border-2 cursor-pointer transition-all duration-200
                    ${isSelected(option.id)
                      ? 'border-blue-500 bg-blue-900/20'
                      : 'border-gray-600 hover:border-gray-500 hover:bg-gray-700/30'
                    }
                    ${option.recommended ? 'ring-2 ring-green-500/50' : ''}
                  `}
                  onClick={() => handleOptionClick(option.id)}
                  onMouseEnter={() => showPreview && setPreviewOption(option)}
                  onMouseLeave={() => showPreview && setPreviewOption(null)}
                >
                  {/* Badge recommandé */}
                  {option.recommended && (
                    <div className="absolute -top-2 -right-2">
                      <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                        Recommandé
                      </span>
                    </div>
                  )}

                  {/* Icône */}
                  {option.icon && (
                    <div className="text-2xl mb-3">{option.icon}</div>
                  )}

                  {/* Contenu principal */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      {/* Checkbox/Radio */}
                      <div className={`
                        w-5 h-5 rounded border-2 flex items-center justify-center
                        ${isSelected(option.id)
                          ? 'bg-blue-500 border-blue-500'
                          : 'border-gray-400'
                        }
                        ${multiSelect ? 'rounded-sm' : 'rounded-full'}
                      `}>
                        {isSelected(option.id) && (
                          <span className="text-white text-sm">✓</span>
                        )}
                      </div>

                      <h3 className="text-white font-semibold flex-1">{option.label}</h3>
                    </div>

                    {option.description && (
                      <p className="text-gray-400 text-sm leading-relaxed">
                        {option.description}
                      </p>
                    )}

                    {/* Metadata */}
                    {option.metadata && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {Object.entries(option.metadata).map(([key, value]) => (
                          <span
                            key={key}
                            className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded"
                          >
                            {key}: {value}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          {showPreview && previewOption?.preview && (
            <div className="border-t border-gray-600 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Aperçu: {previewOption.label}
              </h3>
              <div className="bg-gray-900/50 rounded-lg p-4">
                {previewOption.preview}
              </div>
            </div>
          )}
        </div>

        {/* Footer avec actions */}
        <div className="px-6 py-4 border-t border-gray-600">
          <div className="flex items-center justify-between">
            {/* Info sélection */}
            <div className="text-sm text-gray-400">
              {multiSelect ? (
                <span>
                  {(selected as string[]).length} option(s) sélectionnée(s)
                  {required && (selected as string[]).length === 0 && (
                    <span className="text-red-400 ml-2">* Sélection requise</span>
                  )}
                </span>
              ) : (
                <span>
                  {selected ? '1 option sélectionnée' : 'Aucune sélection'}
                  {required && !selected && (
                    <span className="text-red-400 ml-2">* Sélection requise</span>
                  )}
                </span>
              )}
            </div>

            {/* Boutons d'action */}
            <ActionButtons
              onNext={handleConfirm}
              onBack={onCancel}
              canGoNext={canConfirm}
              nextLabel="Confirmer"
              backLabel="Annuler"
              isLoading={isLoading}
              size="md"
              variant="gradient"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Dialog spécialisé pour choix de structure
 */
interface StructureChoiceDialogProps {
  isOpen: boolean;
  structures: Array<{
    id: string;
    name: string;
    description: string;
    advantages: string[];
    considerations: string[];
    estimatedFolders: number;
    preview: React.ReactNode;
    score?: number;
  }>;
  onSelect: (structureId: string) => void;
  onCancel?: () => void;
}

export function StructureChoiceDialog({
  isOpen,
  structures,
  onSelect,
  onCancel
}: StructureChoiceDialogProps) {
  const options: ChoiceOption[] = structures.map(structure => ({
    id: structure.id,
    label: structure.name,
    description: structure.description,
    icon: '📁',
    recommended: structure.score ? structure.score > 0.8 : false,
    preview: structure.preview,
    metadata: {
      'Dossiers estimés': structure.estimatedFolders,
      'Score': structure.score ? `${(structure.score * 100).toFixed(0)}%` : 'N/A'
    }
  }));

  return (
    <ChoiceDialog
      isOpen={isOpen}
      title="Choix de la structure d'organisation"
      description="Sélectionnez la structure qui convient le mieux à votre bibliothèque"
      options={options}
      onSelect={(selected) => onSelect(selected as string)}
      onCancel={onCancel}
      variant="structure"
      size="xl"
      showPreview={true}
      required={true}
    />
  );
}

/**
 * Dialog de confirmation simple
 */
interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'warning' | 'danger';
  onConfirm: () => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'default',
  onConfirm,
  onCancel,
  isLoading = false
}: ConfirmDialogProps) {
  const getVariantIcon = () => {
    switch (variant) {
      case 'warning': return '⚠️';
      case 'danger': return '❌';
      default: return '❓';
    }
  };

  const getVariantColor = () => {
    switch (variant) {
      case 'warning': return 'text-yellow-400';
      case 'danger': return 'text-red-400';
      default: return 'text-blue-400';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-600 max-w-md w-full">
        <div className="p-6">
          <div className="flex items-start space-x-4">
            <div className={`text-3xl ${getVariantColor()}`}>
              {getVariantIcon()}
            </div>

            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
              <p className="text-gray-300 leading-relaxed">{message}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-600">
          <ActionButtons
            onNext={onConfirm}
            onBack={onCancel}
            nextLabel={confirmLabel}
            backLabel={cancelLabel}
            isLoading={isLoading}
            variant="default"
            primaryAction={variant === 'danger' ? 'stop' : 'next'}
          />
        </div>
      </div>
    </div>
  );
}