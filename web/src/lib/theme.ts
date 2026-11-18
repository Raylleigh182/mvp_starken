import { useSyncExternalStore } from 'react'

export type Modo = 'light' | 'dark'

/** Colores de datos por modo: paleta de referencia validada (skill dataviz, palette.md). */
export const PALETA = {
  light: {
    s: ['#2a78d6', '#eb6834', '#1baf7a'],
    ordinal: ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281'],
    surface: '#fcfcfb', ink: '#0b0b0b', ink2: '#52514e', muted: '#898781', grid: '#e1e0d9', axis: '#c3c2b7',
    good: '#006300', critical: '#d03b3b',
  },
  dark: {
    s: ['#3987e5', '#d95926', '#199e70'],
    ordinal: ['#184f95', '#256abf', '#3987e5', '#6da7ec', '#9ec5f4'],
    surface: '#1a1a19', ink: '#f0efec', ink2: '#c3c2b7', muted: '#898781', grid: '#2c2c2a', axis: '#383835',
    good: '#0ca30c', critical: '#d03b3b',
  },
} as const

export type Paleta = (typeof PALETA)[Modo]

const mq = () => window.matchMedia('(prefers-color-scheme: dark)')
function subscribe(cb: () => void) {
  const m = mq()
  m.addEventListener('change', cb)
  const obs = new MutationObserver(cb)
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => { m.removeEventListener('change', cb); obs.disconnect() }
}
function snapshot(): Modo {
  const t = document.documentElement.dataset.theme
  if (t === 'light' || t === 'dark') return t
  return mq().matches ? 'dark' : 'light'
}

/** Modo efectivo (respeta el sistema salvo que el usuario elija uno). */
export function useModo() {
  return useSyncExternalStore(subscribe, snapshot, () => 'dark' as Modo)
}

export function usePaleta(): Paleta {
  return PALETA[useModo()]
}

export function useToggleTema() {
  const modo = useModo()
  return {
    modo,
    toggle: () => {
      const next: Modo = modo === 'dark' ? 'light' : 'dark'
      document.documentElement.dataset.theme = next
      try { localStorage.setItem('theme', next) } catch { /* sin almacenamiento */ }
    },
  }
}
