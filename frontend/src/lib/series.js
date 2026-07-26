// Series assembly shared by the district page and the story-mode embed.
import { pctChangeSeries, seriesFromDoc } from './chartData'
import { COLORS } from './meta'

export function metricSeries(doc, topicId, metric, meta) {
  const cells = seriesFromDoc(doc, topicId, meta.derivedFrom ?? metric)
  return meta.derivedFrom ? pctChangeSeries(cells) : cells
}

// Draw order: state first (bottom), then peers, district last (on top).
// Raw statewide counts (~800k students) would flatten every district line
// to zero; the statewide overlay only applies to rates/scores and derived
// indexed views.
export function buildSeriesList({ topic, metric, doc, stateDoc, peerDocs, peerColorOf }) {
  const meta = topic.metrics[metric]
  const stateSeries = meta.kind === 'count' ? [] : [
    {
      key: 'state',
      label: 'Wisconsin',
      color: COLORS.state,
      dash: '6 4',
      width: 1.6,
      cells: metricSeries(stateDoc, topic.id, metric, meta),
    },
  ]
  return [
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
