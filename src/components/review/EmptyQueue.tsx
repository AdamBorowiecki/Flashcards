import { CheckCheck } from "lucide-react";

/**
 * Shown when nothing is due -- both on arrival at an empty queue and after the last card is rated.
 *
 * Deliberately one panel for both cases. What a learner with nothing due should really see is an
 * open question the roadmap assigns to S-03, which owns the session header; this is the smallest
 * thing that makes the route honest in every state without pre-empting that design.
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
      <a
        href="/dashboard"
        className="mt-6 inline-block rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm text-white transition-colors hover:bg-white/20"
      >
        Back to dashboard
      </a>
    </div>
  );
}
