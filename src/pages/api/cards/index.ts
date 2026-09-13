import type { APIRoute } from "astro";
import { emptySchedulingState } from "@/lib/srs";
import { validateSide } from "@/lib/cards";

/**
 * Create one card for the signed-in learner (roadmap S-04, PRD FR-001).
 *
 * Same JSON contract rate.ts established -- same guard order, same json() helper, same stance that
 * "not signed in" and "malformed" have to be distinguishable by a fetch() caller.
 *
 *   201  { id, front, next_review_at }   card saved
 *   400  { error }                       body not JSON, not an object, or a side is blank / too long
 *   401  { error }                       no session
 *   413  { error }                       body larger than MAX_BODY_BYTES
 *   500  { error }                       Supabase failed, or is not configured
 *
 * The 201 body comes from the inserted row, not from the request. A confirmation built out of what
 * the caller sent would describe a write that may never have landed, and trimming alone already
 * makes the two differ.
 */

/**
 * Body-size ceiling, enforced before the body is parsed.
 *
 * MAX_SIDE_LENGTH bounds what reaches the database and the review panel's layout; it does nothing
 * for the runtime, because request.json() has already materialised and parsed the whole payload by
 * the time any field is measured. Two 500-character sides are under 2 KB even in multi-byte text,
 * so this ceiling is generous for every honest caller while keeping one signed-in account from
 * spending the Worker's memory and CPU budget on a payload that was always going to be rejected.
 *
 * A chunked request carries no content-length, so this is a cheap filter rather than a hard bound.
 */
const MAX_BODY_BYTES = 16 * 1024;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
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

  const declaredLength = Number(context.request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return json({ error: "Body is too large" }, 413);
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

  const front = validateSide(rawFront, "Front");
  if ("error" in front) {
    return json({ error: front.error }, 400);
  }

  const back = validateSide(rawBack, "Back");
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
