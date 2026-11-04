import { CheckCheck } from "lucide-react";

/**
 * Shown when nothing is due -- both on arrival at an empty queue and after the last card is rated.
 *
 * Deliberately one panel for both cases, and deliberately without an exit link. S-03 owned the open
 * question of what a learner with nothing due should see, and settled it here: a message and nothing
 * else, because after this slice every candidate destination is a loop -- / and /dashboard both
 * redirect back to /review. The way off the page is Sign out in the Topbar that review.astro renders
 * above this panel.
 *
 * Rendered by review.astro for the arrival case and by ReviewSession for the exhausted case, so the
 * two are the same component rather than two panels that look alike until one of them drifts.
 */
export function EmptyQueue() {
  return (
    <div className="text-center">
      <CheckCheck className="mx-auto size-8 text-emerald-300" />
      <p className="mt-3 text-lg font-semibold text-white">Nothing due right now</p>
      <p className="mt-1 text-sm text-blue-100/60">Come back later and your next cards will be waiting.</p>
    </div>
  );
}
