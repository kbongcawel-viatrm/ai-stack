#!/usr/bin/env python3
"""Security assessor for the suricata-trend-report skill.

Produces a CONCLUSION, not a score. For each notable subject (flagged IP,
arpwatch offender, corroborated LLM finding) it emits a verdict class with
a written justification citing the evidence, then resolves the overall
assessment as the most severe subject conclusion.

Conclusion classes (per subject):
  HOSTILE     high-confidence malicious activity — act
  SUSPICIOUS  evidence suggests possible compromise — investigate
  ANOMALOUS   unusual but plausibly explainable — review optional
  NOMINAL     expected traffic — no action

Overall verdict = most severe subject conclusion, with NO DATA when the
collection window is empty (never confused with a clean bill of health).

The LLM never decides: --findings supplies observations only. A finding
counts toward a subject's conclusion only when its IP appears in stats.json;
class A can raise a subject to SUSPICIOUS, never to HOSTILE alone.

Usage:
    assess.py --stats stats.json [--findings findings.json] \
              --assessment assessment.json --verdict verdict.md
"""

import argparse
import ipaddress
import json
import os


def is_public(ip):
    try:
        return ipaddress.ip_address(ip).is_global
    except ValueError:
        return False


def load_context(stats, findings):
    """Collect the evidence subjects are assessed against."""
    totals = stats.get("totals", {})
    alerts = stats.get("alerts", {}).get("total_ex_noise")
    if alerts is None:
        alerts = sum(e["count"] for rows in stats.get("event_types", {}).values()
                     for e in rows if e.get("event_type") == "alert")

    enrichment = stats.get("enrichment", {})
    cf = enrichment.get("cloudflare", {})
    arp = enrichment.get("arpwatch", {})
    agentic = enrichment.get("agentic", {})

    # IPs that actually generated alert events (alert-backed evidence)
    alert_ips = set(cf.get("alert_src_ips", []))
    pending = set(cf.get("pending_action_ips", []))
    submitted = set(cf.get("submitted_ips", []))

    # agentic-pipeline evidence: published IOC feed hits + TD-rule alerts
    ioc_hits = set(agentic.get("ioc_ip_hits", []))
    agentic_src = {r["src_ip"]: r.get("c", 0)
                   for r in stats.get("alerts", {}).get(
                       "agentic_by_src_ip", []) if r.get("src_ip")}
    # per-IP alert counts (all alert sources, not just top talkers)
    alert_counts = {}
    for r in stats.get("alerts", {}).get("by_src_ip", []):
        if r.get("src_ip"):
            alert_counts[r["src_ip"]] = alert_counts.get(r["src_ip"], 0) + r.get("c", 0)

    # corroborate LLM findings against observed IPs
    known_ips = {i["ip"] for i in stats.get("top_src_ips", [])}
    known_ips |= {i["ip"] for i in stats.get("top_dst_ips", [])}
    known_ips |= alert_ips
    corroborated, rejected = [], []
    for f in (findings or {}).get("findings", []):
        if not isinstance(f, dict):
            continue
        ip = str(f.get("ip", ""))
        cls = str(f.get("class", "")).upper()
        if cls in ("A", "B") and ip in known_ips:
            corroborated.append({**f, "ip": ip, "class": cls})
        else:
            rejected.append({
                "ip": ip, "class": cls,
                "reason": "IP not present in collected stats"
                          if ip not in known_ips
                          else f"class {cls or '?'} carries no weight"})

    return {
        "total_events": sum(totals.values()),
        "alerts": alerts,
        "alert_ips": alert_ips,
        "cf_pending": pending,
        "cf_submitted": submitted,
        "arp": arp,
        "llm_corroborated": corroborated,
        "llm_rejected": rejected,
        "llm_narrative": (findings or {}).get("narrative"),
        "agentic": agentic,
        "ioc_hits": ioc_hits,
        "agentic_src": agentic_src,
        "alert_counts": alert_counts,
    }


SEVERITY = {"NOMINAL": 0, "ANOMALOUS": 1, "SUSPICIOUS": 2, "HOSTILE": 3}
RANK = {v: k for k, v in SEVERITY.items()}


def fmt(n):
    try:
        return f"{int(n):,}"
    except (TypeError, ValueError):
        return str(n)


def assess_ip(ip_stats, ctx):
    """Return {subject, kind, conclusion, justification, evidence} for one IP."""
    ip = ip_stats["ip"]
    labels = [l for l in ip_stats.get("classification", "").split(",") if l]
    public = is_public(ip)
    alert_backed = ip in ctx["alert_ips"]
    cf_pending = ip in ctx["cf_pending"]
    cf_blocked = ip in ctx["cf_submitted"]
    ioc_match = ip_stats.get("ioc_match") or ip in ctx["ioc_hits"]
    agentic_alerts = ctx["agentic_src"].get(ip, 0)
    agentic_backed = ioc_match or agentic_alerts > 0

    flows = ip_stats.get("flows") or 0
    answered = ip_stats.get("answered_flows") or 0
    resp_pct = round(100 * answered / flows) if flows else 0

    ev = {
        "flows": flows,
        "answered_flows": answered,
        "response_pct": resp_pct,
        "bytes_up": ip_stats.get("bytes_up"),
        "bytes_down": ip_stats.get("bytes_down"),
        "unique_dests": ip_stats.get("unique_dests"),
        "unique_ports": ip_stats.get("unique_ports"),
        "top_dest_flows": ip_stats.get("top_dest_flows"),
        "avg_flow_bytes": ip_stats.get("avg_flow_bytes"),
        "classification": ip_stats.get("classification"),
        "alert_backed": alert_backed,
        "cf_pending": cf_pending,
        "cf_blocked": cf_blocked,
        "ioc_match": ioc_match,
        "agentic_alerts": agentic_alerts,
    }

    # --- private/LAN addresses can never be external threats -------------
    if not public:
        if "exfil-suspect" in labels:
            return {"subject": ip, "kind": "ip", "conclusion": "ANOMALOUS",
                    "justification": (
                        f"Low-confidence assessment: internal address moved "
                        f"{fmt(ip_stats.get('bytes_up'))} bytes upstream across "
                        f"{flows} flows. Most likely a LAN system process "
                        "(backup, update push, or sync) — or possibly "
                        "lateral movement. Not externally routable; no "
                        "Cloudflare action applies."),
                    "evidence": ev}
        return {"subject": ip, "kind": "ip", "conclusion": "ANOMALOUS",
                "justification": (
                    f"Low-confidence assessment: internal address tripped "
                    f"'{ip_stats.get('classification')}' heuristics — most "
                    "likely normal LAN chatter from a busy host. No external "
                    "threat is possible from a private address."),
                "evidence": ev}

    # --- agentic-pipeline corroboration is the strongest signal ----------
    if agentic_backed:
        sources = []
        if ioc_match:
            sources.append("matches the ThreatDefence agentic-framework IOC feed")
        if agentic_alerts:
            sources.append(f"fired {agentic_alerts} agentic detection alert(s) "
                           "(TD rules)")
        corroborated = alert_backed or cf_pending or any(
            l in labels for l in ("exfil-suspect", "scanner", "beacon-suspect"))
        concl = "HOSTILE" if corroborated else "SUSPICIOUS"
        return {"subject": ip, "kind": "ip", "conclusion": concl,
                "justification": (
                    f"{' and '.join(sources)}. "
                    + ("Combined with hostile flow behaviour and alert "
                       "corroboration — treat as hostile." if corroborated
                       else "No additional flow anomaly corroborates it yet "
                            "— investigate before acting.")),
                "evidence": ev,
                "cf_candidate": concl == "HOSTILE" and not cf_blocked}

    # --- public addresses -----------------------------------------------
    # HOSTILE requires corroboration: alert-backed OR pending CF action,
    # plus a hostile-looking behaviour class.
    if ("exfil-suspect" in labels
            and (alert_backed or cf_pending)):
        why = []
        if alert_backed:
            why.append("generated Suricata alert events")
        if cf_pending:
            why.append("queued for Cloudflare block")
        return {"subject": ip, "kind": "ip", "conclusion": "HOSTILE",
                "justification": (
                    f"Public IP uploaded {fmt(ip_stats.get('bytes_up'))} bytes "
                    f"to {ip_stats.get('unique_dests')} destinations and "
                    f"{' and '.join(why)} — corroborated data-exfiltration "
                    "pattern."),
                "evidence": ev}

    if "exfil-suspect" in labels:
        return {"subject": ip, "kind": "ip", "conclusion": "SUSPICIOUS",
                "justification": (
                    f"Public IP uploaded {fmt(ip_stats.get('bytes_up'))} bytes "
                    f"to only {ip_stats.get('unique_dests')} destinations "
                    f"({fmt(ip_stats.get('top_dest_flows'))} flows to top dest) "
                    "— exfil-shaped traffic but without alert or CF "
                    "corroboration yet."),
                "evidence": ev}

    if "scanner" in labels and alert_backed:
        return {"subject": ip, "kind": "ip", "conclusion": "SUSPICIOUS",
                "justification": (
                    f"Public IP contacted {ip_stats.get('unique_dests')} "
                    f"destinations across {ip_stats.get('unique_ports')} ports "
                    "and triggered Suricata alerts — recon or scanning "
                    "corroborated by detections."),
                "evidence": ev}

    if "beacon-suspect" in labels and alert_backed:
        return {"subject": ip, "kind": "ip", "conclusion": "SUSPICIOUS",
                "justification": (
                    f"Public IP shows repetitive small flows to a single "
                    f"destination ({fmt(ip_stats.get('top_dest_flows'))} flows, "
                    f"avg {fmt(ip_stats.get('avg_flow_bytes'))} bytes) plus "
                    "alert events — possible C2 beaconing."),
                "evidence": ev}

    # remaining flagged public IPs: statement-style low-confidence calls
    detail = {
        "scanner": f"wide destination/port diversity ({ip_stats.get('unique_dests')} dests, {ip_stats.get('unique_ports')} ports)",
        "beacon-suspect": f"periodic small flows to one destination ({fmt(ip_stats.get('top_dest_flows'))} flows)",
        "heavy-client": f"concentrated flows to <=3 destinations ({flows} flows)",
    }
    why = "; ".join(detail[l] for l in labels if l in detail) or \
        ip_stats.get("classification", "flagged")
    if resp_pct < 30:
        statement = (
            f"These are likely false positives: only {resp_pct}% of flows "
            f"received any response — packets went out but produced no "
            "follow-on activity, consistent with probes or one-way noise "
            "rather than established sessions.")
    elif resp_pct >= 60:
        statement = (
            f"Low-confidence assessment, most likely benign system or "
            f"application traffic: {resp_pct}% of flows were answered and "
            "traffic is interactive. The heuristic tripped on volume/shape, "
            "not on malicious behaviour.")
    else:
        statement = (
            "Low-confidence assessment: the flow pattern is unusual "
            f"({why}) but there is no alert, IOC, or response-behaviour "
            "corroboration. Most likely a system process or legitimate "
            "peer-to-peer client.")
    return {"subject": ip, "kind": "ip", "conclusion": "ANOMALOUS",
            "justification": f"{statement} ({why}.)",
            "evidence": ev}


def assess_arp_ip(entry, ctx):
    """Assess one arpwatch offender. entry: {ip, events, subjects?}"""
    ip = entry.get("ip", "?")
    events = entry.get("events", 0)
    subjects = entry.get("subjects") or entry.get("kinds") or {}
    ev = {"events": events, "subjects": subjects}
    # MAC randomization / flip-flop dominance on a LAN host is usually a
    # phone or laptop with private addressing — anomalous, not hostile.
    if events >= 10:
        return {"subject": ip, "kind": "arpwatch",
                "conclusion": "ANOMALOUS",
                "justification": (
                    f"{events} suspicious ARP events in the window "
                    f"({subjects or 'mixed'}). Sustained MAC/IP instability on "
                    "a LAN host is most often a device randomizing its address "
                    "(phone/laptop private Wi-Fi) or a flaky NIC — verify the "
                    "device identity before treating as spoofing."),
                "evidence": ev}
    return {"subject": ip, "kind": "arpwatch", "conclusion": "NOMINAL",
            "justification": (
                f"{events} suspicious ARP events — below the level that "
                "warrants investigation on a busy LAN."),
            "evidence": ev}


def assess_alert_only(ip, ctx):
    """Subject for an IP that generated alerts but isn't a top talker —
    quiet targeted activity that volume-ranked stats would miss."""
    n = ctx["alert_counts"].get(ip, 0)
    agentic_alerts = ctx["agentic_src"].get(ip, 0)
    ioc = ip in ctx["ioc_hits"]
    ev = {"alert_events": n, "agentic_alerts": agentic_alerts,
          "ioc_match": ioc, "note": "not in top talkers — assessed from "
          "alert records only"}
    if not is_public(ip):
        return {"subject": ip, "kind": "ip", "conclusion": "ANOMALOUS",
                "justification": (
                    f"Internal address generated {n} alert event(s) but is "
                    "not a top talker — investigate which internal process "
                    "triggered them."),
                "evidence": ev}
    if ioc or agentic_alerts:
        return {"subject": ip, "kind": "ip", "conclusion": "SUSPICIOUS",
                "justification": (
                    f"Public IP generated {n} alert event(s)"
                    + (f", {agentic_alerts} from agentic TD rules"
                       if agentic_alerts else "")
                    + (" and matches the agentic IOC feed" if ioc else "")
                    + " — detection-backed activity worth investigating."),
                "evidence": ev,
                "cf_candidate": False}
    return {"subject": ip, "kind": "ip", "conclusion": "ANOMALOUS",
            "justification": (
                f"Public IP generated {n} alert event(s) without appearing "
                "in top talkers — low-volume or targeted activity. "
                "Low-confidence: review the alert signatures before "
                "escalating."),
            "evidence": ev}


def assess_dst_ioc(entry, ctx):
    """Subject for a destination IP matching the agentic IOC feed."""
    ip = entry["ip"]
    ev = {"flows": entry.get("flows"), "unique_srcs": entry.get("unique_srcs"),
          "ioc_match": True}
    return {"subject": ip, "kind": "dst_ip", "conclusion": "SUSPICIOUS",
            "justification": (
                f"Destination matches the ThreatDefence agentic-framework "
                f"IOC feed and received {entry.get('flows')} flows from "
                f"{entry.get('unique_srcs')} internal sources — possible "
                "C2/exfil endpoint; identify which internal hosts "
                "contacted it."),
            "evidence": ev}


# consecutive ANOMALOUS windows before a subject is promoted to SUSPICIOUS
PERSISTENCE_PROMOTE = 6


def apply_memory(subjects, state, now, window_hours=1.0):
    """Update subject memory and escalate persistent anomalies.

    state: {"subjects": {ip: {first_seen, last_seen, streak, total}}}
    streak = consecutive assessment windows the subject appeared in.
    Subjects absent for >2 windows have their streak reset first.
    """
    from datetime import datetime, timezone

    def parse(ts):
        try:
            return datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
        except Exception:
            return None

    now_dt = parse(now) or datetime.now(timezone.utc)
    mem = state.setdefault("subjects", {})
    # decay streaks for subjects missing beyond two windows
    max_gap = 2 * window_hours * 3600
    for ip, rec in mem.items():
        if ip in {s["subject"] for s in subjects}:
            continue
        last = parse(rec.get("last_seen"))
        if last and (now_dt - last).total_seconds() > max_gap:
            rec["streak"] = 0
    for s in subjects:
        ip = s["subject"]
        rec = mem.get(ip)
        if rec is None:
            rec = {"first_seen": now, "streak": 0, "total": 0,
                   "worst": "NOMINAL"}
            mem[ip] = rec
        rec["last_seen"] = now
        rec["streak"] = rec.get("streak", 0) + 1
        rec["total"] = rec.get("total", 0) + 1
        if SEVERITY[s["conclusion"]] > SEVERITY.get(rec["worst"], 0):
            rec["worst"] = s["conclusion"]
        s["windows_seen"] = rec["streak"]
        # persistence escalation: an anomaly that never resolves is a
        # pattern, not noise
        if (s["conclusion"] == "ANOMALOUS"
                and rec["streak"] >= PERSISTENCE_PROMOTE):
            s["conclusion"] = "SUSPICIOUS"
            s["justification"] += (
                f" Escalated: same anomaly in {rec['streak']} consecutive "
                "assessment windows — persistence indicates a real pattern.")
    return mem


def assess(stats, findings=None, state=None):
    ctx = load_context(stats, findings)

    if ctx["total_events"] == 0:
        return {
            "verdict": "NO DATA", "confidence": "none",
            "subjects": [],
            "context": {
                "total_events": 0, "alerts_ex_noise": 0, "flagged_ips": 0,
                "cf_submitted": len(ctx["cf_submitted"]),
                "cf_pending": len(ctx["cf_pending"]),
                "arp_suspicious_window": ctx["arp"].get("suspicious_lines", 0),
            },
            "llm_findings": {"corroborated": [], "rejected": ctx["llm_rejected"]},
            "note": "no events collected — collection may have failed; "
                    "this is not a clean bill of health",
        }

    subjects = []
    # every non-normal top talker gets an individual conclusion
    for i in stats.get("top_src_ips", []):
        cls = i.get("classification", "")
        if cls and cls != "normal":
            subjects.append(assess_ip(i, ctx))

    # arpwatch offenders (top entries only — the log is noisy)
    arp = ctx["arp"]
    for entry in (arp.get("top_ips") or arp.get("last_24h", {}).get("top_ips")
                  or [])[:5]:
        subjects.append(assess_arp_ip(entry, ctx))

    # detection-driven subjects: IPs that generated alerts but never made
    # the top-talkers list (quiet/targeted activity)
    assessed_ips = {s["subject"] for s in subjects}
    for ip in sorted(ctx["alert_counts"],
                     key=lambda x: -ctx["alert_counts"][x])[:50]:
        if ip not in assessed_ips:
            subjects.append(assess_alert_only(ip, ctx))
            assessed_ips.add(ip)

    # destination-side subjects: external IPs matching the agentic IOC feed
    for d in stats.get("top_dst_ips", []):
        if d.get("ioc_match") and d["ip"] not in assessed_ips:
            subjects.append(assess_dst_ioc(d, ctx))
            assessed_ips.add(d["ip"])

    # LLM corroborated findings attach to (or create) their IP subject
    by_ip = {s["subject"]: s for s in subjects}
    for f in ctx["llm_corroborated"]:
        ip = f["ip"]
        note = (f"LLM class {f['class']} finding: {f.get('behavior', '')} — "
                f"{f.get('evidence', '')}")
        if ip in by_ip:
            s = by_ip[ip]
            s.setdefault("llm_notes", []).append(note)
            if f["class"] == "A" and SEVERITY[s["conclusion"]] < SEVERITY["SUSPICIOUS"]:
                s["conclusion"] = "SUSPICIOUS"
                s["justification"] += " Elevated by corroborated LLM class-A finding."
        else:
            concl = "SUSPICIOUS" if f["class"] == "A" else "ANOMALOUS"
            subjects.append({
                "subject": ip, "kind": "ip", "conclusion": concl,
                "justification": (
                    f"Corroborated LLM {f['class']}-class finding "
                    f"({f.get('behavior', 'see evidence')}): "
                    f"{f.get('evidence', '')}. Model output treated as a "
                    "lead; confirm with packet-level review."),
                "evidence": {"llm_class": f["class"]},
                "llm_notes": [note]})

    # cross-window memory: streaks, persistence escalation
    if state is not None:
        meta = stats.get("meta", {})
        apply_memory(subjects, state,
                     now=meta.get("window_end") or meta.get("generated_at"),
                     window_hours=float(meta.get("window_hours") or 1))

    # overall verdict = most severe subject conclusion
    verdict = "NOMINAL"
    for s in subjects:
        if SEVERITY[s["conclusion"]] > SEVERITY[verdict]:
            verdict = s["conclusion"]

    confidence = "none"
    if verdict == "HOSTILE":
        confidence = "high"   # HOSTILE requires corroborated evidence by rule
    elif verdict == "SUSPICIOUS":
        confidence = "medium"
    elif verdict == "ANOMALOUS":
        confidence = "low"
    elif verdict == "NOMINAL":
        confidence = "high"

    return {
        "verdict": verdict,
        "confidence": confidence,
        "subjects": subjects,
        "subject_memory": state.get("subjects", {}) if state else {},
        "context": {
            "total_events": ctx["total_events"],
            "alerts_ex_noise": ctx["alerts"],
            "flagged_ips": len([i for i in stats.get("top_src_ips", [])
                                if i.get("classification") not in ("", "normal")]),
            "cf_submitted": len(ctx["cf_submitted"]),
            "cf_pending": len(ctx["cf_pending"]),
            "arp_suspicious_window": ctx["arp"].get("suspicious_lines", 0),
            "arp_suspicious_24h": (ctx["arp"].get("last_24h") or {})
                                  .get("suspicious_lines", 0),
        },
        "llm_findings": {"corroborated": ctx["llm_corroborated"],
                         "rejected": ctx["llm_rejected"],
                         "narrative": ctx["llm_narrative"]},
        "note": "conclusion-based assessment — per-subject verdicts with "
                "justifications; aggregate counts are reference only",
    }


def verdict_markdown(a, stats):
    meta = stats.get("meta", {})
    lines = []
    lines.append("## Assessment statement")
    lines.append("")
    if a["verdict"] == "NO DATA":
        lines.append("**NO DATA** — no events were collected in this window. "
                     "This indicates a collection failure or idle sensors, "
                     "not a clean bill of health.")
        return "\n".join(lines) + "\n"

    c = a.get("context", {})
    lines.append(
        f"Window: last {meta.get('window_hours', '?')}h "
        f"({meta.get('window_start', '?')} → {meta.get('window_end', '?')}), "
        f"{', '.join(meta.get('streams', []))}. "
        f"{c.get('total_events', 0):,} events, {c.get('alerts_ex_noise', 0):,} "
        "alerts (engine/info noise excluded).")
    lines.append("")
    lines.append(f"**Overall: {a['verdict']}** (confidence: {a['confidence']})")
    lines.append("")

    subs = a.get("subjects", [])
    if subs:
        lines.append("### Subject assessments")
        lines.append("")
        for s in subs:
            tag = s["kind"] if s["kind"] != "ip" else "ip"
            streak = s.get("windows_seen")
            streak_txt = f" (seen {streak} consecutive windows)" if streak and streak > 1 else ""
            lines.append(f"- **{s['subject']}** ({tag}) → **{s['conclusion']}**{streak_txt}")
            lines.append(f"  {s['justification']}")
            for n in s.get("llm_notes", []):
                lines.append(f"  _{n}_")
            if s.get("cf_candidate"):
                lines.append("  → **Cloudflare block candidate** "
                             "(high-confidence + agentic corroboration)")
        lines.append("")
    else:
        lines.append("No subjects required assessment — no IPs tripped "
                     "behaviour heuristics and no ARP/LLM findings.")
        lines.append("")

    llm = a.get("llm_findings", {})
    if llm.get("rejected"):
        lines.append(f"_{len(llm['rejected'])} LLM finding(s) rejected as "
                     "uncorroborated._")
        lines.append("")
    if llm.get("narrative"):
        lines.append(f"> LLM observation: {llm['narrative']}")
        lines.append("")
    return "\n".join(lines) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stats", required=True)
    ap.add_argument("--findings", help="LLM findings JSON (optional)")
    ap.add_argument("--assessment", required=True)
    ap.add_argument("--verdict", required=True)
    ap.add_argument("--state", help="path to persistent subject-memory JSON")
    args = ap.parse_args()

    stats = json.load(open(args.stats))
    findings = None
    if args.findings and os.path.exists(args.findings):
        try:
            findings = json.load(open(args.findings))
        except json.JSONDecodeError:
            findings = None

    state = None
    if args.state:
        state = {"subjects": {}}
        if os.path.exists(args.state):
            try:
                state = json.load(open(args.state))
                state.setdefault("subjects", {})
            except (OSError, json.JSONDecodeError):
                state = {"subjects": {}}

    a = assess(stats, findings, state=state)
    a["meta"] = stats.get("meta", {})

    with open(args.assessment, "w") as f:
        json.dump(a, f, indent=2)
    if args.state and state is not None:
        state["updated_at"] = a.get("meta", {}).get("window_end")
        with open(args.state, "w") as f:
            json.dump(state, f, indent=2)
    with open(args.verdict, "w") as f:
        f.write(verdict_markdown(a, stats))
    print(f"verdict={a['verdict']} confidence={a['confidence']} "
          f"subjects={len(a.get('subjects', []))} -> {args.assessment}")


if __name__ == "__main__":
    main()
