"""Shared inventory and PHP version classification models."""
from __future__ import annotations
from dataclasses import asdict, dataclass
from typing import Any
import re

@dataclass(frozen=True)
class Workload:
    resource_id: str
    cloud: str
    resource_type: str
    bu: str
    application: str
    environment: str
    operating_system: str | None = None
    php_version: str | None = None
    patch_ring: str = "unassigned"
    region: str | None = None
    source: str = "unknown"
    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

@dataclass(frozen=True)
class PatchClassification:
    current: str
    target: str
    change_type: str
    allowed_as_minor: bool
    reason: str

def _parse_php(version: str) -> tuple[int, int, int, str]:
    match = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)([-+].*)?", version.strip())
    if not match:
        raise ValueError(f"Invalid PHP version: {version!r}")
    return int(match.group(1)), int(match.group(2)), int(match.group(3)), match.group(4) or ""

def classify(current: str, target: str) -> PatchClassification:
    cur, tgt = _parse_php(current), _parse_php(target)
    if tgt[:3] < cur[:3]:
        raise ValueError("Target PHP version must not be lower than current version")
    same_branch = cur[:2] == tgt[:2]
    if cur == tgt:
        kind, reason = "none", "Versions are identical"
    elif same_branch:
        kind, reason = "minor-security", "Patch-level update within the same PHP major.minor branch"
    else:
        kind, reason = "major-minor-upgrade", "Changing PHP major or minor branch requires migration approval"
    return PatchClassification(current, target, kind, same_branch, reason)
