"""Normalize DPI statewide CSVs into per-district JSON.

Every builder has the same signature: it receives the FULL frames dict
``{topic: {school_year: {member: DataFrame}}}`` (member = CSV filename
prefix before "_certified", e.g. the attendance_dropouts ZIP yields
members "attendance" and "dropouts") and returns
``{dpi_code: {school_year: {metric: cell}}}``. Statewide totals ride
along under code "0000" (DPI's own statewide row code).

Row selection, verified against real files (see sources.py recon notes):
district rows are SCHOOL_NAME == "[Districtwide]", statewide rows are
DISTRICT_CODE == "0000" with SCHOOL_NAME == "[Statewide]"; both filtered
to GROUP_BY == "All Students" and GRADE_GROUP == "[All]". These filters
yield exactly one row (or one row-group for long-format topics) per
district per year; builders throw on duplicates rather than aggregating.
"""

import pandas as pd

from validate import SUPPRESSION_MARKERS

Cell = dict  # {"value": float | None, "suppressed": bool}

SUPPRESSED: Cell = {"value": None, "suppressed": True}


def to_cell(raw) -> Cell:
    """Convert one raw CSV value to a cell. Suppression markers become
    null+suppressed; numbers become numbers; anything else throws."""
    if isinstance(raw, str):
        stripped = raw.strip()
        if stripped in SUPPRESSION_MARKERS:
            return {"value": None, "suppressed": True}
        raw = stripped
    try:
        return {"value": float(raw), "suppressed": False}
    except (TypeError, ValueError):
        raise ValueError(
            f"Unclassifiable cell value {raw!r}: not a number and not a known "
            f"suppression marker {sorted(SUPPRESSION_MARKERS)}. If DPI uses a "
            "new marker, add it to validate.SUPPRESSION_MARKERS deliberately."
        )


def _is_suppressed(raw) -> bool:
    return isinstance(raw, str) and raw.strip() in SUPPRESSION_MARKERS


def _num(raw, context: str) -> float:
    cell = to_cell(raw)
    if cell["suppressed"]:
        raise ValueError(f"{context}: unexpected suppressed value in a computed input")
    return cell["value"]


def _get_member(frames: dict, topic: str, member: str) -> dict[str, pd.DataFrame]:
    """{school_year: frame} for one member CSV of one topic. Throws if any
    year's ZIP lacked that member."""
    out = {}
    for year, members in frames[topic].items():
        if member not in members:
            raise ValueError(
                f"{topic} {year}: expected member CSV '{member}_certified_*' in ZIP, "
                f"got {sorted(members)}"
            )
        out[year] = members[member]
    return out


def _select(df: pd.DataFrame, year: str, topic: str) -> pd.DataFrame:
    """All-students, district-level rows (plus the one statewide row-group)."""
    for col in ("DISTRICT_CODE", "DISTRICT_NAME", "SCHOOL_NAME", "GROUP_BY"):
        if col not in df.columns:
            raise ValueError(f"{topic} {year}: expected column {col} missing "
                             f"from {list(df.columns)}")
    mask = (df["GROUP_BY"] == "All Students") & (
        (df["SCHOOL_NAME"] == "[Districtwide]")
        | ((df["DISTRICT_CODE"] == "0000") & (df["SCHOOL_NAME"] == "[Statewide]"))
    )
    if "GRADE_GROUP" in df.columns:
        mask &= df["GRADE_GROUP"] == "[All]"
    out = df[mask]
    if out.empty:
        raise ValueError(f"{topic} {year}: row selection returned nothing")
    return out


def _one_row_per_district(sel: pd.DataFrame, year: str, topic: str) -> pd.DataFrame:
    dupes = sel[sel["DISTRICT_CODE"].duplicated(keep=False)]
    if not dupes.empty:
        raise ValueError(
            f"{topic} {year}: expected one row per district, got duplicates for "
            f"codes {sorted(dupes['DISTRICT_CODE'].unique())[:5]}"
        )
    return sel


def _simple_topic(member_frames: dict[str, pd.DataFrame], topic: str,
                  metric_cols: dict[str, str]) -> dict:
    """Topics where each district-year is a single row and metrics are
    direct column reads."""
    out: dict[str, dict] = {}
    for year, df in member_frames.items():
        sel = _one_row_per_district(_select(df, year, topic), year, topic)
        for row in sel.itertuples(index=False):
            code = row.DISTRICT_CODE
            metrics = {}
            for metric, col in metric_cols.items():
                raw = getattr(row, col)
                if pd.isna(raw):
                    raise ValueError(f"{topic} {year} district {code}: empty {col}")
                metrics[metric] = to_cell(raw)
            out.setdefault(code, {})[year] = metrics
    return out


def build_enrollment(frames: dict) -> dict:
    """total_enrollment from enrollment_certified STUDENT_COUNT."""
    return _simple_topic(_get_member(frames, "enrollment", "enrollment"),
                         "enrollment", {"total_enrollment": "STUDENT_COUNT"})


def build_dropouts(frames: dict) -> dict:
    """dropout_rate (%, grades 7-12) and dropout_count from the dropouts
    member of the attendance_dropouts ZIP."""
    return _simple_topic(_get_member(frames, "dropouts", "dropouts"),
                         "dropouts",
                         {"dropout_rate": "DROPOUT_RATE",
                          "dropout_count": "DROPOUT_COUNT"})


def build_absenteeism(frames: dict) -> dict:
    """chronic_absenteeism_rate from absenteeism_certified ABSENCE_RATE
    (ESSA/STATE measure, the only measure in the files), plus
    attendance_rate from the attendance member of the attendance_dropouts
    ZIP downloaded for the dropouts topic."""
    out = _simple_topic(_get_member(frames, "absenteeism", "absenteeism"),
                        "absenteeism",
                        {"chronic_absenteeism_rate": "ABSENCE_RATE"})
    for year, df in _get_member(frames, "dropouts", "attendance").items():
        sel = _one_row_per_district(_select(df, year, "attendance"), year, "attendance")
        for row in sel.itertuples(index=False):
            raw = row.ATTENDANCE_RATE
            # "--" = 0 possible days of attendance, division undefined
            # (seen in attendance_certified_2024-25.csv, PK/virtual rows).
            # N/A, not privacy suppression: omit the metric, don't fake a
            # suppressed cell.
            if isinstance(raw, str) and raw.strip() == "--":
                continue
            years = out.setdefault(row.DISTRICT_CODE, {})
            years.setdefault(year, {})["attendance_rate"] = to_cell(raw)
    return out


# COMPLETION_STATUS wording drifts across years ("Completed - Regular" in
# 2009-10, "Completed - Regular High School Diploma" in 2024-25); the
# stable prefix identifies a regular-diploma completion in every year.
_REGULAR_PREFIX = "Completed - Regular"


def build_graduation(frames: dict) -> dict:
    """4-year cohort regular-diploma graduation: grad_rate_4yr (%),
    grad_count_4yr, cohort_count_4yr, from hs_completion_certified rows
    with TIMEFRAME == '4-Year rate' (one cohort per file)."""
    out: dict[str, dict] = {}
    for year, df in _get_member(frames, "graduation", "hs_completion").items():
        sel = _select(df[df["TIMEFRAME"] == "4-Year rate"], year, "graduation")
        for code, grp in sel.groupby("DISTRICT_CODE"):
            if grp["COHORT"].nunique() > 1:
                raise ValueError(f"graduation {year} district {code}: multiple "
                                 f"4-year cohorts {sorted(grp['COHORT'].unique())}")
            cohort_raws = grp["COHORT_COUNT"].unique()
            if len(cohort_raws) != 1:
                raise ValueError(f"graduation {year} district {code}: conflicting "
                                 f"COHORT_COUNT values {cohort_raws}")
            cohort_raw = cohort_raws[0]

            regular = grp[grp["COMPLETION_STATUS"].str.startswith(_REGULAR_PREFIX)]
            if len(regular) > 1:
                raise ValueError(f"graduation {year} district {code}: multiple "
                                 "regular-diploma rows")
            statuses_suppressed = bool((grp["COMPLETION_STATUS"] == "*").any())

            metrics: dict[str, Cell] = {"cohort_count_4yr": to_cell(cohort_raw)}
            if len(regular) == 1:
                grad_raw = regular.iloc[0]["STUDENT_COUNT"]
                metrics["grad_count_4yr"] = to_cell(grad_raw)
                if _is_suppressed(grad_raw) or _is_suppressed(cohort_raw):
                    metrics["grad_rate_4yr"] = dict(SUPPRESSED)
                else:
                    ctx = f"graduation {year} {code}"
                    rate = 100.0 * _num(grad_raw, ctx) / _num(cohort_raw, ctx)
                    metrics["grad_rate_4yr"] = {"value": round(rate, 1),
                                                "suppressed": False}
            elif statuses_suppressed:
                # Status breakdown redacted for privacy: rate unknowable.
                metrics["grad_count_4yr"] = dict(SUPPRESSED)
                metrics["grad_rate_4yr"] = dict(SUPPRESSED)
            else:
                # Statuses enumerated, none of them regular-diploma: a real
                # zero (tiny cohorts), not missing data.
                metrics["grad_count_4yr"] = {"value": 0.0, "suppressed": False}
                if _is_suppressed(cohort_raw):
                    metrics["grad_rate_4yr"] = dict(SUPPRESSED)
                else:
                    metrics["grad_rate_4yr"] = {"value": 0.0, "suppressed": False}
            out.setdefault(code, {})[year] = metrics
    return out


# TEST_SUBJECT -> metric name. "Composite" exists in every year 2014-15
# onward (2014-15/2015-16 also carry a "Combined" subject we ignore).
_ACT_SUBJECTS = {
    "Composite": "composite_avg",
    "English": "english_avg",
    "Mathematics": "math_avg",
    "Reading": "reading_avg",
    "Science": "science_avg",
}


def build_act(frames: dict) -> dict:
    """Grade-11 census ACT (act_statewide_certified), TEST_GROUP == 'ACT'
    only (DLM alternate-assessment rows excluded). Per-subject averages
    from AVERAGE_SCORE (constant across a subject's result rows), plus
    participation_pct and tested_count derived from the Composite
    row-group: GROUP_COUNT is the enrolled denominator and the 'No Test'
    row's STUDENT_COUNT the non-participants."""
    out: dict[str, dict] = {}
    for year, df in _get_member(frames, "act", "act_statewide").items():
        sel = _select(df[df["TEST_GROUP"] == "ACT"], year, "act")
        for code, grp in sel.groupby("DISTRICT_CODE"):
            metrics: dict[str, Cell] = {}
            for subject, metric in _ACT_SUBJECTS.items():
                rows = grp[grp["TEST_SUBJECT"] == subject]
                if rows.empty:
                    raise ValueError(f"act {year} district {code}: no rows for "
                                     f"subject {subject}")
                numeric = {v for v in rows["AVERAGE_SCORE"].dropna()
                           if not _is_suppressed(v)}
                if len(numeric) > 1:
                    raise ValueError(f"act {year} district {code} {subject}: "
                                     f"conflicting AVERAGE_SCORE {sorted(numeric)}")
                if numeric:
                    metrics[metric] = to_cell(numeric.pop())
                elif rows["AVERAGE_SCORE"].map(_is_suppressed).any():
                    metrics[metric] = dict(SUPPRESSED)
                # else: only 'No Test' rows, no average exists -> omit.

            comp = grp[grp["TEST_SUBJECT"] == "Composite"]
            group_raws = {v for v in comp["GROUP_COUNT"].dropna()}
            if len(group_raws) != 1:
                raise ValueError(f"act {year} district {code}: expected one "
                                 f"GROUP_COUNT, got {sorted(group_raws)}")
            group_raw = group_raws.pop()
            no_test = comp[comp["TEST_RESULT"] == "No Test"]
            if len(no_test) > 1:
                raise ValueError(f"act {year} district {code}: multiple "
                                 "Composite 'No Test' rows")
            no_test_raw = no_test.iloc[0]["STUDENT_COUNT"] if len(no_test) else "0"

            if _is_suppressed(group_raw) or _is_suppressed(no_test_raw):
                metrics["participation_pct"] = dict(SUPPRESSED)
                metrics["tested_count"] = dict(SUPPRESSED)
            else:
                ctx = f"act {year} {code}"
                enrolled = _num(group_raw, ctx)
                tested = enrolled - _num(no_test_raw, ctx)
                metrics["tested_count"] = {"value": tested, "suppressed": False}
                metrics["participation_pct"] = {
                    "value": round(100.0 * tested / enrolled, 1),
                    "suppressed": False,
                }
            out.setdefault(code, {})[year] = metrics
    return out


BUILDERS = {
    "act": build_act,
    "graduation": build_graduation,
    "dropouts": build_dropouts,
    "absenteeism": build_absenteeism,
    "enrollment": build_enrollment,
}
