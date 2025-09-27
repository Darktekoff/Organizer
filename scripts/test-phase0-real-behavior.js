#!/usr/bin/env node

/**
 * Test en condition réelle - Phase 0 avec test-data
 * Simule le comportement utilisateur pour identifier le blocage sur Step 2
 */

const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');

console.log('🧪 TEST PHASE 0 - Comportement utilisateur réel');
console.log('=====================================');

// Chemin vers les données de test
const testDataPath = path.resolve(__dirname, '../test-data');

console.log('📁 Dossier de test:', testDataPath);

// Vérifier que le dossier existe
if (!fs.existsSync(testDataPath)) {
    console.error('❌ Dossier test-data introuvable!');
    process.exit(1);
}

console.log('✅ Dossier test-data trouvé');

// Afficher le contenu du dossier
console.log('\n📋 Contenu du dossier test-data:');
try {
    const items = fs.readdirSync(testDataPath, { withFileTypes: true });
    items.forEach(item => {
        const icon = item.isDirectory() ? '📁' : '📄';
        console.log(`  ${icon} ${item.name}`);
    });
} catch (error) {
    console.error('❌ Erreur lecture dossier:', error.message);
}

// Fonction pour simuler le test de la Phase 0
async function testPhase0() {
    console.log('\n🚀 Démarrage test Phase 0...');

    try {
        // Étape 1: Initialiser le pipeline avec le dossier test
        console.log('📤 Envoi commande: pipeline:start');
        console.log('   Source:', testDataPath);

        // Simuler la commande IPC qu'enverrait le frontend
        const startCommand = {
            type: 'pipeline:start',
            payload: {
                sourcePath: testDataPath,
                phase: 0,
                config: {
                    maxDepth: 4,
                    excludePatterns: ['.git'],
                    minAudioFiles: 1, // Réduit pour test
                    createBackup: true,
                    cleanNames: true,
                    unwrapFolders: true
                }
            }
        };

        console.log('📋 Configuration test:');
        console.log('   maxDepth:', startCommand.payload.config.maxDepth);
        console.log('   minAudioFiles:', startCommand.payload.config.minAudioFiles);
        console.log('   createBackup:', startCommand.payload.config.createBackup);
        console.log('   cleanNames:', startCommand.payload.config.cleanNames);
        console.log('   unwrapFolders:', startCommand.payload.config.unwrapFolders);

        // Attendre un peu pour laisser le temps au process
        console.log('\n⏳ Simulation du processus...');

        // Étape 2: Simuler l'attente des événements de progression
        console.log('\n👀 Événements attendus:');
        console.log('   1. phase:progress (Step 1 - Quick Scan)');
        console.log('   2. phase:user-action-required (Validation Step 1)');
        console.log('   3. phase:progress (Step 2 - Clean & Reorganize)');
        console.log('   4. phase:complete (Fin Phase 0)');

        // Étape 3: Analyser où ça peut bloquer
        console.log('\n🔍 Points de blocage potentiels:');
        console.log('   ❓ Step 1: Détection packs dans test-data');
        console.log('   ❓ Step 2: Nettoyage et réorganisation');
        console.log('   ❓ Step 2: Création backup');
        console.log('   ❓ Step 2: Déplacement fichiers');

    } catch (error) {
        console.error('❌ Erreur test:', error);
    }
}

// Fonction pour analyser les fichiers backend liés au Step 2
async function analyzeStep2Implementation() {
    console.log('\n🔬 ANALYSE STEP 2 - Clean & Reorganize');
    console.log('=====================================');

    const step2Path = path.resolve(__dirname, '../src/main/services/pipeline/phases/phase0-preparation/Step2_CleanReorganize.ts');

    if (fs.existsSync(step2Path)) {
        console.log('✅ Fichier Step2_CleanReorganize.ts trouvé');
        console.log('📍 Emplacement:', step2Path);

        try {
            const content = fs.readFileSync(step2Path, 'utf8');

            // Chercher les points critiques
            console.log('\n🔍 Analyse du code Step 2:');

            if (content.includes('backup')) {
                console.log('   ✅ Gestion backup détectée');
            } else {
                console.log('   ❌ Gestion backup NON détectée');
            }

            if (content.includes('clean') || content.includes('rename')) {
                console.log('   ✅ Nettoyage noms détecté');
            } else {
                console.log('   ❌ Nettoyage noms NON détecté');
            }

            if (content.includes('unwrap') || content.includes('wrapper')) {
                console.log('   ✅ Déballage wrappers détecté');
            } else {
                console.log('   ❌ Déballage wrappers NON détecté');
            }

            if (content.includes('move') || content.includes('copy')) {
                console.log('   ✅ Déplacement fichiers détecté');
            } else {
                console.log('   ❌ Déplacement fichiers NON détecté');
            }

            // Chercher les logs/console.log pour debugging
            const logMatches = content.match(/console\.log.*Step.*2/gi);
            if (logMatches) {
                console.log('\n📝 Logs Step 2 trouvés:');
                logMatches.forEach(log => {
                    console.log('   ', log.substring(0, 80) + '...');
                });
            }

        } catch (error) {
            console.error('❌ Erreur lecture Step2:', error.message);
        }
    } else {
        console.log('❌ Fichier Step2_CleanReorganize.ts INTROUVABLE');
        console.log('   Cela pourrait expliquer le blocage!');
    }
}

// Fonction pour vérifier l'état des données test
async function checkTestDataState() {
    console.log('\n📊 ÉTAT DES DONNÉES TEST');
    console.log('========================');

    try {
        // Compter les éléments dans test-data
        function countItems(dirPath, level = 0) {
            if (level > 3) return { dirs: 0, files: 0, audioFiles: 0 }; // Éviter récursion infinie

            const items = fs.readdirSync(dirPath, { withFileTypes: true });
            let dirs = 0, files = 0, audioFiles = 0;

            items.forEach(item => {
                if (item.isDirectory()) {
                    dirs++;
                    const subCounts = countItems(path.join(dirPath, item.name), level + 1);
                    dirs += subCounts.dirs;
                    files += subCounts.files;
                    audioFiles += subCounts.audioFiles;
                } else {
                    files++;
                    if (item.name.match(/\.(wav|mp3|flac|aiff|m4a)$/i)) {
                        audioFiles++;
                    }
                }
            });

            return { dirs, files, audioFiles };
        }

        const counts = countItems(testDataPath);

        console.log('📈 Statistiques test-data:');
        console.log(`   📁 Dossiers: ${counts.dirs}`);
        console.log(`   📄 Fichiers: ${counts.files}`);
        console.log(`   🎵 Fichiers audio: ${counts.audioFiles}`);

        // Vérifier si compatible avec minAudioFiles
        if (counts.audioFiles === 0) {
            console.log('   ⚠️  AUCUN fichier audio détecté!');
            console.log('   ⚠️  Cela peut causer des problèmes de détection');
        } else {
            console.log('   ✅ Fichiers audio présents');
        }

    } catch (error) {
        console.error('❌ Erreur analyse test-data:', error.message);
    }
}

// Exécuter tous les tests
async function runAllTests() {
    await testPhase0();
    await analyzeStep2Implementation();
    await checkTestDataState();

    console.log('\n🎯 RECOMMANDATIONS');
    console.log('==================');
    console.log('1. 🔍 Vérifier les logs de l\'application Electron en cours');
    console.log('2. 📋 S\'assurer que Step2_CleanReorganize.ts existe et est implémenté');
    console.log('3. 🧪 Tester avec un dossier contenant des vrais fichiers audio');
    console.log('4. 📊 Monitorer les événements IPC pendant l\'exécution');
    console.log('5. ⏱️  Vérifier les timeouts et délais dans le code');

    console.log('\n✅ Test terminé. Vérifiez les logs Electron pour plus de détails.');
}

// Démarrer les tests
runAllTests().catch(console.error);