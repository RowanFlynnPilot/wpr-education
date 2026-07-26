# wpr-education

**Live: https://rowanflynnpilot.github.io/wpr-education/**

Wisconsin education data tracker for [Wausau Pilot & Review](https://wausaupilotandreview.com)
— ACT results, graduation, dropouts, chronic absenteeism, and enrollment for
Marathon County school districts, with statewide and peer-district
comparison. Every number comes from Wisconsin DPI's certified
[WISEdash download files](https://dpi.wi.gov/wisedash/public/download-files).

## How it works

```
DPI WISEdash statewide CSVs (88 files, 2005-06 → 2025-26)
  -> pipeline/  (Python: download -> validate -> normalize)
  -> data/      (static JSON, committed — the diff is the editorial review)
  -> frontend/  (React + Vite, charts with recharts)
  -> GitHub Pages, embedded on wausaupilotandreview.com via iframe
```

The pipeline ingests **every** Wisconsin district; `config/districts.json`
(hand-maintained, an editorial decision) decides which districts get a page.
Statewide averages and peer comparison come free as a result.

## What makes it trustworthy

- **Suppressed values stay suppressed.** DPI redacts small student groups
  for privacy (`*` in the files). Those cells become
  `{"value": null, "suppressed": true}` — rendered as "suppressed for
  student privacy," never as a zero or a gap-filled line. The validator
  rejects any cell it can't classify.
- **Methodology breaks are first-class.** `config/breaks.json` records every
  moment DPI changed a definition, cut score, or vendor. Comparability
  breaks draw a hard visual discontinuity on every affected chart — no
  trend line is ever drawn across one.
- **Full re-pull, twice a year.** DPI publishes errata after initial
  publication, so every refresh re-downloads all years of all topics. An
  unexpected diff in a prior year is a correction worth knowing about.

## Refresh

```powershell
python -m pip install -r pipeline/requirements.txt
python pipeline/refresh.py
```

Fall: assessments. Spring: enrollment, attendance, graduation, dropouts.
Check DPI's errata and "About the Data" pages first; record new breaks in
`config/breaks.json`. Commit the `data/` diff. Pushing to `main` rebuilds
and redeploys the site automatically.

See `CLAUDE.md` for the full architecture, invariants, data model, and
embed instructions.
