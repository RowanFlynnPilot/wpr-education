// Topic + metric presentation metadata, and the methodology breaks that the
// charts must render. breaks.json is read at build time straight from config.
import breaksConfig from '../../../config/breaks.json'

export const BREAKS = breaksConfig.breaks

export const TOPICS = [
  {
    id: 'act',
    label: 'ACT',
    sublabel: 'Grade 11 statewide ACT',
    defaultMetric: 'composite_avg',
    metrics: {
      composite_avg: { label: 'Composite average', kind: 'score' },
      english_avg: { label: 'English average', kind: 'score' },
      math_avg: { label: 'Math average', kind: 'score' },
      reading_avg: { label: 'Reading average', kind: 'score' },
      science_avg: { label: 'Science average', kind: 'score' },
      participation_pct: { label: 'Participation', kind: 'percent' },
    },
  },
  {
    id: 'preact',
    label: 'PreACT',
    sublabel: 'Grades 9–10, first offered 2022-23',
    defaultMetric: 'composite_avg_gr10',
    metrics: {
      composite_avg_gr10: { label: 'Grade 10 composite', kind: 'score' },
      composite_avg_gr9: { label: 'Grade 9 composite', kind: 'score' },
    },
  },
  {
    id: 'ap',
    label: 'AP exams',
    sublabel: 'Advanced Placement, all exams combined',
    defaultMetric: 'pct_3_or_above',
    metrics: {
      pct_3_or_above: { label: 'Exams scoring 3+', kind: 'percent' },
      students_tested: { label: 'Students tested', kind: 'count' },
      exam_count: { label: 'Exams taken', kind: 'count' },
    },
  },
  {
    id: 'graduation',
    label: 'Graduation',
    sublabel: '4-year cohort, regular diploma',
    defaultMetric: 'grad_rate_4yr',
    metrics: {
      grad_rate_4yr: { label: 'Graduation rate', kind: 'percent' },
      // 5-/6-year rates: the cohort that was five/six years out as of that
      // school year (DPI's own presentation) — the late-completers story.
      grad_rate_5yr: { label: '5-year rate', kind: 'percent' },
      grad_rate_6yr: { label: '6-year rate', kind: 'percent' },
      grad_count_4yr: { label: 'Graduates', kind: 'count' },
      cohort_count_4yr: { label: 'Cohort size', kind: 'count' },
    },
  },
  {
    id: 'dropouts',
    label: 'Dropouts',
    sublabel: 'Grades 7–12',
    defaultMetric: 'dropout_rate',
    metrics: {
      dropout_rate: { label: 'Dropout rate', kind: 'percent' },
      dropout_count: { label: 'Dropouts', kind: 'count' },
    },
  },
  {
    id: 'absenteeism',
    label: 'Attendance',
    sublabel: 'Chronic absenteeism & attendance',
    defaultMetric: 'chronic_absenteeism_rate',
    metrics: {
      chronic_absenteeism_rate: { label: 'Chronically absent', kind: 'percent' },
      attendance_rate: { label: 'Attendance rate', kind: 'percent' },
    },
  },
  {
    id: 'enrollment',
    label: 'Enrollment',
    sublabel: 'Total public enrollment',
    defaultMetric: 'total_enrollment',
    metrics: {
      total_enrollment: { label: 'Students enrolled', kind: 'count' },
      // Derived client-side from total_enrollment: percent change vs the
      // series' first non-suppressed year (2005-06 for every district and
      // the state). Raw statewide counts can't share an axis with district
      // counts; indexed change can, so this view gets the statewide overlay.
      enrollment_change: {
        label: 'Change since 2005-06',
        kind: 'percent-change',
        derivedFrom: 'total_enrollment',
      },
    },
  },
]

// School years in running text use a non-breaking hyphen so "(2024-25)"
// never wraps to "(2024-" / "25)" on narrow screens.
export function fmtYear(year) {
  return year.replace('-', '‑')
}

export function fmtValue(value, kind) {
  if (value == null) return '—'
  if (kind === 'percent') return `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`
  if (kind === 'percent-change') {
    const s = value.toLocaleString('en-US', { maximumFractionDigits: 1 })
    return `${value > 0 ? '+' : ''}${s}%`
  }
  if (kind === 'score') return value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 })
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

export function breaksFor(topicId) {
  return BREAKS.filter((b) => b.topics.includes(topicId))
}

// Colors: WPR design system.
export const COLORS = {
  district: '#3A867C',
  state: '#8A8578',
  peers: ['#C2703D', '#7D5BA6', '#B04A5A', '#4A7DB0', '#94742F', '#5A8AA0', '#A0628A'],
  // Categorical palette for student-group lines (up to 7 race categories).
  groups: ['#3A867C', '#C2703D', '#7D5BA6', '#4A7DB0', '#B04A5A', '#94742F', '#A0628A', '#5A8AA0', '#4A2B52'],
}

// Student-group dimensions offered in the UI. Editorial decision
// 2026-07-26: none for now — the whole "Break out by" row is hidden when
// this list is empty. The pipeline still emits all four dimensions into
// data/subgroups/*.json, so re-enabling any of them is a one-line change:
//   { id: 'econ_status', label: 'Economic status' },
//   { id: 'race_ethnicity', label: 'Race & ethnicity' },
//   { id: 'disability', label: 'Disability' },
//   { id: 'el_status', label: 'English learners' },
export const DIMENSIONS = []

// DPI's abbreviations, spelled out for readers.
export const GROUP_LABELS = {
  'Econ Disadv': 'Economically disadvantaged',
  'Not Econ Disadv': 'Not econ. disadvantaged',
  SwD: 'Students with disabilities',
  SwoD: 'Students without disabilities',
  EL: 'English learners',
  'Eng Prof': 'English proficient',
  'Amer Indian': 'American Indian',
  'Pacific Isle': 'Pacific Islander',
  'Two or More': 'Two or more races',
}

export function groupLabel(raw) {
  return GROUP_LABELS[raw] ?? raw
}
