#!/usr/bin/env python3
"""Render the Suricata assessment HTML report.

Usage:
    render_report.py --stats stats.json --verdict verdict.html --out report.html
    render_report.py --stats stats.json --out report.html   # placeholder verdict
"""

import argparse
import json
import os
import sys

TEMPLATE = os.path.join(os.path.dirname(__file__), "..", "assets", "report_template.html")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stats", required=True)
    ap.add_argument("--verdict", help="HTML fragment with the analyst verdict")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    with open(args.stats) as f:
        stats = json.load(f)

    verdict = ""
    if args.verdict and os.path.exists(args.verdict):
        with open(args.verdict) as f:
            verdict = f.read()
    if not verdict.strip():
        verdict = ("<p><em>No analyst verdict supplied. Run the Ollama analyst step "
                   "(<code>ollama/daily_assess.sh</code>) or write verdict.html manually.</em></p>")

    meta = stats.get("meta", {})
    window = f"last {meta.get('window_hours', '?')}h ({meta.get('window_start','?')} → {meta.get('window_end','?')})"

    with open(TEMPLATE) as f:
        html = f.read()
    html = (html
            .replace("__WINDOW__", window)
            .replace("__GENERATED__", meta.get("generated_at", "?"))
            .replace("__STREAMS__", ", ".join(meta.get("streams", [])))
            .replace("__VERDICT_HTML__", verdict)
            .replace("__STATS_JSON__", json.dumps(stats)))

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w") as f:
        f.write(html)
    print(f"wrote {args.out}")


if __name__ == "__main__":
    main()
