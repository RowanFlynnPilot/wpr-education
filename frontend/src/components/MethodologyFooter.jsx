import wprBadge from '../assets/wpr-typewriter-badge.png'
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
        <strong>The U.S. line.</strong> Some charts carry a dotted "United States"
        line; most deliberately don't. Graduation gets one because the national
        figure (
        <a href="https://nces.ed.gov/programs/digest/d23/tables/dt23_219.46.asp" target="_blank" rel="noreferrer">
          NCES, 4-year adjusted cohort graduation rate
        </a>
        ) uses the same federal methodology Wisconsin reports into, and enrollment's
        percent-change view gets one (
        <a href="https://nces.ed.gov/programs/digest/d23/tables/dt23_203.10.asp" target="_blank" rel="noreferrer">
          NCES fall enrollment, actual years only
        </a>
        ). ACT gets none: Wisconsin tests <em>every</em> 11th-grader, while the
        widely quoted national ACT average covers only students who chose to take
        the test — the populations aren't comparable. Chronic absenteeism gets none
        because the federal count (15+ days missed) uses a different definition
        than Wisconsin's percentage-based rate. National data also runs one to
        three years behind DPI's, so the U.S. line ends earlier.
      </p>
      <p>
        <strong>Student groups.</strong> Group breakdowns use DPI's own categories
        (here, economically disadvantaged students and their peers). Small groups
        are heavily redacted; expect gaps labeled "suppressed for student privacy,"
        especially in smaller districts.
      </p>
      <p className="credit">
        <img className="credit-badge" src={wprBadge} alt="" />
        <span>
          A <a href="https://wausaupilotandreview.com" target="_blank" rel="noreferrer">Wausau Pilot &amp; Review</a>{' '}
          project — more news, less fluff, all local. Code and data are public on{' '}
          <a href="https://github.com/RowanFlynnPilot/wpr-education" target="_blank" rel="noreferrer">GitHub</a>.
        </span>
      </p>
    </footer>
  )
}
