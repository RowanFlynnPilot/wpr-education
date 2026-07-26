"""Normalize DPI statewide CSVs into per-district JSON.

Two layers of builders share the same per-topic metric extraction:

* ``BUILDERS[topic](frames)`` — all-students metrics for EVERY Wisconsin
  district (plus statewide as code 0000):
  ``{dpi_code: {school_year: {metric: cell}}}``
* ``SUBGROUP_BUILDERS[topic](frames, codes)`` — the same metrics broken out
  by student group, for the given district codes only (config districts +
  statewide; subgroup files for all 507 districts would grow the repo ~10x
  for districts nobody can route to):
  ``{dpi_code: {school_year: {dimension_id: {group_label: {metric: cell}}}}}``

``frames`` is ``{topic: {school_year: {member: DataFrame}}}`` (member = CSV
filename prefix before "_certified"; the attendance_dropouts ZIP yields
members "attendance" and "dropouts").

Row selection, verified against real files (see sources.py recon notes):
district rows are SCHOOL_NAME == "[Districtwide]", statewide rows are
DISTRICT_CODE == "0000" with SCHOOL_NAME == "[Statewide]"; both filtered to
GRADE_GROUP == "[All]". All-students rows use GROUP_BY == "All Students";
subgroup rows use the GROUP_BY labels in DIMENSIONS (drift across years:
"ELL Status" became "EL Status", and the value "ELL/LEP" became "EL" —
harmonized via GROUP_VALUE_ALIASES with a methodology note frontend-side).
"""

import pandas as pd

from validate import SUPPRESSION_MARKERS

Cell = dict  # {"value": float | None, "suppressed": bool}

SUPPRESSED: Cell = {"value": None, "suppressed": True}

# dimension id -> GROUP_BY labels used across years/topics.
# "Disability Status" is the SwD/SwoD binary; the separate "Disability"
# GROUP_BY (by condition: Autism, ...) is deliberately not ingested.
DIMENSIONS: dict[str, list[str]] = {
    "race_ethnicity": ["Race/Ethnicity"],
    "econ_status": ["Economic Status"],
    "disability": ["Disability Status"],
    "el_status": ["EL Status", "ELL Status"],
}

# DPI renamed the EL category value around 2019; one population, one label.
GROUP_VALUE_ALIASES: dict[str, str] = {"ELL/LEP": "EL"}

# A redaction bucket, not a student group: rows whose GROUP_BY_VALUE hides
# which group they belong to. Skipped entirely.
SKIP_GROUP_VALUES: set[str] = {"[Data Suppressed]"}


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


def _select(df: pd.DataFrame, year: str, topic: str, group_by: str,
            codes: set[str] | None = None) -> pd.DataFrame:
    """District-level rows (plus the one statewide row-group) for one
    GROUP_BY label. codes limits to specific districts (subgroup builds)."""
    for col in ("DISTRICT_CODE", "DISTRICT_NAME", "SCHOOL_NAME", "GROUP_BY"):
        if col not in df.columns:
            raise ValueError(f"{topic} {year}: expected column {col} missing "
                             f"from {list(df.columns)}")
    mask = (df["GROUP_BY"] == group_by) & (
        (df["SCHOOL_NAME"] == "[Districtwide]")
        | ((df["DISTRICT_CODE"] == "0000") & (df["SCHOOL_NAME"] == "[Statewide]"))
    )
    if "GRADE_GROUP" in df.columns:
        mask &= df["GRADE_GROUP"] == "[All]"
    if codes is not None:
        mask &= df["DISTRICT_CODE"].isin(codes)
    return df[mask]


# ---------------------------------------------------------------------------
# Per-topic metric extraction. Each function takes the rows for ONE
# (district, group) and returns {metric: cell} — or None to omit the entry.
# `strict` is True for all-students builds (a malformed file should fail the
# run) and False for subgroups, where DPI legitimately omits whole subjects
# or rows for tiny groups.
# ---------------------------------------------------------------------------

def _one_row(grp: pd.DataFrame, ctx: str) -> pd.Series:
    if len(grp) != 1:
        raise ValueError(f"{ctx}: expected exactly one row, got {len(grp)}")
    return grp.iloc[0]


def _enrollment_metrics(grp, ctx, strict):
    row = _one_row(grp, ctx)
    if pd.isna(row["STUDENT_COUNT"]):
        raise ValueError(f"{ctx}: empty STUDENT_COUNT")
    return {"total_enrollment": to_cell(row["STUDENT_COUNT"])}


def _dropout_metrics(grp, ctx, strict):
    row = _one_row(grp, ctx)
    for col in ("DROPOUT_RATE", "DROPOUT_COUNT"):
        if pd.isna(row[col]):
            raise ValueError(f"{ctx}: empty {col}")
    return {"dropout_rate": to_cell(row["DROPOUT_RATE"]),
            "dropout_count": to_cell(row["DROPOUT_COUNT"])}


def _chronic_absenteeism_metrics(grp, ctx, strict):
    row = _one_row(grp, ctx)
    if pd.isna(row["ABSENCE_RATE"]):
        raise ValueError(f"{ctx}: empty ABSENCE_RATE")
    return {"chronic_absenteeism_rate": to_cell(row["ABSENCE_RATE"])}


def _attendance_metrics(grp, ctx, strict):
    row = _one_row(grp, ctx)
    raw = row["ATTENDANCE_RATE"]
    # "--" = 0 possible days of attendance, division undefined (seen in
    # attendance_certified_2024-25.csv, PK/virtual rows). N/A, not privacy
    # suppression: omit the metric, don't fake a suppressed cell.
    if isinstance(raw, str) and raw.strip() == "--":
        return None
    return {"attendance_rate": to_cell(raw)}


# COMPLETION_STATUS wording drifts across years ("Completed - Regular" in
# 2009-10, "Completed - Regular High School Diploma" in 2024-25); the
# stable prefix identifies a regular-diploma completion in every year.
_REGULAR_PREFIX = "Completed - Regular"


def _graduation_metrics(grp, ctx, strict):
    if grp["COHORT"].nunique() > 1:
        raise ValueError(f"{ctx}: multiple 4-year cohorts "
                         f"{sorted(grp['COHORT'].unique())}")
    cohort_raws = grp["COHORT_COUNT"].unique()
    if len(cohort_raws) != 1:
        raise ValueError(f"{ctx}: conflicting COHORT_COUNT values {cohort_raws}")
    cohort_raw = cohort_raws[0]

    regular = grp[grp["COMPLETION_STATUS"].str.startswith(_REGULAR_PREFIX)]
    if len(regular) > 1:
        raise ValueError(f"{ctx}: multiple regular-diploma rows")
    statuses_suppressed = bool((grp["COMPLETION_STATUS"] == "*").any())

    metrics: dict[str, Cell] = {"cohort_count_4yr": to_cell(cohort_raw)}
    if len(regular) == 1:
        grad_raw = regular.iloc[0]["STUDENT_COUNT"]
        metrics["grad_count_4yr"] = to_cell(grad_raw)
        if _is_suppressed(grad_raw) or _is_suppressed(cohort_raw):
            metrics["grad_rate_4yr"] = dict(SUPPRESSED)
        else:
            rate = 100.0 * _num(grad_raw, ctx) / _num(cohort_raw, ctx)
            metrics["grad_rate_4yr"] = {"value": round(rate, 1), "suppressed": False}
    elif statuses_suppressed:
        # Status breakdown redacted for privacy: rate unknowable.
        metrics["grad_count_4yr"] = dict(SUPPRESSED)
        metrics["grad_rate_4yr"] = dict(SUPPRESSED)
    else:
        # Statuses enumerated, none of them regular-diploma: a real zero
        # (tiny cohorts), not missing data.
        metrics["grad_count_4yr"] = {"value": 0.0, "suppressed": False}
        if _is_suppressed(cohort_raw):
            metrics["grad_rate_4yr"] = dict(SUPPRESSED)
        else:
            metrics["grad_rate_4yr"] = {"value": 0.0, "suppressed": False}
    return metrics


# TEST_SUBJECT -> metric name. "Composite" exists in every year 2014-15
# onward (2014-15/2015-16 also carry a "Combined" subject we ignore).
_ACT_SUBJECTS = {
    "Composite": "composite_avg",
    "English": "english_avg",
    "Mathematics": "math_avg",
    "Reading": "reading_avg",
    "Science": "science_avg",
}


def _act_metrics(grp, ctx, strict):
    metrics: dict[str, Cell] = {}
    for subject, metric in _ACT_SUBJECTS.items():
        rows = grp[grp["TEST_SUBJECT"] == subject]
        if rows.empty:
            if strict:
                raise ValueError(f"{ctx}: no rows for subject {subject}")
            continue  # tiny subgroups can lack whole subjects
        numeric = {v for v in rows["AVERAGE_SCORE"].dropna() if not _is_suppressed(v)}
        if len(numeric) > 1:
            raise ValueError(f"{ctx} {subject}: conflicting AVERAGE_SCORE "
                             f"{sorted(numeric)}")
        if numeric:
            metrics[metric] = to_cell(numeric.pop())
        elif rows["AVERAGE_SCORE"].map(_is_suppressed).any():
            metrics[metric] = dict(SUPPRESSED)
        # else: only 'No Test' rows, no average exists -> omit.

    comp = grp[grp["TEST_SUBJECT"] == "Composite"]
    if comp.empty:
        return metrics or None
    group_raws = {v for v in comp["GROUP_COUNT"].dropna()}
    if len(group_raws) != 1:
        raise ValueError(f"{ctx}: expected one GROUP_COUNT, got {sorted(group_raws)}")
    group_raw = group_raws.pop()
    no_test = comp[comp["TEST_RESULT"] == "No Test"]
    if len(no_test) > 1:
        raise ValueError(f"{ctx}: multiple Composite 'No Test' rows")
    # A missing 'No Test' row means zero non-participants ONLY when the
    # result rows are actually enumerated. If every Composite result row is
    # redacted ('*'), the number of non-testers is unknowable — computing
    # 100% participation there would fabricate a statistic.
    results_all_suppressed = bool(comp["TEST_RESULT"].eq("*").all())
    no_test_raw = no_test.iloc[0]["STUDENT_COUNT"] if len(no_test) else "0"

    if _is_suppressed(group_raw) or _is_suppressed(no_test_raw) or (
            len(no_test) == 0 and results_all_suppressed):
        metrics["participation_pct"] = dict(SUPPRESSED)
        metrics["tested_count"] = dict(SUPPRESSED)
    else:
        enrolled = _num(group_raw, ctx)
        tested = enrolled - _num(no_test_raw, ctx)
        metrics["tested_count"] = {"value": tested, "suppressed": False}
        metrics["participation_pct"] = {
            "value": round(100.0 * tested / enrolled, 1),
            "suppressed": False,
        }
    return metrics


# ---------------------------------------------------------------------------
# Topic definitions: where the rows come from and how to slice them.
# prep narrows the member frame before row-group selection (ACT's TEST_GROUP
# filter, graduation's 4-year timeframe). multi_row topics have one row-GROUP
# per district+group; the rest must be exactly one row.
# ---------------------------------------------------------------------------

_TOPIC_SOURCES = {
    "enrollment": [("enrollment", "enrollment", None, _enrollment_metrics)],
    "dropouts": [("dropouts", "dropouts", None, _dropout_metrics)],
    "absenteeism": [
        ("absenteeism", "absenteeism", None, _chronic_absenteeism_metrics),
        ("dropouts", "attendance", None, _attendance_metrics),
    ],
    "graduation": [(
        "graduation", "hs_completion",
        lambda df: df[df["TIMEFRAME"] == "4-Year rate"],
        _graduation_metrics,
    )],
    "act": [(
        "act", "act_statewide",
        lambda df: df[df["TEST_GROUP"] == "ACT"],
        _act_metrics,
    )],
}


def _build_all_students(topic: str, frames: dict) -> dict:
    out: dict[str, dict] = {}
    for src_topic, member, prep, metrics_fn in _TOPIC_SOURCES[topic]:
        for year, df in _get_member(frames, src_topic, member).items():
            sel = _select(prep(df) if prep else df, year, topic, "All Students")
            if sel.empty:
                raise ValueError(f"{topic} {year}: row selection returned nothing")
            for code, grp in sel.groupby("DISTRICT_CODE"):
                ctx = f"{topic} {year} district {code}"
                metrics = metrics_fn(grp, ctx, strict=True)
                if metrics:
                    out.setdefault(code, {}).setdefault(year, {}).update(metrics)
    return out


def _build_subgroups(topic: str, frames: dict, codes: set[str]) -> dict:
    out: dict[str, dict] = {}
    for src_topic, member, prep, metrics_fn in _TOPIC_SOURCES[topic]:
        for year, df in _get_member(frames, src_topic, member).items():
            narrowed = prep(df) if prep else df
            for dim, labels in DIMENSIONS.items():
                present = [l for l in labels if (narrowed["GROUP_BY"] == l).any()]
                for label in present:
                    sel = _select(narrowed, year, topic, label, codes=codes)
                    for (code, raw_value), grp in sel.groupby(
                            ["DISTRICT_CODE", "GROUP_BY_VALUE"]):
                        if raw_value in SKIP_GROUP_VALUES:
                            continue
                        value = GROUP_VALUE_ALIASES.get(raw_value, raw_value)
                        ctx = f"{topic} {year} district {code} {dim}/{value}"
                        metrics = metrics_fn(grp, ctx, strict=False)
                        if metrics:
                            (out.setdefault(code, {})
                                .setdefault(year, {})
                                .setdefault(dim, {})
                                .setdefault(value, {})
                                .update(metrics))
    return out


def build_enrollment(frames):
    """total_enrollment from enrollment_certified STUDENT_COUNT."""
    return _build_all_students("enrollment", frames)


def build_dropouts(frames):
    """dropout_rate (%, grades 7-12) and dropout_count from the dropouts
    member of the attendance_dropouts ZIP."""
    return _build_all_students("dropouts", frames)


def build_absenteeism(frames):
    """chronic_absenteeism_rate (ESSA/STATE ABSENCE_RATE) plus
    attendance_rate from the attendance member of the attendance_dropouts
    ZIP downloaded for the dropouts topic."""
    return _build_all_students("absenteeism", frames)


def build_graduation(frames):
    """4-year cohort regular-diploma graduation: grad_rate_4yr (%),
    grad_count_4yr, cohort_count_4yr."""
    return _build_all_students("graduation", frames)


def build_act(frames):
    """Grade-11 census ACT, TEST_GROUP == 'ACT' only: per-subject averages,
    participation_pct and tested_count from the Composite row-group."""
    return _build_all_students("act", frames)


BUILDERS = {
    "act": build_act,
    "graduation": build_graduation,
    "dropouts": build_dropouts,
    "absenteeism": build_absenteeism,
    "enrollment": build_enrollment,
}

SUBGROUP_BUILDERS = {
    topic: (lambda frames, codes, _t=topic: _build_subgroups(_t, frames, codes))
    for topic in _TOPIC_SOURCES
}
