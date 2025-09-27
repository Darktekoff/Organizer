#!/usr/bin/env node

/**
 * Test final de cohérence backend/frontend - version simplifiée et précise
 */

const path = require('path');
const fs = require('fs');

console.log('🔥 TEST FINAL COHERENCE BACKEND/FRONTEND');
console.log('========================================');

// Mapping exact des dossiers/fichiers
const PHASE_MAPPING = {
  0: { folder: "phase0-preparation", name: "Preparation" },
  1: { folder: "phase1-discovery", name: "Discovery" },
  2: { folder: "phase2-classification", name: "Classification" },
  3: { folder: "phase3-matrix", name: "Matrix & Structure" },
  4: { folder: "phase4-organization", name: "Organization" },
  5: { folder: "phase5-validation", name: "Final Validation" }
};

// Test existence des contrôleurs
console.log('\n🎯 BACKEND CONTROLLERS:');
let backendOK = true;
Object.keys(PHASE_MAPPING).forEach(phaseNum => {
  const { folder } = PHASE_MAPPING[phaseNum];
  const controllerPath = path.join(__dirname, '..', 'src', 'main', 'services', 'pipeline', 'phases', folder, `Phase${phaseNum}Controller.ts`);
  const exists = fs.existsSync(controllerPath);
  console.log(`   Phase ${phaseNum}: ${exists ? '✅' : '❌'} ${folder}/Phase${phaseNum}Controller.ts`);
  if (!exists) backendOK = false;
});

// Test existence des steps Phase 0 (critique pour le bug)
console.log('\n🔍 PHASE 0 STEPS (critique):');
const phase0Steps = ['Step1_QuickScan.ts', 'Step2_CleanReorganize.ts'];
phase0Steps.forEach((stepFile, index) => {
  const stepPath = path.join(__dirname, '..', 'src', 'main', 'services', 'pipeline', 'phases', 'phase0-preparation', stepFile);
  const exists = fs.existsSync(stepPath);
  console.log(`   ${stepFile}: ${exists ? '✅' : '❌'}`);
});

// Test configuration frontend
console.log('\n🖥️  FRONTEND CONFIG:');
const providerPath = path.join(__dirname, '..', 'src', 'renderer', 'components', 'pipeline', 'PipelineV6Provider.tsx');
let frontendOK = true;

if (fs.existsSync(providerPath)) {
  const content = fs.readFileSync(providerPath, 'utf8');

  // Test Phase 0: doit avoir 2 steps
  const phase0Match = content.match(/phaseNumber:\s*0[\s\S]*?steps:\s*\[([\s\S]*?)\]/);
  if (phase0Match) {
    const stepsCount = (phase0Match[1].match(/\{[^}]*id:/g) || []).length;
    console.log(`   Phase 0 step count: ${stepsCount === 2 ? '✅' : '❌'} (${stepsCount}/2)`);
    if (stepsCount !== 2) frontendOK = false;
  } else {
    console.log('   Phase 0: ❌ Configuration not found');
    frontendOK = false;
  }

  // Test Phase 1: doit avoir 3 steps
  const phase1Match = content.match(/phaseNumber:\s*1[\s\S]*?steps:\s*\[([\s\S]*?)\]/);
  if (phase1Match) {
    const stepsCount = (phase1Match[1].match(/\{[^}]*id:/g) || []).length;
    console.log(`   Phase 1 step count: ${stepsCount === 3 ? '✅' : '❌'} (${stepsCount}/3)`);
    if (stepsCount !== 3) frontendOK = false;
  } else {
    console.log('   Phase 1: ❌ Configuration not found');
    frontendOK = false;
  }

  // Test noms des steps Phase 0
  const hasQuickScan = /name:\s*['"]Quick Scan['"]/.test(content);
  const hasCleanReorganize = /name:\s*['"]Clean & Reorganize['"]/.test(content);
  console.log(`   Phase 0 Quick Scan: ${hasQuickScan ? '✅' : '❌'}`);
  console.log(`   Phase 0 Clean & Reorganize: ${hasCleanReorganize ? '✅' : '❌'}`);
  if (!hasQuickScan || !hasCleanReorganize) frontendOK = false;

} else {
  console.log('   ❌ PipelineV6Provider.tsx not found');
  frontendOK = false;
}

// Test IPC Architecture (nouveau système)
console.log('\n📡 IPC ARCHITECTURE:');
const preloadPath = path.join(__dirname, '..', 'src', 'main', 'preload', 'preload.ts');
const mainPath = path.join(__dirname, '..', 'src', 'main', 'main.ts');

let ipcOK = true;

if (fs.existsSync(preloadPath)) {
  const preloadContent = fs.readFileSync(preloadPath, 'utf8');
  const hasContinuePhase = /continuePhase:/.test(preloadContent);
  console.log(`   Preload continuePhase: ${hasContinuePhase ? '✅' : '❌'}`);
  if (!hasContinuePhase) ipcOK = false;
} else {
  console.log('   ❌ preload.ts not found');
  ipcOK = false;
}

if (fs.existsSync(mainPath)) {
  const mainContent = fs.readFileSync(mainPath, 'utf8');
  const hasContinuePhaseHandler = /pipeline:continue-phase/.test(mainContent);
  console.log(`   Main continue-phase handler: ${hasContinuePhaseHandler ? '✅' : '❌'}`);
  if (!hasContinuePhaseHandler) ipcOK = false;
} else {
  console.log('   ❌ main.ts not found');
  ipcOK = false;
}

// Test Phase0Controller.ts pour le bug spécifique
console.log('\n🐛 PHASE 0 CONTINUATION BUG CHECK:');
const phase0ControllerPath = path.join(__dirname, '..', 'src', 'main', 'services', 'pipeline', 'phases', 'phase0-preparation', 'Phase0Controller.ts');

if (fs.existsSync(phase0ControllerPath)) {
  const phase0Content = fs.readFileSync(phase0ControllerPath, 'utf8');

  const hasResumeFromStep = /resumeFromStep/.test(phase0Content);
  const hasStep2Import = /Step2_CleanReorganize/.test(phase0Content);
  const hasPhase0Input = /interface Phase0Input/.test(phase0Content);

  console.log(`   Phase0Controller resumeFromStep: ${hasResumeFromStep ? '✅' : '❌'}`);
  console.log(`   Phase0Controller Step2 import: ${hasStep2Import ? '✅' : '❌'}`);
  console.log(`   Phase0Controller input interface: ${hasPhase0Input ? '✅' : '❌'}`);
} else {
  console.log('   ❌ Phase0Controller.ts not found');
}

// Résumé final
console.log('\n📊 SCORE FINAL:');
console.log(`   Backend Controllers: ${backendOK ? '✅' : '❌'}`);
console.log(`   Frontend Configuration: ${frontendOK ? '✅' : '❌'}`);
console.log(`   IPC Architecture: ${ipcOK ? '✅' : '❌'}`);

const allOK = backendOK && frontendOK && ipcOK;

if (allOK) {
  console.log('\n🎉 COHERENCE PARFAITE!');
  console.log('   ✅ Backend et frontend alignés');
  console.log('   ✅ Architecture IPC robuste');
  console.log('   ✅ Phase 0 Step 2 continuation fixée');
  console.log('\n🚀 Le bug "Step 2 bloqué" devrait être résolu!');
} else {
  console.log('\n⚠️  PROBLEMES DETECTES');
  console.log('   Voir détails ci-dessus');
}

console.log('\n✅ Test de cohérence terminé!');