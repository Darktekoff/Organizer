# Repository Guidelines

## Règles essentielles anti-duplication
Avant d'ajouter un fichier `.ts`, `.tsx` ou `.js`, exécute `find src -name '*.ts*' -o -name '*.js' | grep "mot-clé"` pour confirmer qu'il n'existe aucune version. Si une implémentation est déjà présente, privilégie la modification plutôt que la copie, et déplace les fichiers via `git mv` lorsqu'un renommage s'impose. Évite les suffixes `_copy`, `_new`, `_v2` ou similaires : un composant ou un service ne doit vivre qu'à un seul endroit. Termine toujours par `git status` afin de détecter d'éventuels doublons non suivis.

## Structure du projet
`src/main/` regroupe l'entrée Electron, les contrôleurs du pipeline d'ingestion et le preload. `src/renderer/` contient l'interface React (composants, hooks, contexts, styles Tailwind) avec `App.tsx` comme racine de navigation. `src/shared/` héberge les types partagés entre processus. Les scripts d'automatisation et de régression résident dans `scripts/`, tandis que les données de test se trouvent sous `test-data/`. Les configurations principales (Vite, Electron Forge, Tailwind, TypeScript) sont situées à la racine du dépôt.

## Commandes de développement
- `npm install` : installe les dépendances Electron, React et outils de build.
- `npm run start` : lance l'application Electron en mode développement avec rechargement du renderer.
- `npm run lint` : exécute ESLint sur toutes les sources TypeScript/TSX.
- `npm run make` / `npm run package` : génère les binaires distribuables pour validation hors dev.
- Scénarios pipeline : `node scripts/test-phase0-real-behavior.js` et scripts voisins vérifient les régressions métier.

## Style & conventions
Le code est majoritairement en TypeScript avec indentation de deux espaces et virgules finales. Nomme les composants et hooks en PascalCase (`PipelineV6Workflow.tsx`) et les utilitaires en camelCase. Préfère des types explicites pour les exports et évite `any` hors sérialisation. Les styles vivent surtout dans les classes Tailwind ; regroupe les CSS globaux additionnels sous `src/renderer/styles/`. Conserve `nodeIntegration: false` et `contextIsolation: true` lors des mises à jour du main process.

## Tests & validation
Le repo ne dispose pas de Jest/Vitest ; les scripts de `scripts/` servent de tests ciblés. Ajoute de nouveaux scénarios en suivant la nomenclature `test-<phase>-<description>.js` et stocke les fixtures dans `test-data/`. Avant toute revue, exécute `npm run lint`, le ou les scripts concernés, puis un démarrage local (`npm run start`). Pour les modifications sensibles au packaging, valide également `npm run make`.

## Commits & Pull Requests
Adopte un format impératif et scoped (`feat(pipeline): ...`). Un commit doit couvrir un changement cohérent et référencer les travaux connexes dans le corps si besoin. Les pull requests résument la fonctionnalité, listent les commandes exécutées et incluent captures ou sorties console lorsque l'UX évolue. Mentionne les dépendances de configuration (`.env`, API externes) pour faciliter la reproduction par les relecteurs.

## Configuration & secrets
Charge les variables sensibles via `.env` et ne versionne jamais de données privées. Toute création de fichier lié à la configuration doit respecter les règles anti-duplication et passer par les utilitaires Node (`path.join`, `app.getPath`). Lorsque tu exposes des APIs renderer ↔ main, utilise le preload (`contextBridge`) pour maintenir l'isolation et journalise les erreurs critiques dans le main process.
