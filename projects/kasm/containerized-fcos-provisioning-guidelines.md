# Safety & Best-Practice Guidelines: Provisioning Fedora CoreOS VMs from a Containerized Environment

## Overview
This document serves as a reference guide for safely provisioning a **Fedora CoreOS (FCOS)** virtual machine on a **Libvirt/QEMU** host from inside a **Toolbox container** using **Butane** and **Ansible**, with the target workload being **Kasm Workspaces**.

By using a container as a provisioning control plane rather than a VM host, you keep your hypervisor host clean while retaining full hardware acceleration and native Ignition boot behavior for the guest VM.

---

## 1. Architecture & Separation of Concerns

* **Container as Control Plane Only:** Use the Toolbox container strictly to run automation tools (`butane`, `ansible`, `virt-install`, `virsh`). Never run the FCOS VM inside the container itself.
* **Host-Level Hypervisor Execution:** Communicate with the host's Libvirt daemon (`qemu:///system`) so the FCOS VM runs directly on the host kernel with KVM acceleration.
* **Immutable Guest Paradigm:** Treat Fedora CoreOS as an immutable appliance. Perform system-level initialization once via **Ignition** (transpiled from Butane) and manage application workloads (Kasm Workspaces) declaratively via containers and systemd units.

---

## 2. Toolbox & Host Isolation Precautions

Because Toolbox shares your user session, `/home` directory, and D-Bus with the host OS, actions inside the container can directly affect host-level virtualization resources.

* **Avoid Root/Sudo Inside Toolbox for Libvirt:** Add your unprivileged host user to the `libvirt` group on the host OS. Connect using `virsh --connect qemu:///system` inside Toolbox without escalating to root.
* **Isolate Working Directories:** Keep all working artifacts—Butane files (`.bu`), compiled Ignition files (`.ign`), QCOW2 base images, and Ansible inventories—inside a dedicated project directory (e.g., `~/projects/kasm-fcos/`) rather than writing directly to `/var/lib/libvirt/images` during development.
* **Maintain SELinux File Contexts:** When copying or uploading `.ign` and `.qcow2` files into Libvirt's storage pool (`/var/lib/libvirt/images`), ensure proper SELinux labels are applied (e.g., via `virsh vol-upload` or running `restorecon -Rv /var/lib/libvirt/images` on the host) so QEMU does not encounter permission denials.
* **Pin Tool Versions in Toolbox:** Document or script the packages installed inside your Toolbox (`butane`, `ansible-core`, `python3-libvirt`, `virt-install`) so your provisioning environment can be rebuilt reproducibly if needed.

---

## 3. Butane & Ignition Validation Safety

Ignition executes **only once** during the first boot of a Fedora CoreOS VM. Any syntax error or misconfiguration can prevent the VM from booting or lock out SSH access.

* **Validate Strictly Before Booting:** Always validate Butane configurations before transpiling:
  ```bash
  butane --pretty --strict config.bu > config.ign
  ```
* **Never Commit Plaintext Secrets:** Do not hardcode passwords, API keys, or private SSH keys inside `.bu` files tracked in version control. Use `ssh_authorized_keys` for initial access and inject application secrets later via Ansible Vault.
* **Restrict Ignition File Permissions:** If a generated `.ign` file contains sensitive bootstrap data or certificates, restrict its permissions immediately (`chmod 600 config.ign`) and remove temporary copies after the VM completes its first boot.
* **Respect FCOS Filesystem Layout:**
  * `/usr` is read-only. Never configure Butane or Ansible to write binaries or configs to `/usr`.
  * `/etc` and `/var` are writable and persistent.
  * `/opt` is a symlink to `/var/opt` (writable). Place Kasm installation files under `/opt/kasm` or `/var/opt/kasm`.

---

## 4. Fedora CoreOS & Kasm Host Hardening

Fedora CoreOS enforces strict security defaults and automatic updates that must be accounted for when hosting stateful multi-user sessions like Kasm Workspaces.

* **Control Automatic Reboots (Zincati):** FCOS automatically downloads updates via `rpm-ostree` and reboots via Zincati. Configure a periodic maintenance window in Butane so the host VM does not reboot unexpectedly during active Kasm user sessions.
* **Keep SELinux Enforcing:** Do not disable SELinux globally (`selinux=0`) to work around container volume permissions. Keep SELinux in `enforcing` mode and apply proper volume labels (`:Z` or `:z`) on Kasm bind mounts in `/opt/kasm`.
* **Explicit Firewall Rules:** Configure `firewalld` via Butane or Ansible to expose only necessary ports:
  * **TCP 443:** Kasm Workspaces web interface.
  * **TCP 22:** SSH access (ideally restricted to your administrative subnet).
  * Keep internal Docker bridge networks isolated from external interfaces.
* **Enable Container Runtime Explicitly:** Enable `docker.service` via Butane (as Kasm relies on Docker and Docker Compose v2) and place the `docker-compose` plugin binary in `/usr/local/bin` (which is writable on FCOS).
* **Provision Swap and Dedicated Storage:** Kasm workspaces are memory-intensive. Configure a dedicated swap file or partition (at least 4–8 GB) via Butane and allocate a sufficiently sized virtual disk for `/var/lib/docker` and `/opt/kasm` so container images cannot exhaust the root filesystem.

---

## 5. Safe Ansible Execution Practices

When running Ansible playbooks from inside Toolbox against the newly provisioned FCOS VM:

* **Isolate Temporary SSH Host Keys:** During iterative testing where VMs are frequently destroyed and recreated, avoid disabling host key verification globally. Instead, pass a dedicated temporary `known_hosts` file in your Ansible SSH arguments:
  ```bash
  ansible-playbook -i inventory.ini playbook.yml --ssh-common-args='-o UserKnownHostsFile=/tmp/fcos_known_hosts'
  ```
* **Encrypt Credentials with Ansible Vault:** Store Kasm `admin` passwords, `user` passwords, database secrets, and custom TLS private keys inside an encrypted `vault.yml` file rather than plaintext inventory or variable files.
* **Account for Minimal Base OS (No Python by Default):** Stock FCOS does not ship with Python installed. Either use `ansible.builtin.raw` modules for lightweight tasks, deploy Kasm declaratively via templated Docker Compose files and systemd units, or layer `python3` cleanly via `rpm-ostree` if full Ansible module support is required.
* **Dry-Run Before Applying Changes:** Run `ansible-playbook --check --diff` before applying updates to an existing Kasm deployment to verify that configuration templates will not overwrite active session data or volumes.
* **Snapshot Before Upgrades:** Before executing Ansible playbooks that upgrade Kasm Workspaces or modify host storage, create a Libvirt snapshot (`virsh snapshot-create-as`) so you can roll back cleanly if an issue occurs.

---

## 6. Pre-Flight Verification Checklist

Before launching your provisioning run from inside Toolbox, verify the following:

- [ ] Host user belongs to the `libvirt` group and `virsh --connect qemu:///system list` succeeds without `sudo` inside Toolbox.
- [ ] `butane --strict` passes with zero warnings or errors on your `.bu` configuration.
- [ ] No plaintext passwords or private keys exist in version-controlled `.bu` or Ansible files.
- [ ] Zincati update windows and swap space are defined in the Butane config.
- [ ] SELinux remains in `enforcing` mode on both host and guest, with proper `:Z` labels on Kasm storage mounts.
- [ ] Ansible secrets are encrypted with `ansible-vault` and SSH host keys use an isolated `known_hosts` path during testing.
