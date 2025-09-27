const fs = require('fs');
const path = require('path');

const SAMPLES_DIR = '/mnt/c/SAMPLES 4';
const AUDIO_EXTENSIONS = ['.wav', '.aiff', '.flac', '.mp3', '.m4a', '.ogg'];
const PRESET_EXTENSIONS = ['.fxp', '.fxb', '.nmsv', '.vital', '.serum', '.bank', '.sbf'];

function analyzeFolder(folderPath, depth = 0) {
    const stats = {
        audioFiles: 0,
        presetFiles: 0,
        subfolders: [],
        totalSubfolders: 0,
        hasDirectAudio: false,
        hasDirectPresets: false,
        structure: []
    };

    try {
        const items = fs.readdirSync(folderPath);

        for (const item of items) {
            const itemPath = path.join(folderPath, item);
            const stat = fs.statSync(itemPath);

            if (stat.isDirectory()) {
                stats.totalSubfolders++;
                stats.subfolders.push({
                    name: item,
                    path: itemPath
                });
                stats.structure.push({
                    type: 'folder',
                    name: item,
                    depth: depth
                });
            } else if (stat.isFile()) {
                const ext = path.extname(item).toLowerCase();
                stats.structure.push({
                    type: 'file',
                    name: item,
                    extension: ext,
                    depth: depth
                });

                if (AUDIO_EXTENSIONS.includes(ext)) {
                    stats.audioFiles++;
                    if (depth === 0) stats.hasDirectAudio = true;
                } else if (PRESET_EXTENSIONS.includes(ext)) {
                    stats.presetFiles++;
                    if (depth === 0) stats.hasDirectPresets = true;
                }
            }
        }
    } catch (error) {
        console.error(`Error reading folder ${folderPath}:`, error.message);
    }

    return stats;
}

function analyzeRecursively(folderPath, maxDepth = 3) {
    const allStats = {
        totalAudioFiles: 0,
        totalPresetFiles: 0,
        folderStructure: [],
        subpackAnalysis: []
    };

    function recurse(currentPath, currentDepth) {
        if (currentDepth > maxDepth) return;

        const stats = analyzeFolder(currentPath, currentDepth);
        allStats.totalAudioFiles += stats.audioFiles;
        allStats.totalPresetFiles += stats.presetFiles;

        if (currentDepth === 0) {
            allStats.folderStructure = stats.structure;
        }

        // Analyze subfolders
        for (const subfolder of stats.subfolders) {
            const subStats = analyzeRecursively(subfolder.path, maxDepth);
            allStats.subpackAnalysis.push({
                name: subfolder.name,
                path: subfolder.path,
                depth: currentDepth + 1,
                audioFiles: subStats.totalAudioFiles,
                presetFiles: subStats.totalPresetFiles,
                hasSubfolders: subStats.subpackAnalysis.length > 0
            });
        }
    }

    recurse(folderPath, 0);
    return allStats;
}

function classifyFolder(folderName, analysis) {
    const { totalAudioFiles, totalPresetFiles, subpackAnalysis, folderStructure } = analysis;

    // Compter les sous-dossiers contenant du contenu musical significatif
    const meaningfulSubpacks = subpackAnalysis.filter(sub =>
        sub.audioFiles > 0 || sub.presetFiles > 0
    );

    // Détecter si c'est un bundle/conteneur
    if (meaningfulSubpacks.length >= 2 && (totalAudioFiles > 50 || totalPresetFiles > 10)) {
        return {
            type: 'BUNDLE/CONTENEUR',
            reason: `Contient ${meaningfulSubpacks.length} sous-packs avec contenu musical`,
            subpackCount: meaningfulSubpacks.length
        };
    }

    // Détecter si c'est un pack individuel
    if ((totalAudioFiles > 0 || totalPresetFiles > 0) && meaningfulSubpacks.length <= 1) {
        return {
            type: 'PACK INDIVIDUEL',
            reason: `Pack autonome avec contenu musical direct`,
            subpackCount: 0
        };
    }

    // Détecter si c'est un dossier d'organisation
    if (totalAudioFiles === 0 && totalPresetFiles === 0) {
        return {
            type: 'ORGANISATION FOLDER',
            reason: 'Aucun contenu musical détecté',
            subpackCount: 0
        };
    }

    // Cas ambigu - analyser plus finement
    if (meaningfulSubpacks.length > 1) {
        return {
            type: 'BUNDLE/CONTENEUR',
            reason: `Structure complexe avec ${meaningfulSubpacks.length} sous-sections`,
            subpackCount: meaningfulSubpacks.length
        };
    }

    return {
        type: 'PACK INDIVIDUEL',
        reason: 'Classification par défaut',
        subpackCount: 0
    };
}

function main() {
    console.log('=== ANALYSE COMPLETE DES DOSSIERS SAMPLES 4 ===\n');

    const results = [];
    let totalIndividualPacks = 0;
    let totalBundles = 0;
    let totalOrgFolders = 0;
    let totalDetectedSubpacks = 0;

    try {
        const folders = fs.readdirSync(SAMPLES_DIR).filter(item => {
            const itemPath = path.join(SAMPLES_DIR, item);
            return fs.statSync(itemPath).isDirectory();
        });

        console.log(`Analyse de ${folders.length} dossiers...\n`);

        for (const folder of folders) {
            const folderPath = path.join(SAMPLES_DIR, folder);
            console.log(`Analyse: ${folder}`);

            const analysis = analyzeRecursively(folderPath);
            const classification = classifyFolder(folder, analysis);

            const result = {
                name: folder,
                type: classification.type,
                reason: classification.reason,
                audioFiles: analysis.totalAudioFiles,
                presetFiles: analysis.totalPresetFiles,
                subpackCount: classification.subpackCount,
                subpacks: analysis.subpackAnalysis.filter(sub => sub.audioFiles > 0 || sub.presetFiles > 0)
            };

            results.push(result);

            // Compter par type
            switch (classification.type) {
                case 'PACK INDIVIDUEL':
                    totalIndividualPacks++;
                    break;
                case 'BUNDLE/CONTENEUR':
                    totalBundles++;
                    totalDetectedSubpacks += classification.subpackCount;
                    break;
                case 'ORGANISATION FOLDER':
                    totalOrgFolders++;
                    break;
            }

            console.log(`  → ${classification.type} (${analysis.totalAudioFiles} audio, ${analysis.totalPresetFiles} presets)`);
        }

    } catch (error) {
        console.error('Erreur lors de l\'analyse:', error.message);
        return;
    }

    // Génération du rapport final
    console.log('\n' + '='.repeat(80));
    console.log('RAPPORT FINAL - CLASSIFICATION DES PACKS');
    console.log('='.repeat(80));

    console.log(`\nSTATISTIQUES GLOBALES:`);
    console.log(`• Total dossiers analysés: ${results.length}`);
    console.log(`• PACKS INDIVIDUELS: ${totalIndividualPacks}`);
    console.log(`• BUNDLES/CONTENEURS: ${totalBundles}`);
    console.log(`• DOSSIERS D'ORGANISATION: ${totalOrgFolders}`);
    console.log(`• Sous-packs détectés dans bundles: ${totalDetectedSubpacks}`);
    console.log(`• TOTAL PACKS RÉELS ESTIMÉS: ${totalIndividualPacks + totalDetectedSubpacks}`);

    console.log(`\nDÉTAIL PAR DOSSIER:`);
    console.log('-'.repeat(80));

    // Trier par type pour le rapport
    const sortedResults = results.sort((a, b) => {
        const order = { 'PACK INDIVIDUEL': 1, 'BUNDLE/CONTENEUR': 2, 'ORGANISATION FOLDER': 3 };
        return order[a.type] - order[b.type];
    });

    for (const result of sortedResults) {
        console.log(`\n📁 ${result.name}`);
        console.log(`   Type: ${result.type}`);
        console.log(`   Audio: ${result.audioFiles} fichiers | Presets: ${result.presetFiles} fichiers`);
        console.log(`   Raison: ${result.reason}`);

        if (result.subpacks.length > 0) {
            console.log(`   Sous-packs détectés (${result.subpacks.length}):`);
            for (const subpack of result.subpacks) {
                console.log(`     - ${subpack.name} (${subpack.audioFiles} audio, ${subpack.presetFiles} presets)`);
            }
        }
    }

    console.log(`\n` + '='.repeat(80));
    console.log(`COMPARAISON AVEC L'ALGORITHME PRÉCÉDENT:`);
    console.log(`• Packs détectés par l'algo: 109`);
    console.log(`• Packs réels estimés: ${totalIndividualPacks + totalDetectedSubpacks}`);
    console.log(`• Différence: ${Math.abs(109 - (totalIndividualPacks + totalDetectedSubpacks))} packs`);

    if (109 > (totalIndividualPacks + totalDetectedSubpacks)) {
        console.log(`• L'algorithme semble sur-estimer le nombre de packs`);
    } else if (109 < (totalIndividualPacks + totalDetectedSubpacks)) {
        console.log(`• L'algorithme semble sous-estimer le nombre de packs`);
    } else {
        console.log(`• L'algorithme est précis dans son estimation`);
    }
    console.log('='.repeat(80));
}

main();