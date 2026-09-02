# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Feature flags must have a kill date before merge

- **Context**: Any phase that introduces a feature flag
- **Problem**: Flags accumulate without cleanup and become permanent dead code
- **Rule**: Every feature flag must include a kill-date comment or linked ticket before merge.
- **Applies to**: plan, implement, impl-review
