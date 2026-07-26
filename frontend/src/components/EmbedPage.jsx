import { suppressedYears } from '../lib/chartData'
import { ACCENTS } from '../lib/logos'
import { COLORS, TOPICS, breaksFor, fmtYear } from '../lib/meta'
import { buildSeriesList } from '../lib/series'
import ChartLegend from './ChartLegend'
import TrendChart from './TrendChart'

// Story mode: one district, one topic, one chart, minimal chrome — made to
// sit inside an article next to the paragraph it illustrates.
// Route: #/embed/{dpi_code}/{topic}?metric=...&peers=...
export default function EmbedPage({ code, topicId, metric, peers, index, state, docs }) {
  const topic = TOPICS.find((t) => t.id === topicId) ?? TOPICS[0]
  const chosenMetric = metric && topic.metrics[metric] ? metric : topic.defaultMetric
  const meta = topic.metrics[chosenMetric]
  const doc = docs[code]
  const entry = index.districts.find((d) => d.dpi_code === code)

  const others = index.districts.filter((d) => d.dpi_code !== code)
  const peerColorOf = (peerCode) =>
    COLORS.peers[others.findIndex((d) => d.dpi_code === peerCode) % COLORS.peers.length]
  const peerDocs = peers.map((p) => ({
    doc: docs[p],
    label: index.districts.find((d) => d.dpi_code === p).label,
  }))

  // In an article, the chart is the district's — tint the primary line and
  // fill with the district's own accent (page-chrome colors stay WPR teal
  // inside the full tool, where series colors must mean the same thing on
  // every page; an embed stands alone).
  const accent = ACCENTS[code]
  const seriesList = buildSeriesList({ topic, metric: chosenMetric, doc, stateDoc: state, peerDocs, peerColorOf })
    .map((s) => (s.key === 'district' && accent ? { ...s, color: accent } : s))
  const supYears = suppressedYears(seriesList[seriesList.length - 1].cells)
  const topicBreaks = breaksFor(topic.id)

  return (
    <div className="embed-page">
      <div className="embed-head" style={accent ? { borderBottomColor: accent } : undefined}>
        <span className="masthead-kicker">Wausau Pilot &amp; Review</span>
        <h1 className="embed-title">
          {entry.label}: {topic.label} — {meta.label}
        </h1>
        <p className="topic-sublabel">{topic.sublabel}</p>
      </div>

      <TrendChart
        topicId={topic.id}
        kind={meta.kind}
        seriesList={seriesList}
        size="large"
        ariaLabel={`${topic.label} — ${meta.label} trend for ${entry.label}`}
      />

      <ChartLegend series={[...seriesList].reverse()} />

      {supYears.length > 0 && (
        <p className="suppression-note">
          {entry.label} data for {supYears.join(', ')}: <strong>suppressed for student privacy</strong>.
        </p>
      )}

      {topicBreaks.length > 0 && (
        <ul className="break-notes">
          {topicBreaks.map((b, i) => (
            <li key={b.id} className={`break-note ${b.type}`}>
              <span className="break-badge">{i + 1}</span>
              <span><strong>{fmtYear(b.school_year)}:</strong> {b.label}.</span>
            </li>
          ))}
        </ul>
      )}

      <p className="embed-source">
        Source: Wisconsin DPI, WISEdash certified files ·{' '}
        <a href={`${window.location.pathname}#/${code}`} target="_blank" rel="noreferrer">
          Explore all districts &amp; topics →
        </a>
      </p>
    </div>
  )
}
