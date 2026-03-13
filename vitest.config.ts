import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Resolve @komatsu-nagm/component-library from source.
const componentLibSrc = path.resolve(__dirname, '../react-template/src/index.ts');

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData.ts',
        'dist/'
      ]
    }
  },
  resolve: {
    dedupe: [
      'react',
      'react-dom',
      '@mui/material',
      '@mui/icons-material',
      '@emotion/react',
      '@emotion/styled',
    ],
    alias: {
      '@komatsu-nagm/component-library': componentLibSrc,
      '@': path.resolve(__dirname, './src')
    }
  }
});
