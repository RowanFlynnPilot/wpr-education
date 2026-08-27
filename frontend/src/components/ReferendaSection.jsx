// Referenda history table for one district — every school-funding ballot
// question since 1990 from DPI's WiSFPR database. An event list, not a
// trend chart; upcoming votes (status "Before the Vote Date") are shown
// as scheduled. Loads lazily; a load failure hides the section (the
// district page is complete without it).
import { useEffect, useState } from 'react'
import { loadReferenda } from '../lib/data'
import { fmtValue } from '../lib/meta'

const TYPE_LABELS = {
  ID: 'Capital (debt)',
  NR: 'Operating, non-recurring',
  RR: 'Operating, recurring',
  R1: 'Operating, recurring',
  R2: 'Operating, recurring',
}

const fmtDate = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })

function Result({ e }) {
  if (e.status === 'Before the Vote Date') {
    return <span className="ref-upcoming">Vote scheduled</span>
  }
  // Only Passed/Failed get outcome styling — other statuses (Election
  // Cancelled, ...) are not voter decisions. The yes-% renders only when
  // BOTH counts are real numbers; the schema allows nulls.
  const cls = e.status === 'Passed' ? 'ref-passed'
    : e.status === 'Failed' ? 'ref-failed'
    : 'ref-upcoming'
  const total = e.yes_votes != null && e.no_votes != null ? e.yes_votes + e.no_votes : 0
  return (
    <span className={cls}>
      {e.status}
      {total > 0 && (
        <span className="ref-votes">
          {' '}({Math.round((100 * e.yes_votes) / total)}% yes)
        </span>
      )}
    </span>
  )
}

export default function ReferendaSection({ code, districtLabel }) {
  const [doc, setDoc] = useState(null)
  useEffect(() => {
    let alive = true
    setDoc(null)
    loadReferenda(code).then((d) => alive && setDoc(d), console.error)
    return () => { alive = false }
  }, [code])

  if (!doc || !doc.referenda.length) return null
  const events = [...doc.referenda].reverse() // newest first
  const passed = doc.referenda.filter((e) => e.status === 'Passed').length
  const decided = doc.referenda.filter((e) => ['Passed', 'Failed'].includes(e.status)).length

  return (
    <section className="topic-section" id="referenda">
      <div className="topic-head">
        <div>
          <h3>Referenda</h3>
          <p className="topic-sublabel">
            Every school-funding ballot question since 1990 — {passed} of {decided} passed
          </p>
        </div>
      </div>
      <div className="data-table-scroll">
        <table className="referenda-table">
          <caption className="visually-hidden">
            {districtLabel} school funding referenda
          </caption>
          <thead>
            <tr>
              <th scope="col">Vote</th>
              <th scope="col">Type</th>
              <th scope="col">Amount</th>
              <th scope="col">Result</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e, i) => (
              <tr key={`${e.vote_date}-${i}`} title={e.brief || undefined}>
                <td className="mono">{fmtDate(e.vote_date)}</td>
                <td>{TYPE_LABELS[e.type_code] ?? e.type}</td>
                <td className="mono">{e.amount != null ? fmtValue(e.amount, 'dollars') : '—'}</td>
                <td><Result e={e} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="derived-note">
        Amounts are the total authorization sought (debt issued, or revenue-limit
        authority summed across the years requested). Source: DPI school district
        referenda database; recent entries are district-reported.
      </p>
    </section>
  )
}
