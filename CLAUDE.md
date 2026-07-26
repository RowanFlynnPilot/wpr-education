# wpr-education

Wisconsin education data tracker for Wausau Pilot & Review (WPR).
**Marathon County-first, statewide-ready:** the pipeline ingests statewide DPI
files; the frontend presents only the districts listed in `config/districts.json`.
Expanding coverage later is a config change, never a pipeline change.

## What this is

Public-facing tracker of ACT results, graduation/high-school completion,
dropouts, chronic absenteeism, and enrollment for Marathon County school
districts, with statewide and peer-district comparison, embedded on
wausaupilotandreview.com via iframe.

This is also the third reference implementation for the OEC Ledger Framework —
the **bulk-file ingestion variant** (vs. the scraper variant proven by the Care
Ledger). Keep the pipeline pattern clean and generic where it costs nothing.

## Architecture (standard WPR pipeline, bulk-file variant)

```
DPI WISEdash statewide CSVs (manual download URLs in pipeline/sources.py)
  -> pipeline/  (Python: download -> validate -> normalize)
  -> data/      (static JSON, committed to the repo)
  -> frontend/  (React + Vite, reads data/ at build time)
  -> GitHub Pages
  -> WordPress iframe embed
```

No scraping. No scheduled Actions. Refresh is a **manual run, twice a year**:

- **Fall:** assessments (ACT; Forward in v1.5)
- **Spring:** enrollment, attendance/absenteeism, graduation/completion, dropouts

Every refresh **re-pulls ALL years for ALL topics.** DPI publishes errata after
initial publication; appending new years while keeping old files would silently
preserve corrected errors. There is no incremental mode.

## Non-negotiables

1. **Suppressed cells are nulls, never zeros.** DPI redacts small cells
   (marker: `*`). Normalize to `{"value": null, "suppressed": true}`. The
   validator throws on any cell it cannot classify as a number or a known
   suppression marker. The frontend renders suppressed cells as "suppressed
   for student privacy," never as an empty chart or a zero.
2. **Methodology breaks are first-class data.** `config/breaks.json` lists
   every comparability break and annotation. Every trend chart renders the
   breaks that apply to its topic. This is the product's credibility edge —
   most outlets draw a line straight through 2023-24 as if nothing changed.
3. **The district list is editorial and hand-maintained.** Never derive
   presented districts from a DPI county field. Inclusion of cross-county
   districts (Abbotsford, Colby, Auburndale, Wittenberg-Birnamwood) is a
   newsroom decision recorded in config.
4. **Statewide ingest, county presentation.** `data/` contains every Wisconsin
   district plus statewide totals. Only `config/districts.json` decides what
   gets a page. State averages and peer comparisons come free as a result.
5. **Fail fast.** Unknown column, unresolvable district code, empty source
   registry, cell that isn't a number or a suppression marker: throw with a
   specific message. No fallbacks, no defaults, no partial refresh.

## Data model

Pipeline output, all committed:

- `data/index.json` — presented districts (from config) + statewide entry;
  the frontend's routing source.
- `data/districts/{dpi_code}.json` — one file per district (ALL Wisconsin
  districts, not just presented ones), all topics, all years.
- `data/state.json` — statewide totals, same shape as a district file.

Every metric cell is `{"value": <number|null>, "suppressed": <bool>}`, with
`value == null` iff `suppressed == true` (enforced by the validator, described
in `schemas/district.schema.json`).

## Refresh workflow

```powershell
python -m pip install -r pipeline/requirements.txt
python pipeline/refresh.py
```

`refresh.py` downloads every URL in `pipeline/sources.py`, validates, rebuilds
`data/` from scratch, and validates output against `schemas/`. Commit the
resulting `data/` diff — the diff itself is the editorial review surface
(unexpected changes to prior years = errata worth a story).

Before each refresh, check DPI's master errata page and the per-topic "About
the Data" pages for definition changes; record any new break in
`config/breaks.json`.

## v1 scope

Five topics: `act`, `graduation`, `dropouts`, `absenteeism`, `enrollment`.

- v1.5: Forward Exam (grades 3-8) — pulls in the elementary-parent audience.
- Later: discipline, truancy, postsecondary enrollment, AP.

## Frontend

React + Vite in `frontend/`, deployed to GitHub Pages, embedded via iframe.

- WPR design system: teal `#3A867C`, cream `#F6F2E9`, Fraunces (display),
  Public Sans (body), JetBrains Mono (data).
- Core view: district page with per-topic trend charts — selected district vs.
  statewide vs. selectable county peers.
- Break annotations from `config/breaks.json` rendered on every applicable
  chart (vertical rule + short label; detail on hover/tap).
- Subgroup views (race/ethnicity, economic status, disability, EL) where data
  survives suppression; suppressed panels say so explicitly. Expect heavy
  suppression in the small districts (Athens, Edgar, Marathon City).

## Environment

Windows, PowerShell 5.1. Use `python -m pip`, chain commands with semicolons.
Repo lives at `C:\Users\rpfly\Projects\wpr-education`.

## Current status & next tasks

Scaffold only — no data has been pulled yet. In order:

1. **Populate DPI district codes.** Download the current enrollment statewide
   file from https://dpi.wi.gov/wisedash/public/download-files, then fill
   `dpi_code` and `dpi_name` (exact string from the file) for every district
   in `config/districts.json`. The validator refuses to run while any
   *included* district has a null code.
2. **Populate `pipeline/sources.py`** with direct CSV URLs for the five v1
   topics, all available years (2005-06 forward where offered; note per-topic
   availability in the registry comments as you go).
3. **Implement per-topic normalization** in `pipeline/normalize.py` from the
   actual column headers of the downloaded files. Do not guess columns —
   download first, map second. Record each topic's chosen metrics in this
   file's Data model section when done.
4. Run the first full refresh; commit `data/`.
5. Scaffold the frontend (`npm create vite@latest frontend -- --template react`)
   and build the district page per the Frontend section.
6. Add the GitHub Pages deploy workflow once `frontend/` builds.
7. Editorial decision with Shereen: which cross-county districts flip to
   `"included": true` in `config/districts.json`.
