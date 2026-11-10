#!/usr/bin/env bash
# kasm-install — first-boot Kasm Workspaces installer for the FCOS guest.
# Installed to /usr/local/sbin/kasm-install by the kasm Butane fragment and
# run once by kasm-install.service after docker.service and the rpm-ostree
# package layer are ready. Downloads the pinned installer bundle, verifies
# its SHA256, extracts and runs install.sh non-interactively.
set -Eeuo pipefail

KASM_VERSION="${KASM_VERSION:-1.19.0}"
KASM_BUNDLE_URL="${KASM_BUNDLE_URL:-https://kasm-static-content.s3.amazonaws.com/kasm_release_${KASM_VERSION}.tar.gz}"
KASM_BUNDLE_SHA256="${KASM_BUNDLE_SHA256:-7b801cb0579a7867df46b6da873fe8dd631db07d4c05349e5bd1aea27130c37d}"
KASM_WORK_DIR="${KASM_WORK_DIR:-/var/lib/kasm-install}"
KASM_STAMP="${KASM_STAMP:-/var/lib/kasm-install.stamp}"

if [ -f "$KASM_STAMP" ]; then
    echo "kasm-install: stamp $KASM_STAMP exists, skipping"
    exit 0
fi

for binary in docker curl tar sha256sum install; do
    command -v "$binary" >/dev/null || {
        echo "kasm-install: missing required binary: $binary" >&2
        exit 1
    }
done

docker info >/dev/null 2>&1 || {
    echo "kasm-install: docker daemon not reachable" >&2
    exit 1
}

mkdir -p "$KASM_WORK_DIR"
cd "$KASM_WORK_DIR"

bundle="kasm_release_${KASM_VERSION}.tar.gz"
if [ ! -f "$bundle" ]; then
    echo "kasm-install: downloading $KASM_BUNDLE_URL"
    curl -fSL --retry 3 --connect-timeout 30 -o "$bundle" "$KASM_BUNDLE_URL"
fi

echo "kasm-install: verifying bundle sha256"
echo "${KASM_BUNDLE_SHA256}  ${bundle}" | sha256sum -c -

echo "kasm-install: extracting bundle"
tar -xf "$bundle"

echo "kasm-install: running installer (accept-eula, no swap check)"
# FCOS has no swap; the installer would otherwise abort. --no-swap-check is
# required on this platform. Install output (including generated admin
# credentials) lands in /opt/kasm/current/install_log.txt and journald.
bash kasm_release/install.sh --accept-eula --no-swap-check

touch "$KASM_STAMP"
echo "kasm-install: complete; stamp written to $KASM_STAMP"
echo "kasm-install: admin credentials are in /opt/kasm/current/install_log.txt"
