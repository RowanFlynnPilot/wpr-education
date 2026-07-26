import { breaksFor } from './meta'

// A "series" is one line on a trend chart: a district doc (or the state
// doc) reduced to {year: cell} for one topic+metric.
export function seriesFromDoc(doc, topicId, metric) {
  const years = doc.topics[topicId] ?? {}
  const out = {}
  for (const [year, metrics] of Object.entries(years)) {
    if (metric in metrics) out[year] = metrics[metric]
  }
  return out
}

// Derived view: percent change vs the series' first non-suppressed year.
// Suppressed cells stay suppressed; the base year itself reads 0%.
export function pctChangeSeries(cells) {
  const years = Object.keys(cells).sort()
  const baseYear = years.find((y) => !cells[y].suppressed)
  if (!baseYear) return { ...cells }
  const base = cells[baseYear].value
  const out = {}
  for (const y of years) {
    out[y] = cells[y].suppressed
      ? cells[y]
      : { value: Math.round((cells[y].value / base - 1) * 1000) / 10, suppressed: false }
  }
  return out
}

// Comparability breaks split every series into visually separate segments:
// the break's school_year is the FIRST year of the new regime. Returns the
// segment index for a year given the sorted break years of the topic.
function segmentIndex(year, breakYears) {
  let seg = 0
  for (const by of breakYears) {
    if (year >= by) seg += 1
  }
  return seg
}

// Build recharts rows plus the list of dataKeys per input series.
//
// seriesList: [{key, cells: {year: cell}}]
// Returns {rows, seriesKeys: {key: [segmented dataKeys]}, years}
// Rows carry `${key}__s${n}` numeric values (null when suppressed/absent)
// and `${key}__sup` booleans so tooltips can say "suppressed" honestly.
// The x-axis year domain is the union of all data years AND every break /
// annotation year for the topic, so annotations for years with no data yet
// (e.g. the 2025-26 Enhanced ACT notes) still render.
export function buildChart(topicId, seriesList) {
  const topicBreaks = breaksFor(topicId)
  const breakYears = topicBreaks
    .filter((b) => b.type === 'comparability_break')
    .map((b) => b.school_year)
    .sort()

  const yearSet = new Set(topicBreaks.map((b) => b.school_year))
  for (const s of seriesList) {
    for (const year of Object.keys(s.cells)) yearSet.add(year)
  }
  const years = [...yearSet].sort()

  const seriesKeys = {}
  for (const s of seriesList) {
    const segs = new Set(
      Object.keys(s.cells).map((y) => segmentIndex(y, breakYears)),
    )
    seriesKeys[s.key] = [...segs].sort().map((n) => `${s.key}__s${n}`)
  }

  const rows = years.map((year) => {
    const row = { year }
    for (const s of seriesList) {
      const cell = s.cells[year]
      if (cell) {
        row[`${s.key}__s${segmentIndex(year, breakYears)}`] = cell.value
        row[`${s.key}__sup`] = cell.suppressed
      }
    }
    return row
  })

  return { rows, seriesKeys, years, topicBreaks }
}

// Years where the given district's cells are suppressed, for the
// plain-language note under the chart.
export function suppressedYears(cells) {
  return Object.entries(cells)
    .filter(([, cell]) => cell.suppressed)
    .map(([year]) => year)
    .sort()
}
