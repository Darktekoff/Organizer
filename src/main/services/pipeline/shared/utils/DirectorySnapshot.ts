import * as fs from 'fs';
import * as path from 'path';

export interface SnapshotEntry {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
  mtime?: number;
  children?: SnapshotEntry[];
}

export interface LightweightSnapshotEntry {
  path: string;
  name: string;
  type: 'file' | 'directory';
  audioFileCount?: number;  // Nombre de fichiers audio dans ce dossier et ses sous-dossiers
  totalSize?: number;       // Taille totale de ce dossier et ses sous-dossiers
  mtime?: number;
  children?: LightweightSnapshotEntry[];
}

export interface SnapshotOptions {
  followSymlinks?: boolean;
  pruneEmptyDirs?: boolean;
  maxDepth?: number;
}

export class DirectorySnapshot {
  static capture(rootPath: string, options: SnapshotOptions = {}): SnapshotEntry {
    const stats = fs.statSync(rootPath);
    if (!stats.isDirectory()) {
      throw new Error(`Snapshot root must be a directory: ${rootPath}`);
    }

    const normalizedRoot = path.normalize(rootPath);
    return this.buildEntry(normalizedRoot, stats, options, 0);
  }

  private static buildEntry(
    targetPath: string,
    stats: fs.Stats,
    options: SnapshotOptions,
    depth: number
  ): SnapshotEntry {
    const entry: SnapshotEntry = {
      path: targetPath,
      name: path.basename(targetPath),
      type: stats.isDirectory() ? 'directory' : 'file',
      size: stats.isFile() ? stats.size : undefined,
      mtime: stats.mtimeMs
    };

    if (entry.type === 'directory') {
      const children: SnapshotEntry[] = [];
      const items = fs.readdirSync(targetPath, { withFileTypes: true });

      for (const item of items) {
        try {
          const itemPath = path.join(targetPath, item.name);
          let itemStats: fs.Stats;

          if (item.isSymbolicLink()) {
            if (!options.followSymlinks) {
              continue;
            }
            const realPath = fs.realpathSync(itemPath);
            itemStats = fs.statSync(realPath);
          } else {
            itemStats = fs.statSync(itemPath);
          }

          if (options.maxDepth !== undefined && depth + 1 > options.maxDepth) {
            continue;
          }

          const child = this.buildEntry(itemPath, itemStats, options, depth + 1);
          children.push(child);
        } catch {
          // ignore entries that fail to read
        }
      }

      entry.children = options.pruneEmptyDirs
        ? children.filter(child => child.type !== 'directory' || (child.children && child.children.length > 0))
        : children;
    }

    return entry;
  }

  static save(snapshot: SnapshotEntry, outputFile: string): void {
    const dir = path.dirname(outputFile);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputFile, JSON.stringify(snapshot, null, 2), 'utf-8');
  }

  /**
   * Génère un snapshot allégé pour la détection (3 niveaux max, stats aggregées)
   */
  static captureLightweight(rootPath: string, maxDepth: number = 3): LightweightSnapshotEntry {
    const stats = fs.statSync(rootPath);
    if (!stats.isDirectory()) {
      throw new Error(`Snapshot root must be a directory: ${rootPath}`);
    }

    const normalizedRoot = path.normalize(rootPath);
    return this.buildLightweightEntry(normalizedRoot, stats, maxDepth, 0);
  }

  private static buildLightweightEntry(
    targetPath: string,
    stats: fs.Stats,
    maxDepth: number,
    currentDepth: number
  ): LightweightSnapshotEntry {
    const entry: LightweightSnapshotEntry = {
      path: targetPath,
      name: path.basename(targetPath),
      type: stats.isDirectory() ? 'directory' : 'file',
      mtime: stats.mtimeMs
    };

    if (entry.type === 'directory') {
      let audioFileCount = 0;
      let totalSize = 0;
      const children: LightweightSnapshotEntry[] = [];

      try {
        const items = fs.readdirSync(targetPath, { withFileTypes: true });

        for (const item of items) {
          try {
            const itemPath = path.join(targetPath, item.name);
            const itemStats = fs.statSync(itemPath);

            if (item.isDirectory()) {
              if (currentDepth < maxDepth) {
                // Récurser dans les sous-dossiers (jusqu'au niveau maxDepth)
                const childEntry = this.buildLightweightEntry(itemPath, itemStats, maxDepth, currentDepth + 1);
                children.push(childEntry);

                // Agréger les stats des enfants
                audioFileCount += childEntry.audioFileCount || 0;
                totalSize += childEntry.totalSize || 0;
              }
            } else {
              // Compter les fichiers audio
              if (this.isAudioFile(item.name)) {
                audioFileCount++;
              }
              totalSize += itemStats.size;
            }
          } catch {
            // Ignorer les fichiers/dossiers inaccessibles
          }
        }
      } catch {
        // Ignorer les dossiers inaccessibles
      }

      entry.audioFileCount = audioFileCount;
      entry.totalSize = totalSize;
      entry.children = children;
    } else {
      // Fichier unique
      entry.totalSize = stats.size;
      entry.audioFileCount = this.isAudioFile(entry.name) ? 1 : 0;
    }

    return entry;
  }

  private static isAudioFile(filename: string): boolean {
    return /\.(wav|mp3|aif|aiff|flac|ogg|wave)$/i.test(filename);
  }

  /**
   * Sauvegarde un snapshot allégé
   */
  static saveLightweight(snapshot: LightweightSnapshotEntry, outputFile: string): void {
    const dir = path.dirname(outputFile);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputFile, JSON.stringify(snapshot, null, 2), 'utf-8');
  }
}

