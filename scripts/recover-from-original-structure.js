/**
 * Script de récupération intelligent basé sur structure-originale.json
 * Cherche les packs perdus par leurs noms exacts dans les téléchargements
 */

const fs = require('fs');
const path = require('path');

class SmartRecovery {
  constructor() {
    this.searchPaths = [
      '/mnt/d/TELECHARGEMENT',
      '/mnt/d/TELECHARGEMENT/#TELECHARGEMENT 2021',
      '/mnt/d/TELECHARGEMENT/#TELECHARGEMENT 2019'
    ];

    this.originalStructurePath = '/mnt/d/SAMPLES 3/#RAWSTYLE/.audio-organizer/structure-originale.json';
    this.archiveExtensions = ['.rar', '.zip', '.7z', '.part1', '.part01', '.001'];
  }

  /**
   * Extraire les noms des packs/bundles depuis structure-originale.json
   */
  extractOriginalPackNames() {
    console.log('📂 Lecture de structure-originale.json...');

    if (!fs.existsSync(this.originalStructurePath)) {
      throw new Error(`structure-originale.json introuvable: ${this.originalStructurePath}`);
    }

    const content = fs.readFileSync(this.originalStructurePath, 'utf-8');
    const originalStructure = JSON.parse(content);

    const packNames = new Set();

    // Extraire récursivement les noms de dossiers de premier niveau (packs/bundles)
    this.extractPackNamesRecursive(originalStructure, packNames, 1);

    console.log(`✅ ${packNames.size} packs/bundles trouvés dans la structure originale`);

    return Array.from(packNames);
  }

  /**
   * Extraire récursivement les noms (niveau 1 = packs principaux)
   */
  extractPackNamesRecursive(node, packNames, depth = 1) {
    if (!node.children) return;

    for (const child of node.children) {
      if (child.type !== 'directory') continue;
      if (child.name === '.audio-organizer') continue; // Ignorer le dossier technique

      // Niveau 1 = packs/bundles principaux
      if (depth === 1) {
        packNames.add(child.name);
        console.log(`📦 Pack détecté: "${child.name}"`);
      }

      // Continuer la récursion pour détecter les sous-packs
      this.extractPackNamesRecursive(child, packNames, depth + 1);
    }
  }

  /**
   * Chercher si un nom de pack matche avec un fichier/dossier
   */
  findPackMatches(packName, searchPath) {
    const matches = [];

    try {
      const entries = fs.readdirSync(searchPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryName = entry.name.toLowerCase();
        const packNameLower = packName.toLowerCase();

        // Match exact
        if (entryName === packNameLower) {
          matches.push({
            name: entry.name,
            path: path.join(searchPath, entry.name),
            type: entry.isDirectory() ? 'folder' : 'file',
            matchType: 'exact',
            confidence: 100
          });
          continue;
        }

        // Match avec extension archive
        for (const ext of this.archiveExtensions) {
          if (entryName === packNameLower + ext) {
            const stat = fs.statSync(path.join(searchPath, entry.name));
            matches.push({
              name: entry.name,
              path: path.join(searchPath, entry.name),
              type: 'archive',
              extension: ext,
              size: stat.size,
              sizeFormatted: this.formatBytes(stat.size),
              matchType: 'archive',
              confidence: 95
            });
            continue;
          }
        }

        // Match partiel (contient le nom)
        if (entryName.includes(packNameLower) || packNameLower.includes(entryName)) {
          const stat = fs.statSync(path.join(searchPath, entry.name));
          matches.push({
            name: entry.name,
            path: path.join(searchPath, entry.name),
            type: entry.isDirectory() ? 'folder' : (this.isArchive(entry.name) ? 'archive' : 'file'),
            size: stat.size,
            sizeFormatted: this.formatBytes(stat.size),
            matchType: 'partial',
            confidence: entryName.includes(packNameLower) ? 80 : 60
          });
        }
      }

      // Recherche récursive limitée aux premiers niveaux pour éviter timeout
      // (les archives sont généralement au niveau 1 ou 2)

    } catch (error) {
      // Ignorer les erreurs d'accès
    }

    return matches;
  }

  /**
   * Vérifier si un fichier est une archive
   */
  isArchive(filename) {
    const ext = path.extname(filename).toLowerCase();
    return this.archiveExtensions.includes(ext) ||
           filename.toLowerCase().includes('.part') ||
           /\.(rar|zip|7z)$/.test(filename.toLowerCase());
  }

  /**
   * Formater la taille des fichiers
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Exécuter la récupération intelligente
   */
  async recover() {
    console.log('🔍 RÉCUPÉRATION INTELLIGENTE DES PACKS PERDUS');
    console.log('==============================================');
    console.log('');

    // Étape 1: Extraire les noms des packs perdus
    const originalPackNames = this.extractOriginalPackNames();
    console.log('');

    // Étape 2: Chercher dans les dossiers de téléchargement
    const allMatches = new Map(); // packName -> matches[]

    for (const packName of originalPackNames) {
      console.log(`🔍 Recherche: "${packName}"`);

      const packMatches = [];

      for (const searchPath of this.searchPaths) {
        if (!fs.existsSync(searchPath)) {
          console.log(`   ⚠️  Dossier non trouvé: ${searchPath}`);
          continue;
        }

        const matches = this.findPackMatches(packName, searchPath);
        packMatches.push(...matches);
      }

      if (packMatches.length > 0) {
        // Trier par confiance puis par taille
        packMatches.sort((a, b) => {
          if (b.confidence !== a.confidence) return b.confidence - a.confidence;
          return (b.size || 0) - (a.size || 0);
        });

        allMatches.set(packName, packMatches);
        console.log(`   ✅ ${packMatches.length} correspondance(s) trouvée(s)`);
      } else {
        console.log(`   ❌ Aucune correspondance`);
      }
    }

    console.log('');
    console.log('📊 RÉSULTATS DE LA RÉCUPÉRATION:');
    console.log('================================');
    console.log('');

    let totalRecoverable = 0;
    const recoveryPlan = [];

    for (const [packName, matches] of allMatches) {
      if (matches.length === 0) continue;

      totalRecoverable++;
      const bestMatch = matches[0]; // Le meilleur match (trié)

      console.log(`📦 ${packName}`);
      console.log(`   🎯 MEILLEURE CORRESPONDANCE:`);
      console.log(`      📁 ${bestMatch.path}`);
      console.log(`      📋 Type: ${bestMatch.type} (${bestMatch.matchType} - ${bestMatch.confidence}%)`);
      if (bestMatch.sizeFormatted) {
        console.log(`      📏 Taille: ${bestMatch.sizeFormatted}`);
      }

      if (matches.length > 1) {
        console.log(`   📋 ${matches.length - 1} autre(s) correspondance(s):`);
        for (let i = 1; i < Math.min(matches.length, 4); i++) {
          const match = matches[i];
          console.log(`      • ${match.name} (${match.confidence}%)`);
        }
        if (matches.length > 4) {
          console.log(`      • ... et ${matches.length - 4} autres`);
        }
      }

      recoveryPlan.push({
        originalName: packName,
        bestMatch: bestMatch,
        allMatches: matches
      });

      console.log('');
    }

    console.log(`✅ RÉSUMÉ: ${totalRecoverable}/${originalPackNames.length} packs récupérables`);
    console.log('');
    console.log('🔥 PLAN DE RÉCUPÉRATION:');
    console.log('1. Extraire les archives trouvées');
    console.log('2. Copier les dossiers déjà décompressés');
    console.log('3. Remettre dans D:\\SAMPLES 3\\#RAWSTYLE');
    console.log('4. Relancer l\'analyse avec l\'app');

    return recoveryPlan;
  }
}

// Point d'entrée
async function main() {
  try {
    const recovery = new SmartRecovery();
    const plan = await recovery.recover();

    console.log('');
    console.log('💾 Plan de récupération généré avec succès!');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { SmartRecovery };