/**
 * PackDetectorV7 - Détecteur minimal et robuste
 *
 * OBJECTIF : Détecteur universel basé sur un système de scoring simple
 * - Ne dépend PAS des noms de vendeurs (OPS, Singomakers, etc.)
 * - Fonctionne sur TOUS types de packs (commerciaux, persos, mal nommés)
 * - Reste SIMPLE (< 200 lignes)
 * - Atteint ~80% de fiabilité avec 4 critères de scoring
 *
 * SYSTÈME DE SCORING (100 points max) :
 * 1. Structure taxonomique (40 pts) : Organisation en sous-dossiers
 * 2. Cohérence contenu (30 pts) : Fichiers audio ET taille
 * 3. Indicateurs commerciaux (20 pts) : Mots-clés dans le nom
 * 4. Isolation (10 pts) : Dossier bien défini
 *
 * Seuil de détection : 50 points minimum
 */

// Import du type LightweightSnapshotEntry optimisé
import { LightweightSnapshotEntry } from '../utils/DirectorySnapshot';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';

// Utiliser directement le type optimisé
export interface DirectoryNode {
  path: string;
  name: string;
  type: 'file' | 'directory';
  audioFileCount?: number;  // 🎯 Compte agrégé des fichiers audio
  presetFileCount?: number; // 🎯 Compte agrégé des fichiers presets
  totalSize?: number;       // 🎯 Taille totale agrégée
  mtime?: number;
  children?: DirectoryNode[];
}

export interface DetectionResult {
  detectedPacks: DetectedPack[];
  totalScanned: number;
  bundlesFound: number;
}

export interface DetectedPack {
  name: string;
  path: string;
  type: 'pack' | 'bundle';
  score: number;
  audioFiles: number;
  presetFiles: number;
  totalSize: number;
  reasoning: string[];
  subPacks?: DetectedPack[];
}

export interface IPackDetector {
  detect(structure: DirectoryNode): DetectionResult;
}

/**
 * Détecteur V7 - Minimal et robuste
 */
export class PackDetectorV7 implements IPackDetector {
  private static readonly AUDIO_EXTENSIONS = ['.wav', '.mp3', '.flac', '.aiff', '.aif', '.ogg', '.m4a'];
  private static readonly PRESET_EXTENSIONS = ['.fxp', '.fxb', '.h2p', '.nksf', '.nksfx', '.adg', '.adv', '.als', '.flp', '.logic'];
  private static readonly MIN_SCORE = 50;
  private static readonly MB = 1024 * 1024;
  private static readonly GB = 1024 * 1024 * 1024;
  private static readonly MAX_SCAN_DEPTH = 5;

  private bundleKeywords: string[] = [];
  private taxonomyCategories: Set<string> = new Set();

  constructor() {
    this.loadTaxonomy();
  }

  /**
   * Résolution robuste du chemin vers le fichier taxonomie
   * Fonctionne en développement et production Electron
   */
  private resolveTaxonomyPath(): string {
    const taxonomyFileName = 'pack-detection-v6.yaml';

    // Stratégie 1: Chemin relatif depuis __dirname (dev classique)
    const pathFromDirname = path.join(__dirname, '../taxonomies', taxonomyFileName);
    if (fs.existsSync(pathFromDirname)) {
      console.log(`✅ Taxonomie trouvée via __dirname: ${pathFromDirname}`);
      return pathFromDirname;
    }

    // Stratégie 2: Remonter depuis __dirname jusqu'à trouver src/
    let currentDir = __dirname;
    for (let i = 0; i < 10; i++) { // Limite de sécurité
      const srcPath = path.join(currentDir, 'src', 'main', 'services', 'pipeline', 'shared', 'taxonomies', taxonomyFileName);
      if (fs.existsSync(srcPath)) {
        console.log(`✅ Taxonomie trouvée via remontée src/: ${srcPath}`);
        return srcPath;
      }
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) break; // Racine atteinte
      currentDir = parentDir;
    }

    // Stratégie 3: Process working directory + chemin relatif
    const pathFromCwd = path.join(process.cwd(), 'src', 'main', 'services', 'pipeline', 'shared', 'taxonomies', taxonomyFileName);
    if (fs.existsSync(pathFromCwd)) {
      console.log(`✅ Taxonomie trouvée via process.cwd(): ${pathFromCwd}`);
      return pathFromCwd;
    }

    // Stratégie 4: Recherche récursive depuis le projet
    const projectPossibleRoots = [
      process.cwd(),
      path.join(__dirname, '..', '..', '..', '..', '..', '..'),
      path.join(__dirname, '..', '..', '..', '..', '..')
    ];

    for (const root of projectPossibleRoots) {
      try {
        const foundPath = this.findFileRecursively(root, taxonomyFileName, 'taxonomies');
        if (foundPath) {
          console.log(`✅ Taxonomie trouvée via recherche récursive: ${foundPath}`);
          return foundPath;
        }
      } catch (error) {
        // Continue with next strategy
      }
    }

    // Fallback: retourner le chemin relatif classique même s'il n'existe pas
    console.warn(`⚠️ Taxonomie non trouvée, fallback vers: ${pathFromDirname}`);
    return pathFromDirname;
  }

  /**
   * Recherche récursive d'un fichier dans un répertoire
   */
  private findFileRecursively(startDir: string, fileName: string, containingFolder?: string): string | null {
    try {
      if (!fs.existsSync(startDir)) return null;

      const stack = [startDir];
      const visited = new Set<string>();

      while (stack.length > 0) {
        const currentDir = stack.pop()!;

        // Éviter les boucles
        const resolved = path.resolve(currentDir);
        if (visited.has(resolved)) continue;
        visited.add(resolved);

        try {
          const entries = fs.readdirSync(currentDir, { withFileTypes: true });

          for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);

            if (entry.isFile() && entry.name === fileName) {
              // Si un dossier parent spécifique est requis, vérifier
              if (!containingFolder || currentDir.includes(containingFolder)) {
                return fullPath;
              }
            } else if (entry.isDirectory() && !entry.name.startsWith('.') && !entry.name.includes('node_modules')) {
              // Limiter la profondeur pour éviter les problèmes de performance
              const depth = fullPath.split(path.sep).length - startDir.split(path.sep).length;
              if (depth < 8) {
                stack.push(fullPath);
              }
            }
          }
        } catch (error) {
          // Ignorer les erreurs de permission et continuer
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Charger la taxonomie YAML pour la détection de bundles
   */
  private loadTaxonomy(): void {
    try {
      // Stratégie robuste de résolution de chemin pour dev et production
      const taxonomyPath = this.resolveTaxonomyPath();
      console.log(`🔍 Tentative chargement taxonomie: ${taxonomyPath}`);
      console.log(`🔍 __dirname: ${__dirname}`);
      console.log(`🔍 Fichier existe: ${fs.existsSync(taxonomyPath)}`);

      if (fs.existsSync(taxonomyPath)) {
        const taxonomyContent = fs.readFileSync(taxonomyPath, 'utf-8');
        const taxonomy = yaml.load(taxonomyContent) as any;

        // Charger les mots-clés de bundle
        this.bundleKeywords = taxonomy.categories?.BUNDLE_KEYWORDS || [];

        // Charger toutes les catégories pour détecter les noms génériques
        if (taxonomy.categories) {
          Object.values(taxonomy.categories).forEach((categoryList: any) => {
            if (Array.isArray(categoryList)) {
              categoryList.forEach((item: string) => {
                this.taxonomyCategories.add(item.toLowerCase());
              });
            }
          });
        }

        console.log(`✅ Taxonomie chargée: ${this.bundleKeywords.length} bundle keywords, ${this.taxonomyCategories.size} categories`);
        console.log(`🔍 Bundle keywords: ${this.bundleKeywords.slice(0, 5).join(', ')}...`);
        console.log(`🔍 Quelques catégories: ${Array.from(this.taxonomyCategories).slice(0, 10).join(', ')}...`);
      } else {
        console.warn('⚠️ Taxonomie YAML non trouvée, utilisation des valeurs par défaut');
        // Fallback keywords
        this.bundleKeywords = ['BUNDLE', 'COLLECTION', 'SUITE', 'ULTIMATE', 'PRODUCTION', 'COMPLETE'];
      }
    } catch (error) {
      console.error('❌ Erreur chargement taxonomie:', error);
      // Fallback keywords
      this.bundleKeywords = ['BUNDLE', 'COLLECTION', 'SUITE', 'ULTIMATE', 'PRODUCTION', 'COMPLETE'];
    }
  }

  /**
   * Détection principale - Logique 3-phases optimisée
   */
  detect(structure: DirectoryNode): DetectionResult {
    const allResults: DetectedPack[] = [];

    // PHASE 1: Trouver les bundles au niveau racine
    console.log('🔍 PHASE 1: Recherche des BUNDLES au niveau racine...');
    const bundles = this.findBundles(structure);
    console.log(`🎯 Phase 1: ${bundles.length} bundles trouvés`);
    allResults.push(...bundles);

    // PHASE 2: Extraire les packs de chaque bundle
    console.log('🔍 PHASE 2: Extraction des PACKS de chaque bundle...');
    const packsFromBundles: DetectedPack[] = [];
    for (const bundle of bundles) {
      console.log(`  🔍 Scan dans bundle: "${bundle.name}"`);
      const packs = this.extractPacksFromBundle(bundle, structure);
      console.log(`    → ${packs.length} packs extraits`);
      packsFromBundles.push(...packs);
    }
    allResults.push(...packsFromBundles);

    // PHASE 3: Rechercher les packs normaux (hors bundles)
    console.log('🔍 PHASE 3: Recherche des PACKS normaux (hors bundles)...');
    const normalPacks = this.findNormalPacks(structure, bundles.map(b => b.path));
    console.log(`🎯 Phase 3: ${normalPacks.length} packs normaux trouvés`);

    // PHASE 4: Nettoyer les conflits dans les packs normaux seulement
    console.log('🔍 PHASE 4: Nettoyage des conflits dans les packs normaux...');
    const originalNormalCount = normalPacks.length;
    this.resolveConflicts(normalPacks);
    console.log(`🎯 Phase 4: ${originalNormalCount - normalPacks.length} sous-packs supprimés`);

    allResults.push(...normalPacks);

    console.log(`📊 RÉCAPITULATIF: ${bundles.length} bundles + ${packsFromBundles.length} packs de bundles + ${normalPacks.length} packs normaux nettoyés = ${allResults.length} total`);

    return {
      detectedPacks: allResults,
      totalScanned: allResults.length,
      bundlesFound: bundles.length
    };
  }

  /**
   * PHASE 1: Chercher les bundles au niveau racine
   */
  private findBundles(structure: DirectoryNode): DetectedPack[] {
    const bundles: DetectedPack[] = [];
    if (!structure.children) return bundles;

    for (const child of structure.children) {
      if (child.type === 'directory' && !child.name.startsWith('.')) {
        const detection = this.evaluateDirectory(child);
        if (detection && detection.type === 'bundle') {
          bundles.push(detection);
        }
      }
    }
    return bundles;
  }

  /**
   * PHASE 2: Extraire les packs d'un bundle spécifique
   */
  private extractPacksFromBundle(bundle: DetectedPack, rootStructure: DirectoryNode): DetectedPack[] {
    const bundleNode = this.findNodeByPath(rootStructure, bundle.path);
    if (!bundleNode || !bundleNode.children) return [];

    console.log(`    🔍 DEBUG: Bundle "${bundle.name}" a ${bundleNode.children.filter(c => c.type === 'directory').length} enfants`);

    const packs: DetectedPack[] = [];
    for (const child of bundleNode.children) {
      if (child.type === 'directory') {
        console.log(`      ❓ Test: "${child.name}"`);

        const detection = this.evaluateDirectory(child);
        const isRealPackResult = this.isRealPack(child);

        console.log(`        Score: ${detection ? detection.score : 'FAIL'} | isRealPack: ${isRealPackResult}`);

        if (detection && isRealPackResult) {
          detection.reasoning.push(`Extrait du bundle: ${bundle.name}`);
          packs.push(detection);
          console.log(`        ✅ ACCEPTÉ`);
        } else {
          if (!detection) console.log(`        ❌ REJECTÉ: score < 50`);
          if (!isRealPackResult) console.log(`        ❌ REJECTÉ: pas un vrai pack`);
        }
      }
    }
    return packs;
  }

  /**
   * PHASE 3: Chercher les packs normaux (hors bundles)
   */
  private findNormalPacks(structure: DirectoryNode, bundlePaths: string[]): DetectedPack[] {
    const packs: DetectedPack[] = [];
    this.scanForNormalPacks(structure, packs, bundlePaths, 0, 3);
    return packs;
  }

  private scanForNormalPacks(node: DirectoryNode, results: DetectedPack[], bundlePaths: string[], depth: number, maxDepth: number): void {
    if (depth >= maxDepth || !node.children) return;
    if (node.name.startsWith('.')) return;

    // Skip si c'est un bundle déjà traité
    if (bundlePaths.includes(node.path)) return;

    if (depth > 0) {
      const detection = this.evaluateDirectory(node);
      if (detection && detection.type === 'pack') {
        results.push(detection);
      }
    }

    // Continuer en profondeur
    for (const child of node.children) {
      if (child.type === 'directory') {
        this.scanForNormalPacks(child, results, bundlePaths, depth + 1, maxDepth);
      }
    }
  }

  /**
   * Helper: trouver un noeud par son chemin
   */
  private findNodeByPath(rootNode: DirectoryNode, targetPath: string): DirectoryNode | null {
    if (rootNode.path === targetPath) return rootNode;
    if (!rootNode.children) return null;

    for (const child of rootNode.children) {
      const found = this.findNodeByPath(child, targetPath);
      if (found) return found;
    }
    return null;
  }

  /**
   * Helper: détecter les packs spéciaux (MIDI, Templates, Presets)
   */
  private isSpecialPack(node: DirectoryNode): { type: string; score: number } | null {
    const name = node.name.toLowerCase();

    // MIDI packs
    if (name.includes('midi') || name.includes('kickroll')) {
      return { type: 'midi', score: 80 };
    }

    // Template packs
    if (name.includes('template') || name.includes('fl studio') ||
        name.includes('[exodus]') || name.includes('[kryptonite]')) {
      return { type: 'template', score: 80 };
    }

    // Preset packs
    if (name.includes('preset') || name.includes('serum') ||
        name.includes('vital') || name.includes('mixer')) {
      return { type: 'preset', score: 80 };
    }

    return null;
  }

  /**
   * Helper: déterminer si c'est un vrai pack ou un sous-dossier technique
   */
  private isRealPack(node: DirectoryNode): boolean {
    const name = node.name.toLowerCase();

    // Sous-dossiers techniques à ignorer (NOMS EXACTS SEULEMENT!)
    const technicalFolders = [
      'one_shots', 'oneshots', 'one shots',
      'sfx', 'fx', 'effects',
      'drums', 'synths', 'bass', 'vocals', 'leads',
      'loops', 'midi', 'samples',
      'kicks', 'snares', 'hihats', 'percussion',
      'presets'
    ];

    // Vérifier le nom EXACT (pas juste "contient")
    const isExactTechnical = technicalFolders.some(tech =>
      name === tech ||
      name === tech.replace(' ', '_') ||
      name === tech.replace(' ', '-')
    );

    if (isExactTechnical) {
      return false;
    }

    // Patterns de vrais packs
    const isPackPattern =
      /^.+\s+-\s+.+$/.test(node.name) ||  // Artist - Title
      /\(Vol\.?\s*\d+\)/.test(node.name) || // (Vol. 1)
      /\[.+\]/.test(node.name) ||          // [Label]
      node.name.includes(' Pack') ||
      node.name.includes(' Kit') ||
      node.name.includes(' Expansion') ||
      node.name.includes(' Suite') ||
      node.name.includes(' Essentials') ||
      node.name.includes(' Vocals') ||
      node.name.includes(' Melody') ||
      node.name.includes(' Presets') ||
      node.name.includes('Preset Pack');

    // Cas spéciaux : _BONUS, MIDI, Templates, Presets
    const specialPack = this.isSpecialPack(node);
    const isSpecialPackResult = specialPack !== null || node.name.startsWith('_BONUS');

    // Au moins 5 fichiers audio (ou pack spécial sans audio)
    const hasEnoughContent = (node.audioFileCount || 0) >= 5 || isSpecialPackResult;

    return (isPackPattern || isSpecialPackResult) && hasEnoughContent;
  }


  /**
   * Évaluer un dossier avec le système de scoring
   */
  private evaluateDirectory(node: DirectoryNode): DetectedPack | null {
    // CAS SPÉCIAL : Packs spéciaux (MIDI, Templates, Presets)
    const specialPack = this.isSpecialPack(node);
    if (specialPack) {
      const audioFiles = node.audioFileCount || 0;
      const presetFiles = node.presetFileCount || 0;
      const totalSize = node.totalSize || 0;
      const icon = specialPack.type === 'midi' ? '🎵' :
                   specialPack.type === 'template' ? '📝' :
                   specialPack.type === 'preset' ? '🎹' : '📁';
      console.log(`${icon} [${node.name}] Détecté comme PACK ${specialPack.type.toUpperCase()}`);
      return {
        name: node.name,
        path: node.path,
        type: 'pack',
        score: specialPack.score,
        audioFiles,
        presetFiles,
        totalSize,
        reasoning: [`Pack ${specialPack.type} détecté`]
      };
    }

    const scores = {
      structure: this.scoreStructure(node),
      content: this.scoreContent(node),
      commercial: this.scoreCommercial(node.name),
      isolation: this.scoreIsolation(node)
    };

    const totalScore = scores.structure + scores.content + scores.commercial + scores.isolation;

    if (totalScore < PackDetectorV7.MIN_SCORE) {
      return null;
    }

    const audioFiles = node.audioFileCount || 0;
    const presetFiles = node.presetFileCount || 0;
    const totalSize = node.totalSize || 0;


    const type = this.determineBundleOrPack(node, audioFiles, totalSize);
    const reasoning = [`Structure: ${scores.structure}pts`, `Contenu: ${scores.content}pts`, `Commercial: ${scores.commercial}pts`, `Isolation: ${scores.isolation}pts`];

    return {
      name: node.name,
      path: node.path,
      type,
      score: totalScore,
      audioFiles,
      presetFiles,
      totalSize,
      reasoning
    };
  }

  /**
   * Score structure taxonomique (40 pts max)
   */
  private scoreStructure(node: DirectoryNode): number {
    if (!node.children) return 0;

    const subDirs = node.children.filter(c => c.type === 'directory').length;

    if (subDirs >= 5) return 40;
    if (subDirs >= 3) return 25;
    return 0;
  }

  /**
   * Score cohérence contenu (30 pts max)
   */
  private scoreContent(node: DirectoryNode): number {
    const audioFiles = this.countAudioFiles(node);
    const totalSize = this.calculateSize(node);

    if (audioFiles >= 15 && totalSize > 10 * 1024 * 1024) return 30;
    if (audioFiles >= 8) return 15;
    return 0;
  }

  /**
   * Score indicateurs commerciaux (20 pts max)
   */
  private scoreCommercial(name: string): number {
    const lowerName = name.toLowerCase();

    // Pattern Artist - Title
    if (/^.+\s+-\s+.+$/.test(name)) return 20;

    // Mots-clés commerciaux
    const commercialKeywords = ['pack', 'vol.', 'collection', 'kit', 'bundle', 'preset', 'loop', 'sample'];
    const matches = commercialKeywords.filter(keyword => lowerName.includes(keyword)).length;
    if (matches > 0) return Math.min(15, matches * 5);

    // Mots-clés genre
    const genreKeywords = ['rawstyle', 'techno', 'house', 'trance', 'dubstep', 'dnb', 'hardstyle'];
    if (genreKeywords.some(genre => lowerName.includes(genre))) return 10;

    return 0;
  }

  /**
   * Score isolation (10 pts max)
   */
  private scoreIsolation(node: DirectoryNode): number {
    if (!node.children) return 0;

    const audioFiles = this.countAudioFiles(node);
    const totalFiles = this.countTotalFiles(node);

    // Bien isolé si ratio audio élevé
    const audioRatio = totalFiles > 0 ? audioFiles / totalFiles : 0;
    if (audioRatio > 0.6) return 10;
    if (audioRatio > 0.3) return 5;

    return 0;
  }

  /**
   * Compter les fichiers audio (maintenant direct grâce au snapshot lightweight!)
   */
  private countAudioFiles(node: DirectoryNode): number {
    return node.audioFileCount || 0;  // ⚡ Direct depuis le JSON pré-calculé !
  }

  /**
   * Compter les fichiers presets (maintenant direct grâce au snapshot lightweight!)
   */
  private countPresetFiles(node: DirectoryNode): number {
    return node.presetFileCount || 0;  // ⚡ Direct depuis le JSON pré-calculé !
  }

  /**
   * Calculer la taille totale (maintenant direct grâce au snapshot lightweight!)
   */
  private calculateSize(node: DirectoryNode): number {
    return node.totalSize || 0;       // ⚡ Direct depuis le JSON pré-calculé !
  }

  /**
   * Compter le total de fichiers (estimation basée sur taille et fichiers audio)
   */
  private countTotalFiles(node: DirectoryNode): number {
    // Estimation intelligente basée sur les données disponibles
    const audioFiles = node.audioFileCount || 0;
    const totalSize = node.totalSize || 0;

    if (audioFiles === 0) return 0;

    // Estimation : les fichiers audio représentent environ 70% des fichiers d'un pack
    // Les 30% restants sont docs, presets, midi, etc.
    return Math.round(audioFiles / 0.7);
  }

  /**
   * Déterminer si c'est un bundle ou un pack selon les nouveaux critères
   */
  private determineBundleOrPack(node: DirectoryNode, audioFiles: number, totalSize: number): 'pack' | 'bundle' {
    const name = node.name;


    // 1. Si contient des catégories exactes de la taxonomie → PACK obligatoirement
    if (this.containsExactCategories(node)) {
      return 'pack';
    }

    // 2. Sinon, logique bundle normale
    const hasBundleKeyword = this.bundleKeywords.some(keyword =>
      name.toLowerCase().includes(keyword.toLowerCase())
    );

    const isLargeSize = totalSize > 1 * PackDetectorV7.GB || audioFiles > 1000;
    const hasPackNames = this.containsPackNames(node);

    // Bundle si: mot-clé + grande taille + contient des packs nommés
    const isBundle = hasBundleKeyword && isLargeSize && hasPackNames;

    return isBundle ? 'bundle' : 'pack';
  }

  /**
   * Vérifier si le dossier contient des catégories exactes de la taxonomie
   */
  private containsExactCategories(node: DirectoryNode): boolean {
    if (!node.children) return false;

    const subfolders = node.children.filter(c => c.type === 'directory');
    const exactMatches: string[] = [];

    for (const subfolder of subfolders) {
      const subname = subfolder.name;
      const lowerName = subname.toLowerCase();

      // Vérifier match avec taxonomie (qui stocke tout en lowercase)
      if (this.taxonomyCategories.has(lowerName)) {
        exactMatches.push(subname);
      }
    }

    const hasEnoughMatches = exactMatches.length >= 2;

    if (hasEnoughMatches) {
      console.log(`✅ [${node.name}] PACK détecté (${exactMatches.length} catégories): ${exactMatches.join(', ')}`);
    } else if (exactMatches.length === 1) {
      console.log(`⚠️ [${node.name}] 1 seule catégorie: ${exactMatches[0]} (pas assez)`);
    }

    return hasEnoughMatches;
  }

  /**
   * Vérifier si le dossier contient des packs nommés (pas juste des catégories)
   */
  private containsPackNames(node: DirectoryNode): boolean {
    if (!node.children) return false;

    const subfolders = node.children.filter(c => c.type === 'directory');
    if (subfolders.length < 3) return false; // Un bundle doit avoir au moins 3 sous-éléments

    let packNameCount = 0;

    for (const subfolder of subfolders) {
      const subname = subfolder.name;

      // Pattern pack commercial: "Artist - Title" ou "Title (Vol. X)" ou "[Label] Title"
      const isPackPattern = /^.+\s+-\s+.+$/.test(subname) || // Artist - Title
                           /\(Vol\.?\s*\d+\)/.test(subname) || // (Vol. 1)
                           /\[.+\]/.test(subname) || // [Label]
                           /\(.+\)$/.test(subname); // (Label/Year)

      // Pas une catégorie générique de la taxonomie
      const isNotGenericCategory = !this.taxonomyCategories.has(subname.toLowerCase());

      // Pack substantiel (au moins 5 fichiers audio)
      const hasSubstantialContent = (subfolder.audioFileCount || 0) >= 5;

      if (isPackPattern && isNotGenericCategory && hasSubstantialContent) {
        packNameCount++;
      }
    }

    // Au moins 50% des sous-dossiers doivent être des packs nommés
    const packRatio = packNameCount / subfolders.length;
    return packRatio >= 0.5;
  }



  /**
   * Résoudre les conflits parent/enfant (version améliorée)
   */
  private resolveConflicts(packs: DetectedPack[]): void {
    // Trier par score décroissant
    packs.sort((a, b) => b.score - a.score);

    const toRemove = new Set<number>();

    for (let i = 0; i < packs.length; i++) {
      if (toRemove.has(i)) continue;

      for (let j = i + 1; j < packs.length; j++) {
        if (toRemove.has(j)) continue;

        // Vérifier vraie relation parent/enfant
        if (this.isParentChild(packs[i].path, packs[j].path)) {
          // TOUJOURS garder le parent dans une relation parent/enfant
          // Un sous-dossier ne peut jamais être un pack indépendant si son parent est déjà un pack
          if (this.isParentOf(packs[i].path, packs[j].path)) {
            toRemove.add(j); // Supprimer l'enfant, garder le parent
          } else if (this.isParentOf(packs[j].path, packs[i].path)) {
            toRemove.add(i); // Supprimer l'enfant, garder le parent
          }
        }
      }
    }

    // Supprimer en ordre décroissant
    Array.from(toRemove)
      .sort((a, b) => b - a)
      .forEach(index => packs.splice(index, 1));
  }

  /**
   * Helpers pour vérifier les relations
   */
  private isParentChild(path1: string, path2: string): boolean {
    return this.isParentOf(path1, path2) || this.isParentOf(path2, path1);
  }

  private isParentOf(parentPath: string, childPath: string): boolean {
    // Normaliser les chemins
    const parent = parentPath.replace(/\\/g, '/').toLowerCase();
    const child = childPath.replace(/\\/g, '/').toLowerCase();

    // Vérifier vraie relation parent/enfant avec séparateur
    return child.startsWith(parent + '/');
  }
}