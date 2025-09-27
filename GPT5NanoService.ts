import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

/**
 * GPT-5 NANO SERVICE
 * Service optimisé pour la classification ultra-rapide de packs audio avec GPT-5 Nano
 */

export interface PackClassification {
  name: string;
  family: string;
  style: string;
  confidence: number;
  gptNanoReason?: string;
}

export interface PackNameCleaning {
  originalName: string;
  cleanedName: string;
  changesApplied: string[];
}

export interface GPT5NanoResponse {
  classifications: PackClassification[];
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

export interface GPT5NanoOptions {
  maxBatchSize?: number;
  timeout?: number;
  retries?: number;
  enableFallback?: boolean;
}

export class GPT5NanoService {
  private openai: OpenAI | null = null;
  private taxonomy: any = null;
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
   * Charger la taxonomie depuis taxonomy.yaml
   */
  private loadTaxonomy(): void {
    try {
      const taxonomyPath = path.join(process.cwd(), 'src/main/services/pipeline-v5/taxonomy/music-families.yaml');
      if (fs.existsSync(taxonomyPath)) {
        const taxonomyContent = fs.readFileSync(taxonomyPath, 'utf8');
        this.taxonomy = yaml.load(taxonomyContent) as any;
      }
    } catch (error) {
      console.warn('[GPT5Nano] Could not load taxonomy.yaml:', (error as Error).message);
    }
  }

  /**
   * Classifier une liste de packs avec contexte des sous-dossiers
   */
  async classifyPacksWithContext(enrichedPacks: Array<{name: string, path: string, subfolders: string[]}>): Promise<PackClassification[]> {
    if (!this.openai) {
      throw new Error('OpenAI not initialized - missing API key');
    }

    if (enrichedPacks.length === 0) {
      return [];
    }

    // TEMPORAIRE : Désactiver le nettoyage pour debug
    const cleanedPacks = enrichedPacks.map(pack => ({
      name: pack.name, // ← PAS DE NETTOYAGE !
      originalName: pack.name,
      subfolders: pack.subfolders
    }));

    // Chunking pour gros volumes
    const chunks = this.createContextChunks(cleanedPacks);

    const allClassifications: PackClassification[] = [];

    console.log(`[GPT5Nano] Classifying ${enrichedPacks.length} packs with context in ${chunks.length} chunks`);

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

    return allClassifications;
  }

  /**
   * Classifier une liste de packs avec GPT-5 Nano (méthode originale)
   */
  async classifyPacks(packNames: string[]): Promise<PackClassification[]> {
    if (!this.openai) {
      throw new Error('OpenAI not initialized - missing API key');
    }

    if (packNames.length === 0) {
      return [];
    }

    // Nettoyer les noms de packs avant classification
    const cleanedNames = packNames.map(name => this.cleanPackName(name));

    // Chunking pour gros volumes
    const chunks = this.createChunks(cleanedNames);
    const allClassifications: PackClassification[] = [];

    console.log(`[GPT5Nano] Classifying ${packNames.length} packs in ${chunks.length} chunks`);

    // Traiter chaque chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      try {
        console.log(`[GPT5Nano] Processing chunk ${i + 1}/${chunks.length} (${chunk.length} packs)`);
        const chunkResults = await this.classifyChunk(chunk);
        allClassifications.push(...chunkResults);
        
        // Petit délai entre chunks pour éviter rate limiting
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        console.error(`[GPT5Nano] Error processing chunk ${i + 1}:`, error);
        
        // Fallback : classer ce chunk avec des règles par défaut
        if (this.options.enableFallback) {
          const fallbackResults = chunk.map(name => this.fallbackClassification(name));
          allClassifications.push(...fallbackResults);
        }
      }
    }

    return allClassifications;
  }

  /**
   * Créer des chunks optimaux pour GPT-5 Nano
   */
  private createChunks(packNames: string[]): string[][] {
    const chunks: string[][] = [];
    const maxBatchSize = this.options.maxBatchSize;

    for (let i = 0; i < packNames.length; i += maxBatchSize) {
      const chunk = packNames.slice(i, i + maxBatchSize);
      chunks.push(chunk);
    }

    return chunks;
  }

  /**
   * Classifier un chunk avec GPT-5 Nano
   */
  private async classifyChunk(packNames: string[]): Promise<PackClassification[]> {
    if (!this.openai) {
      throw new Error('OpenAI not initialized');
    }

    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(packNames);

    console.log('[GPT5Nano] Sending request to GPT-5 Nano...');
    // Prompts envoyés à GPT-5 Nano

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
      // Réponse brute reçue
      
      if (!result) {
        throw new Error('No response from GPT-5 Nano');
      }

      try {
        const parsed = JSON.parse(result) as GPT5NanoResponse;
        // Réponse parsée
        console.log('[GPT5Nano] Classifications found:', parsed.classifications?.length || 0);
        
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
   * Construire le prompt système avec taxonomie
   */
  private buildSystemPrompt(): string {
    let familiesText = '';
    let stylesText = '';

    if (this.taxonomy && this.taxonomy.families) {
      // Extraire les familles et styles de taxonomy.yaml
      const families = this.taxonomy.families.map((f: any) => ({
        name: f.name,
        styles: f.styles || []
      }));

      familiesText = families.map((f: any) => `${f.name}: ${f.styles.join(', ')}`).join('\n');
      stylesText = families.flatMap((f: any) => f.styles).join(', ');
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

AMBIGUITY DETECTION (CRITICAL - MUST FOLLOW):
- If NEITHER pack name NOR subfolders provide CLEAR MUSICAL STYLE indicators → confidence MUST BE ≤ 0.45
- Generic instrument terms like "Kicks", "Samples", "Drums", "Loops" alone provide ZERO style information
- Acronyms like "FMT", "VOL", "PACK", brand codes provide NO musical genre context
- Unknown artist names with ONLY generic instrument terms → confidence MUST BE ≤ 0.35
- MANDATORY: Packs with ONLY generic descriptors MUST get confidence ≤ 0.45 for quarantine
- NEVER GUESS: If you cannot identify a clear musical style, confidence MUST BE ≤ 0.45

CRITICAL EXAMPLES of packs that MUST get LOW confidence (≤ 0.45):
  * "FMT_Unleashed_Kick_Samples" → confidence: 0.35 (FMT meaningless, only generic "Kicks")
  * "Sunhiausa Kicks" → confidence: 0.40 (Unknown artist, only generic "Kicks") 
  * "Samples Vol 2" → confidence: 0.30 (Too generic, no style info)
  * "Producer_Name_Massive_Samples" → confidence: 0.35 (No style, just "massive")
  * "Brand_Code_Unleashed_Bass" → confidence: 0.35 (No style context)
  
DO NOT INVENT GENRES: If unsure about musical style, use confidence ≤ 0.45 to force manual review

STYLE RECOGNITION PATTERNS:
- "Hard Psy" / "Psy Trance" → Trance / Psy family, Psy_Trance style (confidence: 0.9+)
- "Metal-Step" → Bass Music family, Dubstep style (confidence: 0.8+)
- "Trap.And.Riddim" / "Trap And Riddim" → Bass Music family, Trap_Bass style (confidence: 0.9+)
- "Funk Guitars" / "Funk Bass" → Funk / Soul family, Funk style (confidence: 0.8+)
- "KSHMR" → Pop / Mainstage / Dance family, Progressive_House style (confidence: 0.9+)
- "Hardstyle" / "Rawstyle" → Hard Dance family, respective style (confidence: 0.9+)

EXAMPLES:
- Pack "KSHMR Vol. 2" with subfolders ["Progressive House Leads", "Big Room Drops"] → Pop / Mainstage / Dance family, Progressive_House style, confidence: 0.9
- Pack "Hard Psy Pack" with subfolders ["psytrance_kicks", "acid_bass"] → Trance / Psy family, Psy_Trance style, confidence: 0.9
- Pack "Metal-Step Mayhem Vol. 1" → Bass Music family, Dubstep style, confidence: 0.8
- Pack "Funk Guitars and Bass Pack" → Funk / Soul family, Funk style, confidence: 0.8

RESPONSE FORMAT (CRITICAL):
{"classifications": [{"name": "original_pack_name", "family": "exact_family_name", "style": "style_name", "confidence": 0.85}]}

CRITICAL: Use ONLY exact family names from the list. NO ambiguous formats like "FX (generic) or Other" or "Style1/Style2". Pick ONE clear family and ONE clear style.`;
  }

  /**
   * Construire le prompt utilisateur avec contexte
   */
  private buildContextUserPrompt(packs: Array<{name: string, originalName: string, subfolders: string[]}>): string {
    const packDescriptions = packs.map(pack => {
      let description = `Pack: "${pack.name}"`;
      if (pack.subfolders && pack.subfolders.length > 0) {
        // 🔍 DEBUG: Log exact subfolders being sent to GPT
        console.log(`🔍 DEBUG GPT SUBFOLDERS: Pack "${pack.name}" → Subfolders:`, pack.subfolders);
        description += `\nSubfolders: ${pack.subfolders.join(', ')}`;
      }
      return description;
    });

    return `Classify these audio sample packs using both names and subfolder context:\n\n${packDescriptions.join('\n\n')}`;
  }

  /**
   * Construire le prompt utilisateur (méthode originale)
   */
  private buildUserPrompt(packNames: string[]): string {
    return `Classify these audio sample packs:\n\n${packNames.join('\n')}`;
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
    // Prompts envoyés à GPT-5 Nano avec contexte

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
      // Réponse brute reçue
      
      if (!result) {
        throw new Error('No response from GPT-5 Nano');
      }

      try {
        const parsed = JSON.parse(result) as GPT5NanoResponse;
        // Réponse parsée
        console.log('[GPT5Nano] Classifications found:', parsed.classifications?.length || 0);
        
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
   * Classification de fallback si GPT-5 Nano échoue
   */
  private fallbackClassification(packName: string): PackClassification {
    const cleaned = this.cleanPackName(packName).toLowerCase();
    
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

    // Par défaut
    return {
      name: packName,
      family: 'Experimental / IDM / Noise',
      style: 'Experimental',
      confidence: 0.3,
      gptNanoReason: 'Fallback - no clear match'
    };
  }

  /**
   * Nettoyer les noms de packs (basé sur ClassificationWorker)
   */
  cleanPackName(packName: string): string {
    let cleaned = packName;

    // 1. Supprimer les extensions
    cleaned = cleaned.replace(/\.(WAV|MIDI|MP3|FLAC)$/gi, '');
    cleaned = cleaned.replace(/\(WAV\)|\(MIDI\)|\(MP3\)/gi, '');
    
    // 2. Nettoyer les formats de release
    cleaned = cleaned.replace(/\(SCENE\)-DISCOVER/gi, '');
    cleaned = cleaned.replace(/\.REPACK\./gi, ' ');
    cleaned = cleaned.replace(/\.(SCENE)-DISCOVER/gi, '');
    
    // 3. Remplacer les points par des espaces
    cleaned = cleaned.replace(/\./g, ' ');
    
    // 4. Supprimer les préfixes de labels
    cleaned = cleaned.replace(/^(Black Octopus Sound|Black Octopus|BOS)\s*-?\s*/gi, '');
    cleaned = cleaned.replace(/^(Cymatics|KSHMR|Splice)\s*-?\s*/gi, '');
    cleaned = cleaned.replace(/^(OPS|On Point Samples)\s*-?\s*/gi, '');
    cleaned = cleaned.replace(/^#?\s*/gi, '');
    cleaned = cleaned.replace(/^\-\s*/gi, '');
    
    // 5. Nettoyer les versions
    cleaned = cleaned.replace(/\s*(Vol|Volume)\s*\d+/gi, '');
    cleaned = cleaned.replace(/\s*V\d+/gi, '');
    
    // 6. Normaliser les espaces
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  }

  /**
   * Vérifier si GPT-5 Nano est disponible
   */
  isAvailable(): boolean {
    return this.openai !== null;
  }

  /**
   * Nettoyage simple des noms de packs (utilisé par le système de détection de packs)
   */
  async cleanPackNames(prompt: string): Promise<string> {
    if (!this.openai) {
      throw new Error('GPT service not available');
    }

    const response = await this.openai.chat.completions.create({
      model: 'gpt-5-nano',
      reasoning_effort: 'minimal',
      verbosity: 'low',
      max_completion_tokens: 2000,
      messages: [
        { role: 'user', content: prompt }
      ]
    });

    return response.choices[0].message.content || '';
  }

  /**
   * VALIDATEUR CROISÉ BATCH - Valide plusieurs classifications en une seule requête (OPTIMISÉ)
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
        ?.map((f: any) => `- ${f.name}: ${f.styles.join(', ')}`)
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

CRITICAL EXAMPLES:
❌ REJECT: "FMT_Unleashed_Kick_Samples" → Any specific genre - Generic kicks!
❌ REJECT: "Producer_Sample_Pack_Vol2" → Any genre - Too generic!
✅ ACCEPT: "KSHMR_Progressive_House_Pack" → Pop/Dance - Clear indicators
✅ ACCEPT: "Hardstyle_Euphoria_Vol1" → Hard Dance - Obvious genre

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

      // LOGS DÉTAILLÉS - ENTRÉE
      console.log('\n' + '='.repeat(80));
      console.log('🔍 [GPT-5 MINI VALIDATOR] - ENTRÉE DÉTAILLÉE');
      console.log('='.repeat(80));
      console.log('📦 Nombre de packs à valider:', requests.length);
      console.log('📝 Prompt envoyé:');
      console.log('-'.repeat(40));
      console.log(validatorPrompt);
      console.log('-'.repeat(40));
      console.log('🚀 Envoi vers GPT-5 Mini...\n');

      const response = await this.openai.chat.completions.create({
        model: 'gpt-5-mini', // CHANGÉ DE NANO À MINI
        messages: [{ role: 'user', content: validatorPrompt }],
        reasoning_effort: 'minimal', // Pour plus de consistance
        verbosity: 'low',
        max_completion_tokens: 2000, // Plus de tokens pour Mini
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from batch validator');
      }

      // LOGS DÉTAILLÉS - SORTIE
      console.log('\n' + '='.repeat(80));
      console.log('✅ [GPT-5 MINI VALIDATOR] - SORTIE DÉTAILLÉE');
      console.log('='.repeat(80));
      console.log('📊 Tokens utilisés:');
      console.log('  - Entrée:', response.usage?.prompt_tokens || 'N/A');
      console.log('  - Sortie:', response.usage?.completion_tokens || 'N/A');
      console.log('  - Total:', response.usage?.total_tokens || 'N/A');
      console.log('\n📝 Réponse JSON brute:');
      console.log('-'.repeat(40));
      console.log(content);
      console.log('-'.repeat(40));

      const parsed = JSON.parse(content);
      const validations = parsed.validations || [];
      
      console.log('📋 Résultats analysés:');
      validations.forEach((v: any, i: number) => {
        console.log(`  ${i + 1}. ${v.packName}:`);
        console.log(`     Action: ${v.recommendedAction} | Confiance: ${(v.confidence * 100).toFixed(0)}%`);
        console.log(`     Raison: ${v.reason}`);
        if (v.suggestedFamily) console.log(`     Suggestion: ${v.suggestedFamily} → ${v.suggestedStyle}`);
      });
      console.log('='.repeat(80) + '\n');
      
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
          // Fallback si pas de validation trouvée
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
   * VALIDATEUR CROISÉ - Valide une classification avec une seconde instance GPT Nano
   */
  async validateClassification(
    packName: string, 
    classification: PackClassification,
    subfolders: string[] = []
  ): Promise<ClassificationValidation> {
    if (!this.openai) {
      return {
        isValid: false,
        confidence: 0,
        reason: 'GPT Nano validator unavailable',
        recommendedAction: 'QUARANTINE'
      };
    }

    try {
      const familiesText = this.taxonomy?.families
        ?.map((f: any) => `- ${f.name}: ${f.styles.join(', ')}`)
        .join('\n') || '';

      const subfoldersText = subfolders.length > 0 
        ? `\nSubfolders: ${subfolders.join(', ')}` 
        : '';

      const validatorPrompt = `You are a CRITICAL VALIDATOR for audio sample pack classification. Your job is to CATCH MISTAKES and REJECT questionable classifications.

TASK: Validate this classification and detect if it's reasonable or if it's a "guess" that should be rejected.

Pack Name: "${packName}"${subfoldersText}
Proposed Classification: ${classification.family} → ${classification.style} (${(classification.confidence * 100).toFixed(0)}% confidence)

AVAILABLE FAMILIES (for reference):
${familiesText}

VALIDATION CRITERIA - BE EXTREMELY CRITICAL:

🚩 RED FLAGS (MUST REJECT):
- Generic pack names with NO clear style indicators classified with high confidence
- Pack names like "FMT_*", "*_Samples", "*_Vol_*", "Brand_Kicks" classified as anything other than generic
- Acronyms/codes + generic instrument words (kicks, samples, loops) should NEVER get specific genres
- Classifications that seem "invented" or "guessed" rather than obvious from the name
- Cinematic/Orchestral classification for generic kicks/samples (major red flag!)
- Any classification of obviously generic packs that should be in quarantine

✅ GREEN FLAGS (CAN ACCEPT):
- Clear artist names known for specific genres (KSHMR → House/EDM, Spyro → Hardstyle)
- Obvious genre keywords in pack name (Hardstyle, Dubstep, Techno, etc.)
- Artist + genre combination that makes sense
- Subfolders that clearly indicate the musical style

CRITICAL EXAMPLES:
❌ REJECT: "FMT_Unleashed_Kick_Samples" → Cinematic (confidence 55%) - This is GENERIC kicks, not cinematic!
❌ REJECT: "Producer_Sample_Pack_Vol2" → Any specific genre - Too generic!
❌ REJECT: "Brand_Bass_Samples" → Specific style - No style indicators!
✅ ACCEPT: "KSHMR_Progressive_House_Pack" → Pop/Dance (confidence 90%) - Clear indicators
✅ ACCEPT: "Hardstyle_Euphoria_Vol1" → Hard Dance (confidence 95%) - Obvious genre

VALIDATION DECISION:
If you see ANY red flags, recommend QUARANTINE. Only accept classifications that are OBVIOUSLY correct from the pack name.

Return JSON format:
{
  "isValid": boolean,
  "confidence": number (0.0-1.0),
  "reason": "Detailed explanation of why valid/invalid",
  "recommendedAction": "ACCEPT" | "QUARANTINE" | "RECLASSIFY",
  "suggestedFamily": "if recommending reclassify",
  "suggestedStyle": "if recommending reclassify"
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-5-nano',
        messages: [{ role: 'user', content: validatorPrompt }],
        reasoning_effort: 'minimal',
        verbosity: 'low',
        max_completion_tokens: 500,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from validator');
      }

      const validation = JSON.parse(content);
      
      return {
        isValid: validation.isValid || false,
        confidence: validation.confidence || 0,
        reason: validation.reason || 'No reason provided',
        recommendedAction: validation.recommendedAction || 'QUARANTINE',
        suggestedFamily: validation.suggestedFamily,
        suggestedStyle: validation.suggestedStyle
      };

    } catch (error) {
      console.warn('[GPT5Nano Validator] Error:', (error as Error).message);
      
      // Fallback: Si erreur, être conservateur et rejeter
      return {
        isValid: false,
        confidence: 0.2,
        reason: `Validator error: ${(error as Error).message}`,
        recommendedAction: 'QUARANTINE'
      };
    }
  }

  /**
   * Nettoyage de fallback avec règles regex
   */
  private fallbackCleanPackNames(packNames: string[]): { [originalName: string]: string } {
    const result: { [key: string]: string } = {};
    
    for (const name of packNames) {
      result[name] = name
        .replace(/\(scene\)-discover/gi, '')
        .replace(/\.(scene)-discover/gi, '')
        .replace(/\.repack\./gi, ' ')
        .replace(/\(repack\)/gi, '')
        .replace(/multiformats?/gi, '')
        .replace(/\(wav\)/gi, '')
        .replace(/\(midi\)/gi, '')
        .replace(/\./g, ' ')
        .replace(/[_-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    return result;
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