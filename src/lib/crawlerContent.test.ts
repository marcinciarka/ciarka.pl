import { describe, expect, it } from "vitest";
// The real template, not a fixture - these tests exist to catch an edit to
// index.html that drops the placeholders.
import INDEX_HTML from "../../index.html?raw";
import { contactLinks, identity, showcases, work } from "../content";
import {
  AI_USER_AGENTS,
  injectCrawlerContent,
  renderLlmsTxt,
  renderPersonJsonLd,
  renderRobotsTxt,
  renderSitemapXml,
  renderStaticFallback,
  type CrawlerContent,
} from "./crawlerContent";

const CONTENT: CrawlerContent = {
  identity,
  work,
  showcases,
  contactLinks,
  stats: { commits: 5332, pullRequests: 1188 },
};

describe("index.html wiring", () => {
  // The whole point of the exercise: if these tokens ever vanish from the
  // template, the site is back to shipping an empty <div id="root"> and
  // nothing else would notice.
  it("carries both crawler-content placeholders", () => {
    expect(INDEX_HTML).toContain("__STATIC_CONTENT__");
    expect(INDEX_HTML).toContain("__PERSON_JSONLD__");
  });

  it("puts the fallback inside the React root, not beside it", () => {
    expect(INDEX_HTML).toContain('<div id="root">__STATIC_CONTENT__</div>');
  });

  it("substitutes both tokens against the real template", () => {
    const out = injectCrawlerContent(INDEX_HTML, CONTENT);
    expect(out).not.toContain("__STATIC_CONTENT__");
    expect(out).not.toContain("__PERSON_JSONLD__");
    expect(out).toContain(identity.name);
  });

  it("throws when the static-content token is missing", () => {
    expect(() =>
      injectCrawlerContent(`<x>__PERSON_JSONLD__</x>`, CONTENT),
    ).toThrow(/__STATIC_CONTENT__/);
  });

  it("throws when the JSON-LD token is missing", () => {
    expect(() =>
      injectCrawlerContent(`<x>__STATIC_CONTENT__</x>`, CONTENT),
    ).toThrow(/__PERSON_JSONLD__/);
  });
});

describe("renderStaticFallback", () => {
  const html = renderStaticFallback(CONTENT);

  it("leads with the name in an h1 and states the role", () => {
    expect(html).toContain(`<h1>${identity.name}</h1>`);
    expect(html).toContain(identity.role);
  });

  it("includes every employer and every project", () => {
    for (const entry of work) expect(html, entry.company).toContain(
      entry.company,
    );
    for (const s of showcases) expect(html, s.id).toContain(s.name);
  });

  // The first cut hand-listed four routes and silently dropped Telegram and
  // Discord - the two the page itself leads with. Iterate the real list.
  it("carries every contact route, not a hand-picked subset", () => {
    for (const link of contactLinks) {
      expect(html, link.label).toContain(link.label);
      expect(html, link.label).toContain(link.value);
      if (link.href) expect(html, link.label).toContain(link.href);
    }
  });

  it("renders a route with no URL as text rather than a dead link", () => {
    const discord = contactLinks.find((l) => l.icon === "discord")!;
    expect(discord.href).toBeUndefined();
    expect(html).toContain(
      `<span>${discord.label}: ${discord.value}</span>`,
    );
  });

  it("bakes in the live stat numbers", () => {
    expect(html).toContain("5,332 commits");
    expect(html).toContain("1,188 pull requests");
  });

  it("escapes markup in copy so content can never break the document", () => {
    const html = renderStaticFallback({
      ...CONTENT,
      identity: { ...identity, name: `<script>alert("x")&</script>` },
    });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&amp;");
  });
});

describe("renderPersonJsonLd", () => {
  const parsed = JSON.parse(renderPersonJsonLd(CONTENT));

  it("is a schema.org Person with the fields search actually reads", () => {
    expect(parsed["@type"]).toBe("Person");
    expect(parsed.name).toBe(identity.name);
    expect(parsed.jobTitle).toBe(identity.role);
    expect(parsed.email).toBe(`mailto:${identity.email}`);
  });

  // sameAs is the disambiguation mechanism - it is what separates this Marcin
  // Ciarka from anyone else with the name. Every profile counts.
  it("links every public profile via sameAs", () => {
    expect(parsed.sameAs).toContain(identity.github);
    expect(parsed.sameAs).toContain(identity.linkedin);
    expect(parsed.sameAs).toContain(identity.npmProfile);
  });

  it("derives a deduplicated knowsAbout from the real stack", () => {
    expect(parsed.knowsAbout).toContain("Solidity");
    expect(parsed.knowsAbout).toContain("TypeScript");
    expect(new Set(parsed.knowsAbout).size).toBe(parsed.knowsAbout.length);
  });

  it("drops sameAs entries that are absent rather than emitting null", () => {
    const bare = JSON.parse(
      renderPersonJsonLd({
        ...CONTENT,
        identity: { ...identity, linkedin: undefined, npmProfile: undefined },
      }),
    );
    expect(bare.sameAs).toEqual([identity.github]);
  });
});

describe("renderLlmsTxt", () => {
  const txt = renderLlmsTxt(CONTENT);

  it("opens with the H1 and blockquote summary the convention expects", () => {
    const [first, , third] = txt.split("\n");
    expect(first).toBe(`# ${identity.name}`);
    expect(third.startsWith("> ")).toBe(true);
  });

  it("covers every employer and every project", () => {
    for (const entry of work) expect(txt, entry.company).toContain(
      entry.company,
    );
    for (const s of showcases) expect(txt, s.id).toContain(s.name);
  });

  it("ends with every contact route", () => {
    expect(txt).toContain("## Contact");
    for (const link of contactLinks) {
      expect(txt, link.label).toContain(`- ${link.label}: ${link.value}`);
    }
  });

  it("absolutises the relative CV path - a bare path is unusable off-site", () => {
    expect(txt).toContain(`https://ciarka.pl${identity.cvUrl}`);
  });

  it("omits a redundant URL for mailto and for URL-less handles", () => {
    expect(txt).toContain(`- Email: ${identity.email}\n`);
    expect(txt).toContain(`- Discord: ${identity.discordHandle}\n`);
  });
});

describe("renderRobotsTxt", () => {
  const txt = renderRobotsTxt();

  it("allows everything and points at the sitemap", () => {
    expect(txt).toContain("User-agent: *\nAllow: /");
    expect(txt).toContain("Sitemap: https://ciarka.pl/sitemap.xml");
  });

  it("names every AI crawler explicitly, since silence gets read as doubt", () => {
    for (const ua of AI_USER_AGENTS) {
      expect(txt, ua).toContain(`User-agent: ${ua}\nAllow: /`);
    }
  });

  it("disallows nothing", () => {
    expect(txt).not.toMatch(/Disallow: \S/);
  });
});

describe("renderSitemapXml", () => {
  it("uses the stats timestamp's date as lastmod", () => {
    expect(renderSitemapXml("2026-08-03T13:07:30.102Z")).toContain(
      "<lastmod>2026-08-03</lastmod>",
    );
  });

  it("is byte-stable for the same timestamp, so a no-op rebuild is a no-op", () => {
    const at = "2026-08-03T13:07:30.102Z";
    expect(renderSitemapXml(at)).toBe(renderSitemapXml(at));
  });

  it("throws rather than emitting a malformed lastmod", () => {
    expect(() => renderSitemapXml("whenever")).toThrow(/ISO timestamp/);
  });
});
