/**
 * ProposedStructureGenerator - Génère un JSON de la structure proposée après réorganisation
 *
 * OBJECTIF : Créer une visualisation de la nouvelle structure basée sur les opérations planifiées
 * pour permettre la comparaison avant/après et faciliter le rollback.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// Types pour la structure proposée
interface ProposedDirectoryNode {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
  mtime: number;
  newPath?: string; // Nouveau chemin après opération
  operations?: string[]; // Liste des opérations appliquées
  children?: ProposedDirectoryNode[];
}

interface ProposedStructure {
  originalStructure: string; // Référence au fichier structure-originale.json
  proposedStructure: ProposedDirectoryNode;
  operations: any[]; // Liste complète des opérations
  stats: {
    totalOperations: number;
    moveOperations: number;
    cleanOperations: number;
    unwrapOperations: number;
  };
  generatedAt: string;
  sourcePath: string;
}

export class ProposedStructureGenerator {

  /**
   * Génère la structure proposée basée sur les opérations planifiées
   */
  static async generate(
    sourcePath: string,
    operations: any[],
    originalStructurePath?: string
  ): Promise<ProposedStructure> {

    // Charger la structure originale
    const structureOriginalePath = originalStructurePath ||
      path.join(sourcePath, '.audio-organizer', 'structure-originale.json');

    let originalStructure: any;
    try {
      const originalContent = await fs.readFile(structureOriginalePath, 'utf-8');
      originalStructure = JSON.parse(originalContent);
    } catch (error) {
      throw new Error(`Impossible de charger la structure originale: ${error}`);
    }

    // Créer une version allégée (dossiers seulement) de la structure originale
    const proposedStructure = this.createLightweightStructure(originalStructure, operations);

    // Calculer les statistiques
    const stats = this.calculateOperationStats(operations);

    return {
      originalStructure: path.basename(structureOriginalePath),
      proposedStructure,
      operations,
      stats,
      generatedAt: new Date().toISOString(),
      sourcePath
    };
  }

  /**
   * Sauvegarder la structure proposée dans un fichier JSON
   */
  static async save(
    proposedStructure: ProposedStructure,
    outputPath?: string
  ): Promise<string> {

    const finalPath = outputPath ||
      path.join(proposedStructure.sourcePath, '.audio-organizer', 'structure-proposee.json');

    // S'assurer que le dossier .audio-organizer existe
    const dir = path.dirname(finalPath);
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }

    // Sauvegarder avec formatage lisible
    const jsonContent = JSON.stringify(proposedStructure, null, 2);
    await fs.writeFile(finalPath, jsonContent, 'utf-8');

    console.log(`📄 Structure proposée sauvegardée: ${finalPath}`);
    console.log(`📊 ${proposedStructure.stats.totalOperations} opérations planifiées`);

    return finalPath;
  }

  /**
   * Créer une structure allégée (dossiers seulement) avec les opérations appliquées
   */
  private static createLightweightStructure(
    originalStructure: any,
    operations: any[]
  ): ProposedDirectoryNode {

    // Créer un mapping des opérations par chemin
    const operationsByPath = new Map<string, any[]>();
    for (const op of operations) {
      const normalizedPath = this.normalizePathForComparison(op.sourcePath);
      if (!operationsByPath.has(normalizedPath)) {
        operationsByPath.set(normalizedPath, []);
      }
      operationsByPath.get(normalizedPath)!.push(op);
    }

    // Fonction récursive pour créer la version allégée
    const buildLightweightNode = (node: any): ProposedDirectoryNode => {
      const normalizedPath = this.normalizePathForComparison(node.path);
      const nodeOps = operationsByPath.get(normalizedPath) || [];

      // Créer le noeud de base (dossiers seulement)
      const lightNode: ProposedDirectoryNode = {
        path: node.path,
        name: node.name,
        type: node.type,
        mtime: node.mtime
      };

      // Si c'est un fichier, ne pas l'inclure dans la version allégée
      if (node.type === 'file') {
        return null as any; // Sera filtré
      }

      // Si c'est un dossier, compter les fichiers mais ne pas les lister
      if (node.type === 'directory' && node.children) {
        const childDirs: ProposedDirectoryNode[] = [];
        let fileCount = 0;
        let totalSize = 0;

        for (const child of node.children) {
          if (child.type === 'file') {
            fileCount++;
            totalSize += child.size || 0;
          } else if (child.type === 'directory') {
            const childNode = buildLightweightNode(child);
            if (childNode) {
              childDirs.push(childNode);
            }
          }
        }

        // Ajouter résumé des fichiers
        if (fileCount > 0) {
          lightNode.size = totalSize;
          lightNode.children = [
            ...childDirs,
            {
              path: `${node.path}/_files_summary`,
              name: `${fileCount} fichiers (${this.formatBytes(totalSize)})`,
              type: 'file' as const,
              size: totalSize,
              mtime: Date.now()
            }
          ];
        } else {
          lightNode.children = childDirs;
        }
      }

      // Appliquer les opérations à ce noeud
      if (nodeOps.length > 0) {
        lightNode.operations = [];

        for (const operation of nodeOps) {
          lightNode.operations.push(operation.type);

          switch (operation.type) {
            case 'move':
              lightNode.newPath = operation.targetPath;
              const newName = path.basename(operation.targetPath);
              if (newName !== lightNode.name) {
                lightNode.name = newName;
              }
              break;

            case 'clean':
              lightNode.newPath = operation.targetPath;
              lightNode.name = path.basename(operation.targetPath);
              break;

            case 'unwrap':
              lightNode.newPath = operation.targetPath;
              break;
          }
        }
      }

      return lightNode;
    };

    return buildLightweightNode(originalStructure);
  }

  /**
   * Formater les bytes (méthode utilitaire)
   */
  private static formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 o';

    const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
    let index = 0;
    let value = bytes;

    while (value >= 1024 && index < units.length - 1) {
      value /= 1024;
      index++;
    }

    return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
  }

  /**
   * Normaliser les chemins pour comparaison (gérer Windows vs Unix)
   */
  private static normalizePathForComparison(filePath: string): string {
    return path.normalize(filePath).toLowerCase().replace(/\\/g, '/');
  }

  /**
   * Calculer les statistiques des opérations
   */
  private static calculateOperationStats(operations: any[]): {
    totalOperations: number;
    moveOperations: number;
    cleanOperations: number;
    unwrapOperations: number;
  } {

    const stats = {
      totalOperations: operations.length,
      moveOperations: 0,
      cleanOperations: 0,
      unwrapOperations: 0
    };

    for (const operation of operations) {
      switch (operation.type) {
        case 'MOVE':
          stats.moveOperations++;
          break;
        case 'CLEAN_NAME':
          stats.cleanOperations++;
          break;
        case 'UNWRAP':
          stats.unwrapOperations++;
          break;
      }
    }

    return stats;
  }

  /**
   * Charger une structure proposée depuis un fichier
   */
  static async load(filePath: string): Promise<ProposedStructure> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Impossible de charger la structure proposée: ${error}`);
    }
  }

  /**
   * Comparer deux structures et générer un rapport de différences
   */
  static compareStructures(
    original: any,
    proposed: ProposedDirectoryNode
  ): {
    changedNodes: Array<{path: string, changes: string[]}>;
    totalChanges: number;
  } {

    const changedNodes: Array<{path: string, changes: string[]}> = [];

    const compareNode = (origNode: any, propNode: ProposedDirectoryNode) => {
      if (propNode.operations && propNode.operations.length > 0) {
        const changes = propNode.operations.map(op => {
          switch (op) {
            case 'MOVE': return `Déplacé vers: ${propNode.newPath}`;
            case 'CLEAN_NAME': return `Nom nettoyé: ${propNode.name}`;
            case 'UNWRAP': return `Contenu extrait`;
            default: return op;
          }
        });

        changedNodes.push({
          path: origNode.path,
          changes
        });
      }

      // Récurser dans les enfants
      if (origNode.children && propNode.children) {
        for (let i = 0; i < Math.min(origNode.children.length, propNode.children.length); i++) {
          compareNode(origNode.children[i], propNode.children[i]);
        }
      }
    };

    compareNode(original, proposed);

    return {
      changedNodes,
      totalChanges: changedNodes.length
    };
  }
}