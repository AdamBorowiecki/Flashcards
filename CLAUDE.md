# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A spaced-repetition flashcard web app for solo language learners. The core value is automatic scheduling: the learner rates a card ("missed it / got it / nailed it") and the SRS algorithm determines the next review date — they never decide what to study.

**Stack:** Astro 6 + Supabase (auth + PostgreSQL) + Cloudflare Pages, deployed via GitHub Actions on merge.

Foundation docs: `@context/foundation/prd.md` · `@context/foundation/tech-stack.md`

## Domain Model

- **Card:** front + back, belongs to one user, carries a `next_review_at` timestamp set by the SRS algorithm.
- **Review session:** cards with `next_review_at ≤ now` surface automatically on app open; no separate "due list" view.
- **Rating:** three levels — `missed_it`, `got_it`, `nailed_it`. This is the sole user input to the scheduling decision.
- **SRS invariant (non-negotiable):** `missed_it` must produce an earlier `next_review_at` than `got_it`, which must be earlier than `nailed_it`. A violation breaks the product's core value proposition.

## Access Control

Single-role flat model. Only authenticated users can access the app (redirect to sign-in otherwise). Each user sees only their own cards and progress. No admin, no teacher, no guest tier.

## Hard Out-of-Scope for v1

- Shared or collaborative decks
- Offline-first / service worker
- Native mobile app
- AI-generated card content

## Build Commands

```
npm run dev        # Astro dev server (Cloudflare workerd)
npm run lint       # ESLint with type-checked rules — run before committing
npm run lint:fix   # Auto-fix lint errors
npm run format     # Prettier (Astro + Tailwind plugins)
```

CI runs `astro sync` before `lint`. If type errors appear locally, run `npx astro sync` first.

## Environment Variables

Copy `.env.example` → `.env`:

- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_KEY` — Supabase anon key

CI reads these from repository secrets.

## TypeScript

`@/*` resolves to `./src/*`. Use `@/lib/supabase` style imports, not relative paths that cross `src/` boundaries.

## Node Version

`.nvmrc` pins `22.14.0`. Run `nvm use` before starting dev.

## Branch Convention

Default branch is `main`. CI triggers on push to `main` and PRs targeting `main`.

## Line Endings

LF enforced project-wide via `.gitattributes`. Do not configure or write CRLF.

---

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 2, Lesson 4

Prepare for a harder implementation stream with the **research-backed planning chain**:

```
internal research (/10x-research) + external research (exa.ai, Context7) -> /10x-plan -> /10x-implement -> success
```

The lesson focus is distinguishing internal from external research and using evidence to back planning decisions.

### Task Router - Where to start

| Skill | Use it when |
| --- | --- |
| **Internal research (lesson focus)** | |
| `/10x-research <change-id>` | You need evidence from the existing codebase — patterns, conventions, integration points, or existing implementations. Runs parallel sub-agents over the repo and writes structured findings to `research.md`. |
| **External research (lesson focus)** | |
| exa.ai | You need AI-native web search for library comparisons, best practices, or ecosystem context that the codebase cannot answer. |
| Context7 (`resolve-library-id` → `get-library-docs`) | You need live, current documentation for a specific library or framework. Resolves a library ID first, then fetches relevant doc pages. |
| **Framing spare wheel** | |
| `/10x-frame <change-id>` | The plan won't converge, the plan doesn't deliver expected results, or persistent drift keeps breaking the implementation. Use as an escape hatch on a separate problem (demonstrated on Space Explorers example), not as pre-research ritual. |
| **Planning and execution** | |
| `/10x-plan <change-id>` / `/10x-implement <change-id> phase <n>` | Use the same planning and execution chain from Lesson 2, now with upstream research evidence feeding the plan. |

### Research discipline

- Internal research (`/10x-research`) answers "what does our codebase already do?" — patterns, schemas, conventions, integration points.
- External research (exa.ai, Context7) answers "what should we do?" — library capabilities, API docs, ecosystem best practices.
- Combine both as evidence-backed input to `/10x-plan`. A plan without research evidence on a non-trivial stream is a guess.
- Agent-friendly docs (`llms.txt`, markdown-for-agents, `/md` endpoints) are a quality signal for library selection — libraries that publish agent-readable docs integrate faster.

### `/10x-frame` as spare wheel

Three triggers for reaching for `/10x-frame`:
1. The plan won't converge — research keeps opening more questions instead of narrowing to a contract.
2. The plan doesn't deliver — implementation repeatedly fails to meet success criteria.
3. Persistent drift — the implementation keeps diverging from the plan in ways that suggest the problem was mis-framed.

Demonstrated on a Space Explorers example, not the SRS path. It is an escape hatch, not a mandatory step.

### Paths used by this lesson

- `context/changes/<change-id>/research.md` - internal research output
- `context/changes/<change-id>/frame.md` - framing output when needed
- `context/changes/<change-id>/plan.md` - evidence-backed implementation contract
- `context/foundation/lessons.md` - recurring rules and pitfalls

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
