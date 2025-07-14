import { config } from 'dotenv';
import { p_neg1_1_node } from './src/graph/nodes/P_NEG1_1_Function.ts';
import { p0_1_node } from './src/graph/nodes/P0_1_Function.ts';
import fs from 'fs';

// Load environment variables
config();

// Read the transcript
const transcriptContent = fs.readFileSync('./p1s1.txt', 'utf8');

console.log('🧪 Testing Pipeline Sequence: P_NEG1_1 → P0_1');
console.log('================================================');

// Initial state
let currentState = {
  pipelineId: 'test-pipeline-001',
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

console.log('📝 Input Data:');
console.log(`- Transcript: ${currentState.transcripts[0].filename} (${transcriptContent.split('\n').length} lines)`);
console.log(`- User DV Focus: ${currentState.userDvFocus.dv_focus.join(', ')}`);
console.log(`- Model: ${currentState.settings.model}, Temperature: ${currentState.settings.temperature}, Seed: ${currentState.settings.seed}\n`);

try {
  // Step 1: Run P_NEG1_1
  console.log('🔄 Step 1: P_NEG1_1 Variable Identification');
  const step1Result = await p_neg1_1_node(currentState);
  
  // Update state with P_NEG1_1 results
  currentState = {
    ...currentState,
    ...step1Result
  };
  
  console.log('✅ P_NEG1_1 Results:');
  const p_neg1_1_output = currentState.stepOutputs.P_NEG1_1;
  console.log(`- Transcript ID: ${p_neg1_1_output.transcript_id}`);
  console.log(`- Independent Variable: ${p_neg1_1_output.independent_variable_details}`);
  console.log(`- Dependent Variables: ${p_neg1_1_output.dependent_variable_focus.join(', ')}`);
  console.log(`- Current Phase: ${currentState.currentPhase}\n`);
  
  // Step 2: Run P0_1
  console.log('🔄 Step 2: P0_1 Transcription Adherence');
  const step2Result = await p0_1_node(currentState);
  
  // Update state with P0_1 results
  currentState = {
    ...currentState,
    ...step2Result
  };
  
  console.log('✅ P0_1 Results:');
  const p0_1_output = currentState.stepOutputs.P0_1;
  console.log(`- Transcript ID: ${p0_1_output.transcript_id}`);
  console.log(`- Total Lines: ${p0_1_output.line_numbered_transcript.length}`);
  console.log('- First 3 lines:');
  p0_1_output.line_numbered_transcript.slice(0, 3).forEach(line => 
    console.log(`  ${line}`)
  );
  console.log(`- Convention Notes: ${p0_1_output.transcription_convention_notes.substring(0, 100)}...`);
  console.log(`- Initial Impressions: ${p0_1_output.initial_impressions_log.substring(0, 150)}...`);
  console.log(`- Current Phase: ${currentState.currentPhase}\n`);
  
  // Final state summary
  console.log('🎯 Pipeline State Summary:');
  console.log(`- Pipeline ID: ${currentState.pipelineId}`);
  console.log(`- Status: ${currentState.status}`);
  console.log(`- Current Phase: ${currentState.currentPhase}`);
  console.log(`- Completed Steps: ${Object.keys(currentState.stepOutputs).join(', ')}`);
  console.log('\n🎉 Pipeline sequence test completed successfully!');
  
} catch (error) {
  console.error('❌ Pipeline Error:', error.message);
  console.error('Stack:', error.stack);
}