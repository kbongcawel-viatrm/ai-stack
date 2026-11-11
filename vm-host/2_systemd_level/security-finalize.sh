#!/usr/bin/env bash
# security-finalize.sh — post-boot orchestration for the containerized
# FCOS VM host. Runs every boot; every step is idempotent.
#
# Order follows the priority agreed for first boot:
#   SSH hardening  -> Ignition (sshd drop-in, applied before this runs)
#   Suricata       -> ET Open rules fetched here, container restarted after
#   Firewall       -> firewalld container (stack-edge.service)
#   Kasm           -> stack-kasm.service (.env generated below)
#   rest           -> clamav/aide/lynis timers, home-security stack
set -uo pipefail

STACK=/var/opt/stack
SURICATA_STAMP=/var/lib/suricata-rules.stamp
AIDE_INIT_STAMP=/var/lib/aide-init.stamp
SWAP_FILE=/var/swap/swapfile
SWAP_SIZE="${SWAP_SIZE:-8G}"

log() { echo "[finalize] $*"; }

# --- swap: FCOS ships without swap (ZRAM only); Kasm needs burst headroom --
if [[ ! -f $SWAP_FILE ]]; then
  install -d -m 0750 /var/swap
  fallocate -l "$SWAP_SIZE" "$SWAP_FILE" && chmod 0600 "$SWAP_FILE" && mkswap "$SWAP_FILE" \
    || log "WARN: swap setup failed; continuing without swap"
fi
grep -q "^$SWAP_FILE " /etc/fstab 2>/dev/null || echo "$SWAP_FILE none swap defaults 0 0" >> /etc/fstab
swapon -a || true

# --- podman-compose layer: FCOS excludes python3 from the base image, so
# podman-compose needs one tiny rpm-ostree layer (python3 + podman-compose
# + deps). --apply-live activates it in the running boot; stamp prevents
# re-layering. Stack units are ordered After= this unit for that reason.
PYTOOLS_STAMP=/var/lib/vm-host-pytools.stamp
if [[ ! -f $PYTOOLS_STAMP ]]; then
  if rpm-ostree install --apply-live python3 podman-compose; then
    touch "$PYTOOLS_STAMP"
    log "podman-compose layer applied"
  else
    log "WARN: podman-compose layer failed; stack units will fail until resolved"
  fi
fi

# --- stack .env: Kasm VNC password, generated exactly once -------------------
if [[ ! -f $STACK/.env ]]; then
  install -d -m 0755 "$STACK"
  ( umask 077; printf 'KASM_VNC_PASSWORD=%s\nTZ=UTC\n' "$(head -c18 /dev/urandom | base64)" > "$STACK/.env" )
  log "generated $STACK/.env (KASM_VNC_PASSWORD)"
fi

# --- ensure the compose-built images exist ------------------------------------
# `compose up` builds missing images automatically; `compose build` here just
# warms the cache so stack units start faster. Non-fatal.
( cd "$STACK" && "$STACK/bin/docker-compose" build ) || log "WARN: compose build reported errors"

# --- suricata: fetch ET Open rules once, then bounce the container -----------
# suricata-update needs a writable /etc/suricata (enable.conf); the stack
# mount is rw for that reason. Runs before the daily timers matter; the
# suricata container starts with local.rules only and is restarted once the
# bundle lands so it picks up ET rules without a reboot.
if [[ ! -f "$SURICATA_STAMP" ]]; then
  if podman run --rm --network host \
       --security-opt label=disable \
       -v /var/lib/suricata:/var/lib/suricata \
       -v "$STACK/suricata:/etc/suricata" \
       --entrypoint suricata-update \
       docker.io/jasonish/suricata:latest; then
    touch "$SURICATA_STAMP"
    podman restart vm-host-suricata >/dev/null 2>&1 || true
    log "suricata ET Open rules fetched; container restarted"
  else
    log "WARN: suricata-update failed; will retry next boot"
  fi
fi
chown -R suricata:suricata /var/lib/suricata /var/log/suricata 2>/dev/null || true

# --- aide: one-time baseline via the audit-profile container -----------------
if [[ ! -f "$AIDE_INIT_STAMP" ]]; then
  if ( cd "$STACK" && "$STACK/bin/docker-compose" --profile audit run --rm aide-init ); then
    touch "$AIDE_INIT_STAMP"
    log "aide baseline initialized"
  else
    log "WARN: aide --init failed; will retry next boot"
  fi
fi

# --- home-security.uk stack (lowest priority) ---------------------------------
systemctl enable home-security.service 2>/dev/null || true
systemctl start --no-block home-security.service 2>/dev/null || true

exit 0
