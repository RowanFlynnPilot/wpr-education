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


def check_output_file(path: Path) -> None:
    """Validate one output file against the schema, then enforce the
    value-null-iff-suppressed invariant the schema can't express."""
    doc = json.loads(path.read_text(encoding="utf-8"))
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    jsonschema.validate(doc, schema)
    for topic, years in doc["topics"].items():
        for year, metrics in years.items():
            for metric, cell in metrics.items():
                if (cell["value"] is None) != cell["suppressed"]:
                    raise ValueError(
                        f"{path.name}: {topic}/{year}/{metric}: "
                        f"value={cell['value']} suppressed={cell['suppressed']} "
                        "-- value must be null iff suppressed is true."
                    )
