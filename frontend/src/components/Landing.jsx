import { fmtValue, fmtYear } from '../lib/meta'
import { ACCENTS, LOGOS } from '../lib/logos'
import Sparkline from './Sparkline'

function latest(doc, topicId, metric) {
  const years = doc.topics[topicId] ?? {}
  const have = Object.keys(years).filter((y) => metric in years[y]).sort()
  if (!have.length) return null
  const year = have[have.length - 1]
  return { year, cell: years[year][metric] }
}

function fmtCell(stat, kind) {
  if (!stat) return '—'
  if (stat.cell.suppressed) return 'Suppressed'
  return fmtValue(stat.cell.value, kind)
}

// min–max across included districts for one metric's latest common year.
function countyRange(docs, topicId, metric) {
  const stats = Object.values(docs)
    .map((doc) => latest(doc, topicId, metric))
    .filter((s) => s && !s.cell.suppressed)
  if (!stats.length) return null
  const year = stats.map((s) => s.year).sort().at(-1)
  const values = stats.filter((s) => s.year === year).map((s) => s.cell.value)
  return { year, min: Math.min(...values), max: Math.max(...values) }
}

// Statewide history for a metric, for the headline sparklines.
function stateTrend(state, topicId, metric) {
  const years = state.topics[topicId] ?? {}
  return Object.keys(years)
    .sort()
    .map((y) => (years[y][metric]?.suppressed ? null : years[y][metric]?.value ?? null))
}

// County combined enrollment per year (sum of included districts).
function countyEnrollmentTrend(docs) {
  const perYear = {}
  for (const doc of Object.values(docs)) {
    for (const [y, m] of Object.entries(doc.topics.enrollment ?? {})) {
      if (!m.total_enrollment || m.total_enrollment.suppressed) continue
      perYear[y] = (perYear[y] ?? 0) + m.total_enrollment.value
    }
  }
  return Object.keys(perYear).sort().map((y) => perYear[y])
}

function HeadlineCard({ title, big, sub, spark }) {
  return (
    <div className="headline-card">
      <div className="headline-title">{title}</div>
      <div className="headline-big">{big}</div>
      {spark && <Sparkline values={spark} />}
      <div className="headline-sub">{sub}</div>
    </div>
  )
}

export default function Landing({ index, state, docs }) {
  const enrollTotal = Object.values(docs)
    .map((doc) => latest(doc, 'enrollment', 'total_enrollment'))
    .filter((s) => s && !s.cell.suppressed)
  const enrollYear = enrollTotal.map((s) => s.year).sort().at(-1)
  const combined = enrollTotal
    .filter((s) => s.year === enrollYear)
    .reduce((sum, s) => sum + s.cell.value, 0)

  const act = countyRange(docs, 'act', 'composite_avg')
  const grad = countyRange(docs, 'graduation', 'grad_rate_4yr')
  const abs = countyRange(docs, 'absenteeism', 'chronic_absenteeism_rate')

  const stateAct = latest(state, 'act', 'composite_avg')
  const stateGrad = latest(state, 'graduation', 'grad_rate_4yr')
  const stateAbs = latest(state, 'absenteeism', 'chronic_absenteeism_rate')

  return (
    <div className="landing">
      <p className="lede">
        How are Marathon County's public schools doing? Explore ACT scores,
        graduation, dropouts, attendance and enrollment for {index.districts.length} local
        districts — every number from certified Wisconsin DPI data, compared
        against the statewide picture.
      </p>

      <div className="headline-grid">
        <HeadlineCard
          title={`Students enrolled (${fmtYear(enrollYear)})`}
          big={combined.toLocaleString('en-US')}
          sub={`across ${index.districts.length} county districts`}
          spark={countyEnrollmentTrend(docs)}
        />
        {act && (
          <HeadlineCard
            title={`ACT composite (${fmtYear(act.year)})`}
            big={`${fmtValue(act.min, 'score')}–${fmtValue(act.max, 'score')}`}
            sub={`county range · statewide ${fmtCell(stateAct, 'score')}`}
            spark={stateTrend(state, 'act', 'composite_avg')}
          />
        )}
        {grad && (
          <HeadlineCard
            title={`4-year graduation (${fmtYear(grad.year)})`}
            big={`${fmtValue(grad.min, 'percent')}–${fmtValue(grad.max, 'percent')}`}
            sub={`county range · statewide ${fmtCell(stateGrad, 'percent')}`}
            spark={stateTrend(state, 'graduation', 'grad_rate_4yr')}
          />
        )}
        {abs && (
          <HeadlineCard
            title={`Chronically absent (${fmtYear(abs.year)})`}
            big={`${fmtValue(abs.min, 'percent')}–${fmtValue(abs.max, 'percent')}`}
            sub={`county range · statewide ${fmtCell(stateAbs, 'percent')}`}
            spark={stateTrend(state, 'absenteeism', 'chronic_absenteeism_rate')}
          />
        )}
      </div>
      <p className="spark-note">Small lines show the statewide trend (county total for enrollment).</p>

      <h2 className="section-heading">Pick a district</h2>
      <div className="district-grid">
        {index.districts.map((d) => {
          const doc = docs[d.dpi_code]
          const enroll = latest(doc, 'enrollment', 'total_enrollment')
          const actC = latest(doc, 'act', 'composite_avg')
          const gradR = latest(doc, 'graduation', 'grad_rate_4yr')
          const enrollTrend = Object.keys(doc.topics.enrollment ?? {})
            .sort()
            .map((y) => doc.topics.enrollment[y].total_enrollment)
            .map((c) => (c.suppressed ? null : c.value))
          return (
            <a
              key={d.dpi_code}
              className="district-card"
              href={`#/${d.dpi_code}`}
              style={ACCENTS[d.dpi_code] ? { borderLeftColor: ACCENTS[d.dpi_code] } : undefined}
            >
              <div className="district-card-head">
                {LOGOS[d.dpi_code] && (
                  <span className="logo-chip">
                    <img src={LOGOS[d.dpi_code]} alt="" />
                  </span>
                )}
                <div className="district-card-name">{d.label}</div>
              </div>
              <dl className="district-card-stats">
                <div><dt>Enrollment</dt><dd>{fmtCell(enroll, 'count')}</dd></div>
                <div><dt>ACT</dt><dd>{fmtCell(actC, 'score')}</dd></div>
                <div><dt>Grad rate</dt><dd>{fmtCell(gradR, 'percent')}</dd></div>
              </dl>
              <div className="district-card-spark">
                <Sparkline values={enrollTrend} color={ACCENTS[d.dpi_code] ?? '#3A867C'} />
                <span className="spark-caption">enrollment since ’05</span>
              </div>
            </a>
          )
        })}
      </div>
    </div>
  )
}
