# Learner Creates Their Own Flashcard — Implementation Plan

## Overview

A signed-in learner types a front and a back, and the card is saved to their deck with an explicit
FSRS starting state, due immediately. This is roadmap slice **S-04** / PRD **FR-001** — the last
must-have of milestone M-1 that is not yet built.

The slice is small in code and non-trivial in coordination: it runs in parallel with **S-03**
(`review-queue-on-app-open`), which owns the pages a create-card link would naturally hang on.

## Current State Analysis

Everything below the UI already exists. This slice writes no SQL.

- `public.cards` carries `front`, `back`, `user_id`, `next_review_at timestamptz not null default now()`,
  the eight FSRS scheduling columns (all `not null default`), and blank-guard check constraints
  (`supabase/migrations/20260905163222_create_cards_table.sql`,
  `supabase/migrations/20260912105300_add_fsrs_scheduling_state.sql`).
- `cards_insert_own` already permits the insert, with `with check (auth.uid() = user_id)`
  (`20260905163222_create_cards_table.sql:44-48`). `user_id` has **no** column default, so the
  endpoint must set it explicitly from the session.
- `src/lib/srs.ts:71` exports `emptySchedulingState(now)` — the eight columns a new card starts with.
- `src/pages/api/cards/rate.ts` established the repo's JSON endpoint contract: explicit status codes,
  a local `json()` helper, `context.locals.supabase` reused from middleware, an explicit
  `context.locals.user` guard so "not yours" is distinguishable from "malformed".
- `src/components/review/ReviewSession.tsx` established the client pattern: a React island doing
  `fetch()` with explicit pending state, and a failure that **does not** advance the UI.
- `src/middleware.ts:4` holds `PROTECTED_ROUTES = ["/dashboard", "/review"]`, matched by
  `pathname.startsWith(route)`.
- There is no test runner. The only executable check is
  `npm run verify:srs` → `scripts/verify-srs-ordering.ts`, run under
  `node --experimental-strip-types`, which resolves neither the `@/` alias nor `astro:env`.

### The entry-point problem, stated precisely

`roadmap.md` S-04 binds the create-card entry point to `src/components/Topbar.astro` because S-03
owns `src/pages/dashboard.astro`. That constraint is correct but **incomplete**, and this plan
closes the gap rather than inheriting it:

`Topbar.astro` is rendered in exactly one place — `src/components/Welcome.astro:28` — and `Welcome`
is rendered in exactly one place: `src/pages/index.astro`. `index.astro` **is** on S-03's declared
file list (roadmap.md S-03 §Parallel with). So a link placed only in `Topbar.astro` is one level of
indirection away from the same silent failure the constraint exists to prevent: S-03 rewrites
`index.astro`, drops `<Topbar />`, both branches merge clean, and the link renders nowhere.

`lessons.md` §"Parallel slices need declared file ownership" asks for the overlap to be **named in
each plan**, not inferred from merge order. Phase 3 does exactly that.

## Desired End State

A signed-in learner opens `/cards/new` (reachable from the top bar), types a front and a back,
submits, and sees the saved card confirmed back from the server while the form clears for the next
one. The card is in their deck, due now, and appears in the very next review session.

Verify: sign in, add a card via the form, open `/review`, and find that card in the queue.
Sign out, hit `/cards/new` → redirected to `/auth/signin`.

### Key Discoveries

- `startsWith("/cards")` does **not** match `/api/cards/rate` — different path. Adding the `/cards`
  prefix to `PROTECTED_ROUTES` protects the pages without turning API 401s into 302 redirects.
  The API routes keep answering for themselves, as `rate.ts` already does.
- `emptySchedulingState()` deliberately omits `due` (`src/lib/srs.ts:36-38`) — the due date lives in
  `cards.next_review_at` and there is no second copy. The endpoint therefore supplies
  `next_review_at` alongside the spread state.
- `rate.ts:22-23` keeps its own local `SCHEDULING_COLUMNS` string. With a second writer of these
  columns arriving, that list becomes a thing two files can disagree about — Phase 1 lifts it into
  `src/lib/srs.ts` so the executable check can assert against what both endpoints actually use.
- `scripts/verify-srs-ordering.ts` already imports `emptySchedulingState` and runs without Astro
  resolution. A sibling script in the same convention costs nothing to add and needs no runner.
- `src/pages/api/cards/rate.ts` is **not** on S-03's declared file list, so touching it is safe.

## What We're NOT Doing

- **No migration.** No new columns, constraints, indexes, policies, or grants.
- **No edit or delete of cards.** FR-001 is creation only; nothing in M-1 asks for the rest.
- **No card list / deck browser.** `/cards/new` is a form, not a hub.
- **No duplicate detection.** `(user_id, front)` has no unique constraint and gets none — the same
  word in two senses is a legitimate card in language learning.
- **No test runner.** Vitest and friends stay out; the executable check is a plain node script.
- **No touching `src/pages/dashboard.astro`** — bound by roadmap S-04. Also no touching
  `src/pages/index.astro`, `src/pages/review.astro`, `src/components/review/*`, or
  `src/pages/api/auth/signin.ts`, all of which S-03 owns.
- **No length constraint in the database.** The cap is an application rule (see Phase 1); this is a
  deliberate, stated gap.

## Implementation Approach

Three phases, each independently verifiable by hand:

1. The write path — endpoint, validation, explicit starting state, and an executable check that the
   column set cannot drift.
2. The surface — the page, the island, and the route guard.
3. The reachability — the top-bar link plus a written hand-off so S-03 cannot silently remove it.

The order matters: Phase 1 is testable with `curl` before any UI exists, so a failure in Phase 2 is
unambiguously a UI failure.

## Critical Implementation Details

**Ownership and merge order.** S-04 merges first and **owns `src/middleware.ts`**; S-03 merges
second and yields on `PROTECTED_ROUTES`. Files this slice may not touch are listed under "What We're
NOT Doing" — that list is binding, not advisory. The Phase 3 roadmap note is the mechanism that
carries the entry-point requirement across the merge boundary; skipping it reduces this slice to the
failure mode `lessons.md` names.

**`user_id` is not optional on the insert.** RLS would reject the row anyway, but with a policy
violation rather than a useful message. Set it from `context.locals.user.id` after the 401 guard.

---

## Phase 1: Write path and starting-state contract

### Overview

`POST /api/cards` validates, writes the card with an explicit FSRS starting state, and answers in
the JSON contract `rate.ts` established. A sibling verification script pins the column set.

### Changes Required:

#### 1. Shared column list

**File**: `src/lib/srs.ts`

**Intent**: With a second writer of the scheduling columns arriving, the list of those columns
becomes shared knowledge. Export it from the module that defines the state, so the endpoints and the
verification script all read one list.

**Contract**: Add an exported readonly tuple naming the eight scheduling columns, ordered as
`CardSchedulingState` declares them. Keep the file's existing rule intact: it must continue to import
only from `"ts-fsrs"`, because `scripts/` runs it under bare node.

#### 2. Rating endpoint reads the shared list

**File**: `src/pages/api/cards/rate.ts`

**Intent**: Replace the local `SCHEDULING_COLUMNS` string literal with one derived from the shared
tuple, so the verification script's assertion covers the rating path too rather than a copy of it.

**Contract**: The select string stays byte-identical in effect — the eight scheduling columns plus
`next_review_at`. No change to the endpoint's status codes or response bodies.

#### 3. Card creation endpoint

**File**: `src/pages/api/cards/index.ts` (new)

**Intent**: Accept a front and a back from a signed-in learner and persist one card with an explicit
FSRS starting state, due immediately.

**Contract**: `POST /api/cards`, mirroring `rate.ts` — same `json()` helper shape, same guard order
(`locals.supabase` → `locals.user` → JSON body → field validation).

```
201  { id, front, next_review_at }   card saved
400  { error }                       body not JSON / not an object / front or back blank or over the cap
401  { error }                       no session
500  { error }                       Supabase failed, or is not configured
```

Body: `{ front: string, back: string }`. Both are trimmed before validation and **stored trimmed**.
Blank after trim → 400 (mirrors `cards_front_not_blank` / `cards_back_not_blank`). Over 500
characters after trim → 400, naming which side and the limit. The cap is application-only; the
database does not enforce it.

The insert names `user_id` (from `context.locals.user.id`), `front`, `back`,
`...emptySchedulingState(now)`, and `next_review_at: now.toISOString()` — a single `now` reused for
both, so the state and the due date cannot disagree. The `201` body comes from the inserted row via
`.select(...).single()`, not from the request, so a confirmation can never describe a write that did
not land.

#### 4. Executable starting-state check

**File**: `scripts/verify-card-scheduling-columns.ts` (new), `package.json`

**Intent**: Prove that `emptySchedulingState()` produces exactly the columns both endpoints name —
the drift that would otherwise leave a new card with a partial scheduling state and no failure
anywhere.

**Contract**: Same convention as `scripts/verify-srs-ordering.ts` — plain node under
`--experimental-strip-types`, relative `../src/lib/srs.ts` import, write to stdout, `process.exit(1)`
on the first failed assertion. Assertions: the keys of `emptySchedulingState(NOW)` equal the exported
column tuple as a set; `state === 0`; `last_review === null`; every remaining field is a number.
Wire as `npm run verify:cards`.

Like `verify:srs`, this touches neither a database nor the network — it catches a shape mismatch, not
a failed write. Say so in the file header, as `verify-srs-ordering.ts` does.

### Success Criteria:

#### Automated Verification:

- Column contract holds: `npm run verify:cards`
- Rating ordering still holds after the `srs.ts` edit: `npm run verify:srs`
- Type checking passes: `npx astro sync && npx astro check`
- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- `curl -X POST /api/cards` with a valid body and a session cookie returns 201 and a real `id`
- The same call with no session returns 401 JSON, not a 302
- Blank front, blank back, and a 501-character side each return 400 with a message naming the problem
- The created row in Supabase carries `state = 0`, `last_review = null`, and `next_review_at ≈ now`
- Rating an existing card via `/review` still works — `rate.ts` was edited

**Implementation Note**: After completing this phase and all automated verification passes, pause
here for manual confirmation from the human before proceeding.

---

## Phase 2: Create-card page and route guard

### Overview

The page a learner actually uses, plus the middleware entry that keeps it behind sign-in.

### Changes Required:

#### 1. Protected route

**File**: `src/middleware.ts`

**Intent**: Put the new page behind authentication. S-04 owns this file for the parallel window.

**Contract**: Add the prefix `"/cards"` to `PROTECTED_ROUTES`. The prefix, not `/cards/new` — a later
card page then needs no middleware edit, which is one fewer reason to touch a file two slices share.
Verified: `"/api/cards/rate".startsWith("/cards")` is `false`, so the API routes keep answering 401
for themselves instead of being redirected.

#### 2. Create-card page

**File**: `src/pages/cards/new.astro` (new)

**Intent**: Host the form in the same shell the other authenticated pages use.

**Contract**: Mirrors `src/pages/review.astro` — `Layout` with a title, the `bg-cosmic` centred
panel, and the island mounted `client:load`. No data fetching in the frontmatter; this page writes
only.

#### 3. Create-card island

**File**: `src/components/cards/CreateCardForm.tsx` (new)

**Intent**: Collect a front and a back, POST them, and confirm the saved card while clearing the form
for the next one — so a learner can add several cards without a navigation.

**Contract**: Follows `ReviewSession.tsx`: `fetch()` with explicit `pending` state (no
`useFormStatus`, which does not apply to fetch), errors surfaced via
`@/components/auth/ServerError`, fields built from `@/components/auth/FormField`.

On success: clear both fields, return focus to the front input, increment a session counter, and show
a confirmation naming the **server-returned** front (e.g. `Added "apple" — 3 this session`).
On failure: keep both fields populated, show the error, do not clear and do not increment — the
`ReviewSession` stance, and what `lessons.md` §"A swallowed failure needs a defined way to be
noticed" requires. Client-side validation mirrors the server's (non-blank after trim, 500-character
cap) as immediate feedback only; the server stays the authority.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro sync && npx astro check`
- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Signed out, visiting `/cards/new` redirects to `/auth/signin`
- Signed in, adding a card clears the form, moves focus to the front field, and shows the
  confirmation with the counter
- Adding three cards in a row works without a page reload, and the counter reads 3
- A submitted blank field is rejected without a network call and the typed text survives
- Killing the network mid-submit shows an error, keeps both fields, and does not increment the counter
- The added cards appear in the queue at `/review` on the next load

**Implementation Note**: After completing this phase and all automated verification passes, pause
here for manual confirmation from the human before proceeding.

---

## Phase 3: Entry point and hand-off to S-03

### Overview

The link that makes the feature reachable, and the written hand-off that keeps it reachable after
S-03 merges. This phase is short and is the one this slice most easily gets wrong.

### Changes Required:

#### 1. Top-bar link

**File**: `src/components/Topbar.astro`

**Intent**: Give the feature its entry point, on the component roadmap S-04 designates — outside
S-03's declared file list.

**Contract**: In the signed-in branch only, add a `New card` link to `/cards/new`, alongside the
existing `Dashboard` link and sign-out form, in the same link styling. The signed-out branch is
untouched — the route is protected and an unauthenticated link would only bounce to sign-in.

#### 2. Top bar on the create page

**File**: `src/pages/cards/new.astro`

**Intent**: Render `<Topbar />` on this page so a learner who arrives has a way back out, and so the
component has a second render site that is not in S-03's blast radius.

**Contract**: Import and render `@/components/Topbar.astro` above the page panel, as
`Welcome.astro:28` does. Note this is a partial mitigation, not a fix: it does not by itself put the
link in front of a learner who is anywhere else. Change #3 is what does that.

#### 3. Binding hand-off note in the roadmap

**File**: `context/foundation/roadmap.md`

**Intent**: `Topbar.astro` renders today only via `Welcome.astro` → `index.astro`, and `index.astro`
is S-03's. Writing the requirement down is what `lessons.md` asks for and the only thing that
survives a clean merge.

**Contract**: In the **S-04** item, extend the first bullet under §Parallel with to record the
indirection — the link lives in `Topbar.astro`, whose only pre-S-04 render site is `index.astro`.
In the **S-03** item, add a bullet under §Parallel with stating: whatever replaces `index.astro` and
`dashboard.astro` **must render `<Topbar />`** for signed-in learners, because S-04's only entry
point hangs there; dropping it makes card creation unreachable with no git conflict.

`roadmap.md` is a shared file, so this may conflict textually when S-03 merges. That is the intended
trade — a loud conflict someone resolves in a minute, in place of a silent one nobody notices.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Formatting is clean: `npm run format` leaves no diff
- Build passes: `npm run build`

#### Manual Verification:

- Signed in, `/` shows `New card` in the top bar and it opens the form
- Signed out, `/` shows no `New card` link
- `/cards/new` renders the top bar, and `Dashboard` / `Sign out` work from it
- `context/foundation/roadmap.md` S-03 carries the `<Topbar />` requirement, and S-04 records the
  `Welcome.astro` → `index.astro` indirection
- Full loop on the live-equivalent build: sign in → add a card → `/review` → the new card is in the
  queue → rate it → it reschedules

**Implementation Note**: Final phase. Confirm the full loop by hand before closing the slice.

---

## Testing Strategy

### Executable checks:

- `npm run verify:cards` — `emptySchedulingState()` produces exactly the eight columns both endpoints
  write, with `state = 0` and `last_review = null`.
- `npm run verify:srs` — unchanged guarantee, re-run because Phase 1 edits `src/lib/srs.ts`.
- Neither touches a database or the network. That boundary is deliberate and matches
  `scripts/verify-srs-ordering.ts`; the database write is a manual criterion.

### Manual testing steps:

1. Sign in. Confirm `New card` appears in the top bar on `/`.
2. Add a card (`front: "window"`, `back: "okno"`). Confirm the form clears, focus returns to the
   front field, and the confirmation names `window`.
3. Add two more without reloading. Confirm the counter reads 3.
4. Submit with a blank back → rejected client-side, typed text preserved.
5. Paste 501 characters into the front and submit → 400 from the server, message names the limit.
6. Submit a front with leading and trailing spaces → the stored row is trimmed.
7. Open `/review`. Confirm the three new cards are in the queue and rate one.
8. Sign out. Visit `/cards/new` → redirected to `/auth/signin`.
9. `curl -X POST http://localhost:4321/api/cards -H 'Content-Type: application/json' -d '{}'` with no
   cookie → `401` JSON, not a redirect.

## Performance Considerations

One insert with a returning select per created card. No new index is needed: the write goes to a
table whose only index is `(user_id, next_review_at)`, which the insert maintains at negligible cost.

## Migration Notes

None. No schema change, no backfill, no deploy ordering requirement. Rolling back is reverting the
commits — nothing persists that the previous code cannot read, because cards created by this slice
are indistinguishable in shape from seeded ones.

## References

- Roadmap slice: `context/foundation/roadmap.md` §S-04, and §S-03 §Parallel with for the boundary
- Recurring rules: `context/foundation/lessons.md` §"Parallel slices need declared file ownership",
  §"A swallowed failure needs a defined way to be noticed"
- JSON endpoint contract: `src/pages/api/cards/rate.ts:16-23`
- Client fetch pattern: `src/components/review/ReviewSession.tsx:31-38`
- Starting state: `src/lib/srs.ts:71`
- Insert policy and defaults: `supabase/migrations/20260905163222_create_cards_table.sql:44-48`,
  `supabase/migrations/20260912105300_add_fsrs_scheduling_state.sql:23-32`
- Verification script convention: `scripts/verify-srs-ordering.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Write path and starting-state contract

#### Automated

- [x] 1.1 Column contract holds: `npm run verify:cards` — b2dd1cd
- [x] 1.2 Rating ordering still holds after the `srs.ts` edit: `npm run verify:srs` — b2dd1cd
- [ ] 1.3 Type checking passes: `npx astro sync && npx astro check` — not passing: blocked by a pre-existing ts(2345) in `src/lib/srs.ts:114` (S-02 scheduling code, untouched by this change); CI gate is `lint` + `build`
- [x] 1.4 Linting passes: `npm run lint` — b2dd1cd
- [x] 1.5 Build passes: `npm run build` — b2dd1cd

#### Manual

- [x] 1.6 `curl -X POST /api/cards` with a valid body and a session cookie returns 201 and a real `id` — b2dd1cd
- [x] 1.7 The same call with no session returns 401 JSON, not a 302 — b2dd1cd
- [x] 1.8 Blank front, blank back, and a 501-character side each return 400 with a message naming the problem — b2dd1cd
- [x] 1.9 The created row carries `state = 0`, `last_review = null`, and `next_review_at ≈ now` — b2dd1cd
- [x] 1.10 Rating an existing card via `/review` still works — b2dd1cd

### Phase 2: Create-card page and route guard

#### Automated

- [ ] 2.1 Type checking passes: `npx astro sync && npx astro check` — not passing: same pre-existing ts(2345) in `src/lib/srs.ts:114` as 1.3; no new type errors from this phase
- [x] 2.2 Linting passes: `npm run lint` — 62d36ca
- [x] 2.3 Build passes: `npm run build` — 62d36ca

#### Manual

- [x] 2.4 Signed out, visiting `/cards/new` redirects to `/auth/signin` — 62d36ca
- [x] 2.5 Adding a card clears the form, moves focus to the front field, and shows the confirmation with the counter — 62d36ca
- [x] 2.6 Adding three cards in a row works without a page reload, and the counter reads 3 — 62d36ca
- [x] 2.7 A submitted blank field is rejected without a network call and the typed text survives — 62d36ca
- [x] 2.8 Killing the network mid-submit shows an error, keeps both fields, and does not increment the counter — 62d36ca
- [x] 2.9 The added cards appear in the queue at `/review` on the next load — 62d36ca

### Phase 3: Entry point and hand-off to S-03

#### Automated

- [x] 3.1 Linting passes: `npm run lint` — 13c9f4b
- [x] 3.2 Formatting is clean: `npm run format` leaves no diff — verified with `prettier --check` over every file this slice touched; repo-wide `npm run format` also reformats the pre-existing unformatted `context/course/m2-l5-…md`, which was reverted and left alone — 13c9f4b
- [x] 3.3 Build passes: `npm run build` — 13c9f4b

#### Manual

- [x] 3.4 Signed in, `/` shows `New card` in the top bar and it opens the form — 13c9f4b
- [x] 3.5 Signed out, `/` shows no `New card` link — 13c9f4b
- [x] 3.6 `/cards/new` renders the top bar, and `Dashboard` / `Sign out` work from it — 13c9f4b
- [x] 3.7 `roadmap.md` S-03 carries the `<Topbar />` requirement, and S-04 records the indirection — 13c9f4b
- [x] 3.8 Full loop: sign in → add a card → `/review` → the new card is in the queue → rate it → it reschedules — card `loop-proof` created through the UI form, confirmed present in the 17-card `/review` queue, rated `missed_it`, rescheduled +1 day (state 0→2, reps 0→1). The rating was sent to `/api/cards/rate` directly rather than by clicking the button, because `ReviewSession` fails to hydrate on this dev server ("Failed to fetch dynamically imported module") — an S-02/S-03 component, unaffected by this slice, and green in `npm run build` — 13c9f4b
