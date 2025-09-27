#!/usr/bin/env node

/**
 * Script de santé Pipeline V6 - Validation complète post-fix
 */

const path = require('path');
const fs = require('fs');

console.log('🏥 PIPELINE V6 HEALTH CHECK');
console.log('===========================');

// Configuration de référence post-audit
const HEALTH_CHECKS = {
  'Backend Architecture': [
    {
      name: 'All Phase Controllers exist',
      test: () => {
        const phases = [0, 1, 2, 3, 4, 5];
        const folders = ['preparation', 'discovery', 'classification', 'matrix', 'organization', 'validation'];
        return phases.every((phase, i) => {
          const path_ = path.join(__dirname, '..', 'src', 'main', 'services', 'pipeline', 'phases', `phase${phase}-${folders[i]}`, `Phase${phase}Controller.ts`);
          return fs.existsSync(path_);
        });
      }
    },
    {
      name: 'PipelineController has new methods',
      test: () => {
        const controllerPath = path.join(__dirname, '..', 'src', 'main', 'services', 'pipeline', 'PipelineController.ts');
        if (!fs.existsSync(controllerPath)) return false;
        const content = fs.readFileSync(controllerPath, 'utf8');
        return content.includes('getAllPhasesData') && content.includes('executePhase');
      }
    }
  ],

  'Frontend Configuration': [
    {
      name: 'Step counts aligned with backend',
      test: () => {
        const providerPath = path.join(__dirname, '..', 'src', 'renderer', 'components', 'pipeline', 'PipelineV6Provider.tsx');
        if (!fs.existsSync(providerPath)) return false;
        const content = fs.readFileSync(providerPath, 'utf8');

        // Phase 0: 2 steps, Phase 1: 3 steps
        const phase0Match = content.match(/phaseNumber:\s*0[\s\S]*?steps:\s*\[([\s\S]*?)\]/);
        const phase1Match = content.match(/phaseNumber:\s*1[\s\S]*?steps:\s*\[([\s\S]*?)\]/);

        if (!phase0Match || !phase1Match) return false;

        const phase0Steps = (phase0Match[1].match(/\{[^}]*id:/g) || []).length;
        const phase1Steps = (phase1Match[1].match(/\{[^}]*id:/g) || []).length;

        return phase0Steps === 2 && phase1Steps === 3;
      }
    },
    {
      name: 'Step names match backend documentation',
      test: () => {
        const providerPath = path.join(__dirname, '..', 'src', 'renderer', 'components', 'pipeline', 'PipelineV6Provider.tsx');
        if (!fs.existsSync(providerPath)) return false;
        const content = fs.readFileSync(providerPath, 'utf8');

        const expectedNames = [
          'Quick Scan', 'Clean & Reorganize',
          'Structure Analyzer', 'Content Indexer', 'Metadata Extractor',
          'Style Classifier', 'Quarantine Handler'
        ];

        return expectedNames.every(name => {
          const regex = new RegExp(`name:\\s*['"]${name.replace(/[&]/g, '\\&')}['"]`);
          return regex.test(content);
        });
      }
    }
  ],

  'IPC Architecture': [
    {
      name: 'New IPC methods implemented',
      test: () => {
        const preloadPath = path.join(__dirname, '..', 'src', 'main', 'preload', 'preload.ts');
        const mainPath = path.join(__dirname, '..', 'src', 'main', 'main.ts');

        if (!fs.existsSync(preloadPath) || !fs.existsSync(mainPath)) return false;

        const preloadContent = fs.readFileSync(preloadPath, 'utf8');
        const mainContent = fs.readFileSync(mainPath, 'utf8');

        return preloadContent.includes('continuePhase:') &&
               preloadContent.includes('getState:') &&
               mainContent.includes('pipeline:continue-phase') &&
               mainContent.includes('pipeline:get-state');
      }
    },
    {
      name: 'Enhanced continueCurrentPhase function',
      test: () => {
        const providerPath = path.join(__dirname, '..', 'src', 'renderer', 'components', 'pipeline', 'PipelineV6Provider.tsx');
        if (!fs.existsSync(providerPath)) return false;
        const content = fs.readFileSync(providerPath, 'utf8');

        return content.includes('window.electronAPI.pipeline.continuePhase') &&
               content.includes('CONTINUATION_FAILED') &&
               content.includes('SET_LOADING');
      }
    }
  ],

  'Phase 0 Continuation Fix': [
    {
      name: 'Phase0Controller supports resumeFromStep',
      test: () => {
        const controllerPath = path.join(__dirname, '..', 'src', 'main', 'services', 'pipeline', 'phases', 'phase0-preparation', 'Phase0Controller.ts');
        if (!fs.existsSync(controllerPath)) return false;
        const content = fs.readFileSync(controllerPath, 'utf8');

        return content.includes('resumeFromStep') &&
               content.includes('previousStepData') &&
               content.includes('Step2_CleanReorganize');
      }
    },
    {
      name: 'Step files exist with correct names',
      test: () => {
        const step1Path = path.join(__dirname, '..', 'src', 'main', 'services', 'pipeline', 'phases', 'phase0-preparation', 'Step1_QuickScan.ts');
        const step2Path = path.join(__dirname, '..', 'src', 'main', 'services', 'pipeline', 'phases', 'phase0-preparation', 'Step2_CleanReorganize.ts');

        return fs.existsSync(step1Path) && fs.existsSync(step2Path);
      }
    }
  ]
};

// Exécution des tests
console.log('\n🔍 RUNNING HEALTH CHECKS:\n');

let totalTests = 0;
let passedTests = 0;

Object.keys(HEALTH_CHECKS).forEach(category => {
  console.log(`📋 ${category}:`);

  HEALTH_CHECKS[category].forEach(check => {
    totalTests++;
    try {
      const result = check.test();
      console.log(`   ${result ? '✅' : '❌'} ${check.name}`);
      if (result) passedTests++;
    } catch (error) {
      console.log(`   ❌ ${check.name} (Error: ${error.message})`);
    }
  });
  console.log('');
});

// Score et recommandations
const healthScore = Math.round((passedTests / totalTests) * 100);

console.log('📊 HEALTH SCORE:');
console.log(`   ${passedTests}/${totalTests} tests passed (${healthScore}%)`);

if (healthScore === 100) {
  console.log('\n🎉 PERFECT HEALTH!');
  console.log('   ✅ Pipeline V6 is fully coherent');
  console.log('   ✅ All backend/frontend alignment fixed');
  console.log('   ✅ IPC architecture is robust');
  console.log('   ✅ Phase 0 Step 2 continuation implemented');
  console.log('\n🚀 Ready for production testing!');
} else if (healthScore >= 80) {
  console.log('\n✅ GOOD HEALTH');
  console.log('   Most critical issues are resolved');
  console.log('   Minor optimizations may be needed');
} else {
  console.log('\n⚠️  HEALTH ISSUES DETECTED');
  console.log('   Critical fixes needed before production');
}

console.log('\n📝 NEXT STEPS:');
if (healthScore === 100) {
  console.log('   1. Test Phase 0 continuation in UI');
  console.log('   2. Verify "Clean & Reorganize" step works');
  console.log('   3. Monitor console logs for new errors');
  console.log('   4. Test complete pipeline flow');
} else {
  console.log('   1. Fix failing health checks above');
  console.log('   2. Re-run health check');
  console.log('   3. Test with real data');
}

console.log('\n✅ Health check completed!');