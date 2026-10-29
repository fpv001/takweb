import { BarChart } from '@/components/charts/bar-chart'
import { Bar } from '@/components/charts/bar'
import { BarXAxis } from '@/components/charts/bar-x-axis'
import { BarYAxis } from '@/components/charts/bar-y-axis'
import { Grid } from '@/components/charts/grid'
import { ChartTooltip } from '@/components/charts/tooltip'
import { RingChart } from '@/components/charts/ring-chart'
import { Ring } from '@/components/charts/ring'
import { RingCenter } from '@/components/charts/ring-center'
import { AreaSparkline } from '@/components/charts/sparkline'
import { useEffect, useState } from 'react'
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

// Calificación promedio como anillo sobre 5 (Bklit).
export function RatingRing({ value, count }: { value: number; count: number }) {
  return (
    <div className="tk-ring" role="img" aria-label={`Calificación promedio ${value.toFixed(1)} de 5, ${count} reseñas`}>
      <RingChart data={[{ label: 'Calificación', value, maxValue: 5 }]} size={196} strokeWidth={18}>
        <Ring index={0} color="var(--chart-line-primary)" />
        <RingCenter defaultLabel={`de 5 · ${count} reseñas`} formatOptions={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }} />
      </RingChart>
    </div>
  )
}

// Reparto de reseñas por estrellas: barras horizontales (Bklit).
export function RatingBars({ rows }: { rows: { star: number; count: number }[] }) {
  const narrow = useNarrow()
  const data = rows.map(r => ({ estrellas: `${r.star} ★`, reseñas: r.count }))
  const summary = rows.map(r => `${r.count} de ${r.star} estrellas`).join(', ')
  return (
    <div className="tk-chart" role="img" aria-label={`Distribución de calificaciones: ${summary}`}>
      <BarChart data={data} xDataKey="estrellas" orientation="horizontal" aspectRatio={narrow ? '1.5 / 1' : '3.4 / 1'} barGap={0.55} margin={{ left: 44 }}>
        <Bar dataKey="reseñas" fill="var(--chart-line-primary)" lineCap="round" />
        <BarYAxis />
        <ChartTooltip rows={p => [{ color: 'var(--chart-line-primary)', label: 'Reseñas', value: String(p['reseñas']) }]} />
      </BarChart>
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
