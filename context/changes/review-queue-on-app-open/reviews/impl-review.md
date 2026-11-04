<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: App Opens Straight Into the Due Queue

- **Plan**: `context/changes/review-queue-on-app-open/plan.md`
- **Scope**: Full plan — Phase 1 and Phase 2 of 2 (all Progress checkboxes `[x]`)
- **Date**: 2026-11-04
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 5 observations

> Every warning sits in the verification script or the lint config. The shipped
> application code matched the plan on all eight planned changes, respected all
> nine scope guardrails, and the slice's central mechanism was verified sound.

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | WARNING |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | WARNING |

### Evidence for the PASS dimensions

- **Plan Adherence** — all 8 planned changes verdict MATCH. The plan's critical
  ordering detail holds: the `index >= queue.length` early return is at
  `ReviewSession.tsx:47-49`, the header at `:92-94` inside the fragment opening
  at `:81`, so the exhausted state cannot render `Card 13 of 12`. All 7 rows of
  the routing matrix are genuinely asserted (`verify-entry-routing.ts:43-49`
  plus the sign-in assertion at `:95-97`), status *and* location, with
  `redirect: "manual"` on both fetch calls (`:81`, `:118`).
- **Architecture** — the ownership table in `## Parallel Work: S-04 Contact
  Points` was honored exactly. `src/middleware.ts`, `src/components/Topbar.astro`,
  `src/components/Welcome.astro`, `src/lib/srs.ts` and
  `src/pages/api/cards/rate.ts` all have empty diffs against `main`. The
  load-bearing decision — rendering `<Topbar />` from `review.astro:47` rather
  than editing S-04's file — is implemented as designed, which is what keeps
  S-04's `/cards/new` link (`Topbar.astro:15`) reachable after `/` stops serving
  signed-in learners.
- **Pattern Consistency** — the new script matches both siblings on docblock
  shape, the `fail(): never` to `stderr` + `exit(1)` helper, `process.stdout.write`
  progress lines and the closing "all assertions passed" line; it imports
  nothing, so it correctly avoids the `@/` alias and `astro:env`. React changes
  match the repo's export split (default for hydrated islands, named for
  leaves), its `interface Props` convention, and `CreateCardForm.tsx:69-104`'s
  error-handling shape. The one added Tailwind class string reuses the exact
  secondary-text token set already at `EmptyQueue.tsx:20`, `review.astro:58` and
  `Topbar.astro:30`.

### Verified: the slice's central mechanism is sound

`src/pages/index.astro:12` branches on `Astro.locals.user` for a route that is
deliberately absent from `PROTECTED_ROUTES`. `src/middleware.ts:15-22` populates
`context.locals.user` unconditionally for **every** request, before the
protected-route gate at `:24` — that gate only decides whether to redirect, not
whether to populate. So the `/` redirect does fire for signed-in learners. Had
the middleware populated `locals.user` only on protected routes, this slice's
headline behavior would have been silently dead.

## Findings

### F1 — `BASE_URL` default can silently verify the wrong server

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `scripts/verify-entry-routing.ts:29`
- **Detail**: The script's own docblock at `:13-14` says "BASE_URL has no default
  worth trusting: this repo is worked in parallel git worktrees, so 4321 and the
  next few ports are routinely taken." Line 29 then supplies one anyway:
  `process.env.BASE_URL ?? "http://localhost:4322"`. If `BASE_URL` is unset and
  another worktree's dev server holds 4322 — the exact scenario the comment
  describes, and this slice was built in one of three parallel worktrees — all
  seven assertions run against the wrong checkout and the script prints
  `all 7 assertions passed`. That is the swallowed-failure shape
  `context/foundation/lessons.md` §"A swallowed failure needs a defined way to be
  noticed" forbids, and it is the opposite of the stance the script itself takes
  for missing credentials at `:131-139`.
- **Fix**: Drop the `??` default and hard-fail on a missing `BASE_URL`, reusing
  the message shape already at `:134-139`. Then reconcile the docblock at `:13-14`
  with the code.
  - Strength: Makes the script's behavior match its own stated reasoning, and
    removes the one way it can report success about a server nobody asked it to
    check.
  - Tradeoff: Every invocation must now pass `BASE_URL` explicitly. The plan's
    own manual-testing steps already do.
  - Confidence: HIGH — the identical hard-fail pattern is nine lines below, in
    the same file, for the same reason.
  - Blind spot: None significant.
- **Decision**: PENDING

### F2 — No `fetch` failure handling; the most likely failure mode crashes raw

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `scripts/verify-entry-routing.ts:69, 116`
- **Detail**: Neither `signIn` nor `assertRoute` wraps its `fetch`, and both are
  awaited at top level (`:143`, `:146`). With no dev server listening, Node dies
  on an unhandled `TypeError: fetch failed` / `ECONNREFUSED` stack trace instead
  of the readable `verify-entry-routing: …` line every other failure path
  produces. "Forgot to start `astro dev`" and "wrong port" are the single most
  likely failure modes for this script — and with F1 unfixed, the wrong-port case
  is the one that does not even crash.
- **Fix**: Wrap both fetch calls and route the rejection through `fail()` with
  `BASE_URL` in the message.
  - Strength: The script's whole value is a readable verdict; this closes the one
    path that bypasses it.
  - Tradeoff: A few lines in two functions.
  - Confidence: HIGH — `fail()` already exists at `:52-55` and takes exactly the
    needed shape.
  - Blind spot: None significant.
- **Decision**: PENDING

### F3 — Unplanned `eslint.config.js` change, necessary but unrecorded

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: `eslint.config.js:68-76`
- **Detail**: The only changed file absent from the plan. It sets
  `@typescript-eslint/no-misused-promises: "off"` inside the
  `files: ["**/*.astro"]` block at `:63`, overriding the repo-wide
  `["error", { checksVoidReturn: { attributes: false } }]` at `:36` for `.astro`
  files only. **It is genuinely required**, verified by reproduction rather than
  taken on faith: with the rule re-enabled, ESLint aborts the entire run with
  `Error: Non-null Assertion Failed: Expected node to have a parent` thrown from
  the rule's `checkReturnStatement` handler, on `src/pages/index.astro:13` — the
  new `return Astro.redirect("/review")`. Because it is a hard crash and not a
  lint report, an inline `eslint-disable` genuinely cannot suppress it, as the
  comment claims. So this change is a precondition for Phase 2 changes 2 and 3
  existing at all; the plan simply did not anticipate it. The problem is only
  that it arrived silently: a future review reading the plan as ground truth
  would flag it again, and the next person to tidy lint config has no record of
  why it cannot be removed.
- **Fix A ⭐ Recommended**: Record it as an addendum in the plan — a numbered
  change under Phase 2 with the reproduction command and the crash output.
  - Strength: Puts the justification where the next reviewer and `/10x-archive`
    will look, and preserves the reproduction so nobody has to rediscover it.
  - Tradeoff: The plan becomes a slightly moving target after implementation.
  - Confidence: HIGH — the in-file comment at `:68-75` already carries most of
    the prose; this is a transcription, not new reasoning.
  - Blind spot: None significant.
- **Fix B**: Record it as an entry in `context/foundation/lessons.md` instead —
  "a page-level `Astro.redirect` in frontmatter crashes `no-misused-promises`".
  - Strength: Durable across slices; the next `.astro` page that returns a
    redirect hits this, and lessons.md is re-read by `/10x-plan` and
    `/10x-implement`, so it would be anticipated next time rather than
    rediscovered.
  - Tradeoff: Leaves this plan's record incomplete; lessons.md is for recurring
    rules, and one occurrence is not yet a pattern.
  - Confidence: MEDIUM — depends whether more frontmatter redirects are coming.
    `dashboard.astro` plans to disappear once S-04 merges (`dashboard.astro:9`),
    which would leave just one such page.
  - Blind spot: Haven't surveyed the roadmap's remaining slices for further
    page-level redirects.
- **Decision**: PENDING

### F4 — `"off"` is broader than the crash requires, and the comment overstates what remains covered

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `eslint.config.js:76` (comment at `:74-75`)
- **Detail**: Two linked points. (1) The parser crash lives in the rule's
  `ReturnStatement` handler, which is registered only by the `checksVoidReturn`
  group — so `["error", { checksVoidReturn: false }]` should dodge the crash
  while keeping `checksConditionals` live, where `"off"` kills both for all 12
  `.astro` files (`src/components/{Banner,Topbar,Welcome}.astro`,
  `src/components/ui/LibBadge.astro`, `src/layouts/Layout.astro`,
  `src/pages/auth/{confirm-email,signin,signup}.astro`,
  `src/pages/cards/new.astro`, `src/pages/{dashboard,index,review}.astro`), not
  just the two redirect pages. (2) The comment at `:74-75` claims
  `no-floating-promises` still guards a dropped `await` in frontmatter queries.
  It does so in *statement* position but not in *condition* position:
  `if (supabase.from("cards").select(…))` in frontmatter would now go unflagged —
  precisely a dropped-await bug in a page like `review.astro`, whose frontmatter
  query is the one this slice puts on every learner's entry path.
- **Fix**: Try `["error", { checksVoidReturn: false }]` in place of `"off"` and
  re-run `npm run lint`. If the crash persists, keep `"off"` and narrow the
  comment's residual-coverage claim to what is actually true.
  - Strength: Either outcome leaves the config honest — the rule as tight as the
    crash permits, or the comment matching reality.
  - Tradeoff: One lint run to find out; may end up back at `"off"`.
  - Confidence: MEDIUM — the handler-registration reasoning is sound, but
    `astro-eslint-parser` is the thing crashing and its interaction with the
    option group is not documented.
  - Blind spot: Have not tested the narrower setting; the crash may be reachable
    through `checksConditionals` too.
- **Decision**: PENDING

### F5 — Unbounded due-queue query is now on every learner's entry path

- **Severity**: 📋 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/pages/review.astro:19-23`
- **Detail**: The due-queue read has no `.limit()` or `.range()` (neither appears
  anywhere in `src/`), and the entire result is serialized into the island's
  props in the HTML. Pre-existing — the query block is byte-identical to `main`,
  and this slice adds zero queries and net removes one (`dashboard.astro`'s
  `count: "exact"`). Raising it because the slice changes *who pays*: `/review`
  becomes the sole landing page for every signed-in learner, so an unbounded read
  moves from a page people navigated to onto the hot path of every app open. A
  learner returning after a long absence with a large deck pays for it on first
  paint.
- **Fix**: Add a session cap (`.limit(N)`) to the queue read. The
  `(user_id, next_review_at)` index already orders the read, so the cap is free —
  and the fixed denominator in the header stays honest because
  `enable_short_term: false` (`src/lib/srs.ts:68`) means the snapshot cannot grow
  mid-session.
  - Strength: Bounds the one read every entry now depends on, with no new query
    and no change to the counter's semantics.
  - Tradeoff: Picking N is a product decision about session length, which this
    slice deliberately did not take on — "no separate due-list view" was a scope
    guardrail, and a cap edges toward that conversation.
  - Confidence: MEDIUM — mechanically trivial; the right N is not a code
    question.
  - Blind spot: No data on realistic deck sizes for this app's learners.
- **Decision**: PENDING

### F6 — Documented invocation puts the test password on the command line

- **Severity**: 📋 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `scripts/verify-entry-routing.ts:11`
- **Detail**: The docblock's suggested invocation is
  `BASE_URL=… VERIFY_EMAIL=… VERIFY_PASSWORD=… npm run verify:routing`. That
  lands the password in shell history and makes it visible in the process list
  for the lifetime of the run. The script's own handling is clean — credentials
  are read from `process.env` (`:30-31`), never logged, and the
  rejected-credentials path at `:92` prints only Supabase's error text.
- **Fix**: Document sourcing a gitignored env file instead, e.g.
  `set -a; . ./.env.verify; npm run verify:routing`.
- **Decision**: PENDING

### F7 — POST redirect uses 302 where 303 is correct, and the script now pins it

- **Severity**: 📋 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/pages/api/auth/signin.ts:19`, `scripts/verify-entry-routing.ts:95`
- **Detail**: All three redirects use Astro's default 302. Correct for the two
  GET redirects — 301 would be permanently cached, which matters because
  `dashboard.astro:9` plans to delete that route once S-04 merges. For the
  POST → `/review` redirect, 303 is the technically correct code to force a GET;
  browsers convert POST+302 to GET, so it works today. Worth noting only because
  `verify-entry-routing.ts:95` now hard-asserts `status !== 302`, so a later
  correctness fix to 303 would fail the script with no hint why.
- **Fix**: If 302 is intentional, say so in a comment at `signin.ts:19` and note
  that the script pins it.
- **Decision**: PENDING

### F8 — Three stale line references in new comments

- **Severity**: 📋 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/pages/index.astro:11`, `src/pages/dashboard.astro:2-9`, `scripts/verify-entry-routing.ts:18`
- **Detail**: `index.astro:11` cites `src/middleware.ts:4` for `PROTECTED_ROUTES`,
  which is at `:8` (line 4 starts its comment block). `dashboard.astro` and
  `verify-entry-routing.ts:18` both cite `Topbar.astro:13` for the `/dashboard`
  anchor, which is at `:18` (13 is a comment line). The reasoning in all three
  comments is correct; only the line numbers are off. Minor, but these comments
  exist specifically so the next person can follow the cross-slice dependency,
  and a wrong line number sends them to a comment instead of the code.
- **Fix**: Correct the three references to `middleware.ts:8` and
  `Topbar.astro:18`.
- **Decision**: PENDING

### F9 — Frontmatter-only redirect is a new idiom; blank 200 if a condition is ever added

- **Severity**: 📋 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/pages/dashboard.astro:10`
- **Detail**: `Astro.redirect` appears at exactly two call sites in `src/pages/`,
  both new on this branch; every pre-existing redirect lives in middleware
  (`middleware.ts:26`) or an API route. This is still the right choice, not a
  mismatch — `middleware.ts:8` already lists `/dashboard` as protected, so a
  middleware redirect would have to be ordered after the auth gate to preserve
  the anonymous `→ /auth/signin` behavior that `verify-entry-routing.ts:48`
  asserts, whereas the page-level redirect gets that ordering for free. The one
  latent trap: a template-less `.astro` file is valid only because the `return`
  is unconditional. Add a condition later without a template and the fallthrough
  serves a blank 200.
- **Fix**: Note the unconditional-return requirement in the existing comment
  block at `dashboard.astro:2-9`.
- **Decision**: PENDING

## Success Criteria

Re-run independently at review time, from the plan's Automated Verification
lists:

| Criterion                     | Command                          | Result                                             |
| ----------------------------- | -------------------------------- | -------------------------------------------------- |
| 1.1 / 2.3 lint and type check | `npx astro sync && npm run lint` | PASS — clean, only astro parser notices            |
| 1.2 formatting                | `npx prettier --check .`         | PASS — "All matched files use Prettier code style" |
| 1.3 / 2.4 production build    | `npm run build`                  | PASS — exit 0, server built in 15.72s              |
| 2.2 SRS ordering unaffected   | `npm run verify:srs`             | PASS — all assertions passed                       |
| 2.1 routing matrix            | `npm run verify:routing`         | NOT RE-VERIFIED — needs `VERIFY_EMAIL` / `VERIFY_PASSWORD` and a dev server on 4322 |

`npm run format` was run as `prettier --check` rather than `--write`, to avoid a
review mutating the tree.

On 2.1: the script's missing-credentials path was exercised and exits 1 with a
readable message, so the check is wired correctly; only the matrix itself is
unconfirmed at review time. It is marked `[x]` in Progress against `85c88e2`, and
the eight manual criteria across both phases are likewise marked `[x]` against
`238b6a0` and `85c88e2`. All eight have observable support in the diff — the
header at `ReviewSession.tsx:92-94`, the Topbar render at `review.astro:47`, the
linkless panel at `EmptyQueue.tsx:20`, and the three redirect targets — so none
reads as rubber-stamped. Note that F1 means a `verify:routing` run with
`BASE_URL` unset could have passed against another worktree's server; re-running
it with `BASE_URL` set explicitly would settle 2.1 independently.
