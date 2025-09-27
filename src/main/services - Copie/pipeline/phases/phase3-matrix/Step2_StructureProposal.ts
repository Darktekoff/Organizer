/**
 * Step2_StructureProposal - Propose des structures d'organisation hiérarchiques
 * Utilise la matrice adaptative pour générer des propositions intelligentes
 */

import type { StepExecutor, StepResult, ValidationResult, ProgressCallback } from '@shared/interfaces/StepContracts';
import type {
  StructureProposalInput,
  StructureProposalOutput,
  StructureProposal,
  StructureRecommendation,
  StructurePreviewNode,
  ComplexityMetrics,
  AdaptiveMatrix,
  MatrixEntry,
  ProposalConfig
} from './Phase3Types';
import type { ClassifiedPack } from '@shared/interfaces/BusinessTypes';

/**
 * Step 2 - Générateur de propositions de structure
 */
export class Step2_StructureProposal implements StepExecutor<StructureProposalInput, StructureProposalOutput> {
  private readonly config: ProposalConfig;

  constructor(config: Partial<ProposalConfig> = {}) {
    this.config = {
      maxProposals: 3,
      minFilesPerFolder: 5,
      maxFilesPerFolder: 100,
      balanceWeight: 0.3,
      compatibilityWeight: 0.4,
      simplicityWeight: 0.3,
      ...config
    };
  }

  /**
   * Exécute la génération de propositions de structure
   */
  async execute(
    input: StructureProposalInput,
    onProgress?: ProgressCallback
  ): Promise<StepResult<StructureProposalOutput>> {
    const startTime = Date.now();

    try {
      // Validation
      const validation = this.validate(input);
      if (!validation.valid) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: validation.errors.join('; ')
          },
          canProceed: false
        };
      }

      onProgress?.(10, 'Analyse de la matrice adaptative...');

      // 1. Analyser la matrice pour comprendre les patterns
      const matrixAnalysis = this.analyzeMatrix(input.adaptiveMatrix);

      onProgress?.(30, 'Génération des propositions...');

      // 2. Générer différentes propositions de structure
      const proposals: StructureProposal[] = [];

      // Proposition A: Taxonomique (Family → Type → Style → Function)
      const taxonomicProposal = await this.generateTaxonomicProposal(
        input.adaptiveMatrix,
        input.classifiedPacks,
        matrixAnalysis
      );
      proposals.push(taxonomicProposal);

      onProgress?.(50, 'Génération proposition type-first...');

      // Proposition B: Type-First (Type → Family → Style → Function)
      const typeFirstProposal = await this.generateTypeFirstProposal(
        input.adaptiveMatrix,
        input.classifiedPacks,
        matrixAnalysis
      );
      proposals.push(typeFirstProposal);

      onProgress?.(70, 'Génération proposition adaptive...');

      // Proposition C: Adaptative basée sur les patterns découverts
      const adaptiveProposal = await this.generateAdaptiveProposal(
        input.adaptiveMatrix,
        input.classifiedPacks,
        matrixAnalysis
      );
      proposals.push(adaptiveProposal);

      onProgress?.(85, 'Calcul des recommandations...');

      // 3. Évaluer et recommander la meilleure proposition
      const recommendations = this.calculateRecommendations(proposals, input.statistics);

      onProgress?.(95, 'Calcul de la complexité...');

      // 4. Calculer les métriques de complexité
      const estimatedComplexity = this.calculateComplexityMetrics(proposals, input.classifiedPacks);

      onProgress?.(100, 'Propositions générées avec succès');

      const endTime = Date.now();

      const limitedProposals = proposals.slice(0, this.config.maxProposals);

      return {
        success: true,
        data: {
          proposals: limitedProposals,
          recommendations,
          estimatedComplexity
        },
        canProceed: false,
        userActionRequired: {
          type: 'choice',
          title: 'Choisir la structure d\'organisation',
          message: 'Sélectionnez la structure finale à appliquer avant de passer à la Phase 4.',
          options: limitedProposals.map(proposal => proposal.id),
          defaultValue: this.buildUserActionPayload(limitedProposals, recommendations, estimatedComplexity),
          required: true
        },
        metrics: {
          startTime,
          endTime,
          itemsProcessed: Object.keys(input.adaptiveMatrix).length,
          processingSpeed: Object.keys(input.adaptiveMatrix).length / ((endTime - startTime) / 1000),
          duration: endTime - startTime
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[StructureProposal] Fatal error:', error);

      return {
        success: false,
        error: {
          code: 'STRUCTURE_PROPOSAL_FAILED',
          message: `Structure proposal failed: ${errorMessage}`,
          recoverable: true
        },
        canProceed: false
      };
    }
  }

  private buildUserActionPayload(
    proposals: StructureProposal[],
    recommendations: StructureRecommendation,
    estimatedComplexity: ComplexityMetrics
  ) {
    return {
      recommendedId: recommendations.recommendedId,
      recommendationReason: recommendations.reason,
      recommendationConfidence: recommendations.confidence,
      proposals: proposals.map(proposal => ({
        id: proposal.id,
        name: proposal.name,
        description: proposal.description,
        hierarchy: proposal.hierarchy,
        levels: proposal.levels,
        estimatedFolders: proposal.estimatedFolders,
        avgFilesPerFolder: proposal.avgFilesPerFolder,
        balanceScore: proposal.balanceScore,
        compatibilityScore: proposal.compatibilityScore,
        maxDepth: proposal.maxDepth,
        advantages: proposal.advantages,
        disadvantages: proposal.disadvantages,
        statistics: proposal.statistics ?? {
          estimatedFolders: proposal.estimatedFolders,
          estimatedFiles: Math.round(proposal.avgFilesPerFolder * proposal.estimatedFolders),
          fusionGroups: 0,
          duplicatesResolved: 0
        },
        preview: proposal.preview.slice(0, 5).map(node => ({
          path: node.path,
          estimatedFiles: node.estimatedFiles,
          examples: node.examples
        }))
      })),
      complexity: {
        organizationalComplexity: estimatedComplexity.organizationalComplexity,
        userDecisionPoints: estimatedComplexity.userDecisionPoints,
        estimatedTimeMinutes: estimatedComplexity.estimatedTimeMinutes,
        riskFactors: estimatedComplexity.riskFactors
      }
    };
  }

  /**
   * Analyse la matrice pour extraire des insights
   */
  private analyzeMatrix(matrix: AdaptiveMatrix) {
    const entries = Object.values(matrix);

    const familyDistribution = new Map<string, number>();
    const typeDistribution = new Map<string, number>();
    const styleDistribution = new Map<string, number>();
    const functionDistribution = new Map<string, number>();

    let totalFiles = 0;

    for (const entry of entries) {
      familyDistribution.set(entry.family, (familyDistribution.get(entry.family) || 0) + entry.packCount);
      typeDistribution.set(entry.type, (typeDistribution.get(entry.type) || 0) + entry.packCount);
      styleDistribution.set(entry.style, (styleDistribution.get(entry.style) || 0) + entry.packCount);

      totalFiles += entry.totalFiles;

      entry.functions.forEach(func => {
        functionDistribution.set(func, (functionDistribution.get(func) || 0) + 1);
      });
    }

    return {
      familyDistribution,
      typeDistribution,
      styleDistribution,
      functionDistribution,
      totalFiles,
      totalEntries: entries.length,
      avgFilesPerEntry: totalFiles / entries.length
    };
  }

  /**
   * Génère une proposition taxonomique (Family → Type → Style → Function)
   */
  private async generateTaxonomicProposal(
    matrix: AdaptiveMatrix,
    packs: ClassifiedPack[],
    analysis: any
  ): Promise<StructureProposal> {
    const hierarchy = ['Family', 'Type', 'Style', 'Function'];
    const preview = this.generatePreviewTree(matrix, hierarchy);

    const estimatedFolders = this.estimateFolders(preview);
    const balanceScore = this.calculateBalanceScore(preview);

    return {
      id: 'taxonomic',
      name: 'Organisation Taxonomique',
      description: 'Organisation basée sur la taxonomie musicale : Famille → Type → Style → Function',
      hierarchy,
      levels: hierarchy.length,
      estimatedFolders,
      avgFilesPerFolder: analysis.totalFiles / estimatedFolders,
      maxDepth: hierarchy.length,
      balanceScore,
      advantages: [
        'Structure familière pour les musiciens',
        'Groupement logique par genre musical',
        'Évolutif pour nouveaux styles',
        'Compatible avec la plupart des collections'
      ],
      disadvantages: [
        'Peut créer des dossiers déséquilibrés',
        'Moins intuitif pour recherche par instrument',
        'Hiérarchie profonde (4 niveaux)'
      ],
      preview,
      compatibilityScore: this.calculateTaxonomicCompatibility(matrix)
    };
  }

  /**
   * Génère une proposition type-first (Type → Family → Style → Function)
   */
  private async generateTypeFirstProposal(
    matrix: AdaptiveMatrix,
    packs: ClassifiedPack[],
    analysis: any
  ): Promise<StructureProposal> {
    const hierarchy = ['Type', 'Family', 'Style', 'Function'];
    const preview = this.generatePreviewTree(matrix, hierarchy);

    const estimatedFolders = this.estimateFolders(preview);
    const balanceScore = this.calculateBalanceScore(preview);

    return {
      id: 'type_first',
      name: 'Organisation par Type',
      description: 'Organisation par instrument/type : Type → Famille → Style → Function',
      hierarchy,
      levels: hierarchy.length,
      estimatedFolders,
      avgFilesPerFolder: analysis.totalFiles / estimatedFolders,
      maxDepth: hierarchy.length,
      balanceScore,
      advantages: [
        'Recherche rapide par instrument (KICKS, BASS, etc.)',
        'Structure équilibrée par type',
        'Intuitif pour la production musicale',
        'Moins de variation entre dossiers'
      ],
      disadvantages: [
        'Mélange des genres au niveau supérieur',
        'Peut fragmenter les packs cohérents',
        'Moins naturel pour parcourir par style'
      ],
      preview,
      compatibilityScore: this.calculateTypeFirstCompatibility(analysis)
    };
  }

  /**
   * Génère une proposition adaptative basée sur les patterns découverts
   */
  private async generateAdaptiveProposal(
    matrix: AdaptiveMatrix,
    packs: ClassifiedPack[],
    analysis: any
  ): Promise<StructureProposal> {
    // Analyser quels niveaux sont les plus discriminants
    const hierarchyLevels = this.determineOptimalHierarchy(analysis);
    const preview = this.generatePreviewTree(matrix, hierarchyLevels);

    const estimatedFolders = this.estimateFolders(preview);
    const balanceScore = this.calculateBalanceScore(preview);

    return {
      id: 'adaptive',
      name: 'Organisation Adaptative',
      description: 'Organisation optimisée basée sur vos patterns spécifiques',
      hierarchy: hierarchyLevels,
      levels: hierarchyLevels.length,
      estimatedFolders,
      avgFilesPerFolder: analysis.totalFiles / estimatedFolders,
      maxDepth: hierarchyLevels.length,
      balanceScore,
      advantages: [
        'Optimisé pour votre collection spécifique',
        'Équilibrage automatique des dossiers',
        'Hiérarchie minimale nécessaire',
        'Adapté aux patterns découverts'
      ],
      disadvantages: [
        'Moins standardisé',
        'Peut nécessiter adaptation pour nouvelles collections',
        'Structure moins prévisible'
      ],
      preview,
      compatibilityScore: this.calculateAdaptiveCompatibility(matrix, analysis)
    };
  }

  /**
   * Détermine la hiérarchie optimale basée sur l'analyse
   */
  private determineOptimalHierarchy(analysis: any): string[] {
    const levels = [];

    // Analyser la distribution pour déterminer l'ordre optimal
    const distributions = [
      { name: 'Family', size: analysis.familyDistribution.size, variance: this.calculateVariance(analysis.familyDistribution) },
      { name: 'Type', size: analysis.typeDistribution.size, variance: this.calculateVariance(analysis.typeDistribution) },
      { name: 'Style', size: analysis.styleDistribution.size, variance: this.calculateVariance(analysis.styleDistribution) }
    ];

    // Trier par équilibrage (faible variance = bon pour niveau supérieur)
    distributions.sort((a, b) => a.variance - b.variance);

    // Construire hiérarchie optimale
    levels.push(distributions[0].name); // Le plus équilibré en premier

    // Ajouter les autres niveaux
    if (distributions[1].size > 1) levels.push(distributions[1].name);
    if (distributions[2].size > 1) levels.push(distributions[2].name);

    // Toujours finir par Function si pertinent
    if (analysis.functionDistribution.size > 1) {
      levels.push('Function');
    }

    return levels.length >= 2 ? levels : ['Type', 'Family']; // Minimum 2 niveaux
  }

  /**
   * Calcule la variance d'une distribution
   */
  private calculateVariance(distribution: Map<string, number>): number {
    const values = Array.from(distribution.values());
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
    return variance;
  }

  /**
   * Génère un arbre de preview pour une hiérarchie donnée
   */
  private generatePreviewTree(matrix: AdaptiveMatrix, hierarchy: string[]): StructurePreviewNode[] {
    const rootNodes = new Map<string, StructurePreviewNode>();

    for (const [key, entry] of Object.entries(matrix)) {
      let currentLevel = rootNodes;
      let currentPath = '';

      for (let i = 0; i < hierarchy.length; i++) {
        const levelName = hierarchy[i];
        const levelValue = this.getLevelValue(entry, levelName);

        currentPath += (currentPath ? '/' : '') + levelValue;

        if (!currentLevel.has(levelValue)) {
          currentLevel.set(levelValue, {
            level: i,
            name: levelValue,
            path: currentPath,
            estimatedFiles: 0,
            examples: [],
            children: new Map()
          });
        }

        const node = currentLevel.get(levelValue)!;
        node.estimatedFiles += entry.totalFiles;

        if (node.examples.length < 3 && !node.examples.includes(entry.examples[0])) {
          node.examples.push(...entry.examples.slice(0, 1));
        }

        if (!(node.children instanceof Map)) {
          node.children = new Map<string, StructurePreviewNode>();
        }

        currentLevel = node.children as Map<string, StructurePreviewNode>;
      }
    }

    return this.convertMapToArray(rootNodes);
  }

  /**
   * Convertit une Map de nodes en array, triée
   */
  private convertMapToArray(nodeMap: Map<string, StructurePreviewNode>): StructurePreviewNode[] {
    return Array.from(nodeMap.values())
      .map(node => ({
        ...node,
        children: node.children instanceof Map
          ? this.convertMapToArray(node.children as Map<string, StructurePreviewNode>)
          : Array.isArray(node.children)
            ? node.children
            : undefined
      }))
      .sort((a, b) => b.estimatedFiles - a.estimatedFiles); // Trier par taille décroissante
  }

  /**
   * Obtient la valeur d'un niveau pour une entrée
   */
  private getLevelValue(entry: MatrixEntry, level: string): string {
    switch (level) {
      case 'Family': return entry.family;
      case 'Type': return entry.type;
      case 'Style': return entry.style;
      case 'Function': return entry.functions[0] || 'Mixed';
      case 'Variant': return entry.variants[0] || 'Standard';
      default: return 'Unknown';
    }
  }

  /**
   * Estime le nombre total de dossiers
   */
  private estimateFolders(nodes: StructurePreviewNode[]): number {
    let count = nodes.length;
    for (const node of nodes) {
      if (node.children) {
        const childrenArray = node.children instanceof Map
          ? this.convertMapToArray(node.children as Map<string, StructurePreviewNode>)
          : Array.isArray(node.children)
            ? node.children
            : [];
        count += this.estimateFolders(childrenArray);
      }
    }
    return count;
  }

  /**
   * Calcule le score d'équilibrage d'un arbre
   */
  private calculateBalanceScore(nodes: StructurePreviewNode[]): number {
    if (nodes.length === 0) return 1;

    const fileCounts = nodes.map(n => n.estimatedFiles);
    const mean = fileCounts.reduce((a, b) => a + b, 0) / fileCounts.length;
    const variance = fileCounts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / fileCounts.length;

    // Score inversé : faible variance = bon équilibrage
    return Math.max(0, 1 - (Math.sqrt(variance) / mean));
  }

  /**
   * Calcule les recommandations
   */
  private calculateRecommendations(proposals: StructureProposal[], statistics: any): StructureRecommendation {
    const scores = proposals.map(proposal => {
      const balanceScore = proposal.balanceScore * this.config.balanceWeight;
      const compatibilityScore = proposal.compatibilityScore * this.config.compatibilityWeight;
      const simplicityScore = (1 - (proposal.levels - 2) / 4) * this.config.simplicityWeight; // Favorise 2-3 niveaux

      return {
        id: proposal.id,
        score: balanceScore + compatibilityScore + simplicityScore,
        balanceScore,
        compatibilityScore,
        simplicityScore
      };
    });

    scores.sort((a, b) => b.score - a.score);

    const winner = scores[0];
    const alternatives = scores.slice(1).map(s => ({
      id: s.id,
      reason: this.getRecommendationReason(s, proposals.find(p => p.id === s.id)!),
      score: s.score
    }));

    return {
      recommendedId: winner.id,
      reason: this.getRecommendationReason(winner, proposals.find(p => p.id === winner.id)!),
      confidence: winner.score,
      alternatives
    };
  }

  /**
   * Génère une raison pour une recommandation
   */
  private getRecommendationReason(score: any, proposal: StructureProposal): string {
    const strengths = [];

    if (score.balanceScore > 0.7) strengths.push('bien équilibré');
    if (score.compatibilityScore > 0.8) strengths.push('très compatible');
    if (score.simplicityScore > 0.7) strengths.push('simple à naviguer');

    return `${proposal.name}: ${strengths.join(', ')} (score: ${score.score.toFixed(2)})`;
  }

  /**
   * Calcule la compatibilité taxonomique
   */
  private calculateTaxonomicCompatibility(matrix: AdaptiveMatrix): number {
    const entries = Object.values(matrix);
    const taxonomicEntries = entries.filter(e => e.taxonomySource);
    return taxonomicEntries.length / entries.length;
  }

  /**
   * Calcule la compatibilité type-first
   */
  private calculateTypeFirstCompatibility(analysis: any): number {
    // Favorable si distribution équilibrée des types
    return Math.min(1, analysis.typeDistribution.size / 8); // Score basé sur diversité des types
  }

  /**
   * Calcule la compatibilité adaptative
   */
  private calculateAdaptiveCompatibility(matrix: AdaptiveMatrix, analysis: any): number {
    // Score basé sur l'équilibrage global
    return analysis.totalEntries > 10 ? 0.9 : 0.7; // Favorable pour collections importantes
  }

  /**
   * Calcule les métriques de complexité
   */
  private calculateComplexityMetrics(proposals: StructureProposal[], packs: ClassifiedPack[]): ComplexityMetrics {
    const avgFolders = proposals.reduce((sum, p) => sum + p.estimatedFolders, 0) / proposals.length;
    const avgDepth = proposals.reduce((sum, p) => sum + p.maxDepth, 0) / proposals.length;

    const organizationalComplexity = Math.min(1, (avgFolders * avgDepth) / 100);
    const userDecisionPoints = proposals.length > 1 ? 1 : 0; // Choix entre propositions

    // Estimation temps : ~1min par 50 dossiers + 2min setup
    const estimatedTimeMinutes = Math.ceil(avgFolders / 50) + 2;

    const riskFactors = [];
    if (organizationalComplexity > 0.7) riskFactors.push('Structure complexe');
    if (avgDepth > 4) riskFactors.push('Hiérarchie profonde');
    if (packs.length > 100) riskFactors.push('Collection importante');

    return {
      organizationalComplexity,
      userDecisionPoints,
      estimatedTimeMinutes,
      riskFactors
    };
  }

  /**
   * Validation des données d'entrée
   */
  validate(input: StructureProposalInput): ValidationResult {
    const errors: string[] = [];

    if (!input.adaptiveMatrix || Object.keys(input.adaptiveMatrix).length === 0) {
      errors.push('Empty or missing adaptive matrix');
    }

    if (!input.classifiedPacks || input.classifiedPacks.length === 0) {
      errors.push('No classified packs provided');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: [],
      canProceedWithWarnings: errors.length === 0
    };
  }

  getName(): string {
    return 'Structure Proposal V6';
  }

  getDescription(): string {
    return 'Génère des propositions de structure hiérarchique basées sur la matrice adaptative';
  }

  estimateTime(input: StructureProposalInput): number {
    const matrixSize = Object.keys(input.adaptiveMatrix || {}).length;

    // Estimation : ~0.05s par entrée de matrice + 2s overhead
    return Math.max(2, Math.ceil(matrixSize * 0.05 + 2));
  }

  canRetry(): boolean {
    return true;
  }
}
