# fcos-kasm-platform — thin wrapper over build.sh / ansible-playbook.
#
#   make render       # butane -> build/config.ign
#   make provision    # render (if needed) + VM provision
#   make configure    # post-boot guest configuration
#   make all          # render -> provision -> configure
#   make clean        # remove build/
#   make PROFILE=kasm-only render
#
# Env: FCOS_SSH_PUBLIC_KEY, FCOS_CORE_PASSWORD_HASH (render/provision),
#      BUTANE, ANSIBLE_PLAYBOOK, INVENTORY — see build.sh header.

SHELL := /usr/bin/env bash
PROFILE ?=
export PROFILE

.PHONY: all render provision configure clean help

all: render provision configure

render provision configure:
	./build.sh $@

clean:
	./build.sh clean

help:
	@sed -n '2,12p' Makefile | sed 's/^# \{0,1\}//'
