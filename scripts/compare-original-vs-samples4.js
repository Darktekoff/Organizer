/**
 * Script de comparaison entre structure-originale.json et C:\SAMPLES 4
 * Pour vérifier si tous les packs sont récupérés
 */

const fs = require('fs');
const path = require('path');

class PackComparison {
  constructor() {
    this.originalStructurePath = '/mnt/d/SAMPLES 3/#RAWSTYLE/.audio-organizer/structure-originale.json';
    this.samples4Path = '/mnt/c/SAMPLES 4';
  }

  /**
   * Extraire les noms des packs depuis structure-originale.json
   */
  getOriginalPacks() {
    console.log('📂 Lecture structure-originale.json...');

    const content = fs.readFileSync(this.originalStructurePath, 'utf-8');
    const originalStructure = JSON.parse(content);

    const packNames = new Set();
    this.extractPackNames(originalStructure, packNames);

    return Array.from(packNames).sort();
  }

  /**
   * Extraire récursivement les noms de packs
   */
  extractPackNames(node, packNames, depth = 1) {
    if (!node.children) return;

    for (const child of node.children) {
      if (child.type !== 'directory') continue;
      if (child.name === '.audio-organizer') continue;

      // Niveau 1 = packs principaux
      if (depth === 1) {
        packNames.add(child.name);
      }

      this.extractPackNames(child, packNames, depth + 1);
    }
  }

  /**
   * Lister les dossiers dans SAMPLES 4
   */
  getSamples4Folders() {
    console.log('📂 Lecture C:\\SAMPLES 4...');

    if (!fs.existsSync(this.samples4Path)) {
      throw new Error('SAMPLES 4 non trouvé !');
    }

    const entries = fs.readdirSync(this.samples4Path, { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort();
  }

  /**
   * Nettoyer les noms pour la comparaison (enlever suffixes _1, etc.)
   */
  cleanName(name) {
    return name
      .replace(/_\d+$/, '') // Enlever _1, _2, etc.
      .replace(/\s+\(WAV\)$/, '') // Enlever (WAV)
      .replace(/\s+WAV$/, '') // Enlever WAV
      .toLowerCase()
      .trim();
  }

  /**
   * Trouver les correspondances entre noms originaux et SAMPLES 4
   */
  findMatches(originalName, samples4Folders) {
    const cleanOriginal = this.cleanName(originalName);
    const matches = [];

    for (const folder of samples4Folders) {
      const cleanFolder = this.cleanName(folder);

      // Match exact
      if (cleanFolder === cleanOriginal) {
        matches.push({ folder, type: 'exact', confidence: 100 });
        continue;
      }

      // Match partiel (contient)
      if (cleanFolder.includes(cleanOriginal) || cleanOriginal.includes(cleanFolder)) {
        const confidence = Math.max(
          (cleanOriginal.length / cleanFolder.length) * 80,
          (cleanFolder.length / cleanOriginal.length) * 80
        );
        matches.push({ folder, type: 'partial', confidence: Math.round(confidence) });
      }
    }

    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Compter les fichiers dans un dossier de SAMPLES 4
   */
  countFiles(folderPath) {
    try {
      let totalFiles = 0;
      let totalSize = 0;

      const countRecursive = (dirPath) => {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);

          if (entry.isDirectory()) {
            countRecursive(fullPath);
          } else {
            totalFiles++;
            try {
              const stat = fs.statSync(fullPath);
              totalSize += stat.size;
            } catch (e) {
              // Ignore stat errors
            }
          }
        }
      };

      countRecursive(folderPath);
      return { files: totalFiles, size: totalSize };

    } catch (error) {
      return { files: 0, size: 0 };
    }
  }

  /**
   * Formater la taille
   */
  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Faire la comparaison complète
   */
  async compare() {
    console.log('🔍 COMPARAISON ORIGINAUX vs SAMPLES 4');
    console.log('====================================');
    console.log('');

    const originalPacks = this.getOriginalPacks();
    const samples4Folders = this.getSamples4Folders();

    console.log(`📊 Packs originaux: ${originalPacks.length}`);
    console.log(`📊 Dossiers SAMPLES 4: ${samples4Folders.length}`);
    console.log('');

    const results = {
      found: [],
      missing: [],
      extra: [...samples4Folders] // Clone pour identifier les extras
    };

    console.log('🔍 ANALYSE PACK PAR PACK:');
    console.log('========================');

    for (const originalPack of originalPacks) {
      console.log(`\n📦 "${originalPack}"`);

      const matches = this.findMatches(originalPack, samples4Folders);

      if (matches.length > 0) {
        const bestMatch = matches[0];
        console.log(`   ✅ TROUVÉ: "${bestMatch.folder}" (${bestMatch.type} - ${bestMatch.confidence}%)`);

        // Compter les fichiers
        const folderPath = path.join(this.samples4Path, bestMatch.folder);
        const { files, size } = this.countFiles(folderPath);
        console.log(`      📁 ${files} fichiers, ${this.formatSize(size)}`);

        results.found.push({
          original: originalPack,
          match: bestMatch,
          files,
          size
        });

        // Retirer des extras
        const index = results.extra.indexOf(bestMatch.folder);
        if (index > -1) results.extra.splice(index, 1);

      } else {
        console.log(`   ❌ MANQUANT`);
        results.missing.push(originalPack);
      }
    }

    console.log('\n');
    console.log('📊 RÉSUMÉ FINAL:');
    console.log('===============');
    console.log(`✅ Trouvés: ${results.found.length}/${originalPacks.length}`);
    console.log(`❌ Manquants: ${results.missing.length}`);
    console.log(`➕ Extras: ${results.extra.length}`);

    const totalFiles = results.found.reduce((sum, item) => sum + item.files, 0);
    const totalSize = results.found.reduce((sum, item) => sum + item.size, 0);
    console.log(`📁 Total fichiers: ${totalFiles}`);
    console.log(`💾 Total taille: ${this.formatSize(totalSize)}`);

    if (results.missing.length > 0) {
      console.log('\n❌ PACKS MANQUANTS:');
      for (const missing of results.missing) {
        console.log(`   • ${missing}`);
      }
    }

    if (results.extra.length > 0) {
      console.log('\n➕ DOSSIERS EXTRAS (non dans originaux):');
      for (const extra of results.extra.slice(0, 10)) {
        console.log(`   • ${extra}`);
      }
      if (results.extra.length > 10) {
        console.log(`   • ... et ${results.extra.length - 10} autres`);
      }
    }

    return results;
  }
}

// Point d'entrée
async function main() {
  try {
    const comparison = new PackComparison();
    await comparison.compare();
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { PackComparison };