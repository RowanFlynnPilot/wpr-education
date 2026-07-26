# wpr-education — Initial Build Session

Read `CLAUDE.md` in full before touching anything. It is authoritative for
architecture, invariants, data model, and design system. This prompt sequences
the work and defines "done."

## Mission

Take this repo from scaffold to a working, published tool in this session:
real DPI data for all five v1 topics, a polished embeddable frontend, and a
green Pages deploy. Work through the phases **in order, without stopping to
ask permission between them.** The only reasons to stop are the escalation
triggers at the bottom. Commit at the end of every phase so the repo is a
clean handoff even if the session ends early.

## Ground rules

- **Never guess what a DPI file contains.** Download it, inspect the real
  headers and sample rows, then write the mapping. Evidence first, code second.
- The CLAUDE.md invariants are not negotiable: suppressed = null, never zero;
  validator strictness stays (fix failures by tightening, never loosening);
  no fallbacks, no partial refresh; the district list stays hand-maintained.
  Leave the four `"included": false` districts excluded — that's an editorial
  decision, not an engineering one.
- Environment: Windows, PowerShell 5.1. Use `python -m pip`, chain commands
  with semicolons, never `&&`.
- Every phase-boundary commit message summarizes the evidence found: file
  URLs, header names, spot-check values.
- Update CLAUDE.md's "Current status & next tasks" as each phase completes —
  it's the handoff document for future sessions.

## Phase 1 — Data recon (CLAUDE.md tasks 1–2)

1. From https://dpi.wi.gov/wisedash/public/download-files, locate the
   statewide download files for: enrollment (certified), attendance /
   chronic absenteeism, dropouts, high school completion / graduation, and
   ACT statewide (grade 11). Record the direct CSV URL for **every available
   year** of each topic in `pipeline/sources.py`, with a comment noting each
   topic's year coverage and any format changes across years.
2. Download the current enrollment file and fill `dpi_code` + `dpi_name`
   (exact strings from the file) for **all twelve** districts in
   `config/districts.json` — including the four excluded candidates, so
   flipping one later is purely a config edit.
3. Note anything weird in `sources.py` comments: renamed columns between
   years, combined vs. split files, changed suppression markers.

## Phase 2 — Normalization (task 3)

- Implement the five `build_<topic>()` functions in `pipeline/normalize.py`
  from the actual headers. Overall (all-students), district-level metrics are
  required; subgroups are a stretch goal, not v1.
- Choose metrics deliberately and document them in CLAUDE.md's Data model
  section. Starting expectation (adjust to what the files actually offer):
  ACT — composite average, per-subject averages, participation; graduation —
  4-year cohort rate; dropouts — rate and count; absenteeism — chronic
  absenteeism rate, attendance rate; enrollment — total, plus grade bands if
  cheap.
- Handle multi-year header drift explicitly: per-year column maps where
  needed, throw on any unmapped year.
- Complete the TODO block in `refresh.py`: district-code cross-check against
  the enrollment frame, per-district doc assembly, `state.json` from
  statewide rows, `index.json` from included districts only.

## Phase 3 — First real refresh (task 4)

- Run `python pipeline/refresh.py` until it completes clean. A new
  suppression marker gets added to `SUPPRESSION_MARKERS` deliberately, with a
  comment citing the file that uses it. A weird value gets investigated, not
  coerced.
- **Spot-check:** compare Wausau and D.C. Everest against the WISEdash portal
  UI for the most recent year of every topic. Record the checked values in
  the commit message.
- Commit `data/`.

## Phase 4 — Frontend (task 5) — the aggressive part

Build a finished product, not a demo. Vite + React in `frontend/`
(`base: '/wpr-education/'`), recharts.

- **Views.** Landing page: district picker for included districts plus
  county-wide headline numbers. District page: per-topic trend charts with a
  statewide overlay and a peer-district multi-select (other included
  districts).
- **Breaks are the signature feature.** Render `config/breaks.json` on every
  applicable chart: `comparability_break` = hard visual discontinuity (dashed
  vertical rule, series visibly separated across it, no line drawn through
  it); `annotation` = marker with detail on hover/tap. Plain-language
  explanations in a methodology section.
- **Suppression renders honestly.** Suppressed cells show "Suppressed for
  student privacy" — never blank, never zero, never an interpolated line.
- **WPR design system.** Teal `#3A867C`, cream `#F6F2E9`, Fraunces (display),
  Public Sans (body), JetBrains Mono (every number, axis label, and data
  table).
- **Mobile-first.** This lives in an iframe inside WordPress articles:
  flawless at 360px, fine at 1200px, no horizontal scroll, touch-friendly
  chart interactions.
- **Methodology footer.** Source (Wisconsin DPI, WISEdash download files),
  refresh date from the `generated` timestamp, suppression explanation,
  breaks explained.
- Dev builds throw loudly on missing data; production assumes `data/` is
  valid because the validator guarantees it. No runtime defensive layers.

## Phase 5 — Publish (task 6)

- GitHub Actions workflow: on push to `main`, build the frontend (with
  `data/` available to it at build time) and deploy to GitHub Pages.
- Push, confirm the workflow is green, confirm the live URL renders.

## Phase 6 — Verification & handoff

All of these, checked for real:

- [ ] `python pipeline/refresh.py` runs clean end-to-end
- [ ] All five topics render for Wausau with statewide overlay
- [ ] ACT chart shows the 2023-24 comparability break and both 2025-26 annotations
- [ ] Find a genuinely suppressed cell in a small district (Athens or Edgar)
      and confirm the suppression state renders
- [ ] 360px viewport clean, no horizontal scroll
- [ ] CLAUDE.md Data model + status sections updated
- [ ] WordPress iframe embed snippet (with recommended height) written into CLAUDE.md

## Stretch goals — in order, only after Phase 6 passes

1. Subgroup views (race/ethnicity, economic status, disability, EL) with
   suppression-aware panels
2. School-level data beneath each district
3. Per-chart CSV download
4. Forward Exam (v1.5) end-to-end, including extending the cut-score break to it

## Escalate — stop and report instead of working around

- DPI files aren't directly downloadable (JS-only portal): report what you
  found and the options. Do not screen-scrape around it.
- A validator failure that looks like a data problem rather than a code
  problem.
- Anything that would require loosening an invariant to proceed.
- GitHub Pages needs a manual settings toggle: finish everything else, then
  say exactly what to click.
