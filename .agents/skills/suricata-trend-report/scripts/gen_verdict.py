#!/usr/bin/env python3
"""Deterministic verdict generator for the suricata-trend-report skill.

Reads stats.json (from collect_stats.py) and writes verdict.html — an HTML
fragment with a situation summary, per-IP highlights, and an ACTION REQUIRED /
MONITOR / NO ACTION recommendation. Zero model dependency; used as the
default verdict path and as fallback when the Ollama analyst is unavailable.

Usage:
    python3 gen_verdict.py --stats stats.json --out verdict.html
"""

import argparse
import html
import ipaddress
import json


def esc(s):
    return html.escape(str(s), quote=True)


def is_public(ip):
    try:
        return ipaddress.ip_address(ip).is_global
    except ValueError:
        return False


# Suspicious ARP events below this count in the window are noted but don't
# force ACTION REQUIRED (occasional flip-flops are normal on busy LANs).
ARP_ACTION_MIN = 10


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stats", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    s = json.load(open(args.stats))
    meta = s["meta"]
    totals = s.get("totals", {})
    total_events = sum(totals.values())
    # Prefer the noise-filtered alert total; fall back to raw event_types.
    alerts = s.get("alerts", {}).get("total_ex_noise")
    if alerts is None:
        alerts = sum(e["count"] for rows in s.get("event_types", {}).values()
                     for e in rows if e.get("event_type") == "alert")
    flagged = [i for i in s.get("top_src_ips", [])
               if i.get("classification") and i["classification"] != "normal"]
    cf = s.get("enrichment", {}).get("cloudflare", {})
    pending = cf.get("pending_action_ips", [])
    submitted = cf.get("submitted_count", 0)
    arp = s.get("enrichment", {}).get("arpwatch", {})
    arp_events = arp.get("suspicious_lines", 0)

    # alert trend: split hourly alert buckets in half, compare
    trend = "stable"
    for key in ("ips_alerts", "ids_alerts"):
        rows = s.get("timeseries", {}).get(key, [])
        if len(rows) >= 4:
            half = len(rows) // 2
            first = sum(r["c"] for r in rows[:half])
            second = sum(r["c"] for r in rows[half:])
            if first and second / first > 1.5:
                trend = "rising"
            elif first and second / first < 0.67:
                trend = "falling"

    # --- recommendation logic ---
    # Only globally-routable IPs can be Cloudflare-blocked or be real external
    # threats; private/ULA flagged IPs are usually normal LAN chatter.
    public_flagged = [i for i in flagged if is_public(i["ip"])]
    private_flagged = [i for i in flagged if not is_public(i["ip"])]
    public_exfil = [i for i in public_flagged if "exfil-suspect" in i["classification"]]

    reasons = []
    if pending:
        reasons.append(f"{len(pending)} public flagged IPs are not yet Cloudflare-blocked")
    if public_exfil:
        reasons.append(f"{len(public_exfil)} public IPs show exfil-suspect behaviour")
    if arp_events >= ARP_ACTION_MIN:
        reasons.append(f"{arp_events} suspicious ARP events")
    if alerts > 0 and trend == "rising":
        reasons.append("alert volume is rising through the window")

    if pending or public_exfil or arp_events >= ARP_ACTION_MIN:
        verdict = "ACTION REQUIRED"
    elif reasons or private_flagged or alerts > total_events * 0.2:
        verdict = "MONITOR"
    else:
        verdict = "NO ACTION"

    out = []
    out.append(f"<h3>Situation summary</h3>")
    out.append(
        f"<p>Last {meta.get('window_hours', '?')}h across "
        f"{', '.join(meta.get('streams', []))}: <b>{total_events:,}</b> events, "
        f"<b>{alerts:,}</b> alerts. Alert trend: <b>{trend}</b>. "
        f"{len(flagged)} of the top talkers show non-normal behaviour "
        f"(scanner / exfil / beacon heuristics).</p>")

    out.append("<h3>Key observations</h3><ul>")
    if public_flagged:
        out.append("<li>Flagged <b>public</b> IPs: " + ", ".join(
            f"<code>{esc(i['ip'])}</code> ({esc(i['classification'])})"
            for i in public_flagged[:5]) + "</li>")
    if private_flagged:
        out.append(f"<li>{len(private_flagged)} internal/LAN IPs tripped heuristics "
                   "(likely normal chatter — review only if unexpected): "
                   + ", ".join(f"<code>{esc(i['ip'])}</code>"
                               for i in private_flagged[:5]) + "</li>")
    if not flagged:
        out.append("<li>No source IPs tripped the behaviour heuristics.</li>")
    sigs = s.get("alerts", {}).get("by_signature", [])[:3]
    if sigs:
        out.append("<li>Top alert signatures: " + ", ".join(
            f"{esc(x['signature'])} ({x['c']:,})" for x in sigs) + "</li>")
    if trend != "stable":
        out.append(f"<li>Alert volume is {trend} across the window.</li>")
    out.append("</ul>")

    out.append("<h3>Per-IP highlights</h3>")
    if flagged:
        out.append("<table><thead><tr><th>IP</th><th>Sensor</th><th>Flows</th>"
                   "<th>Up</th><th>Down</th><th>Dests</th><th>Class</th>"
                   "<th>CF status</th></tr></thead><tbody>")
        sub = set(cf.get("submitted_ips", []))
        for i in flagged[:15]:
            status = ("blocked" if i["ip"] in sub else
                      "PENDING" if i["ip"] in set(pending) else "not submitted")
            out.append(
                f"<tr><td><code>{esc(i['ip'])}</code></td><td>{esc(i['sensor'])}</td>"
                f"<td>{i['flows']:,}</td><td>{i['bytes_up']:,}</td>"
                f"<td>{i['bytes_down']:,}</td><td>{i['unique_dests']:,}</td>"
                f"<td>{esc(i['classification'])}</td>"
                f"<td style='color:{'#3fb950' if status=='blocked' else '#f85149'}'>"
                f"{status}</td></tr>")
        out.append("</tbody></table>")
    else:
        out.append("<p>No flagged IPs in the top talkers.</p>")

    out.append("<h3>Automated response status</h3><ul>")
    out.append(f"<li>Cloudflare auto-block: <b>{submitted}</b> IPs submitted; "
               f"<b>{len(pending)}</b> flagged IPs pending action.</li>")
    out.append(f"<li>arpwatch: <b>{arp_events}</b> suspicious ARP events"
               + (" — verify affected MAC/IP pairs." if arp_events else ".") + "</li>")
    out.append("</ul>")

    out.append("<h3>Recommendation</h3>")
    color = {"ACTION REQUIRED": "#f85149", "MONITOR": "#d29922",
             "NO ACTION": "#3fb950"}[verdict]
    out.append(f"<p><b style='color:{color}'>{verdict}</b></p>")
    if reasons:
        out.append("<ul>" + "".join(f"<li>{esc(r)}</li>" for r in reasons) + "</ul>")
    out.append("<p><em>Generated deterministically from aggregated OpenObserve "
               "statistics — no LLM involved. Review flagged IPs in the HTML "
               "report and the 'Suricata Security Overview' dashboard.</em></p>")

    with open(args.out, "w") as f:
        f.write("\n".join(out) + "\n")
    print(f"wrote {args.out}  verdict={verdict}")


if __name__ == "__main__":
    main()
