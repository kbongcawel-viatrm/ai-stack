# Container PHP runtime updates

Do not patch PHP inside a running container or Kubernetes pod.

1. Update the approved PHP base image tag/digest.
2. Rebuild the application image in CI.
3. Run unit/integration tests and extension checks.
4. Generate an SBOM and scan the image.
5. Publish an immutable image digest to ECR, ACR, or an approved registry.
6. Deploy through the BU-owned release process.
7. Verify readiness, synthetic transactions, and error rates.
8. Promote progressively or roll back to the previous approved digest.

Major PHP upgrades require compatibility evidence and should be tested in parallel before production traffic shifts.

This starter does not deploy images to clusters or PaaS services.
