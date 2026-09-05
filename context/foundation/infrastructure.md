---
project: flashcards
researched_at: 2026-06-04
recommended_platform: Cloudflare Workers
runner_up: Vercel
context_type: mvp
tech_stack:
  language: TypeScript / JavaScript
  framework: Astro 6
  runtime: Cloudflare workerd (via @astrojs/cloudflare v13.6.1)
---

## Recommendation

**Deploy on Cloudflare Workers.**

For an Astro 6 + Supabase SRS app that is stateless (no persistent connections), expects a global audience, and prioritizes developer experience, Cloudflare Workers wins all five agent-friendly criteria and is already the project's configured target — Astro 6's dev server runs the real `workerd` runtime, giving dev/prod parity out of the box. The interview answers reinforce it: "global reach" favors the edge-native platform, "no persistent connections" keeps the serverless model in play, and "external DB fine" means Supabase staying off-platform is a non-issue. The runner-up is **Vercel** (most mature Astro adapter, smoothest DX) in case Cloudflare's risks bite.

> **Stack-contract note:** `tech-stack.md` still carries `deployment_target: cloudflare-pages`. That hint is **stale** — `@astrojs/cloudflare` v13.6.1 (the version Astro 6 ships) is **Workers-only**; Pages support was removed. Update the hint to `cloudflare-workers` so the contract stops pointing the agent at the deprecated path. See Risk Register R4.

## Platform Comparison

Hard filters applied first: persistent connections **not** required (Q1 = No) → no platform dropped for serverless-only limits; Astro is adapter-portable → no platform dropped on runtime. Interview answers then reweighted the criteria: **global reach** (Q4) favors edge-native platforms; **DX over cost** (Q2) means paid tiers aren't penalized but cold-start/sleep behavior is; **no familiarity** (Q3) means no tie-break bias; **external DB fine** (Q5) removes any co-location bonus.

| Platform               | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | Verdict                     |
| ---------------------- | --------- | ------------------ | ------------------- | ----------------- | ----------------- | --------------------------- |
| **Cloudflare Workers** | Pass      | Pass               | Pass                | Pass              | Pass              | **5 Pass**                  |
| **Vercel**             | Pass      | Pass               | Pass                | Pass              | Partial           | 4 Pass / 1 Partial          |
| **Netlify**            | Pass      | Pass               | Pass                | Pass              | Pass              | 5 Pass                      |
| **Fly.io**             | Pass      | Partial            | Pass                | Pass              | Fail              | 3 Pass / 1 Partial / 1 Fail |
| **Railway**            | Pass      | Pass               | Partial             | Pass              | Fail              | 3 Pass / 1 Partial / 1 Fail |
| **Render**             | Partial   | Pass               | Partial             | Pass              | Fail              | 2 Pass / 2 Partial / 1 Fail |

**Per-platform notes:**

- **Cloudflare Workers** — `wrangler` covers the full operational loop (`deploy`, `rollback`, `secret put`, `tail`, `deployments list`). Fully managed edge with automatic TLS/routing/scaling. Docs published as `llms.txt` + markdown on GitHub. `wrangler deploy` is deterministic. Multiple first-party MCP servers (docs, Workers, observability). Edge-native, so global reach is native.
- **Vercel** — Mature, zero-config `@astrojs/vercel` adapter and the strongest DX of the set; `vercel` CLI and `vercel --prod` are stable. Docs are MDX on GitHub. Vercel MCP exists but is **beta as of 2026-06** → Partial on the MCP criterion. Serverless functions are regional by default (edge functions available). Strong runner-up given the DX priority.
- **Netlify** — Also 5/5: solid `netlify` CLI, **draft-by-default deploys** (must pass `--prod` to publish — a safe default for agents), good docs, and an **official GA MCP server**. Slightly less Astro-leading DX than Vercel, which is why it lands third despite matching the criteria.
- **Fly.io** — `flyctl` is strong and `fly deploy` is deterministic, but managed _VMs_ mean more operational surface (regions, machines) than a stateless edge app needs, no first-class MCP, and **no free tier in 2026** (2-hour / 7-day trial only). Overkill here.
- **Railway** — Great DX and clean CLI, but **container/regional, not edge** → weak against the "global" answer; no first-class MCP; $5/mo Hobby, no permanent free tier.
- **Render** — Thin CLI (deploy hooks + API), and the free tier **sleeps after 15 min of inactivity** → cold starts would violate the PRD's "perceptibly immediate" guardrail on the review path. Eliminated for this app.

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Wins on every criterion, is edge-native (matching the global-reach answer), and is already the project's configured target with Astro 6 workerd dev parity. The agent can run the entire ops loop from a terminal via `wrangler`. No cost penalty at MVP scale (generous free tier; no sleep/cold-start that would break the latency guardrail for cached/static paths).

#### 2. Vercel

The most mature Astro SSR adapter and the smoothest end-to-end DX — directly aligned with the "prioritize DX" answer. Edge network gives reasonable global reach. Gap vs. the leader: its MCP is still **beta**, Astro is not its primary framework (Next.js is), and functions are regional by default. Best fallback if any Cloudflare-specific risk (workerd compat, Supabase-on-Workers auth edge cases) proves blocking.

#### 3. Netlify

Matches all five criteria with a **GA MCP** and draft-safe deploys, which is attractive for agent-driven ops. Gap vs. the leader: DX for Astro is a notch below Vercel, and there's no edge advantage over Cloudflare. A solid third option, mainly compelling if the GA MCP becomes a deciding factor over Vercel's beta one.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **Single-region Supabase vs. global edge.** Workers run at every edge POP, but Supabase lives in _one_ region. Every review action (reveal/rate) round-trips to that single region — "global edge" makes HTML fast but does nothing for DB-bound latency.
2. **No raw TCP Postgres on Workers.** Data access is committed to the `supabase-js`/PostgREST path or forced through **Hyperdrive**. Complex SRS batch queries are harder than from a Node host with a normal `pg` connection.
3. **`@supabase/ssr` cookie/session handling on workerd** behaves subtly differently from the Node examples most tutorials show; auth-refresh edge cases inside Astro middleware are a known sharp edge.
4. **Pages→Workers doc gap.** The project's own `cloudflare-pages` hint and most 2024–2025 tutorials are stale; `wrangler pages` commands silently don't match the v13 Workers adapter — high misconfiguration risk _because_ the ecosystem is mid-migration. Failure is confusing (deploy-succeeds-serves-nothing), not loud.
5. **`workerd` ≠ Node + per-request CPU limits.** `nodejs_compat` covers most but not all npm deps; any SRS/date library must be verified on workerd before being depended on.

### Pre-Mortem — How This Could Fail

The dev ships to Workers because the starter pointed there; dev parity is perfect thanks to the workerd dev server. Launch day, users in Asia load HTML instantly from the edge — but every "reveal/submit rating" round-trips to Supabase in us-east, adding 250–400ms per interaction, and the "perceptibly immediate" guardrail quietly breaks. They reach for Hyperdrive, but it caches _reads_, not the _writes_ that ratings produce, and the read-staleness makes a just-rated card reappear. Meanwhile `@supabase/ssr` cookie handling on workerd drops sessions intermittently because the copied examples assumed Node. Debugging drags because they followed a 2025 _Pages_ tutorial whose `wrangler pages` commands don't match the v13 adapter. Six months in, the app is a tangle of region-latency workarounds and auth flakiness — not because Cloudflare is bad, but because nobody priced single-region Supabase against a global edge, or the Pages→Workers doc gap.

### Unknown Unknowns

- The `cloudflare-pages` hint is **stale**: `@astrojs/cloudflare` v13.6.1 (Astro 6) deploys to **Workers via `wrangler deploy`**, not Pages. Pages config/commands will mislead.
- Astro 6's dev server **already runs on workerd**, so there is **no separate platform-native dev command** (`wrangler pages dev` is legacy here) — older guides add a redundant step.
- **Edge ≠ fast DB.** Interaction latency is governed by distance to the single Supabase region, not the edge POP.
- TCP Postgres is unavailable on Workers without **Hyperdrive**; data access is effectively committed to `supabase-js`/PostgREST (or Hyperdrive).
- Per-request **CPU limits** + `nodejs_compat` gaps can break specific deps — verify the SRS/date libraries on workerd first.

## Operational Story

- **Preview deploys**: Wire GitHub Actions to run `astro build && wrangler versions upload` on PRs — this creates a **preview version** with its own `*.workers.dev` preview URL without promoting to production. Production publish happens only via `wrangler deploy` (or `wrangler versions deploy`) on merge to `main`. Fork PRs won't have repo secrets, so their preview builds will fail auth-dependent paths — expected.
- **Secrets**: `SUPABASE_URL` and `SUPABASE_KEY` live as **Workers secrets** set with `wrangler secret put <NAME>` (encrypted, not readable back), and mirrored in **GitHub repository secrets** for CI. Local dev reads them from `.env` (gitignored). Rotation: update in Supabase → `wrangler secret put` → update GitHub secret. Never commit them or place them in `wrangler.jsonc`.
- **Rollback**: `wrangler rollback` reverts to the previous version (or pass a version ID from `wrangler deployments list`). Time-to-revert is seconds. **Caveat:** code rolls back, but any **Supabase schema migration does not** — a rollback that crosses a migration boundary can mismatch code against schema. Treat DB migrations as forward-only and gate them separately.
- **Approval**: An agent may run `astro build`, `wrangler versions upload` (preview), `wrangler tail`, and `wrangler deployments list` unattended. **Human-only:** promoting to production on first deploy, rotating `SUPABASE_KEY`, and any destructive Supabase action (dropping tables, deleting the project) — done by hand in the respective dashboard/CLI even when the agent suggests it.
- **Logs**: `wrangler tail` streams live request/console/exception logs (`--status error`, `--search "<term>"` to filter). Historical logs via Workers Logs (enable `observability` in `wrangler.jsonc`). Both are read-only and terminal-accessible for the agent.

## Risk Register

| Risk                                                                                                                      | Source                              | Likelihood | Impact | Mitigation                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DB-bound latency for users far from the single Supabase region breaks the "perceptibly immediate" NFR                     | Devil's advocate / Pre-mortem       | M          | M      | Pick the Supabase region closest to the expected user majority; measure real interaction latency before launch; only add Hyperdrive if reads dominate (it does not help auth/writes) |
| Stale `cloudflare-pages` hint + old tutorials lead to `wrangler pages` misconfiguration (deploy succeeds, serves nothing) | Unknown unknowns / Research finding | M          | M      | Update `tech-stack.md` to `cloudflare-workers`; pin CI and docs to `astro build && wrangler deploy`; do one manual deploy + walk a real SSR/auth flow before wiring CI               |
| `@supabase/ssr` cookie/session handling behaves differently on workerd than in Node examples                              | Devil's advocate / Pre-mortem       | M          | M      | Use Cloudflare's own Supabase-on-Workers guide; test login + session refresh on a real deploy, not just `astro dev`; don't copy Node-host auth snippets verbatim                     |
| An npm dep (SRS/date lib) relies on a Node API not covered by `nodejs_compat`, or hits per-request CPU limits             | Devil's advocate / Unknown unknowns | L          | M      | Verify each runtime dep on workerd early (`astro dev` runs workerd, so this surfaces in dev); prefer Web-standard / edge-safe libraries                                              |
| Rollback crosses a Supabase migration boundary → code/schema mismatch                                                     | Research finding                    | L          | H      | Keep migrations forward-only; never couple a code rollback to a schema revert; gate migrations as a separate, human-approved step                                                    |
| Vendor lock-in to Workers-specific bindings/config makes the runner-up (Vercel) swap costly later                         | Pre-mortem                          | L          | L      | Keep platform-specific logic thin and behind the adapter; Astro's adapter abstraction makes a Vercel swap an adapter change, not a rewrite                                           |

## Getting Started

Commands validated against the pinned stack (Astro 6 + `@astrojs/cloudflare` v13.6.1, Workers target) — **not** generic Pages tutorials.

1. **Add the Cloudflare adapter (Workers target):**

   ```
   npx astro add cloudflare
   ```

   This sets `output: 'server'` and the adapter in `astro.config.mjs`.

2. **Create `wrangler.jsonc`** with the Workers entry point the adapter generates:

   ```jsonc
   {
     "name": "flashcards",
     "main": "./dist/_worker.js/index.js",
     "compatibility_date": "2026-06-04",
     "compatibility_flags": ["nodejs_compat"],
     "assets": { "binding": "ASSETS", "directory": "./dist" },
     "observability": { "enabled": true },
   }
   ```

3. **Set secrets** (do not put them in `wrangler.jsonc`):

   ```
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_KEY
   ```

4. **Build and do the first deploy manually**, then open the URL and walk a real SSR/auth flow (log in, open a review session) to confirm the Workers config is correct _before_ wiring CI:

   ```
   npx astro build
   npx wrangler deploy
   ```

   Note: local dev is just `npx astro dev` — Astro 6's dev server already runs the `workerd` runtime, so there is **no** separate `wrangler pages dev` / `wrangler dev` step.

5. **Update the stack contract:** change `deployment_target` in `context/foundation/tech-stack.md` from `cloudflare-pages` to `cloudflare-workers` so downstream skills and agents stop following the deprecated Pages path.

## Out of Scope

The following were not evaluated in this research:

- Docker image configuration
- CI/CD pipeline setup (GitHub Actions wiring is sketched in the Operational Story but not built here)
- Production-scale architecture (multi-region, HA, DR, Hyperdrive rollout strategy beyond MVP)
