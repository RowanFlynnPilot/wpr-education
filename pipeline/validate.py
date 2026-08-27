"""Fail-fast validation. Every anomaly throws with a specific message.

No fallbacks, no coercion beyond the documented suppression markers,
no partial output.
"""

import json
from pathlib import Path

import jsonschema
import pandas as pd

# DPI redacts small cells with "*". If a downloaded file uses a marker not
# listed here, the run fails -- add the marker deliberately, with a comment
# citing the file that uses it. Never silently coerce.
SUPPRESSION_MARKERS: set[str] = {"*"}

SCHEMA_PATH = Path(__file__).parent.parent / "schemas" / "district.schema.json"
SUBGROUP_SCHEMA_PATH = Path(__file__).parent.parent / "schemas" / "subgroup.schema.json"
SCHOOL_SCHEMA_PATH = Path(__file__).parent.parent / "schemas" / "school.schema.json"
REFERENDA_SCHEMA_PATH = Path(__file__).parent.parent / "schemas" / "referenda.schema.json"


def check_sources_populated(topics: list[str], files: dict[str, dict[str, str]]) -> None:
    """Throw if any topic has no registered files. No partial refresh."""
    empty = [t for t in topics if not files.get(t)]
    if empty:
        raise ValueError(
            f"sources.FILES has no URLs for topics: {empty}. "
            "Populate pipeline/sources.py before running (CLAUDE.md task 2)."
        )


def check_district_config(districts: list[dict]) -> None:
    """Throw if any included district is missing its DPI code or name."""
    missing = [d["label"] for d in districts if d["included"] and (d["dpi_code"] is None or d["dpi_name"] is None)]
    if missing:
        raise ValueError(
            f"config/districts.json: included districts missing dpi_code/dpi_name: {missing}. "
            "Fill from the DPI enrollment statewide file (CLAUDE.md task 1)."
        )


def check_district_codes_against_data(districts: list[dict], frame: pd.DataFrame,
                                      code_col: str, name_col: str) -> None:
    """For every included district, the (code, name) pair must appear in the
    data exactly as configured. A name mismatch means the code is wrong."""
    pairs = set(zip(frame[code_col].astype(str), frame[name_col].astype(str)))
    for d in (d for d in districts if d["included"]):
        if (str(d["dpi_code"]), d["dpi_name"]) not in pairs:
            raise ValueError(
                f"District '{d['label']}' ({d['dpi_code']}, '{d['dpi_name']}') "
                f"not found in source data columns [{code_col}, {name_col}]. "
                "Config and DPI file disagree -- fix the config, don't relax the check."
            )


def _walk_cells(path: Path, node, trail: str = "") -> None:
    """Recursively enforce the value-null-iff-suppressed invariant on every
    metric cell in a document, wherever it nests (district: 3 levels deep,
    subgroup and school: 5). ONE walker so the project's #1 invariant can't
    drift between file families."""
    if not isinstance(node, dict):
        return
    if set(node) == {"value", "suppressed"}:
        if (node["value"] is None) != node["suppressed"]:
            raise ValueError(
                f"{path.name}: {trail}: value={node['value']} "
                f"suppressed={node['suppressed']} "
                "-- value must be null iff suppressed is true."
            )
        return
    for key, child in node.items():
        _walk_cells(path, child, f"{trail}/{key}" if trail else str(key))


def _check_file(path: Path, schema_path: Path, walk: bool = True) -> None:
    doc = json.loads(path.read_text(encoding="utf-8"))
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    jsonschema.validate(doc, schema)
    if walk:
        _walk_cells(path, doc)


def check_output_file(path: Path) -> None:
    """District/state file: schema + the cell invariant."""
    _check_file(path, SCHEMA_PATH)


def check_school_file(path: Path) -> None:
    """School file: same cell contract, nested per school -- same walker."""
    _check_file(path, SCHOOL_SCHEMA_PATH)


def check_referenda_file(path: Path) -> None:
    """Schema check only -- referenda are event lists, not metric cells,
    so the null-iff-suppressed invariant doesn't apply."""
    _check_file(path, REFERENDA_SCHEMA_PATH, walk=False)


def check_subgroup_file(path: Path) -> None:
    """Subgroup file: same cell contract, deeper nesting -- same walker."""
    _check_file(path, SUBGROUP_SCHEMA_PATH)
