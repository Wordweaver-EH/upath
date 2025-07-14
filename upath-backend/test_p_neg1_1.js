import { p_neg1_1_node } from './src/graph/nodes/P_NEG1_1_Function.ts';
import fs from 'fs';

// Read the transcript
const transcriptContent = fs.readFileSync('./p1s1.txt', 'utf8');

// Create test state
const testState = {
  transcripts: [
    {
      id: 'p1s1',
      filename: 'p1s1.txt',
      content: transcriptContent
    }
  ],
  userDvFocus: ['task_performance', 'user_experience', 'cognitive_load'],
  settings: {
    model: 'gemini-2.5-flash',
    temperature: 0.1
  },
  stepOutputs: {},
  status: 'running'
};

console.log('Testing P_NEG1_1 with real transcript...');
console.log('Transcript preview:', transcriptContent.substring(0, 200));
console.log('User DV Focus:', testState.userDvFocus);

try {
  const result = await p_neg1_1_node(testState);
  console.log('\n✅ P_NEG1_1 Result:');
  console.log(JSON.stringify(result.stepOutputs.P_NEG1_1, null, 2));
} catch (error) {
  console.error('❌ Error:', error.message);
}