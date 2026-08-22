// One school's page: the same topic sections as a district page, with the
// school as the primary line and its district + Wisconsin as context. The
// school's data rides in data/schools/{district_code}.json (all schools of
// one district per file), fetched lazily here.
import { useEffect, useState } from 'react'
import { loadSchools } from '../lib/data'
import { ACCENTS } from '../lib/logos'
import { COLORS, TOPICS } from '../lib/meta'
import TopicSection from './TopicSection'

export default function SchoolPage({ districtCode, schoolCode, index, state, docs }) {
  const entry = index.districts.find((d) => d.dpi_code === districtCode)
  const districtDoc = docs[districtCode]
  const [schoolsDoc, setSchoolsDoc] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    setSchoolsDoc(null)
    setError(null)
    loadSchools(districtCode).then(
      (d) => alive && setSchoolsDoc(d),
      (e) => alive && setError(e),
    )
    return () => { alive = false }
  }, [districtCode])

  const school = schoolsDoc?.schools?.[schoolCode]

  useEffect(() => {
    if (school) {
      document.title = `${school.name} — ${entry.label} — Central Wisconsin School Data`
    }
  }, [school, entry.label])

  if (error) {
    return (
      <div className="error-panel" role="alert">
        <h2>Couldn't load the school data</h2>
        <p>Something interrupted the connection ({error.message}). This is usually temporary.</p>
        <button className="pill" onClick={() => window.location.reload()}>Try again</button>
      </div>
    )
  }
  if (!schoolsDoc) return <div className="loading">Loading school data…</div>
  if (!school) {
    return (
      <div className="error-panel" role="alert">
        <h2>School not found</h2>
        <p>No school with code {schoolCode} in {entry.label} School District.</p>
        <a className="pill" href={`#/${districtCode}`}>Back to {entry.label}</a>
      </div>
    )
  }

  // The school rides through TopicSection as the primary "doc"; the
  // district itself is the one comparison line. Subgroup files are
  // district-level, so student-group pills stay off (subgroupCode null).
  const doc = {
    district: { dpi_code: schoolCode, dpi_name: school.name },
    topics: school.topics,
  }
  const peerDocs = [{ doc: districtDoc, label: `${entry.label} (district)` }]
  const peerColorOf = () => COLORS.peers[0]
  const visibleTopics = TOPICS.filter((t) => Object.keys(school.topics[t.id] ?? {}).length > 0)

  return (
    <div className="district-page">
      <a className="back-link" href={`#/${districtCode}`}>← {entry.label} School District</a>
      <div
        className="district-header"
        style={ACCENTS[districtCode] ? { borderBottomColor: ACCENTS[districtCode] } : undefined}
      >
        <h2 className="district-title">{school.name}</h2>
        <span className="school-type">{school.type}</span>
      </div>
      <p className="overlay-note">
        Each chart shows {school.name} with the {entry.label} district-wide line
        for context; rate and score charts add Wisconsin. School-level groups
        are small, so expect more privacy suppression than district views.
      </p>

      {visibleTopics.map((topic) => (
        <TopicSection
          key={topic.id}
          topic={topic}
          doc={doc}
          stateDoc={state}
          peerDocs={peerDocs}
          peerColorOf={peerColorOf}
          subgroupCode={null}
          modalSubtitle={`${school.name} · ${entry.label} School District · ${topic.sublabel}`}
        />
      ))}
    </div>
  )
}
