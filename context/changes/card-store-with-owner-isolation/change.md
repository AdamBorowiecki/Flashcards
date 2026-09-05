---
change_id: card-store-with-owner-isolation
title: Card storage with per-learner isolation
status: planned
created: 2026-09-05
updated: 2026-09-05
archived_at: null
---

## Notes

F-01 z @.claude/skills/10x-roadmap/SKILL.md

Resolved reference: the item is **F-01** in `@context/foundation/roadmap.md` (the roadmap document), not in the skill file the argument pointed at.

Scope per the roadmap, held deliberately narrow — one card record and its access rule, not a general data layer:

- A card record persists front, back, its owning learner, and the timestamp at which it next becomes due.
- A learner can read and write only their own cards, enforced at the database layer rather than in application code.
- **No scheduling state.** Open Roadmap Question 5 (which SRS scheme sets the next due date) is open and blocks S-02; whatever per-card state the chosen scheme needs arrives with that slice. This foundation must not prejudge it.

Unlocks S-01, S-02, S-04. Watch for scope creep into review history, statistics tables, or deck grouping — no must-have requirement asks for those.
