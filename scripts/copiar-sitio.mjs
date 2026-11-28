// Arma la carpeta dist/ que publica Vercel: SOLO lo que el sitio necesita.
// Antes Vercel publicaba la carpeta completa del proyecto (código fuente, migraciones SQL, etc.).
// Se ejecuta después de `npm --prefix app run build` (que genera admin/).
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const out = join(root, 'dist')

// Archivos y carpetas públicos del sitio. Si agregas una página o asset nuevo en la raíz, agrégalo aquí.
const PUBLICOS = ['index.html', 'styles.css', 'i18n.js', 'script.js', 'demo.js', 'public', 'admin']

rmSync(out, { recursive: true, force: true })
mkdirSync(out)
for (const item of PUBLICOS) {
  const src = join(root, item)
  if (!existsSync(src)) throw new Error(`Falta ${item}: ¿corrió el build del panel?`)
  cpSync(src, join(out, item), { recursive: true })
}
console.log(`dist/ listo con: ${PUBLICOS.join(', ')}`)
