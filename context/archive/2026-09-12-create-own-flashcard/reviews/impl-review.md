<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Learner Creates Their Own Flashcard

- **Plan**: `context/changes/create-own-flashcard/plan.md`
- **Scope**: Phases 1–3 of 3 (full plan)
- **Date**: 2026-09-13
- **Commits**: b2dd1cd (p1), 62d36ca (p2), 13c9f4b (p3), a501da5 (epilogue)
- **Verdict**: NEEDS ATTENTION at review; **APPROVED after triage** (6 of 7 findings fixed, 1 skipped by decision)
- **Findings**: 0 critical, 3 warnings, 4 observations

## Verdicts

| Dimension           | Verdict           |
| ------------------- | ----------------- |
| Plan Adherence      | PASS              |
| Scope Discipline    | PASS              |
| Safety & Quality    | WARNING → PASS    |
| Architecture        | PASS              |
| Pattern Consistency | WARNING → PASS    |
| Success Criteria    | WARNING (F7 open) |

### Why the PASS dimensions passed

**Plan Adherence** — every planned change verified MATCH against its **Intent** and **Contract**; no MISSING, no DRIFT. **Scope Discipline** — all "What We're NOT Doing" guardrails held: `supabase/migrations/` untouched (still the same three files), and `dashboard.astro`, `index.astro`, `review.astro`, `components/review/*`, `api/auth/signin.ts` — the five files S-03 owns — appear nowhere in `git diff --name-only b2dd1cd^..HEAD`. No dependency added. **Architecture** — the insert writes all eight scheduling columns atomically from one `now`, so a partial FSRS state is not expressible; `src/lib/srs.ts` remains the single definition and keeps its ts-fsrs-only import constraint.

## Findings

### F1 — Neither verification script runs in CI

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `.github/workflows/ci.yml:17-24`, `package.json:13-14`
- **Detail**: CI runs `npm ci`, `npx astro sync`, `npm run lint`, `npm run build` — and nothing else. Neither `verify:srs` nor the new `verify:cards` is wired in. Phase 1's entire rationale was that the column contract needs an executable check rather than a comment, and `lessons.md` §"A swallowed failure needs a defined way to be noticed" is satisfied in this slice by pointing at that script. A check that only runs when a human remembers to run it documents an invariant instead of enforcing it. The gap predates this slice (`verify:srs` has the same problem since S-02), but this slice doubles it.
- **Fix**: Add `- run: npm run verify:srs` and `- run: npm run verify:cards` to `.github/workflows/ci.yml` after the lint step.
  - Strength: Two lines, no secrets needed — neither script touches a network or a database — and it turns both slices' invariants into real gates.
  - Tradeoff: `ci.yml` has no declared owner in the roadmap's S-03/S-04 split, so it is a file outside this slice's plan. S-04 merges first, so a conflict would land on S-03.
  - Confidence: HIGH — verified by reading `ci.yml`; both scripts run clean locally.
  - Blind spot: Whether the S-03 branch is also editing `ci.yml`.
- **Decision**: FIXED — `verify:srs` and `verify:cards` added to `.github/workflows/ci.yml` after the lint step, with a comment saying why they need no secrets.

### F2 — `MAX_SIDE_LENGTH` and its messages duplicated; the two copies disagree in case

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/pages/api/cards/index.ts:26,44,48,82,87` and `src/components/cards/CreateCardForm.tsx:9,41-42,48-49`
- **Detail**: `const MAX_SIDE_LENGTH = 500` exists in both files, bound only by a comment — the same silent-divergence class this very diff went to lengths to eliminate for the scheduling columns by hoisting `SCHEDULING_STATE_COLUMNS` into `src/lib/srs.ts`. The `srs.ts` bare-node import restriction does not apply here: a new `src/lib/cards.ts` would be loaded only by Vite, so both files could import it. There is a user-visible symptom already: the server passes the label `"front"` (`index.ts:82`) while the client passes `"Front"` (`CreateCardForm.tsx:48`), so the identical mistake reads `Front cannot be blank` when caught in the browser and `front cannot be blank` when caught by the server.
- **Fix**: Extract `MAX_SIDE_LENGTH` and a shared `validateSide(value, label)` into `src/lib/cards.ts`; import it from both the endpoint and the island, and settle on one label casing.
  - Strength: Removes the drift risk and the casing inconsistency in one edit; matches the standard this slice set for the column list.
  - Tradeoff: A third file for ~15 lines of logic; touches two already-committed files.
  - Confidence: HIGH — both copies read and confirmed; no node-resolution constraint blocks the extraction.
  - Blind spot: None significant.
- **Decision**: FIXED — `MAX_SIDE_LENGTH` and `validateSide()` extracted to `src/lib/cards.ts`; endpoint and island both import it, labels unified on `Front` / `Back`. Verified: server now answers `Front cannot be blank`, matching the client.

### F3 — Request body is parsed in full before any size check

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/pages/api/cards/index.ts:70`
- **Detail**: `await context.request.json()` materializes and parses the whole body before `MAX_SIDE_LENGTH` is consulted at line 47. An authenticated caller can POST a multi-megabyte JSON string and make the Worker allocate and parse all of it before the 400 comes back. The 500-character cap protects the database and the review layout, not the runtime. Requires a signed-in account, so this is resource abuse by an authenticated user rather than an open door. `rate.ts` has the same shape but a smaller surface (two short fields from a trusted island).
- **Fix**: Before line 70, read `content-length` and return `413` above a few KB.
  - Strength: Three lines, no behaviour change for real callers, and it bounds the Worker's CPU and memory budget.
  - Tradeoff: `content-length` can be absent on a chunked request, so the guard is a cheap filter rather than a hard bound.
  - Confidence: MEDIUM — the exposure is real but modest, and Cloudflare applies its own request limits above this.
  - Blind spot: Cloudflare's platform-level body cap for Workers was not measured.
- **Decision**: FIXED — `MAX_BODY_BYTES = 16 KB` checked against `content-length` before `request.json()`, answering 413. Verified: a 20 KB body answers 413, a 501-character side still answers 400, 500 characters still 201.

### F4 — CSRF protection rests on an Astro default the config never states

- **Severity**: 👀 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/pages/api/cards/index.ts:68-73`, `astro.config.mjs`
- **Detail**: The endpoint accepts any `Content-Type` and parses the body regardless. What stops a cross-site POST is Astro's origin check, which defaults to on and was never declared in `astro.config.mjs`. **Scope corrected during triage** — the review first cited a 403 from `/api/auth/signin` as if it covered `/api/cards`, which it does not. Measured directly: the check rejects only form-shaped Content-Types (urlencoded, multipart, `text/plain`) on an Origin mismatch. `POST /api/auth/signin` with no Origin answers 403 and 302 with it; `POST /api/cards` carrying a JSON body as `text/plain` answers **403**; the same route with a real `application/json` body answers 201 and does not need the check, because cross-origin it would require a preflight no route answers. Those three form-shaped types are the entire no-preflight CSRF surface, so the protection is complete — but it rested on an undeclared framework default.
- **Fix**: Pin `security: { checkOrigin: true }` in `astro.config.mjs`, and optionally reject non-`application/json` at `index.ts:68`.
- **Decision**: FIXED — `security: { checkOrigin: true }` pinned in `astro.config.mjs`, with the measured scope recorded in the comment beside it. The optional `Content-Type` guard was not added: the measurement shows it would be redundant.

### F5 — `verify:cards` cannot see the database schema

- **Severity**: 👀 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `scripts/verify-card-scheduling-columns.ts:72-79`
- **Detail**: The script proves `SCHEDULING_STATE_COLUMNS` and `emptySchedulingState()` agree with each other, in both directions. It cannot prove either agrees with `public.cards`. A ninth column added to the interface, the tuple and the factory but not to a migration passes `astro check`, passes `verify:cards`, and fails only in production as a PostgREST error surfacing as a 500. The script's own "What this does NOT catch" block does not currently name this gap.
- **Fix**: Add one line to the header's "What this does NOT catch" block naming the DB-schema gap; a real assertion belongs in `supabase/tests/` if it is wanted.
- **Decision**: FIXED — the gap is now named in the script header's "What this does NOT catch" block. No DB assertion added; that would need a live database in CI.

### F6 — Roadmap hand-off note points the wrong direction

- **Severity**: 👀 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `context/foundation/roadmap.md:128`
- **Detail**: The S-04 sub-bullet says the requirement is "written into the S-03 item below", but S-03 sits above S-04 in the file (line 112 vs line 128). Trivial, but this is a cross-slice hand-off note whose whole job is to be followed by someone else.
- **Fix**: Change "below" to "above".
- **Decision**: FIXED — "below" → "above".

### F7 — `astro check` fails on a pre-existing type error; two Progress rows stay unchecked

- **Severity**: 👀 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `src/lib/srs.ts:114`
- **Detail**: `npx astro check` reports `ts(2345): Property 'elapsed_days' is missing ... but required in type 'CardInput'` on the `TypeConvert.card()` call. Confirmed unchanged by this diff — the only addition to `srs.ts` was the exported tuple. Progress rows 1.3 and 2.1 are honestly left `- [ ]` with the attribution recorded inline, by explicit decision during implementation. Nothing gates on it because CI never runs `astro check`. Recorded so `/10x-archive` does not surface it as an unexplained straggler.
- **Fix**: None in this slice. Fix `elapsed_days` separately as S-02 follow-up; it becomes blocking if `astro check` is ever added to CI.
- **Decision**: SKIPPED — standing by the implementation-time decision not to touch verified S-02 scheduling code from this slice. Rows 1.3 and 2.1 stay unchecked with their inline attribution.

## Noted, no action recommended

Reviewed and judged acceptable as-is: the duplicated `json()` helper across the two card endpoints (worth extracting at the third endpoint, not now); the ~15-line pending-button markup copied from `SubmitButton` because `useFormStatus` does not observe a `fetch`; the single `document.getElementById` escape hatch for focus, which is documented and load-bearing; `error.message` returned verbatim, which matches `rate.ts` and would need changing in both places; `startsWith` over-matching hypothetical routes like `/cards-import`, which fails closed; a lost response after a committed insert producing a duplicate card on retry, which is the correct trade against claiming a success that did not happen; and the absence of a per-user creation rate limit, which is backlog material.

## Verification run

| Check                            | Result                                          |
| -------------------------------- | ----------------------------------------------- |
| `npm run verify:cards`           | PASS — 8 columns, `state 0`, `last_review null` |
| `npm run verify:srs`             | PASS — ordering holds for new and matured cards |
| `npm run lint`                   | PASS                                            |
| `npm run build`                  | PASS                                            |
| `prettier --check` (slice files) | PASS                                            |
| `npx astro check`                | FAIL — 1 error, pre-existing (F7)               |
| Working tree                     | Clean at review time                            |

Manual Progress rows were each verified during implementation against a local Supabase with observable evidence (HTTP status codes, database row contents, browser state) and are not rubber-stamped. Row 3.8 discloses that its rating step went through `/api/cards/rate` directly rather than the `/review` button, because `ReviewSession` failed to hydrate on the dev server — an S-02/S-03 component outside this slice's file list.

## Triage — 2026-09-13

| Finding                               | Decision           |
| ------------------------------------- | ------------------ |
| F1 verification scripts not in CI     | FIXED              |
| F2 duplicated cap + label casing      | FIXED              |
| F3 body parsed before size check      | FIXED              |
| F4 CSRF default not declared          | FIXED              |
| F5 script blind to the DB schema      | FIXED (documented) |
| F6 roadmap note points the wrong way  | FIXED              |
| F7 pre-existing `astro check` failure | SKIPPED            |

Fixed: 6 · Skipped: 1 · Outstanding warnings: 0.

Re-verified after the fixes: `npm run lint`, `npm run build`, `npm run verify:srs`, `npm run verify:cards`, `prettier --check` on every touched file — all pass. Endpoint behaviour re-measured against a local Supabase: 413 on a 20 KB body, 400 on a 501-character side, 201 on 500 characters, `Front cannot be blank` matching the client's wording, 403 on a `text/plain` cross-origin-shaped POST.

The `ReviewSession` hydration failure recorded against Progress row 3.8 was diagnosed during triage as a stale Vite dependency-optimizer cache on the dev server (`The file does not exist at node_modules/.vite/deps_ssr/@supabase_ssr.js`), not a defect in that component. It cleared on a clean dev-server restart.
