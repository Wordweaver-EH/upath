import { config } from 'dotenv';
import { p_neg1_1_node } from './src/graph/nodes/P_NEG1_1_Function.ts';
import { p0_1_node } from './src/graph/nodes/P0_1_Function.ts';
import { p0_2_node } from './src/graph/nodes/P0_2_Function.ts';
import fs from 'fs';

// Load environment variables
config();

// Read the transcript
const transcriptContent = fs.readFileSync('./p1s1.txt', 'utf8');

console.log('🧪 Testing P0_2 Refactoring: P_NEG1_1 → P0_1 → P0_2');
console.log('=======================================================');

// Initial state
let currentState = {
  pipelineId: 'test-pipeline-p0_2',
  transcripts: [
    {
      id: 'p1s1',
      filename: 'p1s1.txt',
      content: transcriptContent
    }
  ],
  userDvFocus: { dv_focus: ['cognitions', 'emotions', 'sensations', 'imagination', 'internal_experiences'] },
  settings: {
    model: 'gemini-2.5-flash',
    temperature: 0,
    seed: 42
  },
  stepOutputs: {},
  status: 'running',
  currentPhase: '',
  progress: 0
};

console.log('📝 Testing P0_2 Refactor:');
console.log(`- Model: ${currentState.settings.model}, Temperature: ${currentState.settings.temperature}, Seed: ${currentState.settings.seed}`);
console.log(`- DV Focus: ${currentState.userDvFocus.dv_focus.join(', ')}\n`);

try {
  // Step 1: Run P_NEG1_1
  console.log('🔄 Step 1: P_NEG1_1 Variable Identification');
  const step1Result = await p_neg1_1_node(currentState);
  currentState = { ...currentState, ...step1Result };
  console.log('✅ P_NEG1_1 completed\n');
  
  // Step 2: Run P0_1
  console.log('🔄 Step 2: P0_1 Transcription Adherence');
  const step2Result = await p0_1_node(currentState);
  currentState = { ...currentState, ...step2Result };
  console.log('✅ P0_1 completed\n');
  
  // Step 3: Run P0_2 (NEW REFACTORED VERSION)
  console.log('🔄 Step 3: P0_2 Refine Data Types (NEW FUNCTION)');
  const step3Result = await p0_2_node(currentState);
  currentState = { ...currentState, ...step3Result };
  
  console.log('✅ P0_2 Results:');
  const p0_2_output = currentState.stepOutputs.P0_2;
  console.log(`- Transcript ID: ${p0_2_output.transcript_id}`);
  console.log(`- Total Refined Lines: ${p0_2_output.refined_data_transcript.length}`);
  
  // Show sample of categorized lines
  console.log('- Sample Categorization:');
  p0_2_output.refined_data_transcript.slice(0, 5).forEach(line => {
    console.log(`  Line ${line.line_num}: [${line.information_tags.join(', ')}] - "${line.text.substring(0, 80)}..."`);
  });
  
  console.log(`- Current Phase: ${currentState.currentPhase}\n`);
  
  // Analysis
  const categoryStats = {};
  p0_2_output.refined_data_transcript.forEach(line => {
    line.information_tags.forEach(tag => {
      categoryStats[tag] = (categoryStats[tag] || 0) + 1;
    });
  });
  
  console.log('📊 Categorization Statistics:');
  Object.entries(categoryStats).forEach(([category, count]) => {
    console.log(`- ${category}: ${count} lines`);
  });
  
  console.log('\n🎯 Pipeline State Summary:');
  console.log(`- Pipeline ID: ${currentState.pipelineId}`);
  console.log(`- Status: ${currentState.status}`);
  console.log(`- Current Phase: ${currentState.currentPhase}`);
  console.log(`- Completed Steps: ${Object.keys(currentState.stepOutputs).join(', ')}`);
  console.log('\n🎉 P0_2 refactoring test completed successfully!');
  console.log('✅ BaseNode → Function conversion SUCCESSFUL!');
  
} catch (error) {
  console.error('❌ P0_2 Test Error:', error.message);
  console.error('Stack:', error.stack);
}