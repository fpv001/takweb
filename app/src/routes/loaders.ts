// Importaciones diferidas de cada ruta; también sirven para precargarlas antes de usarlas
export const loadLogin = () => import('@/routes/LoginPage')
export const loadAtlas = () => import('@/routes/AtlasAdmin')
export const loadHotel = () => import('@/routes/HotelDashboard')
export const loadColaborador = () => import('@/routes/ColaboradorDashboard')
export const loadTip = () => import('@/routes/TipPage')
export const loadResena = () => import('@/routes/ResenaPage')
