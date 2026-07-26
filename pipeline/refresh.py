"""Full refresh: download statewide DPI files, validate, rebuild data/ from scratch.

Run twice a year (fall: assessments; spring: WISEdata topics). Re-pulls ALL
years every run because DPI publishes errata after initial publication.
Review the resulting git diff of data/ -- unexpected changes to prior years
are errata, and possibly a story.

Usage (from repo root):
    python pipeline/refresh.py
"""

import datetime
import io
import json
import shutil
import zipfile
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

# DPI's own code for the statewide row-group in every file.
STATEWIDE_CODE = "0000"


def download_all() -> dict[str, dict[str, dict[str, Path]]]:
    """Download every registered ZIP fresh and extract its data CSVs.
    Returns topic -> {year -> {member -> csv path}} where member is the
    CSV filename prefix before '_certified' (the attendance_dropouts ZIPs
    contain two data CSVs; every other ZIP contains one). Layout
    dictionaries and disclaimers are not extracted."""
    if RAW.exists():
        shutil.rmtree(RAW)
    out: dict[str, dict[str, dict[str, Path]]] = {}
    for topic, years in sources.FILES.items():
        out[topic] = {}
        for year, url in years.items():
            dest_dir = RAW / topic / year
            dest_dir.mkdir(parents=True, exist_ok=True)
            resp = requests.get(url, timeout=300)
            resp.raise_for_status()
            members: dict[str, Path] = {}
            with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
                for name in zf.namelist():
                    base = Path(name).name
                    if not base.endswith(".csv") or base.endswith("_layout.csv"):
                        continue
                    if "_certified" not in base:
                        raise ValueError(f"{topic} {year}: unexpected CSV {base!r} "
                                         f"in {url}")
                    member = base.split("_certified")[0]
                    dest = dest_dir / base
                    dest.write_bytes(zf.read(name))
                    members[member] = dest
            if not members:
                raise ValueError(f"{topic} {year}: no data CSV found in {url}")
            out[topic][year] = members
            print(f"  {topic} {year}: {', '.join(sorted(members))}")
    return out


def load_districts() -> list[dict]:
    return json.loads((CONFIG / "districts.json").read_text(encoding="utf-8"))["districts"]


def build_name_map(enrollment_frames: dict[str, dict[str, pd.DataFrame]]) -> dict[str, str]:
    """dpi_code -> most recent DISTRICT_NAME, from every enrollment year in
    chronological order (later years win, so renamed/closed districts keep
    their last known name)."""
    names: dict[str, str] = {}
    for year in sorted(enrollment_frames):
        df = enrollment_frames[year]["enrollment"]
        dw = df[df["SCHOOL_NAME"] == "[Districtwide]"]
        names.update(zip(dw["DISTRICT_CODE"], dw["DISTRICT_NAME"]))
    return names


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

    print("Downloading", sum(len(y) for y in sources.FILES.values()), "files...")
    paths = download_all()
    frames = {
        topic: {year: {m: pd.read_csv(p, dtype=str) for m, p in members.items()}
                for year, members in years.items()}
        for topic, years in paths.items()
    }

    # Config cross-check against the most recent enrollment file: every
    # included district's (code, name) pair must exist exactly as configured.
    latest_enroll_year = max(frames["enrollment"])
    latest_enroll = frames["enrollment"][latest_enroll_year]["enrollment"]
    validate.check_district_codes_against_data(
        districts, latest_enroll, code_col="DISTRICT_CODE", name_col="DISTRICT_NAME")

    print("Normalizing...")
    generated = datetime.datetime.now(datetime.timezone.utc).isoformat()
    by_topic = {topic: normalize.BUILDERS[topic](frames) for topic in sources.TOPICS}

    names = build_name_map(frames["enrollment"])
    all_codes = sorted({code for result in by_topic.values() for code in result}
                       - {STATEWIDE_CODE})
    missing_names = [c for c in all_codes if c not in names]
    if missing_names:
        raise ValueError(
            f"Districts present in topic data but never in enrollment files "
            f"(no name available): {missing_names}")

    def assemble(code: str, name: str) -> dict:
        topics = {}
        for topic in sources.TOPICS:
            years = by_topic[topic].get(code)
            if years:
                topics[topic] = {y: years[y] for y in sorted(years)}
        return {
            "district": {"dpi_code": code, "dpi_name": name},
            "generated": generated,
            "topics": topics,
        }

    by_district = {code: assemble(code, names[code]) for code in all_codes}
    state = assemble(STATEWIDE_CODE, "[Statewide]")

    included = [d for d in districts if d["included"]]
    missing_docs = [d["label"] for d in included if d["dpi_code"] not in by_district]
    if missing_docs:
        raise ValueError(f"Included districts produced no data: {missing_docs}")
    index = {
        "generated": generated,
        "districts": [
            {"dpi_code": d["dpi_code"], "dpi_name": d["dpi_name"], "label": d["label"]}
            for d in included
        ],
    }

    print(f"Writing {len(by_district)} district files + state.json + index.json ...")
    write_output(by_district, index, state)
    print(f"Done. generated={generated}")


if __name__ == "__main__":
    main()
