# FCOS Butane

`fcos.bu` is the FCOS first-boot configuration source. Convert using a pinned Butane release:

```bash
butane --strict --pretty --output fcos.ign fcos.bu
```

Review Ignition before provisioning. Never commit secrets/private keys. FCOS image must already contain Suricata, Firewalld, AIDE, ClamAV and Lynis; Ansible configures them. Butane is not used for Ubuntu/Kasm.
