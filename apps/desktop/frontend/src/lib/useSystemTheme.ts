import { useLayoutEffect, useSyncExternalStore } from 'react'

const query = '(prefers-color-scheme: dark)'

function subscribe(onChange: () => void) {
  const media = window.matchMedia(query)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

const getSnapshot = () => window.matchMedia(query).matches

/** Mirrors the OS appearance onto `<html data-theme>`, which the dark variant keys off. */
export function useSystemTheme() {
  const dark = useSyncExternalStore(subscribe, getSnapshot)
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  }, [dark])
}
