/**
 * Script de recherche des archives de sample packs
 * Cherche les fichiers .rar/.zip dans les dossiers de téléchargement
 */

const fs = require('fs');
const path = require('path');

class SampleArchiveFinder {
  constructor() {
    this.searchPaths = [
      '/mnt/d/TELECHARGEMENT',
      '/mnt/d/TELECHARGEMENT/#TELECHARGEMENT 2021',
      '/mnt/d/TELECHARGEMENT/#TELECHARGEMENT 2019'
    ];

    // Mots-clés des packs perdus
    this.packKeywords = [
      'ops',
      'sunhiausa',
      'hardstyle',
      'rawstyle',
      'hardcore',
      'uptempo',
      'frenchcore',
      'melodic mystery',
      'ultimate harder',
      'production bundle',
      'production suite',
      'kicks vol',
      'serum hardstyle',
      'fmt',
      'sample pack',
      'sample collection',
      'on point samples'
    ];

    this.archiveExtensions = ['.rar', '.zip', '.7z', '.part1', '.part01', '.001'];
  }

  /**
   * Vérifier si un nom de fichier contient des mots-clés de pack
   */
  matchesSamplePack(filename) {
    const lowerName = filename.toLowerCase();

    return this.packKeywords.some(keyword =>
      lowerName.includes(keyword.toLowerCase())
    );
  }

  /**
   * Chercher récursivement dans un dossier
   */
  searchInDirectory(dirPath, results = []) {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Récursion dans les sous-dossiers
          this.searchInDirectory(fullPath, results);
        } else if (entry.isFile()) {
          // Vérifier si c'est une archive
          const ext = path.extname(entry.name).toLowerCase();
          if (this.archiveExtensions.includes(ext)) {
            // Vérifier si ça matche un pack de samples
            if (this.matchesSamplePack(entry.name)) {
              const stat = fs.statSync(fullPath);
              results.push({
                name: entry.name,
                path: fullPath,
                size: stat.size,
                sizeFormatted: this.formatBytes(stat.size),
                modified: stat.mtime,
                extension: ext
              });
            }
          }
        }
      }
    } catch (error) {
      console.log(`⚠️ Erreur accès dossier ${dirPath}: ${error.message}`);
    }

    return results;
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
   * Exécuter la recherche
   */
  async search() {
    console.log('🔍 RECHERCHE DES ARCHIVES DE SAMPLE PACKS');
    console.log('=========================================');
    console.log('');

    const allResults = [];

    for (const searchPath of this.searchPaths) {
      console.log(`📂 Recherche dans: ${searchPath}`);

      if (!fs.existsSync(searchPath)) {
        console.log(`   ❌ Dossier introuvable`);
        console.log('');
        continue;
      }

      const results = this.searchInDirectory(searchPath);
      allResults.push(...results);

      console.log(`   ✅ ${results.length} archives trouvées`);
      console.log('');
    }

    // Afficher les résultats
    if (allResults.length === 0) {
      console.log('❌ Aucune archive de sample pack trouvée...');
      return;
    }

    console.log('🎯 ARCHIVES TROUVÉES:');
    console.log('=====================');
    console.log('');

    // Trier par taille (les plus gros d'abord)
    allResults.sort((a, b) => b.size - a.size);

    for (const result of allResults) {
      console.log(`📦 ${result.name}`);
      console.log(`   📁 ${result.path}`);
      console.log(`   📏 ${result.sizeFormatted}`);
      console.log(`   📅 ${result.modified.toLocaleDateString()}`);
      console.log('');
    }

    console.log(`✅ Total: ${allResults.length} archives trouvées`);
    console.log('');
    console.log('🔥 ACTIONS SUGGÉRÉES:');
    console.log('1. Extraire ces archives dans un nouveau dossier');
    console.log('2. Vérifier que ce sont bien tes packs perdus');
    console.log('3. Les remettre dans D:\\SAMPLES 3\\#RAWSTYLE');

    return allResults;
  }
}

// Point d'entrée
async function main() {
  const finder = new SampleArchiveFinder();
  await finder.search();
}

// Exécuter
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { SampleArchiveFinder };