// Expanded view of a landing-page KPI card: the underlying trend, full
// size. Loaded lazily (with TrendChart it pulls the recharts chunk) so
// the landing bundle stays small until a card is actually opened.
import ChartLegend from './ChartLegend'
import ChartModal from './ChartModal'
import TrendChart from './TrendChart'

export default function KpiModal({ title, subtitle, topicId, kind, seriesList, onClose }) {
  return (
    <ChartModal title={title} subtitle={subtitle} onClose={onClose}>
      <TrendChart
        topicId={topicId}
        kind={kind}
        seriesList={seriesList}
        size="large"
        ariaLabel={`${title} — trend, expanded`}
      />
      <ChartLegend series={[...seriesList].reverse()} />
      <p className="chart-modal-source">Source: Wisconsin DPI, WISEdash certified download files.</p>
    </ChartModal>
  )
}
