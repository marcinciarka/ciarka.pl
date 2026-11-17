// Shared entry for the static case studies (aurora/index.html,
// jaksietumieszka/index.html). Their content is plain HTML so crawlers read
// it without running anything; this module only brings in the site's fonts
// and tokens plus the shared case-study styles.
import "@fontsource/instrument-sans/latin-400.css";
import "@fontsource/instrument-sans/latin-500.css";
// Polish names (Jak się tu mieszka?, Śródmieście). unicode-range scoped, so
// the files only download on a page that uses those glyphs.
import "@fontsource/instrument-sans/latin-ext-400.css";
import "@fontsource/instrument-sans/latin-ext-500.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "../index.css";
import "./caseStudy.css";
