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
    rollupOptions: {
      output: {
        // Librerías en archivos propios: se cachean entre despliegues y solo bajan donde se usan
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (/[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react'
          if (id.includes('@supabase')) return 'supabase'
          if (/@visx|d3-|motion|framer-motion|number-flow/.test(id)) return 'charts'
          if (id.includes('animejs')) return 'anime'
        },
      },
    },
  },
})
