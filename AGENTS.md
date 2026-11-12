# Agent rules

- **VM provisioning:** all VM provisioning for `vm-host/` must run inside a
  container via the `burnerbox`/`burnercommand` shell functions (the repo's
  `make up` / `container/up.sh` path is the in-repo equivalent). Never run
  `deploy.sh` or `make deploy` directly on the host.
- **Podman on Secureblue:** containers run in the podman machine; if the
  socket refuses connections, run `podman machine` reset/recover (e.g.
  `podman machine reset` / recover rootless) before retrying. Use
  `CONTAINER_HOST=unix:///run/user/1000/podman/podman-machine-default-api.sock`
  if `podman.sock` refuses.
- **Branch:** always work on and commit to the `devin` branch only. Before
  any commit, verify `git branch --show-current` is `devin`. Never commit
  to `main`, `mistral`, or any other branch unless the user explicitly
  overrides this rule.
