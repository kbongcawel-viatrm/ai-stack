# vm-host — direct host-side build & deploy (no CI, no Ansible)
#
# Typical run on the hypervisor:
#   FCOS_SSH_PUBLIC_KEY='ssh-ed25519 ...' FCOS_CORE_PASSWORD_HASH='$6$...' \
#   make deploy            # renders vm-host.ign, then provisions the VM
#
# Per-target env overrides (see build.sh / deploy.sh headers for the full set):
#   VM_NAME, VM_RAM_MB, VM_VCPUS, VM_DISK_GB, BRIDGE, IMAGE_DIR, FCOS_LAN_IP,
#   ENABLE_* module toggles, FCOS_QCOW2_URL + FCOS_QCOW2_SHA256 (pin together)

SHELL := /bin/bash
VM_NAME    ?= fcos-kasm
FCOS_LAN_IP ?= 192.168.1.201
LIBVIRT_URI ?= qemu:///system

.PHONY: deploy ignition status console ssh logs clean help

deploy: ignition ## Render Ignition, then provision the VM on this host
	./deploy.sh

ignition: ## Render vm-host.ign from the butane modules
	./build.sh

status: ## Show domain state and address info
	@virsh -c $(LIBVIRT_URI) dominfo $(VM_NAME) || true
	@virsh -c $(LIBVIRT_URI) list --all

console: ## Attach to the VM serial console (Ctrl-] to detach)
	virsh -c $(LIBVIRT_URI) console $(VM_NAME)

ssh: ## SSH to the guest core user
	ssh core@$(FCOS_LAN_IP)

logs: ## Tail first-boot provisioning units on the guest
	ssh core@$(FCOS_LAN_IP) 'journalctl -u security-setup.service -u security-finalize.service -u kasm-workspace.service --no-pager -n 100'

clean: ## Undefine the domain and delete its overlay disk (base image kept)
	virsh -c $(LIBVIRT_URI) shutdown $(VM_NAME) 2>/dev/null || true
	virsh -c $(LIBVIRT_URI) destroy $(VM_NAME) 2>/dev/null || true
	virsh -c $(LIBVIRT_URI) undefine $(VM_NAME) 2>/dev/null || true
	rm -f /var/lib/libvirt/images/$(VM_NAME).qcow2
	@echo "domain + overlay removed (base image and Ignition files kept)"

help: ## List targets
	@grep -E '^[a-zA-Z_-]+:.*?##' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  %-12s %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
