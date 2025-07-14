import { p0_1_node } from './src/graph/nodes/P0_1_Function.ts';
import fs from 'fs';

// Read the transcript
const transcriptContent = fs.readFileSync('./p1s1.txt', 'utf8');

// Create test state with P_NEG1_1 output
const testState = {
  transcripts: [
    {
      id: 'p1s1',
      filename: 'p1s1.txt',
      content: transcriptContent
    }
  ],
  settings: {
    model: 'gemini-2.5-flash',
    temperature: 0
  },
  stepOutputs: {
    P_NEG1_1: {
      "transcript_id": "p1s1.txt",
      "independent_variable_details": "Suggestion 1 (Scored 4/5)",
      "dependent_variable_focus": ["task_performance", "user_experience", "cognitive_load"]
    }
  },
  status: 'running'
};

console.log('Testing P0_1 with real transcript...');
console.log('Transcript lines:', transcriptContent.split('\n').length);

try {
  const result = await p0_1_node(testState);
  console.log('\n✅ P0_1 Result:');
  const output = result.stepOutputs.P0_1;
  console.log('Transcript ID:', output.transcript_id);
  console.log('Line numbered transcript (first 5 lines):');
  output.line_numbered_transcript.slice(0, 5).forEach(line => console.log(line));
  console.log(`...and ${output.line_numbered_transcript.length - 5} more lines`);
  console.log('\nTranscription convention notes:', output.transcription_convention_notes);
  console.log('\nInitial impressions log:', output.initial_impressions_log);
} catch (error) {
  console.error('❌ Error:', error.message);
}