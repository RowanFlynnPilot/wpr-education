import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import Landing from './components/Landing'
import MethodologyFooter from './components/MethodologyFooter'
import { loadCore, loadDocs } from './lib/data'

// The chart-bearing pages pull in recharts (~2/3 of the bundle); loading
// them lazily keeps the landing page on the small chunk.
const DistrictPage = lazy(() => import('./components/DistrictPage'))
const EmbedPage = lazy(() => import('./components/EmbedPage'))

// Routes:
//   #/6223?peers=4970,0196          district page, peers preselected
//   #/embed/6223/act?metric=...     story mode: one chart, minimal chrome
function parseHash() {
  const [path, query] = window.location.hash.replace(/^#\/?/, '').split('?')
  const params = new URLSearchParams(query || '')
  const peers = (params.get('peers') || '').split(',').filter(Boolean)
  return { path, peers, metric: params.get('metric') || '' }
}

function useHashRoute() {
  const [route, setRoute] = useState(parseHash)
  const prevPath = useRef(route.path)
  useEffect(() => {
    const onChange = () => {
      const next = parseHash()
      // Jump to top on real navigation; stay put when only the peer
      // selection (query part) changed.
      if (next.path !== prevPath.current) window.scrollTo(0, 0)
      prevPath.current = next.path
      setRoute(next)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

// Inside the WordPress iframe, report content height to the parent page so
// the embed can size itself instead of double-scrolling.
function useHeightReporter() {
  useEffect(() => {
    if (window.parent === window) return
    const post = () =>
      window.parent.postMessage(
        { type: 'wpr-education:height', height: document.documentElement.scrollHeight },
        '*',
      )
    const ro = new ResizeObserver(post)
    ro.observe(document.documentElement)
    post()
    return () => ro.disconnect()
  }, [])
}

const Loading = () => <div className="loading">Loading district data…</div>

function ErrorPanel({ error }) {
  console.error(error)
  return (
    <div className="error-panel" role="alert">
      <h2>Couldn't load the data</h2>
      <p>
        Something interrupted the connection while fetching district data
        ({error.message}). This is usually temporary.
      </p>
      <button className="pill" onClick={() => window.location.reload()}>
        Try again
      </button>
    </div>
  )
}

export default function App() {
  const [core, setCore] = useState(null)
  const [docs, setDocs] = useState({})
  const [error, setError] = useState(null)
  const route = useHashRoute()
  useHeightReporter()

  useEffect(() => {
    loadCore().then(setCore, setError)
  }, [])

  const segments = route.path.split('/')
  const isEmbed = segments[0] === 'embed'
  const districtCode = isEmbed ? segments[1] : route.path
  const entry = core?.index.districts.find((d) => d.dpi_code === districtCode)

  // Which docs this route draws: the district + its peers. The landing
  // renders from index.json summaries alone — no district fetches.
  const included = core?.index.districts.map((d) => d.dpi_code) ?? []
  const needed = entry
    ? [districtCode, ...route.peers.filter((p) => p !== districtCode && included.includes(p))]
    : []
  const neededKey = needed.join(',')

  useEffect(() => {
    if (!core) return
    loadDocs(needed).then((loaded) => setDocs((prev) => ({ ...prev, ...loaded })), setError)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [core, neededKey])

  useEffect(() => {
    document.title = entry
      ? `${entry.label} — Central Wisconsin School Data`
      : 'Central Wisconsin School Data — Wausau Pilot & Review'
  }, [entry])

  if (error) return <div className="app"><ErrorPanel error={error} /></div>
  const ready = core && needed.every((code) => docs[code])
  if (!ready) return <Loading />

  const { index, state } = core
  const validPeers = route.peers.filter((p) => p !== districtCode && docs[p])

  if (isEmbed && entry) {
    return (
      <div className="app app-embed">
        <Suspense fallback={<Loading />}>
          <EmbedPage
            code={districtCode}
            topicId={segments[2]}
            metric={route.metric}
            peers={validPeers}
            index={index}
            state={state}
            docs={docs}
          />
        </Suspense>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="masthead">
        <div className="masthead-kicker">Wausau Pilot &amp; Review</div>
        <h1>Central Wisconsin School Data</h1>
      </header>
      <main>
        {entry && !isEmbed ? (
          <Suspense fallback={<Loading />}>
            <DistrictPage
              code={route.path}
              peers={validPeers}
              index={index}
              state={state}
              docs={docs}
            />
          </Suspense>
        ) : (
          <Landing index={index} state={state} />
        )}
      </main>
      <MethodologyFooter generated={index.generated} />
    </div>
  )
}
