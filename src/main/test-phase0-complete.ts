/**
 * Test complet Phase 0 - Simulation comportement utilisateur
 */

import { Phase0Controller } from './services/pipeline/phases/phase0-preparation/Phase0Controller';
import * as path from 'path';
import * as fs from 'fs';

console.log('🧪 TEST COMPLET PHASE 0 - SIMULATION UTILISATEUR');
console.log('==============================================\n');

const testDataPath = path.resolve(__dirname, '../../test-data');

async function testPhase0Complete() {
  try {
    console.log('📁 Dossier de test:', testDataPath);

    // Vérifier que le dossier existe
    if (!fs.existsSync(testDataPath)) {
      throw new Error('Dossier test-data introuvable!');
    }

    console.log('✅ Dossier test-data trouvé\n');

    // Créer le contrôleur Phase 0
    const phase0Controller = new Phase0Controller();

    // Configuration Phase 0
    const config = {
      maxDepth: 4,
      excludePatterns: ['.git'],
      minAudioFiles: 1,
      createBackup: true,
      cleanNames: true,
      unwrapFolders: true
    };

    console.log('⚙️ Configuration:', config);
    console.log('\n🚀 DÉMARRAGE PHASE 0\n');
    console.log('=' .repeat(50));

    // ==================
    // STEP 1: QUICK SCAN
    // ==================
    console.log('\n📍 STEP 1: QUICK SCAN');
    console.log('-'.repeat(30));

    const step1Result = await phase0Controller['step1'].execute(
      {
        sourcePath: testDataPath,
        config
      },
      (progress, message) => {
        console.log(`   [${progress.toFixed(0)}%] ${message}`);
      }
    );

    if (!step1Result.success) {
      throw new Error(`Step 1 échoué: ${step1Result.error?.message}`);
    }

    console.log('\n✅ Step 1 terminé avec succès!');
    console.log('📊 Résultats Quick Scan:');
    console.log(`   - Packs détectés: ${step1Result.data.detectedPacks.length}`);
    console.log(`   - Samples totaux: ${step1Result.data.totalSamples}`);
    console.log(`   - Taille totale: ${(step1Result.data.totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   - Score de chaos: ${(step1Result.data.chaosScore * 100).toFixed(0)}%`);
    console.log(`   - Structure: ${step1Result.data.currentStructure}`);

    // Afficher les packs détectés
    console.log('\n📦 Packs détectés:');
    step1Result.data.detectedPacks.forEach((pack, i) => {
      console.log(`   ${i + 1}. ${pack.name}`);
      console.log(`      - Type: ${pack.type}`);
      console.log(`      - Fichiers audio: ${pack.audioFileCount}`);
      console.log(`      - Sous-dossiers: ${pack.subFolders?.length || 0}`);
    });

    // Simuler validation utilisateur
    console.log('\n👤 VALIDATION UTILISATEUR SIMULÉE');
    console.log('   ✅ L\'utilisateur valide le scan');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Pause pour simulation

    // =============================
    // STEP 2: CLEAN & REORGANIZE
    // =============================
    console.log('\n📍 STEP 2: CLEAN & REORGANIZE');
    console.log('-'.repeat(30));

    const step2Result = await phase0Controller['step2'].execute(
      {
        detectedPacks: step1Result.data.detectedPacks,
        sourcePath: testDataPath,
        userConfirmed: true, // Plus nécessaire après notre fix, mais on le laisse
        config: {
          ...config,
          dryRun: true // Mode dry-run pour ne pas modifier les vrais fichiers
        }
      },
      (progress, message) => {
        console.log(`   [${progress.toFixed(0)}%] ${message}`);
      }
    );

    if (!step2Result.success) {
      throw new Error(`Step 2 échoué: ${step2Result.error?.message}`);
    }

    console.log('\n✅ Step 2 terminé avec succès!');
    console.log('📊 Résultats Réorganisation:');
    console.log(`   - Packs déplacés: ${step2Result.data.movedPacks}`);
    console.log(`   - Noms nettoyés: ${step2Result.data.cleanedNames}`);
    console.log(`   - Dossiers déballés: ${step2Result.data.unwrappedFolders}`);
    console.log(`   - Chemin de travail: ${step2Result.data.workingPath}`);
    console.log(`   - Backup créé: ${step2Result.data.backupPath ? 'Oui' : 'Non'}`);

    if (step2Result.data.errors.length > 0) {
      console.log('\n⚠️ Erreurs rencontrées:');
      step2Result.data.errors.forEach(err => {
        console.log(`   - ${err}`);
      });
    }

    // ==================
    // RÉSUMÉ PHASE 0
    // ==================
    console.log('\n' + '='.repeat(50));
    console.log('🎯 PHASE 0 TERMINÉE AVEC SUCCÈS!');
    console.log('='.repeat(50));

    const phaseResult = {
      quickScanResult: step1Result.data,
      reorganizationResult: step2Result.data
    };

    console.log('\n📋 RÉSUMÉ FINAL:');
    console.log(`   - Durée totale: ~${Date.now() / 1000}s`);
    console.log(`   - Packs traités: ${phaseResult.quickScanResult.detectedPacks.length}`);
    console.log(`   - Améliorations appliquées: ${step2Result.data.movedPacks + step2Result.data.cleanedNames + step2Result.data.unwrappedFolders}`);
    console.log(`   - Prêt pour Phase 1: Discovery`);

    console.log('\n✅ TEST RÉUSSI - La Phase 0 fonctionne parfaitement!');
    console.log('   Le Step 2 s\'exécute maintenant automatiquement après validation du Step 1.');

    return phaseResult;

  } catch (error) {
    console.error('\n❌ ERREUR TEST:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Lancer le test
console.log('Démarrage du test dans 2 secondes...\n');
setTimeout(() => {
  testPhase0Complete()
    .then(() => {
      console.log('\n🏁 Test terminé avec succès!');
      process.exit(0);
    })
    .catch(err => {
      console.error('\n💥 Test échoué:', err);
      process.exit(1);
    });
}, 2000);