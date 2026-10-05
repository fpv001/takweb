import {
  ReactNode, useState, useEffect, useRef, useId, Children, isValidElement, cloneElement,
  createContext, useContext, type MouseEvent, type KeyboardEvent, type ReactElement,
} from 'react'
import { useAuth } from '@/context/AuthContext'
import { getInitials } from '@/lib/utils'
import { Icon, type IconName } from '@/components/Icon'
import logoUrl from '@/assets/tak-logo.webp'

// ─── Responsive hook ──────────────────────────────────────────────────────────

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 900)
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth <= 900)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return isMobile
}

function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

// ─── Types ────────────────────────────────────────────────────────────────────

type NavItem = { id: string; label: string; icon: string }

type AppLayoutProps = {
  navItems: NavItem[]
  activeTab: string
  onTabChange: (id: string) => void
  children: ReactNode
  title: string
  subtitle: string
}

// ─── AppLayout ────────────────────────────────────────────────────────────────

export function AppLayout({ navItems, activeTab, onTabChange, children, title, subtitle }: AppLayoutProps) {
  const { user, signOut } = useAuth()
  const isMobile = useIsMobile()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!drawerOpen) return
    closeRef.current?.focus()
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  const current = navItems.find(n => n.id === activeTab)

  return (
    <div className="tk-app">
      {!isMobile && (
        <aside className="tk-sidebar" aria-label="Navegación principal">
          <SidebarContent
            navItems={navItems} activeTab={activeTab}
            onTabChange={onTabChange} title={title} subtitle={subtitle}
            userEmail={user?.email ?? ''} onSignOut={signOut}
          />
        </aside>
      )}

      {isMobile && (
        <header className="tk-topbar">
          <div className="tk-topbar__tab"><img src={logoUrl} alt="tak!" /></div>
          <p className="tk-topbar__title">{current?.label ?? title}</p>
          <button type="button" className="tk-icon-btn" aria-label="Abrir menú" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}>
            <Icon name="menu" />
          </button>
        </header>
      )}

      {isMobile && drawerOpen && (
        <div className="tk-drawer" role="dialog" aria-modal="true" aria-label="Menú">
          <div className="tk-drawer__scrim" onClick={() => setDrawerOpen(false)} />
          <div className="tk-drawer__panel">
            <button ref={closeRef} type="button" className="tk-icon-btn tk-drawer__close" aria-label="Cerrar menú" onClick={() => setDrawerOpen(false)}>
              <Icon name="close" />
            </button>
            <SidebarContent
              navItems={navItems} activeTab={activeTab}
              onTabChange={id => { onTabChange(id); setDrawerOpen(false) }}
              title={title} subtitle={subtitle}
              userEmail={user?.email ?? ''} onSignOut={signOut}
            />
          </div>
        </div>
      )}

      <main className="tk-main" id="contenido">
        {children}
      </main>
    </div>
  )
}

// ─── Sidebar content ──────────────────────────────────────────────────────────

function SidebarContent({ navItems, activeTab, onTabChange, title, subtitle, userEmail, onSignOut }: {
  navItems: NavItem[]; activeTab: string; onTabChange: (id: string) => void
  title: string; subtitle: string; userEmail: string; onSignOut: () => void
}) {
  return (
    <>
      <div className="tk-brandtab">
        <img src={logoUrl} alt="tak!" />
        <p className="tk-brandtab__ctx">{subtitle}</p>
      </div>

      <nav className="tk-nav" aria-label={title}>
        <p className="tk-nav__title">{title}</p>
        {navItems.map(item => (
          <button
            key={item.id} type="button" className="tk-nav__item"
            aria-current={activeTab === item.id ? 'page' : undefined}
            onClick={() => onTabChange(item.id)}
          >
            <Icon name={item.icon} />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="tk-userbox">
        <div className="tk-userbox__who">
          <Avatar name={userEmail || '?'} size={32} />
          <p className="tk-userbox__mail" title={userEmail}>{userEmail}</p>
        </div>
        <Btn variant="text" icon="logout" onClick={onSignOut} block>Cerrar sesión</Btn>
      </div>
    </>
  )
}

// ─── Sub-vista (drill-down de gerente/admin) ─────────────────────────────────

export function SubpageLayout({ onBack, title, meta, avatar, tabs, activeTab, onTabChange, children }: {
  onBack: () => void; title: string; meta?: string; avatar?: ReactNode
  tabs: NavItem[]; activeTab: string; onTabChange: (id: string) => void; children: ReactNode
}) {
  return (
    <div className="tk-main" style={{ minHeight: '100vh' }}>
      <div className="tk-subbar">
        <div className="tk-subbar__row">
          <Btn variant="text" icon="back" onClick={onBack}>Volver</Btn>
          <div className="tk-subbar__who">
            {avatar}
            <div style={{ minWidth: 0 }}>
              <p className="tk-subbar__name">{title}</p>
              {meta && <p className="tk-subbar__meta">{meta}</p>}
            </div>
          </div>
        </div>
        <Tabs items={tabs} active={activeTab} onChange={onTabChange} />
      </div>
      {children}
    </div>
  )
}

export function Tabs({ items, active, onChange }: { items: NavItem[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="tk-tabs" role="tablist">
      {items.map(item => (
        <button key={item.id} type="button" role="tab" className="tk-tab" aria-selected={active === item.id} onClick={() => onChange(item.id)}>
          <Icon name={item.icon} />
          {item.label}
        </button>
      ))}
    </div>
  )
}

// ─── Logo ─────────────────────────────────────────────────────────────────────

export function Logo({ width = 96 }: { width?: number }) {
  return <img src={logoUrl} alt="tak!" style={{ width, height: 'auto' }} />
}

// ─── PageContent ──────────────────────────────────────────────────────────────

export function PageContent({ children }: { children: ReactNode }) {
  return <div className="tk-content">{children}</div>
}

// ─── Encabezados ─────────────────────────────────────────────────────────────

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="tk-pagehead">
      <div style={{ minWidth: 0 }}>
        <h1 className="tk-pagehead__title">{title}</h1>
        {subtitle && <p className="tk-pagehead__sub">{subtitle}</p>}
      </div>
      {action && <div className="tk-pagehead__actions">{action}</div>}
    </header>
  )
}

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="tk-sectionhead">
      <div style={{ minWidth: 0 }}>
        <h2 className="tk-sectionhead__title">{title}</h2>
        {subtitle && <p className="tk-sectionhead__sub">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Card({ title, meta, action, children, flush, className }: {
  title?: string; meta?: ReactNode; action?: ReactNode; children: ReactNode; flush?: boolean; className?: string
}) {
  return (
    <section className={cx('tk-card', flush && 'tk-card--flush', className)}>
      {(title || action) && (
        <div className="tk-card__head" style={flush ? { padding: '20px 24px 0' } : undefined}>
          <div style={{ minWidth: 0 }}>
            {title && <h2 className="tk-card__title">{title}</h2>}
            {meta && <p className="tk-card__meta">{meta}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

// ─── KpiRow + KpiCard ─────────────────────────────────────────────────────────

export function KpiRow({ children }: { children: ReactNode }) {
  return <div className="tk-kpis">{children}</div>
}

export function KpiCard({ label, value, sub, icon, featured }: {
  label: string; value: string; sub?: string; color?: string; icon?: IconName; featured?: boolean
}) {
  return (
    <div className={cx('tk-kpi', featured && 'tk-kpi--featured')}>
      <div className="tk-kpi__top">
        <p className="tk-kpi__label">{label}</p>
        {icon && <span className="tk-kpi__icon"><Icon name={icon} /></span>}
      </div>
      <p className="tk-kpi__value">{value}</p>
      {sub && <p className="tk-kpi__sub">{sub}</p>}
    </div>
  )
}

// ─── Table (se convierte en lista apilada en móvil) ──────────────────────────

const HeadersCtx = createContext<string[]>([])

export function Table({ headers, children, empty, numCols = [] }: { headers: string[]; children?: ReactNode; empty?: boolean; numCols?: number[] }) {
  return (
    <div className="tk-table-wrap">
      <table className="tk-table">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={`${h}-${i}`} scope="col" className={numCols.includes(i) ? 'is-num' : undefined}>
                {h || <span className="tk-sr">Acciones</span>}
              </th>
            ))}
          </tr>
        </thead>
        <HeadersCtx.Provider value={headers}>
          <tbody>{children}</tbody>
        </HeadersCtx.Provider>
      </table>
      {empty && <p className="tk-table__empty">Sin registros</p>}
    </div>
  )
}

export function Tr({ children, onClick, label }: { children: ReactNode; onClick?: () => void; label?: string }) {
  const headers = useContext(HeadersCtx)
  const cells = Children.toArray(children).map((child, i) =>
    isValidElement(child) && headers[i]
      ? cloneElement(child as ReactElement<{ 'data-label'?: string }>, { 'data-label': headers[i] })
      : child
  )
  function onKey(e: KeyboardEvent<HTMLTableRowElement>) {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick() }
  }
  return (
    <tr
      onClick={onClick}
      onKeyDown={onClick ? onKey : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? label : undefined}
      className={onClick ? 'is-clickable' : undefined}
    >
      {cells}
    </tr>
  )
}

export function Td({ children, bold, muted, right, nowrap, wrap, ...rest }: {
  children?: ReactNode; bold?: boolean; muted?: boolean; right?: boolean; nowrap?: boolean; wrap?: boolean; 'data-label'?: string
}) {
  return (
    <td
      data-label={rest['data-label']}
      className={cx(bold && 'is-bold', muted && 'is-muted', right && 'is-num', nowrap && 'is-nowrap', wrap && 'is-wrap') || undefined}
    >
      {children}
    </td>
  )
}

// ─── Badge / estado ──────────────────────────────────────────────────────────

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'brand' | 'neutral'

export function Badge({ text, tone = 'neutral' }: { text: string; tone?: Tone; color?: string }) {
  return <span className={`tk-badge tk-badge--${tone}`}>{text}</span>
}

const ESTADOS: Record<string, { label: string; tone: Tone }> = {
  completado: { label: 'Completado', tone: 'success' },
  pendiente: { label: 'Pendiente', tone: 'warning' },
  fallido: { label: 'Fallido', tone: 'danger' },
  cancelado: { label: 'Cancelado', tone: 'danger' },
  reembolsado: { label: 'Reembolsado', tone: 'info' },
}

export function StatusBadge({ estado }: { estado: string }) {
  const e = ESTADOS[estado] ?? { label: estado ? estado.charAt(0).toUpperCase() + estado.slice(1) : '—', tone: 'danger' as Tone }
  return <Badge text={e.label} tone={e.tone} />
}

export function ActiveBadge({ activo }: { activo: boolean }) {
  return <Badge text={activo ? 'Activo' : 'Inactivo'} tone={activo ? 'success' : 'neutral'} />
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

export function Avatar({ name, src, size = 40 }: { name: string; src?: string | null; size?: number }) {
  return (
    <span className="tk-avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}>
      {src ? <img src={src} alt="" /> : <span aria-hidden="true">{getInitials(name || '?')}</span>}
    </span>
  )
}

// ─── Btn ──────────────────────────────────────────────────────────────────────

export function Btn({ children, onClick, variant = 'primary', small, disabled, icon, loading, block, ariaLabel, type = 'button' }: {
  children: ReactNode; onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'text' | 'danger'
  small?: boolean; disabled?: boolean; icon?: IconName; loading?: boolean; block?: boolean
  ariaLabel?: string; type?: 'button' | 'submit'
}) {
  const v = variant === 'ghost' ? 'secondary' : variant
  return (
    <button
      type={type} onClick={onClick} disabled={disabled} aria-busy={loading || undefined} aria-label={ariaLabel}
      className={cx('tk-btn', `tk-btn--${v}`, small && 'tk-btn--sm', block && 'tk-btn--block')}
    >
      {loading ? <span className="tk-btn__spin" aria-hidden="true" /> : icon && <Icon name={icon} />}
      {children}
    </button>
  )
}

export function IconBtn({ icon, label, onClick, danger, small, className }: {
  icon: IconName; label: string; onClick?: (e: MouseEvent<HTMLButtonElement>) => void; danger?: boolean; small?: boolean; className?: string
}) {
  return (
    <button type="button" className={cx('tk-icon-btn', danger && 'tk-icon-btn--danger', small && 'tk-icon-btn--sm', className)} aria-label={label} title={label} onClick={onClick}>
      <Icon name={icon} />
    </button>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const first = panelRef.current?.querySelector<HTMLElement>('input, select, textarea')
    ;(first ?? panelRef.current)?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') closeRef.current() }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      prev?.focus?.()
    }
  }, [])

  return (
    <div className="tk-modal">
      <div className="tk-modal__scrim" onClick={onClose} />
      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} className={cx('tk-modal__panel', wide && 'tk-modal__panel--wide')}>
        <div className="tk-modal__head">
          <h2 id={titleId} className="tk-modal__title">{title}</h2>
          <IconBtn icon="close" label="Cerrar" onClick={onClose} />
        </div>
        <div className="tk-modal__body">{children}</div>
      </div>
    </div>
  )
}

export function ModalActions({ children }: { children: ReactNode }) {
  return <div className="tk-modal__actions">{children}</div>
}

// ─── Formulario ──────────────────────────────────────────────────────────────

export function FormField({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="tk-field">
      <span className="tk-field__label">{label}</span>
      {children}
      {hint && <span className="tk-field__hint">{hint}</span>}
    </label>
  )
}

export function Input({ value, onChange, placeholder, type = 'text', inputMode, autoComplete }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string
  inputMode?: 'text' | 'email' | 'tel' | 'numeric' | 'decimal'; autoComplete?: string
}) {
  return (
    <input className="tk-input" type={type} value={value} placeholder={placeholder} inputMode={inputMode} autoComplete={autoComplete}
      onChange={e => onChange(e.target.value)} />
  )
}

export function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <select className="tk-select" value={value} onChange={e => onChange(e.target.value)}>
      {children}
    </select>
  )
}

export function Alert({ children, tone = 'danger' }: { children: ReactNode; tone?: 'danger' | 'warning' | 'info' | 'success' | 'neutral' }) {
  const icon: IconName = tone === 'danger' ? 'error' : tone === 'warning' ? 'warning' : tone === 'success' ? 'success' : 'info'
  return (
    <div className={`tk-alert tk-alert--${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon name={icon} />
      <p>{children}</p>
    </div>
  )
}

// ─── Vacío ───────────────────────────────────────────────────────────────────

export function EmptyState({ icon = 'info', title, text, action, inline }: { icon?: IconName; title: string; text?: string; action?: ReactNode; inline?: boolean }) {
  return (
    <div className={cx('tk-empty', inline && 'tk-empty--inline')}>
      <span className="tk-empty__mark"><Icon name={icon} /></span>
      <p className="tk-empty__title">{title}</p>
      {text && <p className="tk-empty__text">{text}</p>}
      {action}
    </div>
  )
}

// ─── Indicadores ─────────────────────────────────────────────────────────────

export function LiveIndicator({ label = 'En vivo' }: { label?: string }) {
  return <span className="tk-live"><span className="tk-live__dot" aria-hidden="true" />{label}</span>
}

export function Stars({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <span className="tk-stars" role="img" aria-label={`${value} de ${max} estrellas`}>
      {Array.from({ length: max }, (_, i) => <Icon key={i} name="star" className={i < value ? 'is-on' : 'is-off'} />)}
    </span>
  )
}

export function BarChart({ data, format, label }: { data: { label: string; total: number }[]; format: (n: number) => string; label: string }) {
  const max = Math.max(...data.map(d => d.total), 1)
  const summary = data.map(d => `${d.label}: ${format(d.total)}`).join(', ')
  return (
    <div className="tk-bars" role="img" aria-label={`${label}. ${summary}`}>
      {data.map(({ label: day, total }, i) => {
        const today = i === data.length - 1
        return (
          <div key={`${day}-${i}`} className="tk-bars__col">
            <span className="tk-bars__val">{total > 0 ? format(total) : ''}</span>
            <div className={cx('tk-bars__bar', total === 0 && 'is-zero', today && total > 0 && 'is-today')} style={{ height: total ? `${Math.max(6, (total / max) * 120)}px` : '6px' }} />
            <span className={cx('tk-bars__day', today && 'is-today')}>{today ? 'Hoy' : day.replace('.', '')}</span>
          </div>
        )
      })}
    </div>
  )
}

export function RatingDistribution({ rows }: { rows: { star: number; count: number; pct: number }[] }) {
  return (
    <div className="tk-dist">
      {rows.map(r => (
        <div key={r.star} className="tk-dist__row">
          <span className="tk-dist__star">{r.star} <Icon name="star" /></span>
          <div className="tk-meter" role="img" aria-label={`${r.count} reseñas de ${r.star} estrellas`}>
            <div className="tk-meter__fill" style={{ width: `${r.pct * 100}%` }} />
          </div>
          <span className="tk-dist__count">{r.count}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Carga ───────────────────────────────────────────────────────────────────

export function Skeleton({ h = 16, w = '100%', r }: { h?: number; w?: number | string; r?: number }) {
  return <div className="tk-skel" style={{ height: h, width: w, borderRadius: r }} />
}

// Carga de contenido de página: esqueleto predecible (sin spinner de pantalla completa).
export function Spinner() {
  return (
    <div className="tk-skel-page" aria-busy="true" aria-label="Cargando">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Skeleton h={32} w={260} />
        <Skeleton h={16} w={180} />
      </div>
      <div className="tk-kpis" style={{ margin: 0 }}>
        {[0, 1, 2, 3].map(i => <Skeleton key={i} h={128} r={20} />)}
      </div>
      <Skeleton h={280} r={20} />
    </div>
  )
}

export function FullscreenLoader({ label = 'Cargando' }: { label?: string }) {
  return (
    <div className="tk-fullscreen" aria-busy="true">
      <div className="tk-loader" aria-hidden="true"><span /></div>
      <p className="tk-sr">{label}</p>
    </div>
  )
}

// ─── Toast notification ───────────────────────────────────────────────────────

type ToastProps = { message: string; type?: 'success' | 'info'; onClose: () => void }

export function Toast({ message, type = 'success', onClose }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="tk-toast" role="status" aria-live="polite">
      <span className="tk-toast__icon"><Icon name={type === 'success' ? 'bell' : 'info'} /></span>
      <p>{message}</p>
      <IconBtn icon="close" label="Cerrar aviso" onClick={onClose} small />
    </div>
  )
}
