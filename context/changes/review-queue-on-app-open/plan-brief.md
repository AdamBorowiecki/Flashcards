# App Opens Straight Into the Due Queue — Plan Brief

> Full plan: `context/changes/review-queue-on-app-open/plan.md`

## What & Why

Roadmap S-03 / PRD FR-002. A signed-in learner should open the app and land in a review session for whatever is due, with the due count as a session header — not a list to browse. Today they land on a static marketing page with no link onward and have to type `/dashboard` by hand, which is the whole point of the product ("they never decide what to study") failing at the front door.

## Starting Point

`/review` already does the hard part: it queries the due queue as a page-load snapshot and walks it through reveal-and-rate (`review.astro:18-22`, `ReviewSession.tsx`). What is missing is the way in. `signin.ts:19` redirects to `/`, `index.astro` is a session-unaware marketing page, and `dashboard.astro:39-45` carries a "Start review" link its own source comment marks as interim and assigns to this slice.

## Desired End State

Sign in, open `/` from a bookmark, or click Dashboard in the Topbar — all three land on `/review`, showing `Card 1 of N` above the first due card. The counter advances with each rating; when the queue empties, the "nothing due" panel appears with no dead link and sign-out reachable above it. Anonymous visitors still get the marketing page and are still bounced from the protected routes.

## Key Decisions Made

| Decision              | Choice                                        | Why (1 sentence)                                                                                                     | Source |
| --------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------ |
| Redirect location     | Both `signin.ts` and `/`                      | "App open" has to mean the queue for a bookmark too, not only right after sign-in — that is the recorded symptom.    | Plan   |
| Fate of `/dashboard`  | Survives as a redirect to `/review`           | `Topbar.astro:13` links to it and S-04 owns that file, so deleting the route would 404 a link this slice cannot fix. | Plan   |
| Due count semantics   | `Card 3 of 12` against the frozen snapshot    | The queue _is_ a snapshot and `enable_short_term: false` means it cannot grow mid-session, so the denominator holds. | Plan   |
| Nothing-due state     | Same `/review` route, `EmptyQueue` panel      | One route and one query — no second source of truth about what is due. Closes the roadmap's declared S-03 unknown.   | Plan   |
| S-04 entry-point risk | S-03 renders `<Topbar />` on `/review`        | Topbar renders only inside `Welcome.astro` today, so S-04's link would land on a page signed-in learners never see.  | Plan   |
| EmptyQueue exit link  | Removed entirely                              | After this slice every candidate target redirects back to `/review`, so any link is a loop; Topbar carries sign-out. | Plan   |
| Verification          | Hand-run redirect-matrix script + manual pass | The slice's whole value is where each entry point sends the learner, and that breaks silently; no test runner added. | Plan   |
| Marketing copy        | Out of scope                                  | No must-have asks for it and the project name is still open, so writing hero copy now means writing it twice.        | Plan   |

## Scope

**In scope:** post-sign-in redirect; `/` session branch; `/dashboard` → redirect; session header with due count; Topbar on `/review`; `EmptyQueue` link removal; `scripts/verify-entry-routing.ts` + npm script.

**Out of scope:** `src/middleware.ts` (S-04 owns it — and this slice needs no change there); `Topbar.astro` itself (rendered, never edited); `Welcome.astro` marketing copy; separate due-list view; refetch/polling; "come back at HH:MM" hint; card creation (S-04); any scheduling or `/api/cards/rate` change; test runner.

## Architecture / Approach

Three entry points converge on one route. `signin.ts` redirects to `/review`; `index.astro` branches on `Astro.locals.user` and redirects signed-in learners to `/review` while serving `Welcome` to everyone else; `dashboard.astro` collapses to an unconditional redirect. `/review` keeps its existing single snapshot query, so the due count is `queue.length` and costs nothing. The counter renders inside `ReviewSession` because the numerator is that component's `index` state. `<Topbar />` moves onto `/review` to keep a persistent nav surface once the dashboard stops being a page.

**Notably, no middleware change:** `/review` and `/dashboard` are already in `PROTECTED_ROUTES:4` and `/` must stay public — so the `PROTECTED_ROUTES` conflict the roadmap anticipates with S-04 simply does not arise.

## Phases at a Glance

| Phase              | What it delivers                                                          | Key risk                                                                                             |
| ------------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1. Session surface | Due-count header, Topbar on `/review`, `EmptyQueue` without the dead link | Counter rendering above the `index >= queue.length` early return, showing `Card 13 of 12` when spent |
| 2. Entry routing   | Three redirects flipped + `verify:routing` asserting the whole matrix     | A redirect loop, or `/` accidentally becoming inaccessible to anonymous visitors                     |

Surface before routing is deliberate: the routing phase removes both the `EmptyQueue` link and the old dashboard's sign-out button, so landing it first would leave an empty-queue learner with a looping link and no way out.

**Prerequisites:** S-02 done (it is, archived). S-04 merges first; this branch rebases onto it and takes its `src/middleware.ts` wholesale. Dev server on `--port 4322` — 4321 belongs to the S-04 worktree.
**Estimated effort:** ~1 session across 2 phases. Six small files, no migration, one new script.

## Open Risks & Assumptions

- **S-04 is planning against a roadmap claim that is now wrong.** It was told `Topbar.astro` is a safe surface because it is "outside S-03's scope" — true of the file, false of its reachability. Phase 1 fixes this from S-03's side; S-04 does not need to change, but the roadmap note is misleading and should be corrected when this slice closes.
- The routing script needs a live dev server plus `VERIFY_EMAIL` / `VERIFY_PASSWORD` in the environment — more setup than `verify:srs`, which runs standalone.
- Assumes `index.astro` stays server-rendered (`output: "server"`, no `prerender` export). A future `prerender = true` there would silently kill the `/` redirect — the script is what would catch it.
- An anonymous visitor sees starter marketing copy that does not mention flashcards. Accepted: no requirement covers it and the project name is unresolved.

## Success Criteria (Summary)

- A learner who opens the app — however they open it — is looking at a due card, not a marketing page or a hub.
- The number of cards due is visible as a session header, and no separate list view exists to browse.
- A learner with nothing due sees an honest "nothing due" panel and can still sign out; a signed-out visitor still cannot reach either protected route.
