#!/usr/bin/env bash
# container/entrypoint.sh — runs inside the provisioning container.
# Renders vm-host.ign (butane) then provisions the VM on the HOST libvirt
# via the mounted /run/libvirt socket. IMAGE_DIR must point at the host
# path mounted at the same location (set by up.sh).
set -Eeuo pipefail
cd /work

./build.sh
exec ./deploy.sh
