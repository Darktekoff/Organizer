/**
 * Script de vérification rapide pour le classifieur Phase 2.
 * Exécution : npx tsx scripts/debug-phase2-classifier.ts
 */

import { ClassifierV6 } from '../src/main/services/pipeline/phases/phase2-classification/ClassifierV6';
import { DEFAULT_PHASE2_CONFIG } from '../src/main/services/pipeline/phases/phase2-classification/Phase2Types';
import type { EnrichedPack, DetectedPackV6 } from '../src/shared/interfaces/BusinessTypes';

interface TestCase {
  name: string;
  tags?: string[];
  avgBPM?: number;
  hasPresets?: boolean;
  expected?: string;
}

const testCases: TestCase[] = [
  {
    name: 'Hardstyle Kicks Vol.3',
    avgBPM: 150,
    tags: ['hardstyle', 'kick'],
    expected: 'Hard Dance / Hardstyle'
  },
  {
    name: 'Future Bass Revolution',
    hasPresets: true,
    tags: ['future bass', 'serum'],
    expected: 'Bass Music / Future_Bass'
  },
  {
    name: 'Melodic Dubstep Pro',
    avgBPM: 74,
    tags: ['melodic dubstep'],
    expected: 'Bass Music / Melodic_Dubstep'
  },
  {
    name: 'Festival Anthems Construction Kits',
    tags: ['festival', 'anthem'],
    expected: 'Pop / Mainstage / Dance / Mainstage'
  }
];

function buildPack(testCase: TestCase): EnrichedPack {
  const { name, avgBPM, hasPresets = false, tags = [] } = testCase;

  const detectedPack: DetectedPackV6 = {
    name,
    originalName: name,
    path: `/virtual/${name.replace(/\s+/g, '_').toLowerCase()}`,
    type: 'COMMERCIAL_PACK',
    confidence: 1,
    reasoning: [],
    audioFiles: 80,
    presetFiles: hasPresets ? 20 : 0,
    totalFiles: hasPresets ? 100 : 80,
    totalSize: 250 * 1024 * 1024,
    structure: {
      subfolders: 5,
      depth: 2,
      hasDocumentation: false,
      hasPresets,
      isFlat: false
    },
    needsReorganization: false
  };

  return {
    packId: name,
    originalPack: detectedPack,
    fileCount: detectedPack.totalFiles,
    audioFiles: detectedPack.audioFiles,
    presetFiles: detectedPack.presetFiles,
    totalSize: detectedPack.totalSize,
    avgBPM,
    dominantKey: undefined,
    tags,
    hasLoops: true,
    hasOneShots: true,
    hasPresets,
    metadata: {
      audioFormats: ['WAV'],
      presetFormats: hasPresets ? ['serum'] : [],
      bpmRange: avgBPM ? { min: avgBPM - 2, max: avgBPM + 2 } : undefined
    }
  } as EnrichedPack;
}

async function main() {
  const classifier = new ClassifierV6(DEFAULT_PHASE2_CONFIG);
  await classifier.initialize();

  for (const testCase of testCases) {
    const pack = buildPack(testCase);
    const classification = await classifier.classifyPack(pack);

    console.log('\n▶', testCase.name);
    if (classification) {
      console.log(
        `  → ${classification.family} / ${classification.style} (confidence ${(classification.confidence * 100).toFixed(1)}%)`
      );
    } else {
      console.log('  → Aucune classification retournée');
    }

    if (testCase.expected) {
      console.log('  attendu :', testCase.expected);
    }
  }
}

main().catch(error => {
  console.error('Erreur lors du test du classifieur:', error);
  process.exitCode = 1;
});
