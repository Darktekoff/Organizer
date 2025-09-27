#!/usr/bin/env node

/**
 * Script de génération de données de test pour Audio Organizer V6
 * Crée une structure réaliste de packs de samples avec différents formats et organisations
 */

const fs = require('fs');
const path = require('path');

// Configuration de base
const TEST_ROOT = path.join(__dirname, '..', 'test-data');

// Données de test réalistes
const SAMPLE_PACKS = [
  {
    name: "Vengeance Essential Clubsounds Vol.8",
    type: "pack",
    folders: ["Kicks", "Snares", "Hihats", "Percussion", "Synths", "Vocals"],
    samplesPerFolder: [12, 15, 20, 8, 25, 6],
    hasPresets: true,
    presetCount: 15
  },
  {
    name: "Loopmasters - Future Bass Revolution",
    type: "pack",
    folders: ["Drum Loops", "Bass Loops", "Lead Loops", "Pad Loops", "One Shots/Drums", "One Shots/Synths"],
    samplesPerFolder: [24, 18, 16, 12, 30, 22],
    hasPresets: false
  },
  {
    name: "Native Instruments - Massive X Factory",
    type: "pack",
    folders: ["Basses", "Leads", "Pads", "Arps", "FX", "Percussion"],
    samplesPerFolder: [20, 18, 15, 12, 10, 8],
    hasPresets: true,
    presetCount: 89
  }
];

const BUNDLE_PACKS = [
  {
    name: "Ultimate Hardstyle Bundle 2024",
    type: "bundle",
    packs: [
      {
        name: "Hardstyle Kicks Vol.3",
        folders: ["Raw Kicks", "Euphoric Kicks", "Reverse Bass"],
        samplesPerFolder: [15, 12, 8]
      },
      {
        name: "Screeches & Leads Collection",
        folders: ["Screeches", "Euphoric Leads", "Climax Leads"],
        samplesPerFolder: [18, 14, 10]
      },
      {
        name: "Hardstyle Vocals 2024",
        folders: ["Male Vocals", "Female Vocals", "Vocal Chops"],
        samplesPerFolder: [8, 6, 20]
      },
      {
        name: "Festival Anthems Construction Kits",
        folders: ["Kit 1 - 150 BPM", "Kit 2 - 152 BPM", "Kit 3 - 148 BPM"],
        samplesPerFolder: [12, 12, 12]
      }
    ]
  }
];

const PRESET_PACK = {
  name: "Serum Presets - Melodic Dubstep Pro",
  type: "presets",
  presetCount: 156,
  folders: ["Basses", "Leads", "Plucks", "Pads", "FX"]
};

const MISC_FILES = [
  "Sample Pack Cover.png",
  "ReadMe.txt",
  "License Agreement.pdf",
  ".DS_Store",
  "Thumbs.db"
];

/**
 * Crée un fichier WAV factice avec une taille réaliste
 */
function createFakeWavFile(filePath, durationSeconds = 3) {
  const sampleRate = 44100;
  const bitDepth = 16;
  const channels = 2;

  // Calcul approximatif de la taille d'un fichier WAV
  const dataSize = sampleRate * channels * (bitDepth / 8) * durationSeconds;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  // Créer un buffer avec des données aléatoires
  const buffer = Buffer.alloc(totalSize);

  // Header WAV basique (simplifié)
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(totalSize - 8, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Chunk size
  buffer.writeUInt16LE(1, 20);  // Audio format (PCM)
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);

  // Remplir le reste avec des données pseudo-aléatoires
  for (let i = headerSize; i < totalSize; i++) {
    buffer[i] = Math.floor(Math.random() * 256);
  }

  fs.writeFileSync(filePath, buffer);
  console.log(`  📄 ${path.basename(filePath)} (${(totalSize / 1024).toFixed(1)} KB)`);
}

/**
 * Crée un fichier de preset factice
 */
function createFakePresetFile(filePath, format = 'fxp') {
  const presetData = {
    name: path.basename(filePath, path.extname(filePath)),
    format: format,
    parameters: Array.from({length: 32}, () => Math.random()),
    timestamp: Date.now()
  };

  if (format === 'fxp') {
    // Format binaire simplifié pour FXP
    const buffer = Buffer.alloc(1024);
    buffer.write('CcnK', 0); // Magic number pour FXP
    buffer.writeUInt32BE(1, 4); // Version
    // Remplir avec des données pseudo-aléatoires
    for (let i = 8; i < 1024; i++) {
      buffer[i] = Math.floor(Math.random() * 256);
    }
    fs.writeFileSync(filePath, buffer);
  } else {
    // Format JSON pour les presets modernes (Serum, etc.)
    fs.writeFileSync(filePath, JSON.stringify(presetData, null, 2));
  }

  console.log(`  🎛️ ${path.basename(filePath)}`);
}

/**
 * Crée un fichier texte factice
 */
function createTextFile(filePath, content) {
  fs.writeFileSync(filePath, content);
  console.log(`  📝 ${path.basename(filePath)}`);
}

/**
 * Crée un fichier binaire factice (image, etc.)
 */
function createBinaryFile(filePath, sizeKB = 50) {
  const buffer = Buffer.alloc(sizeKB * 1024);
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] = Math.floor(Math.random() * 256);
  }
  fs.writeFileSync(filePath, buffer);
  console.log(`  🖼️ ${path.basename(filePath)} (${sizeKB} KB)`);
}

/**
 * Génère un sample pack
 */
function generateSamplePack(packData, basePath) {
  const packPath = path.join(basePath, packData.name);
  fs.mkdirSync(packPath, { recursive: true });

  console.log(`\n📦 Génération: ${packData.name}`);

  let totalSamples = 0;

  // Créer les dossiers et samples
  packData.folders.forEach((folder, index) => {
    const folderPath = path.join(packPath, folder);
    fs.mkdirSync(folderPath, { recursive: true });

    const sampleCount = packData.samplesPerFolder[index] || 10;
    totalSamples += sampleCount;

    console.log(`  📁 ${folder}/`);

    // Générer les samples
    for (let i = 1; i <= sampleCount; i++) {
      const sampleName = `${folder.replace(/[^a-zA-Z0-9]/g, '')}_${i.toString().padStart(2, '0')}.wav`;
      const samplePath = path.join(folderPath, sampleName);

      // Varier la durée des samples selon le type
      let duration = 3; // Défaut
      if (folder.toLowerCase().includes('loop')) duration = 8;
      if (folder.toLowerCase().includes('kick')) duration = 1;
      if (folder.toLowerCase().includes('vocal')) duration = 4;

      createFakeWavFile(samplePath, duration);
    }
  });

  // Ajouter des presets si applicable
  if (packData.hasPresets) {
    const presetsPath = path.join(packPath, 'Presets');
    fs.mkdirSync(presetsPath, { recursive: true });

    console.log(`  📁 Presets/`);

    for (let i = 1; i <= (packData.presetCount || 10); i++) {
      const presetName = `${packData.name.replace(/[^a-zA-Z0-9]/g, '')}_Preset_${i.toString().padStart(3, '0')}.fxp`;
      const presetPath = path.join(presetsPath, presetName);
      createFakePresetFile(presetPath, 'fxp');
    }
  }

  // Ajouter un fichier info
  const infoPath = path.join(packPath, 'Pack Info.txt');
  const infoContent = `${packData.name}
Generated: ${new Date().toISOString()}
Total Samples: ${totalSamples}
Presets: ${packData.hasPresets ? packData.presetCount || 0 : 0}
Format: WAV 44.1kHz 16-bit
`;
  createTextFile(infoPath, infoContent);

  return totalSamples;
}

/**
 * Génère un bundle de packs
 */
function generateBundle(bundleData, basePath) {
  const bundlePath = path.join(basePath, bundleData.name);
  fs.mkdirSync(bundlePath, { recursive: true });

  console.log(`\n🎁 Génération Bundle: ${bundleData.name}`);

  let totalSamples = 0;

  bundleData.packs.forEach(pack => {
    totalSamples += generateSamplePack(pack, bundlePath);
  });

  // Ajouter fichier bundle info
  const bundleInfoPath = path.join(bundlePath, 'Bundle Info.txt');
  const bundleInfoContent = `${bundleData.name}
Generated: ${new Date().toISOString()}
Total Packs: ${bundleData.packs.length}
Total Samples: ${totalSamples}
Bundle Type: Commercial Sample Pack Bundle
`;
  createTextFile(bundleInfoPath, bundleInfoContent);

  return totalSamples;
}

/**
 * Génère un pack de presets
 */
function generatePresetPack(presetData, basePath) {
  const presetPath = path.join(basePath, presetData.name);
  fs.mkdirSync(presetPath, { recursive: true });

  console.log(`\n🎛️ Génération Preset Pack: ${presetData.name}`);

  let totalPresets = 0;

  // Créer les dossiers de presets
  presetData.folders.forEach(folder => {
    const folderPath = path.join(presetPath, folder);
    fs.mkdirSync(folderPath, { recursive: true });

    const presetCount = Math.floor(presetData.presetCount / presetData.folders.length);
    totalPresets += presetCount;

    console.log(`  📁 ${folder}/`);

    // Générer les presets
    for (let i = 1; i <= presetCount; i++) {
      const presetName = `${folder.replace(/[^a-zA-Z0-9]/g, '')}_${i.toString().padStart(3, '0')}.fxp`;
      const presetFilePath = path.join(folderPath, presetName);
      createFakePresetFile(presetFilePath, 'fxp');
    }
  });

  // Ajouter un fichier installation
  const installPath = path.join(presetPath, 'Installation Guide.txt');
  const installContent = `${presetData.name} - Installation Guide

1. Copy all .fxp files to your Serum Presets folder
2. Restart your DAW
3. Load presets from Serum browser

Total Presets: ${totalPresets}
Compatible with: Serum 1.3+
`;
  createTextFile(installPath, installContent);

  return totalPresets;
}

/**
 * Génère des fichiers divers
 */
function generateMiscFiles(basePath) {
  console.log(`\n🗂️ Génération fichiers divers`);

  MISC_FILES.forEach(fileName => {
    const filePath = path.join(basePath, fileName);

    if (fileName.endsWith('.txt')) {
      createTextFile(filePath, `This is a sample ${fileName} file generated for testing purposes.`);
    } else if (fileName.endsWith('.pdf')) {
      createBinaryFile(filePath, 100); // 100KB PDF
    } else if (fileName.endsWith('.png')) {
      createBinaryFile(filePath, 250); // 250KB image
    } else {
      // Fichiers système
      createTextFile(filePath, '');
    }
  });
}

/**
 * Fonction principale
 */
function generateTestData() {
  console.log('🚀 Génération des données de test pour Audio Organizer V6');
  console.log(`📍 Répertoire: ${TEST_ROOT}`);

  // Nettoyer et créer le répertoire de test
  if (fs.existsSync(TEST_ROOT)) {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_ROOT, { recursive: true });

  let totalSamples = 0;
  let totalPresets = 0;

  // Générer les sample packs
  SAMPLE_PACKS.forEach(pack => {
    totalSamples += generateSamplePack(pack, TEST_ROOT);
    if (pack.hasPresets) {
      totalPresets += pack.presetCount || 0;
    }
  });

  // Générer le bundle
  BUNDLE_PACKS.forEach(bundle => {
    totalSamples += generateBundle(bundle, TEST_ROOT);
  });

  // Générer le pack de presets
  totalPresets += generatePresetPack(PRESET_PACK, TEST_ROOT);

  // Générer les fichiers divers
  generateMiscFiles(TEST_ROOT);

  // Créer un fichier de résumé
  const summaryPath = path.join(TEST_ROOT, 'TEST_DATA_SUMMARY.txt');
  const summaryContent = `AUDIO ORGANIZER V6 - TEST DATA SUMMARY
Generated: ${new Date().toISOString()}

STRUCTURE:
- Sample Packs: ${SAMPLE_PACKS.length}
- Bundle Packs: ${BUNDLE_PACKS.reduce((acc, bundle) => acc + bundle.packs.length, 0)} (dans ${BUNDLE_PACKS.length} bundle)
- Preset Packs: 1
- Misc Files: ${MISC_FILES.length}

TOTALS:
- Total Packs: ${SAMPLE_PACKS.length + BUNDLE_PACKS.reduce((acc, bundle) => acc + bundle.packs.length, 0)}
- Total Samples: ${totalSamples}
- Total Presets: ${totalPresets}
- Total Files: ~${totalSamples + totalPresets + MISC_FILES.length + 10}

EXPECTED DETECTION RESULTS:
- Packs à détecter: ${SAMPLE_PACKS.length + BUNDLE_PACKS.reduce((acc, bundle) => acc + bundle.packs.length, 0) + 1}
- Samples audio: ${totalSamples}
- Presets: ${totalPresets}
- Fichiers à ignorer: ${MISC_FILES.length}

Cette structure permet de tester:
✅ Détection de packs simples
✅ Détection de bundles avec sous-packs
✅ Détection de packs de presets
✅ Gestion des fichiers non-audio
✅ Calcul des statistiques
✅ Réorganisation et nettoyage
`;

  createTextFile(summaryPath, summaryContent);

  console.log('\n🎉 Génération terminée !');
  console.log(`📊 Résumé:`);
  console.log(`   - Packs générés: ${SAMPLE_PACKS.length + BUNDLE_PACKS.reduce((acc, bundle) => acc + bundle.packs.length, 0) + 1}`);
  console.log(`   - Samples audio: ${totalSamples}`);
  console.log(`   - Presets: ${totalPresets}`);
  console.log(`   - Répertoire: ${TEST_ROOT}`);
  console.log('\n💡 Utilisation: Lancer le pipeline avec ce répertoire comme source');
}

// Lancement du script
if (require.main === module) {
  generateTestData();
}

module.exports = { generateTestData, TEST_ROOT };