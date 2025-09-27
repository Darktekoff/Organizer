# Plan de correction Pipeline V6

## Objectifs généraux
- Assurer une initialisation fiable du pipeline côté main et renderer.
- Synchroniser les structures de données transmises entre backend (Phase0–Phase5) et les composants UI.
- Nettoyer l’API exposée par le preload pour éviter les appels inexistants ou incohérents.
- Prévenir les doublons d’événements IPC et renforcer la reprise de phases.

## Étapes priorisées
1. **Initialisation et passage du chemin source**
   - Mettre à jour `PipelineV6ProviderProps` pour accepter `initialConfig` et un `sourcePath` optionnel par défaut.
   - Passer `sourcePath` depuis `App.tsx` au provider, et stocker la valeur dans l’état dès le montage.
   - Appeler `pipeline:initialize` une seule fois (effet `useEffect` dédié) et empêcher les réinitialisations multiples.

2. **Assainissement des événements IPC**
   - Déplacer l’inscription des listeners `pipelineController.on(...)` dans `initializePipeline` ou un utilitaire idempotent côté main.
   - Ajouter un mécanisme de nettoyage (`off` ou guard) pour éviter les doublons lorsque `pipeline:initialize` est relancé.

3. **Harmonisation des types partagés**
   - Déplacer les interfaces (`PhaseXData`, `PipelineError`, etc.) dans `src/shared/interfaces` accessibles au renderer.
   - Corriger tous les imports (`../../../pipeline-v6/backend/...`) pour pointer vers ce nouveau dossier partagé.
   - Mettre à jour les déclarations globales du preload pour inclure `initialize`, `continuePhase`, `getState`.

4. **Adaptation des données côté UI**
   - Dans `PipelineV6Provider`, mapper les résultats backend (`deepAnalysisResult`, `indexingResult`, etc.) vers les clés attendues par les PhaseUI ou, inversement, refactorer chaque PhaseUI pour consommer les véritables clés `PhaseXData`.
   - Remplacer l’accès `phaseData?.data` par l’utilisation directe des `PhaseXData` typés.
   - Corriger la logique de reprise (`continueCurrentPhase`) afin d’utiliser les champs `phase0Data`, `phase1Data`, ... présents dans `UIState`.

5. **Validation et tests**
   - Vérifier `npm run lint` et lancer le pipeline en mode dev pour s’assurer de la navigation complète Phase0 → Phase5.
   - Tester la reprise après action utilisateur (Phase0 Step2, Phase2 quarantaine) pour confirmer l’intégration IPC.
   - Documenter les changements dans `AGENTS.md` si des pratiques diffèrent (ex. nouvelle structure des interfaces partagées).
