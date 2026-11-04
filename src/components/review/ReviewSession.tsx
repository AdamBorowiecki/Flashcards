import { useState } from "react";
import { Eye } from "lucide-react";
import { ServerError } from "@/components/auth/ServerError";
import { EmptyQueue } from "@/components/review/EmptyQueue";
import { RATINGS } from "@/lib/srs";
import type { CardRating } from "@/lib/srs";

export interface DueCard {
  id: string;
  front: string;
  back: string;
}

interface Props {
  queue: DueCard[];
}

const RATING_LABEL: Record<CardRating, string> = {
  missed_it: "Missed it",
  got_it: "Got it",
  nailed_it: "Nailed it",
};

const RATING_STYLE: Record<CardRating, string> = {
  missed_it: "border-red-400/30 bg-red-500/15 hover:bg-red-500/25",
  got_it: "border-blue-300/30 bg-blue-400/15 hover:bg-blue-400/25",
  nailed_it: "border-emerald-300/30 bg-emerald-400/15 hover:bg-emerald-400/25",
};

/**
 * Walks the due queue that review.astro rendered.
 *
 * The queue is a snapshot taken at page load, so each rating is a background POST and the next
 * card appears without a navigation -- the shape prd.md:78 asks for ("rating submission is
 * perceptibly immediate"). That is why this is the repo's first fetch(): the form-POST convention
 * everywhere else was set on one-shot auth forms, where a full navigation is the point.
 *
 * useFormStatus does not apply to a fetch, so pending state is explicit below.
 */
export default function ReviewSession({ queue }: Props) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The queue ran out: the learner rated the last card. Same panel review.astro renders on arrival.
  if (index >= queue.length) {
    return <EmptyQueue />;
  }

  const card = queue[index];

  async function rate(rating: CardRating) {
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/cards/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_id: card.id, rating }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        // Deliberately do NOT advance. A rating that silently did not land would leave the card
        // scheduled wrongly with nothing to show for it -- the swallowed failure lessons.md forbids.
        setError(body?.error ?? `Could not save that rating (${response.status}). Try again.`);
        return;
      }

      setIndex((current) => current + 1);
      setRevealed(false);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      {/*
       * The due count, as a session header rather than a list to browse (FR-002's own resolution).
       * Both numbers come from the snapshot review.astro fetched at page load: the denominator cannot
       * grow mid-session, because enable_short_term: false (src/lib/srs.ts:68) means even a card rated
       * missed_it comes back tomorrow, not later today. That is what makes a fixed total honest here.
       *
       * Sits below the index >= queue.length early return above, so the exhausted state renders
       * EmptyQueue alone instead of "Card 13 of 12".
       */}
      <p className="text-center text-sm text-blue-100/60">
        Card {index + 1} of {queue.length}
      </p>

      <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
        <p className="text-xs tracking-wide text-blue-100/50 uppercase">Front</p>
        <p className="mt-1 text-2xl font-semibold text-white">{card.front}</p>

        {revealed ? (
          <>
            <p className="mt-6 text-xs tracking-wide text-blue-100/50 uppercase">Back</p>
            <p className="mt-1 text-2xl font-semibold text-purple-200">{card.back}</p>
          </>
        ) : null}
      </div>

      <ServerError message={error} />

      {revealed ? (
        <div className="grid grid-cols-3 gap-2">
          {RATINGS.map((rating) => (
            <button
              key={rating}
              type="button"
              disabled={pending}
              onClick={() => void rate(rating)}
              className={`rounded-lg border px-3 py-3 text-sm font-medium text-white transition-colors disabled:opacity-50 ${RATING_STYLE[rating]}`}
            >
              {RATING_LABEL[rating]}
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setRevealed(true);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/20"
        >
          <Eye className="size-4" />
          Reveal answer
        </button>
      )}
    </div>
  );
}
