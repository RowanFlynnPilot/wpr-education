"""Registry of DPI WISEdash statewide download files.

Populated 2026-07-25 from https://dpi.wi.gov/wisedash/public/download-files
(links are static HTML on that page -- no JS portal, all directly curl-able).

EVERY file is a ZIP, not a bare CSV. Each ZIP contains the data CSV, a
``*_layout.csv`` data dictionary, and ``DataDisclaimer.txt``. The
``attendance_dropouts_certified_*`` ZIPs contain TWO data CSVs
(``attendance_certified_*.csv`` and ``dropouts_certified_*.csv``);
refresh.py extracts every data CSV and keys frames by member prefix.

Recon notes (verified against downloaded files, newest + oldest per topic):

* Column headers are IDENTICAL across all sampled years within each topic
  (checked 2005-06 vs 2025-26 enrollment, 2005-06 vs 2024-25 absenteeism /
  attendance / dropouts, 2009-10 vs 2024-25 hs_completion, 2014-15 /
  2018-19 / 2024-25 act_statewide). No renamed columns.
* Value-level drift DOES exist:
  - hs_completion COMPLETION_STATUS labels changed, e.g. 2009-10
    "Completed - Regular" vs 2024-25 "Completed - Regular High School
    Diploma" (normalize.py matches on the "Completed - Regular" prefix).
  - act TEST_RESULT proficiency labels changed at the 2023-24 cut-score
    break (Basic/Proficient... -> Approaching/Developing/Meeting...);
    irrelevant to our metrics (averages + participation).
  - 2014-15/2015-16 ACT files also carry a TEST_SUBJECT "Combined" in
    addition to "Composite"; we use "Composite" which exists in all years.
* Suppression marker is "*" in every topic. attendance_certified files
  additionally use "--" in ATTENDANCE_RATE meaning "0 possible days of
  attendance" (division undefined, mostly PK / virtual-school rows) --
  that is N/A, not privacy suppression; normalize.py omits the metric for
  such rows rather than calling them suppressed.
* act_statewide files include TEST_GROUP "DLM" (Dynamic Learning Maps
  alternate assessment) rows alongside "ACT"; normalize.py filters to
  TEST_GROUP == "ACT".
* One hosting anomaly: act_statewide 2018-19 lives under
  /sites/default/files/imce/zip/ instead of /sites/default/files/wise/downloads/.

Year coverage per topic (all years registered below):
  enrollment  2005-06 .. 2025-26  (21 files; 2025-26 already certified)
  absenteeism 2005-06 .. 2024-25  (20)
  dropouts    2005-06 .. 2024-25  (20; attendance_dropouts ZIPs, also
                                   provide attendance_certified CSVs used
                                   by the absenteeism topic's
                                   attendance_rate metric)
  graduation  2009-10 .. 2024-25  (16; hs_completion files. Earlier years
                                   exist only as hs_completion_legacy_rates
                                   with a different, non-cohort methodology
                                   -- deliberately not ingested. 5-Year and
                                   6-Year TIMEFRAME rows exist 2013-14
                                   onward; earlier files carry 4-Year only)
  act         2014-15 .. 2024-25  (11; act_statewide = grade 11 census ACT.
                                   The separate act_graduates files cover a
                                   different population -- graduating
                                   seniors who ever took the ACT -- and are
                                   deliberately not ingested. No 2025-26
                                   file yet as of 2026-07-25; expect it at
                                   the fall 2026 refresh, covered by the two
                                   2025-26 entries in config/breaks.json.)
  preact      2022-23 .. 2024-25  (3; preact_secure_statewide = grades 9-10
                                   census PreACT Secure, first offered
                                   2022-23. Same shape as the ACT files
                                   including DLM alternate-assessment rows
                                   to filter out.)
  ap          2006-07 .. 2024-25  (19; headers identical across the sampled
                                   2006-07 / 2011-12 / 2024-25 files, and
                                   every year carries an AP_EXAM == "[All]"
                                   district rollup. Per-exam detail rows
                                   (Biology, Calculus AB, ...) are
                                   deliberately not ingested. Hosting
                                   anomaly like ACT 2018-19: the 2011-12 and
                                   2014-15 files live under
                                   /sites/default/files/imce/zip/.)
  forward     2015-16 .. 2024-25  (9; forward_certified = grades 3-8 Forward
                                   Exam. NO 2019-20 file exists -- the
                                   spring 2020 administration was canceled
                                   (COVID-19); the gap is annotated in
                                   config/breaks.json, not an error. Columns
                                   identical across sampled 2015-16/2024-25
                                   files. Newer ZIPs split the data into TWO
                                   CSVs (forward_certified_ELA_RDG_WRT_* and
                                   forward_certified_MTH_SCN_SOC_*) that
                                   share one member prefix ("forward") --
                                   refresh.py concatenates same-member CSVs
                                   after checking their columns match.
                                   TEST_GROUP "DLM" rows filtered out like
                                   ACT. TEST_RESULT categories changed at
                                   the 2023-24 cut-score break (Below
                                   Basic/Basic/Proficient/Advanced ->
                                   Developing/Approaching/Meeting/Advanced);
                                   proficiency = top two categories in both
                                   regimes. 2024-25 adds Reading/Writing
                                   TEST_SUBJECT rows (ELA subscores) we
                                   ignore; Science/Social Studies rows
                                   include GRADE_LEVEL 10 in some years --
                                   normalize filters to grades 3-8 for a
                                   stable definition.)

Non-WISEdash xlsx sources (XLSX_FILES below; scouted 2026-08-22):

  open_enrollment  2016-17 .. 2024-25  (9; DPI Open Enrollment program's
      "Pupil Transfers and Aid Adjustments" annual xlsx — NOT a WISEdash
      download. One sheet, all districts, header on spreadsheet row 5
      ("DIST NO" in 2016-17, "DISTRICT NO" later — matched by prefix),
      DISTRICT NO is 4-digit zero-padded matching our codes, Totals row
      below the data. Columns: PUPIL/AID TRANSFERS IN/OUT + NET (net
      columns are live formulas in older files — we read values via
      openpyxl data_only and compute nets ourselves when components are
      numeric). Counts under 20 are redacted "*" in recent files but NOT
      in early ones (redaction policy arrival is a breaks.json entry; aid
      dollars are never redacted). These are FTE-based aid-membership
      transfers as of the July final aid payment, not September
      headcounts, and statewide virtual charter schools mean a district's
      outflow is not necessarily to its neighbors — both caveats are in
      the frontend methodology. Earlier years exist only as PDFs —
      deliberately not ingested.)

refresh.py throws if any topic in TOPICS has an empty registry. There is
no partial refresh: either every topic downloads and validates, or the
run fails and data/ is untouched.
"""

TOPICS: list[str] = ["act", "forward", "preact", "ap", "graduation", "dropouts",
                     "absenteeism", "enrollment"]

_BASE = "https://dpi.wi.gov/sites/default/files/wise/downloads"
_IMCE = "https://dpi.wi.gov/sites/default/files/imce/zip"


def _years(first: int, last: int) -> list[str]:
    """School-year labels first..last inclusive, e.g. 2005 -> "2005-06"."""
    return [f"{y}-{str(y + 1)[-2:]}" for y in range(first, last + 1)]


# topic -> {school_year -> direct ZIP URL}
FILES: dict[str, dict[str, str]] = {
    "act": {
        y: (f"{_IMCE}/act_statewide_certified_{y}.zip" if y == "2018-19"
            else f"{_BASE}/act_statewide_certified_{y}.zip")
        for y in _years(2014, 2024)
    },
    "preact": {
        y: f"{_BASE}/preact_secure_statewide_certified_{y}.zip"
        for y in _years(2022, 2024)
    },
    # 2019-20 deliberately absent: no statewide Forward administration
    # (COVID-19). Not a gap in the registry -- a gap in reality.
    "forward": {
        y: f"{_BASE}/forward_certified_{y}.zip"
        for y in _years(2015, 2024) if y != "2019-20"
    },
    "ap": {
        y: (f"{_IMCE}/ap_certified_{y}.zip" if y in ("2011-12", "2014-15")
            else f"{_BASE}/ap_certified_{y}.zip")
        for y in _years(2006, 2024)
    },
    "graduation": {
        y: f"{_BASE}/hs_completion_certified_{y}.zip" for y in _years(2009, 2024)
    },
    "dropouts": {
        y: f"{_BASE}/attendance_dropouts_certified_{y}.zip" for y in _years(2005, 2024)
    },
    "absenteeism": {
        y: f"{_BASE}/absenteeism_certified_{y}.zip" for y in _years(2005, 2024)
    },
    "enrollment": {
        y: f"{_BASE}/enrollment_certified_{y}.zip" for y in _years(2005, 2025)
    },
}

_OE = "https://dpi.wi.gov/sites/default/files/imce/open-enrollment/xlsx"

# Direct xlsx downloads (not WISEdash ZIPs) — parsed by dedicated builders
# in normalize.py rather than the WISEdash frame machinery.
XLSX_FILES: dict[str, dict[str, str]] = {
    "open_enrollment": {
        y: f"{_OE}/{y}-pupils-and-aid-transfers-in-and-out.xlsx"
        for y in _years(2016, 2024)
    },
}

# District finance sources (scouted 2026-08-22; see CLAUDE.md Scope).
# Multi-year single workbooks — Drupal media IDs are the stable handles
# (the served filenames embed generation dates and change per revision).
FINANCE_FILES: dict[str, str] = {
    # SFS Comparative Cost per Member "Summary Computation 2008-09 to
    # 2024-25": flat DATA sheet, unpadded numeric district codes,
    # repeating per-year column groups delimited by FISCAL_YEAR headers
    # (group width drifts at DPI's 2023 category recalculation — the
    # parser keys on header names, not positions).
    "compcost": "https://dpi.wi.gov/media/55264/download?inline",
    # "Revenue Limit Per Member Longitudinal Survey", 1993-94 onward:
    # Data sheet, per-year column triples (avg membership, max revenue
    # limit, per-member), two header rows + a junk CODE row above data.
    "revenue_limit": "https://dpi.wi.gov/media/54850/download?inline",
}

# WiSFPR referenda database (1990 -> present, ~4,300 referenda). An app
# endpoint, not a published file — the fail-fast parser will catch any
# reshape. WITHOUT explicit from/to dates it silently defaults to the
# current calendar year, so always send the full range.
REFERENDA_ENDPOINT = "https://sfs.dpi.wi.gov/wisfpr/SchoolDistrictReferendaReport/ReadReport"
REFERENDA_BODY = ("sort=&page=1&pageSize=6000&group=&filter="
                  "&ReferendaFromDate=1990-01-01&ReferendaToDate=2030-12-31")

# Assembly order for output files: WISEdash topics, xlsx topics, finance.
ALL_TOPICS: list[str] = TOPICS + list(XLSX_FILES) + ["finance"]
