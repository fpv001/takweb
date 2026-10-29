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
