# wpr-education

Wisconsin education data tracker for Wausau Pilot & Review (WPR).
**Region-first, statewide-ready:** the pipeline ingests statewide DPI files;
the frontend presents only the districts listed in `config/districts.json` —
currently 47 districts across Marathon County and its eight neighbors
(Clark, Langlade, Lincoln, Portage, Shawano, Taylor, Waupaca, Wood; regional
expansion approved 2026-07-26). Expanding coverage further is a config
change, never a pipeline change.

## What this is

Public-facing tracker of ACT results, graduation/high-school completion,
dropouts, chronic absenteeism, and enrollment for central Wisconsin school
districts (branded "Central Wisconsin School Data"), with statewide,
national and peer-district comparison, embedded on wausaupilotandreview.com
via iframe.

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

- `data/index.json` — presented districts (from config, with `county` and
  a landing summary: enrollment trend + latest headline metrics per
  district, so the landing page renders without fetching district files);
  the frontend's routing source.
- `data/districts/{dpi_code}.json` — one file per district (ALL Wisconsin
  districts, not just presented ones), all topics, all years.
- `data/state.json` — statewide totals, same shape as a district file.
- `data/schools/{dpi_code}.json` — per-school breakdowns for config
  districts only (schema: `schemas/school.schema.json`): `schools ->
  school_code -> {name, type, topics}` where `type` is DPI's GRADE_GROUP
  school-type label. School rows carry their type in GRADE_GROUP instead
  of `[All]`, so school selection filters on SCHOOL_NAME not starting
  with `[`. Closed schools stay in the file with their historical years —
  the frontend dims them. No statewide school file (that would be every
  school in Wisconsin).

Every metric cell is `{"value": <number|null>, "suppressed": <bool>}`, with
`value == null` iff `suppressed == true` (enforced by the validator, described
in `schemas/district.schema.json`).

Metrics per topic (chosen from the real files; see `pipeline/normalize.py`
for exact derivations and `pipeline/sources.py` for source-file recon notes):

- `act` (2014-15+, grade-11 census ACT, `TEST_GROUP == "ACT"` only):
  `composite_avg`, `english_avg`, `math_avg`, `reading_avg`, `science_avg`
  (per-subject `AVERAGE_SCORE`), `tested_count`, `participation_pct`
  (from Composite `GROUP_COUNT` minus its "No Test" row).
- `preact` (2022-23+, grades 9-10 PreACT Secure, `TEST_GROUP == "PreACT"`):
  `composite_avg_gr9`, `composite_avg_gr10`.
- `ap` (2006-07+, Advanced Placement, `AP_EXAM == "[All]"` rollup only —
  per-exam detail deliberately not ingested): `students_tested`,
  `exam_count`, `pct_3_or_above`.
- `graduation` (2009-10+, cohort completion, regular diploma — status
  matched on the `"Completed - Regular"` prefix because the label drifts
  across years): `grad_rate_4yr` (computed grad/cohort), `grad_count_4yr`,
  `cohort_count_4yr`; plus `grad_rate_5yr`/`grad_rate_6yr` where the
  TIMEFRAME rows exist (a file year's 5-year rate belongs to the cohort
  that was five years out as of that year — DPI's own presentation).
- `dropouts` (2005-06+, grades 7-12): `dropout_rate`, `dropout_count`.
- `absenteeism` (2005-06+): `chronic_absenteeism_rate` (ESSA/STATE
  `ABSENCE_RATE`), `attendance_rate` (from the attendance CSV inside the
  attendance_dropouts ZIP; `--` there means 0 possible days → metric omitted,
  not suppressed).
- `enrollment` (2005-06+, certified 3rd-Friday-of-September headcount):
  `total_enrollment`.
- `forward` (2015-16+ EXCEPT 2019-20 — no COVID-year administration;
  grades 3-8 Forward Exam, `TEST_GROUP == "Forward"`, grades 3-8 only for
  a stable definition): `ela_prof_pct`, `math_prof_pct`,
  `science_prof_pct`, `socstudies_prof_pct` — percent in the top two
  performance categories (Proficient/Advanced through 2022-23,
  Meeting/Advanced from 2023-24 — a HARD comparability break,
  `cutscores-2023-24-forward`, separate from the ACT annotation entry so
  the ACT line stays connected). The files have per-grade rows only; the
  combined rate is summed from per-grade counts against DPI's own
  GROUP_COUNT denominators, and suppresses whenever any contributing
  count is redacted. Forward ZIPs 2020-21+ split one member across two
  CSVs — refresh.py concatenates same-member CSVs after a column check.
- `open_enrollment` (2016-17+, NOT a WISEdash file — the Open Enrollment
  program office's July-final "pupil transfers and aid adjustments" xlsx,
  registered in `sources.XLSX_FILES` and parsed by
  `normalize.build_open_enrollment`): `pupils_in`, `pupils_out`,
  `net_pupils`, `aid_in`, `aid_out`, `net_aid` (whole dollars, never
  redacted). Counts are FTE-based aid membership, not September
  headcounts. Counts under 20 are redacted from 2019-20 on
  (`oe-redaction-2019-20` annotation); cells are used verbatim — DPI
  sometimes redacts NET while a component is visible, and computing the
  net would un-redact it. District-level only: no statewide row, no
  subgroup or school breakdowns.
- `finance` (SFS longitudinal workbooks, `sources.FINANCE_FILES`, parsed
  by `normalize.build_finance`; never redacted): `cost_per_member`
  (2008-09+; audited cost categories summed / resident membership —
  category composition drifts at DPI's 2023 recalculation, annotated as
  `compcost-recalc-2023-24`; the workbook carries one year beyond DPI's
  published audited range, capped via the served filename's `to_NNNN`
  token) and `revenue_limit_per_member` (1993-94+; statutory cap, set in
  advance so it runs a year ahead). District-level only. Finance
  workbooks key districts by UNPADDED numeric code (zero-filled in the
  builder), have junk header/filler rows, stray whitespace cells, and
  cached `#DIV/0!` formula errors for zero-membership years — all
  handled explicitly.

**Referenda** (`data/referenda/{dpi_code}.json`, schema
`schemas/referenda.schema.json`) — an event list, not metric cells:
every school-funding ballot question since 1990 from WiSFPR
(`sources.REFERENDA_ENDPOINT`, a JSON-over-POST app endpoint — always
send the explicit date range or it silently returns only the current
year). Config districts only. Upcoming votes ride along with status
"Before the Vote Date". Rendered as a table on the district page
(`ReferendaSection`), newest first, with pass rate in the header.

Statewide rows ride through the pipeline as DPI code `0000` and land in
`data/state.json`.

**Subgroups.** `data/subgroups/{dpi_code}.json` (schema:
`schemas/subgroup.schema.json`) carries the same metrics broken out by
student group: `topics -> topic -> year -> dimension -> group -> metric ->
cell`. Dimensions: `race_ethnicity`, `econ_status`, `disability`
(SwD/SwoD — the by-condition "Disability" GROUP_BY is deliberately not
ingested), `el_status` ("ELL Status"/"ELL/LEP" harmonized to "EL" across
DPI's rename). Group labels are otherwise DPI's verbatim
(`GROUP_BY_VALUE`); `[Data Suppressed]` bucket rows are skipped. Subgroup
files exist only for the config districts + statewide (48 files; all 507
would grow the repo substantially for districts nobody can route to);
adding a district still needs no pipeline change. ACT participation
for a group is suppressed when every Composite result row is redacted —
a missing "No Test" row only means zero non-testers when results are
actually enumerated.

## Refresh workflow

```powershell
python -m pip install -r pipeline/requirements.txt
python pipeline/refresh.py
```

`refresh.py` downloads every URL in `pipeline/sources.py`, validates, rebuilds
`data/` from scratch, and validates output against `schemas/`. Commit the
resulting `data/` diff — the diff itself is the editorial review surface
(unexpected changes to prior years = errata worth a story).

Dev only: `python pipeline/refresh.py --reuse-raw` rebuilds from the previous
run's `pipeline/raw/` cache without downloading — for iterating on
`normalize.py`. Never use it for a real refresh (it can ship stale data; the
flag prints a warning for exactly that reason).

Before each refresh, check DPI's master errata page and the per-topic "About
the Data" pages for definition changes; record any new break in
`config/breaks.json`. Also check whether NCES has published new actual years
for the two national series in `config/national.json` (4-year ACGR, table
219.46; fall enrollment actuals, table 203.10 — never include its projected
years) and extend that file by hand, keeping the per-series citations.

## Scope

Ten topics: `act`, `forward`, `preact`, `ap`, `graduation`, `dropouts`,
`absenteeism`, `enrollment`, `open_enrollment`, `finance` — plus the
referenda event tables (AP + PreACT added 2026-07-26; Forward, open
enrollment, finance, referenda + school-level data added 2026-08-22).

- Parked: postsecondary enrollment (20 years of files exist, but the
  file has no rate/denominator — GROUP_COUNT is the count of ENROLLED
  graduates, verified 2026-07-26 — so the rate needs a careful join
  against hs_completion completer counts; treat as its own project).
- Not worth it / stale: habitual_truancy downloads end at 2016-17;
  retention rates are ~0.2% everywhere; postgrad_plans is self-reported
  intent; act_graduates is a different population than the census ACT.
- Later: discipline (3 file families).

## Frontend

React + Vite in `frontend/`, deployed to GitHub Pages, embedded via iframe.

- WPR design system: teal `#3A867C`, cream `#F6F2E9`, Fraunces (display),
  Public Sans (body), JetBrains Mono (data).
- Core view: district page with per-topic trend charts — selected district vs.
  statewide vs. selectable county peers.
- School pages (`#/{dpi_code}/school/{school_code}`): same topic sections
  with the school primary and the district as the one comparison line;
  reached from a "Drill into a school" nav on the district page (closed
  schools dimmed, kept for history). TopicSection is shared between the
  two pages; subgroup pills stay district-only.
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
  title="Central Wisconsin School Data — Wausau Pilot & Review"
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
Wausau vs. D.C. Everest. The landing page shows one county at a time
(dropdown; Marathon default) — deep-link a county with
`#/?county={County}`, or `#/?county=all` for the full 47-district
roster.

**Story mode** — a single chart with minimal chrome, for dropping one
chart into an article next to the paragraph it illustrates:

```
#/embed/{dpi_code}/{topic}?metric={metric}&peers={codes}
```

e.g. `#/embed/6223/act` (Wausau ACT composite),
`#/embed/6223/enrollment?metric=enrollment_change&peers=4970` (Wausau vs
DCE enrollment change). Topic ids: act, forward, preact, ap, graduation,
dropouts, absenteeism, enrollment, open_enrollment, finance; metric ids
are in `frontend/src/lib/meta.js` (omit `metric` for the topic's
default). Story embeds auto-size via the
same height postMessage; static fallback ~750px. They render the chart
with full year labels and per-point values, plus break notes and a
source line linking back to the full tool.

A share-card image for social previews lives at `/og-image.png`
(1200x630, generated with PIL — regenerate via the script in the Phase 9
commit message if the branding changes).

## Current status & next tasks

**v1 SHIPPED (2026-07-25).** Pipeline pulls all 88 statewide files (5 topics,
2005-06 → 2025-26 where offered), 507 district files + state.json validate
clean, and the frontend is live on GitHub Pages (deploy workflow green on
push to main). Wausau + D.C. Everest spot-checked against the WISEdash portal
UI for every topic, most recent year — all values match at portal precision
(see the Phase 3 commit message for the full table).

**REGIONAL EXPANSION SHIPPED (2026-07-26).** Coverage grew from 8 Marathon
County districts to 47 districts across 9 counties (approved by Rowan;
roster drafted from the enrollment file's COUNTY column, then adopted as
the editorial list). Branding is now "Central Wisconsin School Data";
landing page focuses one county at a time via a dropdown (Marathon
default; selection lives in the hash as `?county=`, so it survives
back-navigation and deep-links; `all` shows every county) and renders
from index.json summaries alone; peer picker shows same-county districts inline
with the rest of the region behind a disclosure. Logos/accents exist for
46 of 47 districts (collected 2026-07-26 from official district sites;
Elcho and Nekoosa from their official athletics sites because the district
sites only offer white-knockout marks). The one exception is White Lake
(6440): Google Sites, no downloadable logo asset — it degrades gracefully
(no logo chip, teal accent). Adding a logo is file-only: drop
`{dpi_code}.png/.svg/.jpg` into `frontend/src/assets/logos/` (LOGOS is
glob-derived) and add an ACCENTS entry in `frontend/src/lib/logos.js`.

**DATA EXPANSION SHIPPED (2026-08-22).** Forward Exam (grades 3-8,
2015-16+ minus the 2019-20 COVID gap, hard cut-score break at 2023-24),
school-level pages beneath every config district (47 school files,
closed schools kept as dimmed history), open enrollment (2016-17+, the
first non-WISEdash xlsx source — `sources.XLSX_FILES`), district
finance (cost per member 2008-09+, revenue limits 1993-94+), and
referenda tables (1990+, incl. upcoming votes). The refresh pipeline
now loads frames lazily per topic and prunes the forward files at read
time (`normalize.LOAD_PRUNES`) because the full corpus no longer fits
in memory at once.

Known state of the data:

- Small new districts (White Lake, Tigerton, Bowler, Gresham…) carry real
  all-students suppression in some years — the UI's suppression handling
  now shows up outside subgroup views too. Subgroup views ("Break out by"
  pills) carry heavy suppression everywhere small; Athens' ACT race view
  is the reference case.
- School-level views suppress heavily below district level; open
  enrollment counts under 20 suppress from 2019-20 on (aid dollars never
  do).
- 2025-26 ACT lands ~fall 2026: add it to `sources.py`, run the refresh, and
  the two 2025-26 breaks already in `config/breaks.json` will annotate it.
  2025-26 Forward lands ~fall 2026 the same way.

Next tasks, in order:

1. Newsroom review of the expanded roster with Shereen (any districts to
   drop or relabel — the config is the editorial surface; also whether
   "Central Wisconsin School Data" is the right name).
2. Fall 2026 refresh (assessments): 2025-26 act_statewide + forward
   files, plus check DPI errata for the spring-2026 ACT scoring-error
   revisions. Finance/referenda refresh alongside (the WiSFPR endpoint
   and media-ID URLs are re-pulled every run like everything else).
