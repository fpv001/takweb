import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

export function formatMXN(amount: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
  }).format(amount)
}

export function detectLang(): 'es' | 'en' {
  const lang = navigator.language || 'es'
  return lang.startsWith('en') ? 'en' : 'es'
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
