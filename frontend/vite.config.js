import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Deployed to GitHub Pages under /wpr-education/.
// publicDir points at the pipeline's committed output: data/index.json,
// data/state.json and data/districts/*.json are copied verbatim into the
// build root and fetched at runtime relative to BASE_URL. The pipeline
// validator guarantees their shape; the frontend adds no defensive layer.
export default defineConfig({
  base: '/wpr-education/',
  publicDir: '../data',
  plugins: [react()],
})
