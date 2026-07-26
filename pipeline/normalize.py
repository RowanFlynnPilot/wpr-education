"""Normalize DPI statewide CSVs into per-district JSON.

The generic core (cell conversion) is implemented. Per-topic column
mapping is intentionally NOT guessed here -- download the real files
first, then implement one build_<topic>() per topic from the actual
headers (CLAUDE.md task 3). Each function has a single responsibility:
one topic, wide CSV in, {dpi_code: {school_year: {metric: cell}}} out.
"""

import pandas as pd

from validate import SUPPRESSION_MARKERS

Cell = dict  # {"value": float | None, "suppressed": bool}


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


def build_act(frames: dict[str, pd.DataFrame]) -> dict:
    """school_year -> frame in; {dpi_code: {school_year: {metric: cell}}} out."""
    raise NotImplementedError("Implement from actual ACT file headers -- CLAUDE.md task 3.")


def build_graduation(frames: dict[str, pd.DataFrame]) -> dict:
    raise NotImplementedError("Implement from actual HS completion file headers -- CLAUDE.md task 3.")


def build_dropouts(frames: dict[str, pd.DataFrame]) -> dict:
    raise NotImplementedError("Implement from actual dropout file headers -- CLAUDE.md task 3.")


def build_absenteeism(frames: dict[str, pd.DataFrame]) -> dict:
    raise NotImplementedError("Implement from actual absenteeism file headers -- CLAUDE.md task 3.")


def build_enrollment(frames: dict[str, pd.DataFrame]) -> dict:
    raise NotImplementedError("Implement from actual enrollment file headers -- CLAUDE.md task 3.")


BUILDERS = {
    "act": build_act,
    "graduation": build_graduation,
    "dropouts": build_dropouts,
    "absenteeism": build_absenteeism,
    "enrollment": build_enrollment,
}
