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
- **How intervals are derived:** a fixed-interval step ladder. Each card carries a step index alongside `next_review_at`; `missed_it` resets it to the first step, `got_it` advances one step, `nailed_it` advances two, and the resulting step maps to the interval. The invariant above therefore holds by construction — do not replace this with SM-2 (ease factor + repetition count) or FSRS (per-card stability/difficulty plus a review-history table) without an explicit decision; both were considered and rejected for v1. See `@context/foundation/prd.md` §Business Logic and `@context/foundation/roadmap.md` Open Roadmap Question 5.

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

## 10xDevs AI Toolkit - Module 2, Lesson 2

Turn one roadmap item into the first implementation cycle with the **change planning chain**:

```
/10x-roadmap -> /10x-new -> /10x-plan -> /10x-plan-review -> /10x-implement
```

`/10x-new`, `/10x-plan`, `/10x-plan-review`, and `/10x-implement` are the lesson focus. `/10x-frame` and `/10x-research` are not required rituals here; they are escalation paths introduced in the next lesson.

### Task Router - Where to start

| Skill | Use it when |
| --- | --- |
| **Change setup (lesson focus)** | |
| `/10x-new <change-id>` | You selected a roadmap item and need a stable change folder. Creates `context/changes/<change-id>/change.md` so planning, implementation, progress, commits, and later review all share one identity. Use AFTER roadmap selection, BEFORE `/10x-plan`. |
| **Planning (lesson focus)** | |
| `/10x-plan <change-id>` | You have a change folder and need a reviewable implementation plan. Reads roadmap context, foundation docs, codebase evidence, and any existing change notes; writes `plan.md` and `plan-brief.md` with phases, file contracts, success criteria, and `## Progress`. |
| **Plan readiness (lesson focus)** | |
| `/10x-plan-review <change-id>` | You have `plan.md` and need a light pre-code readiness check. Use it to catch missing end state, weak contracts, malformed progress, scope drift, or blind spots before code changes begin. |
| **Implementation (lesson focus)** | |
| `/10x-implement <change-id> phase <n>` | You have an approved plan and want to execute one phase with verification, manual gate, commit ritual, and SHA write-back to `## Progress`. |
| **Lifecycle closure** | |
| `/10x-archive <change-id>` | A change is merged or intentionally closed. Move it out of active `context/changes/` into archive state. |

### How the chain hands off

- `/10x-new` creates the durable change identity.
- `/10x-plan` turns that identity into an implementation contract.
- `/10x-plan-review` checks the plan before the agent mutates code.
- `/10x-implement` executes one planned phase, verifies, asks for manual confirmation when needed, commits, and records progress.

### Lesson boundaries

- Plan is the default router after roadmap selection. Start with `/10x-plan` unless the problem is unclear or external evidence is blocking.
- Do not run `/10x-frame + /10x-research` as ceremony for every change.
- Do not turn this lesson into a full end-to-end product build. A checkpoint with a planned and partially or fully implemented stream is valid.
- Code review of the implemented diff belongs to Lesson 3 via `/10x-impl-review`.
- Lifecycle closure via `/10x-archive` after a change is merged or intentionally closed.

### Paths used by this lesson

- `context/foundation/roadmap.md` - upstream roadmap
- `context/changes/<change-id>/change.md` - change identity
- `context/changes/<change-id>/plan.md` - implementation contract
- `context/changes/<change-id>/plan-brief.md` - compressed handoff
- `context/foundation/lessons.md` - recurring rules and pitfalls
- `docs/reference/contract-surfaces.md` - load-bearing names registry

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
