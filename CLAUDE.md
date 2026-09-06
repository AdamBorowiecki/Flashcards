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

## 10xDevs AI Toolkit - Module 2, Lesson 3

Review AI-generated code before merge with the **implementation review chain**:

```
/10x-implement -> /10x-impl-review -> triage -> (/10x-lesson | fix | skip | disagree)
```

`/10x-impl-review` is the lesson focus. Review is a quality gate, not an instruction to fix every finding.

### Task Router - Where to start

| Skill | Use it when |
| --- | --- |
| **Code review (lesson focus)** | |
| `/10x-impl-review <change-id>` | You have implemented code and want a structured review before merge. The skill checks plan adherence, scope discipline, safety and quality, architecture, pattern consistency, and success criteria, then presents findings for triage. |
| **Recurring lesson outcome** | |
| `/10x-lesson` | A finding reveals a recurring project rule or agent failure pattern. Record it in `context/foundation/lessons.md` instead of treating it as a one-off note. |

### Triage discipline

- Severity says how bad the finding is. Impact says how much the decision matters now.
- Valid outcomes: fix now, fix differently, skip, accept as risk, record as recurring rule (`/10x-lesson`), disagree.
- Fix critical findings. Do not burn hours on low-impact observations just because the agent found them.
- Conscious skipping of low-impact findings is a valid review outcome, not negligence.
- If you disagree with a finding, record why. Wrong agent reasoning is also signal.

### Review boundaries

- This lesson reviews implemented code. It does not create the plan, execute new phases, or teach CI review.
- Testing strategy and quality gates are introduced in Module 3.
- Do not use `/10x-contract` as a triage outcome in this lesson.

### Paths used by this lesson

- `context/changes/<change-id>/plan.md` - expected implementation contract
- `context/changes/<change-id>/reviews/` - review output
- `context/foundation/lessons.md` - recurring lessons

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
