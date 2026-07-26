import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { buildChart } from '../lib/chartData'
import { fmtValue } from '../lib/meta'

function BreakBadge({ viewBox, n, kind, stack }) {
  const x = viewBox?.x ?? 0
  const cy = 12 + stack * 20
  return (
    <g>
      <circle
        cx={x}
        cy={cy}
        r={8.5}
        fill={kind === 'comparability_break' ? '#8C4A2F' : '#F6F2E9'}
        stroke="#8C4A2F"
        strokeWidth={1.2}
      />
      <text
        x={x}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={10}
        fontFamily="'JetBrains Mono', monospace"
        fontWeight={600}
        fill={kind === 'comparability_break' ? '#F6F2E9' : '#8C4A2F'}
      >
        {n}
      </text>
    </g>
  )
}

function ChartTooltip({ active, label, payload, seriesMeta, kind }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload ?? {}
  const seen = new Set()
  const items = []
  for (const s of seriesMeta) {
    if (seen.has(s.key)) continue
    const entry = payload.find((p) => p.dataKey.startsWith(`${s.key}__s`))
    if (entry != null && entry.value != null) {
      items.push({ ...s, text: fmtValue(entry.value, kind) })
      seen.add(s.key)
    } else if (row[`${s.key}__sup`]) {
      items.push({ ...s, text: 'Suppressed for student privacy', muted: true })
      seen.add(s.key)
    }
  }
  if (!items.length) return null
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-year">{label}</div>
      {items.map((it) => (
        <div key={it.key} className="chart-tooltip-row">
          <span className="swatch" style={{ background: it.color }} />
          <span className="chart-tooltip-name">{it.label}</span>
          <span className={`chart-tooltip-value${it.muted ? ' muted' : ''}`}>{it.text}</span>
        </div>
      ))}
    </div>
  )
}

// One trend chart. seriesList: [{key, label, color, dash, width, cells}].
// Comparability breaks split lines into separate segments — no line is ever
// drawn across a break. Annotation years render a numbered badge even when
// no data exists for that year yet.
export default function TrendChart({ topicId, kind, seriesList }) {
  const { rows, seriesKeys, topicBreaks } = buildChart(topicId, seriesList)

  // Breaks sharing a school year (e.g. both 2025-26 ACT annotations) stack
  // their badges vertically instead of drawing on top of each other; the
  // chart's top margin grows to make room.
  const stackOf = topicBreaks.map((b, i) =>
    topicBreaks.slice(0, i).filter((o) => o.school_year === b.school_year).length,
  )
  const topMargin = 26 + Math.max(0, ...stackOf) * 20

  return (
    <div className="trend-chart">
      <ResponsiveContainer width="100%" height={260 + topMargin - 26}>
        <LineChart data={rows} margin={{ top: topMargin, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#E4DECF" strokeDasharray="1 3" vertical={false} />
          <XAxis
            dataKey="year"
            tickFormatter={(y) => `’${y.slice(2, 4)}`}
            tick={{ fontSize: 10.5, fontFamily: "'JetBrains Mono', monospace", fill: '#6B675C' }}
            tickLine={false}
            axisLine={{ stroke: '#C9C2AE' }}
            interval="preserveStartEnd"
            minTickGap={18}
          />
          <YAxis
            width={40}
            tick={{ fontSize: 10.5, fontFamily: "'JetBrains Mono', monospace", fill: '#6B675C' }}
            tickFormatter={(v) => (kind === 'count' ? v.toLocaleString('en-US') : v)}
            tickLine={false}
            axisLine={false}
            domain={['auto', 'auto']}
          />
          <Tooltip
            content={<ChartTooltip seriesMeta={seriesList} kind={kind} />}
            cursor={{ stroke: '#8A8578', strokeWidth: 1 }}
          />
          {topicBreaks.map((b, i) => (
            <ReferenceLine
              key={b.id}
              x={b.school_year}
              stroke="#8C4A2F"
              strokeWidth={b.type === 'comparability_break' ? 1.5 : 1}
              strokeDasharray={b.type === 'comparability_break' ? '6 4' : '2 4'}
              label={<BreakBadge n={i + 1} kind={b.type} stack={stackOf[i]} />}
            />
          ))}
          {seriesList.flatMap((s) =>
            seriesKeys[s.key].map((dataKey) => (
              <Line
                key={dataKey}
                dataKey={dataKey}
                stroke={s.color}
                strokeWidth={s.width}
                strokeDasharray={s.dash}
                dot={{ r: 2, fill: s.color, strokeWidth: 0 }}
                activeDot={{ r: 4 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            )),
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
