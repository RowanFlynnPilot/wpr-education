// Shared chart legend. Hovering an entry focuses that series on the chart
// (others dim) — pointer-only sugar; tooltips and the data table remain the
// full-information paths on touch devices.
export default function ChartLegend({ series, onFocus }) {
  return (
    <div className="chart-legend">
      {series.map((s) => (
        <span
          key={s.key}
          className="legend-item"
          onMouseEnter={onFocus ? () => onFocus(s.key) : undefined}
          onMouseLeave={onFocus ? () => onFocus(null) : undefined}
        >
          <span
            className="legend-swatch"
            style={{
              background: s.color,
              height: s.dash ? 0 : undefined,
              borderTop: s.dash ? `2px ${s.key === 'nation' ? 'dotted' : 'dashed'} ${s.color}` : undefined,
            }}
          />
          {s.label}
        </span>
      ))}
    </div>
  )
}
