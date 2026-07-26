// Tiny inline trend line for headline cards. Purely decorative context —
// no axes, no tooltip — so it's marked aria-hidden; the card's big number
// carries the information.
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
  const points = pts
    .map((v, i) => `${(pad + i * step).toFixed(1)},${(h - pad - ((v - min) / span) * (h - pad * 2)).toFixed(1)}`)
    .join(' ')
  return (
    <svg className="sparkline" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.75"
      />
      <circle
        cx={pad + (pts.length - 1) * step}
        cy={h - pad - ((pts[pts.length - 1] - min) / span) * (h - pad * 2)}
        r="2.2"
        fill={color}
      />
    </svg>
  )
}
