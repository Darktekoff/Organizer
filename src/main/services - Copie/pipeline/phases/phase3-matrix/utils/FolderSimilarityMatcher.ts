/**
 * FolderSimilarityMatcher - Moteur intelligent de détection de similarité entre dossiers
 * Utilise plusieurs algorithmes pour identifier les variations de noms qui représentent le même concept
 */

export interface SimilarityScores {
  tokenOverlap: number;
  levenshtein: number;
  permutation: number;
  phonetic: number;
  contextual: number;
  overall: number;
}

export interface PathContext {
  parentPath: string;
  depth: number;
  siblings: string[];
}

export class FolderSimilarityMatcher {
  private readonly weights = {
    tokenOverlap: 0.35,
    levenshtein: 0.25,
    permutation: 0.20,
    phonetic: 0.10,
    contextual: 0.10
  };

  private readonly similarityThreshold = 0.65;  // Seuil moins strict
  private readonly strongSimilarityThreshold = 0.80;

  /**
   * Calcule le score de similarité global entre deux dossiers
   */
  calculateSimilarity(
    folder1: string,
    folder2: string,
    context1?: PathContext,
    context2?: PathContext
  ): SimilarityScores {
    // Normalisation
    const norm1 = this.normalize(folder1);
    const norm2 = this.normalize(folder2);

    // Si identiques après normalisation, score parfait
    if (norm1 === norm2) {
      return {
        tokenOverlap: 1,
        levenshtein: 1,
        permutation: 1,
        phonetic: 1,
        contextual: 1,
        overall: 1
      };
    }

    // Tokenisation
    const tokens1 = this.tokenize(norm1);
    const tokens2 = this.tokenize(norm2);

    // Calcul des scores individuels
    const scores: SimilarityScores = {
      tokenOverlap: this.calculateTokenOverlap(tokens1, tokens2),
      levenshtein: this.calculateLevenshteinScore(norm1, norm2),
      permutation: this.calculatePermutationScore(tokens1, tokens2),
      phonetic: this.calculatePhoneticScore(norm1, norm2),
      contextual: this.calculateContextualScore(context1, context2),
      overall: 0
    };

    // Score pondéré final
    scores.overall =
      this.weights.tokenOverlap * scores.tokenOverlap +
      this.weights.levenshtein * scores.levenshtein +
      this.weights.permutation * scores.permutation +
      this.weights.phonetic * scores.phonetic +
      this.weights.contextual * scores.contextual;

    return scores;
  }

  /**
   * Détermine si deux dossiers sont similaires
   */
  areSimilar(folder1: string, folder2: string, context1?: PathContext, context2?: PathContext): boolean {
    const scores = this.calculateSimilarity(folder1, folder2, context1, context2);
    return scores.overall >= this.similarityThreshold;
  }

  /**
   * Détermine si deux dossiers sont fortement similaires (fusion automatique)
   */
  areStronglySimilar(folder1: string, folder2: string, context1?: PathContext, context2?: PathContext): boolean {
    const scores = this.calculateSimilarity(folder1, folder2, context1, context2);
    return scores.overall >= this.strongSimilarityThreshold;
  }

  /**
   * Normalise une chaîne pour la comparaison
   */
  normalize(text: string): string {
    return text
      .toLowerCase()
      .replace(/[_\-\s]+/g, ' ')   // Remplace séparateurs par espaces
      .replace(/\s+/g, ' ')        // Normalise espaces multiples
      .trim()
      .replace(/\bs\b/g, '')       // Supprime les 's' finaux isolés (pluriels simples)
      .replace(/\bes\b/g, '')      // Supprime les 'es' finaux isolés
      .replace(/\s+/g, ' ')        // Re-normalise après suppressions
      .trim();
  }

  /**
   * Tokenise une chaîne en mots significatifs
   */
  tokenize(text: string): string[] {
    // Préprocessing pour mieux gérer camelCase
    const preprocessed = text
      // Divise camelCase et PascalCase
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      // Remplace tous les séparateurs par des espaces
      .replace(/[_\-\.]+/g, ' ')
      .toLowerCase();

    // Split et nettoie
    const tokens = preprocessed
      .split(/\s+/)
      .filter(t => t.length > 0);

    // Normalisation des pluriels pour les tokens
    const normalizedTokens = tokens.map(token => {
      // Enlève les 's' finaux simples
      if (token.endsWith('s') && token.length > 2 && !token.endsWith('ss')) {
        return token.slice(0, -1);
      }
      return token;
    });

    return [...new Set(normalizedTokens)];
  }

  /**
   * Calcule le score de chevauchement des tokens
   */
  private calculateTokenOverlap(tokens1: string[], tokens2: string[]): number {
    if (tokens1.length === 0 || tokens2.length === 0) return 0;

    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size; // Jaccard similarity
  }

  /**
   * Calcule le score basé sur la distance de Levenshtein
   */
  private calculateLevenshteinScore(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);

    if (maxLength === 0) return 1;
    return 1 - (distance / maxLength);
  }

  /**
   * Distance de Levenshtein (nombre minimum d'éditions)
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    // Initialisation
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    // Calcul
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // Substitution
            matrix[i][j - 1] + 1,     // Insertion
            matrix[i - 1][j] + 1      // Suppression
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Calcule le score de permutation (ordre des mots différent)
   */
  private calculatePermutationScore(tokens1: string[], tokens2: string[]): number {
    if (tokens1.length !== tokens2.length) {
      // Si nombre de tokens différent, pénalité
      return 0.5 * this.calculateTokenOverlap(tokens1, tokens2);
    }

    // Vérifie si c'est juste une permutation
    const sorted1 = [...tokens1].sort().join('');
    const sorted2 = [...tokens2].sort().join('');

    return sorted1 === sorted2 ? 1 : this.calculateTokenOverlap(tokens1, tokens2);
  }

  /**
   * Calcule la similarité phonétique (soundex simplifié)
   */
  private calculatePhoneticScore(str1: string, str2: string): number {
    const soundex1 = this.soundex(str1);
    const soundex2 = this.soundex(str2);

    if (soundex1 === soundex2) return 1;

    // Calcule similarité partielle des codes soundex
    let matches = 0;
    const minLength = Math.min(soundex1.length, soundex2.length);

    for (let i = 0; i < minLength; i++) {
      if (soundex1[i] === soundex2[i]) matches++;
    }

    return matches / Math.max(soundex1.length, soundex2.length);
  }

  /**
   * Algorithme Soundex pour similarité phonétique
   */
  private soundex(str: string): string {
    const clean = str.toUpperCase().replace(/[^A-Z]/g, '');
    if (!clean) return '0000';

    const soundexMap: Record<string, string> = {
      B: '1', F: '1', P: '1', V: '1',
      C: '2', G: '2', J: '2', K: '2', Q: '2', S: '2', X: '2', Z: '2',
      D: '3', T: '3',
      L: '4',
      M: '5', N: '5',
      R: '6'
    };

    let code = clean[0];
    let prevCode = soundexMap[clean[0]] || '0';

    for (let i = 1; i < clean.length && code.length < 4; i++) {
      const currentCode = soundexMap[clean[i]] || '0';

      if (currentCode !== '0' && currentCode !== prevCode) {
        code += currentCode;
        prevCode = currentCode;
      }
    }

    return code.padEnd(4, '0');
  }

  /**
   * Calcule le score contextuel (même hiérarchie, même parent)
   */
  private calculateContextualScore(context1?: PathContext, context2?: PathContext): number {
    if (!context1 || !context2) return 0.5; // Score neutre si pas de contexte

    let score = 0;

    // Même parent direct = bonus
    if (context1.parentPath === context2.parentPath) {
      score += 0.5;
    }

    // Même profondeur = bonus
    if (context1.depth === context2.depth) {
      score += 0.3;
    }

    // Siblings similaires = bonus
    const commonSiblings = this.findCommonSiblings(context1.siblings, context2.siblings);
    if (commonSiblings.length > 0) {
      score += 0.2 * (commonSiblings.length / Math.max(context1.siblings.length, context2.siblings.length));
    }

    return Math.min(1, score);
  }

  /**
   * Trouve les siblings communs (avec tolérance de similarité)
   */
  private findCommonSiblings(siblings1: string[], siblings2: string[]): string[] {
    const common: string[] = [];

    for (const sib1 of siblings1) {
      for (const sib2 of siblings2) {
        if (this.normalize(sib1) === this.normalize(sib2)) {
          common.push(sib1);
          break;
        }
      }
    }

    return common;
  }

  /**
   * Détecte des patterns communs dans une liste de dossiers
   */
  detectCommonPatterns(folders: string[]): Map<string, string[]> {
    const patterns = new Map<string, string[]>();

    // Patterns de pluriels
    const pluralGroups = this.groupByPlurals(folders);
    pluralGroups.forEach((group, pattern) => {
      if (group.length > 1) {
        patterns.set(`plural_${pattern}`, group);
      }
    });

    // Patterns de séparateurs
    const separatorGroups = this.groupBySeparators(folders);
    separatorGroups.forEach((group, pattern) => {
      if (group.length > 1) {
        patterns.set(`separator_${pattern}`, group);
      }
    });

    // Patterns de numérotation
    const numberGroups = this.groupByNumbering(folders);
    numberGroups.forEach((group, pattern) => {
      if (group.length > 1) {
        patterns.set(`numbering_${pattern}`, group);
      }
    });

    return patterns;
  }

  /**
   * Groupe les dossiers par variantes de pluriel
   */
  private groupByPlurals(folders: string[]): Map<string, string[]> {
    const groups = new Map<string, string[]>();

    for (const folder of folders) {
      const singular = folder.replace(/s\b/g, '').replace(/es\b/g, '');

      if (!groups.has(singular)) {
        groups.set(singular, []);
      }
      groups.get(singular)!.push(folder);
    }

    return groups;
  }

  /**
   * Groupe les dossiers par variantes de séparateurs
   */
  private groupBySeparators(folders: string[]): Map<string, string[]> {
    const groups = new Map<string, string[]>();

    for (const folder of folders) {
      const normalized = folder.replace(/[_\-\s]+/g, '');

      if (!groups.has(normalized)) {
        groups.set(normalized, []);
      }
      groups.get(normalized)!.push(folder);
    }

    return groups;
  }

  /**
   * Groupe les dossiers par patterns de numérotation
   */
  private groupByNumbering(folders: string[]): Map<string, string[]> {
    const groups = new Map<string, string[]>();

    for (const folder of folders) {
      const basePattern = folder.replace(/\d+/g, '#');

      if (!groups.has(basePattern)) {
        groups.set(basePattern, []);
      }
      groups.get(basePattern)!.push(folder);
    }

    return groups;
  }
}