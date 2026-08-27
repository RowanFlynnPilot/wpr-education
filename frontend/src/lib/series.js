// Series assembly shared by the district page and the story-mode embed.
import nationalConfig from '../../../config/national.json'
import { pctChangeSeries, seriesFromDoc } from './chartData'
import { COLORS, groupLabel } from './meta'

// U.S. national comparison, curated in config/national.json for the few
// metrics with genuinely comparable national definitions (see the file's
// _comment for why ACT and absenteeism are deliberately absent). Reshaped
// once into the same doc shape as a district so metricSeries/derived
// views work on it unchanged.
export const NATIONAL_DOC = {
  district: { dpi_code: 'us', dpi_name: 'United States' },
  topics: Object.fromEntries(
    Object.entries(nationalConfig.series).map(([topicId, metrics]) => [
      topicId,
      (() => {
        const byYear = {}
        for (const [metric, def] of Object.entries(metrics)) {
          for (const [year, value] of Object.entries(def.years)) {
            byYear[year] = byYear[year] ?? {}
            byYear[year][metric] = { value, suppressed: false }
          }
        }
        return byYear
      })(),
    ]),
  ),
}

export function metricSeries(doc, topicId, metric, meta) {
  const cells = seriesFromDoc(doc, topicId, meta.derivedFrom ?? metric)
  return meta.derivedFrom ? pctChangeSeries(cells) : cells
}

// Draw order: state first (bottom), then peers, district last (on top).
// Raw statewide counts (~800k students) would flatten every district line
// to zero; the statewide overlay only applies to rates/scores and derived
// indexed views.
// Student-group mode: one line per group of one dimension, this district
// only. Group labels come from DPI verbatim (via the pipeline), sorted
// alphabetically so colors stay stable across metrics and years; series
// for categories DPI added later (Two or More, Pacific Isle) simply start
// when the data does.
export function buildGroupSeriesList({ topic, metric, subDoc, dimension }) {
  const meta = topic.metrics[metric]
  const base = meta.derivedFrom ?? metric
  const years = subDoc.topics[topic.id] ?? {}
  const groups = new Set()
  for (const dims of Object.values(years)) {
    for (const g of Object.keys(dims[dimension] ?? {})) groups.add(g)
  }
  return [...groups].sort().map((g, i) => {
    let cells = {}
    for (const [year, dims] of Object.entries(years)) {
      const metrics = dims[dimension]?.[g]
      if (metrics && base in metrics) cells[year] = metrics[base]
    }
    if (meta.derivedFrom) cells = pctChangeSeries(cells)
    return {
      key: `grp-${i}`,
      label: groupLabel(g),
      color: COLORS.groups[i % COLORS.groups.length],
      dash: undefined,
      width: 2,
      cells,
    }
  })
}

export function buildSeriesList({ topic, metric, doc, stateDoc, peerDocs, peerColorOf }) {
  const meta = topic.metrics[metric]
  // National line only where curated data exists AND the metric isn't a
  // raw count (49M students would flatten any district line).
  const nationCells = meta.kind === 'count' ? {} : metricSeries(NATIONAL_DOC, topic.id, metric, meta)
  const nationSeries = Object.keys(nationCells).length ? [
    {
      key: 'nation',
      label: 'United States',
      color: '#55524A',
      dash: '2 4',
      width: 1.5,
      cells: nationCells,
    },
  ] : []
  // Statewide overlay only where the state doc actually carries the topic
  // — finance and open_enrollment are district-only (no statewide row in
  // their source files), and an empty series would still paint a legend
  // entry and a blank table/CSV column.
  const stateCells = meta.kind === 'count' ? {} : metricSeries(stateDoc, topic.id, metric, meta)
  const stateSeries = Object.keys(stateCells).length ? [
    {
      key: 'state',
      label: 'Wisconsin',
      color: COLORS.state,
      dash: '6 4',
      width: 1.6,
      cells: stateCells,
    },
  ] : []
  return [
    ...nationSeries,
    ...stateSeries,
    ...peerDocs.map((p) => ({
      key: p.doc.district.dpi_code,
      label: p.label,
      color: peerColorOf(p.doc.district.dpi_code),
      dash: undefined,
      width: 1.6,
      cells: metricSeries(p.doc, topic.id, metric, meta),
    })),
    {
      key: 'district',
      label: doc.district.dpi_name,
      color: COLORS.district,
      dash: undefined,
      width: 2.8,
      cells: metricSeries(doc, topic.id, metric, meta),
    },
  ]
}
