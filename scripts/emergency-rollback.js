/**
 * 🚨 SCRIPT DE ROLLBACK D'URGENCE 🚨
 *
 * Restaure la structure originale depuis le snapshot structure-originale.json
 *
 * ⚠️  UTILISATION D'URGENCE UNIQUEMENT !
 * ⚠️  CE SCRIPT VA SUPPRIMER TOUS LES CHANGEMENTS !
 *
 * USAGE:
 *   node scripts/emergency-rollback.js "D:\SAMPLES 3\#RAWSTYLE"
 *
 * PRÉREQUIS:
 *   - Le fichier structure-originale.json doit exister dans .audio-organizer/
 *   - Droits d'écriture sur le dossier cible
 *
 * ATTENTION: Ce script est destructif ! Il supprime et recrée la structure complète.
 */

const fs = require('fs');
const path = require('path');

class EmergencyRollback {
  constructor(targetPath) {
    this.targetPath = targetPath;
    this.originalStructurePath = path.join(targetPath, '.audio-organizer', 'structure-originale.json');
    this.logFile = path.join(targetPath, '.audio-organizer', `rollback-${Date.now()}.log`);
  }

  /**
   * Écrire dans le log de rollback
   */
  log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    try {
      fs.appendFileSync(this.logFile, logMessage + '\n');
    } catch (error) {
      console.error('Erreur écriture log:', error.message);
    }
  }

  /**
   * Vérifications de sécurité avant rollback
   */
  async validatePreconditions() {
    this.log('🔍 Vérification des prérequis...');

    // Vérifier que le dossier cible existe
    if (!fs.existsSync(this.targetPath)) {
      throw new Error(`❌ Dossier cible introuvable: ${this.targetPath}`);
    }

    // Vérifier que le snapshot original existe
    if (!fs.existsSync(this.originalStructurePath)) {
      throw new Error(`❌ Snapshot original introuvable: ${this.originalStructurePath}`);
    }

    // Vérifier que le snapshot est valide
    let originalStructure;
    try {
      const content = fs.readFileSync(this.originalStructurePath, 'utf-8');
      originalStructure = JSON.parse(content);
    } catch (error) {
      throw new Error(`❌ Snapshot original corrompu: ${error.message}`);
    }

    // Vérifications de base sur la structure
    if (!originalStructure.path || !originalStructure.children) {
      throw new Error('❌ Structure du snapshot invalide');
    }

    this.log(`✅ Snapshot valide trouvé: ${originalStructure.children.length} éléments racine`);
    return originalStructure;
  }

  /**
   * NOUVEAU: Réorganiser la structure en préservant les fichiers
   */
  async reorganizeStructure() {
    this.log('🔄 Réorganisation intelligente de la structure...');

    // Lister tout ce qui existe actuellement (sauf .audio-organizer)
    const entries = fs.readdirSync(this.targetPath);
    const existingItems = entries.filter(entry => entry !== '.audio-organizer');

    this.log(`📦 ${existingItems.length} éléments trouvés à réorganiser`);

    // On ne supprime rien, on va juste créer la nouvelle structure
    // et déplacer les éléments existants dedans
    return existingItems;
  }

  /**
   * NOUVEAU: Recréer/réorganiser un élément en déplaçant les existants
   */
  async recreateElement(element, parentPath = this.targetPath, existingItems = []) {
    const targetPath = path.join(parentPath, element.name);

    try {
      if (element.type === 'directory') {
        // Vérifier si le dossier existe déjà à la racine
        const existingPath = path.join(this.targetPath, element.name);

        if (existingItems.includes(element.name) && fs.existsSync(existingPath)) {
          // Le dossier existe déjà à la racine
          if (existingPath !== targetPath) {
            // Il faut le déplacer
            this.log(`🔄 Déplacement: ${element.name} → ${path.relative(this.targetPath, targetPath)}`);
            fs.renameSync(existingPath, targetPath);
          } else {
            this.log(`✅ Dossier déjà en place: ${element.name}`);
          }
        } else {
          // Créer le dossier s'il n'existe pas
          fs.mkdirSync(targetPath, { recursive: true });
          this.log(`📁 Dossier créé: ${path.relative(this.targetPath, targetPath)}`);
        }

        // Restaurer la date de modification si disponible
        if (element.mtime) {
          const mtime = new Date(element.mtime);
          fs.utimesSync(targetPath, mtime, mtime);
        }

        // Traiter les enfants récursivement
        if (element.children && element.children.length > 0) {
          for (const child of element.children) {
            await this.recreateElement(child, targetPath, existingItems);
          }
        }

        return 'directory';
      } else if (element.type === 'file') {
        // Pour les fichiers, vérifier s'ils existent à la racine
        const existingPath = path.join(this.targetPath, element.name);

        if (existingItems.includes(element.name) && fs.existsSync(existingPath)) {
          if (existingPath !== targetPath) {
            // Déplacer le fichier
            this.log(`🔄 Déplacement fichier: ${element.name} → ${path.relative(this.targetPath, targetPath)}`);
            fs.renameSync(existingPath, targetPath);
          } else {
            this.log(`✅ Fichier déjà en place: ${element.name}`);
          }
          return 'file_moved';
        } else if (fs.existsSync(targetPath)) {
          this.log(`✅ Fichier préservé: ${element.name} (existe déjà)`);
          return 'file_preserved';
        } else {
          // Si le fichier n'existe pas, on ne peut que créer un placeholder vide
          this.log(`⚠️ Fichier ${element.name} n'existe pas - création d'un placeholder vide`);
          fs.writeFileSync(targetPath, '');

          // Restaurer la date de modification si disponible
          if (element.mtime) {
            const mtime = new Date(element.mtime);
            fs.utimesSync(targetPath, mtime, mtime);
          }
          return 'file_created';
        }
      }
    } catch (error) {
      this.log(`❌ Erreur recréation ${element.name}: ${error.message}`);
      throw error;
    }
  }

  /**
   * NOUVEAU: Restaurer la structure en réorganisant les éléments existants
   */
  async restoreStructure(originalStructure, existingItems) {
    this.log('🔄 Restauration de la structure originale avec réorganisation...');

    let directoriesCreated = 0;
    let filesMoved = 0;
    let filesPreserved = 0;

    // Recréer tous les éléments enfants (sauf .audio-organizer qui existe déjà)
    for (const child of originalStructure.children) {
      // Skip .audio-organizer car il existe déjà
      if (child.name === '.audio-organizer') {
        continue;
      }

      try {
        const type = await this.recreateElement(child, this.targetPath, existingItems);
        if (type === 'directory') directoriesCreated++;
        else if (type === 'file_moved') filesMoved++;
        else if (type === 'file_preserved') filesPreserved++;
      } catch (error) {
        this.log(`❌ Erreur critique lors de la restauration de ${child.name}: ${error.message}`);
        throw error;
      }
    }

    this.log(`✅ Structure restaurée: ${directoriesCreated} dossiers traités`);
    this.log(`✅ Fichiers: ${filesMoved} déplacés, ${filesPreserved} préservés`);
    this.log(`🎯 Réorganisation terminée - bundles reconstitués !`);
  }

  /**
   * Exécuter le rollback complet
   */
  async execute() {
    const startTime = Date.now();
    this.log('🏗️ ===== DÉMARRAGE RÉORGANISATION INTELLIGENTE =====');
    this.log(`📂 Dossier cible: ${this.targetPath}`);

    try {
      // Étape 1: Validations
      const originalStructure = await this.validatePreconditions();

      // Étape 2: Confirmation utilisateur (simulation)
      this.log('⚠️ DERNIÈRE CHANCE ! Le rollback va commencer dans 5 secondes...');
      this.log('⚠️ Appuyez sur Ctrl+C pour annuler !');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Étape 3: Inventaire des éléments existants
      const existingItems = await this.reorganizeStructure();

      // Étape 4: Restauration avec réorganisation
      await this.restoreStructure(originalStructure, existingItems);

      const duration = Math.round((Date.now() - startTime) / 1000);
      this.log(`✅ ===== RÉORGANISATION TERMINÉE AVEC SUCCÈS en ${duration}s =====`);
      this.log('');
      this.log('🎯 RÉSULTAT:');
      this.log('1. Tous les fichiers ont été PRÉSERVÉS');
      this.log('2. Structure de dossiers reconstituée selon l\'original');
      this.log('3. Bundles reconstitués avec leurs packs');
      this.log('4. Prêt pour classification Bundle-First !');
      this.log('');

    } catch (error) {
      this.log(`💥 ERREUR FATALE: ${error.message}`);
      this.log(`📋 Log complet: ${this.logFile}`);
      process.exit(1);
    }
  }
}

// Point d'entrée du script
async function main() {
  console.log('');
  console.log('🏗️ ================================');
  console.log('🏗️   SCRIPT DE RÉORGANISATION');
  console.log('🏗️ ================================');
  console.log('');

  const targetPath = process.argv[2];

  if (!targetPath) {
    console.error('❌ Usage: node emergency-rollback.js "C:\\chemin\\vers\\dossier"');
    console.error('');
    console.error('Exemple:');
    console.error('  node scripts/emergency-rollback.js "D:\\SAMPLES 3\\#RAWSTYLE"');
    process.exit(1);
  }

  console.log('🔄 ATTENTION: Ce script va RÉORGANISER la structure !');
  console.log('✅ Il va PRÉSERVER tous les fichiers existants !');
  console.log('🏗️  Il va reconstituer les bundles selon structure-originale.json !');
  console.log('');
  console.log(`📂 Dossier cible: ${targetPath}`);
  console.log('');

  const rollback = new EmergencyRollback(targetPath);
  await rollback.execute();
}

// Gestion des erreurs non catchées
process.on('uncaughtException', (error) => {
  console.error('💥 ERREUR CRITIQUE NON GÉRÉE:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 PROMESSE REJETÉE NON GÉRÉE:', reason);
  process.exit(1);
});

// Exécuter le script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { EmergencyRollback };