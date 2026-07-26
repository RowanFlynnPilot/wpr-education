import { fmtValue, fmtYear } from '../lib/meta'
import { ACCENTS, LOGOS } from '../lib/logos'
import Sparkline from './Sparkline'

// The landing renders entirely from index.json summaries + state.json —
// district files load only when a district page opens.

function fmtLatest(latest, kind) {
  if (!latest) return '—'
  if (latest.suppressed) return 'Suppressed'
  return fmtValue(latest.value, kind)
}

// {year,value,suppressed} latests across districts -> min-max at the newest
// common year, suppressed/absent excluded.
function regionRange(districts, metric) {
  const latests = districts.map((d) => d.summary.latest[metric]).filter((l) => l && !l.suppressed)
  if (!latests.length) return null
  const year = latests.map((l) => l.year).sort().at(-1)
  const values = latests.filter((l) => l.year === year).map((l) => l.value)
  return { year, min: Math.min(...values), max: Math.max(...values) }
}

function stateTrend(state, topicId, metric) {
  const years = state.topics[topicId] ?? {}
  return Object.keys(years)
    .sort()
    .map((y) => (years[y][metric]?.suppressed ? null : years[y][metric]?.value ?? null))
}

function stateLatest(state, topicId, metric) {
  const years = state.topics[topicId] ?? {}
  const have = Object.keys(years).filter((y) => metric in years[y]).sort()
  if (!have.length) return null
  const year = have.at(-1)
  const cell = years[year][metric]
  return { year, value: cell.value, suppressed: cell.suppressed }
}

// Combined regional enrollment per year (sum across included districts).
function regionEnrollmentTrend(districts) {
  const perYear = {}
  for (const d of districts) {
    for (const [y, v] of Object.entries(d.summary.enrollment_trend)) {
      if (v != null) perYear[y] = (perYear[y] ?? 0) + v
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

const scrollToCounty = (county) =>
  document.getElementById(`county-${county}`)?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  })

export default function Landing({ index, state }) {
  const districts = index.districts

  // Marathon leads (the flagship county), the rest alphabetical.
  const counties = [...new Set(districts.map((d) => d.county))]
    .sort((a, b) => (a === 'Marathon' ? -1 : b === 'Marathon' ? 1 : a.localeCompare(b)))

  const enrollLatests = districts.map((d) => d.summary.latest.total_enrollment)
    .filter((l) => l && !l.suppressed)
  const enrollYear = enrollLatests.map((l) => l.year).sort().at(-1)
  const combined = enrollLatests.filter((l) => l.year === enrollYear)
    .reduce((sum, l) => sum + l.value, 0)

  const act = regionRange(districts, 'composite_avg')
  const grad = regionRange(districts, 'grad_rate_4yr')
  const abs = regionRange(districts, 'chronic_absenteeism_rate')

  return (
    <div className="landing">
      <p className="lede">
        How are central Wisconsin's public schools doing? Explore ACT scores,
        graduation, dropouts, attendance and enrollment for {districts.length} districts
        across Marathon County and its eight neighbors — every number from
        certified Wisconsin DPI data, compared against the statewide picture.
      </p>

      <div className="headline-grid">
        <HeadlineCard
          title={`Students enrolled (${fmtYear(enrollYear)})`}
          big={combined.toLocaleString('en-US')}
          sub={`across ${districts.length} districts in 9 counties`}
          spark={regionEnrollmentTrend(districts)}
        />
        {act && (
          <HeadlineCard
            title={`ACT composite (${fmtYear(act.year)})`}
            big={`${fmtValue(act.min, 'score')}–${fmtValue(act.max, 'score')}`}
            sub={`regional range · statewide ${fmtLatest(stateLatest(state, 'act', 'composite_avg'), 'score')}`}
            spark={stateTrend(state, 'act', 'composite_avg')}
          />
        )}
        {grad && (
          <HeadlineCard
            title={`4-year graduation (${fmtYear(grad.year)})`}
            big={`${fmtValue(grad.min, 'percent')}–${fmtValue(grad.max, 'percent')}`}
            sub={`regional range · statewide ${fmtLatest(stateLatest(state, 'graduation', 'grad_rate_4yr'), 'percent')}`}
            spark={stateTrend(state, 'graduation', 'grad_rate_4yr')}
          />
        )}
        {abs && (
          <HeadlineCard
            title={`Chronically absent (${fmtYear(abs.year)})`}
            big={`${fmtValue(abs.min, 'percent')}–${fmtValue(abs.max, 'percent')}`}
            sub={`regional range · statewide ${fmtLatest(stateLatest(state, 'absenteeism', 'chronic_absenteeism_rate'), 'percent')}`}
            spark={stateTrend(state, 'absenteeism', 'chronic_absenteeism_rate')}
          />
        )}
      </div>
      <p className="spark-note">Small lines show the statewide trend (regional total for enrollment).</p>

      <h2 className="section-heading">Pick a district</h2>
      <nav className="county-nav" aria-label="Jump to county">
        {counties.map((c) => (
          <button key={c} className="pill topic-chip" onClick={() => scrollToCounty(c)}>
            {c} Co.
          </button>
        ))}
      </nav>

      {counties.map((county) => {
        const local = districts.filter((d) => d.county === county)
        const countyEnroll = local
          .map((d) => d.summary.latest.total_enrollment)
          .filter((l) => l && !l.suppressed && l.year === enrollYear)
          .reduce((sum, l) => sum + l.value, 0)
        return (
          <section key={county} className="county-section" id={`county-${county}`}>
            <div className="county-head">
              <h3>{county} County</h3>
              <span className="county-meta">
                {local.length} district{local.length === 1 ? '' : 's'} ·{' '}
                {countyEnroll.toLocaleString('en-US')} students
              </span>
            </div>
            <div className="district-grid">
              {local.map((d) => {
                const s = d.summary
                const trend = Object.keys(s.enrollment_trend).sort().map((y) => s.enrollment_trend[y])
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
                      <div><dt>Enrollment</dt><dd>{fmtLatest(s.latest.total_enrollment, 'count')}</dd></div>
                      <div><dt>ACT</dt><dd>{fmtLatest(s.latest.composite_avg, 'score')}</dd></div>
                      <div><dt>Grad rate</dt><dd>{fmtLatest(s.latest.grad_rate_4yr, 'percent')}</dd></div>
                    </dl>
                    <div className="district-card-spark">
                      <Sparkline values={trend} color={ACCENTS[d.dpi_code] ?? '#3A867C'} />
                      <span className="spark-caption">enrollment since ’05</span>
                    </div>
                  </a>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
