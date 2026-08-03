import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { injectStatsMeta } from "./src/lib/injectStats.ts";

// Reads the same public/stats.json the client fetches at runtime, so the
// scheduled stats workflow updates the meta description for free.
function injectStats(): Plugin {
  return {
    name: "inject-stats-meta",
    transformIndexHtml(html) {
      const stats = JSON.parse(readFileSync("./public/stats.json", "utf8"));
      return injectStatsMeta(html, stats);
    },
  };
}

// ciarka.pl is served from the domain root (GitHub Pages + CNAME)
export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss(), injectStats()],
});
