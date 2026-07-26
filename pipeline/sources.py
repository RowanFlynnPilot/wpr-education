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
                                   -- deliberately not ingested)
  act         2014-15 .. 2024-25  (11; act_statewide = grade 11 census ACT.
                                   The separate act_graduates files cover a
                                   different population -- graduating
                                   seniors who ever took the ACT -- and are
                                   deliberately not ingested. No 2025-26
                                   file yet as of 2026-07-25; expect it at
                                   the fall 2026 refresh, covered by the two
                                   2025-26 entries in config/breaks.json.)

refresh.py throws if any topic in TOPICS has an empty registry. There is
no partial refresh: either every topic downloads and validates, or the
run fails and data/ is untouched.
"""

TOPICS: list[str] = ["act", "graduation", "dropouts", "absenteeism", "enrollment"]

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
