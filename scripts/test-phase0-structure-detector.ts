import fs from 'fs';
import path from 'path';
import { StructureBasedDetector } from '../src/main/services/pipeline/shared/detectors/StructureBasedDetector';

const args = process.argv.slice(2);
const flagSet = new Set(args.filter(arg => arg.startsWith('--')));

const debugMode = flagSet.has('--debug');
const printSubPacks = flagSet.has('--subpacks');

const snapshotArg = args.find(arg => arg.startsWith('--snapshot='));
const explicitSourceArg = args.find(arg => !arg.startsWith('--')) || undefined;

const snapshotOverride = snapshotArg ? snapshotArg.split('=')[1]?.trim() : undefined;

const candidateSources = [
  explicitSourceArg,
  '/mnt/d/SAMPLES 3/#RAWSTYLE',
  'D:/SAMPLES 3/#RAWSTYLE',
  'D:\\SAMPLES 3\\#RAWSTYLE'
].filter((maybePath): maybePath is string => Boolean(maybePath));

let sourcePath: string | undefined;
for (const candidate of candidateSources) {
  try {
    if (fs.existsSync(candidate)) {
      sourcePath = path.resolve(candidate);
      break;
    }
  } catch (error) {
    // Ignorer les erreurs d'accès
  }
}

if (!sourcePath) {
  console.error('❌ Impossible de localiser le dossier source. Spécifiez le chemin en premier argument.');
  process.exit(1);
}

const snapshotPath = snapshotOverride
  ? path.resolve(snapshotOverride)
  : path.join(sourcePath, '.audio-organizer', 'structure-originale.json');

if (!fs.existsSync(snapshotPath)) {
  console.error(`❌ Snapshot introuvable: ${snapshotPath}`);
  process.exit(1);
}

const detector = new StructureBasedDetector(undefined, debugMode);

const formatBytes = (bytes: number): string => {
  if (bytes === 0) {
    return '0 MB';
  }
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) {
    return `${gb.toFixed(2)} GB`;
  }
  const mb = bytes / (1024 ** 2);
  return `${mb.toFixed(1)} MB`;
};

async function run(): Promise<void> {
  console.log('🔍 StructureBasedDetector - test hiérarchique');
  console.log(`   Source:   ${sourcePath}`);
  console.log(`   Snapshot: ${snapshotPath}`);
  console.log(`   Debug:    ${debugMode ? 'ON' : 'OFF'}`);

  const result = await detector.execute(
    {
      sourcePath,
      snapshotPath
    },
    (progress, message) => {
      if (message) {
        console.log(`[${progress}%] ${message}`);
      }
    }
  );

  if (!result.success || !result.data) {
    console.error('❌ Détection échouée');
    if (result.error) {
      console.error(result.error);
    }
    process.exit(1);
  }

  const { detectedPacks, totalPacks, bundlesFound, analysisStats } = result.data;

  console.log('\n✅ Résumé détection');
  console.log(`   Packs commerciaux détectés: ${totalPacks}`);
  console.log(`   Bundles détectés:          ${bundlesFound}`);
  console.log(`   Sous-packs analysés:       ${analysisStats.subPacksInBundles}`);
  console.log(`   Packs individuels:         ${analysisStats.individualPacks}`);
  console.log(`   Entités niveau 1:          ${analysisStats.level1Entities}`);
  console.log(`   Faux positifs filtrés:     ${analysisStats.falsePositivesFiltered}`);

  console.log('\n📦 Détail des entités niveau 1:');
  for (const entity of detectedPacks) {
    const sizeLabel = formatBytes(entity.totalSize);
    if (entity.type === 'bundle') {
      console.log(
        ` - [BUNDLE] ${entity.name} → ${entity.subPacks?.length ?? 0} sous-packs | ${entity.audioFiles} fichiers | ${sizeLabel}`
      );
      if (printSubPacks && entity.subPacks) {
        for (const sub of entity.subPacks) {
          console.log(
            `     • ${sub.name} (${sub.audioFiles} fichiers | ${formatBytes(sub.totalSize)} | confiance ${sub.confidence})`
          );
        }
      }
    } else {
      console.log(
        ` - [PACK]   ${entity.name} (${entity.audioFiles} fichiers | ${sizeLabel} | confiance ${entity.confidence})`
      );
    }
  }
}

run().catch(error => {
  console.error('❌ Erreur inattendue lors de la détection');
  console.error(error);
  process.exit(1);
});

