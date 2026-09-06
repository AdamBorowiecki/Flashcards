# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Feature flags must have a kill date before merge

- **Context**: Any phase that introduces a feature flag
- **Problem**: Flags accumulate without cleanup and become permanent dead code
- **Rule**: Every feature flag must include a kill-date comment or linked ticket before merge.
- **Applies to**: plan, implement, impl-review

## A swallowed failure needs a defined way to be noticed

- **Context**: Any code that catches broadly and continues — a trigger that must not abort its caller, a background job, a best-effort cache write.
- **Problem**: Swallowing is often the right call (an unhandled error in an `auth.users` trigger blocks registration behind an opaque "Database error saving new user"). But the failed state then looks identical to a legitimate one — a learner with an empty deck is indistinguishable from one who deleted their cards — and the only trace is a log line nobody reads. The first real signal is a person asking why the app looks blank.
- **Rule**: When you deliberately swallow a failure, name in the same commit how it will be noticed. A query someone can run, a count to eyeball, a documented symptom — not necessarily alerting. "It logs a warning" is not a way to be noticed.
- **Applies to**: plan, implement, impl-review
