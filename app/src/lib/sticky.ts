import { useEffect, useState } from 'react'

// Recuerda la vista abierta por pestaña del navegador: sobrevive si Safari recarga la página al volver
export function useStickyState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(key)
      return raw != null ? (JSON.parse(raw) as T) : initial
    } catch { return initial }
  })
  useEffect(() => {
    try {
      if (value == null) sessionStorage.removeItem(key)
      else sessionStorage.setItem(key, JSON.stringify(value))
    } catch { /* almacenamiento bloqueado */ }
  }, [key, value])
  return [value, setValue] as const
}
