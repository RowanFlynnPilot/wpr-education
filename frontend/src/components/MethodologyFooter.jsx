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
        <strong>Open enrollment.</strong> Transfer figures come from DPI's July
        final aid-payment file (
        <a href="https://dpi.wi.gov/open-enrollment/data/aid-adjustments" target="_blank" rel="noreferrer">
          pupil transfers and aid adjustments
        </a>
        ). They count full-time-equivalent aid membership, not September
        headcounts, so they won't match enrollment exactly. A district's
        transfers aren't necessarily to or from its neighbors — statewide
        virtual charter schools draw students from anywhere in Wisconsin.
      </p>
      <p>
        <strong>Finance.</strong> Cost per member sums the audited cost categories
        in DPI's{' '}
        <a href="https://dpi.wi.gov/sfs/statistical/cost-revenue/section-d" target="_blank" rel="noreferrer">
          comparative cost data
        </a>{' '}
        and divides by resident membership; revenue limit per member is the
        statutory cap from DPI's longitudinal survey (set in advance, so it runs a
        year ahead of audited costs). Referenda come from DPI's{' '}
        <a href="https://sfs.dpi.wi.gov/wisfpr/SchoolDistrictReferendaReport?moduleId=11" target="_blank" rel="noreferrer">
          school district referenda database
        </a>
        . Membership counts differ from enrollment headcounts — don't mix the two.
      </p>
      <p>
        <strong>Logos.</strong> School logos are the districts' own marks, shown
        small for identification only, from each district's official website.
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
