// All site copy and data in one place. Numbers are commit-verified -
// extracted from GitHub history (2016–2026), see /output research docs.

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
  cvUrl?: string;
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
    "Ten years shipping for the web, four of them building production DeFi at Summer.fi - I shipped the multi-protocol frontend for Maker, Aave, Spark, Morpho and Ajna, and the risk automation that guards positions on it.",
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
  cvUrl: "/marcin_ciarka_cv.pdf",
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
  liveUrl: string;
  repoUrl?: string;
  npm?: { pkg: string; url: string };
  status: "live" | "source-only" | "in-progress";
  recording?: string;
};

export const showcases: Showcase[] = [
  {
    id: "chainvibe",
    name: "ChainVibe",
    tagline: "Sub-second on-chain event streaming",
    description:
      "A full-stack real-time streaming monorepo: custom WebSocket server broadcasting sub-second price and transaction feeds, plus a published one-dependency React ticker component.",
    highlights: [
      "Solves RPC rate-limiting with one server-side stream fan-out",
      "Published npm package: @chainvibe/components",
      "useChainVibeStream hook, CSS-module theming",
      "Bundle-size budget enforced: under 6 kB gzipped",
    ],
    tech: ["React", "TypeScript", "Bun", "WebSockets", "npm library"],
    liveUrl: "https://chainvi.be/",
    // repo is private - add repoUrl when/if it goes public
    npm: {
      pkg: "@chainvibe/components",
      url: "https://www.npmjs.com/package/@chainvibe/components",
    },
    status: "live",
    recording: "/recordings/chainvibe_web.mp4",
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

export type WorkEntry = {
  period: string;
  company: string;
  role: string;
  summary: string;
  details: WorkDetail[];
};

export const work: WorkEntry[] = [
  {
    period: "2026 — present",
    company: "Stealth DeFi platform (NDA)",
    role: "Technical Advisor",
    summary:
      "An all-in-one, 100% self-custodial DeFi app - earn, borrow, multiply, loop yields and trade perps, with every position held in the user's own Safe smart account. I scaffolded the monorepo and the indexer it runs on, then wired six lending protocols behind one set of product views. Under NDA, so it stays unnamed here - happy to walk through the architecture live.",
    details: [
      {
        lead: "Cost-basis and PnL engine",
        text: "— entry price read at the event block, with Chainlink and historical-API fallbacks when a feed dies.",
      },
      {
        lead: "Six protocols, one view",
        text: "— Morpho Blue, Euler v2, Fluid, Compound v3, Sky and Maple behind one set of product views.",
      },
      {
        lead: "Ponder indexer",
        text: "— chain-scoped position IDs; on-chain calls run parallel to indexer queries for sub-second loads.",
      },
      {
        lead: "Risk controls",
        text: "— Stop-Loss, Trailing Stop and Take-Profit sliders with directional loss-acceptance settings.",
      },
      {
        lead: "Product Finder tables",
        text: "— risk-curator filters, live liquidity, correlated-collateral exclusions.",
      },
    ],
  },
  {
    period: "2024 — 2026",
    company: "Lazy Summer Protocol · Summer.fi",
    role: "Senior Full-Stack Engineer",
    summary:
      "The next-generation Earn protocol app, taken from an empty repository to production. I led the frontend architecture, moved wallet connectivity off legacy Web3Onboard onto Viem and Wagmi v2, and built the telemetry that shows a depositor what their position is actually doing.",
    details: [
      {
        lead: "Empty repo to production",
        text: "— owned the frontend architecture as Lazy Summer approached $200M TVL.",
      },
      {
        lead: "Vault simulation engine",
        text: "— standardised position metrics on real-time net value rather than gross earnings.",
      },
      {
        lead: "Yield telemetry",
        text: "— 1-hour granularity, up from 3-hour, with graceful empty states for vaults short on history.",
      },
      {
        lead: "Institutional RWA dashboard",
        text: "— two-layer auth: AWS Cognito for web2 roles, wallet connection for the web3 role.",
      },
      {
        lead: "Monorepo foundations",
        text: "— authored the Turborepo proof-of-concept behind the summerfi-monorepo move, then SST serverless deploys.",
      },
    ],
  },
  {
    period: "2023 — 2025",
    company: "Summer.fi Pro",
    role: "Senior Full-Stack Engineer",
    summary:
      "The 2023 rebrand and the consolidation that followed. I took the multi-protocol Borrow / Multiply / Earn suite onto Layer 2, brought Morpho Blue's isolated markets in, and built the risk-automation layer that lets several triggers guard one position without colliding - while the codebase itself was moving into a monorepo underneath us.",
    details: [
      {
        lead: "Trigger cross-validation",
        text: "— concurrent Stop-Loss, Auto-Buy and Auto-Sell can never collide or commit an impossible LTV.",
      },
      {
        lead: "Reactive state machines",
        text: "— proxy creation and token approvals, making 1-click leverage non-blocking.",
      },
      {
        lead: "Protocol integrations",
        text: "— Maker, Aave v2/v3, Spark, Morpho Blue and Ajna, including Layer 2 networks.",
      },
      {
        lead: "Shared libraries and config engine",
        text: "— including trimming redundant on-chain calls out of Aave v3 reserve reads.",
      },
      {
        lead: "Wallet infrastructure",
        text: "— WalletConnect v2 via Web3Onboard, EIP-1559 transactions, Gnosis Safe iframe fixes.",
      },
    ],
  },
  {
    period: "2022 — 2023",
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
