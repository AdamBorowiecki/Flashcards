import type { APIRoute } from "astro";
import { SCHEDULING_STATE_COLUMNS, isCardRating, schedule } from "@/lib/srs";
import type { CardSchedulingState } from "@/lib/srs";

/**
 * Apply one rating to one card and persist the schedule ts-fsrs chose.
 *
 * This is the repo's first JSON endpoint, first explicit status code, and first route to read
 * context.locals. None of that follows an existing convention -- the three auth endpoints parse
 * formData and answer with 302 redirects, which is right for a browser form and wrong for a
 * fetch() caller that has to distinguish "not yours" from "malformed". The contract is stated
 * here rather than inferred.
 *
 *   200  { next_review_at }   the rating landed
 *   400  { error }            body was malformed, or the rating token is not one of the three
 *   401  { error }            no session
 *   404  { error }            no card with that id belongs to this learner
 *   500  { error }            Supabase failed, or is not configured
 */

// Derived from the shared list in @/lib/srs rather than spelled out here, so the column set this
// endpoint reads and the one api/cards/index.ts writes cannot drift apart. next_review_at rides
// along because TypeConvert.card() needs the due date to rebuild the card.
const SCHEDULING_COLUMNS = [...SCHEDULING_STATE_COLUMNS, "next_review_at"].join(", ");

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

  // RLS would block a cross-learner write anyway, but it does so by reporting zero rows updated --
  // indistinguishable from a stale card id. Without this guard the endpoint cannot answer truthfully.
  if (!context.locals.user) {
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

  const { card_id: cardId, rating } = body as Record<string, unknown>;

  if (typeof cardId !== "string" || cardId === "") {
    return json({ error: "card_id is required" }, 400);
  }

  if (!isCardRating(rating)) {
    return json({ error: "rating must be missed_it, got_it, or nailed_it" }, 400);
  }

  // No user_id predicate: cards_select_own scopes the read, the same stance dashboard.astro takes.
  const { data: card, error: readError } = await supabase
    .from("cards")
    .select(SCHEDULING_COLUMNS)
    .eq("id", cardId)
    .maybeSingle<CardSchedulingState & { next_review_at: string }>();

  if (readError) {
    return json({ error: readError.message }, 500);
  }

  if (!card) {
    return json({ error: "Card not found" }, 404);
  }

  const next = schedule(card, card.next_review_at, rating, new Date());

  const { error: writeError } = await supabase.from("cards").update(next).eq("id", cardId);

  if (writeError) {
    return json({ error: writeError.message }, 500);
  }

  return json({ next_review_at: next.next_review_at }, 200);
};
