"""Full refresh: download statewide DPI files, validate, rebuild data/ from scratch.

Run twice a year (fall: assessments; spring: WISEdata topics). Re-pulls ALL
years every run because DPI publishes errata after initial publication.
Review the resulting git diff of data/ -- unexpected changes to prior years
are errata, and possibly a story.

Usage (from repo root):
    python pipeline/refresh.py
"""

import datetime
import json
import shutil
from pathlib import Path

import pandas as pd
import requests

import normalize
import sources
import validate

ROOT = Path(__file__).parent.parent
CONFIG = ROOT / "config"
DATA = ROOT / "data"
RAW = Path(__file__).parent / "raw"  # gitignored download cache, wiped each run


def download_all() -> dict[str, dict[str, Path]]:
    """Download every registered file fresh. Returns topic -> {year -> path}."""
    if RAW.exists():
        shutil.rmtree(RAW)
    out: dict[str, dict[str, Path]] = {}
    for topic, years in sources.FILES.items():
        out[topic] = {}
        for year, url in years.items():
            dest = RAW / topic / f"{year}.csv"
            dest.parent.mkdir(parents=True, exist_ok=True)
            resp = requests.get(url, timeout=120)
            resp.raise_for_status()
            dest.write_bytes(resp.content)
            out[topic][year] = dest
    return out


def load_districts() -> list[dict]:
    return json.loads((CONFIG / "districts.json").read_text(encoding="utf-8"))["districts"]


def write_output(by_district: dict[str, dict], index: dict, state: dict) -> None:
    """Rebuild data/ from scratch, then validate every file before finishing."""
    districts_dir = DATA / "districts"
    if districts_dir.exists():
        shutil.rmtree(districts_dir)
    districts_dir.mkdir(parents=True)

    for code, doc in by_district.items():
        path = districts_dir / f"{code}.json"
        path.write_text(json.dumps(doc, indent=2), encoding="utf-8")
        validate.check_output_file(path)

    state_path = DATA / "state.json"
    state_path.write_text(json.dumps(state, indent=2), encoding="utf-8")
    validate.check_output_file(state_path)

    (DATA / "index.json").write_text(json.dumps(index, indent=2), encoding="utf-8")


def main() -> None:
    validate.check_sources_populated(sources.TOPICS, sources.FILES)
    districts = load_districts()
    validate.check_district_config(districts)

    paths = download_all()
    frames = {
        topic: {year: pd.read_csv(p, dtype=str) for year, p in years.items()}
        for topic, years in paths.items()
    }

    # TODO (CLAUDE.md task 3): once column names are known, call
    # validate.check_district_codes_against_data(districts, <enrollment frame>,
    # code_col=..., name_col=...) here, then assemble per-district docs from
    # normalize.BUILDERS, build index.json from included districts, and call
    # write_output(). generated timestamp:
    generated = datetime.datetime.now(datetime.timezone.utc).isoformat()
    raise NotImplementedError(
        f"Assembly not implemented yet (would stamp generated={generated}). "
        "Complete CLAUDE.md tasks 1-3 first."
    )


if __name__ == "__main__":
    main()
