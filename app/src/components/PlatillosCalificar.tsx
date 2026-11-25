import { Icon } from '@/components/Icon'
import { detectLang } from '@/lib/utils'
import { fotoPlatilloUrl, type PlatilloPublico } from '@/lib/platillos'

// "¿Qué comiste?": elegir platillos del menú del dock y calificarlos. Lo usan la reseña del
// lugar (/r/<dock>) y el flujo de agradecer a alguien que llegó desde un dock (/tip/<liga>?d=<dock>).

export type PlatilloElegido = { id: string; estrellas: number; comentario: string }

const textos = {
  es: {
    title: '¿Qué comiste?',
    sub: 'Toca los platillos que probaste para calificarlos',
    rate: 'Califica tus platillos',
    comment: 'Comentario sobre este platillo (opcional)',
    commentPh: 'Comentario (opcional)',
    selected: (n: string) => `${n}, seleccionado`,
    remove: (n: string) => `Quitar ${n}`,
    star: (n: number) => `${n} de 5 estrellas`,
  },
  en: {
    title: 'What did you eat?',
    sub: 'Tap the dishes you tried to rate them',
    rate: 'Rate your dishes',
    comment: 'Comment on this dish (optional)',
    commentPh: 'Comment (optional)',
    selected: (n: string) => `${n}, selected`,
    remove: (n: string) => `Remove ${n}`,
    star: (n: number) => `${n} out of 5 stars`,
  },
}

export const faltanEstrellasPlatillos = (elegidos: PlatilloElegido[]) => elegidos.some(e => e.estrellas === 0)

export const mensajeFaltanEstrellas = () => detectLang() === 'en'
  ? 'Give stars to each dish you picked, or remove it from the list.'
  : 'Ponle estrellas a cada platillo que elegiste, o quítalo de la lista.'

type Props = {
  platillos: PlatilloPublico[]
  elegidos: PlatilloElegido[]
  onChange: (elegidos: PlatilloElegido[]) => void
  marcarFaltantes?: boolean
  titulo?: string
  subtitulo?: string
}

export function PlatillosCalificar({ platillos, elegidos, onChange, marcarFaltantes, titulo, subtitulo }: Props) {
  const t = textos[detectLang()]
  if (!platillos.length) return null

  const toggle = (id: string) =>
    onChange(elegidos.some(e => e.id === id) ? elegidos.filter(e => e.id !== id) : [...elegidos, { id, estrellas: 0, comentario: '' }])
  const editar = (id: string, cambios: Partial<PlatilloElegido>) =>
    onChange(elegidos.map(e => e.id === id ? { ...e, ...cambios } : e))

  return (
    <section className="tk-dishes" aria-labelledby="tk-dishes-title">
      <h2 id="tk-dishes-title" className="tk-gtitle tk-dishes__title">{titulo ?? t.title}</h2>
      <p className="tk-dishes__sub">{subtitulo ?? t.sub}</p>
      <div className="tk-dish-grid">
        {platillos.map(p => {
          const on = elegidos.some(e => e.id === p.id)
          const foto = fotoPlatilloUrl(p.foto_path)
          return (
            <button key={p.id} type="button" className="tk-dish" aria-pressed={on} onClick={() => toggle(p.id)}
              aria-label={on ? t.selected(p.nombre) : p.nombre}>
              <span className="tk-dish__photo">
                {foto ? <img src={foto} alt="" loading="lazy" decoding="async" /> : <span className="tk-dish__initial" aria-hidden="true">{p.nombre.charAt(0)}</span>}
                <span className="tk-dish__check" aria-hidden="true"><Icon name="check" /></span>
              </span>
              <span className="tk-dish__name">{p.nombre}</span>
              {p.descripcion && <span className="tk-dish__desc">{p.descripcion}</span>}
            </button>
          )
        })}
      </div>

      {elegidos.length > 0 && (
        <div className="tk-dish-rates">
          <h3 className="tk-glabel">{t.rate}</h3>
          {elegidos.map(e => {
            const p = platillos.find(x => x.id === e.id)
            if (!p) return null
            const foto = fotoPlatilloUrl(p.foto_path)
            return (
              <div key={e.id} className="tk-dish-rate" data-missing={marcarFaltantes && e.estrellas === 0 ? '' : undefined}>
                <div className="tk-dish-rate__head">
                  <span className="tk-dish-rate__thumb">
                    {foto ? <img src={foto} alt="" /> : <span aria-hidden="true">{p.nombre.charAt(0)}</span>}
                  </span>
                  <p className="tk-dish-rate__name">{p.nombre}</p>
                  <button type="button" className="tk-dish-rate__remove" onClick={() => toggle(e.id)} aria-label={t.remove(p.nombre)}>
                    <Icon name="close" />
                  </button>
                </div>
                <div className="tk-rate tk-rate--sm" role="group" aria-label={p.nombre}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <button key={s} type="button" onClick={() => editar(e.id, { estrellas: s })} className={s <= e.estrellas ? 'is-on' : undefined}
                      aria-label={t.star(s)} aria-pressed={s === e.estrellas}>
                      <Icon name="star" />
                    </button>
                  ))}
                </div>
                {e.estrellas > 0 && (
                  <label className="tk-field">
                    <span className="tk-sr">{t.comment}</span>
                    <input className="tk-input" placeholder={t.commentPh} value={e.comentario} maxLength={500}
                      onChange={ev => editar(e.id, { comentario: ev.target.value })} />
                  </label>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
