// Etiquetas visibles según el tipo de negocio. Solo cambia lo que ve el usuario:
// las tablas, columnas, rutas y roles internos siguen llamándose hotel/hotel_admin.

export type TipoNegocio = 'hotel' | 'restaurante' | 'comercio'

export function etiquetasNegocio(tipo?: string | null) {
  const t: TipoNegocio = tipo === 'restaurante' || tipo === 'comercio' ? tipo : 'hotel'
  switch (t) {
    case 'restaurante':
      return { tipo: t, singular: 'restaurante', singularCap: 'Restaurante', panelTitulo: 'Panel del restaurante', rolAdmin: 'Administrador' }
    case 'comercio':
      return { tipo: t, singular: 'comercio', singularCap: 'Comercio', panelTitulo: 'Panel del comercio', rolAdmin: 'Administrador' }
    default:
      return { tipo: t, singular: 'hotel', singularCap: 'Hotel', panelTitulo: 'Panel de gerencia', rolAdmin: 'Gerente' }
  }
}

export const TIPOS_NEGOCIO: { value: TipoNegocio; label: string }[] = [
  { value: 'hotel', label: 'Hotel' },
  { value: 'restaurante', label: 'Restaurante' },
  { value: 'comercio', label: 'Comercio' },
]
