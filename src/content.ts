// All site copy and data in one place. Numbers are commit-verified -
// extracted from GitHub history.

// Single source of truth for baked stats: the same JSON the scheduled
// workflow updates and the client fetches live at runtime.
import baked from "../public/stats.json";

export type Identity = {
  greeting: string;
  name: string;
  role: string;
  pitch: string;
  location: string;
  availability: string;
  contactNote: string;
  email: string;
  github: string;
  githubHandle: string;
  telegramHandle: string;
  discordHandle: string;
  linkedin?: string;
  // Not rendered as a contact route - it exists for the JSON-LD `sameAs`, which
  // is how an entity-resolution system learns that these profiles are one
  // person. Verified against the @chainvibe/components maintainer record.
  npmProfile?: string;
  cvUrl?: string;
  siteRepo: string;
};

// Ordered as rendered in the contact section. `icon` keys map to the inline
// SVGs in Contact.tsx; Discord has no public per-username profile URL, so it
// carries a handle to copy instead of an href.
// `accent` marks the two links that carry the most weight for a reader who came
// here to hire: the code and the CV. Contact.tsx renders them as a second,
// highlighted row rather than letting them blend into the handles above.
export type ContactLink = {
  icon: "telegram" | "discord" | "linkedin" | "email" | "github" | "cv";
  label: string;
  value: string;
  href?: string;
  copy?: string;
  accent?: boolean;
};

export const identity: Identity = {
  greeting: "hey, I’m",
  name: "Marcin Ciarka",
  role: "Senior Web3 Full-Stack Engineer",
  pitch:
    "Ten years building for the web, four of them shipping production DeFi: frontends, backend data pipelines, and the risk automation that keeps positions safe.",
  location: "Poland · remote (CET)",
  availability:
    "Open to senior roles - Web3 frontend, full-stack, product engineering",
  contactNote:
    "Any of these reach me directly. Email is best if you're sending something with an attachment.",
  email: "cv@plamka.net",
  github: "https://github.com/marcinciarka",
  githubHandle: "marcinciarka",
  telegramHandle: "marcinciarka",
  discordHandle: "marcinciarka",
  linkedin: "https://www.linkedin.com/in/marcin-ciarka-942405147/",
  npmProfile: "https://www.npmjs.com/~marcinciarka",
  cvUrl: "/marcin_ciarka_cv.pdf",
  siteRepo: "https://github.com/marcinciarka/ciarka.pl",
};

export const contactLinks: ContactLink[] = [
  {
    icon: "telegram",
    label: "Telegram",
    value: `@${identity.telegramHandle}`,
    href: `https://t.me/${identity.telegramHandle}`,
  },
  {
    icon: "discord",
    label: "Discord",
    value: identity.discordHandle,
    copy: identity.discordHandle,
  },
  {
    icon: "linkedin",
    label: "LinkedIn",
    value: "marcin-ciarka",
    href: identity.linkedin,
  },
  {
    icon: "email",
    label: "Email",
    value: identity.email,
    href: `mailto:${identity.email}`,
  },
  {
    icon: "github",
    label: "GitHub",
    value: identity.githubHandle,
    href: identity.github,
    accent: true,
  },
  {
    icon: "cv",
    label: "Download CV",
    value: "marcin_ciarka_cv.pdf",
    href: identity.cvUrl,
    accent: true,
  },
];

export const contactCopied = "copied";

// Baked fallback for the live stats.json (updated by scheduled workflow).
// Derived from the same public/stats.json the client fetches at runtime -
// no hand-maintained duplicate numbers.
export const bakedStats = baked;

export type Showcase = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  highlights: string[];
  tech: string[];
  // Optional because the aurora's demo lives on this same page (a modal) -
  // there is nowhere else to link out to.
  liveUrl?: string;
  repoUrl?: string;
  npm?: { pkg: string; url: string };
  status: "live" | "source-only" | "in-progress";
  recording?: string;
  // Required alongside `recording`, not optional in practice (content.test.ts
  // enforces the pair): the card shows this frame and only fetches the video
  // once the reader opens the player. Without it Safari renders an empty card,
  // because WebKit decodes no frame at preload="metadata". Regenerate with
  // `npm run posters`.
  poster?: string;
  // A still, not a video: the NFT is one frame, and the hero already
  // animates the same shader - a recording here would just repeat it.
  image?: string;
  // Discriminates the entry whose call-to-action opens an in-page modal
  // instead of following liveUrl out to another site.
  kind?: "aurora";
};

export const showcases: Showcase[] = [
  {
    id: "aurora",
    kind: "aurora",
    name: "Aurora, on-chain",
    tagline: "A generative sky that lives in contract storage",
    description:
      "The shader behind this page's hero, minted as an ERC-721 on Base. Every visitor gets a different sky from a seeded noise field, and the one you're looking at can be captured and written into the contract as bytes - the image is in storage, not on IPFS behind a metadata server.",
    highlights: [
      "Every visitor gets a different seeded sky",
      "Snapshot written on-chain as WebP under 16 kB - no IPFS",
      "One sky per seed, one mint per wallet, enforced in the contract",
      "Live gas estimate priced off the Chainlink ETH/USD feed",
    ],
    tech: ["Solidity", "Foundry", "WebGL / GLSL", "viem", "Base"],
    image: "/aurora-still.webp",
    status: "live",
  },
  {
    id: "chainvibe",
    name: "ChainVibe",
    tagline: "Multi-tenant on-chain event streaming",
    description:
      "A multi-tenant streaming server and the React package that consumes it. The Bun server watches on-chain events for each customer's config and fans them out over WebSocket and REST, so clients never hit RPC rate limits themselves.",
    highlights: [
      "Per-customer configs, master-key auth and an admin panel",
      "RPC failover and tx-hash dedupe on ingest",
      "Per-minute metrics persisted to Postgres with Kysely migrations",
      "Published npm package: @chainvibe/components",
    ],
    tech: ["Bun", "viem", "WebSockets", "PostgreSQL", "React", "npm library"],
    liveUrl: "https://chainvi.be/",
    // repo is private - add repoUrl when/if it goes public
    npm: {
      pkg: "@chainvibe/components",
      url: "https://www.npmjs.com/package/@chainvibe/components",
    },
    status: "live",
    recording: "/recordings/chainvibe_web.mp4",
    poster: "/recordings/chainvibe_poster.webp",
  },
  {
    id: "summer-resonance",
    name: "Summer Resonance",
    tagline: "Live DeFi telemetry you can hear",
    description:
      "A real-time dashboard streaming deposit and withdraw events and TVL movement from the Lazy Summer Protocol - then mapping that telemetry to a generative Web Audio soundscape.",
    highlights: [
      "WebSocket event stream with keep-alive + broadcast (Bun server)",
      "TVL easing with BigNumber.js precision math",
      "GPU-accelerated WebGL animation",
      "Web Audio API synthesis driven by on-chain events",
    ],
    tech: ["Next.js", "TypeScript", "WebSockets", "Web Audio API", "WebGL"],
    liveUrl: "https://resonance.summer.fi/",
    // repo is private - add repoUrl when/if it goes public
    status: "live",
    recording: "/recordings/resonance_web.mp4",
    poster: "/recordings/resonance_poster.webp",
  },
];

// Answers the hero stat counters: the reader just saw the commit total, this
// section itemises where it went. Deliberately not "N years of shipping" -
// that exact phrasing is all over other engineers' portfolios.
export const workHeading = "Where the commits went";

export type WorkDetail = {
  // Rendered bold as a scannable anchor: the name of the system, not a verb
  // phrase. `text` carries its own leading em dash so the two read as one line.
  lead: string;
  text: string;
};

// Public places a reader can check the claims in an entry. Source only:
// Summer.fi wound down in 2026, so its product URLs show a shutdown notice.
export type WorkLink = { label: string; href: string };

export type WorkEntry = {
  period: string;
  company: string;
  role: string;
  summary: string;
  details: WorkDetail[];
  links?: WorkLink[];
};

export const work: WorkEntry[] = [
  {
    period: "2026 - present",
    company: "Stealth DeFi platform (NDA)",
    role: "Technical Advisor (contract)",
    summary:
      "An all-in-one, self-custodial DeFi app: earn, borrow, multiply, loop yields and trade perps, with every position held in the user's own Safe smart account. I started the codebase and am its largest contributor (about 45% of commits), across the product, the SDK and the backend. Under NDA, so it stays unnamed here. Happy to walk through the architecture live.",
    details: [
      {
        lead: "Position flows on Safe",
        text: "— earn, borrow, multiply, refinance across Aave, Morpho, Euler, Fluid, Compound, Sky, Maple; SDK flash-loan fallback.",
      },
      {
        lead: "Shield position protection",
        text: "— Stop-Loss, Trailing Stop and Take-Profit guardians with emergency-close transactions.",
      },
      {
        lead: "Cost-basis and PnL engine",
        text: "— entry price read at the event block, with Chainlink and historical-API fallbacks when a feed dies.",
      },
      {
        lead: "Market-data backend",
        text: "— pipeline for ~15 lending protocols into Postgres with staleness and outlier gates, plus hourly Aave liquidation-risk snapshots.",
      },
      {
        lead: "Yield loops",
        text: "— a product line end to end: net-APY math, ledger-fed return tiles, yield-history API.",
      },
    ],
  },
  {
    period: "2024 - 2026",
    company: "Lazy Summer Protocol · Summer.fi",
    role: "Senior Full-Stack Engineer",
    summary:
      "The Lazy Summer Earn app, built from an empty repository to production alongside Summer.fi Pro by the same team. I co-built it in 2024 as TVL approached $200M and was its main contributor from 2025. I also built the institutional side: a vault admin dashboard and the auth system behind it.",
    links: [
      {
        label: "public monorepo",
        href: "https://github.com/OasisDEX/summerfi-monorepo",
      },
    ],
    details: [
      {
        lead: "Institutions auth",
        text: "— AWS Cognito sessions, RBAC with admin management, TOTP MFA, Kysely/Postgres schema and migrations. Sole author.",
      },
      {
        lead: "Institutional vault admin dashboard",
        text: "— on-chain role admin, caps and fees, TVL/AUM/NAV charts, Safe admin transaction queue.",
      },
      {
        lead: "Earn app",
        text: "— vault views, deposit and withdraw, forecast charts, portfolio with rewards, server caching.",
      },
    ],
  },
  {
    period: "2023 - 2025",
    company: "Summer.fi Pro",
    role: "Senior Full-Stack Engineer",
    summary:
      "The 2023 rebrand of Oasis.app to Summer.fi and the consolidation that followed. I took the multi-protocol Borrow / Multiply / Earn suite onto Layer 2, brought Morpho Blue's isolated markets in, and built the risk-automation layer that lets several triggers guard one position without colliding. I also cleaned up the codebase underneath it and rewrote the runtime configuration the frontends read.",
    details: [
      {
        lead: "Trigger cross-validation",
        text: "— concurrent Stop-Loss, Auto-Buy and Auto-Sell can never collide or commit an impossible LTV.",
      },
      {
        lead: "Runtime configuration",
        text: "— rewritten as a typed TypeScript/Bun generator published to S3; used for production maintenance mode during incidents.",
      },
      {
        lead: "Architecture cleanup",
        text: "— removed circular dependencies across 1,497 files, split the app context, added bundle-analysis CI.",
      },
      {
        lead: "Wallet infrastructure",
        text: "— WalletConnect v2 via Web3Onboard, EIP-1559 transactions, Gnosis Safe iframe fixes.",
      },
    ],
  },
  {
    period: "2022 - 2023",
    company: "Oasis.app",
    role: "DeFi Frontend Engineer",
    summary:
      "A Maker-native vault product growing into a multi-protocol one. I brought Aave in, shipped the first frontend integration for Spark Lend, built the automation that lets a position defend itself against liquidation, and kept the data layer quick enough to survive traffic spikes.",
    details: [
      {
        lead: "Stop-Loss margin",
        text: "— triggers held 2.5% clear of each protocol's liquidation threshold.",
      },
      {
        lead: "Spark Lend",
        text: "— shipped the first frontend integration.",
      },
      {
        lead: "Aave stETH/ETH yield",
        text: "— 7-day annualised yield engines, with queries initialised once in shared app context.",
      },
      {
        lead: "Cached multi-network portfolio data",
        text: "— rides out traffic spikes that would otherwise hit RPC rate limits.",
      },
    ],
  },
  {
    period: "2016 - 2022",
    company: "Softax",
    role: "Full-Stack Engineer",
    summary:
      "Six years at a Polish software house building for enterprise clients - vehicle-leasing applications for a major automotive group, retail banking apps for two banks, and the internal tooling the staff behind them ran on. Regulated, integration-heavy work on systems measured in years, where a wrong number is a compliance problem rather than a bug.",
    details: [
      {
        lead: "Vehicle-leasing applications",
        text: "— the multi-step flows that turn an enquiry into a signed agreement.",
      },
      {
        lead: "Retail banking front-ends",
        text: "— plus the back-office tools the operating teams ran on.",
      },
      {
        lead: "Long-running engagements",
        text: "— features owned across years of maintenance rather than shipped and handed off.",
      },
    ],
  },
];
