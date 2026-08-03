import { describe, expect, it } from "vitest";
import { identity, showcases, work } from "./content";

// Standalone punctuation tokens are separators, not words.
function wordCount(...parts: string[]): number {
  return parts
    .join(" ")
    .split(/\s+/)
    .filter((t) => t.length > 0 && t !== "—" && t !== "-" && t !== "/").length;
}

describe("work entries", () => {
  it("keeps at most 5 details per entry", () => {
    for (const entry of work) {
      expect(entry.details.length, entry.company).toBeLessThanOrEqual(5);
    }
  });

  it("keeps every detail at or under 20 words", () => {
    for (const entry of work) {
      for (const d of entry.details) {
        expect(
          wordCount(d.lead, d.text),
          `${entry.company}: ${d.lead}`,
        ).toBeLessThanOrEqual(20);
      }
    }
  });

  it("gives every detail a lead anchor and an em-dash-prefixed body", () => {
    for (const entry of work) {
      for (const d of entry.details) {
        expect(d.lead.length, entry.company).toBeGreaterThan(0);
        expect(d.lead.endsWith("."), d.lead).toBe(false);
        expect(d.text.startsWith("— "), d.text).toBe(true);
      }
    }
  });

  it("names or explains every employer - no bare anonymity", () => {
    for (const entry of work) {
      expect(entry.company, "anonymous employer").not.toMatch(/unnamed/i);
    }
  });
});

describe("claims the audits found unverifiable or false", () => {
  const banned: [RegExp, string][] = [
    [/zero-dependency/i, "@chainvibe/components depends on abitype@1.2.3"],
    [/60\s*fps/i, "not guaranteeable across client devices"],
    [/billions in combined TVL/i, "borrowed scale, nothing owned"],
    [/core contributor/i, "fails the swap test - any name pastes over it"],
    [/\$300M/i, "someone else's goal, not an outcome"],
    [/Advisory backed by shipped code/i, "assertion without evidence"],
    [
      /Where the habits came from/i,
      "cover-letter register, duplicates the summary",
    ],
  ];

  const corpus = JSON.stringify({ identity, showcases, work });

  for (const [pattern, why] of banned) {
    it(`does not contain ${pattern.source} (${why})`, () => {
      expect(corpus).not.toMatch(pattern);
    });
  }
});

describe("recruiter call to action", () => {
  it("exposes a downloadable CV", () => {
    expect(identity.cvUrl).toBe("/marcin_ciarka_cv.pdf");
  });
});

describe("showcases", () => {
  it("leads with the aurora entry", () => {
    expect(showcases[0].id).toBe("aurora");
  });

  it("gives every card a recording or a still - no empty media frame", () => {
    for (const s of showcases) {
      expect(!!s.recording || !!s.image, s.id).toBe(true);
    }
  });

  // liveUrl is now optional on the type to make room for the aurora's
  // in-page modal; every other showcase still needs somewhere to link out to.
  it("keeps a liveUrl on every non-aurora showcase", () => {
    for (const s of showcases) {
      if (s.kind !== "aurora") {
        expect(s.liveUrl, s.id).toBeTruthy();
      }
    }
  });
});
