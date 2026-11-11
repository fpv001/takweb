import { useEffect, useSyncExternalStore } from 'react'

export type ThemePref = 'light' | 'dark' | 'system'

const KEY = 'tak_theme'
const listeners = new Set<() => void>()
const media = window.matchMedia('(prefers-color-scheme: dark)')

function read(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch { return 'system' }
}

let pref = read()

export function setThemePref(next: ThemePref) {
  pref = next
  try { localStorage.setItem(KEY, next) } catch { /* sin almacenamiento: solo esta sesión */ }
  listeners.forEach(l => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  media.addEventListener('change', l)
  return () => { listeners.delete(l); media.removeEventListener('change', l) }
}

export function useThemePref() {
  return useSyncExternalStore(subscribe, () => pref)
}

// El tema solo aplica al panel; la liga del huésped y el login conservan su diseño coral.
export function useApplyTheme() {
  const p = useThemePref()
  const dark = useSyncExternalStore(subscribe, () => media.matches)
  const resolved = p === 'system' ? (dark ? 'dark' : 'light') : p
  useEffect(() => {
    const html = document.documentElement
    html.dataset.theme = resolved
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#161211' : '#F57C73')
    return () => {
      delete html.dataset.theme
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#F57C73')
    }
  }, [resolved])
}
