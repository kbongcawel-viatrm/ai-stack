"""Policy loading and deterministic target filtering."""
from pathlib import Path
from typing import Any
import yaml
from php_patch.models import Workload

def load_policy(path: Path) -> dict[str, Any]:
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    if not isinstance(data, dict):
        raise ValueError("Policy document must be a YAML mapping")
    return data

def validate_policy(policy: dict[str, Any]) -> None:
    required = {"supported_branches", "allowed_environments", "required_tags"}
    missing = required - policy.keys()
    if missing:
        raise ValueError(f"Policy missing keys: {', '.join(sorted(missing))}")
    if not isinstance(policy["supported_branches"], list) or not policy["supported_branches"]:
        raise ValueError("supported_branches must be a non-empty list")
    if not isinstance(policy["allowed_environments"], list):
        raise ValueError("allowed_environments must be a list")

def select_targets(workloads: list[Workload], *, bu: str, environment: str, patch_ring: str) -> list[Workload]:
    if not all((bu.strip(), environment.strip(), patch_ring.strip())):
        raise ValueError("BU, environment, and patch ring are mandatory target filters")
    return [w for w in workloads if (w.bu, w.environment, w.patch_ring) == (bu, environment, patch_ring)]
