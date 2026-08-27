"""Full refresh: download statewide DPI files, validate, rebuild data/ from scratch.

Run twice a year (fall: assessments; spring: WISEdata topics). Re-pulls ALL
years every run because DPI publishes errata after initial publication.
Review the resulting git diff of data/ -- unexpected changes to prior years
are errata, and possibly a story.

Usage (from repo root):
    python pipeline/refresh.py

Development only: --reuse-raw rebuilds data/ from the previous run's
pipeline/raw/ download cache without re-downloading. NEVER use it for a
real refresh — the point of a refresh is picking up DPI's errata, and a
cached build can silently ship stale data. The flag exists for iterating
on normalize.py.
"""

import argparse
import datetime
import io
import json
import re
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


def download_all() -> dict[str, dict[str, dict[str, list[Path]]]]:
    """Download every registered ZIP fresh and extract its data CSVs.
    Returns topic -> {year -> {member -> [csv paths]}} where member is the
    CSV filename prefix before '_certified'. Most ZIPs yield one CSV per
    member; the attendance_dropouts ZIPs carry two members, and newer
    forward ZIPs split ONE member across two CSVs (ELA_RDG_WRT +
    MTH_SCN_SOC) that get concatenated at load time. Layout dictionaries
    and disclaimers are not extracted."""
    if RAW.exists():
        shutil.rmtree(RAW)
    out: dict[str, dict[str, dict[str, list[Path]]]] = {}
    for topic, years in sources.FILES.items():
        out[topic] = {}
        for year, url in years.items():
            dest_dir = RAW / topic / year
            dest_dir.mkdir(parents=True, exist_ok=True)
            resp = requests.get(url, timeout=300)
            resp.raise_for_status()
            members: dict[str, list[Path]] = {}
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
                    members.setdefault(member, []).append(dest)
            if not members:
                raise ValueError(f"{topic} {year}: no data CSV found in {url}")
            out[topic][year] = members
            print(f"  {topic} {year}: {', '.join(sorted(members))}")
    return out


def load_from_raw() -> dict[str, dict[str, dict[str, list[Path]]]]:
    """Dev-only: reuse the previous run's extracted CSVs instead of
    downloading. Fails fast if the cache is missing any registered file."""
    out: dict[str, dict[str, dict[str, list[Path]]]] = {}
    for topic, years in sources.FILES.items():
        out[topic] = {}
        for year in years:
            year_dir = RAW / topic / year
            members: dict[str, list[Path]] = {}
            for p in sorted(year_dir.glob("*.csv")):
                members.setdefault(p.name.split("_certified")[0], []).append(p)
            if not members:
                raise ValueError(
                    f"--reuse-raw: no cached CSVs for {topic} {year} under {year_dir}. "
                    "Run a real refresh first.")
            out[topic][year] = members
    return out


def _read_member(topic: str, year: str, member: str, paths: list[Path]) -> pd.DataFrame:
    """One frame per member. Multi-CSV members (forward's subject split)
    concatenate — but only when the pieces agree on columns; a silent
    union of mismatched headers would corrupt every downstream selection.
    Topics with a LOAD_PRUNE are read in chunks and pruned per chunk so
    the unpruned file never sits in memory whole."""
    prune = normalize.LOAD_PRUNES.get(topic)
    dfs = []
    for p in paths:
        if prune is None:
            dfs.append(pd.read_csv(p, dtype=str))
        else:
            with pd.read_csv(p, dtype=str, chunksize=200_000) as reader:
                pruned = [prune(chunk) for chunk in reader]
            dfs.append(pd.concat(pruned, ignore_index=True))
    cols = {tuple(df.columns) for df in dfs}
    if len(cols) > 1:
        raise ValueError(
            f"{topic} {year} member '{member}': CSVs disagree on columns; "
            f"refusing to concatenate {[p.name for p in paths]}")
    return dfs[0] if len(dfs) == 1 else pd.concat(dfs, ignore_index=True)


class FrameStore:
    """Lazy {topic: {year: {member: frame}}} loader over the extracted CSV
    paths. The full corpus (122 files; forward's run ~1M rows per year
    unpruned) does not fit in memory at once, so topics load on first
    access and are released once no later consumer needs them. District
    names are learned from every topic as it loads (the pruned rows never
    remove [Districtwide] rows), composed with enrollment last so its
    naming wins — non-enrollment topics matter for real: a few
    non-district charter agencies (e.g. Tenor High School 8115) appear in
    absenteeism/ACT files but never have a districtwide enrollment row."""

    def __init__(self, paths: dict[str, dict[str, dict[str, list[Path]]]]):
        self._paths = paths
        self._cache: dict[str, dict] = {}
        self._names_by_topic: dict[str, dict[str, str]] = {}

    def __getitem__(self, topic: str) -> dict:
        if topic not in self._cache:
            self._cache[topic] = {
                year: {m: _read_member(topic, year, m, ps) for m, ps in members.items()}
                for year, members in self._paths[topic].items()
            }
            names: dict[str, str] = {}
            for year in sorted(self._cache[topic]):
                for df in self._cache[topic][year].values():
                    dw = df[df["SCHOOL_NAME"] == "[Districtwide]"]
                    names.update(zip(dw["DISTRICT_CODE"], dw["DISTRICT_NAME"]))
            self._names_by_topic[topic] = names
        return self._cache[topic]

    def release(self, topic: str) -> None:
        """Drop a topic's frames (the learned names survive)."""
        self._cache.pop(topic, None)

    def name_map(self) -> dict[str, str]:
        names: dict[str, str] = {}
        for topic in sorted(self._names_by_topic, key=lambda t: (t == "enrollment", t)):
            names.update(self._names_by_topic[topic])
        return names


def download_xlsx() -> dict[str, dict[str, Path]]:
    """Download the non-WISEdash xlsx sources (sources.XLSX_FILES) into
    raw/xlsx/. Returns topic -> {year -> path}."""
    out: dict[str, dict[str, Path]] = {}
    for topic, years in sources.XLSX_FILES.items():
        out[topic] = {}
        for year, url in years.items():
            dest_dir = RAW / "xlsx" / topic
            dest_dir.mkdir(parents=True, exist_ok=True)
            resp = requests.get(url, timeout=300)
            resp.raise_for_status()
            dest = dest_dir / f"{year}.xlsx"
            dest.write_bytes(resp.content)
            out[topic][year] = dest
            print(f"  {topic} {year}: {dest.name}")
    return out


def load_xlsx_from_raw() -> dict[str, dict[str, Path]]:
    out: dict[str, dict[str, Path]] = {}
    for topic, years in sources.XLSX_FILES.items():
        out[topic] = {}
        for year in years:
            p = RAW / "xlsx" / topic / f"{year}.xlsx"
            if not p.exists():
                raise ValueError(f"--reuse-raw: no cached xlsx for {topic} {year} at {p}. "
                                 "Run a real refresh first.")
            out[topic][year] = p
    return out


def download_finance() -> tuple[dict[str, Path], str, Path]:
    """Download the SFS finance workbooks and the WiSFPR referenda JSON
    into raw/finance/. Returns (workbook paths, compcost end-year label,
    referenda json path). The compcost served filename embeds DPI's
    published audited range (…_to_2425_…) — parsed here as the cap on the
    cost series, failing fast if the naming convention changes."""
    dest_dir = RAW / "finance"
    dest_dir.mkdir(parents=True, exist_ok=True)
    paths: dict[str, Path] = {}
    compcost_end = None
    for name, url in sources.FINANCE_FILES.items():
        resp = requests.get(url, timeout=300)
        resp.raise_for_status()
        dest = dest_dir / f"{name}.xlsx"
        dest.write_bytes(resp.content)
        paths[name] = dest
        if name == "compcost":
            served = re.search(r'filename[^;]*?"?([\w.-]+\.xlsx)',
                               resp.headers.get("Content-Disposition", ""))
            m = re.search(r"to_(\d{2})(\d{2})", served.group(1)) if served else None
            if not m:
                raise ValueError(
                    "finance compcost: can't parse the audited end year from the "
                    f"served filename ({served.group(1) if served else 'none'}) — "
                    "verify DPI's published range and update the parser.")
            compcost_end = f"20{m.group(1)}-{m.group(2)}"
            (dest_dir / "compcost_end.txt").write_text(compcost_end, encoding="utf-8")
        print(f"  finance {name}: {dest.name}")
    resp = requests.post(
        sources.REFERENDA_ENDPOINT,
        data=sources.REFERENDA_BODY,
        headers={"Content-Type": "application/x-www-form-urlencoded",
                 "X-Requested-With": "XMLHttpRequest",
                 "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
        timeout=300)
    resp.raise_for_status()
    ref_path = dest_dir / "referenda.json"
    ref_path.write_bytes(resp.content)
    print(f"  finance referenda: {len(resp.content) // 1024} KB")
    return paths, compcost_end, ref_path


def load_finance_from_raw() -> tuple[dict[str, Path], str, Path]:
    dest_dir = RAW / "finance"
    paths = {name: dest_dir / f"{name}.xlsx" for name in sources.FINANCE_FILES}
    end_file = dest_dir / "compcost_end.txt"
    ref_path = dest_dir / "referenda.json"
    missing = [p for p in [*paths.values(), end_file, ref_path] if not p.exists()]
    if missing:
        raise ValueError(f"--reuse-raw: missing cached finance files: {missing}. "
                         "Run a real refresh first.")
    return paths, end_file.read_text(encoding="utf-8").strip(), ref_path


def load_districts() -> list[dict]:
    return json.loads((CONFIG / "districts.json").read_text(encoding="utf-8"))["districts"]


def write_output(by_district: dict[str, dict], index: dict, state: dict,
                 subgroup_docs: dict[str, dict], school_docs: dict[str, dict],
                 referenda_docs: dict[str, dict]) -> None:
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

    subgroups_dir = DATA / "subgroups"
    if subgroups_dir.exists():
        shutil.rmtree(subgroups_dir)
    subgroups_dir.mkdir(parents=True)
    for code, doc in subgroup_docs.items():
        path = subgroups_dir / f"{code}.json"
        path.write_text(json.dumps(doc, indent=2), encoding="utf-8")
        validate.check_subgroup_file(path)

    schools_dir = DATA / "schools"
    if schools_dir.exists():
        shutil.rmtree(schools_dir)
    schools_dir.mkdir(parents=True)
    for code, doc in school_docs.items():
        path = schools_dir / f"{code}.json"
        path.write_text(json.dumps(doc, indent=2), encoding="utf-8")
        validate.check_school_file(path)

    referenda_dir = DATA / "referenda"
    if referenda_dir.exists():
        shutil.rmtree(referenda_dir)
    referenda_dir.mkdir(parents=True)
    for code, doc in referenda_docs.items():
        path = referenda_dir / f"{code}.json"
        path.write_text(json.dumps(doc, indent=2), encoding="utf-8")
        validate.check_referenda_file(path)

    (DATA / "index.json").write_text(json.dumps(index, indent=2), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reuse-raw", action="store_true",
                        help="DEV ONLY: rebuild from pipeline/raw/ without downloading")
    args = parser.parse_args()

    validate.check_sources_populated(sources.TOPICS, sources.FILES)
    validate.check_sources_populated(list(sources.XLSX_FILES), sources.XLSX_FILES)
    districts = load_districts()
    validate.check_district_config(districts)

    if args.reuse_raw:
        print("WARNING: --reuse-raw rebuilds from the cached download — this is "
              "NOT a refresh and can ship stale data. Dev use only.")
        paths = load_from_raw()
        xlsx_paths = load_xlsx_from_raw()
        finance_paths, compcost_end, referenda_path = load_finance_from_raw()
    else:
        print("Downloading", sum(len(y) for y in sources.FILES.values()), "files...")
        paths = download_all()  # wipes RAW first — xlsx downloads must follow
        print("Downloading", sum(len(y) for y in sources.XLSX_FILES.values()), "xlsx files...")
        xlsx_paths = download_xlsx()
        print("Downloading finance workbooks + referenda...")
        finance_paths, compcost_end, referenda_path = download_finance()
    frames = FrameStore(paths)

    # Config cross-check against the most recent enrollment file: every
    # included district's (code, name) pair must exist exactly as configured.
    # (Loads enrollment early; it stays cached — it is also the last topic
    # processed, so releasing and re-reading would buy nothing.)
    latest_enroll_year = max(frames["enrollment"])
    latest_enroll = frames["enrollment"][latest_enroll_year]["enrollment"]
    validate.check_district_codes_against_data(
        districts, latest_enroll, code_col="DISTRICT_CODE", name_col="DISTRICT_NAME")

    # Subgroups for every config district (included or not, so flipping a
    # candidate stays a pure config edit) plus statewide. All 507 districts
    # would grow the repo ~10x for pages nobody can route to.
    generated = datetime.datetime.now(datetime.timezone.utc).isoformat()
    subgroup_codes = {d["dpi_code"] for d in districts} | {STATEWIDE_CODE}

    # Schools for the same config districts (statewide excluded — its
    # "schools" would be every school in Wisconsin).
    school_district_codes = subgroup_codes - {STATEWIDE_CODE}

    # One topic at a time, releasing source frames no later topic needs —
    # peak memory is one big topic plus enrollment, not the whole corpus.
    by_topic: dict[str, dict] = {}
    subgroups_by_topic: dict[str, dict] = {}
    schools_by_topic: dict[str, dict] = {}
    for i, topic in enumerate(sources.TOPICS):
        print(f"Normalizing {topic}...")
        by_topic[topic] = normalize.BUILDERS[topic](frames)
        subgroups_by_topic[topic] = normalize.SUBGROUP_BUILDERS[topic](frames, subgroup_codes)
        schools_by_topic[topic] = normalize.SCHOOL_BUILDERS[topic](frames, school_district_codes)
        still_needed = set().union(
            *(normalize.source_topics(t) for t in sources.TOPICS[i + 1:]), set())
        for src in normalize.source_topics(topic) - still_needed:
            frames.release(src)

    # Non-WISEdash xlsx topics: district-level only (no statewide row in
    # the files, no subgroup or school breakdowns published).
    print("Normalizing open_enrollment...")
    by_topic["open_enrollment"] = normalize.build_open_enrollment(
        xlsx_paths["open_enrollment"])
    subgroups_by_topic["open_enrollment"] = {}
    schools_by_topic["open_enrollment"] = {}

    print("Normalizing finance...")
    by_topic["finance"], finance_names = normalize.build_finance(
        finance_paths, compcost_end)
    subgroups_by_topic["finance"] = {}
    schools_by_topic["finance"] = {}

    print("Normalizing referenda...")
    referenda_by_code = normalize.build_referenda(
        json.loads(referenda_path.read_text(encoding="utf-8")),
        subgroup_codes - {STATEWIDE_CODE})

    # WISEdash names win; finance-workbook names only fill in districts
    # dissolved before the WISEdash files begin (2005-06).
    names = {**finance_names, **frames.name_map()}
    all_codes = sorted({code for result in by_topic.values() for code in result}
                       - {STATEWIDE_CODE})
    missing_names = [c for c in all_codes if c not in names]
    if missing_names:
        raise ValueError(
            f"Districts present in topic data with no districtwide name row "
            f"in any file: {missing_names}")

    def assemble(code: str, name: str) -> dict:
        topics = {}
        for topic in sources.ALL_TOPICS:
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

    def assemble_subgroups(code: str, name: str) -> dict:
        topics = {}
        for topic in sources.ALL_TOPICS:
            years = subgroups_by_topic[topic].get(code)
            if years:
                topics[topic] = {y: years[y] for y in sorted(years)}
        return {
            "district": {"dpi_code": code, "dpi_name": name},
            "generated": generated,
            "topics": topics,
        }

    subgroup_docs = {
        code: assemble_subgroups(code, names.get(code, "[Statewide]"))
        for code in sorted(subgroup_codes)
    }

    def assemble_schools(code: str, name: str) -> dict:
        """Merge per-topic school builds into one per-district file. Topics
        iterate in sources.TOPICS order with enrollment last, so its
        school naming/type wins where files disagree (name drift)."""
        schools: dict[str, dict] = {}
        for topic in sources.ALL_TOPICS:
            for scode, entry in schools_by_topic[topic].get(code, {}).items():
                school = schools.setdefault(
                    scode, {"name": entry["name"], "type": entry["type"], "topics": {}})
                school["name"] = entry["name"]
                school["type"] = entry["type"]
                school["topics"][topic] = {
                    y: entry["years"][y] for y in sorted(entry["years"])}
        return {
            "district": {"dpi_code": code, "dpi_name": name},
            "generated": generated,
            "schools": schools,
        }

    school_docs = {
        code: assemble_schools(code, names[code])
        for code in sorted(school_district_codes)
        if any(code in schools_by_topic[t] for t in sources.TOPICS)
    }

    # Lightweight school roster inside each config district's own doc, so
    # the district page can render its schools nav without fetching the
    # full (metric-laden) data/schools file.
    for code, sdoc in school_docs.items():
        if code in by_district:
            by_district[code]["schools"] = {
                scode: {
                    "name": s["name"],
                    "type": s["type"],
                    "last_year": max(y for years in s["topics"].values() for y in years),
                }
                for scode, s in sdoc["schools"].items()
            }

    referenda_docs = {
        code: {
            "district": {"dpi_code": code, "dpi_name": names[code]},
            "generated": generated,
            "referenda": events,
        }
        for code, events in sorted(referenda_by_code.items())
    }

    included = [d for d in districts if d["included"]]
    missing_docs = [d["label"] for d in included if d["dpi_code"] not in by_district]
    if missing_docs:
        raise ValueError(f"Included districts produced no data: {missing_docs}")

    def latest_cell(code: str, topic: str, metric: str):
        """Newest {year, value, suppressed} for one metric, or None."""
        years = by_topic[topic].get(code, {})
        have = sorted(y for y in years if metric in years[y])
        if not have:
            return None
        year = have[-1]
        cell = years[year][metric]
        return {"year": year, "value": cell["value"], "suppressed": cell["suppressed"]}

    def summarize(code: str) -> dict:
        """Landing-page summary so the frontend can render district cards
        without fetching every district file (47 districts would be ~1.5MB
        up front; this keeps the landing to index.json + state.json)."""
        enroll_years = by_topic["enrollment"].get(code, {})
        trend = {
            y: (None if m["total_enrollment"]["suppressed"] else m["total_enrollment"]["value"])
            for y, m in sorted(enroll_years.items()) if "total_enrollment" in m
        }
        return {
            "enrollment_trend": trend,
            "latest": {
                metric: latest_cell(code, topic, metric)
                for topic, metric in [
                    ("enrollment", "total_enrollment"),
                    ("act", "composite_avg"),
                    ("graduation", "grad_rate_4yr"),
                    ("absenteeism", "chronic_absenteeism_rate"),
                ]
            },
        }

    index = {
        "generated": generated,
        "districts": [
            {"dpi_code": d["dpi_code"], "dpi_name": d["dpi_name"],
             "label": d["label"], "county": d["county"],
             "summary": summarize(d["dpi_code"])}
            for d in included
        ],
    }

    print(f"Writing {len(by_district)} district files + {len(subgroup_docs)} "
          f"subgroup files + {len(school_docs)} school files + "
          f"{len(referenda_docs)} referenda files + state.json + index.json ...")
    write_output(by_district, index, state, subgroup_docs, school_docs,
                 referenda_docs)
    print(f"Done. generated={generated}")


if __name__ == "__main__":
    main()
