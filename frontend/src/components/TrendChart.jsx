import {
  CartesianGrid,
  LabelList,
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

const UNIT_LABEL = {
  percent: 'Percent of students',
  'percent-change': 'Percent change',
  score: 'Average score',
  count: 'Students',
}

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

// Compact numeric label for on-chart value annotations: unit lives on the
// axis, so points carry just the number.
function shortNum(v, kind) {
  if (v == null) return ''
  if (kind === 'count') return v.toLocaleString('en-US')
  if (kind === 'score') {
    // ACT averages are published to 2 decimals; rounding 18.95 to "19"
    // on the chart would misstate the source.
    return v.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 })
  }
  const s = v.toLocaleString('en-US', { maximumFractionDigits: 1 })
  return kind === 'percent-change' && v > 0 ? `+${s}` : s
}

// One trend chart. seriesList: [{key, label, color, dash, width, cells}].
// Comparability breaks split lines into separate segments — no line is ever
// drawn across a break. Annotation years render a numbered badge even when
// no data exists for that year yet.
// size 'large' (the expanded modal / story embeds) adds value labels on the
// primary series and roomier type; 'normal' labels only the latest point.
export default function TrendChart({ topicId, kind, seriesList, ariaLabel, size = 'normal' }) {
  const { rows, seriesKeys, topicBreaks } = buildChart(topicId, seriesList)
  const large = size === 'large'

  const stackOf = topicBreaks.map((b, i) =>
    topicBreaks.slice(0, i).filter((o) => o.school_year === b.school_year).length,
  )
  const topMargin = 26 + Math.max(0, ...stackOf) * 20
  const height = (large ? Math.max(340, Math.min(560, window.innerHeight * 0.55)) : 260) + topMargin - 26

  const primaryKey = seriesList[seriesList.length - 1]?.key
  const lastIdxOf = {}
  for (const s of seriesList) {
    for (let i = rows.length - 1; i >= 0; i--) {
      if (seriesKeys[s.key].some((k) => rows[i][k] != null)) {
        lastIdxOf[s.key] = i
        break
      }
    }
  }
  const tickStyle = {
    fontSize: large ? 12 : 10.5,
    fontFamily: "'JetBrains Mono', monospace",
    fill: '#6B675C',
  }
  const fmtTick = (v) =>
    kind === 'count' ? v.toLocaleString('en-US') : kind === 'score' ? v : `${v}%`

  // Value labels for the primary (district) series. Labeling all ~21 points
  // of a long series collides badly on narrow screens, so large mode labels
  // a thinned subset — roughly every Nth point, always keeping the first and
  // newest — and drops each label below the line at local dips so labels
  // stop crossing the line they describe. Normal mode: newest point only.
  const primaryVals = rows.map((r) => {
    for (const k of seriesKeys[primaryKey] ?? []) if (r[k] != null) return r[k]
    return null
  })
  const nonNull = primaryVals.map((v, i) => (v == null ? null : i)).filter((i) => i != null)
  const labelSet = new Set()
  if (large && nonNull.length) {
    const step = Math.max(1, Math.ceil(nonNull.length / 9))
    nonNull.forEach((idx, j) => {
      if (j % step === 0) labelSet.add(idx)
    })
    labelSet.add(nonNull[0])
    const lastIdx = nonNull[nonNull.length - 1]
    if (step > 1) {
      // Keep the newest label from crowding its stepped neighbor.
      for (const idx of [...labelSet]) {
        if (idx !== lastIdx && Math.abs(idx - lastIdx) < Math.ceil(step / 2)) labelSet.delete(idx)
      }
    }
    labelSet.add(lastIdx)
  } else if (nonNull.length) {
    labelSet.add(nonNull[nonNull.length - 1])
  }
  const isLocalDip = (i) => {
    const before = nonNull.filter((j) => j < i)
    const after = nonNull.filter((j) => j > i)
    const prev = before.length ? primaryVals[before[before.length - 1]] : null
    const next = after.length ? primaryVals[after[0]] : null
    const v = primaryVals[i]
    return (prev == null || v <= prev) && (next == null || v <= next) && !(prev == null && next == null)
  }

  const valueLabel = (sKey, dataKey) => {
    if (sKey !== primaryKey) return null
    const render = (props) => {
      const { x, y, value, index } = props
      if (value == null || !labelSet.has(index)) return null
      const below = isLocalDip(index)
      return (
        <text
          x={x}
          y={below ? y + 18 : y - 9}
          textAnchor="middle"
          fontSize={large ? 11.5 : 11}
          fontWeight={600}
          fontFamily="'JetBrains Mono', monospace"
          fill="#2C6A62"
          stroke="#FDFBF6"
          strokeWidth={3}
          paintOrder="stroke"
        >
          {shortNum(value, kind)}
        </text>
      )
    }
    return <LabelList key={`lbl-${dataKey}`} dataKey={dataKey} content={render} />
  }

  return (
    <div className="trend-chart" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={rows}
          margin={{ top: topMargin, right: large ? 22 : 14, bottom: large ? 18 : 4, left: large ? 10 : 0 }}
        >
          <CartesianGrid stroke="#E4DECF" strokeDasharray="1 3" vertical={false} />
          <XAxis
            dataKey="year"
            tickFormatter={(y) => (large ? y : `’${y.slice(2, 4)}`)}
            tick={tickStyle}
            tickLine={false}
            axisLine={{ stroke: '#C9C2AE' }}
            interval="preserveStartEnd"
            minTickGap={large ? 34 : 18}
            angle={large ? -35 : 0}
            textAnchor={large ? 'end' : 'middle'}
            height={large ? 52 : 30}
            label={large ? { value: 'School year', position: 'insideBottom', offset: -4, style: { fontSize: 12, fill: '#6B675C', fontFamily: "'Public Sans', sans-serif" } } : undefined}
          />
          <YAxis
            width={large ? 58 : 44}
            tick={tickStyle}
            tickFormatter={fmtTick}
            tickLine={false}
            axisLine={false}
            domain={['auto', 'auto']}
            label={{
              value: UNIT_LABEL[kind] ?? '',
              angle: -90,
              position: 'insideLeft',
              offset: large ? 2 : 8,
              style: {
                textAnchor: 'middle',
                fontSize: large ? 12 : 10.5,
                fill: '#8A8578',
                fontFamily: "'Public Sans', sans-serif",
              },
            }}
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
                strokeWidth={large ? s.width + 0.4 : s.width}
                strokeDasharray={s.dash}
                dot={s.key === 'state' ? false : { r: large ? 2.6 : 2, fill: s.color, strokeWidth: 0 }}
                activeDot={{ r: 4 }}
                connectNulls={false}
                isAnimationActive={false}
              >
                {valueLabel(s.key, dataKey)}
              </Line>
            )),
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
