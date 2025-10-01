#!/usr/bin/env node

/**
 * Script de génération de données de test pour Audio Organizer V6
 * Crée une structure réaliste de packs de samples avec différents formats et organisations
 */

const fs = require('fs');
const path = require('path');

// Configuration de base
const TEST_ROOT = path.join(__dirname, '..', 'test-data');

// Données de test réalistes - Vrais noms de packs commerciaux
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
  },
  // 5 packs supplémentaires avec noms réalistes
  {
    name: "Splice Sounds - Oliver Power Tools",
    type: "pack",
    folders: ["808s", "Kicks", "Snares", "Hi-Hats", "Percussion", "Melodic Loops", "Vocal Chops"],
    samplesPerFolder: [12, 15, 14, 18, 10, 8, 6],
    hasPresets: false
  },
  {
    name: "KSHMR Essentials",
    type: "pack",
    folders: ["Kicks", "Claps & Snares", "Percussion", "FX", "Orchestral", "Ethnic Instruments", "Vocal Samples"],
    samplesPerFolder: [20, 18, 22, 25, 12, 15, 8],
    hasPresets: true,
    presetCount: 64
  },
  {
    name: "Cymatics - Eternity Melodic Sample Pack",
    type: "pack",
    folders: ["Melodies", "Chords", "Arps", "Pads", "Leads", "808s", "Drums", "FX"],
    samplesPerFolder: [15, 12, 10, 8, 8, 6, 18, 10],
    hasPresets: true,
    presetCount: 32
  },
  {
    name: "Black Octopus Sound - Leviathan 4",
    type: "pack",
    folders: ["Bass Loops", "Drum Loops", "Melodic Loops", "One Shots/Bass", "One Shots/Drums", "Presets/Serum", "Presets/Massive"],
    samplesPerFolder: [20, 25, 18, 30, 40, 0, 0],
    hasPresets: true,
    presetCount: 100
  },
  {
    name: "Production Master - Hardstyle Ultra Pack",
    type: "pack",
    folders: ["Kicks/Raw", "Kicks/Euphoric", "Kicks/Reverse Bass", "Leads", "Screeches", "FX/Impacts", "FX/Risers", "Construction Kits"],
    samplesPerFolder: [15, 12, 10, 8, 12, 18, 15, 6],
    hasPresets: true,
    presetCount: 45
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
      },
      {
        name: "Rawstyle Essentials Complete",
        folders: ["Kicks/Extra Raw", "Kicks/Mid-Intro", "Leads/Screech", "FX/Impacts"],
        samplesPerFolder: [25, 20, 15, 30]
      }
    ]
  },
  // 3 bundles supplémentaires avec 5 packs chacun
  {
    name: "Vengeance Producer Suite Complete",
    type: "bundle",
    packs: [
      {
        name: "Vengeance Essential House Vol.1",
        folders: ["Kicks", "Claps", "Hats", "Percussion", "Bass Loops", "Synth Loops"],
        samplesPerFolder: [15, 10, 18, 12, 8, 6]
      },
      {
        name: "Vengeance Dirty Electro Vol.3",
        folders: ["Basslines", "Beats", "Effects", "Synths", "Vocals"],
        samplesPerFolder: [12, 14, 20, 16, 5]
      },
      {
        name: "Vengeance EDM Essentials Vol.2",
        folders: ["Drops", "Builds", "Kicks", "Leads", "Plucks", "FX"],
        samplesPerFolder: [6, 8, 12, 10, 8, 15]
      },
      {
        name: "Vengeance Future House Vol.1",
        folders: ["Bass Loops", "Drum Loops", "Melodic Loops", "One Shots", "Presets"],
        samplesPerFolder: [10, 12, 8, 20, 0]
      },
      {
        name: "Vengeance Trap Essentials Vol.2",
        folders: ["808s", "Hi-Hats", "Snares", "Vocals", "Melodies"],
        samplesPerFolder: [10, 18, 12, 6, 8]
      }
    ]
  },
  {
    name: "Native Instruments Complete Collection 14",
    type: "bundle",
    packs: [
      {
        name: "Maschine Factory Library",
        folders: ["Drums/Acoustic", "Drums/Electronic", "Instruments", "Effects", "Vocals"],
        samplesPerFolder: [25, 35, 20, 15, 10]
      },
      {
        name: "Battery 4 Factory Library",
        folders: ["Acoustic Kits", "Electronic Kits", "Percussion", "FX Kits", "Vintage Kits"],
        samplesPerFolder: [18, 22, 15, 10, 12]
      },
      {
        name: "Kontakt Factory Library",
        folders: ["Orchestral", "Band", "Synth", "World", "Vintage", "Choir"],
        samplesPerFolder: [20, 15, 18, 12, 10, 8]
      },
      {
        name: "Reaktor Factory Library",
        folders: ["Synths", "Drums", "Effects", "Sequenced", "Granular"],
        samplesPerFolder: [18, 15, 12, 10, 8]
      },
      {
        name: "Massive X Expansions",
        folders: ["Bass Presets", "Lead Presets", "Pad Presets", "Pluck Presets", "FX Presets"],
        samplesPerFolder: [0, 0, 0, 0, 0],
        hasPresets: true,
        presetCount: 80
      }
    ]
  },
  {
    name: "Loopmasters Complete Bundle 2024",
    type: "bundle",
    packs: [
      {
        name: "Drum & Bass Ultra Pack",
        folders: ["Breaks", "Bass Loops", "Pad Loops", "Drums/Kicks", "Drums/Snares", "Drums/Hats"],
        samplesPerFolder: [15, 18, 10, 12, 12, 20]
      },
      {
        name: "Tech House Essentials",
        folders: ["Drum Loops", "Bass Loops", "Percussion Loops", "Synth Loops", "Vocal Loops", "FX"],
        samplesPerFolder: [18, 15, 18, 12, 8, 15]
      },
      {
        name: "Ambient & Chill Collection",
        folders: ["Atmospheres", "Textures", "Field Recordings", "Drones", "Melodic Elements"],
        samplesPerFolder: [10, 12, 8, 7, 15]
      },
      {
        name: "Hip Hop Producer Toolkit",
        folders: ["Beats", "808s", "Hi-Hats", "Snares", "Vocals", "Melodies", "Vinyl FX"],
        samplesPerFolder: [16, 14, 20, 14, 10, 12, 8]
      },
      {
        name: "Psytrance Revolution",
        folders: ["Bass Loops", "Lead Loops", "FX Loops", "Kicks", "Percussion", "Atmospheres"],
        samplesPerFolder: [12, 11, 14, 10, 16, 8]
      }
    ]
  },
  {
    name: "Splice Originals Complete Bundle",
    type: "bundle",
    packs: [
      {
        name: "Splice Originals - Afrobeat Rhythms",
        folders: ["Percussion", "Drums", "Melodic Loops", "Vocals", "One Shots"],
        samplesPerFolder: [18, 14, 11, 8, 25]
      },
      {
        name: "Splice Originals - String Theory",
        folders: ["Violin", "Viola", "Cello", "Double Bass", "Ensemble", "Processed"],
        samplesPerFolder: [12, 10, 11, 8, 14, 16]
      },
      {
        name: "Splice Originals - Jazz Vibes",
        folders: ["Piano", "Bass", "Drums", "Horns", "Guitar", "Vocals"],
        samplesPerFolder: [14, 12, 16, 10, 11, 6]
      },
      {
        name: "Splice Originals - Garage & 2-Step",
        folders: ["Drum Loops", "Bass Loops", "Chord Loops", "Vocal Chops", "FX", "One Shots"],
        samplesPerFolder: [15, 13, 10, 12, 11, 22]
      },
      {
        name: "Splice Originals - Brazilian Funk",
        folders: ["Beats", "Percussion", "Bass", "Melodies", "Vocals", "FX"],
        samplesPerFolder: [14, 20, 10, 8, 7, 12]
      }
    ]
  }
];

// Plusieurs packs de presets
const PRESET_PACKS = [
  {
    name: "Serum Presets - Melodic Dubstep Pro",
    type: "presets",
    presetCount: 156,
    folders: ["Basses", "Leads", "Plucks", "Pads", "FX"]
  },
  {
    name: "Sylenth1 - Trance Essentials",
    type: "presets",
    presetCount: 128,
    folders: ["Leads", "Pads", "Plucks", "Arps", "Basses", "FX"]
  },
  {
    name: "Spire - Future Bass Toolkit",
    type: "presets",
    presetCount: 200,
    folders: ["Chords", "Leads", "Basses", "Plucks", "Arps", "Pads", "FX"]
  }
];

const MISC_FILES = [
  "Sample Pack Cover.png",
  "ReadMe.txt",
  "License Agreement.pdf",
  ".DS_Store",
  "Thumbs.db"
];

/**
 * Crée un fichier WAV factice avec taille raisonnable pour tests
 */
function createFakeWavFile(filePath, durationSeconds = 3) {
  // Créer des fichiers un peu plus gros pour que les bundles soient détectés
  // Mais pas trop gros pour rester rapide
  const sampleRate = 44100;
  const bitDepth = 16;
  const channels = 2;

  // Simuler ~500KB par fichier pour que les bundles atteignent quelques MB
  const targetSize = 500 * 1024; // 500 KB
  const headerSize = 44;
  const dataSize = targetSize - headerSize;

  const buffer = Buffer.alloc(targetSize);

  // Header WAV valide
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(targetSize - 8, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Chunk size
  buffer.writeUInt16LE(1, 20);  // Audio format (PCM)
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * (bitDepth / 8), 28); // Byte rate
  buffer.writeUInt16LE(channels * (bitDepth / 8), 32); // Block align
  buffer.writeUInt16LE(bitDepth, 34); // Bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Remplir avec des données aléatoires simples (pas besoin de vrai audio)
  for (let i = headerSize; i < targetSize; i += 100) {
    buffer[i] = Math.floor(Math.random() * 256);
  }

  fs.writeFileSync(filePath, buffer);
  // Pas de console.log pour chaque fichier pour accélérer
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

  // Pas de console.log pour chaque preset pour accélérer
}

/**
 * Crée un fichier texte factice
 */
function createTextFile(filePath, content) {
  fs.writeFileSync(filePath, content);
  // Pas de console.log pour chaque fichier pour accélérer
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
  // Pas de console.log pour chaque fichier pour accélérer
}

/**
 * Génère un sample pack
 */
function generateSamplePack(packData, basePath) {
  const packPath = path.join(basePath, packData.name);
  fs.mkdirSync(packPath, { recursive: true });

  console.log(`\n📦 ${packData.name}`);
  process.stdout.write('   Création: ');

  let totalSamples = 0;
  let filesCreated = 0;

  // Créer les dossiers et samples
  packData.folders.forEach((folder, index) => {
    const folderPath = path.join(packPath, folder);
    fs.mkdirSync(folderPath, { recursive: true });

    const sampleCount = packData.samplesPerFolder[index] || 10;
    totalSamples += sampleCount;

    // Générer les samples
    for (let i = 1; i <= sampleCount; i++) {
      const sampleName = `${folder.replace(/[^a-zA-Z0-9]/g, '')}_${i.toString().padStart(2, '0')}.wav`;
      const samplePath = path.join(folderPath, sampleName);

      createFakeWavFile(samplePath);
      filesCreated++;

      // Afficher progression
      if (filesCreated % 20 === 0) {
        process.stdout.write('.');
      }
    }
  });

  // Ajouter des presets si applicable
  if (packData.hasPresets) {
    const presetsPath = path.join(packPath, 'Presets');
    fs.mkdirSync(presetsPath, { recursive: true });

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

  console.log(` ✓ (${totalSamples} samples${packData.hasPresets ? ', ' + (packData.presetCount || 0) + ' presets' : ''})`);

  return totalSamples;
}

/**
 * Génère un bundle de packs
 */
function generateBundle(bundleData, basePath) {
  const bundlePath = path.join(basePath, bundleData.name);
  fs.mkdirSync(bundlePath, { recursive: true });

  console.log(`\n🎁 Bundle: ${bundleData.name}`);

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

  console.log(`\n🎛️ ${presetData.name}`);
  process.stdout.write('   Création: ');

  let totalPresets = 0;

  // Créer les dossiers de presets
  presetData.folders.forEach(folder => {
    const folderPath = path.join(presetPath, folder);
    fs.mkdirSync(folderPath, { recursive: true });

    const presetCount = Math.floor(presetData.presetCount / presetData.folders.length);
    totalPresets += presetCount;

    // Générer les presets
    for (let i = 1; i <= presetCount; i++) {
      const presetName = `${folder.replace(/[^a-zA-Z0-9]/g, '')}_${i.toString().padStart(3, '0')}.fxp`;
      const presetFilePath = path.join(folderPath, presetName);
      createFakePresetFile(presetFilePath, 'fxp');

      if (totalPresets % 20 === 0) {
        process.stdout.write('.');
      }
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

  console.log(` ✓ (${totalPresets} presets)`);

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

  // Générer les bundles
  BUNDLE_PACKS.forEach(bundle => {
    totalSamples += generateBundle(bundle, TEST_ROOT);
  });

  // Générer les packs de presets
  PRESET_PACKS.forEach(presetPack => {
    totalPresets += generatePresetPack(presetPack, TEST_ROOT);
  });

  // Générer les fichiers divers
  generateMiscFiles(TEST_ROOT);

  // Créer un fichier de résumé
  const summaryPath = path.join(TEST_ROOT, 'TEST_DATA_SUMMARY.txt');
  const totalBundlePacks = BUNDLE_PACKS.reduce((acc, bundle) => acc + bundle.packs.length, 0);
  const summaryContent = `AUDIO ORGANIZER V6 - TEST DATA SUMMARY
Generated: ${new Date().toISOString()}

STRUCTURE:
- Sample Packs à la racine: ${SAMPLE_PACKS.length}
- Bundles: ${BUNDLE_PACKS.length}
- Packs dans les bundles: ${totalBundlePacks}
- Preset Packs: ${PRESET_PACKS.length}
- Misc Files: ${MISC_FILES.length}

TOTALS:
- Total Packs: ${SAMPLE_PACKS.length + totalBundlePacks + PRESET_PACKS.length}
- Total Samples: ${totalSamples}
- Total Presets: ${totalPresets}
- Total Files: ~${totalSamples + totalPresets + MISC_FILES.length + 10}

EXPECTED DETECTION RESULTS:
- Packs à détecter: ${SAMPLE_PACKS.length + totalBundlePacks + PRESET_PACKS.length}
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
  console.log(`   - Packs à la racine: ${SAMPLE_PACKS.length}`);
  console.log(`   - Bundles: ${BUNDLE_PACKS.length} (contenant ${totalBundlePacks} packs)`);
  console.log(`   - Packs de presets: ${PRESET_PACKS.length}`);
  console.log(`   - Total packs: ${SAMPLE_PACKS.length + totalBundlePacks + PRESET_PACKS.length}`);
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