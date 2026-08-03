import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

/**
 * GitHub Pages es hosting estatico sin reescrituras: entrar directamente en
 * /AnimeDB/login devolveria un 404 en vez de la app. Publicando el mismo HTML
 * como 404.html, Pages lo sirve para cualquier ruta desconocida y el router se
 * encarga de resolverla en el cliente.
 */
function spaFallback(): Plugin {
  return {
    name: 'animedb-spa-fallback',
    apply: 'build',
    closeBundle() {
      const dist = fileURLToPath(new URL('./dist', import.meta.url))
      copyFileSync(resolve(dist, 'index.html'), resolve(dist, '404.html'))
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  /*
   * Pages sirve el proyecto en /AnimeDB/, no en la raiz del dominio, asi que los
   * assets del build necesitan ese prefijo o darian 404. En desarrollo se queda
   * en '/' para no escribir la subcarpeta en localhost.
   *
   * BASE_PATH permite sobreescribirlo (dominio propio, otro hosting...).
   */
  base: process.env.BASE_PATH ?? (command === 'build' ? '/AnimeDB/' : '/'),
  plugins: [vue(), tailwindcss(), spaFallback()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
}))
