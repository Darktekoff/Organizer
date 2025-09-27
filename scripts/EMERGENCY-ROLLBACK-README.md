# 🚨 SCRIPT DE ROLLBACK D'URGENCE

## ⚠️ ATTENTION - À UTILISER EN CAS D'URGENCE SEULEMENT !

Ce script restaure la structure originale de vos samples depuis le snapshot `structure-originale.json` créé lors du dernier scan.

## 🎯 Quand l'utiliser ?

- ❌ L'organisation automatique a échoué
- ❌ Des fichiers ont été déplacés au mauvais endroit
- ❌ La structure est devenue incohérente
- ❌ Vous voulez annuler complètement les changements

## ⚠️ LIMITATIONS IMPORTANTES

**🔥 CE SCRIPT NE RESTAURE QUE LA STRUCTURE, PAS LE CONTENU !**

- ✅ Recrée tous les dossiers avec les bons noms
- ✅ Restaure l'arborescence complète
- ✅ Remet les dates de modification
- ❌ **Les fichiers sont recréés VIDES !**
- ❌ **Le contenu des fichiers est PERDU !**

## 💾 Prérequis

1. **Snapshot original** : Le fichier `structure-originale.json` doit exister dans `.audio-organizer/`
2. **Node.js** : Installé et accessible via `node` command
3. **Droits d'écriture** : Permissions sur le dossier cible
4. **Sauvegarde externe** : Pour restaurer le contenu après le rollback

## 🚀 Utilisation

### Option 1: Script PowerShell (Recommandé sur Windows)

```powershell
# Depuis le dossier du projet
.\scripts\emergency-rollback.ps1 "D:\SAMPLES 3\#RAWSTYLE"
```

### Option 2: Script Node.js direct

```bash
# Depuis le dossier du projet
node scripts/emergency-rollback.js "D:\SAMPLES 3\#RAWSTYLE"
```

## 📋 Ce que fait le script

1. **Vérifications** : Snapshot valide, permissions, Node.js
2. **Nettoyage** : Supprime TOUT sauf le dossier `.audio-organizer`
3. **Restauration** : Recrée la structure depuis le snapshot
4. **Logging** : Enregistre tout dans `rollback-{timestamp}.log`

## 🔥 Étapes après rollback

1. **Vérifier** : Structure recréée correctement
2. **Restaurer** : Contenu des fichiers depuis votre sauvegarde
3. **Tester** : Quelques fichiers pour vérifier l'intégrité
4. **Nettoyer** : Supprimer les logs de rollback si tout est OK

## 📁 Fichiers créés

- `.audio-organizer/rollback-{timestamp}.log` : Log détaillé du rollback
- Structure complète recréée (fichiers vides)

## 🆘 En cas de problème

1. **Consultez les logs** : `rollback-{timestamp}.log` pour comprendre l'erreur
2. **Vérifiez les permissions** : Le script doit pouvoir écrire
3. **Snapshot corrompu** : Impossible de restaurer, il faut une sauvegarde externe
4. **Node.js manquant** : Installez Node.js et réessayez

## ⚠️ Rappels de sécurité

- 🔥 **DESTRUCTIF** : Supprime TOUT dans le dossier
- 🔥 **FICHIERS VIDES** : Le contenu n'est PAS sauvé dans le snapshot
- 🔥 **IRRÉVERSIBLE** : Une fois lancé, impossible d'annuler
- 🔥 **SAUVEGARDE REQUISE** : Ayez une sauvegarde complète pour restaurer le contenu

## 💡 Alternative moins risquée

Au lieu du rollback complet, vous pourriez :
1. Refaire un scan avec l'outil pour détecter à nouveau
2. Utiliser une sauvegarde externe (Time Machine, etc.)
3. Restaurer manuellement quelques dossiers importants

---

**🎯 En résumé : Ce script sauve la structure, pas le contenu. Utilisez-le seulement si vous avez une vraie sauvegarde pour restaurer les fichiers après !**