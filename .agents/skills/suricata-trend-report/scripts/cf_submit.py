#!/usr/bin/env python3
"""Manually submit assessment-flagged IPs to the Cloudflare block list.

Reads assessment.json produced by assess.py and submits every subject
marked cf_candidate=true — i.e. high-confidence HOSTILE conclusions with
agentic-pipeline corroboration (IOC feed hit or TD-rule alert).

Reuses suricata-cf-block.py's own CF API helpers so list handling,
ignore-ranges and gateway/rules-list modes stay identical to the
automated worker. Env vars are the same as the worker's (cf.env):
  CF_API_TOKEN (required), CF_ACCOUNT_ID, CF_LIST_NAME, CF_LIST_ID,
  CF_GATEWAY_LIST, CF_WARP_PROFILE_ID (unused here).

Usage:
    cf_submit.py --assessment assessment.json [--dry-run]
    cf_submit.py --ips 1.2.3.4 5.6.7.8 [--dry-run]
"""

import argparse
import importlib.util
import json
import os
import sys

WORKER = "/var/home/kim/workspace/suricata-cf/suricata-cf-block.py"


def load_worker():
    spec = importlib.util.spec_from_file_location("cfblock", WORKER)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--assessment", help="assessment.json from assess.py")
    ap.add_argument("--ips", nargs="*", default=[], help="explicit IPs")
    ap.add_argument("--dry-run", action="store_true",
                    help="list candidates without submitting")
    args = ap.parse_args()

    candidates = {}
    if args.assessment:
        a = json.load(open(args.assessment))
        for s in a.get("subjects", []):
            if s.get("cf_candidate"):
                candidates[s["subject"]] = s.get("justification", "")[:200]
    for ip in args.ips:
        candidates.setdefault(ip, "manual submission")

    if not candidates:
        print("no cf_candidate subjects — nothing to submit")
        return

    m = load_worker()
    if not m.TOKEN:
        sys.exit("CF_API_TOKEN is not set (source suricata-cf/cf.env)")

    # apply the worker's own safety filter
    safe = {ip: why for ip, why in candidates.items()
            if m.is_submittable_ip(ip)}
    skipped = sorted(set(candidates) - set(safe))
    if skipped:
        print(f"skipped {len(skipped)} non-submittable IP(s): {skipped}")
    if not safe:
        print("no submittable candidates remain")
        return

    for ip, why in safe.items():
        print(f"  candidate: {ip} — {why}")
    if args.dry_run:
        print(f"dry-run: would submit {len(safe)} IP(s)")
        return

    m.detect_account_id()
    m.find_or_create_list()
    known = m.fetch_existing_items()
    fresh = [(ip, f"assessment {os.path.basename(args.assessment or 'manual')}: "
                  f"{why[:120]}")
             for ip, why in safe.items() if ip not in known]
    if not fresh:
        print("all candidates already on the Cloudflare list")
        return
    m.add_items(fresh)
    print(f"submitted {len(fresh)} IP(s) to Cloudflare list {m.LIST_NAME}")


if __name__ == "__main__":
    main()
