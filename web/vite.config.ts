import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the build works under any GitHub Pages path
  // (e.g. https://<user>.github.io/<repo>/) without hardcoding the repo name.
  base: './',
  plugins: [svelte()],
})
