// Helpers para el Google Place ID del hotel (usado por TipPage y los paneles de gerente y admin)

export function googleReviewUrl(placeId: string) {
  return `https://search.google.com/local/writereview?placeid=${placeId}`
}

// Acepta el Place ID tal cual, o un enlace completo de Google que contenga placeid=...
// Devuelve { valor, error? } para validar antes de guardar; valor vacío significa "borrar".
export function limpiarPlaceId(input: string): { valor: string; error?: string; advertencia?: string } {
  let valor = input.trim()
  if (valor.includes('placeid=')) {
    valor = valor.split('placeid=')[1].split('&')[0].trim()
  }
  if (!valor) return { valor: '' }
  if (/\s/.test(valor)) return { valor, error: 'El Place ID no puede tener espacios' }
  if (valor.length < 20) return { valor, error: 'El Place ID es demasiado corto. Revisa que lo copiaste completo' }
  if (!valor.startsWith('ChIJ')) {
    return { valor, advertencia: 'El Place ID no empieza con ChIJ. Verifica con “Probar enlace”' }
  }
  return { valor }
}

// Copia sin await: iOS Safari bloquea window.open si hay un await antes en el mismo gesto
export function copiarTexto(text: string) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => copiarConTextarea(text))
  } else {
    copiarConTextarea(text)
  }
}

function copiarConTextarea(text: string) {
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  try { document.execCommand('copy') } catch (err) { console.error('No se pudo copiar el comentario:', err) }
  document.body.removeChild(area)
}
