import { computed, ref } from 'vue'

export type Theme = 'dark' | 'light'

export const THEME_STORAGE_KEY = 'animedb-theme'

/**
 * El tema ya lo ha aplicado el script inline de index.html antes del primer
 * pintado (si no, se veria un fogonazo del tema equivocado al recargar).
 * Aqui solo se lee lo que ese script dejo puesto.
 */
function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

// Estado global: un unico tema para toda la app.
const theme = ref<Theme>(currentTheme())

function apply(next: Theme) {
  theme.value = next
  document.documentElement.dataset.theme = next
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next)
  } catch {
    // Modo privado o almacenamiento lleno: el tema vale para esta sesion.
  }
}

export function useTheme() {
  const isDark = computed(() => theme.value === 'dark')

  function toggle() {
    apply(theme.value === 'dark' ? 'light' : 'dark')
  }

  return { theme, isDark, toggle, setTheme: apply }
}
