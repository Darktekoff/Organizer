/**
 * ClassifierV6 - Classification intelligente simplifiée
 * Adapté et simplifié depuis V5, sans WorkerPool ni GPT5Nano
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type {
  Classification,
  MusicTaxonomy,
  MusicFamily,
  KeywordPattern,
  ClassificationRules,
  Phase2Config,
  ClassifiedPack,
  AlternativeClassification
} from './Phase2Types';
import { ClassificationMethod } from './Phase2Types';
import type { EnrichedPack } from '@shared/interfaces/BusinessTypes';
import { GPT5NanoService } from '../../shared/ai/GPT5NanoService';

export class ClassifierV6 {
  private config: Phase2Config;
  private taxonomy: MusicTaxonomy | null = null;
  private keywordPatterns: KeywordPattern[] = [];
  private familyKeywords: Map<string, string[]> = new Map();
  private gptService: GPT5NanoService;
  private fastPassRules: Array<{
    pattern: RegExp;
    family: string;
    style: string;
    keyword: string;
    confidence: number;
    reason: string;
  }>;

  constructor(config: Phase2Config) {
    this.config = config;
    this.gptService = new GPT5NanoService({
      maxBatchSize: 25, // Plus petit car Phase 2 traite moins de packs
      enableFallback: config.enableAIFallback !== false
    });
    this.fastPassRules = [
      {
        pattern: /hardstyle/,
        family: 'Hard Dance',
        style: 'Hardstyle',
        keyword: 'hardstyle',
        confidence: 0.92,
        reason: 'Nom explicite Hardstyle'
      },
      {
        pattern: /rawstyle/,
        family: 'Hard Dance',
        style: 'Rawstyle',
        keyword: 'rawstyle',
        confidence: 0.9,
        reason: 'Nom explicite Rawstyle'
      },
      {
        pattern: /uptempo/,
        family: 'Hard Dance',
        style: 'Uptempo',
        keyword: 'uptempo',
        confidence: 0.88,
        reason: 'Nom explicite Uptempo'
      },
      {
        pattern: /future\s*bass/,
        family: 'Bass Music',
        style: 'Future_Bass',
        keyword: 'future bass',
        confidence: 0.9,
        reason: 'Nom explicite Future Bass'
      },
      {
        pattern: /melodic\s*dubstep/,
        family: 'Bass Music',
        style: 'Melodic_Dubstep',
        keyword: 'melodic dubstep',
        confidence: 0.9,
        reason: 'Nom explicite Melodic Dubstep'
      },
      {
        pattern: /dubstep/,
        family: 'Bass Music',
        style: 'Dubstep',
        keyword: 'dubstep',
        confidence: 0.88,
        reason: 'Nom explicite Dubstep'
      },
      {
        pattern: /festival|mainstage/,
        family: 'Pop / Mainstage / Dance',
        style: 'Mainstage',
        keyword: 'festival/mainstage',
        confidence: 0.88,
        reason: 'Nom évoque la scène festival/mainstage'
      },
      {
        pattern: /anthem/,
        family: 'Pop / Mainstage / Dance',
        style: 'EDM',
        keyword: 'anthem',
        confidence: 0.86,
        reason: 'Nom indique un anthem EDM'
      }
    ];
  }

  /**
   * Initialise le classifier en chargeant la taxonomie
   */
  async initialize(): Promise<void> {
    try {
      await this.loadTaxonomy();
      this.buildKeywordPatterns();
    } catch (error) {
      console.warn('Erreur lors du chargement de la taxonomie, utilisation des patterns par défaut:', error);
      this.initializeDefaultTaxonomy();
    }
  }

  /**
   * Classifie un pack enrichi
   */
  async classifyPack(pack: EnrichedPack): Promise<Classification | null> {
    const packName = pack.packId.toLowerCase();

    const fastPass = this.tryFastPassClassification(pack);
    if (fastPass && fastPass.confidence >= this.config.confidenceThreshold) {
      return fastPass;
    }

    // 1. Classification lexicale (mots-clés)
    const lexicalResult = await this.classifyLexical(pack);
    if (lexicalResult && lexicalResult.confidence >= this.config.skipConfidenceThreshold) {
      return lexicalResult;
    }

    // 2. Classification contextuelle (structure du pack)
    const contextualResult = await this.classifyContextual(pack);
    if (contextualResult && contextualResult.confidence >= this.config.skipConfidenceThreshold) {
      return contextualResult;
    }

    // 3. Classification taxonomique (patterns YAML)
    const taxonomicResult = await this.classifyTaxonomic(packName, pack);
    if (taxonomicResult && taxonomicResult.confidence >= this.config.skipConfidenceThreshold) {
      return taxonomicResult;
    }

    // 4. Retourner le meilleur résultat si disponible
    const results = [lexicalResult, contextualResult, taxonomicResult].filter(Boolean);
    if (results.length > 0) {
      const bestResult = results.sort((a, b) => b!.confidence - a!.confidence)[0];
      if (bestResult && bestResult.confidence >= this.config.confidenceThreshold) {
        return bestResult;
      }
    }

    // 5. AI Fallback si activé et si les autres méthodes ont échoué
    if (this.config.enableAIFallback && this.gptService.isAvailable()) {
      try {
        const aiResult = await this.classifyWithAI(pack);
        if (aiResult && aiResult.confidence >= this.config.confidenceThreshold) {
          return aiResult;
        }
      } catch (error) {
        console.warn('[ClassifierV6] AI Fallback failed:', error);
      }
    }

    // 6. Retourner le meilleur résultat même si confiance faible
    if (results.length > 0) {
      return results.sort((a, b) => b!.confidence - a!.confidence)[0] || null;
    }

    return null;
  }

  private tryFastPassClassification(pack: EnrichedPack): Classification | null {
    const segments = [pack.packId, pack.originalPack?.name, ...(pack.tags || [])]
      .map(segment => (typeof segment === 'string' ? segment.toLowerCase() : ''))
      .filter(Boolean);

    if (segments.length === 0) return null;

    const searchSpace = segments.join(' ');

    for (const rule of this.fastPassRules) {
      const match = rule.pattern.exec(searchSpace);
      if (match) {
        return {
          family: rule.family,
          style: rule.style,
          confidence: rule.confidence,
          method: ClassificationMethod.LEXICAL,
          reasoning: [rule.reason],
          matchedKeywords: [rule.keyword],
          appliedRules: ['fast_pass_keyword']
        };
      }
    }

    return null;
  }

  /**
   * Classification lexicale basée sur les mots-clés
   */
  private async classifyLexical(pack: EnrichedPack): Promise<Classification | null> {
    const textSegments: string[] = [];
    const pushSegment = (value: unknown) => {
      if (typeof value === 'string' && value.trim().length > 0) {
        textSegments.push(value.toLowerCase());
      }
    };

    pushSegment(pack.packId);
    pushSegment(pack.originalPack?.name);
    (pack.tags || []).forEach(pushSegment);
    (pack.originalPack?.taxonomyMatches || []).forEach(pushSegment);

    const allText = textSegments.join(' ');
    let bestMatch: { family: string; style: string; confidence: number; keywords: string[] } | null = null;

    for (const pattern of this.keywordPatterns) {
      const matchedKeywords: string[] = [];
      let matchedWeight = 0;

      for (const keyword of pattern.keywords) {
        const normalized = keyword.toLowerCase();
        if (!normalized.trim()) continue;

        if (allText.includes(normalized)) {
          matchedKeywords.push(keyword);

          const keywordWeight = pattern.keywordWeights?.get(normalized)
            ?? pattern.keywordWeights?.get(keyword)
            ?? pattern.weight;

          matchedWeight += keywordWeight;
        }
      }

      if (matchedKeywords.length > 0) {
        const confidence = pattern.requiresAll
          ? (matchedKeywords.length === pattern.keywords.length ? Math.min(0.95, matchedWeight) : 0)
          : Math.min(0.95, matchedWeight);

        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = {
            family: pattern.family,
            style: pattern.style || pattern.family,
            confidence,
            keywords: matchedKeywords
          };
        }
      }
    }

    if (!bestMatch || bestMatch.confidence < 0.35) {
      return null;
    }

    let adjustedConfidence = bestMatch.confidence;
    const reasoning = [`Détecté via mots-clés: ${bestMatch.keywords.join(', ')}`];

    const totalAudio = pack.audioFiles ?? 0;
    const totalPresets = pack.presetFiles ?? 0;
    const totalFiles = pack.fileCount ?? (totalAudio + totalPresets);
    const hasPresets = totalPresets > 0 || (pack.metadata?.presetFormats?.length ?? 0) > 0;
    const hasAudio = totalAudio > 0;

    const familyLower = bestMatch.family.toLowerCase();

    if (familyLower.includes('presets')) {
      if (!hasPresets && hasAudio) {
        reasoning.push('⚠️ Aucun preset détecté dans le contenu malgré un score lexical “Presets”.');
        adjustedConfidence = 0;
      } else if (totalFiles > 0) {
        const audioRatio = totalAudio / totalFiles;
        const presetRatio = totalPresets / totalFiles;

        if (audioRatio > 0.6 && presetRatio < 0.2) {
          reasoning.push(`⚠️ Ratio audio trop élevé (${Math.round(audioRatio * 100)}%) pour un pack de presets.`);
          adjustedConfidence = Math.min(adjustedConfidence, bestMatch.confidence * 0.2);
        }
      }
    }

    if (adjustedConfidence < 0.35) {
      return null;
    }

    return {
      family: bestMatch.family,
      style: bestMatch.style,
      confidence: adjustedConfidence,
      method: ClassificationMethod.LEXICAL,
      reasoning,
      matchedKeywords: bestMatch.keywords,
      appliedRules: ['lexical_keyword_matching']
    };
  }

  /**
   * Classification contextuelle basée sur la structure
   */
  private async classifyContextual(pack: EnrichedPack): Promise<Classification | null> {
    const reasoning: string[] = [];
    let family = '';
    let style = '';
    let confidence = 0;

    // Analyse du BPM moyen
    if (pack.avgBPM) {
      if (pack.avgBPM >= 140 && pack.avgBPM <= 155) {
        family = 'Hard Dance';
        style = 'Hardstyle';
        confidence += 0.4;
        reasoning.push(`BPM ${pack.avgBPM} typique du Hardstyle`);
      } else if (pack.avgBPM >= 70 && pack.avgBPM <= 85) {
        family = 'Bass Music';
        style = 'Dubstep';
        confidence += 0.3;
        reasoning.push(`BPM ${pack.avgBPM} typique du Dubstep`);
      } else if (pack.avgBPM >= 120 && pack.avgBPM <= 135) {
        family = 'Electronic';
        style = 'Techno';
        confidence += 0.2;
        reasoning.push(`BPM ${pack.avgBPM} typique de l'Electronic`);
      }
    }

    // Analyse des formats audio
    if (pack.metadata.audioFormats.includes('WAV') && pack.audioFiles > 50) {
      confidence += 0.2;
      reasoning.push('Pack professionnel (WAV + nombreux fichiers)');
    }

    // Analyse des presets
    if (pack.hasPresets && pack.metadata.presetFormats.includes('serum')) {
      if (!family) {
        family = 'Bass Music';
        style = 'Future Bass';
        confidence += 0.3;
        reasoning.push('Presets Serum typiques du Bass Music');
      }
    }

    // Analyse loops vs oneshots
    if (pack.hasLoops && !pack.hasOneShots) {
      confidence += 0.1;
      reasoning.push('Pack orienté loops');
    } else if (pack.hasOneShots && !pack.hasLoops) {
      confidence += 0.1;
      reasoning.push('Pack orienté one-shots');
    }

    if (confidence >= 0.3 && family && style) {
      return {
        family,
        style,
        confidence: Math.min(0.8, confidence), // Plafond pour contextuel
        method: ClassificationMethod.CONTEXTUAL,
        reasoning,
        matchedKeywords: [],
        appliedRules: ['contextual_bpm', 'contextual_structure']
      };
    }

    return null;
  }

  /**
   * Classification taxonomique via patterns YAML
   */
  private async classifyTaxonomic(packName: string, pack: EnrichedPack): Promise<Classification | null> {
    if (!this.taxonomy) return null;

    const reasoning: string[] = [];
    let bestMatch: { family: MusicFamily; confidence: number; matches: string[] } | null = null;

    for (const family of this.taxonomy.families) {
      const matches: string[] = [];
      let score = 0;

      // Vérifier les mots-clés de la famille
      for (const keyword of family.keywords) {
        if (packName.includes(keyword.toLowerCase())) {
          matches.push(keyword);
          score += 0.2;
        }
      }

      // Vérifier les mots-clés d'exclusion
      if (family.excludeKeywords) {
        for (const exclude of family.excludeKeywords) {
          if (packName.includes(exclude.toLowerCase())) {
            score -= 0.3;
            break;
          }
        }
      }

      const confidence = Math.max(0, Math.min(family.confidence, score));

      if (confidence > 0.2 && (!bestMatch || confidence > bestMatch.confidence)) {
        bestMatch = { family, confidence, matches };
      }
    }

    if (bestMatch && bestMatch.confidence >= 0.2) {
      // Choisir un style par défaut ou le premier disponible
      const style = bestMatch.family.styles[0] || bestMatch.family.name;
      let adjustedConfidence = bestMatch.confidence;
      const reasoning = [`Famille détectée: ${bestMatch.family.name}`, `Mots-clés: ${bestMatch.matches.join(', ')}`];

      // PROTECTION: Vérifier le ratio de fichiers pour "Presets & VSTs"
      if (bestMatch.family.name === 'Presets & VSTs' || bestMatch.family.id === 'presets') {
        const totalFiles = pack.fileCount || 0;
        const audioFiles = pack.audioFiles || 0;
        const presetFiles = pack.presetFiles || 0;

        if (totalFiles > 0) {
          const audioRatio = audioFiles / totalFiles;
          const presetRatio = presetFiles / totalFiles;

          // Si plus de 60% de fichiers audio et moins de 20% de presets, c'est suspect
          if (audioRatio > 0.6 && presetRatio < 0.2) {
            adjustedConfidence *= 0.15; // Réduire drastiquement la confiance
            reasoning.push(`⚠️ Ratio audio trop élevé (${Math.round(audioRatio * 100)}%) pour famille Presets`);
          }
        }
      }

      return {
        family: bestMatch.family.name,
        style,
        confidence: adjustedConfidence,
        method: ClassificationMethod.TAXONOMIC,
        reasoning,
        matchedKeywords: bestMatch.matches,
        appliedRules: ['taxonomic_family_matching']
      };
    }

    return null;
  }

  /**
   * Charge la taxonomie depuis le fichier YAML
   */
  private async loadTaxonomy(): Promise<void> {
    const taxonomyPath = this.config.taxonomyPath ||
      path.join(process.cwd(), 'src/main/services/pipeline/shared/taxonomies/music-families-v6.yaml');

    try {
      const content = await fs.readFile(taxonomyPath, 'utf-8');
      const rawTaxonomy = yaml.load(content) as any;

      // Convertir la structure YAML en format ClassifierV6
      const families: MusicFamily[] = [];
      for (const family of rawTaxonomy.families || []) {
        const keywordMetadata = this.extractKeywordsFromFamily(family);
        families.push({
          id: family.id || family.name.toLowerCase().replace(/\s+/g, '_'),
          name: family.name,
          styles: family.styles || [],
          keywords: keywordMetadata.keywords,
          keywordWeights: keywordMetadata.keywordWeights,
          confidence: typeof family.confidence === 'number' ? family.confidence : 0.8,
          color: family.color
        });
      }

      this.taxonomy = {
        families,
        styleSynonyms: new Map(Object.entries(rawTaxonomy.style_synonyms || {})),
        classificationRules: {
          priorityPatterns: (rawTaxonomy.classification_rules?.priority_patterns || []).map((p: any) => ({
            pattern: p.pattern,
            family: p.family,
            style: p.style,
            priority: 5,
            confidence: p.confidence || 0.8
          })),
          familyExclusions: new Map(Object.entries(rawTaxonomy.classification_rules?.family_exclusions || {})),
          styleOverrides: new Map(),
          contextualRules: []
        },
        keywordPatterns: []
      };

    } catch (error) {
      throw new Error(`Impossible de charger la taxonomie: ${error}`);
    }
  }

  /**
   * Extrait les mots-clés d'une famille depuis son nom et ses styles
   */
  private extractKeywordsFromFamily(family: any): { keywords: string[]; keywordWeights: Map<string, number> } {
    const keywords = new Set<string>();
    const keywordWeights = new Map<string, number>();

    const explicitKeywords = Array.isArray(family.keywords)
      ? family.keywords
      : [];

    if (explicitKeywords.length > 0) {
      for (const entry of explicitKeywords) {
        if (typeof entry === 'string') {
          const normalized = entry.toLowerCase().trim();
          if (normalized) {
            keywords.add(normalized);
            if (!keywordWeights.has(normalized)) {
              keywordWeights.set(normalized, 1);
            }
          }
        } else if (entry && typeof entry === 'object') {
          const term = String(entry.term || entry.keyword || '').toLowerCase().trim();
          if (!term) continue;
          const weight = typeof entry.weight === 'number'
            ? entry.weight
            : typeof entry.score === 'number'
              ? entry.score
              : 1;
          keywords.add(term);
          keywordWeights.set(term, Math.max(0.1, Math.min(1.5, weight)));
        }
      }
    } else {
      // Fallback sur la génération automatique si aucun mot-clé n'est défini
      const familyName = String(family.name || '').toLowerCase();
      if (familyName) {
        keywords.add(familyName);
        keywordWeights.set(familyName, 0.8);

        if (familyName.includes('bass')) {
          keywords.add('bass');
          keywordWeights.set('bass', 0.6);
        }
        if (familyName.includes('hard')) {
          keywords.add('hard');
          keywordWeights.set('hard', 0.5);
        }
        if (familyName.includes('dance')) {
          keywords.add('dance');
          keywordWeights.set('dance', 0.4);
        }
        if (familyName.includes('house')) {
          keywords.add('house');
          keywordWeights.set('house', 0.5);
        }
        if (familyName.includes('techno')) {
          keywords.add('techno');
          keywordWeights.set('techno', 0.5);
        }
        if (familyName.includes('hip')) {
          keywords.add('hip hop');
          keywordWeights.set('hip hop', 0.5);
        }
        if (familyName.includes('trap')) {
          keywords.add('trap');
          keywordWeights.set('trap', 0.6);
        }
      }

      // Pour "Presets & VSTs", on n'ajoute PAS automatiquement les styles génériques comme mots-clés
      // car "bass", "lead", "pad" matchent avec des packs audio normaux !
      const isPresetsFamily = family.name === 'Presets & VSTs' || family.id === 'presets';
      const genericPresetTerms = ['bass', 'lead', 'pad', 'pluck', 'arp', 'chord', 'fx', 'sequence'];

      for (const style of family.styles || []) {
        const styleKeyword = String(style).toLowerCase().replace(/_/g, ' ').trim();
        if (!styleKeyword) continue;

        // Si c'est la famille Presets et que c'est un terme générique, on skip
        if (isPresetsFamily && genericPresetTerms.includes(styleKeyword)) {
          continue; // Ne pas ajouter ces mots génériques pour les presets
        }

        keywords.add(styleKeyword);
        keywordWeights.set(styleKeyword, 0.75);

        if (styleKeyword.includes('dubstep')) {
          keywords.add('dubstep');
          keywordWeights.set('dubstep', 0.8);
        }
        if (styleKeyword.includes('hardstyle')) {
          keywords.add('hardstyle');
          keywordWeights.set('hardstyle', 0.9);
        }
        if (styleKeyword.includes('rawstyle')) {
          keywords.add('rawstyle');
          keywordWeights.set('rawstyle', 0.85);
        }
      }
    }

    if (keywords.size === 0 && family.name) {
      const fallback = String(family.name).toLowerCase();
      keywords.add(fallback);
      keywordWeights.set(fallback, 0.7);
    }

    return {
      keywords: Array.from(keywords),
      keywordWeights
    };
  }

  /**
   * Construit les patterns de mots-clés depuis la taxonomie
   */
  private buildKeywordPatterns(): void {
    if (!this.taxonomy) return;

    // Patterns depuis la taxonomie
    this.keywordPatterns = [...this.taxonomy.keywordPatterns];

    // Patterns depuis les familles
    for (const family of this.taxonomy.families) {
      this.keywordPatterns.push({
        keywords: family.keywords,
        family: family.name,
        style: family.styles[0],
        weight: Math.min(0.85, Math.max(0.65, family.confidence || 0.75)),
        requiresAll: false,
        keywordWeights: family.keywordWeights ? new Map(family.keywordWeights) : undefined
      });
    }

    // Construire la map des mots-clés par famille
    for (const family of this.taxonomy.families) {
      this.familyKeywords.set(family.name, family.keywords);
    }
  }

  /**
   * Initialise une taxonomie par défaut si le fichier n'existe pas
   */
  private initializeDefaultTaxonomy(): void {
    this.taxonomy = {
      families: [
        {
          id: 'hard-dance',
          name: 'Hard Dance',
          styles: ['Hardstyle', 'Rawstyle', 'Uptempo'],
          keywords: ['hardstyle', 'rawstyle', 'uptempo', 'ops', 'criminal', 'climax'],
          keywordWeights: new Map([
            ['hardstyle', 1],
            ['rawstyle', 0.9],
            ['uptempo', 0.85],
            ['ops', 0.6],
            ['criminal', 0.6],
            ['climax', 0.6]
          ]),
          confidence: 0.8,
          color: '#ff6b6b'
        },
        {
          id: 'bass-music',
          name: 'Bass Music',
          styles: ['Dubstep', 'Riddim', 'Future Bass'],
          keywords: ['dubstep', 'riddim', 'bass', 'black octopus', 'virtual riot'],
          keywordWeights: new Map([
            ['dubstep', 1],
            ['riddim', 0.9],
            ['bass', 0.6],
            ['black octopus', 0.6],
            ['virtual riot', 0.6]
          ]),
          confidence: 0.8,
          color: '#4ecdc4'
        },
        {
          id: 'electronic',
          name: 'Electronic',
          styles: ['Techno', 'House', 'Trance'],
          keywords: ['techno', 'house', 'trance', 'electronic', 'warehouse'],
          keywordWeights: new Map([
            ['techno', 0.9],
            ['house', 0.8],
            ['trance', 0.8],
            ['electronic', 0.7],
            ['warehouse', 0.5]
          ]),
          confidence: 0.7,
          color: '#45b7d1'
        },
        {
          id: 'hip-hop',
          name: 'Hip Hop',
          styles: ['Trap', 'Hip Hop', 'Rap'],
          keywords: ['trap', 'hip hop', 'rap', 'kshmr', 'vocal'],
          keywordWeights: new Map([
            ['trap', 0.9],
            ['hip hop', 0.8],
            ['rap', 0.7],
            ['kshmr', 0.5],
            ['vocal', 0.5]
          ]),
          confidence: 0.7,
          color: '#96ceb4'
        }
      ],
      styleSynonyms: new Map([
        ['hardstyle', 'Hardstyle'],
        ['dubstep', 'Dubstep'],
        ['techno', 'Techno'],
        ['trap', 'Trap']
      ]),
      classificationRules: {
        priorityPatterns: [],
        familyExclusions: new Map(),
        styleOverrides: new Map(),
        contextualRules: []
      },
      keywordPatterns: []
    };

    this.buildKeywordPatterns();
  }

  /**
   * Génère des suggestions alternatives pour un pack
   */
  async generateAlternatives(pack: EnrichedPack, currentClassification?: Classification): Promise<AlternativeClassification[]> {
    const alternatives: AlternativeClassification[] = [];
    const packName = pack.packId.toLowerCase();

    if (!this.taxonomy) return alternatives;

    // Générer des alternatives basées sur d'autres familles
    for (const family of this.taxonomy.families) {
      if (currentClassification && family.name === currentClassification.family) continue;

      let confidence = 0;
      const matches: string[] = [];

      for (const keyword of family.keywords) {
        if (packName.includes(keyword)) {
          matches.push(keyword);
          confidence += 0.15;
        }
      }

      if (confidence > 0.1) {
        alternatives.push({
          family: family.name,
          style: family.styles[0] || family.name,
          confidence: Math.min(0.8, confidence),
          reason: `Mots-clés détectés: ${matches.join(', ')}`
        });
      }
    }

    return alternatives.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  }

  /**
   * Retourne les familles disponibles
   */
  getAvailableFamilies(): string[] {
    return this.taxonomy?.families.map(f => f.name) || [];
  }

  /**
   * Retourne les styles pour une famille donnée
   */
  getStylesForFamily(familyName: string): string[] {
    const family = this.taxonomy?.families.find(f => f.name === familyName);
    return family?.styles || [];
  }

  /**
   * Classification avec IA (GPT-5 Nano) comme fallback
   */
  private async classifyWithAI(pack: EnrichedPack): Promise<Classification | null> {
    try {
      console.log(`[ClassifierV6] Attempting AI classification for pack: ${pack.packId}`);

      // Classifier le pack avec GPT-5 Nano
      const aiClassifications = await this.gptService.classifyEnrichedPacks([pack]);

      if (aiClassifications.length === 0) {
        console.warn(`[ClassifierV6] No AI classification returned for pack: ${pack.packId}`);
        return null;
      }

      const aiResult = aiClassifications[0];

      console.log(`[ClassifierV6] AI classified "${pack.packId}" as ${aiResult.family} → ${aiResult.style} (${(aiResult.confidence * 100).toFixed(1)}%)`);

      return {
        family: aiResult.family,
        style: aiResult.style,
        confidence: aiResult.confidence,
        method: ClassificationMethod.AI_FALLBACK,
        reasoning: aiResult.reasoning || ['GPT-5 Nano AI classification'],
        matchedKeywords: [],
        appliedRules: ['ai_fallback_gpt5_nano']
      };

    } catch (error) {
      console.error(`[ClassifierV6] AI classification failed for pack "${pack.packId}":`, error);
      return null;
    }
  }
}
