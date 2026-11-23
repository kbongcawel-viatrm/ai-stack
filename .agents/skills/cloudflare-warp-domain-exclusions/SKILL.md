---
name: cloudflare-warp-domain-exclusions
description: Add user-requested hostnames to Cloudflare One WARP device-profile Split Tunnel Exclude lists for selected platforms while preserving existing routes. Use for future requests to bypass WARP routing for specific public application domains.
---

# Cloudflare WARP Domain Exclusions

## Purpose

Use this skill when the user asks to add domains/hostnames to Cloudflare One device-profile **Exclude Split Tunnel** settings, especially for Windows, Android, and iOS devices in the `home-sec-uk` account.

The workflow changes only the requested device profiles' Split Tunnel exclusion lists. It does not change DNS, Gateway policies, Access applications, tunnels, routes, or Worker configuration.

## Account context

- Cloudflare account: `home-sec-uk`
- Account ID: `7e1714b3d1b32fcaad4a5029c638cde4`
- Cloudflare Zero Trust device-profile APIs are account-scoped.
- Use the Cloudflare MCP configuration and the account above for Cloudflare operations.
- Never expose API tokens, credentials, or secrets.

## Known device profiles

Discover profiles from the live API before every change. Names and IDs below are reference context, not a substitute for live inspection.

| Profile | Last observed policy ID | Match |
|---|---|---|
| WARP for Windows | `4d7671b0-f173-4aee-b3d0-7cafbb9c58b9` | `identity.email == "dummykevin08@gmail.com" and os.name == "windows"` |
| Android | `2ee3e68d-f9bc-4bc9-894b-e297b9b3b302` | `os.name == "android"` |
| iOS | `4e6f0113-7d7d-4b9b-a4e9-a1053e275f46` | `os.name == "ios"` |
| Linux | `cb407ee4-202b-4294-8c13-3171cc705e79` | `os.name == "linux"`; last observed in Include mode |

Do not modify Linux unless the user explicitly requests it. Do not modify the default profile or other profiles unless the user requests those platforms/profiles.

## Required behavior

1. **Parse the request.** Extract the exact hostnames and requested platforms/profiles. If the user says "all platforms" or names Windows, Android, and iOS, target only those named profiles. If the requested profile/platform is ambiguous, ask one concise clarification.
2. **Validate hostnames.** Accept bare hostnames such as `app.example.com`. Reject URL schemes, paths, ports, wildcards, IP addresses, and malformed hostnames unless the user explicitly asks for a supported wildcard. Do not silently broaden a hostname to `*.example.com`.
3. **Inspect live state.** Call the Cloudflare API to list device settings profiles:
   - `GET /accounts/{account_id}/devices/policies`
   Then inspect each selected profile and its Split Tunnel exclusion list:
   - `GET /accounts/{account_id}/devices/policy/{policy_id}`
   - `GET /accounts/{account_id}/devices/policy/{policy_id}/exclude`
4. **Check mode.** Confirm the selected profile is using Exclude mode (has `exclude`, not `include`). Never switch a profile between Include and Exclude modes as part of this workflow. If a selected profile is in Include mode, stop and explain that an exclusion cannot be added without changing the profile's routing model; ask before proposing a mode change.
5. **Preserve existing entries.** Build the new list from the current live exclusion list. Append only missing requested hostnames as objects:
   ```json
   {"host":"app.example.com","description":"User-requested WARP bypass"}
   ```
   Preserve every existing IP/CIDR and hostname entry, its description, and ordering. Do not replace the list with only the new hostnames. Make the operation idempotent: do not add duplicate host entries.
6. **Apply only after explicit user approval.** A request such as "add these domains" or "please proceed" is authorization for those exact domains and profiles. Do not add unrequested domains or change unrelated settings.
7. **Write the complete merged list** using:
   - `PUT /accounts/{account_id}/devices/policy/{policy_id}/exclude`
   - JSON request body is the full array of existing entries plus additions.
   Do not use the default-profile endpoint unless the user specifically requests the default profile.
8. **Verify by read-back.** After each successful write, GET the exclusion list again and verify every requested hostname is present exactly. Report per-profile results and any API errors. Never claim success based only on the PUT response.
9. **Report propagation.** Tell the user device-profile changes may take up to 10 minutes to propagate. Recommend reconnecting the Cloudflare One Client/WARP if changes do not take effect.

## Important security and routing implications

- Exclude mode sends traffic for the listed hostname outside the WARP tunnel. Gateway will not inspect that bypassed traffic at the network/HTTP layer.
- A Split Tunnel exclusion does **not** bypass Cloudflare Access, WAF, origin authentication, or application-level authorization. Those controls remain independently enforced.
- Split Tunnel exclusions affect IP traffic. DNS requests may still be handled by Gateway and remain subject to DNS policies. Do not add Local Domain Fallback entries unless separately requested and appropriate.
- Domain-based split tunneling can affect other hostnames that resolve to the same shared/CDN IP address. Explain this risk when relevant, particularly for Cloudflare-hosted domains.
- The client must handle the DNS lookup for the hostname for dynamic domain-based routing to work; cached or browser-secure-DNS lookups can affect behavior.
- Do not promise that an exclusion alone guarantees application reachability. It only changes WARP routing; DNS, Access, Gateway DNS policy, origin availability, and browser behavior may still matter.

## Validation and output

For each selected profile, report:
- Profile name and policy ID (optional in concise output).
- Number of exclusions before and after.
- Requested hostnames added versus already present.
- Read-back verification result.

Do not expose unrelated profile details or secrets. State clearly if any profile was skipped because it uses Include mode or could not be verified.

## Cloudflare API references

- Device profiles: https://developers.cloudflare.com/cloudflare-one/team-and-resources/devices/cloudflare-one-client/configure/device-profiles/
- Split Tunnels: https://developers.cloudflare.com/cloudflare-one/team-and-resources/devices/cloudflare-one-client/configure/route-traffic/split-tunnels/
