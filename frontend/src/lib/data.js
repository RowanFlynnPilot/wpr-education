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

// index.json (included districts + generated stamp) and state.json — always
// needed, fetched once.
export async function loadCore() {
  const [index, state] = await Promise.all([
    loadJSON('index.json'),
    loadJSON('state.json'),
  ])
  return { index, state }
}

// District docs are fetched per route and cached, so a story-mode embed of
// one chart pulls only the districts it draws instead of all eight. The
// cache holds promises, so concurrent requests for the same code share one
// fetch.
const docCache = new Map()

// Subgroup docs exist only for config districts + statewide, and are
// fetched lazily the first time a student-group view opens.
const subgroupCache = new Map()

export function loadSubgroups(code) {
  if (!subgroupCache.has(code)) {
    subgroupCache.set(code, loadJSON(`subgroups/${code}.json`))
  }
  return subgroupCache.get(code)
}

export async function loadDocs(codes) {
  const unique = [...new Set(codes)]
  for (const code of unique) {
    if (!docCache.has(code)) docCache.set(code, loadJSON(`districts/${code}.json`))
  }
  const out = {}
  for (const code of unique) out[code] = await docCache.get(code)
  return out
}
