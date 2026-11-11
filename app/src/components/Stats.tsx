import { BarChart } from '@/components/charts/bar-chart'
import { Bar } from '@/components/charts/bar'
import { BarXAxis } from '@/components/charts/bar-x-axis'
import { BarYAxis } from '@/components/charts/bar-y-axis'
import { Grid } from '@/components/charts/grid'
import { ChartTooltip } from '@/components/charts/tooltip'
import { BarEndLabels } from '@/components/charts/bar-end-labels'
import NumberFlow from '@number-flow/react'
import { AreaSparkline } from '@/components/charts/sparkline'
import { useEffect, useState, type CSSProperties } from 'react'
import { RingChart } from '@/components/charts/ring-chart'
import { Ring } from '@/components/charts/ring'
import { RingCenter } from '@/components/charts/ring-center'
import { defaultRingColors } from '@/components/charts/ring-context'
import { EmptyState } from '@/components/UI'

function useNarrow(query = '(max-width: 640px)') {
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setNarrow(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return narrow
}

type Day = { label: string; total: number }

// Barras de los últimos días (Bklit). Sin movimiento se muestra un estado vacío, no barras grises.
export function TrendBars({ data, format, label, emptyText = 'Aún no hay movimiento en estos días.' }: {
  data: Day[]; format: (n: number) => string; label: string; emptyText?: string
}) {
  const narrow = useNarrow()
  if (!data.some(d => d.total > 0)) return <EmptyState inline icon="chart" title="Sin datos esta semana" text={emptyText} />
  const rows = data.map((d, i) => ({ dia: i === data.length - 1 ? 'Hoy' : d.label.replace('.', ''), total: d.total }))
  const summary = data.map(d => `${d.label}: ${format(d.total)}`).join(', ')
  return (
    <div className="tk-chart" role="img" aria-label={`${label}. ${summary}`}>
      <BarChart data={rows} xDataKey="dia" aspectRatio={narrow ? '1.4 / 1' : '2.4 / 1'} barGap={0.35}>
        <Grid horizontal />
        <Bar dataKey="total" fill="var(--chart-line-primary)" lineCap="round" />
        <BarXAxis showAllLabels />
        <ChartTooltip rows={p => [{ color: 'var(--chart-line-primary)', label: 'Monto', value: format(Number(p.total)) }]} />
      </BarChart>
    </div>
  )
}

// Desglose de calificaciones (Bklit): promedio animado, estrellas y barras con pista por estrella.
export function RatingBreakdown({ value, rows }: { value: number; rows: { star: number; count: number }[] }) {
  const narrow = useNarrow()
  const total = rows.reduce((s, r) => s + r.count, 0)
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0)
  const data = rows.map(r => ({ estrellas: `${r.star} ${r.star === 1 ? 'estrella' : 'estrellas'}`, reseñas: r.count, resto: total - r.count }))
  const summary = rows.map(r => `${r.count} de ${r.star} estrellas`).join(', ')
  return (
    <div className="tk-rating">
      <div className="tk-rating__head">
        <NumberFlow className="tk-rating__value" value={value} format={{ minimumFractionDigits: 1, maximumFractionDigits: 2 }} />
        <div>
          <span className="tk-rating__stars" style={{ '--fill': `${(value / 5) * 100}%` } as CSSProperties} aria-hidden="true">★★★★★</span>
          <span className="tk-rating__count">{total} {total === 1 ? 'reseña' : 'reseñas'}</span>
        </div>
      </div>
      <div className="tk-chart" role="img" aria-label={`Calificación promedio ${value.toFixed(2)} de 5. ${summary}`}>
        <BarChart data={data} xDataKey="estrellas" orientation="horizontal" stacked aspectRatio={narrow ? '1.7 / 1' : '3.2 / 1'} barGap={0.42} margin={{ top: 4, bottom: 4, left: 84, right: 44 }}>
          <Bar dataKey="reseñas" fill="var(--chart-line-primary)" lineCap="butt" fadedOpacity={0.35} />
          <Bar dataKey="resto" fill="var(--surface-sunken)" lineCap="butt" fadedOpacity={1} />
          <BarYAxis />
          <BarEndLabels valueKey="reseñas" />
          <ChartTooltip rows={p => [{ color: 'var(--chart-line-primary)', label: 'Reseñas', value: `${p['reseñas']} · ${pct(Number(p['reseñas']))}%` }]} />
        </BarChart>
      </div>
    </div>
  )
}

// Tendencia mínima dentro de un KPI.
export function KpiSpark({ values }: { values: number[] }) {
  if (!values.some(v => v > 0)) return null
  return (
    <div className="tk-kpi__spark" aria-hidden="true">
      <AreaSparkline data={values.map(v => ({ v }))} dataKey="v" height={40} color="var(--chart-line-primary)" fill="gradient" strokeWidth={2} interactive={false} />
    </div>
  )
}

// Anillos (Bklit) para comparar a los primeros lugares: cada anillo es su parte respecto al líder
export function TopRings({ items, format, centerLabel, label }: {
  items: { label: string; value: number }[]; format: (n: number) => string; centerLabel: string; label: string
}) {
  const top = items.filter(i => i.value > 0).slice(0, 4)
  if (!top.length) return <EmptyState inline icon="chart" title="Sin datos aún" text="Aparecerá cuando haya propinas este mes." />
  const max = top[0].value
  const data = top.map((t, i) => ({ label: t.label, value: t.value, maxValue: max, color: defaultRingColors[i] }))
  return (
    <div className="tk-rings" role="img" aria-label={`${label}. ${top.map(t => `${t.label}: ${format(t.value)}`).join(', ')}`}>
      <div className="tk-rings__chart">
        <RingChart data={data} size={188} strokeWidth={11} ringGap={5} baseInnerRadius={44}>
          {data.map((_, i) => <Ring key={i} index={i} />)}
          <RingCenter defaultLabel={centerLabel} prefix="$" />
        </RingChart>
      </div>
      <ul className="tk-rings__legend">
        {data.map(d => (
          <li key={d.label}>
            <span className="tk-rings__dot" style={{ background: d.color }} />
            <span className="tk-rings__name">{d.label}</span>
            <span className="tk-rings__val">{format(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Barras por mes (Bklit): últimos meses con su total
export function MonthBars({ data, format, label }: { data: { label: string; total: number }[]; format: (n: number) => string; label: string }) {
  const narrow = useNarrow()
  if (!data.some(d => d.total > 0)) return <EmptyState inline icon="chart" title="Sin datos todavía" text="Cuando recibas propinas verás aquí cómo van tus meses." />
  const rows = data.map(d => ({ mes: d.label, total: d.total }))
  return (
    <div className="tk-chart" role="img" aria-label={`${label}. ${data.map(d => `${d.label}: ${format(d.total)}`).join(', ')}`}>
      <BarChart data={rows} xDataKey="mes" aspectRatio={narrow ? '1.5 / 1' : '2.6 / 1'} barGap={0.4}>
        <Grid horizontal />
        <Bar dataKey="total" fill="var(--chart-line-primary)" lineCap="round" />
        <BarXAxis showAllLabels />
        <ChartTooltip rows={p => [{ color: 'var(--chart-line-primary)', label: 'Total', value: format(Number(p.total)) }]} />
      </BarChart>
    </div>
  )
}

export function lastMonths<T extends { created_at: string; monto_total: number }>(items: T[], n = 6) {
  const now = new Date()
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')
    return { label, total: items.filter(p => p.created_at.startsWith(key)).reduce((s, p) => s + p.monto_total, 0) }
  })
}
