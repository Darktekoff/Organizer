import OpenAI from 'openai';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type {
  EnrichedPack,
  ClassificationDetails
} from '@shared/interfaces/BusinessTypes';
import { ClassificationMethod } from '@shared/interfaces/BusinessTypes';
import type { MusicTaxonomy } from '../../phases/phase2-classification/Phase2Types';

/**
 * GPT-5 NANO SERVICE V6
 * Service optimisé pour la classification ultra-rapide de packs audio avec GPT-5 Nano
 * Adapté pour l'architecture V6 du pipeline
 */

export interface PackClassification {
  name: string;
  family: string;
  style: string;
  confidence: number;
  reason?: string;
  gptNanoReason?: string;
}

export interface ClassificationValidation {
  packName: string;
  isValid: boolean;
  confidence: number;
  reason: string;
  recommendedAction: 'ACCEPT' | 'QUARANTINE' | 'RECLASSIFY';
  suggestedFamily?: string;
  suggestedStyle?: string;
}

export interface ValidationRequest {
  packName: string;
  classification: PackClassification;
  subfolders?: string[];
}

export interface GPT5NanoResponse {
  classifications: PackClassification[];
}

export interface GPT5NanoOptions {
  maxBatchSize?: number;
  timeout?: number;
  retries?: number;
  enableFallback?: boolean;
}

export class GPT5NanoService {
  private openai: OpenAI | null = null;
  private taxonomy: MusicTaxonomy | null = null;
  private options: Required<GPT5NanoOptions>;

  constructor(options: GPT5NanoOptions = {}) {
    this.options = {
      maxBatchSize: options.maxBatchSize || 50,
      timeout: options.timeout || 30000,
      retries: options.retries || 3,
      enableFallback: options.enableFallback || true
    };

    this.initializeOpenAI();
    this.loadTaxonomy();
  }

  /**
   * Initialiser OpenAI avec configuration optimale GPT-5 Nano
   */
  private initializeOpenAI(): void {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.warn('[GPT5Nano] No OpenAI API key found, GPT-Nano will be disabled');
      return;
    }

    try {
      this.openai = new OpenAI({
        apiKey: apiKey,
        maxRetries: this.options.retries,
        timeout: this.options.timeout
      });
    } catch (error) {
      console.error('[GPT5Nano] Failed to initialize OpenAI:', error);
    }
  }

  /**
   * Charger la taxonomie depuis le fichier V6
   */
  private async loadTaxonomy(): Promise<void> {
    try {
      const taxonomyPath = path.join(process.cwd(), 'src/main/services/pipeline/shared/taxonomies/music-families-v6.yaml');
      const content = await fs.readFile(taxonomyPath, 'utf-8');
      const rawTaxonomy = yaml.load(content) as any;

      // Convertir en format compatible
      this.taxonomy = {
        families: rawTaxonomy.families || [],
        styleSynonyms: new Map(Object.entries(rawTaxonomy.style_synonyms || {})),
        classificationRules: rawTaxonomy.classification_rules || {
          priorityPatterns: [],
          familyExclusions: new Map(),
          styleOverrides: new Map(),
          contextualRules: []
        },
        keywordPatterns: rawTaxonomy.keyword_patterns || []
      };

      console.log('[GPT5Nano] Taxonomy loaded successfully');
    } catch (error) {
      console.warn('[GPT5Nano] Could not load taxonomy.yaml:', (error as Error).message);
      this.initializeFallbackTaxonomy();
    }
  }

  /**
   * Classification de packs enrichis (principale méthode pour V6)
   */
  async classifyEnrichedPacks(enrichedPacks: EnrichedPack[]): Promise<ClassificationDetails[]> {
    if (!this.openai) {
      throw new Error('OpenAI not initialized - missing API key');
    }

    if (enrichedPacks.length === 0) {
      return [];
    }

    // Préparer les données pour GPT
    const packContexts = enrichedPacks.map(pack => ({
      name: pack.packId,
      originalName: pack.originalPack?.name || pack.packId,
      subfolders: this.extractSubfolders(pack)
    }));

    // Chunking pour gros volumes
    const chunks = this.createContextChunks(packContexts);
    const allClassifications: PackClassification[] = [];

    console.log(`[GPT5Nano] Classifying ${enrichedPacks.length} enriched packs in ${chunks.length} chunks`);

    // Traiter chaque chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      try {
        console.log(`[GPT5Nano] Processing chunk ${i + 1}/${chunks.length} (${chunk.length} packs)`);
        const chunkResults = await this.classifyContextChunk(chunk);
        allClassifications.push(...chunkResults);

        // Petit délai entre chunks pour éviter rate limiting
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error) {
        console.error(`[GPT5Nano] Error processing chunk ${i + 1}:`, error);

        // Fallback : classer ce chunk avec des règles par défaut
        if (this.options.enableFallback) {
          const fallbackResults = chunk.map(pack => this.fallbackClassification(pack.originalName));
          allClassifications.push(...fallbackResults);
        }
      }
    }

    // Convertir vers ClassificationDetails
    return this.convertToClassificationDetails(allClassifications);
  }

  /**
   * Convertir PackClassification[] vers ClassificationDetails[]
   */
  private convertToClassificationDetails(classifications: PackClassification[]): ClassificationDetails[] {
    return classifications.map(classification => ({
      family: classification.family,
      style: classification.style,
      confidence: classification.confidence,
      method: ClassificationMethod.AI_FALLBACK,
      reasoning: classification.reason ? [classification.reason] : (classification.gptNanoReason ? [classification.gptNanoReason] : ['GPT-5 Nano classification']),
      matchedKeywords: [],
      appliedRules: ['gpt5_nano_ai_classification']
    }));
  }

  /**
   * Extraire les sous-dossiers d'un pack enrichi
   */
  private extractSubfolders(pack: EnrichedPack): string[] {
    const subfolders: string[] = [];

    // Depuis la structure interne détectée
    if (pack.internalStructure?.detectedFolders) {
      subfolders.push(...pack.internalStructure.detectedFolders);
    }

    // Depuis les types détectés
    if (pack.internalStructure?.detectedTypes) {
      Object.keys(pack.internalStructure.detectedTypes).forEach(type => {
        if (type !== 'unknown') {
          subfolders.push(type);
        }
      });
    }

    return [...new Set(subfolders)]; // Dédupliquer
  }

  /**
   * Créer des chunks avec contexte
   */
  private createContextChunks(packs: Array<{name: string, originalName: string, subfolders: string[]}>): Array<Array<{name: string, originalName: string, subfolders: string[]}>> {
    const chunks: Array<Array<{name: string, originalName: string, subfolders: string[]}>> = [];
    const maxBatchSize = Math.floor(this.options.maxBatchSize / 2); // Réduire car les prompts sont plus longs

    for (let i = 0; i < packs.length; i += maxBatchSize) {
      const chunk = packs.slice(i, i + maxBatchSize);
      chunks.push(chunk);
    }

    return chunks;
  }

  /**
   * Classifier un chunk avec contexte
   */
  private async classifyContextChunk(packs: Array<{name: string, originalName: string, subfolders: string[]}>): Promise<PackClassification[]> {
    if (!this.openai) {
      throw new Error('OpenAI not initialized');
    }

    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildContextUserPrompt(packs);

    console.log('[GPT5Nano] Sending request to GPT-5 Nano...');
    console.log('[GPT5Nano] ========== SYSTEM PROMPT ==========');
    console.log(systemPrompt);
    console.log('[GPT5Nano] ========== USER PROMPT ==========');
    console.log(userPrompt);
    console.log('[GPT5Nano] =====================================');

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-5-nano',

        // Configuration optimale GPT-5 Nano selon le guide
        reasoning_effort: 'minimal',
        verbosity: 'low',
        max_completion_tokens: 2000,

        // Format JSON forcé
        response_format: { type: 'json_object' },

        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ]
      });

      const result = response.choices[0].message.content;

      if (!result) {
        throw new Error('No response from GPT-5 Nano');
      }

      console.log('[GPT5Nano] ========== AI RESPONSE ==========');
      console.log(result);
      console.log('[GPT5Nano] ====================================');

      try {
        const parsed = JSON.parse(result) as GPT5NanoResponse;
        console.log('[GPT5Nano] Classifications found:', parsed.classifications?.length || 0);

        // Log chaque classification avec son reason
        parsed.classifications?.forEach((c: any) => {
          console.log(`[GPT5Nano]   - "${c.name}" → ${c.family}/${c.style} (${Math.round(c.confidence * 100)}%) | Reason: ${c.reason || 'N/A'}`);
        });

        return parsed.classifications || [];
      } catch (error) {
        console.error('[GPT5Nano] Failed to parse response:', result);
        console.error('[GPT5Nano] Parse error:', error);
        throw new Error('Invalid JSON response from GPT-5 Nano');
      }
    } catch (error: any) {
      console.error('[GPT5Nano] API Error:', error);
      console.error('[GPT5Nano] Error details:', error.message);

      // Si c'est une erreur d'API spécifique, la re-throw
      if (error.status || error.code) {
        throw error;
      }

      throw new Error(`GPT-5 Nano API error: ${error.message}`);
    }
  }

  /**
   * Construire le prompt système avec taxonomie V6
   */
  private buildSystemPrompt(): string {
    let familiesText = '';

    if (this.taxonomy && this.taxonomy.families) {
      familiesText = this.taxonomy.families.map((f: any) => `${f.name}: ${f.styles?.join(', ') || 'No styles'}`).join('\n');
    } else {
      // Fallback si taxonomy.yaml non disponible
      familiesText = `Bass Music: Dubstep, Future_Bass, Trap_Bass
Hard Dance: Hardstyle, Rawstyle, Hardcore, Frenchcore
House: House, Deep_House, Tech_House, Progressive_House
Cinematic / Orchestral / SFX: Cinematic, SFX, Epic, Film_Score
Retro / Synthwave / 8-bit: Synthwave, Chiptune, 8_Bit`;
    }

    return `You are an expert audio sample pack classifier. Analyze pack names AND subfolder context to assign the most appropriate family and style with HIGH CONFIDENCE.

AVAILABLE FAMILIES AND STYLES:
${familiesText}

CLASSIFICATION RULES:
- Return JSON only, no explanations
- Use exact family names from the list above
- Be CONFIDENT when style indicators are clear in the name
- Analyze BOTH pack name and subfolders for better accuracy
- Subfolders like "kicks", "bass_loops", "hardstyle_leads" reveal the true genre
- Artist names (KSHMR, Spyro, etc.) are strong indicators
- Hybrid styles like "Hard Psy", "Metal-Step", "Trap.And.Riddim" are valid and should get HIGH confidence
- For obvious styles in pack names, use confidence >= 0.8
- For FX/Toolkit packs, use "Cinematic / Orchestral / SFX" family

INTELLIGENT STYLE MATCHING (FOLLOW THESE RULES):

1. EXACT MATCH (confidence 0.85-0.95):
   - Style appears exactly in taxonomy → use it with high confidence
   - Example: "Hardstyle Kicks" → Hard Dance/Hardstyle (0.95)

2. FUZZY MATCH (confidence 0.65-0.80):
   - Style variant exists in taxonomy → map to closest match
   - Example: "Brazilian Funk" → Retro / Synthwave / 8-bit/Funk (0.70)
   - Example: "Afrobeat" → World & Folk/Afrobeat (0.75) OR World & Folk/World (0.70)
   - Example: "Melodic Dubstep" → Bass Music/Melodic_Dubstep (0.80)
   - Use your knowledge to find the BEST matching family + style

3. GENRE FAMILY CLEAR (confidence 0.55-0.70):
   - Musical genre is obvious but exact style not listed → use closest style in that family
   - Example: "Deep Tech House" → House/Tech_House (0.65)
   - Example: "Orchestral Strings" → Cinematic / Orchestral / SFX/Orchestral (0.70)

4. QUARANTINE ONLY (confidence ≤ 0.45):
   - ONLY generic instrument terms with NO musical context
   - Example: "Kicks Vol 2" → confidence ≤ 0.40 (no genre info)
   - Example: "Samples Pack" → confidence ≤ 0.30 (too generic)
   - Example: "Producer_Name_Unleashed" → confidence ≤ 0.35 (no style)

CRITICAL: Brazilian Funk, Afrobeat, Jazz, etc. ARE musical genres → find best match with confidence 0.65-0.80!
DO NOT reject valid musical genres just because they're not exact matches in the taxonomy!

RESPONSE FORMAT (CRITICAL):
{"classifications": [{"name": "original_pack_name", "family": "exact_family_name", "style": "style_name", "confidence": 0.85, "reason": "why this classification was chosen"}]}

IMPORTANT: Add a "reason" field explaining your classification decision (e.g., "matched Brazilian Funk to Funk_Carioca", "contains hardstyle keywords", "generic name with no style indicators")

CRITICAL: Use ONLY exact family names from the list. NO ambiguous formats like "FX (generic) or Other" or "Style1/Style2". Pick ONE clear family and ONE clear style.`;
  }

  /**
   * Construire le prompt utilisateur avec contexte
   */
  private buildContextUserPrompt(packs: Array<{name: string, originalName: string, subfolders: string[]}>): string {
    const packDescriptions = packs.map(pack => {
      let description = `Pack: "${pack.name}"`;
      if (pack.subfolders && pack.subfolders.length > 0) {
        description += `\nSubfolders: ${pack.subfolders.join(', ')}`;
      }
      return description;
    });

    return `Classify these audio sample packs using both names and subfolder context:\n\n${packDescriptions.join('\n\n')}`;
  }

  /**
   * Classification de fallback si GPT-5 Nano échoue
   */
  private fallbackClassification(packName: string): PackClassification {
    const cleaned = packName.toLowerCase();

    // Règles de fallback simples
    if (cleaned.includes('hardstyle') || cleaned.includes('rawstyle')) {
      return {
        name: packName,
        family: 'Hard Dance',
        style: 'Hardstyle',
        confidence: 0.6,
        gptNanoReason: 'Fallback classification'
      };
    }

    if (cleaned.includes('dubstep') || cleaned.includes('bass') || cleaned.includes('trap')) {
      return {
        name: packName,
        family: 'Bass Music',
        style: 'Dubstep',
        confidence: 0.6,
        gptNanoReason: 'Fallback classification'
      };
    }

    if (cleaned.includes('fx') || cleaned.includes('effect')) {
      return {
        name: packName,
        family: 'Cinematic / Orchestral / SFX',
        style: 'SFX',
        confidence: 0.6,
        gptNanoReason: 'Fallback classification'
      };
    }

    // Par défaut - LOW CONFIDENCE pour quarantaine
    return {
      name: packName,
      family: 'Experimental / IDM / Noise',
      style: 'Experimental',
      confidence: 0.3,
      gptNanoReason: 'Fallback - no clear match'
    };
  }

  /**
   * Initialiser une taxonomie de fallback
   */
  private initializeFallbackTaxonomy(): void {
    this.taxonomy = {
      families: [
        {
          id: 'hard-dance',
          name: 'Hard Dance',
          styles: ['Hardstyle', 'Rawstyle', 'Uptempo'],
          keywords: ['hardstyle', 'rawstyle', 'uptempo'],
          confidence: 0.8
        },
        {
          id: 'bass-music',
          name: 'Bass Music',
          styles: ['Dubstep', 'Riddim', 'Future Bass'],
          keywords: ['dubstep', 'riddim', 'bass'],
          confidence: 0.8
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

  /**
   * VALIDATEUR CROISÉ BATCH - Valide plusieurs classifications en une seule requête
   */
  async validateClassificationsBatch(requests: ValidationRequest[]): Promise<ClassificationValidation[]> {
    if (!this.openai || requests.length === 0) {
      return requests.map(req => ({
        packName: req.packName,
        isValid: false,
        confidence: 0,
        reason: 'GPT Nano validator unavailable',
        recommendedAction: 'QUARANTINE' as const
      }));
    }

    try {
      const familiesText = this.taxonomy?.families
        ?.map((f: any) => `- ${f.name}: ${f.styles?.join(', ') || 'No styles'}`)
        .join('\n') || '';

      const validationsText = requests.map((req, i) => {
        const subfoldersText = req.subfolders && req.subfolders.length > 0
          ? ` | Subfolders: ${req.subfolders.join(', ')}`
          : '';

        return `${i + 1}. Pack: "${req.packName}"${subfoldersText}
   Proposed: ${req.classification.family} → ${req.classification.style} (${(req.classification.confidence * 100).toFixed(0)}% confidence)`;
      }).join('\n');

      const validatorPrompt = `You are a CRITICAL VALIDATOR for audio sample pack classification. Validate ALL ${requests.length} classifications below.

AVAILABLE FAMILIES:
${familiesText}

VALIDATION CRITERIA - BE EXTREMELY CRITICAL:

🚩 RED FLAGS (MUST REJECT):
- Generic pack names like "FMT_*", "*_Samples", "*_Vol_*", "Brand_Kicks" with specific genre classifications
- Acronyms/codes + generic instrument words should NEVER get specific genres
- Classifications that seem "invented" rather than obvious from pack names
- Cinematic/Orchestral for generic kicks/samples (major red flag!)
- High confidence for obviously generic packs

✅ GREEN FLAGS (CAN ACCEPT):
- Clear artist names known for specific genres (KSHMR → House/EDM, Spyro → Hardstyle)
- Obvious genre keywords in pack name (Hardstyle, Dubstep, Techno, etc.)
- Subfolders that clearly indicate the musical style

PACKS TO VALIDATE:
${validationsText}

Return JSON array format with CLEAR single classifications:
{
  "validations": [
    {
      "packName": "exact pack name",
      "isValid": boolean,
      "confidence": number (0.0-1.0),
      "reason": "brief explanation",
      "recommendedAction": "ACCEPT" | "QUARANTINE" | "RECLASSIFY",
      "suggestedFamily": "EXACT family name from list (if reclassifying)",
      "suggestedStyle": "EXACT style name (if reclassifying)"
    }
  ]
}

CRITICAL: Use EXACT family names, no ambiguous formats like "FX (generic) or Other"`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-5-mini',
        messages: [{ role: 'user', content: validatorPrompt }],
        reasoning_effort: 'minimal',
        verbosity: 'low',
        max_completion_tokens: 2000,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from batch validator');
      }

      const parsed = JSON.parse(content);
      const validations = parsed.validations || [];

      // Assurer qu'on a une validation pour chaque requête
      return requests.map(req => {
        const validation = validations.find((v: any) => v.packName === req.packName);

        if (validation) {
          return {
            packName: req.packName,
            isValid: validation.isValid || false,
            confidence: validation.confidence || 0,
            reason: validation.reason || 'No reason provided',
            recommendedAction: validation.recommendedAction || 'QUARANTINE',
            suggestedFamily: validation.suggestedFamily,
            suggestedStyle: validation.suggestedStyle
          };
        } else {
          return {
            packName: req.packName,
            isValid: false,
            confidence: 0.2,
            reason: 'No validation found in batch response',
            recommendedAction: 'QUARANTINE' as const
          };
        }
      });

    } catch (error) {
      console.warn('[GPT5Nano Batch Validator] Error:', (error as Error).message);

      // Fallback: Rejeter tous en cas d'erreur
      return requests.map(req => ({
        packName: req.packName,
        isValid: false,
        confidence: 0.2,
        reason: `Batch validator error: ${(error as Error).message}`,
        recommendedAction: 'QUARANTINE' as const
      }));
    }
  }

  /**
   * Vérifier si GPT-5 Nano est disponible
   */
  isAvailable(): boolean {
    return this.openai !== null;
  }

  /**
   * Obtenir des statistiques du service
   */
  getStats() {
    return {
      available: this.isAvailable(),
      taxonomyLoaded: this.taxonomy !== null,
      maxBatchSize: this.options.maxBatchSize,
      timeout: this.options.timeout
    };
  }
}