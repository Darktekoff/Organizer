/**
 * ClassifierV7 - Pipeline de Classification Optimisé
 *
 * NOUVEAU PIPELINE LOGIQUE :
 * 1. Classification Taxonomique (YAML + FastPass intégré)
 * 2. Bundle Context (analyse contextuelle si échec taxonomique)
 * 3. IA Fallback (pour packs isolés ambigus)
 * 4. Quarantaine (échec complet → révision manuelle)
 *
 * SUPPRESSIONS par rapport à V6 :
 * - FastPass séparé (fusionné dans Taxonomique)
 * - Classification structurelle (données insuffisantes)
 * - Redondances multiples
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type {
  Classification,
  MusicTaxonomy,
  MusicFamily,
  Phase2Config,
  ClassifiedPack
} from './Phase2Types';
import { ClassificationMethod } from './Phase2Types';
import type { EnrichedPack } from '@shared/interfaces/BusinessTypes';
import { GPT5NanoService } from '../../shared/ai/GPT5NanoService';

export interface ClassifierV7Result {
  classification: Classification | null;
  quarantineReason?: string;
  needsManualReview: boolean;
  processingSteps: string[];  // Pour debug/logs
}

export class ClassifierV7 {
  private config: Phase2Config;
  private taxonomy: MusicTaxonomy | null = null;
  private gptService: GPT5NanoService;

  constructor(config: Phase2Config) {
    this.config = config;
    this.gptService = new GPT5NanoService({
      maxBatchSize: 25,
      enableFallback: config.enableAIFallback !== false
    });
  }

  /**
   * Initialise le classifier en chargeant la taxonomie
   */
  async initialize(): Promise<void> {
    try {
      await this.loadTaxonomy();
      console.log(`[ClassifierV7] Initialisé avec taxonomie (${this.taxonomy?.families.length || 0} familles)`);
    } catch (error) {
      console.warn('[ClassifierV7] Erreur chargement taxonomie, utilisation des patterns par défaut:', error);
      this.initializeDefaultTaxonomy();
    }
  }

  /**
   * PIPELINE PRINCIPAL - Classification d'un pack enrichi
   */
  async classifyPack(pack: EnrichedPack): Promise<ClassifierV7Result> {
    const processingSteps: string[] = [];

    try {
      // ÉTAPE 1: Classification Taxonomique (FastPass intégré)
      processingSteps.push("1. Analyse taxonomique");
      const taxonomicResult = await this.classifyTaxonomic(pack);

      if (taxonomicResult && taxonomicResult.confidence >= this.config.skipConfidenceThreshold) {
        processingSteps.push(`✅ Succès taxonomique: ${taxonomicResult.family}/${taxonomicResult.style}`);
        return {
          classification: taxonomicResult,
          needsManualReview: false,
          processingSteps
        };
      }

      // ÉTAPE 2: Bundle Context (si échec taxonomique)
      processingSteps.push("2. Analyse bundle contextuelle");
      const bundleResult = await this.classifyByBundleContext(pack);

      if (bundleResult && bundleResult.confidence >= this.config.skipConfidenceThreshold) {
        processingSteps.push(`✅ Succès bundle: ${bundleResult.family}/${bundleResult.style}`);
        return {
          classification: bundleResult,
          needsManualReview: false,
          processingSteps
        };
      }

      // ÉTAPE 3: IA Fallback (pour packs isolés)
      if (this.config.enableAIFallback && this.gptService.isAvailable()) {
        processingSteps.push("3. IA Fallback");
        const aiResult = await this.classifyWithAI(pack);

        if (aiResult && aiResult.confidence >= this.config.confidenceThreshold) {
          processingSteps.push(`✅ Succès IA: ${aiResult.family}/${aiResult.style}`);
          return {
            classification: aiResult,
            needsManualReview: false,
            processingSteps
          };
        }
      }

      // ÉTAPE 4: Quarantaine (échec complet)
      processingSteps.push("4. ⚠️ Mise en quarantaine");
      const bestAttempt = this.getBestAttempt([taxonomicResult, bundleResult]);

      return {
        classification: bestAttempt,
        quarantineReason: this.generateQuarantineReason(pack, [taxonomicResult, bundleResult]),
        needsManualReview: true,
        processingSteps
      };

    } catch (error) {
      processingSteps.push(`❌ Erreur: ${error instanceof Error ? error.message : 'Inconnue'}`);
      return {
        classification: null,
        quarantineReason: `Erreur de classification: ${error}`,
        needsManualReview: true,
        processingSteps
      };
    }
  }

  /**
   * ÉTAPE 1: Classification Taxonomique (avec FastPass intégré)
   * Combine recherche rapide + analyse approfondie de la taxonomie YAML
   */
  private async classifyTaxonomic(pack: EnrichedPack): Promise<Classification | null> {
    if (!this.taxonomy) return null;

    const packText = this.buildSearchText(pack);
    let bestMatch: { family: MusicFamily; confidence: number; matches: string[]; method: string } | null = null;

    // FastPass intégré: recherche des mots-clés prioritaires
    for (const family of this.taxonomy.families) {
      const matches: string[] = [];
      let score = 0;
      let fastPassHit = false;

      // Vérifier les mots-clés de la famille avec poids
      for (const keyword of family.keywords) {
        if (packText.includes(keyword.toLowerCase())) {
          matches.push(keyword);
          const weight = family.keywordWeights?.get(keyword) || 0.8;
          score += weight;

          // FastPass: si mot-clé très spécifique et haute confiance
          if (weight >= 0.9) {
            fastPassHit = true;
          }
        }
      }

      if (matches.length > 0) {
        let confidence = Math.min(0.95, score * 0.8);

        // Bonus FastPass pour mots-clés spécifiques
        if (fastPassHit) {
          confidence = Math.min(0.95, confidence * 1.2);
        }

        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = {
            family,
            confidence,
            matches,
            method: fastPassHit ? 'FastPass Taxonomique' : 'Taxonomique Standard'
          };
        }
      }
    }

    if (bestMatch && bestMatch.confidence >= 0.3) {
      const style = bestMatch.family.styles[0] || bestMatch.family.name;

      return {
        family: bestMatch.family.name,
        style,
        confidence: bestMatch.confidence,
        method: ClassificationMethod.TAXONOMIC,
        reasoning: [
          `${bestMatch.method}: ${bestMatch.family.name}`,
          `Mots-clés: ${bestMatch.matches.join(', ')}`
        ],
        matchedKeywords: bestMatch.matches,
        appliedRules: ['taxonomic_integrated_fastpass']
      };
    }

    return null;
  }

  /**
   * ÉTAPE 2: Classification par Bundle Context
   * Uniquement si la taxonomique échoue
   */
  private async classifyByBundleContext(pack: EnrichedPack): Promise<Classification | null> {
    if (!pack.bundleInfo || !this.taxonomy) {
      return null;
    }

    const { bundleName, bundleKeywords, siblingPacks } = pack.bundleInfo;
    console.log(`[ClassifierV7] Analyse bundle pour "${pack.packId}" via "${bundleName}"`);

    // Analyser les mots-clés du bundle avec la taxonomie
    const bundleText = bundleKeywords.join(' ').toLowerCase();
    let bestMatch: { family: MusicFamily; confidence: number; keywords: string[] } | null = null;

    for (const family of this.taxonomy.families) {
      const matches: string[] = [];
      let score = 0;

      for (const keyword of family.keywords) {
        if (bundleText.includes(keyword.toLowerCase())) {
          matches.push(keyword);
          const weight = family.keywordWeights?.get(keyword) || 0.8;
          score += weight;
        }
      }

      if (matches.length > 0) {
        const confidence = Math.min(0.85, score * 0.7); // Facteur contextuel

        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = { family, confidence, keywords: matches };
        }
      }
    }

    if (bestMatch && bestMatch.confidence >= 0.4) {
      // Validation par les packs frères
      const siblingConfidence = this.analyzeSiblings(bestMatch.family, siblingPacks, pack.packId);
      const finalConfidence = Math.min(0.9, bestMatch.confidence * (1 + siblingConfidence * 0.3));

      return {
        family: bestMatch.family.name,
        style: bestMatch.family.styles[0] || bestMatch.family.name,
        confidence: finalConfidence,
        method: ClassificationMethod.CONTEXTUAL,
        reasoning: [
          `Bundle "${bundleName}" → ${bestMatch.keywords.join(', ')}`,
          `Validation siblings: ${Math.round(siblingConfidence * 100)}%`
        ],
        matchedKeywords: bestMatch.keywords,
        appliedRules: ['bundle_contextual_analysis']
      };
    }

    return null;
  }

  /**
   * ÉTAPE 3: Classification IA Fallback
   */
  private async classifyWithAI(pack: EnrichedPack): Promise<Classification | null> {
    try {
      console.log(`[ClassifierV7] IA Fallback pour "${pack.packId}"`);

      const aiClassifications = await this.gptService.classifyEnrichedPacks([pack]);

      if (aiClassifications.length === 0) {
        return null;
      }

      const aiResult = aiClassifications[0];

      return {
        family: aiResult.family,
        style: aiResult.style,
        confidence: aiResult.confidence,
        method: ClassificationMethod.AI_FALLBACK,
        reasoning: aiResult.reasoning || ['Classification IA GPT-5 Nano'],
        matchedKeywords: [],
        appliedRules: ['ai_fallback_gpt5_nano']
      };

    } catch (error) {
      console.error(`[ClassifierV7] IA Fallback échoué pour "${pack.packId}":`, error);
      return null;
    }
  }

  /**
   * Utilitaires
   */
  private buildSearchText(pack: EnrichedPack): string {
    const segments = [
      pack.packId,
      pack.originalPack?.name,
      ...(pack.tags || []),
      ...(pack.originalPack?.taxonomyMatches || [])
    ].filter(s => typeof s === 'string' && s.trim());

    return segments.join(' ').toLowerCase();
  }

  private analyzeSiblings(targetFamily: MusicFamily, siblingPacks: string[], currentPackId: string): number {
    let matchingCount = 0;
    let totalSiblings = 0;

    for (const siblingName of siblingPacks) {
      if (siblingName === currentPackId) continue;
      totalSiblings++;

      const siblingLower = siblingName.toLowerCase();

      // Vérifier si le sibling contient des mots-clés de la famille cible
      for (const keyword of targetFamily.keywords) {
        if (siblingLower.includes(keyword.toLowerCase())) {
          matchingCount++;
          break;
        }
      }
    }

    return totalSiblings > 0 ? matchingCount / totalSiblings : 0;
  }

  private getBestAttempt(attempts: (Classification | null)[]): Classification | null {
    return attempts
      .filter(Boolean)
      .sort((a, b) => (b?.confidence || 0) - (a?.confidence || 0))[0] || null;
  }

  private generateQuarantineReason(pack: EnrichedPack, attempts: (Classification | null)[]): string {
    const reasons: string[] = [];

    if (!attempts.some(Boolean)) {
      reasons.push("Aucune classification trouvée");
    } else {
      const bestConfidence = Math.max(...attempts.map(a => a?.confidence || 0));
      reasons.push(`Confiance insuffisante (max: ${Math.round(bestConfidence * 100)}%)`);
    }

    if (!pack.bundleInfo) {
      reasons.push("Pack isolé sans contexte bundle");
    }

    return reasons.join(', ');
  }

  /**
   * Charge la taxonomie (méthodes copiées depuis V6 mais optimisées)
   */
  private async loadTaxonomy(): Promise<void> {
    const taxonomyPath = this.config.taxonomyPath ||
      path.join(process.cwd(), 'src/main/services/pipeline/shared/taxonomies/music-families-v6.yaml');

    const content = await fs.readFile(taxonomyPath, 'utf-8');
    const rawTaxonomy = yaml.load(content) as any;

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
        priorityPatterns: [],
        familyExclusions: new Map(),
        styleOverrides: new Map(),
        contextualRules: []
      },
      keywordPatterns: []
    };
  }

  private extractKeywordsFromFamily(family: any): { keywords: string[]; keywordWeights: Map<string, number> } {
    const keywords = new Set<string>();
    const keywordWeights = new Map<string, number>();

    // Traitement des mots-clés explicites
    const explicitKeywords = Array.isArray(family.keywords) ? family.keywords : [];

    for (const entry of explicitKeywords) {
      if (typeof entry === 'string') {
        const normalized = entry.toLowerCase().trim();
        if (normalized) {
          keywords.add(normalized);
          keywordWeights.set(normalized, 1);
        }
      } else if (entry && typeof entry === 'object') {
        const term = String(entry.term || entry.keyword || '').toLowerCase().trim();
        if (term) {
          const weight = Math.max(0.1, Math.min(1.5, entry.weight || entry.score || 1));
          keywords.add(term);
          keywordWeights.set(term, weight);
        }
      }
    }

    // Si pas de mots-clés explicites, génération automatique
    if (keywords.size === 0 && family.name) {
      const familyName = String(family.name).toLowerCase();
      keywords.add(familyName);
      keywordWeights.set(familyName, 0.8);
    }

    return {
      keywords: Array.from(keywords),
      keywordWeights
    };
  }

  private initializeDefaultTaxonomy(): void {
    // Version simplifiée pour fallback
    this.taxonomy = {
      families: [
        {
          id: 'hard-dance',
          name: 'Hard Dance',
          styles: ['Hardstyle', 'Rawstyle', 'Uptempo'],
          keywords: ['hardstyle', 'rawstyle', 'uptempo', 'zaag'],
          keywordWeights: new Map([
            ['hardstyle', 1],
            ['rawstyle', 0.9],
            ['uptempo', 0.85],
            ['zaag', 0.8]
          ]),
          confidence: 0.8,
          color: '#ff6b6b'
        }
      ],
      styleSynonyms: new Map(),
      classificationRules: {
        priorityPatterns: [],
        familyExclusions: new Map(),
        styleOverrides: new Map(),
        contextualRules: []
      },
      keywordPatterns: []
    };
  }
}