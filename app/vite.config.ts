import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// La app vive dentro del sitio tak! y se sirve en /admin (también /dashboard y /tip/*
// por rewrite). El build se escribe en ../admin para que el sitio estático lo publique.
export default defineConfig({
  base: '/admin/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    outDir: path.resolve(__dirname, '../admin'),
    emptyOutDir: true,
  },
})
