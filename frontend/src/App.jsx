import { useEffect, useRef, useState } from 'react'
import DistrictPage from './components/DistrictPage'
import Landing from './components/Landing'
import MethodologyFooter from './components/MethodologyFooter'
import { loadAll } from './lib/data'

// Routes look like #/6223?peers=4970,0196 — path picks the district,
// peers preselects comparison lines so charts are shareable.
function parseHash() {
  const [path, query] = window.location.hash.replace(/^#\/?/, '').split('?')
  const peers = (new URLSearchParams(query || '').get('peers') || '')
    .split(',')
    .filter(Boolean)
  return { path, peers }
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

export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const route = useHashRoute()
  useHeightReporter()

  useEffect(() => {
    loadAll().then(setData, setError)
  }, [])

  const entry = data?.index.districts.find((d) => d.dpi_code === route.path)
  useEffect(() => {
    document.title = entry
      ? `${entry.label} — Marathon County School Data`
      : 'Marathon County School Data — Wausau Pilot & Review'
  }, [entry])

  if (error) throw error
  if (!data) {
    return <div className="loading">Loading district data…</div>
  }

  const { index, state, docs } = data
  const validPeers = route.peers.filter((p) => p !== route.path && docs[p])

  return (
    <div className="app">
      <header className="masthead">
        <div className="masthead-kicker">Wausau Pilot &amp; Review</div>
        <h1>Marathon County School Data</h1>
      </header>
      <main>
        {entry && docs[route.path] ? (
          <DistrictPage
            code={route.path}
            peers={validPeers}
            index={index}
            state={state}
            docs={docs}
          />
        ) : (
          <Landing index={index} state={state} docs={docs} />
        )}
      </main>
      <MethodologyFooter generated={index.generated} />
    </div>
  )
}
