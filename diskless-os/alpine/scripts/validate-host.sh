#!/bin/sh
set -eu
fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
command -v rc-status >/dev/null 2>&1 || fail "OpenRC rc-status missing"
command -v ip >/dev/null 2>&1 || fail "iproute2 missing"
cat /etc/alpine-release
ip -br addr
rc-status
command -v lbu >/dev/null 2>&1 || fail "lbu missing"
lbu status
