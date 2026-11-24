import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type PointerEvent } from 'react'

// Ventana plegable (hoja inferior) para las páginas de huésped.
// Dos estados: abierta, o plegada (solo se ve la cabecera con el asa).
// Se arrastra desde la cabecera; tocarla abre/pliega. El contenido hace scroll por dentro.

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Cabecera siempre visible (también cuando está plegada) */
  head: ReactNode
  children: ReactNode
  /** Oscurece lo de atrás mientras está abierta (cuando hay contenido detrás) */
  scrim?: boolean
  /** Texto para lectores de pantalla del botón de la cabecera */
  toggleLabel: string
}

const UMBRAL_PX = 70

export function BottomSheet({ open, onOpenChange, head, children, scrim, toggleLabel }: Props) {
  const headRef = useRef<HTMLDivElement>(null)
  const [peek, setPeek] = useState(96)
  const [drag, setDrag] = useState<number | null>(null)
  const start = useRef<{ y: number; moved: boolean } | null>(null)

  // Alto de la franja plegada = alto real de la cabecera
  useLayoutEffect(() => {
    const el = headRef.current
    if (!el) return
    const medir = () => setPeek(el.offsetHeight)
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!open || !scrim) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onOpenChange(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, scrim, onOpenChange])

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    start.current = { y: e.clientY, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!start.current) return
    const dy = e.clientY - start.current.y
    if (Math.abs(dy) > 6) start.current.moved = true
    if (start.current.moved) setDrag(open ? Math.max(0, dy) : Math.min(0, dy))
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    const s = start.current
    start.current = null
    if (!s) return
    const dy = e.clientY - s.y
    setDrag(null)
    if (!s.moved) { onOpenChange(!open); return }
    if (open && dy > UMBRAL_PX) onOpenChange(false)
    else if (!open && dy < -UMBRAL_PX / 2) onOpenChange(true)
  }

  const transform = open
    ? `translateY(${drag ?? 0}px)`
    : `translateY(calc(100% - ${peek}px + ${drag ?? 0}px))`

  return (
    <>
      {scrim && <div className="tk-sheet__scrim" data-open={open || undefined} onClick={() => onOpenChange(false)} aria-hidden="true" />}
      <section className="tk-sheet" data-open={open || undefined} data-dragging={drag !== null || undefined} style={{ transform }}>
        <div
          ref={headRef}
          className="tk-sheet__head"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { start.current = null; setDrag(null) }}
        >
          <button type="button" className="tk-sheet__grabber" aria-expanded={open} aria-label={toggleLabel}
            onClick={e => { if (e.detail === 0) onOpenChange(!open) /* solo teclado; el toque lo maneja onPointerUp */ }} />
          {head}
        </div>
        <div className="tk-sheet__body" inert={!open || undefined}>
          {children}
        </div>
      </section>
    </>
  )
}
