# Cloud setup

This document lists prerequisites. It does not provision cloud roles or enable mutation.

## AWS

1. Register target EC2 instances as Systems Manager managed nodes.
2. Configure SSM Inventory and Patch Manager baselines/policies for supported OS repositories.
3. Create a dedicated GitHub OIDC IAM role for read-only discovery.
4. Restrict the trust policy to this repository, branch/environment, and audience.
5. Create separate execution roles only after the provider executor is implemented, reviewed, and tested.
6. Scope SSM permissions to BU accounts/resources and approved command documents.
7. Put non-secret role ARN and region values in GitHub Environment variables.

References:
- https://docs.aws.amazon.com/systems-manager/latest/userguide/what-is-systems-manager.html
- https://docs.aws.amazon.com/systems-manager/latest/userguide/patch-manager.html
- https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws

## Azure

1. Enroll VMs in Azure Update Manager and verify supported guest agents/repositories.
2. Create a Microsoft Entra federated credential for GitHub OIDC.
3. Scope discovery permissions to approved subscriptions/resource groups.
4. Use a separate least-privilege identity for execution.
5. Configure maintenance configurations and BU maintenance windows.
6. Store tenant/client/subscription identifiers as GitHub Environment variables.

References:
- https://learn.microsoft.com/en-us/azure/update-manager/overview
- https://learn.microsoft.com/en-us/azure/virtual-machines/linux/run-command
- https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-azure

## GitHub Environments

Create inventory-readonly, patch-nonprod, and patch-production Environments. Require reviewers for non-production/production as appropriate, restrict deployment branches, and prevent self-review for production where available.

The starter workflow intentionally blocks resource mutation until provider-specific execution, validation, rollback, and IAM/RBAC have been reviewed.
