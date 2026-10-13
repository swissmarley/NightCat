import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the built `dist/` works from any sub-path (e.g. GitHub Pages).
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
  },
});
