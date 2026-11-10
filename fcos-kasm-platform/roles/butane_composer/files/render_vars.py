#!/usr/bin/env python3
"""Render ${VAR} placeholders in Butane payload files.

Walks a module build dir and substitutes ${NAME} for names in ALLOWED, read
from the process environment. All other ${...} occurrences — in particular
the docker-compose ${VAR:-default} runtime syntax — are left untouched.

Usage: render_vars.py <module_build_dir>
"""
import os
import re
import sys

ALLOWED = {
    "FCOS_SSH_PUBLIC_KEY",
    "FCOS_CORE_PASSWORD_HASH",
    "FCOS_LAN_IP",
    "FCOS_LAN_CIDR",
    "FCOS_GATEWAY",
    "FCOS_INTERFACE",
}
EXTS = {".xml", ".yaml", ".yml", ".conf", ".rules", ".toml", ".sh",
        ".service", ".timer", ".nmconnection", ".lst", ".cfg"}
PATTERN = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}")


def main(root: str) -> int:
    changed = 0
    for dirpath, _dirs, files in os.walk(root):
        for name in files:
            if os.path.splitext(name)[1] not in EXTS:
                continue
            path = os.path.join(dirpath, name)
            with open(path, "r", encoding="utf-8") as fh:
                text = fh.read()

            def sub(match):
                key = match.group(1)
                if key in ALLOWED:
                    return os.environ.get(key, match.group(0))
                return match.group(0)

            rendered = PATTERN.sub(sub, text)
            if rendered != text:
                with open(path, "w", encoding="utf-8") as fh:
                    fh.write(rendered)
                changed += 1
    print(f"render_vars: {changed} file(s) updated under {root}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "."))
