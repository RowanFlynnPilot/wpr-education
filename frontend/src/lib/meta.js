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
    id: 'graduation',
    label: 'Graduation',
    sublabel: '4-year cohort, regular diploma',
    defaultMetric: 'grad_rate_4yr',
    metrics: {
      grad_rate_4yr: { label: 'Graduation rate', kind: 'percent' },
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
}
