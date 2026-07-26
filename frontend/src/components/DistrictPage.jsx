import { useState } from 'react'
import { seriesFromDoc, suppressedYears } from '../lib/chartData'
import { COLORS, TOPICS, breaksFor, fmtValue, fmtYear } from '../lib/meta'
import TrendChart from './TrendChart'

function latestCell(doc, topicId, metric) {
  const years = doc.topics[topicId] ?? {}
  const have = Object.keys(years).filter((y) => metric in years[y]).sort()
  if (!have.length) return null
  const year = have[have.length - 1]
  return { year, cell: years[year][metric] }
}

function StatBlock({ title, stat, kind }) {
  if (!stat) return null
  return (
    <div className="stat-block">
      <div className="stat-label">{title} <span className="stat-year">({fmtYear(stat.year)})</span></div>
      <div className="stat-value">
        {stat.cell.suppressed ? <span className="suppressed-text">Suppressed</span> : fmtValue(stat.cell.value, kind)}
      </div>
    </div>
  )
}

function TopicSection({ topic, doc, stateDoc, peerDocs, peerColorOf }) {
  const [metric, setMetric] = useState(topic.defaultMetric)
  const meta = topic.metrics[metric]

  const districtCells = seriesFromDoc(doc, topic.id, metric)
  // Raw statewide counts (~800k students) would flatten every district
  // line to zero; the statewide overlay only makes sense for rates/scores.
  const stateSeries = meta.kind === 'count' ? [] : [
    {
      key: 'state',
      label: 'Wisconsin',
      color: COLORS.state,
      dash: '6 4',
      width: 1.6,
      cells: seriesFromDoc(stateDoc, topic.id, metric),
    },
  ]
  const seriesList = [
    ...stateSeries,
    ...peerDocs.map((p) => ({
      key: p.doc.district.dpi_code,
      label: p.label,
      color: peerColorOf(p.doc.district.dpi_code),
      dash: undefined,
      width: 1.6,
      cells: seriesFromDoc(p.doc, topic.id, metric),
    })),
    {
      key: 'district',
      label: doc.district.dpi_name,
      color: COLORS.district,
      dash: undefined,
      width: 2.8,
      cells: districtCells,
    },
  ]

  const supYears = suppressedYears(districtCells)
  const topicBreaks = breaksFor(topic.id)
  const districtStat = latestCell(doc, topic.id, topic.defaultMetric)
  const stateStat = latestCell(stateDoc, topic.id, topic.defaultMetric)
  const defaultMeta = topic.metrics[topic.defaultMetric]

  return (
    <section className="topic-section" id={topic.id}>
      <div className="topic-head">
        <div>
          <h3>{topic.label}</h3>
          <p className="topic-sublabel">{topic.sublabel}</p>
        </div>
        <div className="topic-stats">
          <StatBlock title={doc.district.dpi_name} stat={districtStat} kind={defaultMeta.kind} />
          <StatBlock title="Wisconsin" stat={stateStat} kind={defaultMeta.kind} />
        </div>
      </div>

      {Object.keys(topic.metrics).length > 1 && (
        <div className="pill-row" role="tablist" aria-label={`${topic.label} metrics`}>
          {Object.entries(topic.metrics).map(([key, m]) => (
            <button
              key={key}
              className={`pill${key === metric ? ' active' : ''}`}
              onClick={() => setMetric(key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      <TrendChart topicId={topic.id} kind={meta.kind} seriesList={seriesList} />

      <div className="chart-legend">
        {[...seriesList].reverse().map((s) => (
          <span key={s.key} className="legend-item">
            <span
              className="legend-swatch"
              style={{ background: s.color, height: s.key === 'state' ? 0 : undefined, borderTop: s.key === 'state' ? `2px dashed ${s.color}` : undefined }}
            />
            {s.label}
          </span>
        ))}
      </div>

      {supYears.length > 0 && (
        <p className="suppression-note">
          {doc.district.dpi_name} {metric === topic.defaultMetric ? '' : `${meta.label.toLowerCase()} `}
          data for {supYears.join(', ')}: <strong>suppressed for student privacy</strong>{' '}
          (DPI redacts results for very small student groups).
        </p>
      )}

      {topicBreaks.length > 0 && (
        <ul className="break-notes">
          {topicBreaks.map((b, i) => (
            <li key={b.id} className={`break-note ${b.type}`}>
              <span className="break-badge">{i + 1}</span>
              <span>
                <strong>{b.school_year}: {b.label}.</strong> {b.detail.split(' Extend topics')[0]}
                {b.type === 'comparability_break' && (
                  <em> Values on either side of this line are not directly comparable, so the trend line breaks.</em>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function DistrictPage({ code, index, state, docs }) {
  const doc = docs[code]
  const entry = index.districts.find((d) => d.dpi_code === code)
  const others = index.districts.filter((d) => d.dpi_code !== code)
  const [peers, setPeers] = useState([])

  const togglePeer = (peerCode) =>
    setPeers((p) => (p.includes(peerCode) ? p.filter((x) => x !== peerCode) : [...p, peerCode]))

  // Stable color per peer district regardless of toggle order.
  const peerColorOf = (peerCode) =>
    COLORS.peers[others.findIndex((d) => d.dpi_code === peerCode) % COLORS.peers.length]

  const peerDocs = peers.map((p) => ({
    doc: docs[p],
    label: index.districts.find((d) => d.dpi_code === p).label,
  }))

  return (
    <div className="district-page">
      <a className="back-link" href="#/">← All districts</a>
      <h2 className="district-title">{entry.label} School District</h2>
      <div className="peer-select">
        <span className="peer-select-label">Compare with:</span>
        {others.map((d) => (
          <button
            key={d.dpi_code}
            className={`pill peer-pill${peers.includes(d.dpi_code) ? ' active' : ''}`}
            style={peers.includes(d.dpi_code) ? { background: peerColorOf(d.dpi_code), borderColor: peerColorOf(d.dpi_code) } : undefined}
            onClick={() => togglePeer(d.dpi_code)}
          >
            {d.label}
          </button>
        ))}
      </div>
      <p className="overlay-note">Rate and score charts show Wisconsin statewide as a dashed line; raw-count charts stay district-scale.</p>

      {TOPICS.map((topic) => (
        <TopicSection
          key={topic.id}
          topic={topic}
          doc={doc}
          stateDoc={state}
          peerDocs={peerDocs}
          peerColorOf={peerColorOf}
        />
      ))}
    </div>
  )
}
