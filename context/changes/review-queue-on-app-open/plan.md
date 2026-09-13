# App Opens Straight Into the Due Queue — Implementation Plan

## Overview

Roadmap S-03, satisfying PRD FR-002. A signed-in learner who opens the app is routed directly into a review session for whatever is due, with the due count shown as a session header. Today they land on a static marketing page with no link onward and have to type `/dashboard` by hand.

The slice is entirely routing and session surface. No migration, no new endpoint, no change to the scheduling rule.

## Current State Analysis

Verified against HEAD `5b8f4e1` by reading every file named below in full.

- **Post-sign-in lands nowhere useful.** `src/pages/api/auth/signin.ts:19` redirects to `/`, and `src/pages/index.astro` renders `Welcome.astro` — a static starter marketing page with no awareness of `Astro.locals.user`.
- **`/review` already implements the queue.** `src/pages/review.astro:18-22` selects `id, front, back` where `next_review_at <= now()`, ordered ascending, and branches into three states: queue / `queueUnavailable` / `EmptyQueue`. The read is a **snapshot taken at page load** — `ReviewSession` walks it in client state and never refetches.
- **No due count is surfaced anywhere.** `review.astro:35-39` renders a static `<h1>Review</h1>`.
- **`dashboard.astro:39-45` carries an interim entry point**, commented in the source as S-03's to replace. It is also the only page rendering a sign-out button outside the Topbar.
- **`Topbar.astro` is rendered in exactly one place: `Welcome.astro:28`** — so it appears only on `/`. Neither `dashboard.astro` nor `review.astro` renders it. `Topbar.astro:13` links to `/dashboard`.
- **`EmptyQueue.tsx:19-24` links to `/dashboard`**, and its doc comment assigns the empty-state design to this slice.
- **Middleware needs no change.** `src/middleware.ts:4` already protects `/dashboard` and `/review`; `/` must stay public for anonymous marketing. See Key Discoveries.
- **`output: "server"`** (`astro.config.mjs:11`) with no `prerender` export in `index.astro`, so it is server-rendered and can branch on `Astro.locals.user`.
- **No test runner exists.** Verification in this repo is hand-run scripts under `scripts/` (`package.json:11` → `verify:srs`, run via `node --experimental-strip-types`) plus manual click-through. Both archived plans refused a runner in terms.

## Desired End State

A signed-in learner opens the app — freshly signed in, or by opening `/` from a bookmark, or by clicking Dashboard in the Topbar — and arrives in a review session showing `Card 1 of N` above the first due card. They work through the queue, the counter advances, and when it empties they see the "nothing due" panel with no dead link. A learner with nothing due at all reaches the same panel by the same route. An anonymous visitor still gets the marketing page on `/` and is still bounced from `/review` and `/dashboard` to sign-in.

Verify by: `npm run verify:routing` exits zero against a dev server on port 4322, then a manual pass of all four entry paths.

### Key Discoveries:

- **The PROTECTED_ROUTES conflict the roadmap anticipates does not arise.** S-03 needs no middleware edit at all: `/review` and `/dashboard` are already listed (`src/middleware.ts:4`), and `/` must remain public. Yielding to S-04 on that array costs nothing, because this plan never touches it.
- **S-04's declared entry point is currently unreachable for signed-in learners, and this slice is what makes it so.** The roadmap directs S-04 to hang its "create card" link on `Topbar.astro` as the surface "outside S-03's scope". But `Topbar` renders only inside `Welcome.astro:28`, i.e. only on `/` — the page this slice redirects signed-in learners away from. Both branches would merge clean, with no git conflict, and the create-card link would sit on a page no signed-in learner ever sees: exactly the silent failure in `lessons.md` §"Parallel slices need declared file ownership". **Resolution**: this slice renders `<Topbar />` on `review.astro` — the one page a signed-in learner reliably reaches — without editing `Topbar.astro` itself.
- **`/dashboard` must keep resolving.** `Topbar.astro:13` links to it, `Topbar.astro` belongs to S-04, and S-03 may not edit it. Deleting `dashboard.astro` would 404 a link this slice cannot fix. It becomes a redirect instead.
- **Every plausible target for EmptyQueue's exit link is a loop.** After this slice `/` and `/dashboard` both redirect to `/review`, so any "back to X" link returns the learner to the page they are already on. The link goes; Topbar's sign-out replaces it as the way off the page.
- **The due count is free.** It is `queue.length` on a snapshot `review.astro` already holds — no second query, and no second source of truth about what is due.
- **`enable_short_term: false`** (`src/lib/srs.ts:68`) means a card rated `missed_it` returns tomorrow, not later in the session. So the snapshot's size cannot grow mid-session, which is what makes a fixed denominator (`Card 3 of 12`) honest rather than a lie waiting to happen.

## What We're NOT Doing

- **No middleware change.** `PROTECTED_ROUTES` stays exactly as S-04 leaves it.
- **No edit to `src/components/Topbar.astro`.** S-04 owns the file. This slice only renders it.
- **No marketing copy.** `Welcome.astro` keeps its starter text. The project name is still open roadmap question 1; writing hero copy now means writing it twice.
- **No separate due-list view to browse.** FR-002's own resolution ruled it out and S-03's roadmap Risk names it as this slice's main failure mode. The count is a header, nothing more.
- **No "come back at HH:MM" hint** on the empty panel — it needs a `min(next_review_at)` query this slice does not otherwise require.
- **No refetch, polling, or live queue updates.** The snapshot stays a snapshot.
- **No card creation link.** S-04's, and it arrives on the Topbar this slice makes reachable.
- **No test runner.** Consistent with both archived plans.
- **No change to scheduling, `src/lib/srs.ts`, or `/api/cards/rate`.**

## Implementation Approach

Two phases, session surface before routing. The routing phase removes both the "Back to dashboard" link and the old dashboard's sign-out button; landing it first would leave a learner with an empty queue holding a looping link and no way out. Building the surface first means navigation is intact after every phase.

Phase 1 is reachable through the existing dashboard link, so it is hand-testable before any entry point moves. Phase 2 then flips three redirects at once — they are one decision — and ships the script that asserts all of their outcomes.

## Critical Implementation Details

**State sequencing.** The counter's numerator is `ReviewSession`'s existing `index` state, so the header must live inside that component, not in `review.astro` — the page has no access to how far the learner has walked. The early `index >= queue.length` return at `ReviewSession.tsx:47` must stay above the header, or the exhausted state renders `Card 13 of 12`.

**Merge order.** S-04 merges first; this slice merges second and rebases onto it. The only file both touch is `src/middleware.ts`, which this plan does not modify, so the resolution is to take S-04's version wholesale. If S-04 has also added a link to `Topbar.astro` by then, the Topbar render added in Phase 1 picks it up with no further work — that is the point of doing it.

## Phase 1: Session Surface

### Overview

`/review` gains the session header with the due count, the Topbar that carries sign-out (and later S-04's create-card link), and loses the empty panel's dead-end link. Entry routing is untouched, so the page stays reachable via `dashboard.astro`'s existing "Start review" link and can be hand-tested in isolation.

### Changes Required:

#### 1. Session header with due count

**File**: `src/components/review/ReviewSession.tsx`

**Intent**: Show the learner where they are in the session — position and total — so the due count surfaces as a header rather than as a browsable list. Lives here because the numerator is the component's own `index` state.

**Contract**: Renders `Card {index + 1} of {queue.length}` above the card panel, inside the returned fragment that follows the existing `index >= queue.length` early return at line 47 — so the exhausted state keeps rendering `EmptyQueue` alone and never shows an out-of-range counter. No prop changes; `Props` stays `{ queue: DueCard[] }`.

#### 2. Topbar on the review page

**File**: `src/pages/review.astro`

**Intent**: Give the one page a signed-in learner reliably reaches a persistent navigation surface, so sign-out survives the dashboard becoming a redirect in Phase 2 and S-04's create-card link lands somewhere visible. See Key Discoveries — without this, S-04's feature merges clean and is unreachable.

**Contract**: Import `@/components/Topbar.astro` and render `<Topbar />` above the existing card panel, inside the page's outer container. `Topbar.astro` itself is not modified — it already reads `Astro.locals.user` on its own.

#### 3. Drop the dead-end link from the empty panel

**File**: `src/components/review/EmptyQueue.tsx`

**Intent**: Remove the `/dashboard` anchor, which becomes a loop back to the current page once Phase 2 lands. Sign-out in the Topbar is now the way off the page.

**Contract**: Delete the `<a href="/dashboard">` element (lines 19-24). Update the component's doc comment: it currently defers the empty-state design to S-03, and S-03 is deciding it here — a message with no action, deliberately, because every candidate destination redirects back to `/review`.

### Success Criteria:

#### Automated Verification:

- Linting and type checking pass: `npx astro sync && npm run lint`
- Formatting is clean: `npm run format`
- Production build succeeds: `npm run build`

#### Manual Verification:

- Header reads `Card 1 of N` matching the due count, and advances after one rating
- Exhausted state shows only the "nothing due" panel, no out-of-range counter
- Topbar renders on `/review` with the learner's email and a working Sign out
- Empty queue on arrival shows the linkless panel with sign-out reachable

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Run the dev server with `npm run dev -- --port 4322` — port 4321 is held by the parallel S-04 worktree. Phase blocks use plain bullets; the `- [ ]` checkboxes for these items live in `## Progress`.

---

## Phase 2: Entry Routing

### Overview

The three entry points move in one step, because they are one decision: sign-in, a bookmark on `/`, and the Topbar's Dashboard link all land in the due queue. A hand-run script asserts the full matrix for both signed-in and anonymous callers.

### Changes Required:

#### 1. Sign-in lands in the queue

**File**: `src/pages/api/auth/signin.ts`

**Intent**: Send a successfully authenticated learner to the review session instead of the marketing page.

**Contract**: The success redirect at line 19 targets `/review` instead of `/`. Error paths unchanged.

#### 2. `/` branches on session

**File**: `src/pages/index.astro`

**Intent**: Make "app open" mean the queue for a signed-in learner however they arrive — bookmark, typed URL, or browser restore — not only in the moments right after sign-in. This is the actual symptom the roadmap recorded. Anonymous visitors keep the marketing page.

**Contract**: Read `Astro.locals.user` in the frontmatter; when non-null, `return Astro.redirect("/review")` before rendering. Otherwise render `<Layout><Welcome /></Layout>` as today. `Welcome.astro` is not modified. The route stays absent from `PROTECTED_ROUTES` — it must serve anonymous visitors.

#### 3. `/dashboard` becomes a redirect

**File**: `src/pages/dashboard.astro`

**Intent**: Retire the interim hub page without breaking `Topbar.astro:13`, which links to it and belongs to S-04. FR-002's resolution ruled out a separate view to browse, so the route survives as a redirect rather than as a page.

**Contract**: Replace the file's entire contents with a frontmatter-only `return Astro.redirect("/review")`. The deck-count query, the layout, the interim "Start review" link, and the sign-out form all go — sign-out now lives in the Topbar added in Phase 1. Carry a comment naming why the route still exists (`Topbar.astro` links here and S-04 owns that file), so it is not deleted as dead weight later.

#### 4. Executable check for the routing matrix

**File**: `scripts/verify-entry-routing.ts`

**Intent**: Make the redirect outcomes assertable instead of only clickable — the entire value of this slice is where each entry point sends the learner, and that is silently breakable by any future middleware or routing edit.

**Contract**: Follows the `scripts/verify-srs-ordering.ts` pattern: plain Node under `--experimental-strip-types`, importing nothing that needs the `@/` alias or `astro:env`. Reads `BASE_URL` (default `http://localhost:4322`), `VERIFY_EMAIL`, and `VERIFY_PASSWORD` from the environment. Signs in with a form-encoded POST to `/api/auth/signin`, captures the `Set-Cookie` values, and asserts the table below, exiting non-zero with a readable diff on the first failure:

| Request                      | Session | Expect               |
| ---------------------------- | ------- | -------------------- |
| `POST /api/auth/signin` (ok) | —       | 302 → `/review`      |
| `GET /`                      | yes     | 302 → `/review`      |
| `GET /dashboard`             | yes     | 302 → `/review`      |
| `GET /review`                | yes     | 200                  |
| `GET /`                      | no      | 200                  |
| `GET /dashboard`             | no      | 302 → `/auth/signin` |
| `GET /review`                | no      | 302 → `/auth/signin` |

Every request uses `redirect: "manual"` — following redirects would collapse the distinction the script exists to check.

#### 5. Script entry point

**File**: `package.json`

**Intent**: Make the check runnable the same way `verify:srs` is.

**Contract**: Add `"verify:routing": "node --experimental-strip-types scripts/verify-entry-routing.ts"` to `scripts`, beside `verify:srs`.

### Success Criteria:

#### Automated Verification:

- Routing matrix passes: `npm run verify:routing` exits zero against a dev server on port 4322
- SRS ordering still passes: `npm run verify:srs`
- Linting and type checking pass: `npx astro sync && npm run lint`
- Production build succeeds: `npm run build`

#### Manual Verification:

- Sign-in lands directly on `/review` with the queue and header
- `/` redirects to `/review` when signed in, shows marketing when signed out
- Topbar's Dashboard link lands on `/review`
- Learner with nothing due reaches the panel on app open and can sign out
- Signed out, `/review` and `/dashboard` both redirect to `/auth/signin`

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before archiving the change.

---

## Testing Strategy

No test runner is introduced; this repo verifies with hand-run scripts plus manual passes.

### Executable checks:

- `scripts/verify-entry-routing.ts` — the matrix above, the one thing in this slice worth automating, because a redirect that silently reverts looks identical to one that works until someone opens a bookmark.
- `scripts/verify-srs-ordering.ts` — unchanged, re-run to confirm this slice did not disturb scheduling.

### Manual Testing Steps:

Run the dev server as `npm run dev -- --port 4322` (4321 belongs to the parallel S-04 worktree).

1. Signed out, open `/` — marketing page renders, Topbar shows "Not signed in".
2. Sign in — land on `/review` with `Card 1 of N` and the Topbar showing the learner's email.
3. Reveal and rate one card — counter advances to `Card 2 of N`, next card appears without a navigation.
4. Rate through the rest — the "nothing due" panel appears, with no link and with sign-out available above it.
5. Open `/` again while still signed in — redirected to `/review`, which now shows the empty panel.
6. Click Dashboard in the Topbar — lands on `/review`.
7. Sign out, then request `/review` and `/dashboard` directly — both bounce to `/auth/signin`.

## Performance Considerations

None beyond what exists. The due count reuses the snapshot `review.astro` already fetches, so this slice adds zero queries. The `(user_id, next_review_at)` index already covers that read. Retiring `dashboard.astro` removes one `count` query from the app entirely.

## Migration Notes

No migration. `public.cards` is untouched. The only user-visible discontinuity is that `/dashboard` stops rendering a page and starts redirecting — no bookmark breaks, because the route still resolves.

## Parallel Work: S-04 Contact Points

Declared per `lessons.md` §"Parallel slices need declared file ownership, not just disjoint outcomes".

| File                           | Owner | This slice's action                                         |
| ------------------------------ | ----- | ----------------------------------------------------------- |
| `src/middleware.ts`            | S-04  | No change. Take S-04's version wholesale on rebase.         |
| `src/components/Topbar.astro`  | S-04  | Not edited. Rendered by `review.astro` (Phase 1 change #2). |
| `src/pages/dashboard.astro`    | S-03  | Replaced with a redirect. S-04 is barred from this file.    |
| `src/pages/index.astro`        | S-03  | Session branch added.                                       |
| `src/pages/api/auth/signin.ts` | S-03  | Redirect target changed.                                    |
| `src/pages/review.astro`       | S-03  | Topbar added.                                               |
| `src/components/review/*`      | S-03  | Header counter, dead link removed.                          |

**S-04 merges first. S-03 rebases onto it.** The Topbar render in Phase 1 is the load-bearing row: it is what keeps S-04's create-card link reachable after `/` stops serving signed-in learners.

## References

- Roadmap slice: `context/foundation/roadmap.md` §S-03, §S-04
- PRD requirement: `context/foundation/prd.md:62-64` (FR-002 and its resolution against a separate due-list view)
- Parallel-work rule: `context/foundation/lessons.md` §"Parallel slices need declared file ownership"
- Prior slice that built `/review`: `context/archive/2026-09-06-srs-review-and-reschedule/plan.md`
- Script pattern to follow: `scripts/verify-srs-ordering.ts`, wired at `package.json:11`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Session Surface

#### Automated

- [x] 1.1 Linting and type checking pass: `npx astro sync && npm run lint`
- [x] 1.2 Formatting is clean: `npm run format`
- [x] 1.3 Production build succeeds: `npm run build`

#### Manual

- [x] 1.4 Header reads `Card 1 of N` matching the due count, and advances after one rating
- [x] 1.5 Exhausted state shows only the "nothing due" panel, no out-of-range counter
- [x] 1.6 Topbar renders on `/review` with the learner's email and a working Sign out
- [x] 1.7 Empty queue on arrival shows the linkless panel with sign-out reachable

### Phase 2: Entry Routing

#### Automated

- [ ] 2.1 Routing matrix passes: `npm run verify:routing`
- [ ] 2.2 SRS ordering still passes: `npm run verify:srs`
- [ ] 2.3 Linting and type checking pass: `npx astro sync && npm run lint`
- [ ] 2.4 Production build succeeds: `npm run build`

#### Manual

- [ ] 2.5 Sign-in lands directly on `/review` with the queue and header
- [ ] 2.6 `/` redirects to `/review` when signed in, shows marketing when signed out
- [ ] 2.7 Topbar's Dashboard link lands on `/review`
- [ ] 2.8 Learner with nothing due reaches the panel on app open and can sign out
- [ ] 2.9 Signed out, `/review` and `/dashboard` both redirect to `/auth/signin`
