# Provider selection matrix

Choose after verifying current support, model IDs, account access, security requirements, and pricing.

| Option | Best fit | Configuration boundary |
|---|---|---|
| Cline API | One API endpoint for supported models through Cline | Cline API key + available API model ID |
| Anthropic API | Direct Anthropic model access | Anthropic key + supported model ID |
| OpenAI API | OpenAI models / compatible tooling | OpenAI key + supported model ID |
| AWS Bedrock | AWS account, IAM, region and governance controls | AWS credentials/profile/region + Bedrock model access |
| OpenRouter | Model-provider choice through a router | OpenRouter key + router model ID |
| Ollama | Local inference endpoint | Local runtime/model; compute and context limits |

No provider is automatically preferred. Compare quality, price, latency, quotas, privacy/data retention, geography, resilience, and tool/reasoning support. Model IDs are not interchangeable.
