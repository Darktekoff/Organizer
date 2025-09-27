# 🔥 Workflow Multi-Étapes - Référence Rapide

## 🚨 **RÈGLES D'OR**

1. **Un step = Un contrat de données explicite**
2. **Toujours valider les inputs avant exécution**
3. **Handler IPC doit couvrir TOUS les steps**
4. **État explicite > État inféré**

---

## ⚡ **CHECKLIST AVANT COMMIT**

### Frontend (UI)
- [ ] Step numbers correspondent aux backend steps
- [ ] Données passées à `continuePhase()` sont correctes pour chaque step
- [ ] UI affiche l'état actuel clairement
- [ ] Validation côté client avant envoi

### IPC Handler
- [ ] **TOUS** les `fromStep` sont gérés dans les conditions
- [ ] `previousStepData` est passé correctement
- [ ] Logs explicitent les données reçues

### Controller
- [ ] Tous les `resumeFromStep` sont gérés
- [ ] Validation des `previousStepData` avant usage
- [ ] `userActionRequired` retourné quand approprié

### Step Implementation
- [ ] Validation stricte des inputs
- [ ] Retour consistant (success/error/userActionRequired)
- [ ] Logs détaillés pour debug

---

## 🎯 **TEMPLATE DE STEP**

```typescript
export class StepX implements StepContract<InputType, OutputType> {
  async execute(
    input: InputType,
    onProgress?: ProgressCallback
  ): Promise<StepResult<OutputType>> {

    // 1. VALIDATION STRICTE
    const validation = this.validateInput(input);
    if (!validation.valid) {
      return {
        success: false,
        error: { code: 'INVALID_INPUT', message: validation.errors.join(', ') }
      };
    }

    // 2. LOGS EXPLICITES
    console.log(`🚀 Step${X} execute started with:`, {
      inputKeys: Object.keys(input),
      criticalData: input.criticalField
    });

    try {
      // 3. LOGIC WITH PROGRESS
      onProgress?.(10, 'Starting...');
      const result = await this.doWork(input);
      onProgress?.(100, 'Completed');

      // 4. USER ACTION CHECK
      if (this.requiresUserValidation(result)) {
        return {
          success: true,
          data: result,
          canProceed: false,
          userActionRequired: {
            type: 'confirmation',
            title: 'Step X Validation',
            message: 'Please review and confirm'
          }
        };
      }

      // 5. SUCCESS
      return {
        success: true,
        data: result,
        canProceed: true
      };

    } catch (error) {
      console.error(`❌ Step${X} failed:`, error);
      return {
        success: false,
        error: {
          code: 'STEP_X_ERROR',
          message: error.message,
          recoverable: true
        }
      };
    }
  }

  private validateInput(input: InputType): ValidationResult {
    // Validation stricte ici
  }
}
```

---

## 🛠️ **DEBUGGING WORKFLOW ISSUES**

### Symptôme : "Ça restart au Step 1"
1. ✅ Vérifier handler IPC couvre le `fromStep`
2. ✅ Vérifier `resumeFromStep` dans controller
3. ✅ Vérifier `previousStepData` est passé

### Symptôme : "Données manquantes"
1. ✅ Vérifier contrat de données frontend → IPC
2. ✅ Vérifier validation input dans step
3. ✅ Vérifier structure `previousStepData`

### Symptôme : "UI out of sync"
1. ✅ Vérifier `userActionRequired` est retourné
2. ✅ Vérifier `canProceed` flags
3. ✅ Vérifier state management frontend

---

## 📊 **LOGS À AJOUTER**

```typescript
// Dans IPC Handler
console.log(`📡 IPC: continue-phase ${phase}.${fromStep}`, {
  dataKeys: Object.keys(data),
  dataSize: JSON.stringify(data).length
});

// Dans Controller
console.log(`🎯 Controller: resuming from step ${resumeFromStep}`, {
  hasPreiousData: !!previousStepData,
  previousDataKeys: previousStepData ? Object.keys(previousStepData) : []
});

// Dans Step
console.log(`✅ Step${X} completed:`, {
  success: result.success,
  hasData: !!result.data,
  hasUserAction: !!result.userActionRequired,
  canProceed: result.canProceed
});
```

---

**💡 Remember: Explicit is better than implicit!**

*Référence rapide - Voir WORKFLOW_PATTERNS.md pour détails complets*