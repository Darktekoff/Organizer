/**
 * FolderClusterEngine - Moteur de clustering automatique pour regrouper les dossiers similaires
 * Utilise des algorithmes de clustering pour identifier automatiquement les groupes de dossiers équivalents
 */

import { FolderSimilarityMatcher, PathContext } from './FolderSimilarityMatcher';

export interface FolderPath {
  id: string;
  path: string;
  folderName: string;
  context: PathContext;
  packId: string;
  fileCount?: number;
  metadata?: Record<string, any>;
}

export interface FolderCluster {
  id: string;
  canonical: string;
  members: FolderPath[];
  confidence: number;
  similarityMatrix: Map<string, Map<string, number>>;
  statistics: ClusterStatistics;
}

export interface ClusterStatistics {
  avgSimilarity: number;
  minSimilarity: number;
  maxSimilarity: number;
  totalFiles: number;
  packCount: number;
  cohesion: number; // Mesure de la cohésion interne du cluster
}

export interface ClusteringConfig {
  similarityThreshold?: number;
  minClusterSize?: number;
  maxClusterSize?: number;
  mergeThreshold?: number;
  algorithm?: 'hierarchical' | 'dbscan' | 'adaptive';
}

export interface ValidationResult {
  isValid: boolean;
  cohesionScore: number;
  separationScore: number;
  anomalies: string[];
  suggestions: string[];
}

export class FolderClusterEngine {
  private readonly matcher: FolderSimilarityMatcher;
  private readonly config: Required<ClusteringConfig>;

  constructor(matcher?: FolderSimilarityMatcher, config?: ClusteringConfig) {
    this.matcher = matcher || new FolderSimilarityMatcher();
    this.config = {
      similarityThreshold: 0.75,
      minClusterSize: 1,
      maxClusterSize: 100,
      mergeThreshold: 0.85,
      algorithm: 'adaptive',
      ...config
    };
  }

  /**
   * Crée des clusters automatiquement depuis une liste de chemins de dossiers
   */
  async createClusters(folderPaths: FolderPath[]): Promise<FolderCluster[]> {
    if (folderPaths.length === 0) return [];

    console.log(`[ClusterEngine] Creating clusters from ${folderPaths.length} folder paths`);

    // Calcul de la matrice de similarité complète
    const similarityMatrix = this.computeSimilarityMatrix(folderPaths);

    // Choix de l'algorithme selon la configuration
    let clusters: FolderCluster[];
    switch (this.config.algorithm) {
      case 'hierarchical':
        clusters = this.hierarchicalClustering(folderPaths, similarityMatrix);
        break;
      case 'dbscan':
        clusters = this.dbscanClustering(folderPaths, similarityMatrix);
        break;
      case 'adaptive':
      default:
        clusters = this.adaptiveClustering(folderPaths, similarityMatrix);
        break;
    }

    // Post-traitement : fusion des clusters trop similaires
    clusters = this.mergeSimilarClusters(clusters);

    // Sélection des noms canoniques
    clusters = this.selectCanonicalNames(clusters);

    // Calcul des statistiques finales
    clusters = this.calculateClusterStatistics(clusters);

    console.log(`[ClusterEngine] Created ${clusters.length} clusters`);

    return clusters;
  }

  /**
   * Calcule la matrice de similarité complète entre tous les dossiers
   */
  private computeSimilarityMatrix(
    folderPaths: FolderPath[]
  ): Map<string, Map<string, number>> {
    const matrix = new Map<string, Map<string, number>>();

    for (let i = 0; i < folderPaths.length; i++) {
      const path1 = folderPaths[i];
      if (!matrix.has(path1.id)) {
        matrix.set(path1.id, new Map());
      }

      for (let j = i; j < folderPaths.length; j++) {
        const path2 = folderPaths[j];
        if (!matrix.has(path2.id)) {
          matrix.set(path2.id, new Map());
        }

        if (i === j) {
          // Similarité avec soi-même = 1
          matrix.get(path1.id)!.set(path2.id, 1);
        } else {
          // Calcul de similarité
          const scores = this.matcher.calculateSimilarity(
            path1.folderName,
            path2.folderName,
            path1.context,
            path2.context
          );

          matrix.get(path1.id)!.set(path2.id, scores.overall);
          matrix.get(path2.id)!.set(path1.id, scores.overall);
        }
      }
    }

    return matrix;
  }

  /**
   * Clustering hiérarchique agglomératif
   */
  private hierarchicalClustering(
    folderPaths: FolderPath[],
    similarityMatrix: Map<string, Map<string, number>>
  ): FolderCluster[] {
    // Initialisation : chaque élément est son propre cluster
    const clusters: FolderCluster[] = folderPaths.map(path => ({
      id: `cluster_${path.id}`,
      canonical: path.folderName,
      members: [path],
      confidence: 1,
      similarityMatrix: new Map([[path.id, new Map([[path.id, 1]])]]),
      statistics: {
        avgSimilarity: 1,
        minSimilarity: 1,
        maxSimilarity: 1,
        totalFiles: path.fileCount || 0,
        packCount: 1,
        cohesion: 1
      }
    }));

    // Fusion itérative des clusters les plus similaires
    while (clusters.length > 1) {
      let maxSimilarity = 0;
      let mergeIndices = [-1, -1];

      // Trouve la paire de clusters la plus similaire
      for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          const sim = this.calculateClusterSimilarity(
            clusters[i],
            clusters[j],
            similarityMatrix
          );

          if (sim > maxSimilarity) {
            maxSimilarity = sim;
            mergeIndices = [i, j];
          }
        }
      }

      // Si la similarité max est sous le seuil, arrêter
      if (maxSimilarity < this.config.similarityThreshold) {
        break;
      }

      // Fusionner les deux clusters
      if (mergeIndices[0] >= 0 && mergeIndices[1] >= 0) {
        const merged = this.mergeTwoClusters(
          clusters[mergeIndices[0]],
          clusters[mergeIndices[1]],
          similarityMatrix
        );

        // Remplacer les anciens clusters par le nouveau
        clusters.splice(mergeIndices[1], 1); // Retirer le second
        clusters.splice(mergeIndices[0], 1, merged); // Remplacer le premier
      }
    }

    return clusters;
  }

  /**
   * DBSCAN clustering (Density-Based Spatial Clustering)
   */
  private dbscanClustering(
    folderPaths: FolderPath[],
    similarityMatrix: Map<string, Map<string, number>>
  ): FolderCluster[] {
    const clusters: FolderCluster[] = [];
    const visited = new Set<string>();
    const noise = new Set<string>();

    const minPts = Math.max(2, this.config.minClusterSize); // Points minimum pour former un cluster

    for (const point of folderPaths) {
      if (visited.has(point.id)) continue;

      visited.add(point.id);

      // Trouve les voisins (points similaires)
      const neighbors = this.getNeighbors(
        point,
        folderPaths,
        similarityMatrix,
        this.config.similarityThreshold
      );

      if (neighbors.length < minPts) {
        noise.add(point.id);
      } else {
        // Créer un nouveau cluster
        const cluster = this.expandCluster(
          point,
          neighbors,
          folderPaths,
          similarityMatrix,
          visited,
          minPts
        );
        clusters.push(cluster);
      }
    }

    // Traiter le bruit : créer des clusters individuels pour les points isolés
    for (const noiseId of noise) {
      const noisePath = folderPaths.find(p => p.id === noiseId);
      if (noisePath) {
        clusters.push(this.createSingletonCluster(noisePath));
      }
    }

    return clusters;
  }

  /**
   * Clustering adaptatif - Combine le meilleur des deux approches
   */
  private adaptiveClustering(
    folderPaths: FolderPath[],
    similarityMatrix: Map<string, Map<string, number>>
  ): FolderCluster[] {
    // Pour les petits ensembles, utiliser hiérarchique (plus précis)
    if (folderPaths.length < 50) {
      return this.hierarchicalClustering(folderPaths, similarityMatrix);
    }

    // Pour les grands ensembles, utiliser DBSCAN (plus rapide)
    return this.dbscanClustering(folderPaths, similarityMatrix);
  }

  /**
   * Calcule la similarité entre deux clusters
   */
  private calculateClusterSimilarity(
    cluster1: FolderCluster,
    cluster2: FolderCluster,
    similarityMatrix: Map<string, Map<string, number>>
  ): number {
    // Average linkage : moyenne des similarités entre tous les membres
    let totalSimilarity = 0;
    let count = 0;

    for (const member1 of cluster1.members) {
      for (const member2 of cluster2.members) {
        const sim = similarityMatrix.get(member1.id)?.get(member2.id) || 0;
        totalSimilarity += sim;
        count++;
      }
    }

    return count > 0 ? totalSimilarity / count : 0;
  }

  /**
   * Fusionne deux clusters
   */
  private mergeTwoClusters(
    cluster1: FolderCluster,
    cluster2: FolderCluster,
    similarityMatrix: Map<string, Map<string, number>>
  ): FolderCluster {
    const newMembers = [...cluster1.members, ...cluster2.members];
    const newId = `${cluster1.id}_${cluster2.id}`;

    // Copier la matrice de similarité
    const newSimilarityMatrix = new Map<string, Map<string, number>>();
    for (const member of newMembers) {
      newSimilarityMatrix.set(member.id, new Map());
      for (const otherMember of newMembers) {
        const sim = similarityMatrix.get(member.id)?.get(otherMember.id) || 0;
        newSimilarityMatrix.get(member.id)!.set(otherMember.id, sim);
      }
    }

    return {
      id: newId,
      canonical: '', // Sera défini plus tard
      members: newMembers,
      confidence: (cluster1.confidence + cluster2.confidence) / 2,
      similarityMatrix: newSimilarityMatrix,
      statistics: {
        avgSimilarity: 0, // Sera calculé plus tard
        minSimilarity: 0,
        maxSimilarity: 0,
        totalFiles: (cluster1.statistics.totalFiles + cluster2.statistics.totalFiles),
        packCount: new Set([...cluster1.members, ...cluster2.members].map(m => m.packId)).size,
        cohesion: 0
      }
    };
  }

  /**
   * Trouve les voisins d'un point (DBSCAN)
   */
  private getNeighbors(
    point: FolderPath,
    allPoints: FolderPath[],
    similarityMatrix: Map<string, Map<string, number>>,
    threshold: number
  ): FolderPath[] {
    const neighbors: FolderPath[] = [];

    for (const other of allPoints) {
      if (other.id === point.id) continue;

      const similarity = similarityMatrix.get(point.id)?.get(other.id) || 0;
      if (similarity >= threshold) {
        neighbors.push(other);
      }
    }

    return neighbors;
  }

  /**
   * Étend un cluster (DBSCAN)
   */
  private expandCluster(
    point: FolderPath,
    neighbors: FolderPath[],
    allPoints: FolderPath[],
    similarityMatrix: Map<string, Map<string, number>>,
    visited: Set<string>,
    minPts: number
  ): FolderCluster {
    const clusterMembers = [point];
    const queue = [...neighbors];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (!visited.has(current.id)) {
        visited.add(current.id);

        const currentNeighbors = this.getNeighbors(
          current,
          allPoints,
          similarityMatrix,
          this.config.similarityThreshold
        );

        if (currentNeighbors.length >= minPts) {
          queue.push(...currentNeighbors.filter(n => !visited.has(n.id)));
        }
      }

      if (!clusterMembers.some(m => m.id === current.id)) {
        clusterMembers.push(current);
      }
    }

    return this.createClusterFromMembers(clusterMembers, similarityMatrix);
  }

  /**
   * Crée un cluster depuis une liste de membres
   */
  private createClusterFromMembers(
    members: FolderPath[],
    similarityMatrix: Map<string, Map<string, number>>
  ): FolderCluster {
    const clusterId = `cluster_${members.map(m => m.id).join('_')}`;

    // Extraire la sous-matrice de similarité
    const clusterMatrix = new Map<string, Map<string, number>>();
    for (const member of members) {
      clusterMatrix.set(member.id, new Map());
      for (const otherMember of members) {
        const sim = similarityMatrix.get(member.id)?.get(otherMember.id) || 0;
        clusterMatrix.get(member.id)!.set(otherMember.id, sim);
      }
    }

    return {
      id: clusterId,
      canonical: '', // Sera sélectionné plus tard
      members,
      confidence: 0, // Sera calculé plus tard
      similarityMatrix: clusterMatrix,
      statistics: {
        avgSimilarity: 0,
        minSimilarity: 0,
        maxSimilarity: 0,
        totalFiles: members.reduce((sum, m) => sum + (m.fileCount || 0), 0),
        packCount: new Set(members.map(m => m.packId)).size,
        cohesion: 0
      }
    };
  }

  /**
   * Crée un cluster singleton
   */
  private createSingletonCluster(path: FolderPath): FolderCluster {
    return {
      id: `singleton_${path.id}`,
      canonical: path.folderName,
      members: [path],
      confidence: 1,
      similarityMatrix: new Map([[path.id, new Map([[path.id, 1]])]]),
      statistics: {
        avgSimilarity: 1,
        minSimilarity: 1,
        maxSimilarity: 1,
        totalFiles: path.fileCount || 0,
        packCount: 1,
        cohesion: 1
      }
    };
  }

  /**
   * Fusionne les clusters trop similaires (post-traitement)
   */
  private mergeSimilarClusters(clusters: FolderCluster[]): FolderCluster[] {
    const merged: FolderCluster[] = [];
    const used = new Set<number>();

    for (let i = 0; i < clusters.length; i++) {
      if (used.has(i)) continue;

      let currentCluster = clusters[i];

      for (let j = i + 1; j < clusters.length; j++) {
        if (used.has(j)) continue;

        // Vérifier si les clusters sont similaires
        const avgSim = this.calculateInterClusterSimilarity(
          currentCluster,
          clusters[j]
        );

        if (avgSim >= this.config.mergeThreshold) {
          // Fusionner
          currentCluster = this.mergeTwoClusters(
            currentCluster,
            clusters[j],
            this.buildGlobalMatrix([currentCluster, clusters[j]])
          );
          used.add(j);
        }
      }

      merged.push(currentCluster);
      used.add(i);
    }

    return merged;
  }

  /**
   * Calcule la similarité moyenne entre deux clusters
   */
  private calculateInterClusterSimilarity(
    cluster1: FolderCluster,
    cluster2: FolderCluster
  ): number {
    let totalSim = 0;
    let count = 0;

    for (const member1 of cluster1.members) {
      for (const member2 of cluster2.members) {
        const scores = this.matcher.calculateSimilarity(
          member1.folderName,
          member2.folderName,
          member1.context,
          member2.context
        );
        totalSim += scores.overall;
        count++;
      }
    }

    return count > 0 ? totalSim / count : 0;
  }

  /**
   * Construit une matrice globale depuis des clusters
   */
  private buildGlobalMatrix(clusters: FolderCluster[]): Map<string, Map<string, number>> {
    const matrix = new Map<string, Map<string, number>>();

    for (const cluster of clusters) {
      for (const [id1, innerMap] of cluster.similarityMatrix) {
        if (!matrix.has(id1)) {
          matrix.set(id1, new Map());
        }
        for (const [id2, sim] of innerMap) {
          matrix.get(id1)!.set(id2, sim);
        }
      }
    }

    return matrix;
  }

  /**
   * Sélectionne le nom canonique pour chaque cluster
   */
  private selectCanonicalNames(clusters: FolderCluster[]): FolderCluster[] {
    return clusters.map(cluster => ({
      ...cluster,
      canonical: this.selectCanonicalName(cluster)
    }));
  }

  /**
   * Sélectionne le nom canonique le plus représentatif d'un cluster
   */
  selectCanonicalName(cluster: FolderCluster): string {
    if (cluster.members.length === 1) {
      return cluster.members[0].folderName;
    }

    // Stratégie de sélection :
    // 1. Préférer le nom le plus court et simple
    // 2. Éviter les underscores si possible
    // 3. Préférer les noms avec bonne casse

    const candidates = cluster.members.map(m => ({
      name: m.folderName,
      score: this.scoreCanonicalCandidate(m.folderName, cluster)
    }));

    candidates.sort((a, b) => b.score - a.score);

    return candidates[0].name;
  }

  /**
   * Score un candidat pour être nom canonique
   */
  private scoreCanonicalCandidate(name: string, cluster: FolderCluster): number {
    let score = 0;

    // Préférer les noms courts
    score += (20 - name.length) / 20;

    // Pénaliser les underscores et tirets
    const separatorCount = (name.match(/[_\-]/g) || []).length;
    score -= separatorCount * 0.1;

    // Favoriser PascalCase ou camelCase
    if (/^[A-Z][a-z]/.test(name)) {
      score += 0.2; // PascalCase
    } else if (/^[a-z][a-zA-Z]/.test(name)) {
      score += 0.15; // camelCase
    }

    // Favoriser les noms sans chiffres
    if (!/\d/.test(name)) {
      score += 0.1;
    }

    // Calculer la similarité moyenne avec tous les membres
    let avgSimilarity = 0;
    for (const member of cluster.members) {
      if (member.folderName !== name) {
        const scores = this.matcher.calculateSimilarity(name, member.folderName);
        avgSimilarity += scores.overall;
      }
    }
    avgSimilarity /= Math.max(1, cluster.members.length - 1);

    score += avgSimilarity * 0.5;

    return score;
  }

  /**
   * Calcule les statistiques finales des clusters
   */
  private calculateClusterStatistics(clusters: FolderCluster[]): FolderCluster[] {
    return clusters.map(cluster => {
      const stats = this.computeClusterStats(cluster);
      return {
        ...cluster,
        confidence: stats.cohesion,
        statistics: stats
      };
    });
  }

  /**
   * Calcule les statistiques d'un cluster
   */
  private computeClusterStats(cluster: FolderCluster): ClusterStatistics {
    const similarities: number[] = [];

    // Collecter toutes les similarités intra-cluster
    for (let i = 0; i < cluster.members.length; i++) {
      for (let j = i + 1; j < cluster.members.length; j++) {
        const sim = cluster.similarityMatrix
          .get(cluster.members[i].id)
          ?.get(cluster.members[j].id) || 0;
        similarities.push(sim);
      }
    }

    if (similarities.length === 0) {
      // Cluster singleton
      return {
        avgSimilarity: 1,
        minSimilarity: 1,
        maxSimilarity: 1,
        totalFiles: cluster.members[0]?.fileCount || 0,
        packCount: 1,
        cohesion: 1
      };
    }

    const avg = similarities.reduce((a, b) => a + b, 0) / similarities.length;
    const min = Math.min(...similarities);
    const max = Math.max(...similarities);

    // Cohésion : mesure à quel point le cluster est serré
    const variance = similarities.reduce((sum, sim) => sum + Math.pow(sim - avg, 2), 0) / similarities.length;
    const cohesion = avg * (1 - Math.sqrt(variance)); // Haute moyenne et faible variance = bonne cohésion

    return {
      avgSimilarity: avg,
      minSimilarity: min,
      maxSimilarity: max,
      totalFiles: cluster.members.reduce((sum, m) => sum + (m.fileCount || 0), 0),
      packCount: new Set(cluster.members.map(m => m.packId)).size,
      cohesion
    };
  }

  /**
   * Valide la qualité des clusters
   */
  validateClusters(clusters: FolderCluster[]): ValidationResult {
    const anomalies: string[] = [];
    const suggestions: string[] = [];

    // Calcul de la cohésion moyenne
    const avgCohesion = clusters.reduce((sum, c) => sum + c.statistics.cohesion, 0) / clusters.length;

    // Calcul de la séparation (distance inter-clusters)
    let interClusterSims: number[] = [];
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const sim = this.calculateInterClusterSimilarity(clusters[i], clusters[j]);
        interClusterSims.push(sim);
      }
    }
    const avgSeparation = interClusterSims.length > 0
      ? 1 - (interClusterSims.reduce((a, b) => a + b, 0) / interClusterSims.length)
      : 1;

    // Détection d'anomalies
    for (const cluster of clusters) {
      if (cluster.statistics.minSimilarity < 0.6) {
        anomalies.push(`Cluster ${cluster.canonical} has low internal similarity (${cluster.statistics.minSimilarity.toFixed(2)})`);
        suggestions.push(`Consider splitting cluster ${cluster.canonical}`);
      }

      if (cluster.members.length > this.config.maxClusterSize) {
        anomalies.push(`Cluster ${cluster.canonical} is too large (${cluster.members.length} members)`);
        suggestions.push(`Consider increasing similarity threshold`);
      }
    }

    // Vérifier les clusters trop similaires
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const sim = this.calculateInterClusterSimilarity(clusters[i], clusters[j]);
        if (sim > 0.7) {
          anomalies.push(`Clusters ${clusters[i].canonical} and ${clusters[j].canonical} are very similar`);
          suggestions.push(`Consider merging these clusters`);
        }
      }
    }

    return {
      isValid: anomalies.length === 0,
      cohesionScore: avgCohesion,
      separationScore: avgSeparation,
      anomalies,
      suggestions
    };
  }
}