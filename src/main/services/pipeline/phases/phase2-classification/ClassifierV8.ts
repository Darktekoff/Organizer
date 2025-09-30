/**
 * ClassifierV8 - Ultimate Batch Classification System
 *
 * RÉVOLUTION PERFORMANCE :
 * 1. Bundle Classification Cache (1 IA → tous packs héritent)
 * 2. Batch Processing IA (2-3 requêtes max au lieu de 50+)
 * 3. Pipeline 2-pass ultra-optimisé
 *
 * GAINS ATTENDUS :
 * - Temps : 60s → 5s (12x plus rapide)
 * - Coût API : 50 requêtes → 3 requêtes (17x moins cher)
 * - Cohérence : Bundles entiers classifiés uniformément
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

export interface ClassifierV8Result {
  classification: Classification | null;
  quarantineReason?: string;
  needsManualReview: boolean;
  processingSteps: string[];
}

export interface BatchClassificationResult {
  classifiedPacks: Map<string, ClassifierV8Result>;
  bundleClassifications: Map<string, Classification>;
  statistics: {
    taxonomicSuccesses: number;
    bundleInherited: number;
    aiClassified: number;
    quarantined: number;
    aiRequestsUsed: number;
  };
}

export class ClassifierV8 {
  private config: Phase2Config;
  private taxonomy: MusicTaxonomy | null = null;
  private gptService: GPT5NanoService;

  // Cache des classifications de bundles (NOUVEAU!)
  private bundleClassificationCache = new Map<string, Classification>();

  constructor(config: Phase2Config) {
    this.config = config;
    this.gptService = new GPT5NanoService({
      maxBatchSize: 25,
      enableFallback: config.enableAIFallback !== false
    });
  }

  /**
   * Initialise le classifier
   */
  async initialize(): Promise<void> {
    try {
      await this.loadTaxonomy();
      console.log(`[ClassifierV8] Initialisé avec taxonomie (${this.taxonomy?.families.length || 0} familles)`);
    } catch (error) {
      console.warn('[ClassifierV8] Erreur chargement taxonomie, utilisation des patterns par défaut:', error);
      this.initializeDefaultTaxonomy();
    }
  }

  /**
   * NOUVEAU PIPELINE BATCH - Classification de TOUS les packs d'un coup
   */
  async classifyPacksBatch(packs: EnrichedPack[]): Promise<BatchClassificationResult> {
    console.log(`[ClassifierV8] 🚀 Démarrage batch classification de ${packs.length} packs`);

    const result: BatchClassificationResult = {
      classifiedPacks: new Map(),
      bundleClassifications: new Map(),
      statistics: {
        taxonomicSuccesses: 0,
        bundleInherited: 0,
        aiClassified: 0,
        quarantined: 0,
        aiRequestsUsed: 0
      }
    };

    // PHASE 0: PRÉ-CLASSIFICATION DES BUNDLES (Bundle-First Logic!)
    const uniqueBundles = new Set<string>();
    for (const pack of packs) {
      if (pack.bundleInfo?.bundleName) {
        uniqueBundles.add(pack.bundleInfo.bundleName);
      }
    }

    if (uniqueBundles.size > 0) {
      console.log(`[ClassifierV8] Phase 0: PRÉ-CLASSIFICATION de ${uniqueBundles.size} bundles`);
      await this.preClassifyBundlesBatch(Array.from(uniqueBundles), result);
      console.log(`[ClassifierV8] ✅ ${result.bundleClassifications.size} bundles pré-classifiés`);
    }

    // PHASE 1: Classification individuelle pack par pack (Taxonomique → Bundle héritage)
    const packsNeedingAI: EnrichedPack[] = [];

    console.log(`[ClassifierV8] Phase 1: Classification individuelle des packs`);

    for (const pack of packs) {
      try {
        const taxonomicResult = await this.classifyTaxonomic(pack);

        if (taxonomicResult && taxonomicResult.confidence >= this.config.skipConfidenceThreshold) {
          // Succès taxonomique immédiat
          result.classifiedPacks.set(pack.packId, {
            classification: taxonomicResult,
            needsManualReview: false,
            processingSteps: [`✅ Taxonomique: ${taxonomicResult.family}/${taxonomicResult.style}`]
          });
          result.statistics.taxonomicSuccesses++;
        } else {
          // Échec taxonomique → Essayer héritage bundle
          if (pack.bundleInfo?.bundleName) {
            const bundleClassification = result.bundleClassifications.get(pack.bundleInfo.bundleName);
            if (bundleClassification) {
              // HÉRITAGE BUNDLE réussi
              result.classifiedPacks.set(pack.packId, {
                classification: bundleClassification,
                needsManualReview: false,
                processingSteps: [`📦 Hérité: ${pack.bundleInfo.bundleName} → ${bundleClassification.family}`]
              });
              result.statistics.bundleInherited++;
            } else {
              // Bundle non classifié → IA individuelle
              packsNeedingAI.push(pack);
            }
          } else {
            // Pack isolé → IA individuelle
            packsNeedingAI.push(pack);
          }
        }
      } catch (error) {
        console.error(`[ClassifierV8] ⚠️ Erreur classification taxonomique pour pack ${pack.packId}:`, error);
        // En cas d'erreur, continuer avec les phases suivantes
        packsNeedingAI.push(pack);
      }
    }

    console.log(`[ClassifierV8] ✅ Phase 1 terminée:`);
    console.log(`[ClassifierV8] ✅ Taxonomique: ${result.statistics.taxonomicSuccesses}, Bundle hérité: ${result.statistics.bundleInherited}`);
    console.log(`[ClassifierV8] 🤖 ${packsNeedingAI.length} packs restants pour IA`);

    // PHASE 2: IA Batch pour packs isolés restants
    if (packsNeedingAI.length > 0 && this.config.enableAIFallback) {
      console.log(`[ClassifierV8] Phase 2: IA Batch pour ${packsNeedingAI.length} packs isolés`);
      await this.classifyPacksWithAIBatch(packsNeedingAI, result);
    }

    // PHASE 4: Quarantaine pour les échecs complets
    for (const pack of packsNeedingAI) {
      if (!result.classifiedPacks.has(pack.packId)) {
        result.classifiedPacks.set(pack.packId, {
          classification: null,
          quarantineReason: this.generateQuarantineReason(pack),
          needsManualReview: true,
          processingSteps: ['❌ Taxonomique échoué', '❌ Bundle indisponible', '❌ IA échoué', '⚠️ Quarantaine']
        });
        result.statistics.quarantined++;
      }
    }

    // Statistiques finales
    console.log(`[ClassifierV8] 🎉 Batch terminé!`);
    console.log(`[ClassifierV8] 📊 Taxonomique: ${result.statistics.taxonomicSuccesses}`);
    console.log(`[ClassifierV8] 📦 Bundle hérité: ${result.statistics.bundleInherited}`);
    console.log(`[ClassifierV8] 🤖 IA: ${result.statistics.aiClassified}`);
    console.log(`[ClassifierV8] ⚠️ Quarantaine: ${result.statistics.quarantined}`);
    console.log(`[ClassifierV8] 🔥 Requêtes IA utilisées: ${result.statistics.aiRequestsUsed} (vs ~${packs.length} avant!)`);

    return result;
  }

  /**
   * NOUVEAU: PRÉ-CLASSIFICATION des bundles (Bundle-First Logic)
   * Une seule requête IA pour classifier tous les bundles uniques
   */
  private async preClassifyBundlesBatch(bundleNames: string[], result: BatchClassificationResult): Promise<void> {
    try {
      console.log(`[ClassifierV8] 📦 PRÉ-CLASSIFICATION de ${bundleNames.length} bundles uniques...`);

      // Utiliser la méthode existante classifyEnrichedPacks avec des packs factices pour les bundles
      const bundlePacks: EnrichedPack[] = bundleNames.map(name => ({
        packId: name,
        originalPack: { name },
        tags: [],
        taxonomyMatches: [],
        fileCount: 0,
        audioFiles: 0,
        presetFiles: 0,
        totalSize: 0,
        pathSegments: [],
        enrichedAt: new Date()
      }));

      const classifications = await this.gptService.classifyEnrichedPacks(bundlePacks);
      result.statistics.aiRequestsUsed++;

      if (classifications && classifications.length > 0) {
        // Convertir les classifications en résultats de bundle
        for (let i = 0; i < Math.min(classifications.length, bundleNames.length); i++) {
          const bundleName = bundleNames[i];
          const classificationDetail = classifications[i];

          // Convertir ClassificationDetails vers Classification
          const classification: Classification = {
            family: classificationDetail.family,
            style: classificationDetail.style,
            confidence: classificationDetail.confidence,
            method: ClassificationMethod.AI_FALLBACK,
            reasoning: classificationDetail.reasoning || [`IA Bundle: ${bundleName}`],
            matchedKeywords: [],
            appliedRules: ['bundle_pre_classification']
          };

          // Stocker la classification pour utilisation future
          result.bundleClassifications.set(bundleName, classification);
          console.log(`[ClassifierV8] 📦 "${bundleName}" → ${classification.family}/${classification.style} (${Math.round(classification.confidence * 100)}%)`);
        }

        console.log(`[ClassifierV8] ✅ ${classifications.length} bundles pré-classifiés en 1 requête`);
      }
    } catch (error) {
      console.error(`[ClassifierV8] Erreur pré-classification bundles:`, error);
    }
  }

  /**
   * ANCIEN: Classification batch des bundles uniques (OBSOLÈTE)
   */
  private async classifyBundlesBatch(bundleNames: string[], result: BatchClassificationResult): Promise<void> {
    try {
      console.log(`[ClassifierV8] 📦 Classification de ${bundleNames.length} bundles uniques...`);

      // Utiliser la méthode existante classifyEnrichedPacks avec des packs factices pour les bundles
      const bundlePacks: EnrichedPack[] = bundleNames.map(name => ({
        packId: name,
        originalPack: { name },
        tags: [],
        taxonomyMatches: [],
        fileCount: 0,
        audioFiles: 0,
        presetFiles: 0,
        totalSize: 0,
        pathSegments: [],
        enrichedAt: new Date()
      }));

      const classifications = await this.gptService.classifyEnrichedPacks(bundlePacks);
      result.statistics.aiRequestsUsed++;

      if (classifications && classifications.length > 0) {
        // Convertir les classifications en résultats de bundle
        for (let i = 0; i < Math.min(classifications.length, bundleNames.length); i++) {
          const bundleName = bundleNames[i];
          const classificationDetail = classifications[i];

          // Convertir ClassificationDetails vers Classification
          const classification: Classification = {
            family: classificationDetail.family,
            style: classificationDetail.style,
            confidence: classificationDetail.confidence,
            method: ClassificationMethod.AI_FALLBACK,
            reasoning: classificationDetail.reasoning || [`IA Bundle: ${bundleName}`],
            matchedKeywords: [],
            appliedRules: ['bundle_ai_classification']
          };

          // Cacher les résultats pour utilisation future
          this.bundleClassificationCache.set(bundleName, classification);
          result.bundleClassifications.set(bundleName, classification);
        }

        console.log(`[ClassifierV8] ✅ ${classifications.length} bundles classifiés en 1 requête`);
      }
    } catch (error) {
      console.error(`[ClassifierV8] Erreur classification bundles:`, error);
    }
  }

  /**
   * NOUVEAU: Classification batch des packs isolés
   */
  private async classifyPacksWithAIBatch(packs: EnrichedPack[], result: BatchClassificationResult): Promise<void> {
    try {
      // Enrichir les packs avec le contexte bundle pour l'IA
      const enrichedPacksForAI = packs.map(pack => {
        if (pack.bundleInfo?.bundleName && (!pack.tags || pack.tags.length === 0)) {
          // Ajouter le nom du bundle dans les tags pour donner du contexte à l'IA
          return {
            ...pack,
            tags: [`bundle:${pack.bundleInfo.bundleName}`]
          };
        }
        return pack;
      });

      // Utiliser le système batch existant de GPT5NanoService
      const aiResults = await this.gptService.classifyEnrichedPacks(enrichedPacksForAI);

      result.statistics.aiRequestsUsed += Math.ceil(packs.length / 25); // Estimation basée sur maxBatchSize standard

      for (let i = 0; i < packs.length; i++) {
        const pack = packs[i];
        const aiResult = aiResults[i];

        if (aiResult && aiResult.confidence >= this.config.confidenceThreshold) {
          result.classifiedPacks.set(pack.packId, {
            classification: {
              family: aiResult.family,
              style: aiResult.style,
              confidence: aiResult.confidence,
              method: ClassificationMethod.AI_FALLBACK,
              reasoning: aiResult.reasoning || ['IA GPT-5 Nano'],
              matchedKeywords: [],
              appliedRules: ['ai_batch_fallback']
            },
            needsManualReview: false,
            processingSteps: [
              '❌ Taxonomique échoué',
              '❌ Bundle indisponible',
              `✅ IA: ${aiResult.family}/${aiResult.style}`
            ]
          });
          result.statistics.aiClassified++;
        }
      }

      console.log(`[ClassifierV8] ✅ ${result.statistics.aiClassified} packs classifiés par IA batch`);
    } catch (error) {
      console.error(`[ClassifierV8] Erreur IA batch:`, error);
    }
  }

  /**
   * Crée un prompt spécialisé pour classifier les bundles
   */
  private createBundleClassificationPrompt(bundleNames: string[]): string {
    const taxonomyFamilies = this.taxonomy?.families.map(f => `${f.name}: ${f.styles.join(', ')}`).join('\n') || '';

    return `Tu es un expert en classification musicale. Voici ma taxonomie:

${taxonomyFamilies}

Je vais te donner ${bundleNames.length} noms de bundles de samples musicaux. Pour chaque bundle, détermine la famille et le style les plus appropriés selon ma taxonomie.

BUNDLES À CLASSIFIER:
${bundleNames.map((name, i) => `${i + 1}. "${name}"`).join('\n')}

RÉPONDRE AU FORMAT JSON:
{
  "classifications": [
    {"bundle": "nom du bundle", "family": "famille", "style": "style", "confidence": 0.XX, "reasoning": "explication courte"},
    ...
  ]
}

Important:
- Use exactement les noms de famille et styles de ma taxonomie
- "OPS - The Ultimate Harder-Style Production Bundle" doit être Hard Dance/Hardstyle
- Confidence entre 0.0 et 1.0
- Reasoning court mais précis`;
  }

  /**
   * Parse la réponse IA pour extraire les classifications de bundles
   */
  private parseBundleClassificationResponse(content: string, bundleNames: string[]): Map<string, Classification> {
    const results = new Map<string, Classification>();

    try {
      // Nettoyer le JSON de la réponse
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleanContent);

      if (parsed.classifications && Array.isArray(parsed.classifications)) {
        for (const item of parsed.classifications) {
          if (item.bundle && item.family && item.style) {
            results.set(item.bundle, {
              family: item.family,
              style: item.style,
              confidence: item.confidence || 0.8,
              method: ClassificationMethod.CONTEXTUAL,
              reasoning: [`Bundle: ${item.reasoning || 'Classification IA'}`],
              matchedKeywords: [],
              appliedRules: ['bundle_ai_classification']
            });
          }
        }
      }
    } catch (error) {
      console.error(`[ClassifierV8] Erreur parsing bundle classifications:`, error);
      console.error(`[ClassifierV8] Contenu reçu:`, content);
    }

    return results;
  }

  /**
   * Classification taxonomique (réutilisée de V7)
   */
  private async classifyTaxonomic(pack: EnrichedPack): Promise<Classification | null> {
    if (!this.taxonomy) return null;

    const packText = this.buildSearchText(pack);
    let bestMatch: { family: MusicFamily; confidence: number; matches: string[]; method: string } | null = null;

    for (const family of this.taxonomy.families) {
      const matches: string[] = [];
      let score = 0;
      let fastPassHit = false;

      for (const keyword of family.keywords) {
        if (packText.includes(keyword.toLowerCase())) {
          matches.push(keyword);
          const weight = family.keywordWeights?.get(keyword) || 0.8;
          score += weight;

          if (weight >= 0.9) {
            fastPassHit = true;
          }
        }
      }

      if (matches.length > 0) {
        let confidence = Math.min(0.95, score * 0.8);

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
   * Utilitaires (réutilisés de V7)
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

  private generateQuarantineReason(pack: EnrichedPack): string {
    const reasons: string[] = [];
    reasons.push("Aucune méthode de classification n'a réussi");

    if (!pack.bundleInfo) {
      reasons.push("Pack isolé sans contexte bundle");
    } else {
      reasons.push(`Bundle "${pack.bundleInfo.bundleName}" non classifiable`);
    }

    return reasons.join(', ');
  }

  // Méthodes de chargement taxonomie (copiées de V7)
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
    this.taxonomy = {
      families: [
        {
          id: 'hard-dance',
          name: 'Hard Dance',
          styles: ['Hardstyle', 'Rawstyle', 'Uptempo'],
          keywords: ['hardstyle', 'rawstyle', 'uptempo', 'zaag', 'harder'],
          keywordWeights: new Map([
            ['hardstyle', 1],
            ['rawstyle', 0.9],
            ['uptempo', 0.85],
            ['zaag', 0.8],
            ['harder', 0.75]
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