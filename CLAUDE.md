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

## 10xDevs AI Toolkit - Module 2, Lesson 1

Move from sprint-zero setup to project orchestration with the **roadmap chain**:

```
(Module 1 foundation docs) -> /10x-roadmap -> backlog-ready roadmap items
```

`/10x-roadmap` is the lesson focus. `/10x-new` is intentionally introduced in Module 2, Lesson 2, when a selected roadmap item becomes an implementation change folder.

### Task Router - Where to start

| Skill                                                                                                                   | Use it when                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Roadmap (lesson focus)**                                                                                              |                                                                                                                                                                                                                                                                                                                                                                                            |
| `/10x-roadmap`                                                                                                          | You have `context/foundation/prd.md` and a scaffolded project baseline, and you need a vertical-first MVP roadmap. The skill reads the PRD, inspects the code baseline, uses available foundation docs such as `tech-stack.md`, `infrastructure.md`, and `deploy-plan.md`, then writes `context/foundation/roadmap.md`. Use it BEFORE creating per-change folders or implementation plans. |
| **Re-run upstream if needed**                                                                                           |                                                                                                                                                                                                                                                                                                                                                                                            |
| `/10x-shape` / `/10x-prd` / `/10x-tech-stack-selector` / `/10x-bootstrapper` / `/10x-agents-md` / `/10x-infra-research` | Bundled from Module 1 so foundation contracts can be fixed before roadmap sequencing. If roadmap generation exposes a PRD gap, repair the PRD before pretending the backlog is ready.                                                                                                                                                                                                      |

### How the chain hands off

- `/10x-roadmap` bridges product and implementation. It does not choose frameworks, design schemas, or write a per-change implementation plan.
- The output is `context/foundation/roadmap.md`: ordered milestones, vertical slices, bounded foundations, dependencies, unknowns, risk, and backlog handoff fields.
- Roadmap items should receive stable human-readable identifiers in backlog tools. The actual `context/changes/<change-id>/` folder is created in Lesson 2 with `/10x-new`.

### Roadmap boundaries

- Default to vertical slices: user-visible outcomes that cross UI, data, business logic, and integrations.
- Horizontal work is allowed only as a bounded enabler that names the downstream vertical milestone it unlocks.
- Avoid orphan horizontal work such as "build the whole database", "build all API endpoints", or "design the whole UI" before the first user-visible flow.
- Roadmap is not a calendar estimate. Do not invent dates, story points, or sprint velocity unless the user explicitly asks for a separate planning artifact.

### Foundation paths used by this lesson

- `context/foundation/prd.md` - input
- `context/foundation/tech-stack.md` - optional input
- `context/foundation/infrastructure.md` - optional input
- `context/deployment/deploy-plan.md` - optional input
- `context/foundation/roadmap.md` - output
- `context/foundation/lessons.md` - recurring rules and pitfalls
- `docs/reference/contract-surfaces.md` - load-bearing names registry

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
