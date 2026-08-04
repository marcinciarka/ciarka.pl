import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { injectStatsMeta } from "./src/lib/injectStats.ts";
import {
  injectCrawlerContent,
  renderLlmsTxt,
  renderRobotsTxt,
  renderSitemapXml,
  type CrawlerContent,
} from "./src/lib/crawlerContent.ts";
import { contactLinks, identity, showcases, work } from "./src/content.ts";

// Reads the same public/stats.json the client fetches at runtime, so the
// scheduled stats workflow updates the meta description for free.
function injectStats(): Plugin {
  return {
    name: "inject-stats-meta",
    transformIndexHtml(html, ctx) {
      // Scoped to the real page. Vite runs this hook for EVERY .html it
      // serves, and injectStatsMeta throws when the placeholders are absent -
      // deliberately, so index.html can never ship a meta description with
      // un-substituted tokens. Build-time tool pages like
      // scripts/aurora-still.html have no meta description to keep in sync,
      // and must not have to carry dummy tokens just to be servable.
      if (!/(^|\/)index\.html$/.test(ctx.path)) return html;
      return injectStatsMeta(html, readStats());
    },
  };
}

function readStats() {
  return JSON.parse(readFileSync("./public/stats.json", "utf8"));
}

function crawlerContent(): CrawlerContent {
  const stats = readStats();
  return {
    identity,
    work,
    showcases,
    contactLinks,
    stats: { commits: stats.commits, pullRequests: stats.pullRequests },
  };
}

// The app renders entirely on the client, so the shipped HTML would otherwise
// be an empty <div id="root"> - invisible to every fetcher that does not
// execute JavaScript. This plugin fills that div with content derived from
// src/content.ts and emits the three crawler-facing text files.
//
// The files are emitted rather than committed to public/ for the same reason
// the meta description carries placeholders: they are derived from content.ts,
// and a checked-in copy is a second place to forget to update.
function crawlerFiles(): Plugin {
  const FILES = [
    { fileName: "robots.txt", render: () => renderRobotsTxt() },
    { fileName: "llms.txt", render: () => renderLlmsTxt(crawlerContent()) },
    {
      fileName: "sitemap.xml",
      render: () => renderSitemapXml(readStats().updatedAt),
    },
  ];

  return {
    name: "crawler-files",

    // Same three URLs in `vite dev`, so what gets reviewed locally is what
    // ships. public/ files are served by Vite's static middleware; these are
    // not on disk, so they need a handler of their own.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const match = FILES.find((f) => req.url === `/${f.fileName}`);
        if (!match) return next();
        res.setHeader(
          "Content-Type",
          match.fileName.endsWith(".xml")
            ? "application/xml"
            : "text/plain; charset=utf-8",
        );
        res.end(match.render());
      });
    },

    generateBundle() {
      for (const { fileName, render } of FILES) {
        this.emitFile({ type: "asset", fileName, source: render() });
      }
    },

    // See the scoping note on injectStats: this hook fires for every .html
    // Vite serves, and injectCrawlerContent throws on a missing token by
    // design, so build-time tool pages must not go through it.
    transformIndexHtml(html, ctx) {
      if (!/(^|\/)index\.html$/.test(ctx.path)) return html;
      return injectCrawlerContent(html, crawlerContent());
    },
  };
}

// LCP is the hero body copy (Instrument Sans). Clash Display is already
// preloaded from public/; this injects a matching preload for the hashed
// @fontsource 400 face once Vite knows its output path.
function preloadBodyFont(): Plugin {
  return {
    name: "preload-body-font",
    transformIndexHtml: {
      // `bundle` (hashed asset names) is only populated for post-order
      // transforms during build — see Vite's transformIndexHtml docs.
      order: "post",
      handler(html, ctx) {
        if (!/(^|\/)index\.html$/.test(ctx.path)) return html;
        if (!ctx.bundle) return html;
        const font = Object.values(ctx.bundle).find(
          (item) =>
            item.type === "asset" &&
            typeof item.fileName === "string" &&
            item.fileName.includes("instrument-sans-latin-400") &&
            item.fileName.endsWith(".woff2"),
        );
        if (!font || font.type !== "asset") return html;
        const tag = `<link rel="preload" as="font" type="font/woff2" crossorigin href="/${font.fileName}" />`;
        if (html.includes(tag)) return html;
        return html.replace(
          '<link rel="preload" as="font" type="font/woff2" crossorigin href="/fonts/clash-display-600.woff2" />',
          `<link rel="preload" as="font" type="font/woff2" crossorigin href="/fonts/clash-display-600.woff2" />\n  ${tag}`,
        );
      },
    },
  };
}

// ciarka.pl is served from the domain root (GitHub Pages + CNAME)
export default defineConfig({
  base: "/",
  plugins: [
    react(),
    tailwindcss(),
    injectStats(),
    crawlerFiles(),
    preloadBodyFont(),
  ],
});
