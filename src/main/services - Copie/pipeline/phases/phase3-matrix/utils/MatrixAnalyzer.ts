/**
 * MatrixAnalyzer - Analyseur de patterns pour génération matrice
 * Analyse les packs classifiés pour découvrir functions, variants, contexts
 */

import * as path from 'path';
import type { ClassifiedPack } from '@shared/interfaces/BusinessTypes';
import type { DiscoveredPattern, MatrixKey } from '../Phase3Types';

/**
 * Analyseur de patterns dans les packs
 */
export class MatrixAnalyzer {
  // Patterns prédéfinis pour detection
  private static readonly FUNCTION_PATTERNS = new Map([
    // One Shots
    ['one_shot', /\b(one[-_\s]*shot|oneshot|hit|stab|single)\b/i],
    ['loop', /\b(loop|loops|cycle|circular)\b/i],
    ['layer', /\b(layer|layers|stack|top|bottom)\b/i],

    // Spécifique KICKS
    ['full_kick', /\b(full[-_\s]*kick|fullkick|complete[-_\s]*kick)\b/i],
    ['tok', /\b(tok|toks|click|tick)\b/i],
    ['punch', /\b(punch|punchy|punches)\b/i],
    ['tail', /\b(tail|tails|reverb|decay)\b/i],

    // Spécifique BASS
    ['bass_shot', /\b(bass[-_\s]*shot|bassshot|sub[-_\s]*hit)\b/i],
    ['bass_loop', /\b(bass[-_\s]*loop|bassloop|sub[-_\s]*loop)\b/i],
    ['wobble', /\b(wobble|wobbles|wob|modulated)\b/i],
    ['growl', /\b(growl|growls|distorted|aggressive)\b/i],

    // Formats généraux
    ['arp', /\b(arp|arps|arpeggio|arpeggiated)\b/i],
    ['pad', /\b(pad|pads|sustained|atmosphere)\b/i],
    ['lead', /\b(lead|leads|melody|melodic)\b/i],
    ['pluck', /\b(pluck|plucks|staccato|short)\b/i],
    ['sweep', /\b(sweep|sweeps|riser|uplifter)\b/i],
    ['fill', /\b(fill|fills|transition|break)\b/i]
  ]);

  private static readonly VARIANT_PATTERNS = new Map([
    // Variations tonales
    ['standard', /\b(standard|std|normal|basic|clean)\b/i],
    ['pitched', /\b(pitched|tuned|harmonic|tonal)\b/i],
    ['detuned', /\b(detuned|detune|off[-_\s]*pitch|atonal)\b/i],

    // Variations dynamiques
    ['heavy', /\b(heavy|thick|fat|massive|huge)\b/i],
    ['light', /\b(light|thin|soft|gentle|subtle)\b/i],
    ['punchy', /\b(punchy|punch|hard|sharp|crisp)\b/i],

    // Processing
    ['dry', /\b(dry|clean|raw|unprocessed)\b/i],
    ['wet', /\b(wet|processed|effected|reverb)\b/i],
    ['distorted', /\b(distorted|distort|saturated|overdriven)\b/i],
    ['filtered', /\b(filtered|filter|low[-_\s]*pass|high[-_\s]*pass)\b/i],

    // Variations de style
    ['oldschool', /\b(old[-_\s]*school|oldschool|classic|vintage|retro)\b/i],
    ['modern', /\b(modern|new[-_\s]*school|newschool|fresh|current)\b/i],
    ['analog', /\b(analog|analogue|warm|vintage|tube)\b/i],
    ['digital', /\b(digital|synthetic|cold|precise)\b/i]
  ]);

  private static readonly CONTEXT_PATTERNS = new Map([
    // Contextes de track
    ['main', /\b(main|drop|climax|main[-_\s]*part)\b/i],
    ['intro', /\b(intro|introduction|opening|start)\b/i],
    ['breakdown', /\b(breakdown|break[-_\s]*down|break|calm)\b/i],
    ['buildup', /\b(buildup|build[-_\s]*up|build|tension|riser)\b/i],
    ['outro', /\b(outro|ending|finish|conclusion)\b/i],
    ['bridge', /\b(bridge|transition|middle|connecting)\b/i],

    // Contextes mix/mastering
    ['mix', /\b(mix|mixed|mixing|blend)\b/i],
    ['master', /\b(master|mastered|final|finished)\b/i],
    ['demo', /\b(demo|draft|sketch|rough)\b/i],
    ['final', /\b(final|finished|complete|done)\b/i]
  ]);

  /**
   * Analyse un pack classifié pour découvrir les patterns
   */
  static analyzePackPatterns(pack: ClassifiedPack): DiscoveredPattern[] {
    const patterns: DiscoveredPattern[] = [];

    // Analyser le nom du pack
    const packNamePatterns = this.analyzeText(pack.packId, 'filename');
    patterns.push(...packNamePatterns);

    // Analyser la structure si disponible
    if (pack.originalPack?.structure) {
      // Simuler une analyse de structure - dans la vraie implémentation,
      // on analyserait les noms de dossiers et fichiers
      const structurePatterns = this.analyzeStructure(pack);
      patterns.push(...structurePatterns);
    }

    // Déduplication et scoring final
    return this.deduplicateAndScore(patterns, pack.packId);
  }

  /**
   * Analyse un texte pour détecter des patterns
   */
  private static analyzeText(text: string, source: 'filename' | 'folder' | 'structure'): DiscoveredPattern[] {
    const patterns: DiscoveredPattern[] = [];
    const cleanText = text.toLowerCase();

    // Analyser functions
    for (const [functionName, regex] of this.FUNCTION_PATTERNS) {
      const match = regex.exec(cleanText);
      if (match) {
        patterns.push({
          packId: '', // Sera ajouté plus tard
          type: 'function',
          value: functionName,
          confidence: this.calculateConfidence(match, text, source),
          source,
          examples: [match[0]]
        });
      }
    }

    // Analyser variants
    for (const [variantName, regex] of this.VARIANT_PATTERNS) {
      const match = regex.exec(cleanText);
      if (match) {
        patterns.push({
          packId: '',
          type: 'variant',
          value: variantName,
          confidence: this.calculateConfidence(match, text, source),
          source,
          examples: [match[0]]
        });
      }
    }

    // Analyser contexts
    for (const [contextName, regex] of this.CONTEXT_PATTERNS) {
      const match = regex.exec(cleanText);
      if (match) {
        patterns.push({
          packId: '',
          type: 'context',
          value: contextName,
          confidence: this.calculateConfidence(match, text, source),
          source,
          examples: [match[0]]
        });
      }
    }

    return patterns;
  }

  /**
   * Analyse la structure réelle d'un pack basée sur les données Phase 1
   */
  private static analyzeStructure(pack: ClassifiedPack): DiscoveredPattern[] {
    const patterns: DiscoveredPattern[] = [];

    // Utiliser les données de structure interne si disponibles
    if (pack.internalStructure) {
      const { detectedTypes, detectedFormats, detectedFolders } = pack.internalStructure;

      // Analyser les types détectés
      const typeKeys = detectedTypes ? Object.keys(detectedTypes) : [];
      for (const type of typeKeys) {
        const functionValue = this.resolveDefaultFunctionForType(type);
        if (functionValue) {
          patterns.push({
            packId: pack.packId,
            type: 'function',
            value: functionValue,
            confidence: 0.9, // Confiance élevée car basé sur structure réelle
            source: 'structure',
            examples: [`${type} folder/files detected`]
          });
        }
      }

      // Analyser les formats détectés
      for (const format of detectedFormats || []) {
        patterns.push({
          packId: pack.packId,
          type: 'variant',
          value: format.toLowerCase().replace('s', ''), // "Loops" → "loop"
          confidence: 0.85,
          source: 'structure',
          examples: [`${format} organization detected`]
        });
      }

      // Analyser les dossiers spécifiques
      for (const folder of detectedFolders || []) {
        const folderLower = folder.toLowerCase();

        // Détecter des patterns contextuels depuis les noms de dossiers
        if (folderLower.includes('intro')) {
          patterns.push({
            packId: pack.packId,
            type: 'context',
            value: 'intro',
            confidence: 0.8,
            source: 'structure',
            examples: [folder]
          });
        } else if (folderLower.includes('main') || folderLower.includes('drop')) {
          patterns.push({
            packId: pack.packId,
            type: 'context',
            value: 'main',
            confidence: 0.8,
            source: 'structure',
            examples: [folder]
          });
        }
      }
    }

    // Fallback sur analyse du nom si pas de structure détaillée
    if (patterns.length === 0) {
      const packName = pack.packId.toLowerCase();

      if (packName.includes('kick')) {
        patterns.push({
          packId: pack.packId,
          type: 'function',
          value: 'full_kick',
          confidence: 0.6, // Confiance plus faible car basé sur nom seulement
          source: 'structure',
          examples: ['Pack name contains "kick"']
        });
      }

      if (packName.includes('bass')) {
        patterns.push({
          packId: pack.packId,
          type: 'function',
          value: 'bass_shot',
          confidence: 0.6,
          source: 'structure',
          examples: ['Pack name contains "bass"']
        });
      }
    }

    return patterns;
  }

  /**
   * Fournit une fonction par défaut alignée sur la taxonomie en fonction du type détecté
   */
  static resolveDefaultFunctionForType(type: string): string | null {
    const normalizedType = type?.toUpperCase() || 'UNKNOWN';

    const typeMapping = new Map<string, string>([
      ['KICKS', 'Full_Kicks'],
      ['BASS', 'One_Shot'],
      ['SYNTHS', 'Lead'],
      ['PERC', 'One_Shot'],
      ['PERCUSSION', 'One_Shot'],
      ['VOCALS', 'One_Shot'],
      ['ACAPELLAS', 'Full'],
      ['FX', 'Hit'],
      ['MELODY', 'Lead'],
      ['DRUM_LOOPS', 'Full'],
      ['DRUMS', 'Full'],
      ['TOPS', 'Hat_Loop'],
      ['TEXTURES', 'Pad'],
      ['MIDI', 'Chords'],
      ['PRESETS', 'Serum'],
      ['STEMS', 'Full']
    ]);

    return typeMapping.get(normalizedType) || null;
  }

  /**
   * Calcule la confiance d'un pattern détecté
   */
  private static calculateConfidence(
    match: RegExpExecArray,
    fullText: string,
    source: 'filename' | 'folder' | 'structure'
  ): number {
    let confidence = 0.5; // Base

    // Bonus pour match exact vs partiel
    if (match[0].length === fullText.length) {
      confidence += 0.3; // Mot entier
    } else if (match[0].length > fullText.length * 0.5) {
      confidence += 0.15; // Partie significative
    }

    // Bonus selon source
    switch (source) {
      case 'filename':
        confidence += 0.1;
        break;
      case 'folder':
        confidence += 0.2; // Plus fiable
        break;
      case 'structure':
        confidence += 0.15;
        break;
    }

    // Bonus pour position au début/fin
    if (match.index === 0 || (match.index + match[0].length) === fullText.length) {
      confidence += 0.1;
    }

    return Math.min(0.95, confidence); // Cap à 95%
  }

  /**
   * Déduplique les patterns et ajuste les scores
   */
  private static deduplicateAndScore(patterns: DiscoveredPattern[], packId: string): DiscoveredPattern[] {
    const uniquePatterns = new Map<string, DiscoveredPattern>();

    for (const pattern of patterns) {
      const key = `${pattern.type}:${pattern.value}`;
      pattern.packId = packId; // Assigner l'ID

      if (uniquePatterns.has(key)) {
        // Fusionner avec le pattern existant (prendre la meilleure confiance)
        const existing = uniquePatterns.get(key)!;
        if (pattern.confidence > existing.confidence) {
          existing.confidence = pattern.confidence;
          existing.source = pattern.source;
          existing.examples = [...existing.examples, ...pattern.examples];
        }
      } else {
        uniquePatterns.set(key, pattern);
      }
    }

    return Array.from(uniquePatterns.values())
      .filter(p => p.confidence >= 0.3) // Seuil minimum
      .sort((a, b) => b.confidence - a.confidence); // Tri par confiance
  }

  /**
   * Génère une clé de matrice depuis un pack classifié
   */
  static generateMatrixKey(pack: ClassifiedPack, defaultType: string = 'UNKNOWN'): MatrixKey {
    const classification = pack.classification;

    if (!classification) {
      throw new Error(`Pack ${pack.packId} has no classification`);
    }

    // Normaliser les noms
    const family = this.normalizeName(classification.family);
    const style = this.normalizeName(classification.style);

    // Détecter le type depuis la structure interne d'abord, puis le nom
    const type = this.detectTypeFromPack(pack) || defaultType;

    const key = `${family}|${type}|${style}`;

    return {
      family,
      type,
      style,
      key
    };
  }

  /**
   * Détecte le type depuis la structure interne ET le nom d'un pack
   */
  private static detectTypeFromPack(pack: ClassifiedPack): string | null {
    // 1. Priorité à la structure interne si disponible
    const detectedTypes = pack.internalStructure?.detectedTypes
      ? Object.keys(pack.internalStructure.detectedTypes)
      : [];

    if (detectedTypes.length) {
      const types = detectedTypes;

      // Ordre de priorité pour les types mixtes
      const priorityOrder = ['KICKS', 'BASS', 'SYNTHS', 'VOCALS', 'FX', 'DRUMS', 'PERCUSSION', 'MELODY'];

      for (const priorityType of priorityOrder) {
        if (types.includes(priorityType)) {
          return priorityType;
        }
      }

      // Si aucun dans l'ordre de priorité, prendre le premier
      return types[0];
    }

    // 2. Fallback sur analyse du nom
    return this.detectTypeFromPackName(pack.packId);
  }

  /**
   * Détecte le type depuis le nom d'un pack (fallback)
   */
  private static detectTypeFromPackName(packName: string): string | null {
    const name = packName.toLowerCase();

    // Patterns de détection de type
    const typePatterns = [
      { type: 'KICKS', patterns: [/\bkick/i, /\btok/i, /\bpunch/i] },
      { type: 'BASS', patterns: [/\bbass/i, /\bsub/i, /\bwobble/i] },
      { type: 'SYNTHS', patterns: [/\bsynth/i, /\blead/i, /\bpluck/i, /\barp/i] },
      { type: 'PERC', patterns: [/\bperc/i, /\bdrum/i, /\bhihat/i, /\bsnare/i] },
      { type: 'FX', patterns: [/\bfx/i, /\beffect/i, /\bsweep/i, /\bimpact/i] },
      { type: 'VOCALS', patterns: [/\bvocal/i, /\bvoice/i, /\bchop/i] },
      { type: 'ACAPELLAS', patterns: [/\bacapella/i, /\bacap/i, /\bstem/i] }
    ];

    for (const { type, patterns } of typePatterns) {
      if (patterns.some(pattern => pattern.test(name))) {
        return type;
      }
    }

    return null;
  }

  /**
   * Normalise un nom pour la matrice
   */
  private static normalizeName(name: string): string {
    return name
      .trim()
      .replace(/[_\s]+/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase vers spaces
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Combine plusieurs patterns découverts en listes uniques
   */
  static aggregatePatterns(allPatterns: DiscoveredPattern[]): {
    functions: string[];
    variants: string[];
    contexts: string[];
  } {
    const functions = new Set<string>();
    const variants = new Set<string>();
    const contexts = new Set<string>();

    for (const pattern of allPatterns) {
      if (pattern.confidence >= 0.5) { // Seuil pour agrégation
        switch (pattern.type) {
          case 'function':
            functions.add(pattern.value);
            break;
          case 'variant':
            variants.add(pattern.value);
            break;
          case 'context':
            contexts.add(pattern.value);
            break;
        }
      }
    }

    return {
      functions: Array.from(functions).sort(),
      variants: Array.from(variants).sort(),
      contexts: Array.from(contexts).sort()
    };
  }
}
