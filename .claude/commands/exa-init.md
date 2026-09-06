---
description: Set up or verify the Exa MCP server (AI-native web search) for this project
---

# Exa MCP setup

**Canonical reference:** https://docs.exa.ai/reference/exa-mcp — if anything below
contradicts real MCP behaviour, fetch that URL first; it is the source of truth for
setup, auth, and the tool list. Report staleness back to the user.

## What it is

Exa is an AI-native search API built for agents: technical queries, clean markdown
results, short latency. Used here for external research — comparing libraries,
algorithms, and approaches before `/10x-plan` turns them into a contract.

## Install (run in a terminal, outside the agent)

```bash
claude mcp add --transport http exa https://mcp.exa.ai/mcp
```

Optional — enable the full non-deprecated tool set by appending a `tools=` param:

```bash
claude mcp add --transport http exa "https://mcp.exa.ai/mcp?tools=web_search_exa,web_fetch_exa,web_search_advanced_exa"
```

**Auth:** OAuth, no API key. The client opens a browser for sign-in on first
connection. Account and usage: https://dashboard.exa.ai (free tier: 1000 queries).

**Troubleshooting:** if the tools do not appear, restart the MCP client / start a
fresh session, then check `/mcp` shows `exa` as connected.

## How to use it in this project

Exa answers "what should we do?" — the codebase cannot. Pair it with
`/10x-research`, which answers "what does our codebase already do?".

Query discipline:

- Aim at **technical documentation**, not listicles. "ts-fsrs API scheduling state
  shape" beats "best SRS library 2026" — the latter returns SEO spam.
- Ask for 2-3 candidates with trade-offs, not one winner.
- Every claim that lands in a plan needs a URL behind it. No source, no claim.
- Follow up with Context7 (`resolve-library-id` → `get-library-docs`) for the
  winner's current API, so the plan quotes real functions instead of remembered ones.

Write the outcome into `context/changes/<change-id>/` so `/10x-plan` can read it as
`@<file>.md`.

## Resources

- Docs: https://exa.ai/docs
- Dashboard: https://dashboard.exa.ai
- Status: https://status.exa.ai
