import { useEffect, useState } from 'react'
import DistrictPage from './components/DistrictPage'
import Landing from './components/Landing'
import MethodologyFooter from './components/MethodologyFooter'
import { loadAll } from './lib/data'

function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const onChange = () => {
      setHash(window.location.hash)
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return hash.replace(/^#\/?/, '')
}

export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const route = useHashRoute()

  useEffect(() => {
    loadAll().then(setData, setError)
  }, [])

  if (error) throw error
  if (!data) {
    return <div className="loading">Loading district data…</div>
  }

  const { index, state, docs } = data
  const isDistrict = route && docs[route]

  return (
    <div className="app">
      <header className="masthead">
        <div className="masthead-kicker">Wausau Pilot &amp; Review</div>
        <h1>Marathon County School Data</h1>
      </header>
      <main>
        {isDistrict ? (
          <DistrictPage code={route} index={index} state={state} docs={docs} />
        ) : (
          <Landing index={index} state={state} docs={docs} />
        )}
      </main>
      <MethodologyFooter generated={index.generated} />
    </div>
  )
}
