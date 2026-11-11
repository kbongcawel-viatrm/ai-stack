#!/usr/bin/env bash
# container/entrypoint.sh — runs inside the provisioning container.
# Renders vm-host.ign (butane) then provisions the VM on the HOST libvirt.
# IMAGE_DIR must point at the host path mounted at the same location
# (set by up.sh).
#
# SSH transport (TRANSPORT=ssh via up.sh): up.sh stages the libvirt ssh
# identity in $PROV_SSH_SRC (bind-mounted read here); ssh_home_t host files
# are not container-readable, and ssh refuses foreign-owned keys, so install
# them into the container's own ~/.ssh with correct ownership first.
set -Eeuo pipefail
cd /work

if [[ -n "${PROV_SSH_HOST:-}" && -d /root/.ssh-src ]]; then
  install -d -m 700 /root/.ssh
  install -m 600 /root/.ssh-src/vmhost-bot /root/.ssh/vmhost-bot
  [[ -f /root/.ssh-src/known_hosts ]] \
    && install -m 600 /root/.ssh-src/known_hosts /root/.ssh/known_hosts
  cat > /root/.ssh/config <<EOF
Host ${PROV_SSH_HOST}
    User kim
    IdentityFile ~/.ssh/vmhost-bot
    IdentitiesOnly yes
    StrictHostKeyChecking accept-new
EOF
  chmod 600 /root/.ssh/config
fi

./build.sh
exec ./deploy.sh
