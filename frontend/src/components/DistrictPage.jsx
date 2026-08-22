import { useEffect, useState } from 'react'
import { loadSchools } from '../lib/data'
import { ACCENTS, LOGOS } from '../lib/logos'
import { COLORS, TOPICS } from '../lib/meta'
import ReferendaSection from './ReferendaSection'
import TopicSection from './TopicSection'

// School-type display order for the schools nav.
const TYPE_ORDER = ['Elementary School', 'Middle School', 'Junior High School',
                    'High School', 'Combined Elementary/Secondary School']
const typeRank = (t) => {
  const i = TYPE_ORDER.indexOf(t)
  return i === -1 ? TYPE_ORDER.length : i
}

export default function DistrictPage({ code, peers, index, state, docs }) {
  const doc = docs[code]
  const entry = index.districts.find((d) => d.dpi_code === code)
  const others = index.districts.filter((d) => d.dpi_code !== code)
  // Only topics this district has data for: many small districts offer no
  // AP exams, and K-8 districts have no PreACT/graduation rows at all.
  const visibleTopics = TOPICS.filter((t) => Object.keys(doc.topics[t.id] ?? {}).length > 0)

  // Schools nav: lazy so the landing page never pays for school files.
  // A load failure just hides the nav (the district page is complete
  // without it); the school page itself surfaces errors properly.
  const [schoolsDoc, setSchoolsDoc] = useState(null)
  useEffect(() => {
    let alive = true
    setSchoolsDoc(null)
    loadSchools(code).then((d) => alive && setSchoolsDoc(d), console.error)
    return () => { alive = false }
  }, [code])
  const schools = Object.entries(schoolsDoc?.schools ?? {})
    .sort(([, a], [, b]) => typeRank(a.type) - typeRank(b.type) || a.name.localeCompare(b.name))
  // Schools whose data ends before the district's newest year are closed
  // (or renamed) — kept browsable as history, but visually parked.
  const lastYearOf = (s) =>
    Object.values(s.topics).flatMap((years) => Object.keys(years)).sort().at(-1)
  const newestYear = schools.map(([, s]) => lastYearOf(s)).sort().at(-1)

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
      {schools.length > 0 && (
        <div className="peer-select school-nav">
          <span className="peer-select-label">Drill into a school:</span>
          {schools.map(([scode, s]) => {
            const last = lastYearOf(s)
            const stale = last < newestYear
            return (
              <a
                key={scode}
                className={`pill school-pill${stale ? ' school-pill-closed' : ''}`}
                href={`#/${code}/school/${scode}`}
                title={stale ? `No longer reporting — data through ${last}` : undefined}
              >
                {s.name}
              </a>
            )
          })}
        </div>
      )}
      <p className="overlay-note">Rate and score charts show Wisconsin statewide as a dashed line; raw-count charts stay district-scale.</p>

      {visibleTopics.map((topic) => (
        <TopicSection
          key={topic.id}
          topic={topic}
          doc={doc}
          stateDoc={state}
          peerDocs={peerDocs}
          peerColorOf={peerColorOf}
          subgroupCode={code}
        />
      ))}
      <ReferendaSection code={code} districtLabel={entry.label} />
    </div>
  )
}
