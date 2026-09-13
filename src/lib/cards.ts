/**
 * Card content rules, in one place.
 *
 * Both the creation endpoint and the form island enforce these. They used to hold their own copies
 * bound by a comment, which is the same silent-divergence shape SCHEDULING_STATE_COLUMNS exists to
 * prevent for the scheduling columns -- and it had already produced one: the two sides disagreed
 * about whether the label was capitalised, so the identical mistake read differently depending on
 * which layer caught it.
 *
 * Unlike src/lib/srs.ts, this module carries no bare-node constraint: nothing under scripts/ imports
 * it, so it is free to grow Astro-shaped imports if it ever needs them.
 */

/**
 * The database enforces non-blank only (cards_front_not_blank / cards_back_not_blank); roadmap S-04
 * rules out a migration for this slice, so a row written by any other path bypasses this cap. It
 * exists to keep a pasted wall of text from breaking the review panel's layout, not as a
 * data-integrity guarantee.
 */
export const MAX_SIDE_LENGTH = 500;

export type SideResult = { text: string } | { error: string };

/**
 * Trim first, then judge: " " is blank, and a side that only fits under the cap once trimmed passes.
 * The trimmed text is what callers should store, so the value the learner sees confirmed back is the
 * value that landed.
 */
export function validateSide(value: unknown, label: string): SideResult {
  if (typeof value !== "string") {
    return { error: `${label} is required` };
  }

  const text = value.trim();

  if (text === "") {
    return { error: `${label} cannot be blank` };
  }

  if (text.length > MAX_SIDE_LENGTH) {
    return { error: `${label} must be ${MAX_SIDE_LENGTH} characters or fewer` };
  }

  return { text };
}
