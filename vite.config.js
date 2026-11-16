import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works from any GitHub Pages path
  // (project page at /<repo>/ or a user/organisation page at /).
  base: './',
});
