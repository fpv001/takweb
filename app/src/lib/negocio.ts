// Etiquetas visibles según el tipo de negocio. Solo cambia lo que ve el usuario:
// las tablas, columnas, rutas y roles internos siguen llamándose hotel/hotel_admin.

export type TipoNegocio = 'hotel' | 'restaurante' | 'tienda'

export function etiquetasNegocio(tipo?: string | null) {
  // 'comercio' es el valor anterior de tienda; se trata igual mientras corre la migración
  const t: TipoNegocio = tipo === 'restaurante' || tipo === 'tienda' || tipo === 'comercio' ? (tipo === 'comercio' ? 'tienda' : tipo) : 'hotel'
  switch (t) {
    case 'restaurante':
      return { tipo: t, singular: 'restaurante', singularCap: 'Restaurante', panelTitulo: 'Panel del restaurante', rolAdmin: 'Administrador' }
    case 'tienda':
      return { tipo: t, singular: 'tienda', singularCap: 'Tienda', panelTitulo: 'Panel de la tienda', rolAdmin: 'Administrador' }
    default:
      return { tipo: t, singular: 'hotel', singularCap: 'Hotel', panelTitulo: 'Panel de gerencia', rolAdmin: 'Gerente' }
  }
}

// Bienvenida que ve el gerente según el tipo: "Bienvenido a tu tienda", "…a tu restaurante", etc.
export function bienvenidaNegocio(tipo?: string | null) {
  return `Bienvenido a tu ${etiquetasNegocio(tipo).singular}`
}

// Módulos que se activan por defecto al dar de alta un negocio de cada tipo.
// Propinas = colaboradores con pulsera/NFC. Docks = reseñas por NFC (siempre disponibles).
export type Modulos = { docks: boolean; propinas: boolean }

export function modulosPorDefecto(tipo?: string | null): Modulos {
  const t = etiquetasNegocio(tipo).tipo
  return { docks: true, propinas: t !== 'tienda' }
}

export function modulosDe(hotel: { modulos?: Partial<Modulos> | null } | null | undefined): Modulos {
  return { docks: true, propinas: true, ...(hotel?.modulos ?? {}) }
}

// Nombre del plan según módulos activos (se muestra en admin; el precio se captura aparte)
export function nombrePlan(m: Modulos) {
  if (m.docks && m.propinas) return 'Docks + propinas'
  if (m.propinas) return 'Solo propinas'
  return 'Solo docks'
}

export const TIPOS_NEGOCIO: { value: TipoNegocio; label: string }[] = [
  { value: 'hotel', label: 'Hotel' },
  { value: 'restaurante', label: 'Restaurante' },
  { value: 'tienda', label: 'Tienda' },
]
