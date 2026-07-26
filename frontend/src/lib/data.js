// Runtime loading of the pipeline's committed output. The validator in
// pipeline/validate.py guarantees the shape of everything fetched here, so
// there are no defensive fallbacks: a missing or malformed file throws.

const BASE = import.meta.env.BASE_URL

async function loadJSON(path) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    throw new Error(`Failed to load ${path}: HTTP ${res.status}`)
  }
  return res.json()
}

// index.json (included districts + generated stamp), state.json, and one
// doc per included district, loaded up front — nine small fetches.
export async function loadAll() {
  const index = await loadJSON('index.json')
  const [state, ...districts] = await Promise.all([
    loadJSON('state.json'),
    ...index.districts.map((d) => loadJSON(`districts/${d.dpi_code}.json`)),
  ])
  const docs = {}
  index.districts.forEach((d, i) => {
    docs[d.dpi_code] = districts[i]
  })
  return { index, state, docs }
}
