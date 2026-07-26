import { BREAKS } from '../lib/meta'

export default function MethodologyFooter({ generated }) {
  const refreshed = new Date(generated).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  return (
    <footer className="methodology">
      <h2>About this data</h2>
      <p>
        <strong>Source.</strong> Wisconsin Department of Public Instruction,{' '}
        <a href="https://dpi.wi.gov/wisedash/public/download-files" target="_blank" rel="noreferrer">
          WISEdash certified download files
        </a>. Data covers public school districts only. Last refreshed{' '}
        <span className="mono">{refreshed}</span>; DPI data is re-pulled in full twice a
        year (assessments each fall, enrollment and engagement topics each spring), so
        prior years can shift when DPI issues corrections.
      </p>
      <p>
        <strong>Suppressed values.</strong> DPI redacts results for very small student
        groups to protect student privacy. Where you see "suppressed for student
        privacy," the state withheld the number — it is not a zero, and we never
        estimate it.
      </p>
      <p>
        <strong>Changes that break comparisons.</strong> Testing and reporting rules
        change over time. Numbered markers on the charts flag those moments:
      </p>
      <ul>
        {BREAKS.map((b, i) => (
          <li key={b.id}>
            <span className="break-badge">{i + 1}</span>{' '}
            <strong>{b.school_year} — {b.label}.</strong>{' '}
            {b.detail.split(' Extend topics')[0]}
          </li>
        ))}
      </ul>
      <p>
        <strong>Definitions.</strong> Graduation is the 4-year cohort rate for regular
        diplomas. Dropout rate covers grades 7–12. A student is chronically absent if
        enrolled at least 90 days and present for less than 90% of them. ACT figures
        are the census grade-11 statewide administration (not graduating-class ACT
        averages). Enrollment is the certified third-Friday-of-September headcount.
      </p>
      <p>
        <strong>Student groups.</strong> Group breakdowns use DPI's own categories,
        which changed over time: "Two or more races" and "Pacific Islander" were
        added as separate categories in later years, so those lines start when DPI's
        do, and DPI renamed its English-learner category (ELL/LEP, now EL) — we
        treat it as one group. Small groups are heavily redacted; expect gaps
        labeled "suppressed for student privacy," especially in smaller districts.
      </p>
      <p className="credit">
        A <a href="https://wausaupilotandreview.com" target="_blank" rel="noreferrer">Wausau Pilot &amp; Review</a>{' '}
        project. Code and data are public on{' '}
        <a href="https://github.com/RowanFlynnPilot/wpr-education" target="_blank" rel="noreferrer">GitHub</a>.
      </p>
    </footer>
  )
}
