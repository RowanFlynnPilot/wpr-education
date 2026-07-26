"""Registry of DPI WISEdash statewide download files.

Populate FILES from https://dpi.wi.gov/wisedash/public/download-files
(Files by Topic). Each entry maps a school year to the direct CSV URL for
that topic's statewide file. Note per-topic year availability in comments
as you discover it -- not every topic goes back to 2005-06.

refresh.py throws if any topic in TOPICS has an empty registry. There is
no partial refresh: either every topic downloads and validates, or the
run fails and data/ is untouched.
"""

TOPICS: list[str] = ["act", "graduation", "dropouts", "absenteeism", "enrollment"]

# topic -> {school_year -> direct CSV URL}
FILES: dict[str, dict[str, str]] = {
    "act": {
        # "2024-25": "https://dpi.wi.gov/sites/default/files/...csv",
    },
    "graduation": {},
    "dropouts": {},
    "absenteeism": {},
    "enrollment": {},
}
