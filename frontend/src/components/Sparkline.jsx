// Tiny inline trend line for headline cards. Purely decorative context —
// no axes, no tooltip — so it's marked aria-hidden; the card's big number
// carries the information.
let sparkSeq = 0

export default function Sparkline({ values, color = '#3A867C' }) {
  const pts = values.filter((v) => v != null)
  if (pts.length < 2) return null
  const w = 96
  const h = 26
  const pad = 2
  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const span = max - min || 1
  const step = (w - pad * 2) / (pts.length - 1)
  const coords = pts.map((v, i) => [
    +(pad + i * step).toFixed(1),
    +(h - pad - ((v - min) / span) * (h - pad * 2)).toFixed(1),
  ])
  const points = coords.map(([x, y]) => `${x},${y}`).join(' ')
  const areaPoints = `${points} ${coords[coords.length - 1][0]},${h} ${coords[0][0]},${h}`
  const gradId = `spark-grad-${sparkSeq++}`
  return (
    <svg className="sparkline" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${gradId})`} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
      <circle
        cx={coords[coords.length - 1][0]}
        cy={coords[coords.length - 1][1]}
        r="2.2"
        fill={color}
      />
    </svg>
  )
}
