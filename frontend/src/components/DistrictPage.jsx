import { useEffect, useState } from 'react'
import { suppressedYears } from '../lib/chartData'
import { chartCSV, downloadCSV } from '../lib/csv'
import { loadSubgroups } from '../lib/data'
import { ACCENTS, LOGOS } from '../lib/logos'
import { COLORS, DIMENSIONS, TOPICS, breaksFor, fmtValue, fmtYear } from '../lib/meta'
import { buildGroupSeriesList, buildSeriesList } from '../lib/series'
import ChartLegend from './ChartLegend'
import ChartModal from './ChartModal'
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
  const [expanded, setExpanded] = useState(false)
  const [focusKey, setFocusKey] = useState(null)
  // null = compare-districts mode; a dimension id = student-group mode.
  const [dimension, setDimension] = useState(null)
  const [subDoc, setSubDoc] = useState(null)
  const [subError, setSubError] = useState(false)
  const meta = topic.metrics[metric]
  const code = doc.district.dpi_code

  useEffect(() => {
    if (!dimension || subDoc) return
    setSubError(false)
    let alive = true
    loadSubgroups(code).then(
      (d) => alive && setSubDoc(d),
      (err) => {
        console.error(err)
        if (alive) {
          setSubError(true)
          setDimension(null)
        }
      },
    )
    return () => { alive = false }
  }, [dimension, subDoc, code])

  const groupMode = dimension && subDoc
  const seriesList = groupMode
    ? buildGroupSeriesList({ topic, metric, subDoc, dimension })
    : buildSeriesList({ topic, metric, doc, stateDoc, peerDocs, peerColorOf })
  // Compare-districts mode draws state -> peers -> district, so the legend
  // reverses to read district-first; group mode is already in display order.
  const legendList = groupMode ? seriesList : [...seriesList].reverse()
  const districtCells = groupMode ? {} : seriesList[seriesList.length - 1].cells

  const supYears = suppressedYears(districtCells)
  const groupSuppression = groupMode
    ? seriesList
        .map((s) => ({ label: s.label, years: suppressedYears(s.cells) }))
        .filter((g) => g.years.length)
    : []
  const topicBreaks = breaksFor(topic.id)
  const districtStat = latestCell(doc, topic.id, topic.defaultMetric)
  const stateStat = latestCell(stateDoc, topic.id, topic.defaultMetric)
  const defaultMeta = topic.metrics[topic.defaultMetric]
  const dimLabel = DIMENSIONS.find((d) => d.id === dimension)?.label

  const exportCSV = () => {
    const slug = doc.district.dpi_name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const suffix = groupMode ? `${dimension}-${metric}` : metric
    downloadCSV(`wpr-${slug}-${topic.id}-${suffix}.csv`, chartCSV(legendList))
  }

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
        <div className="pill-row" role="group" aria-label={`${topic.label} metrics`}>
          {Object.entries(topic.metrics).map(([key, m]) => (
            <button
              key={key}
              className={`pill${key === metric ? ' active' : ''}`}
              aria-pressed={key === metric}
              onClick={() => setMetric(key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {DIMENSIONS.length > 0 && (
        <div className="pill-row dim-row" role="group" aria-label={`${topic.label} student groups`}>
          <span className="dim-row-label">Break out by:</span>
          <button
            className={`pill${dimension === null ? ' active' : ''}`}
            aria-pressed={dimension === null}
            onClick={() => setDimension(null)}
          >
            All students
          </button>
          {DIMENSIONS.map((d) => (
            <button
              key={d.id}
              className={`pill${dimension === d.id ? ' active' : ''}`}
              aria-pressed={dimension === d.id}
              onClick={() => setDimension(d.id)}
            >
              {d.label}
            </button>
          ))}
        </div>
      )}

      {subError && (
        <p className="derived-note" role="alert">
          Couldn't load the student-group data just now — check your connection
          and try the group buttons again.
        </p>
      )}

      {dimension && !subDoc ? (
        <div className="loading loading-inline">Loading student groups…</div>
      ) : (
        <TrendChart
          topicId={topic.id}
          kind={meta.kind}
          seriesList={seriesList}
          showLabels={!groupMode}
          focusKey={focusKey}
          ariaLabel={
            groupMode
              ? `${topic.label} — ${meta.label} by ${dimLabel} for ${doc.district.dpi_name}`
              : `${topic.label} — ${meta.label} trend for ${doc.district.dpi_name}`
          }
        />
      )}

      {groupMode && (
        <p className="derived-note">
          {doc.district.dpi_name} students only, one line per {dimLabel.toLowerCase()} group
          as reported by DPI. Statewide and peer comparison apply to the all-students view.
        </p>
      )}

      <div className="chart-foot">
        <ChartLegend series={legendList} onFocus={setFocusKey} />
        <div className="chart-actions">
          <button className="csv-button" onClick={() => setExpanded(true)} aria-haspopup="dialog">
            ⤢ Expand
          </button>
          <button className="csv-button" onClick={exportCSV}>
            ↓ CSV
          </button>
        </div>
      </div>

      {expanded && (
        <ChartModal
          title={`${topic.label} — ${meta.label}${groupMode ? ` by ${dimLabel.toLowerCase()}` : ''}`}
          subtitle={`${doc.district.dpi_name} School District · ${topic.sublabel}`}
          onClose={() => setExpanded(false)}
        >
          <TrendChart
            topicId={topic.id}
            kind={meta.kind}
            seriesList={seriesList}
            size="large"
            showLabels={!groupMode}
            focusKey={focusKey}
            ariaLabel={`${topic.label} — ${meta.label} trend for ${doc.district.dpi_name}, expanded`}
          />
          <ChartLegend series={legendList} onFocus={setFocusKey} />
          <p className="chart-modal-source">Source: Wisconsin DPI, WISEdash certified download files.</p>
        </ChartModal>
      )}

      <details className="data-table">
        <summary>View the numbers</summary>
        <div className="data-table-scroll">
          <table>
            <caption className="visually-hidden">
              {topic.label} — {meta.label} by school year
            </caption>
            <thead>
              <tr>
                <th scope="col">School year</th>
                {legendList.map((s) => (
                  <th key={s.key} scope="col">{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...new Set(seriesList.flatMap((s) => Object.keys(s.cells)))].sort().map((year) => (
                <tr key={year}>
                  <th scope="row">{fmtYear(year)}</th>
                  {legendList.map((s) => {
                    const cell = s.cells[year]
                    return (
                      <td key={s.key} className={cell?.suppressed ? 'cell-suppressed' : ''}>
                        {!cell ? '—' : cell.suppressed ? 'Suppressed' : fmtValue(cell.value, meta.kind)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {meta.derivedFrom && (
        <p className="derived-note">
          {groupMode
            ? "Percent change is computed against each group's own first year of data."
            : `Percent change is computed against each district's own first year of data (${fmtYear('2005-06')} for every district shown and the state).`}
        </p>
      )}

      {!groupMode && supYears.length > 0 && (
        <p className="suppression-note">
          {doc.district.dpi_name} {metric === topic.defaultMetric ? '' : `${meta.label.toLowerCase()} `}
          data for {supYears.join(', ')}: <strong>suppressed for student privacy</strong>{' '}
          (DPI redacts results for very small student groups).
        </p>
      )}

      {groupMode && groupSuppression.length > 0 && (
        <p className="suppression-note">
          <strong>Suppressed for student privacy</strong> (small groups; DPI
          redacts, we never estimate):{' '}
          {groupSuppression.map((g, i) => (
            <span key={g.label}>
              {i > 0 && '; '}
              {g.label} ({g.years.length === 1 ? g.years[0] : `${g.years.length} years`})
            </span>
          ))}
          . Suppressed years appear as gaps in the lines and as "Suppressed" in
          the table above.
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

export default function DistrictPage({ code, peers, index, state, docs }) {
  const doc = docs[code]
  const entry = index.districts.find((d) => d.dpi_code === code)
  const others = index.districts.filter((d) => d.dpi_code !== code)
  // Only topics this district has data for: many small districts offer no
  // AP exams, and K-8 districts have no PreACT/graduation rows at all.
  const visibleTopics = TOPICS.filter((t) => Object.keys(doc.topics[t.id] ?? {}).length > 0)

  // Peer selection lives in the hash (#/6223?peers=4970,0196) so a specific
  // comparison is shareable and embeddable. Assigning location.hash fires
  // hashchange; App preserves scroll when only the query part changes.
  const setPeers = (list) => {
    window.location.hash = `#/${code}${list.length ? `?peers=${list.join(',')}` : ''}`
  }
  const togglePeer = (peerCode) =>
    setPeers(peers.includes(peerCode) ? peers.filter((x) => x !== peerCode) : [...peers, peerCode])

  // Stable color per peer district regardless of toggle order.
  const peerColorOf = (peerCode) =>
    COLORS.peers[others.findIndex((d) => d.dpi_code === peerCode) % COLORS.peers.length]

  const peerDocs = peers.map((p) => ({
    doc: docs[p],
    label: index.districts.find((d) => d.dpi_code === p).label,
  }))

  return (
    <div className="district-page">
      <a className="back-link" href={`#/?county=${encodeURIComponent(entry.county)}`}>← All districts</a>
      <div className="district-header" style={ACCENTS[code] ? { borderBottomColor: ACCENTS[code] } : undefined}>
        {LOGOS[code] && (
          <span className="logo-chip logo-chip-lg">
            <img src={LOGOS[code]} alt={`${entry.label} School District logo`} />
          </span>
        )}
        <h2 className="district-title">{entry.label} School District</h2>
      </div>
      <nav className="topic-nav" aria-label="Jump to topic">
        {visibleTopics.map((t) => (
          <button
            key={t.id}
            className="pill topic-chip"
            onClick={() => document.getElementById(t.id)?.scrollIntoView({
              behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
              block: 'start',
            })}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <div className="peer-select">
        <span className="peer-select-label">Compare with {entry.county} County:</span>
        {others.filter((d) => d.county === entry.county).map((d) => (
          <button
            key={d.dpi_code}
            className={`pill peer-pill${peers.includes(d.dpi_code) ? ' active' : ''}`}
            aria-pressed={peers.includes(d.dpi_code)}
            style={peers.includes(d.dpi_code) ? { background: peerColorOf(d.dpi_code), borderColor: peerColorOf(d.dpi_code) } : undefined}
            onClick={() => togglePeer(d.dpi_code)}
          >
            {d.label}
          </button>
        ))}
      </div>
      <details
        className="peer-more"
        open={peers.some((p) => index.districts.find((d) => d.dpi_code === p)?.county !== entry.county)}
      >
        <summary>Compare across the region</summary>
        {[...new Set(others.filter((d) => d.county !== entry.county).map((d) => d.county))]
          .sort()
          .map((county) => (
            <div key={county} className="peer-select peer-select-county">
              <span className="peer-select-label">{county}:</span>
              {others.filter((d) => d.county === county).map((d) => (
                <button
                  key={d.dpi_code}
                  className={`pill peer-pill${peers.includes(d.dpi_code) ? ' active' : ''}`}
                  aria-pressed={peers.includes(d.dpi_code)}
                  style={peers.includes(d.dpi_code) ? { background: peerColorOf(d.dpi_code), borderColor: peerColorOf(d.dpi_code) } : undefined}
                  onClick={() => togglePeer(d.dpi_code)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          ))}
      </details>
      <p className="overlay-note">Rate and score charts show Wisconsin statewide as a dashed line; raw-count charts stay district-scale.</p>

      {visibleTopics.map((topic) => (
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
