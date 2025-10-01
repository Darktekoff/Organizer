#!/usr/bin/env node
/**
 * Analyse les résultats du pipeline depuis les snapshots
 * Génère un rapport de classification détaillé
 *
 * Usage: node scripts/analyze-test-results.js
 */

const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURATION
// ============================================

const PATHS = {
  testData: path.join(__dirname, '..', 'test-data'),
  snapshots: path.join(__dirname, '..', 'test-data', '.audio-organizer'),
  reports: path.join(__dirname, '..', 'reports')
};

// Taxonomie simple pour classification basée sur les noms
const MUSIC_TAXONOMY = {
  Hardstyle: {
    keywords: ['hardstyle', 'rawstyle', 'raw', 'euphoric', 'kick', 'screech'],
    styles: ['Hardstyle', 'Rawstyle', 'Euphoric Hardstyle']
  },
  EDM: {
    keywords: ['edm', 'future bass', 'dubstep', 'electro', 'melodic'],
    styles: ['Future Bass', 'Dubstep', 'Electro', 'Melodic Dubstep']
  },
  House: {
    keywords: ['house', 'tech house', 'deep house', 'future house'],
    styles: ['Tech House', 'Deep House', 'Future House']
  },
  'Hip-Hop': {
    keywords: ['hip hop', 'trap', '808', 'kshmr', 'phonk'],
    styles: ['Trap', 'Hip-Hop', 'Phonk']
  },
  'Drum & Bass': {
    keywords: ['drum bass', 'd&b', 'dnb', 'jungle'],
    styles: ['Drum & Bass', 'Jungle']
  },
  Techno: {
    keywords: ['techno', 'industrial'],
    styles: ['Techno', 'Industrial Techno']
  },
  Trance: {
    keywords: ['trance', 'psytrance', 'progressive'],
    styles: ['Trance', 'Psytrance', 'Progressive Trance']
  },
  Ambient: {
    keywords: ['ambient', 'chill', 'atmosphere', 'drone'],
    styles: ['Ambient', 'Chillout', 'Downtempo']
  },
  World: {
    keywords: ['afrobeat', 'jazz', 'brazilian', 'ethnic', 'world'],
    styles: ['Afrobeat', 'Jazz', 'Brazilian Funk', 'Ethnic']
  },
  Presets: {
    keywords: ['preset', 'serum', 'sylenth', 'spire', 'massive'],
    styles: ['Synth Presets']
  }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function classifyPackByName(packName) {
  const lowerName = packName.toLowerCase();

  // Parcourir chaque famille
  for (const [family, data] of Object.entries(MUSIC_TAXONOMY)) {
    for (const keyword of data.keywords) {
      if (lowerName.includes(keyword)) {
        // Confidence basée sur le match
        const confidence = keyword.length / packName.length > 0.2 ? 0.85 : 0.65;

        // Choisir un style de la famille
        const style = data.styles[0];

        return {
          family,
          style,
          confidence,
          method: 'LEXICAL',
          matchedKeyword: keyword
        };
      }
    }
  }

  // Pas de match - classer comme Unknown
  return {
    family: 'Unknown',
    style: 'Unclassified',
    confidence: 0.3,
    method: 'MANUAL',
    matchedKeyword: null
  };
}

// ============================================
// ANALYSIS FUNCTIONS
// ============================================

function analyzePacks() {
  console.log('🔍 Analyse des snapshots...\n');

  // Lire structure-reorganized.json
  const reorganizedPath = path.join(PATHS.snapshots, 'structure-reorganized.json');

  if (!fs.existsSync(reorganizedPath)) {
    console.error('❌ Snapshot non trouvé:', reorganizedPath);
    console.error('   Exécutez d\'abord le pipeline dans l\'application');
    process.exit(1);
  }

  const snapshot = JSON.parse(fs.readFileSync(reorganizedPath, 'utf-8'));

  console.log(`✓ Snapshot chargé: ${snapshot.fileIndex?.length || 0} fichiers indexés`);

  // Extraire les packs depuis packMapping
  const packMapping = snapshot.metadata?.packMapping || [];
  console.log(`✓ Packs trouvés: ${packMapping.length}`);

  // Classifier chaque pack
  const classifiedPacks = packMapping.map((pack, index) => {
    const classification = classifyPackByName(pack.originalName || pack.newName);

    return {
      packId: `pack_${index}`,
      packName: pack.originalName || pack.newName,
      originalPath: pack.originalPath || '',
      newName: pack.newName || pack.originalName,
      type: pack.type,
      classification,
      stats: {
        audioFiles: pack.audioFiles || 0,
        totalSize: pack.totalSize || 0,
        fileCount: (pack.audioFiles || 0) + (pack.presetFiles || 0)
      }
    };
  });

  return {
    snapshot,
    packMapping,
    classifiedPacks
  };
}

function generateReport(analysisData) {
  const { snapshot, packMapping, classifiedPacks } = analysisData;

  // Calculs statistiques
  const totalPacks = classifiedPacks.length;
  const confidences = classifiedPacks.map(p => p.classification.confidence);
  const averageConfidence = confidences.reduce((a, b) => a + b, 0) / totalPacks;

  // Distribution par famille
  const familyDistribution = {};
  classifiedPacks.forEach(pack => {
    const family = pack.classification.family;
    familyDistribution[family] = (familyDistribution[family] || 0) + 1;
  });

  // Packs en quarantaine (confidence < 0.5)
  const quarantinedPacks = classifiedPacks.filter(p => p.classification.confidence < 0.5);

  // Issues
  const issues = [];
  classifiedPacks.forEach(pack => {
    if (pack.classification.confidence < 0.5) {
      issues.push({
        severity: 'warning',
        packId: pack.packId,
        packName: pack.packName,
        message: `Faible confiance: ${(pack.classification.confidence * 100).toFixed(0)}%`
      });
    }

    if (pack.classification.family === 'Unknown') {
      issues.push({
        severity: 'error',
        packId: pack.packId,
        packName: pack.packName,
        message: 'Pas de classification trouvée'
      });
    }
  });

  // Recommandations
  const recommendations = [];

  if (quarantinedPacks.length > totalPacks * 0.2) {
    recommendations.push('Taux de quarantaine élevé (>20%) - Enrichir la taxonomie');
  }

  if (averageConfidence < 0.7) {
    recommendations.push('Confiance moyenne faible (<0.7) - Ajouter plus de mots-clés');
  }

  const unknownCount = familyDistribution['Unknown'] || 0;
  if (unknownCount > totalPacks * 0.1) {
    recommendations.push(`${unknownCount} packs non classifiés - Ajouter nouvelles familles`);
  }

  // Rapport complet
  return {
    metadata: {
      timestamp: new Date().toISOString(),
      testDataPath: PATHS.testData,
      pipelineVersion: 'V6',
      totalDuration: 0
    },
    summary: {
      totalPacks,
      classifiedPacks: classifiedPacks.length - unknownCount,
      quarantinedPacks: quarantinedPacks.length,
      averageConfidence,
      familyDistribution
    },
    packDetails: classifiedPacks.map(pack => ({
      packId: pack.packId,
      packName: pack.packName,
      originalPath: pack.originalPath,
      classification: pack.classification,
      tags: [],
      fileCount: pack.stats.fileCount,
      audioFiles: pack.stats.audioFiles,
      presetFiles: 0
    })),
    issues,
    recommendations
  };
}

function saveReportJSON(report, outputPath) {
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
}

function saveReportMarkdown(report, outputPath) {
  let md = `# 📊 Rapport de Classification - Test Pipeline V6\n\n`;
  md += `**Généré:** ${report.metadata.timestamp}\n`;
  md += `**Source:** ${report.metadata.testDataPath}\n\n`;

  md += `## 📈 Résumé Global\n\n`;
  md += `- **Total packs:** ${report.summary.totalPacks}\n`;
  md += `- **Classifiés:** ${report.summary.classifiedPacks}\n`;
  md += `- **Quarantaine:** ${report.summary.quarantinedPacks} (confiance < 50%)\n`;
  md += `- **Confiance moyenne:** ${(report.summary.averageConfidence * 100).toFixed(1)}%\n\n`;

  md += `## 🎵 Distribution par Famille Musicale\n\n`;
  const sortedFamilies = Object.entries(report.summary.familyDistribution)
    .sort((a, b) => b[1] - a[1]);

  sortedFamilies.forEach(([family, count]) => {
    const percentage = ((count / report.summary.totalPacks) * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(count / 2));
    md += `- **${family}:** ${count} packs (${percentage}%) ${bar}\n`;
  });

  md += `\n## 📦 Détails par Pack (Top 20)\n\n`;
  md += `| # | Pack | Famille | Style | Confiance | Méthode |\n`;
  md += `|---|------|---------|-------|-----------|----------|\n`;

  report.packDetails.slice(0, 20).forEach((pack, idx) => {
    const conf = (pack.classification.confidence * 100).toFixed(0);
    const emoji = conf >= 70 ? '✅' : conf >= 50 ? '🟡' : '🔴';
    md += `| ${idx + 1} | ${pack.packName} | ${pack.classification.family} | ${pack.classification.style} | ${conf}% ${emoji} | ${pack.classification.method} |\n`;
  });

  if (report.packDetails.length > 20) {
    md += `\n_... et ${report.packDetails.length - 20} autres packs (voir rapport JSON)_\n`;
  }

  if (report.issues.length > 0) {
    md += `\n## ⚠️ Issues Détectées (${report.issues.length})\n\n`;

    // Grouper par sévérité
    const errors = report.issues.filter(i => i.severity === 'error');
    const warnings = report.issues.filter(i => i.severity === 'warning');

    if (errors.length > 0) {
      md += `### 🔴 Erreurs (${errors.length})\n\n`;
      errors.slice(0, 5).forEach(issue => {
        md += `- **${issue.packName}:** ${issue.message}\n`;
      });
      if (errors.length > 5) md += `\n_... et ${errors.length - 5} autres erreurs_\n`;
    }

    if (warnings.length > 0) {
      md += `\n### 🟡 Warnings (${warnings.length})\n\n`;
      warnings.slice(0, 5).forEach(issue => {
        md += `- **${issue.packName}:** ${issue.message}\n`;
      });
      if (warnings.length > 5) md += `\n_... et ${warnings.length - 5} autres warnings_\n`;
    }
  }

  if (report.recommendations.length > 0) {
    md += `\n## 💡 Recommandations\n\n`;
    report.recommendations.forEach((rec, idx) => {
      md += `${idx + 1}. ${rec}\n`;
    });
  }

  md += `\n## 📊 Analyse de Performance\n\n`;
  md += `### Score de Classification\n\n`;

  const score = (report.summary.classifiedPacks / report.summary.totalPacks) * 100;
  let grade = 'F';
  if (score >= 90) grade = 'A+';
  else if (score >= 85) grade = 'A';
  else if (score >= 80) grade = 'B+';
  else if (score >= 75) grade = 'B';
  else if (score >= 70) grade = 'C+';
  else if (score >= 60) grade = 'C';
  else if (score >= 50) grade = 'D';

  md += `**Score:** ${score.toFixed(1)}% - **Grade:** ${grade}\n\n`;

  if (score >= 90) {
    md += `✅ **Excellent!** La classification est très précise.\n`;
  } else if (score >= 75) {
    md += `🟡 **Bon** mais peut être amélioré.\n`;
  } else {
    md += `🔴 **À améliorer** - Beaucoup de packs non classifiés correctement.\n`;
  }

  md += `\n---\n\n`;
  md += `_Rapport généré automatiquement par analyze-test-results.js_\n`;
  md += `_Pour améliorer la classification, consultez le README-TEST-PIPELINE.md_\n`;

  fs.writeFileSync(outputPath, md);
}

// ============================================
// MAIN
// ============================================

function main() {
  console.log('🚀 Analyse des Résultats du Pipeline V6');
  console.log('━'.repeat(60));

  try {
    // Analyse
    const analysisData = analyzePacks();

    // Génération rapport
    console.log('\n📊 Génération du rapport...');
    const report = generateReport(analysisData);

    // Sauvegarde
    ensureDir(PATHS.reports);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').slice(0, -5);
    const jsonPath = path.join(PATHS.reports, `classification-report-${timestamp}.json`);
    const mdPath = path.join(PATHS.reports, `classification-report-${timestamp}.md`);

    saveReportJSON(report, jsonPath);
    saveReportMarkdown(report, mdPath);

    console.log(`✓ Rapport JSON: ${path.relative(process.cwd(), jsonPath)}`);
    console.log(`✓ Rapport MD: ${path.relative(process.cwd(), mdPath)}`);

    // Résumé console
    console.log('\n' + '━'.repeat(60));
    console.log('✅ ANALYSE TERMINÉE');
    console.log('━'.repeat(60));

    console.log(`\n📊 RÉSUMÉ:`);
    console.log(`   Total packs: ${report.summary.totalPacks}`);
    console.log(`   Classifiés: ${report.summary.classifiedPacks} (${((report.summary.classifiedPacks / report.summary.totalPacks) * 100).toFixed(1)}%)`);
    console.log(`   Confiance moyenne: ${(report.summary.averageConfidence * 100).toFixed(1)}%`);

    console.log(`\n🎵 TOP 5 FAMILLES:`);
    Object.entries(report.summary.familyDistribution)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([family, count]) => {
        const percentage = ((count / report.summary.totalPacks) * 100).toFixed(0);
        console.log(`   ${family}: ${count} packs (${percentage}%)`);
      });

    if (report.issues.length > 0) {
      console.log(`\n⚠️  Issues: ${report.issues.length}`);
    }

    if (report.recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`);
      report.recommendations.forEach(rec => {
        console.log(`   - ${rec}`);
      });
    }

    console.log(`\n📄 Voir le rapport complet: ${path.basename(mdPath)}`);

  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { analyzePacks, generateReport };
