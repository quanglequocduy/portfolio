#!/usr/bin/env python3
"""Merge one week's sanitized summary into updates.json and re-render index.html.

Usage: render.py <repo_dir> <week.json>
week.json: {"week_of", "headline", "highlights": [...], "themes": [...],
            "merged", "reviewed", "repos", "total_merged"}
Exits 1 (and writes nothing) if any public text looks like internal data.
"""
import html
import json
import re
import sys
from pathlib import Path

KEEP = 6  # weeks rendered on the page; updates.json keeps full history
START, END = "<!-- WEEKLY:START -->", "<!-- WEEKLY:END -->"

# Anything matching these must never reach the public page.
LEAKS = [
    (r"\b[A-Z][A-Z0-9]{1,9}-\d+\b", "Jira key"),
    (r"hipagesgroup", "private org name"),
    (r"https?://|www\.", "link"),
    (r"[\w.+-]+@[\w-]+\.", "email"),
    (r"[$€£]\s?\d", "money figure"),
    (r"\bPR\s?#?\d+|#\d{2,}", "PR number"),
]


def leaks(week):
    text = " ".join([week["headline"], *week["highlights"], *week["themes"]])
    return [label for pat, label in LEAKS if re.search(pat, text)]


def merge(history, week):
    history = [w for w in history if w["week_of"] != week["week_of"]]
    return sorted(history + [week], key=lambda w: w["week_of"], reverse=True)


def render(history):
    e = html.escape
    latest, older = history[0], history[1:KEEP]
    lis = "".join(f"\n              <li>{e(h)}</li>" for h in latest["highlights"])
    chips = "".join(f'<span class="chip">{e(t)}</span>' for t in latest["themes"])
    log = "".join(
        f'\n          <li><time datetime="{e(w["week_of"])}">{e(w["week_of"])}</time>'
        f' <span>{e(w["headline"])}</span></li>'
        for w in older
    )
    log_html = f'\n        <ul class="week-log reveal">{log}\n        </ul>' if older else ""
    return f"""{START}
        <div class="section-head reveal">
          <span class="kicker">Now shipping &middot; auto-updated weekly</span>
          <h2>{e(latest["headline"])}</h2>
          <p>Week of <time datetime="{e(latest["week_of"])}">{e(latest["week_of"])}</time> &mdash;
             <b>{latest["merged"]}</b> PRs merged across <b>{latest["repos"]}</b> repos,
             <b>{latest["reviewed"]}</b> PRs reviewed.</p>
        </div>
        <article class="project reveal">
            <ul>{lis}
            </ul>
            <div class="chips">{chips}</div>
        </article>{log_html}
        {END}"""


def update_page(page, history):
    pre, rest = page.split(START, 1)
    _, post = rest.split(END, 1)
    page = pre + render(history) + post
    total = history[0].get("total_merged")
    if total:  # keep the hero "Merged PRs" stat current, rounded down to 10
        n = total // 10 * 10
        page = re.sub(
            r'data-count="\d+" data-suffix="\+">\d+\+(</div>\s*<div class="label">Merged PRs)',
            f'data-count="{n}" data-suffix="+">{n}+\\1', page)
    return page


def main(repo, week_file):
    repo = Path(repo)
    week = json.loads(Path(week_file).read_text())
    found = leaks(week)
    if found:
        sys.exit(f"refusing to publish, possible leak: {', '.join(found)}")
    data_file = repo / "updates.json"
    history = json.loads(data_file.read_text()) if data_file.exists() else []
    history = merge(history, week)
    index = repo / "index.html"
    index.write_text(update_page(index.read_text(), history))
    data_file.write_text(json.dumps(history, indent=2, ensure_ascii=False) + "\n")


def selftest():
    w = {"week_of": "2026-10-04", "headline": "Scaled AI pricing <fast>",
         "highlights": ["Enrolled 34 more clusters"], "themes": ["AI pricing"],
         "merged": 5, "reviewed": 3, "repos": 2, "total_merged": 774}
    assert leaks(w) == []
    assert leaks({**w, "headline": "Fix MC-229"}) == ["Jira key"]
    assert leaks({**w, "themes": ["https://github.com/hipagesgroup/x"]})
    h = merge([{**w, "headline": "old"}], w)
    assert len(h) == 1 and h[0]["headline"] == w["headline"]
    page = (f'x{START}stale{END}y <div class="num" data-count="720" data-suffix="+">720+</div>\n'
            f'            <div class="label">Merged PRs across 20+ repos</div>')
    out = update_page(page, h)
    assert "stale" not in out and "&lt;fast&gt;" in out and 'data-count="770"' in out
    assert out.startswith("x") and "y <div" in out
    print("ok")


if __name__ == "__main__":
    selftest() if sys.argv[1:] == ["--selftest"] else main(*sys.argv[1:3])
