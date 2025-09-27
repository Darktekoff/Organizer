# 🚨 SCRIPT DE ROLLBACK D'URGENCE - VERSION POWERSHELL 🚨
#
# Restaure la structure originale depuis le snapshot structure-originale.json
#
# ⚠️  UTILISATION D'URGENCE UNIQUEMENT !
# ⚠️  CE SCRIPT VA SUPPRIMER TOUS LES CHANGEMENTS !
#
# USAGE:
#   .\scripts\emergency-rollback.ps1 "D:\SAMPLES 3\#RAWSTYLE"
#
# PRÉREQUIS:
#   - Le fichier structure-originale.json doit exister dans .audio-organizer\
#   - Droits d'écriture sur le dossier cible
#   - Node.js installé

param(
    [Parameter(Mandatory=$true)]
    [string]$TargetPath
)

Write-Host ""
Write-Host "🚨 ================================" -ForegroundColor Red
Write-Host "🚨   SCRIPT DE ROLLBACK D'URGENCE" -ForegroundColor Red
Write-Host "🚨 ================================" -ForegroundColor Red
Write-Host ""

Write-Host "⚠️  ATTENTION: Ce script est DESTRUCTIF !" -ForegroundColor Yellow
Write-Host "⚠️  Il va SUPPRIMER tous les changements effectués !" -ForegroundColor Yellow
Write-Host "⚠️  Les fichiers seront recréés VIDES !" -ForegroundColor Yellow
Write-Host ""
Write-Host "📂 Dossier cible: $TargetPath" -ForegroundColor Cyan
Write-Host ""

# Vérifications préliminaires
if (-not (Test-Path $TargetPath)) {
    Write-Host "❌ Erreur: Le dossier cible n'existe pas: $TargetPath" -ForegroundColor Red
    exit 1
}

$snapshotPath = Join-Path $TargetPath ".audio-organizer\structure-originale.json"
if (-not (Test-Path $snapshotPath)) {
    Write-Host "❌ Erreur: Snapshot original introuvable: $snapshotPath" -ForegroundColor Red
    Write-Host "💡 Le système doit avoir créé ce fichier lors du dernier scan." -ForegroundColor Yellow
    exit 1
}

# Vérifier que Node.js est disponible
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js détecté: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur: Node.js non trouvé. Veuillez l'installer." -ForegroundColor Red
    exit 1
}

# Confirmation utilisateur
Write-Host "🔥 CONFIRMATION REQUISE:" -ForegroundColor Yellow
Write-Host "Êtes-vous SÛR de vouloir restaurer la structure originale ?" -ForegroundColor Yellow
Write-Host "Cela va SUPPRIMER toute l'organisation effectuée !" -ForegroundColor Yellow
Write-Host ""
$confirmation = Read-Host "Tapez 'OUI' en majuscules pour confirmer"

if ($confirmation -ne "OUI") {
    Write-Host "❌ Rollback annulé par l'utilisateur." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "🚀 Lancement du rollback..." -ForegroundColor Yellow

# Récupérer le chemin du script Node.js
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodeScript = Join-Path $scriptDir "emergency-rollback.js"

if (-not (Test-Path $nodeScript)) {
    Write-Host "❌ Erreur: Script Node.js introuvable: $nodeScript" -ForegroundColor Red
    exit 1
}

# Exécuter le rollback Node.js
try {
    & node $nodeScript $TargetPath
    $exitCode = $LASTEXITCODE

    if ($exitCode -eq 0) {
        Write-Host ""
        Write-Host "✅ ROLLBACK TERMINÉ AVEC SUCCÈS !" -ForegroundColor Green
        Write-Host ""
        Write-Host "🔥 ACTIONS REQUISES:" -ForegroundColor Yellow
        Write-Host "1. Les fichiers ont été recréés VIDES" -ForegroundColor Yellow
        Write-Host "2. Restaurez le CONTENU depuis votre sauvegarde complète" -ForegroundColor Yellow
        Write-Host "3. Vérifiez l'intégrité de vos données" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "📋 Consultez les logs dans: $TargetPath\.audio-organizer\" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Le rollback a échoué avec le code d'erreur: $exitCode" -ForegroundColor Red
        exit $exitCode
    }
} catch {
    Write-Host "💥 Erreur lors de l'exécution du rollback: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Attendre avant fermeture
Write-Host ""
Write-Host "Appuyez sur une touche pour fermer..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")