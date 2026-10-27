# Modular AI stack

AI models, an AI coding assistant, repo-based memory and skills, Linear for sessions and planning, and GitHub for source control.

## Diagram
https://excalidraw.com/#json=FHASE2MuEnxo-PBys7TUO,pwDQ6odBoOZ_RUu4iaoA4A
<img width="1020" height="660" alt="image" src="https://github.com/user-attachments/assets/4e3dc18e-2e82-4a4f-a270-572308a94fb7" />



Each part is described in more detail in [README.md](README.md).

1. **AI provider / model:** Anthropic API, AWS Bedrock, OpenAI API, or a local Ollama endpoint.
2. **AI assistant tool:** Cline or Cursor, running on each workstation.
3. **Memory + skills storage:** Rules and memory files committed in the repository.
4. **Session, workflow, and planning:** Linear, which holds sessions, planning, and documentation.
5. **Git repository for SCM:** GitHub, which holds the code and memory files and receives pull requests.

## Workflow

1. Choose a provider and model in the Cline or Cursor settings.
2. Clone the GitHub repository. The rules and memory files load automatically.
3. Create or pick a Linear issue for the work. Use its ID in the branch name, for example `KEV-123-add-vpn-check`.
4. Work with the assistant. Update the memory files after significant milestones.
5. Before switching workstations, write a handoff summary as a Linear comment or document on the issue.
6. On the other workstation, pull the repository, read the Linear handoff, and continue.
7. Open a pull request. Linear links it to the issue through the branch name or PR title and moves the issue as the PR progresses.

## Notes and things to verify

- Linear is a planning tool, not a chat-transcript store. Save handoff summaries and decisions, not raw conversations.
- Cline's built-in task history is believed to be local to each machine. Confirm this for your version.
- Cline global custom instructions do not sync between machines. Put anything that must follow you into `.clinerules/` in the repository.
- Store provider API keys in a secrets manager or environment variables. Never commit them to the repository or post them in Linear.
