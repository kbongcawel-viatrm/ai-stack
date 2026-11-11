#!/usr/bin/env bash
# security-baseline.sh — CIS-style host hardening assertions for the FCOS
# guest. Runs at every boot (idempotent); failures are logged, not fatal,
# except where noted. Verified afterwards by the lynis audit container.
set -uo pipefail

log() { echo "[baseline] $*"; }

# --- 1. Mask nonessential services ---------------------------------------------
# FCOS is already minimal; mask anything that could appear via layering or
# defaults and is not required for sshd/NM/firewalld/zincati/docker.
MASKED_OK=0; MASKED_FAIL=0
for unit in \
  ModemManager.service \
  cups.service cups.socket cups.path \
  bluetooth.service \
  avahi-daemon.service avahi-daemon.socket \
  rpcbind.service rpcbind.socket rpcbind.target \
  nfs-server.service nfs-client.target rpc-statd.service \
  iscsi.service iscsid.service iscsid.socket iscsiuio.socket \
  sssd.service sssd-kcm.service sssd-kcm.socket \
  realmd.service \
  tuned.service tuned-ppd.service \
  fprintd.service \
  switcheroo-control.service \
  colord.service \
  upower.service \
  accounts-daemon.service \
  rtkit-daemon.service \
  geoclue.service \
  power-profiles-daemon.service \
  kdump.service \
  import-state.service \
  systemd-importd.service \
  xdg-user-dirs.service \
  homed.service homed-luks.service \
  rpm-ostree-rebase.service \
  qemu-guest-agent.service; do
  if systemctl list-unit-files "$unit" >/dev/null 2>&1 \
     && systemctl list-unit-files "$unit" | grep -qE 'enabled|static|indirect|generated|alias|transient'; then
    if systemctl mask --now "$unit" >/dev/null 2>&1; then
      MASKED_OK=$((MASKED_OK+1))
    else
      log "WARN: could not mask $unit"
      MASKED_FAIL=$((MASKED_FAIL+1))
    fi
  fi
done
log "masked units: $MASKED_OK ok, $MASKED_FAIL failed"

# --- 2. Assert account posture --------------------------------------------------
# Only 'core' may have an interactive shell; lock password auth for every
# other human-capable account and ensure root stays locked.
for acct in root bin daemon adm lp sync shutdown halt mail news uucp operator \
            games gopher ftp nobody dbus polkitd tss sshd rpc rpcuser nfsnobody \
            chrony systemd-network systemd-oom; do
  if id "$acct" >/dev/null 2>&1; then
    # Lock password AND shell where the account is a login-capable system user.
    usermod -L "$acct" 2>/dev/null || true
    case "$acct" in
      root|bin|daemon|adm|lp|sync|shutdown|halt|mail|news|uucp|operator|games|gopher|ftp)
        usermod -s /sbin/nologin "$acct" 2>/dev/null || true ;;
    esac
  fi
done
# core keeps its console password (break-glass) — do NOT lock it.

# --- 3. File permission assertions ----------------------------------------------
# sshd host keys and sudoers must not be group/world writable.
chmod 0600 /etc/ssh/ssh_host_*_key 2>/dev/null || true
chmod 0644 /etc/ssh/ssh_host_*_key.pub 2>/dev/null || true
[ -f /etc/sudoers ] && chmod 0440 /etc/sudoers || true
chmod -R go-rwx /etc/ssh/sshd_config.d 2>/dev/null || true
chmod 0600 /etc/ssh/sshd_config.d/*.conf 2>/dev/null || true

# --- 4. Kernel module blacklist (unused subsystems) ------------------------------
# Blacklist modules for services we mask above. Harmless if already absent.
MODPROBE_DIR=/etc/modprobe.d
install -d -m 0755 "$MODPROBE_DIR"
cat > "$MODPROBE_DIR/90-vm-host-blacklist.conf" <<'EOF'
# security-baseline: unused kernel modules for masked services
blacklist dccp
blacklist sctp
blacklist rds
blacklist tipc
blacklist atm
blacklist x25
blacklist rose
blacklist netrom
blacklist ax25
blacklist decnet
blacklist econet
blacklist af_802154
blacklist bluetooth
blacklist nfc
blacklist caif
blacklist phonet
blacklist ieee802154
blacklist mac802154
blacklist qrtr
blacklist smc
blacklist mptcp_diag
blacklist dccp_diag
blacklist sctp_diag
blacklist tipc_diag
blacklist n_hdlc
blacklist slip
blacklist ppp_generic
blacklist ppp_async
blacklist ppp_synctty
blacklist pppoe
blacklist pppox
blacklist l2tp_ppp
blacklist l2tp_core
blacklist l2tp_ip
blacklist l2tp_netlink
blacklist pptp
blacklist ip_gre
blacklist ipip
blacklist sit
blacklist ip_vti
blacklist ip6_vti
blacklist ip6_tunnel
blacklist ip6_gre
blacklist fou
blacklist gue
# NOTE: veth/macvtap are intentionally NOT blacklisted — docker uses veth
# pairs for every bridge-networked container.
blacklist macvlan
blacklist vxlan
blacklist geneve
blacklist bareudp
blacklist gtp
blacklist batman_adv
blacklist openvswitch
blacklist wireguard
blacklist vmw_vsock_virtio_transport_common
blacklist n_hdlc
blacklist slip
blacklist cdc_ether
blacklist rndis_host
blacklist cdc_ncm
blacklist huawei_cdc_ncm
blacklist qmi_wwan
blacklist option
blacklist usbserial
blacklist ch341
blacklist ftdi_sio
blacklist pl2303
blacklist cp210x
blacklist gsm_modem
blacklist hci_uart
blacklist btusb
blacklist btrtl
blacklist btintel
blacklist btbcm
blacklist bnep
blacklist rfcomm
blacklist hidp
blacklist cmtp
blacklist sco
blacklist 6lowpan
blacklist mac802154
blacklist nfc
blacklist nci
blacklist pn533
blacklist pn544
blacklist port100
blacklist st21nfca
blacklist st95hf
blacklist fdp
blacklist fdpe
blacklist fdpuart
EOF
chmod 0644 "$MODPROBE_DIR/90-vm-host-blacklist.conf"

# --- 5. Login/access sanity -------------------------------------------------------
# sshd must be pubkey-only (defense in depth — the drop-in already enforces).
if sshd -T 2>/dev/null | grep -qiE 'passwordauthentication yes|kbdinteractiveauthentication yes'; then
  log "ERROR: sshd still allows password auth — check /etc/ssh/sshd_config.d/"
else
  log "sshd: password auth disabled (verified via sshd -T)"
fi

# No user besides core may be in wheel.
for u in $(getent group wheel | cut -d: -f4 | tr ',' ' '); do
  [ "$u" = "core" ] || log "WARN: unexpected wheel member: $u"
done

log "baseline complete"
exit 0
