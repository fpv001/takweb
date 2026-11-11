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
        // React y Supabase los usa toda la app: archivos propios que se cachean entre despliegues.
        // Gráficas y anime.js quedan en los chunks de las rutas que los usan (Rollup los reparte solo).
        manualChunks(id) {
          if (/node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react'
          if (id.includes('node_modules/@supabase')) return 'supabase'
        },
      },
    },
  },
})
