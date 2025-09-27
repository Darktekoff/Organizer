/**
 * TaxonomyLoader - Chargeur de taxonomie YAML
 * Charge et parse la taxonomie music-families-v6.yaml
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type { TaxonomyInfo, TaxonomyFamily, TaxonomyFormats } from '../Phase3Types';

/**
 * Loader pour la taxonomie musicale
 */
export class TaxonomyLoader {
  private static cache: TaxonomyInfo | null = null;
  private static cacheTimestamp: number = 0;
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Charge la taxonomie depuis le fichier YAML
   */
  static async load(taxonomyPath?: string): Promise<TaxonomyInfo> {
    const now = Date.now();

    // Utiliser cache si disponible et valide
    if (this.cache && (now - this.cacheTimestamp) < this.CACHE_TTL) {
      return this.cache;
    }

    try {
      const candidatePaths = this.buildCandidatePaths(taxonomyPath);
      let filePath: string | undefined;
      let parsed: any;
      let lastError: Error | undefined;

      for (const candidate of candidatePaths) {
        try {
          console.log(`[TaxonomyLoader] Loading taxonomy from: ${candidate}`);
          const content = await fs.readFile(candidate, 'utf-8');
          const yamlData = yaml.load(content) as any;

          if (!yamlData || !yamlData.families) {
            throw new Error('Invalid taxonomy file: missing families section');
          }

          filePath = candidate;
          parsed = yamlData;
          break;
        } catch (readError) {
          const message = readError instanceof Error ? readError.message : String(readError);
          lastError = readError instanceof Error ? readError : new Error(message);
          console.warn(`⚠️ [TaxonomyLoader] Unable to use taxonomy at ${candidate}: ${message}`);
        }
      }

      if (!filePath || !parsed) {
        const message = lastError?.message || 'Unknown error';
        throw new Error(message);
      }

      const taxonomy: TaxonomyInfo = {
        version: parsed.version || '6.0',
        families: this.parseFamilies(parsed.families),
        types: this.parseTypes(parsed.types),
        formats: this.parseFormats(parsed.formats),
        loadedAt: now,
        source: filePath
      };

      // Cache le résultat
      this.cache = taxonomy;
      this.cacheTimestamp = now;

      console.log(`✅ [TaxonomyLoader] Loaded ${taxonomy.families.length} families, ${taxonomy.types.length} types`);

      return taxonomy;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ [TaxonomyLoader] Failed to load taxonomy: ${errorMessage}`);

      // Retourner taxonomie minimale en fallback
      return this.createFallbackTaxonomy();
    }
  }

  private static buildCandidatePaths(explicitPath?: string): string[] {
    const candidates = new Set<string>();
    const normalizeAndAdd = (target?: string) => {
      if (!target) return;
      const normalized = path.normalize(target);
      if (!candidates.has(normalized)) {
        candidates.add(normalized);
      }
    };

    const cwd = process.cwd();
    const resourcesPath = (process as unknown as { resourcesPath?: string })?.resourcesPath;

    if (explicitPath) {
      normalizeAndAdd(path.isAbsolute(explicitPath)
        ? explicitPath
        : path.join(cwd, explicitPath));
    }

    normalizeAndAdd(path.join(__dirname, '../../shared/taxonomies/music-families-v6.yaml'));
    normalizeAndAdd(path.join(__dirname, '../../../shared/taxonomies/music-families-v6.yaml'));
    normalizeAndAdd(path.join(cwd, 'src/main/services/pipeline/shared/taxonomies/music-families-v6.yaml'));
    normalizeAndAdd(path.join(cwd, 'shared/taxonomies/music-families-v6.yaml'));

    if (resourcesPath) {
      normalizeAndAdd(path.join(resourcesPath, 'shared/taxonomies/music-families-v6.yaml'));
      normalizeAndAdd(path.join(resourcesPath, 'taxonomies/music-families-v6.yaml'));
    }

    return Array.from(candidates);
  }

  /**
   * Parse la section families du YAML
   */
  private static parseFamilies(familiesData: any[]): TaxonomyFamily[] {
    if (!Array.isArray(familiesData)) {
      console.warn('[TaxonomyLoader] Invalid families data, using fallback');
      return this.getDefaultFamilies();
    }

    return familiesData.map(family => ({
      name: family.name || 'Unknown Family',
      id: family.id || family.name?.toLowerCase().replace(/\s+/g, '_') || 'unknown',
      styles: Array.isArray(family.styles) ? family.styles : [],
      color: family.color
    }));
  }

  /**
   * Parse la section types du YAML
   */
  private static parseTypes(typesData: any): string[] {
    if (!typesData || !typesData.primary) {
      return this.getDefaultTypes();
    }

    if (Array.isArray(typesData.primary)) {
      return typesData.primary;
    }

    return this.getDefaultTypes();
  }

  /**
   * Parse la section formats du YAML
   */
  private static parseFormats(formatsData: any): TaxonomyFormats {
    if (!formatsData || typeof formatsData !== 'object') {
      return this.getDefaultFormats();
    }

    const formats: TaxonomyFormats = {};

    for (const [type, formatsList] of Object.entries(formatsData)) {
      if (Array.isArray(formatsList)) {
        formats[type] = formatsList as string[];
      }
    }

    return formats;
  }

  /**
   * Crée une taxonomie de fallback en cas d'erreur
   */
  private static createFallbackTaxonomy(): TaxonomyInfo {
    console.log('⚠️ [TaxonomyLoader] Using fallback taxonomy');

    return {
      version: '6.0-fallback',
      families: this.getDefaultFamilies(),
      types: this.getDefaultTypes(),
      formats: this.getDefaultFormats(),
      loadedAt: Date.now(),
      source: 'fallback'
    };
  }

  /**
   * Familles par défaut
   */
  private static getDefaultFamilies(): TaxonomyFamily[] {
    return [
      {
        name: 'Hard Dance',
        id: 'hard_dance',
        styles: ['Hardstyle', 'Hardcore', 'Rawstyle', 'Frenchcore'],
        color: '#c0392b'
      },
      {
        name: 'Bass Music',
        id: 'bass_music',
        styles: ['Dubstep', 'Future Bass', 'Riddim', 'Trap Bass'],
        color: '#9b59b6'
      },
      {
        name: 'House',
        id: 'house',
        styles: ['House', 'Deep House', 'Tech House', 'Progressive House'],
        color: '#3498db'
      },
      {
        name: 'Techno',
        id: 'techno',
        styles: ['Techno', 'Minimal Techno', 'Hard Techno'],
        color: '#2c3e50'
      },
      {
        name: 'Electronic',
        id: 'electronic',
        styles: ['Electronic', 'EDM', 'Electro'],
        color: '#95a5a6'
      }
    ];
  }

  /**
   * Types par défaut
   */
  private static getDefaultTypes(): string[] {
    return [
      'KICKS',
      'BASS',
      'SYNTHS',
      'PERC',
      'FX',
      'VOCALS',
      'ACAPELLAS',
      'TEXTURES',
      'STEMS'
    ];
  }

  /**
   * Formats par défaut
   */
  private static getDefaultFormats(): TaxonomyFormats {
    return {
      KICKS: ['Full_Kicks', 'Tok', 'Punch', 'Tail', 'Layer', 'Loops'],
      BASS: ['One_Shot', 'Loop', 'Layer', 'Stab'],
      SYNTHS: ['One_Shot', 'Loop', 'Arp', 'Pad', 'Lead', 'Pluck'],
      PERC: ['One_Shot', 'Loop', 'Fill', 'Break'],
      FX: ['One_Shot', 'Sweep', 'Impact', 'Reverse', 'Noise'],
      VOCALS: ['One_Shot', 'Loop', 'Phrase', 'Chop'],
      ACAPELLAS: ['Full', 'Verse', 'Chorus', 'Drop'],
      TEXTURES: ['Ambient', 'Atmosphere', 'Drone', 'Texture'],
      STEMS: ['Full', 'Dry', 'Wet', 'Layer']
    };
  }

  /**
   * Trouve une famille par nom ou ID
   */
  static findFamily(taxonomy: TaxonomyInfo, nameOrId: string): TaxonomyFamily | undefined {
    const search = nameOrId.toLowerCase();

    return taxonomy.families.find(family =>
      family.name.toLowerCase() === search ||
      family.id.toLowerCase() === search ||
      family.name.toLowerCase().includes(search)
    );
  }

  /**
   * Trouve un style dans toutes les familles
   */
  static findStyleFamily(taxonomy: TaxonomyInfo, styleName: string): TaxonomyFamily | undefined {
    const search = styleName.toLowerCase();

    return taxonomy.families.find(family =>
      family.styles.some(style => style.toLowerCase() === search)
    );
  }

  /**
   * Valide si un type existe dans la taxonomie
   */
  static isValidType(taxonomy: TaxonomyInfo, type: string): boolean {
    return taxonomy.types.includes(type.toUpperCase());
  }

  /**
   * Obtient les formats pour un type donné
   */
  static getFormatsForType(taxonomy: TaxonomyInfo, type: string): string[] {
    const upperType = type.toUpperCase();
    return taxonomy.formats[upperType] || [];
  }

  /**
   * Vide le cache (utile pour les tests)
   */
  static clearCache(): void {
    this.cache = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Obtient des statistiques sur la taxonomie chargée
   */
  static getStatistics(taxonomy: TaxonomyInfo) {
    const totalStyles = taxonomy.families.reduce((sum, family) => sum + family.styles.length, 0);
    const totalFormats = Object.values(taxonomy.formats).reduce((sum, formats) => sum + formats.length, 0);

    return {
      families: taxonomy.families.length,
      styles: totalStyles,
      types: taxonomy.types.length,
      formats: totalFormats,
      version: taxonomy.version,
      age: Date.now() - taxonomy.loadedAt
    };
  }
}
