# Repository Guidelines

A solo-learner spaced-repetition flashcard web app. Stack: Astro + Supabase (auth + PostgreSQL) + Cloudflare Pages, deployed via GitHub Actions. The project is **pre-bootstrap** — no source code exists yet; run `/10x-bootstrapper` to scaffold it. See `@CLAUDE.md` for the full domain model and v1 out-of-scope list.

## Hard Rules

- **SRS invariant:** Any scheduling code must satisfy `missed_it.next_review_at < got_it.next_review_at < nailed_it.next_review_at`. This is not a preference — a violation breaks the product's core value proposition.
- **Auth gate:** Routes listed in `PROTECTED_ROUTES` (`src/middleware.ts`) redirect unauthenticated visitors to sign-in. The marketing index at `/` is deliberately public; anything that reads learner data is not. Every new authenticated route must be added to that list — the middleware is the only thing enforcing it.
- **Data isolation:** Users see only their own cards. Enforce via Supabase Row-Level Security — never omit the user ID predicate in a card query.
- **LF line endings:** Enforced project-wide by `.gitattributes`. Do not configure or write CRLF.
- **v1 scope boundary:** Shared decks, offline-first, native mobile, and AI-generated content are out of scope. Do not add multi-user ownership columns, service-worker registration, mobile-viewport manifests, or LLM API calls — these are the first-code signals of the four out-of-scope features.

## Project Structure

Pre-bootstrap. Stack rationale: `@context/foundation/tech-stack.md`. Full requirements: `@context/foundation/prd.md`.

## Build, Test, and Development Commands

Not yet available — run `/10x-bootstrapper` first, then read `package.json` scripts and update this section.

## Commit Conventions

No enforced prefix scheme. Recent commits use lowercase descriptive phrases (e.g. `add prd and tech-stack`). Update this section when the project adopts a convention.
