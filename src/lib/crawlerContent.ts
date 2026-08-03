// Everything a client that does not run JavaScript can see.
//
// The app is a client-rendered SPA: without these renderers the raw HTML is an
// empty <div id="root">, so any plain-GET fetcher (LLM crawlers, link
// unfurlers, text-mode browsers) reads a page with no content on it. Each
// function below derives its output from src/content.ts, so the crawler-facing
// copy cannot drift from the copy the app renders - there is no second place
// to update.
//
// Wired in vite.config.ts: the fallback and JSON-LD are substituted into
// index.html, robots.txt / llms.txt / sitemap.xml are emitted as build assets.
import type {
  ContactLink,
  Identity,
  Showcase,
  WorkEntry,
} from "../content.ts";

export type CrawlerStats = { commits: number; pullRequests: number };

export type CrawlerContent = {
  identity: Identity;
  work: WorkEntry[];
  showcases: Showcase[];
  // The same ordered list Contact.tsx renders, so a route added there reaches
  // crawlers without a second edit here. Hand-listing them once already lost
  // Telegram and Discord from the fallback.
  contactLinks: ContactLink[];
  stats: CrawlerStats;
};

export const ORIGIN = "https://ciarka.pl";

// The AI crawlers worth naming explicitly. A bare "User-agent: *" already
// permits all of them, but several operators document honouring only their own
// token, and an explicit Allow removes any question of intent - silence is the
// thing that gets read conservatively.
export const AI_USER_AGENTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "cohere-ai",
  "Bytespider",
] as const;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function absolute(url: string): string {
  return url.startsWith("/") ? `${ORIGIN}${url}` : url;
}

// "since 2022" must track SINCE_YEAR in scripts/update-stats.mjs, which
// bounds the commit/PR counts this line describes. The two files cannot share
// a constant — one is TS bundled into the app, the other a standalone .mjs
// script run by CI — so this is a comment-enforced link, not a type-checked
// one.
function statLine(stats: CrawlerStats): string {
  return `${stats.commits.toLocaleString("en-US")} commits and ${stats.pullRequests.toLocaleString("en-US")} pull requests since 2022.`;
}

// Deduplicated in first-appearance order: the showcase stack doubles as the
// skill list, and repeats read as padding to anything summarising the page.
function knowsAbout({ showcases, work }: CrawlerContent): string[] {
  const seen = new Set<string>();
  for (const s of showcases) {
    for (const t of s.tech) seen.add(t);
  }
  for (const entry of work) seen.add(entry.role);
  return [...seen];
}

/**
 * schema.org Person, expanded well past name/url - this is the one part of the
 * page that LLM-backed search reliably parses rather than guesses at.
 */
export function renderPersonJsonLd(content: CrawlerContent): string {
  const { identity, stats } = content;
  // `sameAs` is disambiguation infrastructure, not decoration: it is what tells
  // an entity-resolution system that this Marcin Ciarka is one specific person
  // with these accounts, distinct from anyone else carrying the name. Every
  // profile that provably belongs to him goes here.
  const sameAs = [identity.github, identity.linkedin, identity.npmProfile]
    .filter((v): v is string => !!v);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: identity.name,
    jobTitle: identity.role,
    url: ORIGIN,
    email: `mailto:${identity.email}`,
    description: `${identity.pitch} ${statLine(stats)}`,
    knowsAbout: knowsAbout(content),
    sameAs,
    address: {
      "@type": "PostalAddress",
      addressCountry: "PL",
    },
    seeks: {
      "@type": "Demand",
      description: identity.availability,
    },
  };
  return JSON.stringify(jsonLd, null, 2);
}

/**
 * The markup that sits inside <div id="root"> until React replaces it. Real,
 * visible content rather than a hidden block - anything cloaked is both a
 * ranking risk and routinely stripped by HTML-to-text pipelines, which is
 * exactly the audience this exists for.
 */
export function renderStaticFallback(content: CrawlerContent): string {
  const { identity, work, showcases, contactLinks, stats } = content;
  // Discord has no public per-username profile URL, so it carries a handle to
  // copy rather than an href - it renders as plain text, not a dead link.
  const links = contactLinks.map((link) => {
    const label = `${escapeHtml(link.label)}: ${escapeHtml(link.value)}`;
    return link.href
      ? `<a href="${escapeHtml(link.href)}">${label}</a>`
      : `<span>${label}</span>`;
  });

  return [
    `<div id="static-fallback">`,
    `<h1>${escapeHtml(identity.name)}</h1>`,
    `<p><strong>${escapeHtml(identity.role)}</strong> · ${escapeHtml(identity.location)}</p>`,
    `<p>${escapeHtml(identity.pitch)}</p>`,
    `<p>${escapeHtml(statLine(stats))}</p>`,
    `<p>${escapeHtml(identity.availability)}</p>`,
    `<h2>Work</h2>`,
    ...work.map((entry) =>
      [
        `<section>`,
        `<h3>${escapeHtml(entry.role)} · ${escapeHtml(entry.company)} <small>(${escapeHtml(entry.period)})</small></h3>`,
        `<p>${escapeHtml(entry.summary)}</p>`,
        `<ul>`,
        ...entry.details.map(
          (d) =>
            `<li><strong>${escapeHtml(d.lead)}</strong> ${escapeHtml(d.text)}</li>`,
        ),
        `</ul>`,
        `</section>`,
      ].join(""),
    ),
    `<h2>Projects</h2>`,
    ...showcases.map((s) =>
      [
        `<section>`,
        `<h3>${escapeHtml(s.name)} — ${escapeHtml(s.tagline)}</h3>`,
        `<p>${escapeHtml(s.description)}</p>`,
        `<ul>`,
        ...s.highlights.map((h) => `<li>${escapeHtml(h)}</li>`),
        `</ul>`,
        `<p>Stack: ${escapeHtml(s.tech.join(", "))}</p>`,
        s.liveUrl
          ? `<p><a href="${escapeHtml(s.liveUrl)}">${escapeHtml(s.liveUrl)}</a></p>`
          : "",
        `</section>`,
      ]
        .filter(Boolean)
        .join(""),
    ),
    `<h2>Contact</h2>`,
    `<p>${links.join(" · ")}</p>`,
    `</div>`,
  ].join("\n");
}

/**
 * /llms.txt per the Answer.AI convention: an H1, a blockquote summary, then
 * linked sections. The whole portfolio is one page, so this carries the copy
 * inline rather than pointing at per-page Markdown that does not exist.
 */
export function renderLlmsTxt(content: CrawlerContent): string {
  const { identity, work, showcases, stats } = content;
  const lines: string[] = [
    `# ${identity.name}`,
    "",
    `> ${identity.role}. ${identity.pitch}`,
    "",
    `- Location: ${identity.location}`,
    `- Availability: ${identity.availability}`,
    `- Track record: ${statLine(stats)}`,
    "",
    "## Work",
    "",
  ];

  for (const entry of work) {
    lines.push(`### ${entry.role} — ${entry.company} (${entry.period})`, "");
    lines.push(entry.summary, "");
    for (const d of entry.details) {
      lines.push(`- **${d.lead}** ${d.text}`);
    }
    lines.push("");
  }

  lines.push("## Projects", "");
  for (const s of showcases) {
    lines.push(`### ${s.name} — ${s.tagline}`, "");
    lines.push(s.description, "");
    for (const h of s.highlights) lines.push(`- ${h}`);
    lines.push("", `- Stack: ${s.tech.join(", ")}`, `- Status: ${s.status}`);
    if (s.liveUrl) lines.push(`- Live: ${s.liveUrl}`);
    if (s.npm) lines.push(`- npm: ${s.npm.pkg} (${s.npm.url})`);
    lines.push("");
  }

  lines.push("## Contact", "");
  for (const link of content.contactLinks) {
    // mailto: would just repeat `value`, and Discord has no URL at all - both
    // are complete without one.
    const url =
      link.href && !link.href.startsWith("mailto:")
        ? ` (${absolute(link.href)})`
        : "";
    lines.push(`- ${link.label}: ${link.value}${url}`);
  }
  lines.push("");

  return lines.join("\n");
}

export function renderRobotsTxt(): string {
  return [
    "User-agent: *",
    "Allow: /",
    "",
    ...AI_USER_AGENTS.flatMap((ua) => [`User-agent: ${ua}`, "Allow: /", ""]),
    `Sitemap: ${ORIGIN}/sitemap.xml`,
    "",
  ].join("\n");
}

/**
 * One URL, because there is one page. `lastmod` comes from the stats payload
 * the scheduled workflow rewrites rather than the clock, so a rebuild with no
 * content change produces a byte-identical file.
 */
export function renderSitemapXml(updatedAt: string): string {
  const day = updatedAt.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error(
      `renderSitemapXml: expected an ISO timestamp, got ${JSON.stringify(updatedAt)}`,
    );
  }
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    "  <url>",
    `    <loc>${ORIGIN}/</loc>`,
    `    <lastmod>${day}</lastmod>`,
    "  </url>",
    "</urlset>",
    "",
  ].join("\n");
}

const TOKENS = {
  __STATIC_CONTENT__: renderStaticFallback,
  __PERSON_JSONLD__: renderPersonJsonLd,
} as const;

/**
 * Substitutes the index.html placeholders. Throws on a missing token for the
 * same reason injectStatsMeta does: a future HTML edit must not be able to
 * quietly ship the empty-root page back into production.
 */
export function injectCrawlerContent(
  html: string,
  content: CrawlerContent,
): string {
  let out = html;
  for (const [token, render] of Object.entries(TOKENS)) {
    if (!out.includes(token)) {
      throw new Error(
        `injectCrawlerContent: ${token} not found in index.html - the page would ship with no crawler-readable content`,
      );
    }
    out = out.replace(token, render(content));
  }
  return out;
}
