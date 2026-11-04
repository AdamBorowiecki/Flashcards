/**
 * Unit tests for the card content rules.
 *
 * src/lib/cards.ts exists because the creation endpoint and the form island used to hold their own
 * copies of these rules, bound only by a comment -- and that had already produced a real bug: the
 * two sides disagreed about whether the label was capitalised, so the identical mistake read
 * differently depending on which layer caught it. These tests pin the shared contract, label text
 * included, since that is what diverged.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { MAX_SIDE_LENGTH, validateSide } from "../src/lib/cards.ts";

describe("MAX_SIDE_LENGTH", () => {
  it("caps a side at 500 characters", () => {
    // A layout guard, not a data-integrity guarantee -- the database enforces non-blank only. Pinned
    // because the error message quotes it, so a change here changes user-facing copy.
    assert.equal(MAX_SIDE_LENGTH, 500);
  });
});

describe("validateSide", () => {
  it("accepts ordinary text and returns it", () => {
    assert.deepEqual(validateSide("ephemeral", "Front"), { text: "ephemeral" });
  });

  it("trims before returning, so what the learner sees confirmed is what landed", () => {
    assert.deepEqual(validateSide("  ephemeral\n", "Front"), { text: "ephemeral" });
  });

  describe("rejects a missing side", () => {
    // Anything that is not a string at all is "required", distinct from a string that is blank.
    // Named explicitly rather than derived from the value: JSON.stringify(undefined) returns
    // undefined, not a string, so a generated name would read as an empty test title.
    const nonStrings: [name: string, value: unknown][] = [
      ["null", null],
      ["undefined", undefined],
      ["a number", 42],
      ["an object", {}],
      ["an array", []],
      ["a boolean", true],
    ];

    for (const [name, value] of nonStrings) {
      it(`rejects ${name}`, () => {
        assert.deepEqual(validateSide(value, "Front"), { error: "Front is required" });
      });
    }
  });

  describe("rejects a blank side", () => {
    for (const value of ["", " ", "\t", "\n", "   \t\n  "]) {
      it(`rejects ${JSON.stringify(value)}`, () => {
        assert.deepEqual(validateSide(value, "Back"), { error: "Back cannot be blank" });
      });
    }
  });

  describe("the length cap", () => {
    it("accepts a side of exactly MAX_SIDE_LENGTH", () => {
      const text = "a".repeat(MAX_SIDE_LENGTH);
      assert.deepEqual(validateSide(text, "Front"), { text });
    });

    it("rejects one character over the cap", () => {
      assert.deepEqual(validateSide("a".repeat(MAX_SIDE_LENGTH + 1), "Front"), {
        error: `Front must be ${MAX_SIDE_LENGTH} characters or fewer`,
      });
    });

    it("judges length after trimming, so padding does not push a side over", () => {
      // Explicitly promised by the module's doc comment: "a side that only fits under the cap once
      // trimmed passes". Trim-then-judge and judge-then-trim differ only on this input.
      const text = "a".repeat(MAX_SIDE_LENGTH);
      assert.deepEqual(validateSide(`  ${text}  `, "Front"), { text });
    });
  });

  describe("the label", () => {
    // The capitalisation divergence this module was extracted to prevent. The label is interpolated
    // verbatim into all three messages; callers pass "Front" and "Back".
    for (const label of ["Front", "Back"]) {
      it(`uses "${label}" verbatim in every message`, () => {
        assert.deepEqual(validateSide(null, label), { error: `${label} is required` });
        assert.deepEqual(validateSide("  ", label), { error: `${label} cannot be blank` });
        assert.deepEqual(validateSide("a".repeat(MAX_SIDE_LENGTH + 1), label), {
          error: `${label} must be ${MAX_SIDE_LENGTH} characters or fewer`,
        });
      });
    }
  });
});
