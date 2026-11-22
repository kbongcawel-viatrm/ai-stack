#!/usr/bin/env python3
"""Render the Suricata assessment as a plain-text/Markdown report.

Replaces the HTML artifact: same stats.json + verdict fragment in,
self-contained Markdown out. The verdict fragment may be HTML (from
gen_verdict.py or the LLM) - tags are stripped to text.

Usage:
    render_text.py --stats stats.json --verdict verdict.html --out report.md
    render_text.py --stats stats.json --out report.md
"""

import argparse
import html
import json
import os
import re
from html.parser import HTMLParser


class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)

    def text(self):
        raw = "".join(self.parts)
        raw = html.unescape(raw)
        # tidy whitespace left behind by stripped tags
        raw = re.sub(r"[ \t]+", " ", raw)
        raw = re.sub(r"\n\s*\n+", "\n\n", raw)
        return raw.strip()


def fragment_to_text(frag: str) -> str:
    # give block/cell boundaries real text structure before parsing
    frag = re.sub(r"<li[^>]*>", "- ", frag)
    frag = re.sub(r"</?(h[1-6]|p|div|ul|ol|li|tr|table|thead|tbody|section)[^>]*>",
                  "\n", frag)
    frag = re.sub(r"</t[dh]>", " | ", frag)
    frag = re.sub(r"<br\s*/?>", "\n", frag)
    p = TextExtractor()
    p.feed(frag)
    return p.text()


def fmt(n):
    try:
        return f"{int(n):,}"
    except (TypeError, ValueError):
        return str(n)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stats", required=True)
    ap.add_argument("--verdict", help="verdict fragment (HTML or text)")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    with open(args.stats) as f:
        s = json.load(f)

    meta = s.get("meta", {})
    verdict_text = ""
    if args.verdict and os.path.exists(args.verdict):
        verdict_text = fragment_to_text(open(args.verdict).read())
    if not verdict_text:
        verdict_text = ("No analyst verdict supplied. Run gen_verdict.py or the "
                        "--llm path in daily_assess.sh.")

    totals = s.get("totals", {})
    total_events = sum(totals.values())
    alerts_total = s.get("alerts", {}).get("total_ex_noise")
    if alerts_total is None:
        alerts_total = sum(e["count"] for rows in s.get("event_types", {}).values()
                           for e in rows if e.get("event_type") == "alert")

    out = []
    out.append(f"# Suricata Security Assessment")
    out.append("")
    out.append(f"- **Window:** last {meta.get('window_hours', '?')}h "
               f"({meta.get('window_start', '?')} → {meta.get('window_end', '?')})")
    out.append(f"- **Streams:** {', '.join(meta.get('streams', []))}")
    out.append(f"- **Generated:** {meta.get('generated_at', '?')}")
    out.append("")
    out.append("## Verdict")
    out.append("")
    out.append(verdict_text)
    out.append("")

    # ---- traffic summary ----
    out.append("## Traffic summary")
    out.append("")
    out.append(f"- Total events: **{fmt(total_events)}**")
    out.append(f"- Alerts (excl. engine/info noise): **{fmt(alerts_total)}**")
    out.append("")
    out.append("| Stream | Events |")
    out.append("|---|---|")
    for stream, n in sorted(totals.items()):
        out.append(f"| {stream} | {fmt(n)} |")
    out.append("")

    et = s.get("event_types", {})
    if et:
        out.append("### Event types")
        out.append("")
        out.append("| Sensor | Type | Count |")
        out.append("|---|---|---|")
        for sensor, rows in et.items():
            for e in sorted(rows, key=lambda x: -x.get("count", 0))[:10]:
                out.append(f"| {sensor} | {e.get('event_type')} | {fmt(e.get('count'))} |")
        out.append("")

    # ---- top talkers ----
    flagged = [i for i in s.get("top_src_ips", [])
               if i.get("classification") and i["classification"] != "normal"]
    if flagged:
        out.append("## Flagged source IPs (behaviour heuristics)")
        out.append("")
        out.append("| IP | Sensor | Flows | Up | Down | Dests | Class |")
        out.append("|---|---|---|---|---|---|---|")
        for i in flagged[:20]:
            out.append(
                f"| `{i['ip']}` | {i.get('sensor','')} | {fmt(i.get('flows'))} "
                f"| {fmt(i.get('bytes_up'))} | {fmt(i.get('bytes_down'))} "
                f"| {fmt(i.get('unique_dests'))} | {i.get('classification')} |")
        out.append("")

    # ---- alerts ----
    sigs = s.get("alerts", {}).get("by_signature", [])[:10]
    if sigs:
        out.append("## Top alert signatures")
        out.append("")
        out.append("| Sensor | Signature | Count |")
        out.append("|---|---|---|")
        for x in sigs:
            out.append(f"| {x.get('sensor','')} | {x.get('signature','')} | {fmt(x.get('c'))} |")
        out.append("")

    # ---- enrichment ----
    cf = s.get("enrichment", {}).get("cloudflare", {})
    if cf:
        out.append("## Cloudflare auto-block correlation")
        out.append("")
        out.append(f"- Submitted: **{cf.get('submitted_count', 0)}** IPs")
        pend = cf.get("pending_action_ips", [])
        out.append(f"- Pending action: **{len(pend)}**"
                   + (f" — {', '.join('`'+p+'`' for p in pend[:15])}" if pend else ""))
        out.append("")

    arp = s.get("enrichment", {}).get("arpwatch", {})
    if arp:
        out.append("## arpwatch")
        out.append("")
        out.append(f"- Suspicious events in window: **{arp.get('suspicious_lines', 0)}**")
        d24 = arp.get("last_24h") or {}
        out.append(f"- Suspicious events last 24h: **{d24.get('suspicious_lines', 0)}**")
        tops = arp.get("top_ips") or d24.get("top_ips") or []
        if tops:
            out.append("")
            out.append("| IP | Events |")
            out.append("|---|---|")
            for r in tops[:10]:
                out.append(f"| `{r.get('ip')}` | {fmt(r.get('events'))} |")
        out.append("")

    dns = s.get("dns_top", [])[:10]
    if dns:
        out.append("## Top DNS queries")
        out.append("")
        out.append("| Sensor | Query | Count |")
        out.append("|---|---|---|")
        for d in dns:
            out.append(f"| {d.get('sensor','')} | {d.get('q','')} | {fmt(d.get('c'))} |")
        out.append("")

    errs = s.get("errors", [])
    if errs:
        out.append("## Collection warnings")
        out.append("")
        for e in errs:
            out.append(f"- {e}")
        out.append("")

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w") as f:
        f.write("\n".join(out))
    print(f"wrote {args.out}")


if __name__ == "__main__":
    main()
