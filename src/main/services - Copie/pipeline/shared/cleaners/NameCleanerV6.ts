/**
 * NAME CLEANER V6 - Copié et adapté de Pipeline V5
 * Module pour nettoyer les noms de dossiers de packs
 * GARDE : Toute la logique de nettoyage (sans GPT)
 * ENLÈVE : Intégration GPT
 */

export interface NameCleaningResult {
  originalName: string;
  cleanedName: string;
  transformationsApplied: string[];
}

export class NameCleanerV6 {

  /**
   * Nettoie le nom d'un dossier de niveau 1
   * Garde uniquement: Label/Artiste - Nom du pack (Vol. X)
   * Supprime tous les tags techniques et metadata superflus
   */
  static cleanLevel1FolderName(folderName: string): NameCleaningResult {
    const transformations: string[] = [];
    let cleaned = folderName;
    const original = folderName;

    // 1. Supprimer les tags de scene/release
    const sceneTagsPattern = /\(SCENE\)-[A-Z0-9]+|-[A-Z0-9]{3,}$/gi;
    if (sceneTagsPattern.test(cleaned)) {
      cleaned = cleaned.replace(sceneTagsPattern, '');
      transformations.push('scene/release tags removed');
    }

    // 2. Remplacer les underscores par des espaces AVANT de supprimer les tags
    if (cleaned.includes('_')) {
      cleaned = cleaned.replace(/_/g, ' ');
      transformations.push('underscores → spaces');
    }

    // 3. Remplacer les points par des espaces (sauf pour les extensions et volumes)
    const dotPattern = /\.(?!WAV|AIFF|MP3|FLAC|REX|RMX|\d+$)/gi;
    if (dotPattern.test(cleaned)) {
      cleaned = cleaned.replace(dotPattern, ' ');
      transformations.push('dots → spaces');
    }

    // 4. Supprimer les tags techniques courants (après conversion des séparateurs)
    const technicalTagsPattern = /\b(MULTiFORMAT|MULTIFORMAT|WAV|AIFF|24BIT|16BIT|44KHZ|48KHZ|96KHZ|STEMS|UNMIXED|MIXED|MASTERED|FLAC|MP3)\b/gi;
    if (technicalTagsPattern.test(cleaned)) {
      cleaned = cleaned.replace(technicalTagsPattern, '');
      transformations.push('technical tags removed');
    }

    // 5. Supprimer les parenthèses vides et autres résidus
    cleaned = cleaned.replace(/\(\s*\)/g, '');
    cleaned = cleaned.replace(/\[\s*\]/g, '');

    // 6. Supprimer les points isolés et en fin de chaîne
    cleaned = cleaned.replace(/\s*\.\s*$/g, ''); // Points en fin
    cleaned = cleaned.replace(/\s+\.\s+/g, ' '); // Points isolés

    // 7. Nettoyer les espaces multiples
    if (/\s{2,}/.test(cleaned)) {
      cleaned = cleaned.replace(/\s{2,}/g, ' ');
      transformations.push('multiple spaces → single space');
    }

    // 8. Nettoyer les espaces en début/fin et autour des tirets
    cleaned = cleaned.replace(/\s*-\s*/g, ' - ');
    const trimmed = cleaned.trim();
    if (trimmed !== cleaned) {
      cleaned = trimmed;
      transformations.push('spaces normalized');
    }

    return {
      originalName: original,
      cleanedName: cleaned,
      transformationsApplied: transformations
    };
  }

  /**
   * Nettoie une liste de noms de dossiers
   */
  static cleanFolderNames(folderNames: string[]): NameCleaningResult[] {
    return folderNames.map(name => this.cleanLevel1FolderName(name));
  }

  /**
   * Test du module sur des exemples variés
   */
  static testCleaning(): void {
    const testCases = [
      // Tags de scene
      'Deep.Data.Loops.Funky.Bass.(SCENE)-DISCOVER',
      'Production.Master.Heavy.Duty.Jump.Up.3.(SCENE)-DISCOVER',
      'Artist.Name.Pack.Title-AUDIOSTR',
      
      // Tags techniques
      'Sample.Pack.Name.MULTiFORMAT',
      'Artist_Pack_Name_WAV_24BIT',
      'Producer - Track Collection STEMS UNMIXED',
      
      // Underscores et points
      'DougWamble_AcousticGuitar',
      'Image_Sounds_Acoustic_Guitar_1',
      'Techno_Room',
      'The_Art_Of_Psytrance_2',
      
      // Formats mixtes complexes
      'Label.Artist.Pack.Name.MULTiFORMAT.(SCENE)-DISCOVER',
      'Producer_Name_Pack_Title_WAV_STEMS-AUDIOSTR',
      
      // Déjà propres
      'Black Octopus Sound - Riddim Trap Evolution',
      'Fyloh - HUGE HARD DANCE KICKS PACK',
      'Soundsmiths Tokyo Nights Kawaii Future Bass',
      'Samples Test'
    ];

    console.log('🧪 NAME CLEANER TEST\n');
    console.log('='.repeat(80));

    testCases.forEach(testCase => {
      const result = this.cleanLevel1FolderName(testCase);
      
      console.log(`📁 Original: "${result.originalName}"`);
      console.log(`✨ Cleaned:  "${result.cleanedName}"`);
      
      if (result.transformationsApplied.length > 0) {
        console.log(`🔧 Applied:  ${result.transformationsApplied.join(', ')}`);
      } else {
        console.log(`✅ No change needed`);
      }
      
      console.log('-'.repeat(60));
    });

    console.log('\n🎉 NAME CLEANER TEST COMPLETE!');
  }
  
  /**
   * Nettoie un seul nom (méthode utilitaire pour V6)
   */
  static cleanSingleName(name: string): string {
    return this.cleanLevel1FolderName(name).cleanedName;
  }
  
}