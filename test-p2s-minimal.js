// Quick test to verify the P2S state management fix
const { execSync } = require('child_process');

try {
  console.log('Running P2S state management tests...\n');
  const result = execSync('npm run test:run -- src/stores/__tests__/pipelineStore.p2s.test.ts', {
    cwd: '/home/enigm/dev/workspace/upath',
    encoding: 'utf8',
    stdio: 'pipe'
  });
  console.log(result);
  console.log('\n✅ All P2S tests passed!');
} catch (error) {
  console.error('❌ Tests failed:\n');
  console.error(error.stdout || error.message);
  console.error(error.stderr);
  process.exit(1);
}