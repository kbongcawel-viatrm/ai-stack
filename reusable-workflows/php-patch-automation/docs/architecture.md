# Architecture

- GitHub Actions: approved orchestration and workflow execution.
- Python: inventory normalization, policy validation, classification, and reports.
- AWS Systems Manager: AWS managed-node inventory, Run Command, and Patch Manager.
- Azure Update Manager: supported Azure VM OS/package updates.
- Azure Run Command / Automation: custom guest remediation where approved.
- Container pipelines: immutable image rebuild and rollout.
- BU teams: application compatibility, maintenance approvals, and routine execution within BU scope.
- Central governance: policy, identity boundaries, shared workflows, reporting, and exceptions.

## Important limits

SSM managed-node inventory does not prove PHP is installed. Azure Resource Graph VM metadata does not report guest PHP packages. Guest runtime discovery must be supplied by an approved inventory mechanism. Resource tags are targeting metadata, not authoritative runtime state.

Patch-level updates and PHP major/minor migrations are different change types. A package manager updates what is available from configured repositories; it does not guarantee a runtime branch migration.

## Trust boundaries

- GitHub identity is federated into each cloud with OIDC.
- IAM/RBAC must enforce BU boundaries independently of Python filters.
- Protected GitHub Environments gate human approvals but do not replace cloud authorization.
- No cloud mutation adapter is enabled in this starter.
