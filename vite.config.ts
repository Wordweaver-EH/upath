import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('./package.json');

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        'process.env.REACT_APP_P3_2_APPROACH': JSON.stringify(env.REACT_APP_P3_2_APPROACH),
        'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
