#!/usr/bin/env bash
# deploy-fcos-vm-local.sh — run the FCOS VM provisioning directly against the
# host OS, replacing the deploy-host-vm GitHub workflow.
#
# Sequence:
#   1. Render the modular vm-host Butane config -> build/config.ign
#      (requires FCOS_* env vars below).
#   2. Build the same deploy-vars JSON the workflow produced.
#   3. Run playbooks/deploy-fcos-vm.yml:
#        - HYPERVISOR_HOST=localhost/127.0.0.1/::1 -> ansible_connection=local
#          with become via community.general.run0 (Secureblue has no sudo).
#        - otherwise SSH with the configured user/key.
#
# Required environment:
#   FCOS_QCOW2_URL            pinned Fedora CoreOS QCOW2 URL
#   FCOS_QCOW2_SHA256         its SHA256 (64 hex chars)
#   FCOS_SSH_PUBLIC_KEY       pubkey for the core user
#   FCOS_CORE_PASSWORD_HASH   openssl passwd -6 hash for core
#   FCOS_INTERFACE            guest NIC (verify per topology: ens3/ens2/enp1s0)
#   FCOS_LAN_IP               static guest IP
#
# Optional environment (defaults shown):
#   HYPERVISOR_HOST=localhost HYPERVISOR_USER="$USER"
#   HOST_OS=secureblue        alpine|secureblue|arch|ubuntu
#   FCOS_VM_NAME=fcos-kasm-poc
#   FCOS_LAN_CIDR=192.168.1.0/24 FCOS_GATEWAY=192.168.1.1
#   FCOS_NETWORK_BRIDGE=br0  FCOS_VM_MEMORY_MB=4096 FCOS_VM_VCPUS=2
#   FCOS_VM_DISK_GB=75       FCOS_IMAGE_DIR= (host-OS default)
#   FCOS_STORAGE_MOUNTPOINT=/mnt/nvme
#
# QCOW2 pin: `coreos-installer stream -a x86_64 stable | jq -r
#   '.architectures[].artifacts.qemu.formats["qcow2"].disk.location'`
# (and `.sha256` next to it).
set -Eeuo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
ansible_dir="${repo_root}/diskless-os/ansible"
vm_host_dir="${repo_root}/vm-host"
work_dir="$(mktemp -d)"
trap 'rm -rf "${work_dir}"' EXIT

required_env=(
  FCOS_QCOW2_URL FCOS_QCOW2_SHA256
  FCOS_SSH_PUBLIC_KEY FCOS_CORE_PASSWORD_HASH
  FCOS_INTERFACE FCOS_LAN_IP
)
for var in "${required_env[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    printf 'deploy-local: missing required environment variable: %s\n' "$var" >&2
    exit 1
  fi
done

: "${HYPERVISOR_HOST:=localhost}"
: "${HYPERVISOR_USER:=${USER}}"
: "${HOST_OS:=secureblue}"
: "${FCOS_VM_NAME:=fcos-kasm-poc}"
: "${FCOS_LAN_CIDR:=192.168.1.0/24}"
: "${FCOS_GATEWAY:=192.168.1.1}"
: "${FCOS_NETWORK_BRIDGE:=br0}"
: "${FCOS_VM_MEMORY_MB:=4096}"
: "${FCOS_VM_VCPUS:=2}"
: "${FCOS_VM_DISK_GB:=75}"
: "${FCOS_STORAGE_MOUNTPOINT:=/mnt/nvme}"

# --- 1. Render Ignition from the modular vm-host tree ----------------------
echo "==> Rendering vm-host Ignition"
( cd "${vm_host_dir}" && ./build.sh )
ignition="${vm_host_dir}/vm-host.ign"

# --- 2. Build inventory + deploy vars ---------------------------------------
echo "==> Building Ansible inventory and deploy vars"
case "${FCOS_IMAGE_DIR:-}" in
  "" ) image_dir="$( [[ "${HOST_OS}" == alpine ]] \
        && echo "${FCOS_STORAGE_MOUNTPOINT}/libvirt/images" \
        || echo /var/lib/libvirt/images )" ;;
  /*) image_dir="${FCOS_IMAGE_DIR}" ;;
  * ) echo "FCOS_IMAGE_DIR must be absolute" >&2; exit 1 ;;
esac

ansible_connection=ssh
become_method=""
case "${HYPERVISOR_HOST}" in
  localhost|127.0.0.1|::1)
    ansible_connection=local
    # Secureblue has no sudo; run0 provides polkit-based privilege escalation.
    become_method='    "ansible_become_method": "community.general.run0",'
    ;;
esac

cat > "${work_dir}/inventory.json" <<INVENTORY
{"all":{"children":{"hypervisors":{"hosts":{"hypervisor":{
  "ansible_host": "${HYPERVISOR_HOST}",
  "ansible_user": "${HYPERVISOR_USER}",
${become_method}
  "ansible_connection": "${ansible_connection}"
}}}}}}
INVENTORY

cat > "${work_dir}/deploy-vars.json" <<VARS
{
  "host_os": "${HOST_OS}",
  "fcos_vm_name": "${FCOS_VM_NAME}",
  "fcos_qcow2_url": "${FCOS_QCOW2_URL}",
  "fcos_qcow2_sha256": "${FCOS_QCOW2_SHA256}",
  "fcos_lan_ip": "${FCOS_LAN_IP}",
  "fcos_lan_cidr": "${FCOS_LAN_CIDR}",
  "fcos_gateway": "${FCOS_GATEWAY}",
  "fcos_interface": "${FCOS_INTERFACE}",
  "fcos_network_bridge": "${FCOS_NETWORK_BRIDGE}",
  "fcos_vm_memory_mb": ${FCOS_VM_MEMORY_MB},
  "fcos_vm_vcpus": ${FCOS_VM_VCPUS},
  "fcos_vm_disk_gb": ${FCOS_VM_DISK_GB},
  "fcos_storage_mountpoint": "${FCOS_STORAGE_MOUNTPOINT}",
  "fcos_image_dir": "${image_dir}",
  "fcos_domain_dir": "${image_dir}/domains",
  "fcos_ignition_local_path": "${ignition}"
}
VARS

python3 -m json.tool "${work_dir}/inventory.json" >/dev/null
python3 -m json.tool "${work_dir}/deploy-vars.json" >/dev/null

# --- 3. Run the playbook -----------------------------------------------------
if [[ "${DRY_RUN:-0}" == "1" ]]; then
  echo "==> DRY_RUN: generated files"
  echo "inventory:  ${work_dir}/inventory.json"
  cat "${work_dir}/inventory.json"
  echo "deploy vars:"
  cat "${work_dir}/deploy-vars.json"
  trap - EXIT
  exit 0
fi
echo "==> Running deploy-fcos-vm.yml against ${HYPERVISOR_HOST}"
exec ansible-playbook \
  -i "${work_dir}/inventory.json" \
  playbooks/deploy-fcos-vm.yml \
  --extra-vars "@${work_dir}/deploy-vars.json" \
  "$@"
