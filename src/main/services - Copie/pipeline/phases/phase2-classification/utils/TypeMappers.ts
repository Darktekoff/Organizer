/**
 * Utilitaires de mapping de types pour Phase 2
 */

import { ClassificationMethod } from '../Phase2Types';

/**
 * Convertit un ClassificationMethod enum vers le format string attendu par PipelineTypes
 */
export function mapMethodToString(method: ClassificationMethod | string): string {
  const mapping: Record<string, string> = {
    'LEXICAL': 'lexical',
    'CONTEXTUAL': 'contextual',
    'TAXONOMIC': 'ai',
    'AI': 'ai',
    'AI_FALLBACK': 'ai',
    'MANUAL': 'manual'
  };

  return mapping[method] || 'manual';
}

/**
 * Convertit un string method vers ClassificationMethod enum
 */
export function mapStringToMethod(method: string): ClassificationMethod {
  const mapping: Record<string, ClassificationMethod> = {
    'lexical': ClassificationMethod.LEXICAL,
    'contextual': ClassificationMethod.CONTEXTUAL,
    'ai': ClassificationMethod.TAXONOMIC,
    'manual': ClassificationMethod.MANUAL
  };

  return mapping[method.toLowerCase()] || ClassificationMethod.MANUAL;
}

/**
 * Vérifie si une méthode est de type AI
 */
export function isAIMethod(method: ClassificationMethod | string): boolean {
  const aiMethods = [
    ClassificationMethod.TAXONOMIC,
    ClassificationMethod.AI_FALLBACK,
    'AI',
    'ai',
    'TAXONOMIC',
    'AI_FALLBACK'
  ];

  return aiMethods.includes(method as any);
}

/**
 * Normalise le nom d'un pack
 */
export function getPackName(pack: any): string {
  return pack.name ||
         pack.packName ||
         pack.originalPack?.name ||
         pack.originalPack?.packName ||
         pack.packId ||
         'Unknown Pack';
}