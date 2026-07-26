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

Metrics per topic (chosen from the real files; see `pipeline/normalize.py`
for exact derivations and `pipeline/sources.py` for source-file recon notes):

- `act` (2014-15+, grade-11 census ACT, `TEST_GROUP == "ACT"` only):
  `composite_avg`, `english_avg`, `math_avg`, `reading_avg`, `science_avg`
  (per-subject `AVERAGE_SCORE`), `tested_count`, `participation_pct`
  (from Composite `GROUP_COUNT` minus its "No Test" row).
- `graduation` (2009-10+, 4-year cohort, regular diploma — status matched on
  the `"Completed - Regular"` prefix because the label drifts across years):
  `grad_rate_4yr` (computed grad/cohort), `grad_count_4yr`, `cohort_count_4yr`.
- `dropouts` (2005-06+, grades 7-12): `dropout_rate`, `dropout_count`.
- `absenteeism` (2005-06+): `chronic_absenteeism_rate` (ESSA/STATE
  `ABSENCE_RATE`), `attendance_rate` (from the attendance CSV inside the
  attendance_dropouts ZIP; `--` there means 0 possible days → metric omitted,
  not suppressed).
- `enrollment` (2005-06+, certified 3rd-Friday-of-September headcount):
  `total_enrollment`.

Statewide rows ride through the pipeline as DPI code `0000` and land in
`data/state.json`.

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

## Embedding in WordPress

Live URL: https://rowanflynnpilot.github.io/wpr-education/

The app posts its content height to the parent page
(`{type: "wpr-education:height", height}`), so the recommended embed
auto-sizes — no double scrollbar:

```html
<iframe id="wpr-education-embed"
  src="https://rowanflynnpilot.github.io/wpr-education/"
  title="Marathon County School Data — Wausau Pilot & Review"
  style="width:100%; height:1400px; border:0;"
  loading="lazy"></iframe>
<script>
  window.addEventListener('message', function (e) {
    if (e.origin !== 'https://rowanflynnpilot.github.io') return;
    if (e.data && e.data.type === 'wpr-education:height') {
      document.getElementById('wpr-education-embed').style.height =
        e.data.height + 'px';
    }
  });
</script>
```

If the script can't be used (some WordPress configs strip it), the static
fallback heights are 1400px for the landing page and 2400px for district
pages. Deep-link a district with `#/{dpi_code}` (codes in
`data/index.json`); preselect comparison districts with
`#/{dpi_code}?peers={code},{code}` — e.g. `#/6223?peers=4970` embeds
Wausau vs. D.C. Everest.

## Current status & next tasks

**v1 SHIPPED (2026-07-25).** Pipeline pulls all 88 statewide files (5 topics,
2005-06 → 2025-26 where offered), 507 district files + state.json validate
clean, and the frontend is live on GitHub Pages (deploy workflow green on
push to main). Wausau + D.C. Everest spot-checked against the WISEdash portal
UI for every topic, most recent year — all values match at portal precision
(see the Phase 3 commit message for the full table).

Known state of the data:

- No suppressed cells exist among the 8 included districts at the
  all-students level (371 exist statewide; suppression rendering verified
  against Washington Island 6069). Expect real suppression when subgroup
  views ship.
- 2025-26 ACT lands ~fall 2026: add it to `sources.py`, run the refresh, and
  the two 2025-26 breaks already in `config/breaks.json` will annotate it.

Next tasks, in order:

1. Editorial decision with Shereen: which cross-county districts flip to
   `"included": true` in `config/districts.json` (codes/names already filled
   for all four candidates; flipping is purely a config edit + refresh… no
   pipeline change).
2. Fall 2026 refresh (assessments): 2025-26 act_statewide file, plus check
   DPI errata for the spring-2026 ACT scoring-error revisions.
3. Stretch (in order): subgroup views with suppression-aware panels;
   school-level data; per-chart CSV download; Forward Exam v1.5 (extend the
   2023-24 cut-score break's `topics` to include `forward`).
