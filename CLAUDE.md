# Mon App Windows - Configuration Claude Code

## 📚 **DOCUMENTATION CRITIQUE**

### 🚨 Workflow Multi-Étapes - LEÇONS APPRISES
- **📖 Guide Complet :** [docs/WORKFLOW_PATTERNS.md](docs/WORKFLOW_PATTERNS.md)
- **⚡ Référence Rapide :** [docs/WORKFLOW_QUICK_REFERENCE.md](docs/WORKFLOW_QUICK_REFERENCE.md)
- **❌ INTERDICTION :** Ignorer ces guides lors de workflows multi-steps
- **🎯 RÈGLE :** Toujours valider contrats de données entre couches

## 🛡️ RÈGLES ANTI-DUPLICATION ABSOLUES

### Règle 1: Vérification Obligatoire des Fichiers Existants
- **TOUJOURS** exécuter `find . -name "*.ts" -o -name "*.js" | grep -E "(nom_fichier|pattern)"` avant création
- **JAMAIS** créer de fichiers sans vérifier leur existence dans tout le projet
- **OBLIGATOIRE** : Demander confirmation si des fichiers similaires existent
- **COMMANDE DE VÉRIFICATION** : `dir /s /b *.ts *.js | findstr "pattern"` (Windows CMD)

### Règle 2: Un Seul Source de Vérité
- Un fichier = Un emplacement unique dans le projet
- Si modification nécessaire, **ÉDITER** l'existant, **JAMAIS** créer une copie
- Utiliser `git mv` pour déplacer, jamais copier-coller
- **INTERDIT** : fichiers avec suffixes `_new`, `_old`, `_backup`, `_copy`

### Règle 3: Nettoyage Automatique des Tentatives Échouées
- Supprimer les fichiers temporaires avant nouvelle tentative
- Noms temporaires identifiables : `temp_*`, `backup_*`, `attempt_*`, `draft_*`
- Script de nettoyage Windows : `del /s temp_* backup_* attempt_* draft_*`
- Vérifier avec `git status` qu'aucun fichier non-tracké suspect n'existe

### Règle 4: Validation des Éditions
- **JAMAIS** utiliser de placeholders comme `// ... rest of code unchanged`
- **TOUJOURS** écrire le code complet lors des modifications
- Vérifier après chaque édition que le fichier compile avec `npx tsc --noEmit`
- Exécuter `npm run lint` pour valider le style

### Règle 5: Affichage Récursif des Règles
- **OBLIGATOIRE** : Rappeler ces 5 règles au début de chaque réponse longue
- Cette règle assure que les autres ne soient jamais oubliées
- Confirmer la compréhension avant toute action sur les fichiers

---

## 📋 Stack Technique
- **Runtime** : Node.js 18+ LTS
- **Langage** : TypeScript 5.0+ (strict mode activé)
- **Plateforme** : Windows 11 / Application Desktop
- **Package Manager** : npm (avec package-lock.json)
- **Testing** : Jest + @types/jest
- **Linting** : ESLint + Prettier
- **Build** : TypeScript Compiler + esbuild (si besoin)

---

## 🏗️ Architecture du Projet

```
mon-app/
├── src/
│   ├── main.ts              # Point d'entrée principal
│   ├── modules/             # Modules métier organisés par feature
│   │   ├── auth/
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.types.ts
│   │   │   └── index.ts
│   │   ├── database/
│   │   │   ├── database.service.ts
│   │   │   ├── database.types.ts
│   │   │   └── index.ts
│   │   └── ui/
│   │       ├── ui.service.ts
│   │       ├── ui.types.ts
│   │       └── index.ts
│   ├── shared/              # Code partagé entre modules
│   │   ├── types/           # Définitions TypeScript globales
│   │   │   ├── common.types.ts
│   │   │   └── index.ts
│   │   ├── utils/           # Utilitaires réutilisables
│   │   │   ├── file.utils.ts
│   │   │   ├── string.utils.ts
│   │   │   └── index.ts
│   │   └── constants/       # Constantes globales
│   │       ├── app.constants.ts
│   │       └── index.ts
│   └── config/              # Configuration centralisée
│       ├── app.config.ts
│       ├── database.config.ts
│       └── index.ts
├── tests/                   # Tests unitaires et d'intégration
│   ├── unit/
│   └── integration/
├── dist/                    # Sortie de compilation (gitignored)
├── docs/                    # Documentation
├── scripts/                 # Scripts de build et maintenance
├── package.json
├── tsconfig.json
├── jest.config.js
├── .eslintrc.js
├── .prettierrc
├── .gitignore
└── README.md
```

---

## 🚨 GESTION DES CHEMINS WINDOWS - RÈGLES VITALES

### INTERDICTIONS ABSOLUES
- ❌ **JAMAIS** : `const path = __dirname + '\\data\\' + file`
- ❌ **JAMAIS** : `const path = __dirname + '/data/' + file`
- ❌ **JAMAIS** : Utiliser directement `\\` ou `/` dans les chemins
- ❌ **JAMAIS** : Mélanger URLs et chemins de fichiers
- ❌ **JAMAIS** : Chemins codés en dur avec drives `C:\\`

### OBLIGATIONS STRICTES
```typescript
// ✅ TOUJOURS utiliser le module path de Node.js
import path from 'node:path';
import fs from 'node:fs/promises';

// ✅ Construction de chemins sécurisée
const dataDir = path.join(__dirname, 'data');
const configFile = path.join(process.cwd(), 'config', 'app.json');
const userFile = path.resolve(dataDir, `user-${userId}.json`);

// ✅ Pour modules ES avec import.meta.url
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ✅ Vérification d'existence avant manipulation
const exists = await fs.access(filePath).then(() => true).catch(() => false);
```

### VALIDATION AUTOMATIQUE
```bash
# Détecter les concaténations dangereuses dans le code
findstr /s /c:"__dirname.*+" /c:"'\\'" /c:"'/'" src\*.ts
```

---

## 📝 CONVENTIONS DE NOMMAGE - NON NÉGOCIABLES

### Variables et Fonctions
```typescript
// ✅ CORRECT - camelCase exclusivement
const userName = 'John Doe';
const apiEndpoint = 'https://api.example.com';
function getUserProfile() { }
const handleUserClick = () => { };

// ❌ INTERDIT
const user_name = 'John';       // snake_case interdit
const USERNAME = 'John';        // sauf constantes globales
const GetUserProfile = () => { }; // PascalCase interdit pour functions
```

### Classes, Interfaces et Types
```typescript
// ✅ CORRECT - PascalCase strict
class UserService {
  constructor() { }
}

interface UserProfile {  // ✅ Pas de préfixe 'I'
  name: string;
  email: string;
}

type ApiResponse<T> = {
  data: T;
  status: number;
};

// ❌ INTERDIT
class userService { }           // Doit commencer par majuscule
interface IUserProfile { }      // Préfixe 'I' interdit
type apiResponse<T> = { };      // Doit commencer par majuscule
```

### Structure des Fichiers
```
src/
  ├── userService.ts            # ✅ camelCase pour fichiers sources
  ├── apiClient.ts              # ✅ 
  ├── databaseConnection.ts     # ✅
  └── modules/
      └── user-management/      # ✅ kebab-case pour dossiers
          ├── index.ts          # ✅ Point d'entrée
          ├── userController.ts # ✅
          └── userTypes.ts      # ✅

config/
  ├── app.config.ts            # ✅ kebab-case + .config
  ├── database.config.ts       # ✅
  └── jest.config.js           # ✅
```

### Constantes
```typescript
// ✅ CORRECT
export const API_BASE_URL = 'https://api.example.com';    // Global/exportée
export const MAX_RETRY_ATTEMPTS = 3;                      // Global/exportée

const maxRetries = 3;          // ✅ Locale dans fonction
const dbConfig = { };          // ✅ Locale dans module

// ❌ INTERDIT
const API_BASE_URL = 'url';    // CONSTANT_CASE seulement si exportée
export const maxRetries = 3;   // camelCase pour exports interdits
```

---

## 🔒 PROTECTION DES FICHIERS - TECHNIQUES OBLIGATOIRES

### Écriture Atomique (TOUJOURS OBLIGATOIRE)
```typescript
// ❌ INTERDIT - Risque de corruption
import fs from 'node:fs/promises';
await fs.writeFile('data.json', JSON.stringify(data)); // DANGEREUX !

// ✅ OBLIGATOIRE - Écriture atomique sécurisée
import writeFileAtomic from 'write-file-atomic';

async function safeWriteJson(filePath: string, data: any): Promise<void> {
  try {
    await writeFileAtomic(filePath, JSON.stringify(data, null, 2), {
      fsync: true,     // Force synchronisation sur disque
      mode: 0o644,     // Permissions explicites Windows
      encoding: 'utf8'
    });
    
    // Validation immédiate post-écriture
    const written = await fs.readFile(filePath, 'utf-8');
    JSON.parse(written); // Vérifie validité JSON
  } catch (error) {
    console.error(`Erreur écriture atomique ${filePath}:`, error);
    throw error;
  }
}
```

### Backup Automatique Avant Modification
```typescript
import path from 'node:path';

async function safeModifyFile(filePath: string, modifier: (content: string) => string): Promise<void> {
  const backupPath = `${filePath}.backup.${Date.now()}`;
  
  try {
    // Backup si fichier existe
    const exists = await fs.access(filePath).then(() => true).catch(() => false);
    if (exists) {
      await fs.copyFile(filePath, backupPath);
    }
    
    // Lecture et modification
    const original = exists ? await fs.readFile(filePath, 'utf-8') : '';
    const modified = modifier(original);
    
    // Écriture atomique
    await writeFileAtomic(filePath, modified);
    
    // Nettoyage backup après succès
    if (exists) {
      await fs.unlink(backupPath);
    }
  } catch (error) {
    // Restauration backup en cas d'erreur
    try {
      if (await fs.access(backupPath).then(() => true).catch(() => false)) {
        await fs.copyFile(backupPath, filePath);
        await fs.unlink(backupPath);
      }
    } catch (restoreError) {
      console.error('Erreur restauration backup:', restoreError);
    }
    throw error;
  }
}
```

### Gestion de Concurrence (Mutex de Fichiers)
```typescript
import { Mutex } from 'async-mutex';

class FileManager {
  private static mutexes = new Map<string, Mutex>();

  static async safeFileOperation<T>(
    filePath: string, 
    operation: () => Promise<T>
  ): Promise<T> {
    const normalizedPath = path.normalize(filePath);
    
    if (!this.mutexes.has(normalizedPath)) {
      this.mutexes.set(normalizedPath, new Mutex());
    }
    
    const mutex = this.mutexes.get(normalizedPath)!;
    const release = await mutex.acquire();
    
    try {
      return await operation();
    } finally {
      release();
    }
  }
}

// Usage
await FileManager.safeFileOperation('config.json', async () => {
  await safeWriteJson('config.json', newConfig);
});
```

---

## ⚡ COMMANDES ESSENTIELLES

### Développement
```bash
# Démarrage en mode développement avec watch
npm run dev              # nodemon + ts-node

# Compilation et vérifications
npm run build           # Compilation TypeScript vers dist/
npm run type-check      # npx tsc --noEmit (vérification types)
npm run lint            # ESLint avec auto-fix
npm run format          # Prettier formatting

# Tests
npm test                # Jest tests unitaires
npm run test:watch      # Jest en mode watch
npm run test:coverage   # Coverage report
```

### Maintenance et Sécurité
```bash
# Audit sécurité
npm audit              # Vérification vulnérabilités
npm audit fix          # Correction automatique

# Nettoyage
npm run clean          # Supprime dist/ et node_modules/
npm run reset          # clean + npm install

# Git hooks et vérifications
npm run pre-commit     # Lance tous les checks avant commit
```

---

## 🔄 WORKFLOW GIT OBLIGATOIRE

### Avant TOUTE Modification
```bash
# 1. Vérifier état propre
git status

# 2. Synchroniser avec remote
git pull --rebase origin main

# 3. Créer branche feature si nécessaire
git checkout -b feature/description-courte
```

### Pendant les Modifications
```bash
# Commits atomiques par changement logique
git add src/specific-file.ts
git commit -m "feat(auth): add user validation"

# Messages de commit (Conventional Commits)
# feat: nouvelle fonctionnalité
# fix: correction de bug  
# refactor: restructuration sans changement fonctionnel
# docs: mise à jour documentation
# test: ajout ou modification de tests
# chore: maintenance, config, dependencies
```

### Validation Pre-Commit
```bash
# Créer .git/hooks/pre-commit (Windows : Git Bash)
#!/bin/bash
echo "🔍 Vérification anti-duplication..."

# Détection fichiers dupliqués
duplicates=$(find src -name "*.ts" -o -name "*.js" | xargs -I {} basename {} | sort | uniq -d)
if [ ! -z "$duplicates" ]; then
    echo "❌ ERREUR: Fichiers dupliqués détectés: $duplicates"
    exit 1
fi

# Validation TypeScript
echo "📝 Validation TypeScript..."
npx tsc --noEmit || exit 1

# Tests sur fichiers modifiés
echo "🧪 Tests..."
npm test -- --findRelatedTests $(git diff --cached --name-only | tr '\n' ' ') || exit 1

echo "✅ Validations passées!"
```

---

## 🚀 COMMANDES PERSONNALISÉES CLAUDE

### Vérification Exhaustive Anti-Duplication
Avant de créer un nouveau fichier, **TOUJOURS** exécuter :

```bash
# Windows PowerShell
Get-ChildItem -Recurse -Include *.ts,*.js | Where-Object {$_.BaseName -like "*pattern*"} | Select-Object FullName

# Windows CMD  
dir /s /b *.ts *.js | findstr "pattern"

# Git Bash / WSL
find src -name "*.ts" -o -name "*.js" | grep -i "pattern"
```

### Script de Nettoyage des Fichiers Temporaires
```bash
# PowerShell
Get-ChildItem -Recurse | Where-Object {$_.Name -match "(temp_|backup_|attempt_|draft_|copy_|old_)"} | Remove-Item -Force

# CMD
del /s /q temp_* backup_* attempt_* draft_* copy_* old_*
```

### Analyse de Code Dupliqué
```bash
# Installation jscpd si nécessaire
npm install -g jscpd

# Détection code dupliqué (seuil 70% similarité)
jscpd src --min-lines 5 --min-tokens 50 --reporters console,json --output ./reports/
```

---

## 🎯 INSTRUCTIONS SPÉCIALES POUR CLAUDE

### Priorités Absolues
1. **TOUJOURS** commencer par vérifier l'existence de fichiers similaires
2. **JAMAIS** créer de fichiers sans validation explicite
3. **SYSTÉMATIQUEMENT** utiliser les chemins path.join() sur Windows
4. **OBLIGATOIREMENT** utiliser write-file-atomic pour les écritures
5. **IMMÉDIATEMENT** nettoyer les fichiers temporaires en cas d'erreur

### Actions Interdites
- ❌ Créer des fichiers avec suffixes `_new`, `_copy`, `_backup`
- ❌ Utiliser des placeholders `// ... code unchanged`
- ❌ Concaténer des chemins avec `+` ou template literals
- ❌ Écrire directement avec `fs.writeFile` sans atomicité
- ❌ Ignorer les erreurs TypeScript ou de lint

### Validation Obligatoire Après Chaque Action
```bash
# Après modification de fichier
npx tsc --noEmit        # Validation types
npm run lint            # Validation style
git status              # Vérification état clean
```

---

## 🔧 Configuration des Outils

### tsconfig.json (Mode Strict)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### .eslintrc.js
```javascript
module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'prettier'
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    'prefer-const': 'error',
    'no-var': 'error'
  }
};
```

---

**🎯 RAPPEL : Ces règles sont NON-NÉGOCIABLES pour maintenir la qualité et éviter les erreurs de duplication/versioning qui peuvent casser l'application !**