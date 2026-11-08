# ClamAV

FCOS Ansible configures daily `clamscan` at 02:00 with dated logs under `/var/log/clamav`. FreshClam is separate. Detections require review; no automatic delete/quarantine. Exclude pseudo-filesystems and transient mounts.
