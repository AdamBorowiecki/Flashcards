import React, { useState } from "react";
import { Plus, CheckCheck, Type, Languages } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { ServerError } from "@/components/auth/ServerError";
import { Button } from "@/components/ui/button";

/** Mirrors MAX_SIDE_LENGTH in src/pages/api/cards/index.ts. The server stays the authority; this
 * copy only saves a round-trip for a mistake the learner can see immediately. */
const MAX_SIDE_LENGTH = 500;

const FRONT_FIELD_ID = "front";

interface CreatedCard {
  id: string;
  front: string;
  next_review_at: string;
}

/**
 * Add cards to the learner's own deck (roadmap S-04, PRD FR-001).
 *
 * Follows ReviewSession rather than the auth forms: this is a fetch(), so useFormStatus does not
 * apply and pending state is explicit. Staying on the page is the point -- a learner writing out a
 * vocabulary list adds several cards in a row, and a navigation per card would make that worse.
 *
 * The confirmation names the front the SERVER returned, not the one that was typed. They differ
 * whenever trimming applies, and more importantly a confirmation built from local state would look
 * identical whether or not the write landed.
 */
export default function CreateCardForm() {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [errors, setErrors] = useState<{ front?: string; back?: string }>({});
  const [pending, setPending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<CreatedCard | null>(null);
  const [savedCount, setSavedCount] = useState(0);

  function validateSide(value: string, label: string): string | undefined {
    const text = value.trim();
    if (text === "") return `${label} cannot be blank`;
    if (text.length > MAX_SIDE_LENGTH) return `${label} must be ${MAX_SIDE_LENGTH} characters or fewer`;
    return undefined;
  }

  function validate() {
    const next: typeof errors = {
      front: validateSide(front, "Front"),
      back: validateSide(back, "Back"),
    };

    setErrors(next);
    return !next.front && !next.back;
  }

  function clearError(field: keyof typeof errors) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!validate()) return;

    setPending(true);
    setServerError(null);

    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ front, back }),
      });

      const body = (await response.json().catch(() => null)) as (CreatedCard & { error?: string }) | null;

      if (!response.ok) {
        // Deliberately keep both fields and do not increment. A cleared form after a failed write
        // would read as success and the learner would retype nothing -- the swallowed failure
        // lessons.md forbids, and the same stance ReviewSession takes on a failed rating.
        setServerError(body?.error ?? `Could not save that card (${response.status}). Try again.`);
        return;
      }

      if (!body) {
        setServerError("The card may not have been saved -- the server sent no confirmation. Check your deck.");
        return;
      }

      setLastSaved(body);
      setSavedCount((current) => current + 1);
      setFront("");
      setBack("");
      setErrors({});

      // FormField owns its own input and forwards no ref; reaching for the element by id keeps the
      // shared auth component untouched. Focus matters here because the whole point is typing the
      // next card without touching the mouse.
      document.getElementById(FRONT_FIELD_ID)?.focus();
    } catch {
      setServerError("Could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4" noValidate>
      <FormField
        id={FRONT_FIELD_ID}
        label="Front"
        value={front}
        onChange={(v) => {
          setFront(v);
          clearError("front");
        }}
        placeholder="window"
        error={errors.front}
        icon={<Type className="size-4" />}
      />

      <FormField
        id="back"
        label="Back"
        value={back}
        onChange={(v) => {
          setBack(v);
          clearError("back");
        }}
        placeholder="okno"
        error={errors.back}
        icon={<Languages className="size-4" />}
      />

      <ServerError message={serverError} />

      <Button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-500"
      >
        {pending ? (
          <span className="flex items-center gap-2">
            <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Adding card...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Plus className="size-4" />
            Add card
          </span>
        )}
      </Button>

      {lastSaved ? (
        <p className="flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          <CheckCheck className="size-4 shrink-0" />
          <span>
            Added <span className="font-semibold text-white">{lastSaved.front}</span> — {savedCount} this session
          </span>
        </p>
      ) : null}
    </form>
  );
}
