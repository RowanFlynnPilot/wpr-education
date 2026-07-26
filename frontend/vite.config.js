import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
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
  plugins: [
    react(),
    {
      // og:image must live at a stable absolute URL for link scrapers,
      // so it's copied to the dist root un-hashed.
      name: 'copy-og-image',
      closeBundle() {
        copyFileSync(
          resolve(__dirname, 'src/assets/og-image.png'),
          resolve(__dirname, 'dist/og-image.png'),
        )
      },
    },
  ],
})
