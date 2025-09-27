# 🚀 Guide des Workflows Multi-Étapes

## ⚠️ **LEÇONS CRITIQUES APPRISES**

Cette documentation compile les erreurs coûteuses rencontrées lors du développement du système de pipeline et comment les éviter.

---

## 🔥 **ANTI-PATTERNS À ÉVITER ABSOLUMENT**

### 1. 💀 **Magic Data Passing**

**❌ PROBLÈME RÉEL RENCONTRÉ :**
```typescript
// Phase0UI appelle ça pour Step 2 ET Step 3 :
continuePhase(phase, 2, phase0Data.quickScanResult);
continuePhase(phase, 3, phase0Data.quickScanResult); // MÊME DONNÉES !?

// Mais Step 3 a besoin de MORE que Step 2 !
```

**✅ SOLUTION - Contrats Explicites :**
```typescript
interface StepDataContract {
  step1: { sourcePath: string };
  step2: { detectedPacks: Pack[], planMode: boolean };
  step3: { detectedPacks: Pack[], planData: Plan, executeNow: true };
}

function continuePhase<T extends keyof StepDataContract>(
  phase: number,
  step: T,
  data: StepDataContract[T]
) {
  // TypeScript force la validation !
}
```

### 2. 💀 **Incomplete Handler Coverage**

**❌ PROBLÈME RÉEL RENCONTRÉ :**
```typescript
// main.ts - Handler IPC incomplet
if (phase === 0 && fromStep === 2) {
  // Step 2 géré ✅
}
// Step 3 OUBLIÉ ! → Redémarre Step 1 ❌
```

**✅ SOLUTION - Exhaustive Pattern Matching :**
```typescript
// Utiliser des enums pour forcer la completude
enum WorkflowStep {
  SCAN = 1,
  PLAN = 2,
  EXECUTE = 3
}

function handleStepResume(step: WorkflowStep): void {
  switch (step) {
    case WorkflowStep.SCAN:
      return handleScanResume();
    case WorkflowStep.PLAN:
      return handlePlanResume();
    case WorkflowStep.EXECUTE:
      return handleExecuteResume();
    default:
      // TypeScript force l'exhaustivité !
      const _exhaustive: never = step;
      throw new Error(`Unhandled step: ${step}`);
  }
}
```

### 3. 💀 **Implicit State Inference**

**❌ PROBLÈME RÉEL RENCONTRÉ :**
```typescript
// Devine l'état basé sur la présence de données
const currentStep = hasQuickScan ? 1 : hasPlan ? 2 : hasExecution ? 3 : 0;
// FRAGILE ! Si les données sont corrompues → état incorrect
```

**✅ SOLUTION - Explicit State Machine :**
```typescript
enum WorkflowState {
  PENDING_SCAN = 'pending_scan',
  SCAN_COMPLETED = 'scan_completed',
  PLAN_GENERATED = 'plan_generated',
  EXECUTION_COMPLETED = 'execution_completed'
}

class PhaseWorkflow {
  private state: WorkflowState = WorkflowState.PENDING_SCAN;

  getCurrentStep(): number {
    switch (this.state) {
      case WorkflowState.PENDING_SCAN: return 1;
      case WorkflowState.SCAN_COMPLETED: return 2;
      case WorkflowState.PLAN_GENERATED: return 3;
      default: throw new Error(`Invalid state: ${this.state}`);
    }
  }

  canTransitionTo(targetState: WorkflowState): boolean {
    // Validation explicite des transitions
    const validTransitions: Record<WorkflowState, WorkflowState[]> = {
      [WorkflowState.PENDING_SCAN]: [WorkflowState.SCAN_COMPLETED],
      [WorkflowState.SCAN_COMPLETED]: [WorkflowState.PLAN_GENERATED],
      [WorkflowState.PLAN_GENERATED]: [WorkflowState.EXECUTION_COMPLETED]
    };

    return validTransitions[this.state]?.includes(targetState) ?? false;
  }
}
```

### 4. 💀 **Silent Data Corruption**

**❌ PROBLÈME RÉEL RENCONTRÉ :**
```typescript
// Pas de validation → données corrompues non détectées
input.previousStepData // Peut être undefined, wrong type, etc.
```

**✅ SOLUTION - Defensive Programming :**
```typescript
import { z } from 'zod';

const StepDataSchema = z.object({
  detectedPacks: z.array(z.object({
    id: z.string(),
    name: z.string(),
    path: z.string()
  })),
  totalSamples: z.number(),
  chaosScore: z.number().min(0).max(1)
});

function validateStepData(data: unknown): StepData {
  try {
    return StepDataSchema.parse(data);
  } catch (error) {
    console.error('❌ WORKFLOW DATA CORRUPTION DETECTED:', error);
    throw new Error(`Invalid step data: ${error.message}`);
  }
}

// Usage
const validatedData = validateStepData(input.previousStepData);
```

---

## 🎯 **PATTERNS ÉPROUVÉS À SUIVRE**

### 1. ✅ **Explicit Workflow Contract**

```typescript
interface WorkflowContract<TInput, TOutput> {
  readonly stepNumber: number;
  readonly requiredInputs: Array<keyof TInput>;
  readonly guaranteedOutputs: Array<keyof TOutput>;

  validate(input: TInput): Promise<ValidationResult>;
  execute(input: TInput): Promise<TOutput>;
  canResume(data: unknown): boolean;
}

class ScanStep implements WorkflowContract<ScanInput, ScanOutput> {
  readonly stepNumber = 1;
  readonly requiredInputs = ['sourcePath'] as const;
  readonly guaranteedOutputs = ['detectedPacks', 'totalSamples'] as const;

  async validate(input: ScanInput): Promise<ValidationResult> {
    if (!input.sourcePath || !fs.existsSync(input.sourcePath)) {
      return { valid: false, errors: ['Invalid source path'] };
    }
    return { valid: true, errors: [] };
  }
}
```

### 2. ✅ **Step Resume Safety**

```typescript
interface StepResumeContext {
  readonly stepNumber: number;
  readonly previousResults: Map<number, any>;
  readonly canSkipTo: Set<number>;
}

class WorkflowController {
  async resumeFromStep(step: number, context: StepResumeContext): Promise<void> {
    // 1. Valider que la reprise est possible
    if (!context.canSkipTo.has(step)) {
      throw new Error(`Cannot resume from step ${step}. Valid steps: ${Array.from(context.canSkipTo)}`);
    }

    // 2. Valider que les résultats précédents sont disponibles
    const requiredPreviousSteps = this.getRequiredPreviousSteps(step);
    for (const requiredStep of requiredPreviousSteps) {
      if (!context.previousResults.has(requiredStep)) {
        throw new Error(`Missing result from step ${requiredStep} required for step ${step}`);
      }
    }

    // 3. Exécuter avec validation
    await this.executeStep(step, context);
  }
}
```

### 3. ✅ **Progress Visibility**

```typescript
interface WorkflowMonitor {
  trackStepStart(step: number, input: any): void;
  trackStepComplete(step: number, output: any, duration: number): void;
  trackStepError(step: number, error: Error): void;
  trackDataFlow(from: string, to: string, dataSize: number): void;
}

class ConsoleWorkflowMonitor implements WorkflowMonitor {
  trackStepStart(step: number, input: any): void {
    console.log(`🚀 WORKFLOW: Starting Step ${step}`, {
      inputKeys: Object.keys(input),
      inputDataSize: JSON.stringify(input).length,
      timestamp: new Date().toISOString()
    });
  }

  trackDataFlow(from: string, to: string, dataSize: number): void {
    console.log(`📊 DATA FLOW: ${from} → ${to} (${dataSize} bytes)`);

    if (dataSize > 1024 * 1024) { // > 1MB
      console.warn(`⚠️ LARGE DATA TRANSFER: ${dataSize} bytes might cause performance issues`);
    }
  }
}
```

---

## 🧪 **STRATÉGIES DE TESTING**

### 1. **Test Each Step Transition**

```typescript
describe('Phase 0 Workflow', () => {
  let workflow: WorkflowController;

  beforeEach(() => {
    workflow = new WorkflowController();
  });

  test('Step 1 → Step 2: Scan produces valid plan input', async () => {
    const scanResult = await workflow.executeStep(1, { sourcePath: '/test' });

    // Vérifier que Step 1 produit ce que Step 2 attend
    expect(scanResult.detectedPacks).toBeDefined();
    expect(scanResult.detectedPacks).toHaveLength(expectedPackCount);

    // Test de la transition
    const planResult = await workflow.executeStep(2, scanResult);
    expect(planResult.operations).toBeDefined();
  });

  test('Step 2 → Step 3: Plan produces valid execution input', async () => {
    const scanResult = mockScanResult();
    const planResult = await workflow.executeStep(2, scanResult);

    // Test reprise
    const executionResult = await workflow.resumeFromStep(3, {
      stepNumber: 3,
      previousResults: new Map([[1, scanResult], [2, planResult]]),
      canSkipTo: new Set([3])
    });

    expect(executionResult.success).toBe(true);
  });

  test('Cannot skip steps without prerequisite data', async () => {
    await expect(
      workflow.resumeFromStep(3, {
        stepNumber: 3,
        previousResults: new Map(), // EMPTY!
        canSkipTo: new Set([3])
      })
    ).rejects.toThrow('Missing result from step');
  });
});
```

### 2. **Contract Validation Tests**

```typescript
describe('Workflow Data Contracts', () => {
  test('Each step validates its input schema', async () => {
    const step2 = new PlanStep();

    // Test données valides
    const validInput = { detectedPacks: [mockPack()], sourcePath: '/test' };
    const validation = await step2.validate(validInput);
    expect(validation.valid).toBe(true);

    // Test données invalides
    const invalidInput = { detectedPacks: null }; // Missing sourcePath
    const invalidValidation = await step2.validate(invalidInput);
    expect(invalidValidation.valid).toBe(false);
    expect(invalidValidation.errors).toContain('sourcePath is required');
  });
});
```

---

## 🚨 **SIGNAUX D'ALARME - QUAND INTERVENIR**

### 🔴 **Red Flags Critiques**

1. **"Ça marche parfois"** → State management défaillant
2. **"Il faut restart l'app"** → Cleanup défaillant entre workflows
3. **"Ça skip des étapes"** → Handler IPC incomplet
4. **"Les données disparaissent"** → Contrats non respectés

### 🟡 **Warning Signs**

1. **Code dupliqué entre steps** → Abstractions manquantes
2. **Conditions complexes basées sur données** → State machine needed
3. **Magic numbers pour les steps** → Enums manquants
4. **Try/catch sans logging** → Debugging nightmare

---

## 📋 **CHECKLIST PRE-COMMIT**

Avant de merger un workflow multi-étapes :

- [ ] **Tous les steps ont des handlers IPC**
- [ ] **Validation des données d'entrée à chaque step**
- [ ] **Tests de chaque transition step-to-step**
- [ ] **Logs explicites des states et transitions**
- [ ] **Gestion d'erreur avec recovery/rollback**
- [ ] **Documentation des contrats de données**
- [ ] **Validation que skip/resume fonctionne**

---

## 🎯 **EN RÉSUMÉ**

**Les workflows multi-étapes sont des CONTRATS entre couches.**

Chaque break dans le contrat cascade dans tout le système. Toujours designer en pensant :

1. ✅ **Données CONSOMMÉES par chaque étape**
2. ✅ **Données PRODUITES par chaque étape**
3. ✅ **Comment REPRENDRE à chaque étape**
4. ✅ **Comment VALIDER chaque transition**

**Règle d'or :** Si tu ne peux pas facilement expliquer le flow à quelqu'un d'autre, c'est que c'est trop complexe !

---

*Documentation créée suite aux incidents Phase 0 - Septembre 2025*
*"Learn from pain so others don't have to suffer" - Team Motto*