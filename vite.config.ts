import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { pagesEntries } from './scripts/pages.mjs'

export default defineConfig({
  base: '/',
  plugins: [react(), pagesEntries()],
})
