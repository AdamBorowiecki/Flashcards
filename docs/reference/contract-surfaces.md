# Contract Surfaces

Registry of **load-bearing names** in this project — identifiers whose spelling is a contract
between a document and the code, between two files, or between the project and an external
platform. Renaming anything listed here without updating every consumer named in its row
silently breaks something.

> **Format note.** This file's canonical header is owned by `/10x-contract` and
> `/10x-impl-review`, neither of which is installed in this repo yet (they arrive in a later
> lesson; see `.claude/skills/10x-init/SKILL.md:95`). The structure below is provisional — when
> the owning skill lands and self-bootstraps its own header, let it replace this preamble and
> keep the rows.

## How to use

- **Add a row** when a name starts being referenced from more than one place, or from a
  document as well as from code.
- **Before renaming**, check the row's _Consumers_ column and change every one of them in the
  same commit.
- **Do not** register names that live in exactly one file and are read by nothing else — this
  registry is for surfaces, not for every constant.
- The _State_ column distinguishes names already fixed in code from names that so far exist only
  as a written contract. A contract-only name is still binding: it is what the code must be
  called when it gets written.

## Domain vocabulary

| Name                                 | Source of truth                                                | Consumers                                                | Why load-bearing                                                                                                                                                       | State                              |
| ------------------------------------ | -------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `missed_it` / `got_it` / `nailed_it` | `CLAUDE.md` §Domain Model                                      | PRD FR-004, roadmap S-02, future review UI + scheduler   | The three rating values are the sole user input to scheduling. The PRD's non-negotiable invariant is stated in terms of these exact tokens.                            | contract only — absent from `src/` |
| `next_review_at`                     | `CLAUDE.md` §Domain Model                                      | roadmap F-01/S-02/S-03, future `cards` table + due query | The column the review queue selects on (`next_review_at ≤ now`). Named identically in docs and intended schema.                                                        | contract only — no schema yet      |
| step index (name TBD)                | `prd.md` §Business Logic, `roadmap.md` Open Roadmap Question 5 | future `cards` table, scheduler                          | The step-ladder position that makes the rating ordering hold by construction. **The column name is not yet chosen** — settle it when planning F-01 and record it here. | undecided                          |

## Roadmap and change identifiers

| Name                              | Source of truth                         | Consumers                                                           | Why load-bearing                                                                                                                                                               | State |
| --------------------------------- | --------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| `card-store-with-owner-isolation` | `roadmap.md` F-01                       | `context/changes/<change-id>/`, backlog issue, `/10x-plan` argument | Change IDs are the join key between roadmap, change folder, and downstream status flips. A downstream skill matches on this string; a mismatch is a silent skip, not an error. | fixed |
| `seed-deck-on-first-login`        | `roadmap.md` S-01                       | as above                                                            | as above                                                                                                                                                                       | fixed |
| `srs-review-and-reschedule`       | `roadmap.md` S-02                       | as above                                                            | as above                                                                                                                                                                       | fixed |
| `review-queue-on-app-open`        | `roadmap.md` S-03                       | as above                                                            | as above                                                                                                                                                                       | fixed |
| `create-own-flashcard`            | `roadmap.md` S-04                       | as above                                                            | as above                                                                                                                                                                       | fixed |
| `F-01`, `S-01`…`S-04`             | `roadmap.md` §At a glance               | roadmap body, Prerequisites, Backlog Handoff, Streams               | Roadmap-local ordering IDs. Referenced across four sections of the same file; the dependency graph is expressed in them.                                                       | fixed |
| `working-srs-loop`                | `roadmap.md` frontmatter `milestone_id` | `## Milestone` charter, `## Milestone History` on close             | Milestone identity. History is append-only and carried forward verbatim, so the ID must stay stable once written.                                                              | fixed |

## Requirement identifiers

| Name              | Source of truth                   | Consumers                                                 | Why load-bearing                                                                                                                        | State         |
| ----------------- | --------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `FR-001`…`FR-005` | `prd.md` §Functional Requirements | `roadmap.md` PRD refs, roadmap self-review coverage check | The roadmap's self-review asserts every must-have FR appears in at least one slice's `PRD refs`. Renumbering the PRD breaks that check. | fixed         |
| `US-01`           | `prd.md` §User Stories            | `roadmap.md` S-02 PRD refs                                | Same coverage check as above.                                                                                                           | fixed         |
| `MS-NN`           | `roadmap.md` §Milestone charter   | slice `PRD refs` on description-sourced milestones        | Anchor IDs used instead of FR/US when a milestone is opened from a free-form description rather than the PRD.                           | unused so far |

## Runtime and configuration

| Name                           | Source of truth                   | Consumers                                                                                             | Why load-bearing                                                                                                                                                                                            | State |
| ------------------------------ | --------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `SUPABASE_URL`, `SUPABASE_KEY` | `astro.config.mjs` env schema     | `src/lib/supabase.ts`, `.env.example`, GitHub Actions secrets, Cloudflare Workers secrets             | Declared in three places outside the code (local `.env`, repo secrets, Workers secrets). Both are `optional: true`, so a typo does not fail the build — it fails at runtime with the config banner instead. | fixed |
| `astro:env/server`             | Astro env module                  | `src/lib/supabase.ts`                                                                                 | The import path secrets are read through. Not interchangeable with `import.meta.env` — the schema in `astro.config.mjs` governs it.                                                                         | fixed |
| `@/*` → `./src/*`              | `tsconfig.json` §paths            | every `@/…` import, `CLAUDE.md` §TypeScript                                                           | Path alias. Changing the mapping breaks every import that crosses a `src/` boundary.                                                                                                                        | fixed |
| `PROTECTED_ROUTES`             | `src/middleware.ts:4`             | `src/middleware.ts:18` route guard                                                                    | The single list deciding which paths redirect unauthenticated visitors. Every new authenticated route must be added here — currently only `/dashboard`.                                                     | fixed |
| `ASSETS`                       | `wrangler.jsonc` assets binding   | Worker runtime static-asset serving                                                                   | Binding name the runtime resolves.                                                                                                                                                                          | fixed |
| `SESSION`, `IMAGES`            | injected by `@astrojs/cloudflare` | Worker runtime                                                                                        | Adapter-injected bindings — they appear in `wrangler deploy` output but are **not** written in `wrangler.jsonc`. Do not hand-add them; the adapter owns them.                                               | fixed |
| `flashcards`                   | `wrangler.jsonc` `name`           | Cloudflare Worker identity, production URL `flashcards.<account>.workers.dev`, Supabase URL allowlist | Renaming the Worker changes the production URL, which breaks the Supabase auth redirect allowlist configured against it.                                                                                    | fixed |

## Repository and process

| Name                            | Source of truth                   | Consumers                                                                        | Why load-bearing                                                                                                                                                                       | State |
| ------------------------------- | --------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `main`                          | git default branch, `origin/HEAD` | `.github/workflows/ci.yml` triggers, `CLAUDE.md` §Branch Convention, `README.md` | CI triggers are keyed to the branch name. This drifted once already: the workflow listened on `master` while every push went to `main`, so CI never ran for the repo's entire history. | fixed |
| `context/foundation/*.md`       | `context/foundation/README.md`    | every `10x-*` skill's input/output contract                                      | Skills read and write these by exact path. `roadmap.md`, `prd.md`, `tech-stack.md`, `infrastructure.md` are addressed literally.                                                       | fixed |
| `context/course/m<M>-l<L>-*.md` | `context/course/README.md`        | lesson-compliance audits                                                         | Naming convention for lesson content and its `-completion.md` report.                                                                                                                  | fixed |

## Known drift

- **`context/deployment/deploy-plan.md`** — the path named in `CLAUDE.md`'s Module 1 Lesson 5 and
  Module 2 Lesson 1 blocks. The actual artifact lives at
  `context/changes/deployment/deployment-plan.md` — different directory _and_ different filename.
  Nothing currently reads it automatically, so this is latent rather than broken; resolve it by
  moving the file or correcting the two `CLAUDE.md` blocks.
