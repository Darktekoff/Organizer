# GPT Logs

## Étape 1 – Initialisation unique du pipeline
- Ajout d'un `sourcePath` optionnel et d'une `initialConfig` dans `PipelineV6ProviderProps`; passage du chemin depuis `App.tsx`.
- Mise en place d'une initialisation unique via `ensurePipelineInitialized` avec mémorisation et gestion d'erreurs.
- Suppression de l'appel récurrent à `pipeline:initialize` dans `executePhase` et synchronisation du chemin source côté provider.

## Étape 2 – Gestion idempotente des événements IPC
- Introduction d'un enregistreur unique `registerPipelineEventForwarders` et d'un flag `pipelineEventsRegistered` dans `src/main/main.ts`.
- Appels lors de la création/initialisation du contrôleur et remise à zéro après `cleanup` pour éviter la duplication des callbacks IPC.
- Nettoyage du handler `pipeline:initialize` en s'appuyant sur la nouvelle logique centralisée.

## Étape 3 – Centralisation des types partagés
- Déplacement de `BusinessTypes`, `PipelineTypes`, `StepContracts` et `index` vers `src/shared/interfaces`.
- Mise en place de l’alias `@shared/*` dans `tsconfig.json` et dans les configurations Vite (main, renderer, preload).
- Normalisation de tous les imports main/renderer vers `@shared/interfaces/...` pour référencer la nouvelle source unique.

## Étape 4 – Cohérence front/back sur la navigation des phases
- Facteur commun `getPhaseData`/`getCurrentPhaseData` défini en amont pour exposer les données brutes des phases.
- Correction de `continueCurrentPhase` pour utiliser les données stockées (`phase0Data`, `phaseNData`) et assurer une nouvelle initialisation via `ensurePipelineInitialized`.
- Passage explicite des données brutes au workflow (`phaseData.data`) afin que les composants PhaseX disposent des résultats backend sans casser la chaîne IPC.

## Étape 5 – Vérification
- Tentative `npm run lint` (échec environnement: "UtilBindVsockAnyPort: socket failed 1"), aucune autre vérification possible dans ce contexte.
- Tentative `npx tsc --noEmit` (échec environnement: "UtilBindVsockAnyPort: socket failed 1").
- Ajout des déclarations globales (constantes Vite + `window.electronAPI`) via `src/types/global.d.ts` et typage partagé `ElectronAPI`.
- Harmonisation du preload et suppression des anciennes déclarations inline ; correction des imports résiduels (`PackDetectorV6`).
- Alignement des types partagés (Phase1/2/3) avec les structures réellement renvoyées : déplacement des définitions (FileEntry, DuplicateGroup, ClassificationMethod, etc.) vers `@shared/interfaces` et adaptation des contrôleurs.
- Réécriture simplifiée des composants Phase0–Phase5 pour une UI cohérente avec les nouveaux types (suppression des anciens hooks complexes).
- Corrections diverses backend (helpers Phase2Data, Phase3Controller) pour fournir aux phases suivantes les données attendues.
- Exécution `./node_modules/.bin/tsc --noEmit` validée : 0 erreur TypeScript restante.
