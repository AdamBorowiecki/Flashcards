import type { APIRoute } from "astro";
import { emptySchedulingState } from "@/lib/srs";

/**
 * Create one card for the signed-in learner (roadmap S-04, PRD FR-001).
 *
 * Same JSON contract rate.ts established -- same guard order, same json() helper, same stance that
 * "not signed in" and "malformed" have to be distinguishable by a fetch() caller.
 *
 *   201  { id, front, next_review_at }   card saved
 *   400  { error }                       body not JSON, not an object, or a side is blank / too long
 *   401  { error }                       no session
 *   500  { error }                       Supabase failed, or is not configured
 *
 * The 201 body comes from the inserted row, not from the request. A confirmation built out of what
 * the caller sent would describe a write that may never have landed, and trimming alone already
 * makes the two differ.
 */

/**
 * Application-only cap. The database enforces non-blank (cards_front_not_blank /
 * cards_back_not_blank) and nothing else -- roadmap S-04 rules out a migration for this slice, so a
 * row inserted by any other means bypasses this limit. It exists to stop a pasted wall of text from
 * breaking the review panel's layout, not as a data-integrity guarantee.
 */
const MAX_SIDE_LENGTH = 500;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Trim first, then judge: " " is blank, and a side that only fits under the cap once trimmed passes. */
function readSide(value: unknown, label: string): { text: string } | { error: string } {
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

export const POST: APIRoute = async (context) => {
  // Middleware already built this and stashed it (src/middleware.ts:9); no reason to build a second.
  const supabase = context.locals.supabase;
  if (!supabase) {
    return json({ error: "Supabase is not configured" }, 500);
  }

  // cards_insert_own checks auth.uid() = user_id, but user_id has no column default -- the insert
  // below has to name it, so the session is required before anything else is worth doing.
  const user = context.locals.user;
  if (!user) {
    return json({ error: "Not signed in" }, 401);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Body must be JSON" }, 400);
  }

  if (typeof body !== "object" || body === null) {
    return json({ error: "Body must be a JSON object" }, 400);
  }

  const { front: rawFront, back: rawBack } = body as Record<string, unknown>;

  const front = readSide(rawFront, "front");
  if ("error" in front) {
    return json({ error: front.error }, 400);
  }

  const back = readSide(rawBack, "back");
  if ("error" in back) {
    return json({ error: back.error }, 400);
  }

  // One `now` for both the scheduling state and the due date. Two calls to new Date() would put
  // milliseconds between them, and the state FSRS builds is anchored to the moment it was built.
  const now = new Date();

  // The eight columns are written explicitly rather than left to their defaults: src/lib/srs.ts is
  // the single definition of what a new card's schedule looks like, and a ts-fsrs upgrade that
  // changed createEmptyCard() would otherwise drift away from the migration's defaults in silence.
  const { data: card, error } = await supabase
    .from("cards")
    .insert({
      user_id: user.id,
      front: front.text,
      back: back.text,
      ...emptySchedulingState(now),
      next_review_at: now.toISOString(),
    })
    .select("id, front, next_review_at")
    .single<{ id: string; front: string; next_review_at: string }>();

  if (error) {
    return json({ error: error.message }, 500);
  }

  return json(card, 201);
};
