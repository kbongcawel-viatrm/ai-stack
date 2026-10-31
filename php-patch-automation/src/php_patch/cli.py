"""Command-line interface."""
import argparse
import json
import sys
from pathlib import Path
from php_patch.inventory import export_json, load_fixtures
from php_patch.models import classify
from php_patch.policy import load_policy, validate_policy

def main() -> None:
    parser = argparse.ArgumentParser(prog="php-patch")
    sub = parser.add_subparsers(dest="command", required=True)
    inv = sub.add_parser("inventory")
    inv.add_argument("--source", choices=["fixtures"], required=True)
    inv.add_argument("--directory", type=Path, default=Path("fixtures"))
    inv.add_argument("--format", choices=["json"], default="json")
    pol = sub.add_parser("validate-policy")
    pol.add_argument("--policy", type=Path, default=Path("config/php-policy.yml"))
    ver = sub.add_parser("classify")
    ver.add_argument("--current", required=True)
    ver.add_argument("--target", required=True)
    args = parser.parse_args()
    try:
        if args.command == "inventory":
            print(export_json(load_fixtures(args.directory)))
        elif args.command == "validate-policy":
            policy = load_policy(args.policy)
            validate_policy(policy)
            print(json.dumps({"valid": True, "supported_branches": policy["supported_branches"]}))
        elif args.command == "classify":
            result = classify(args.current, args.target)
            print(json.dumps(result.__dict__, indent=2))
            if result.change_type == "major-minor-upgrade":
                raise SystemExit(2)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc

if __name__ == "__main__":
    main()
