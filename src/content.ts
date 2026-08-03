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
  linkedin?: string;
  cvUrl?: string;
};

export const identity: Identity = {
  greeting: "hey, I’m",
  name: "Marcin Ciarka",
  role: "Senior Web3 Full-Stack Engineer",
  pitch:
    "Ten years shipping for the web, four of them building production DeFi at Summer.fi - core contributor on the multi-protocol frontend for Maker, Aave, Spark, Morpho and Ajna, protocols holding billions in combined TVL.",
  location: "Poland · remote (CET)",
  availability: "Open to senior Web3 full-stack roles",
  contactNote:
    "No contact form, no scheduling link - email works, and I actually answer.",
  email: "cv@plamka.net",
  github: "https://github.com/marcinciarka",
  githubHandle: "marcinciarka",
  // TODO(marcin): add LinkedIn profile URL when ready
  linkedin: undefined,
  // TODO(marcin): add hosted CV/resume URL when ready
  cvUrl: undefined,
};

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
    id: "summer-resonance",
    name: "Summer Resonance",
    tagline: "Live DeFi telemetry you can hear",
    description:
      "A real-time dashboard streaming deposit and withdraw events and TVL movement from the Lazy Summer Protocol - then mapping that telemetry to a generative Web Audio soundscape.",
    highlights: [
      "WebSocket event stream with keep-alive + broadcast (Bun server)",
      "TVL easing with BigNumber.js precision math",
      "60fps WebGL animation",
      "Web Audio API synthesis driven by on-chain events",
    ],
    tech: ["Next.js", "TypeScript", "WebSockets", "Web Audio API", "WebGL"],
    liveUrl: "https://resonance.summer.fi/",
    // repo is private - add repoUrl when/if it goes public
    status: "live",
    recording: "/recordings/resonance_web.mp4",
  },
  {
    id: "chainvibe",
    name: "ChainVibe",
    tagline: "Sub-second on-chain event streaming",
    description:
      "A full-stack real-time streaming monorepo: custom WebSocket server broadcasting sub-second price and transaction feeds, plus a published zero-dependency React ticker component.",
    highlights: [
      "Solves RPC rate-limiting with one server-side stream fan-out",
      "Published npm package: @chainvibe/components",
      "useChainVibeStream hook, CSS-module theming",
      "Bundle-size budget enforced on the package",
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
];

// Answers the hero stat counters: the reader just saw the commit total, this
// section itemises where it went. Deliberately not "N years of shipping" -
// that exact phrasing is all over other engineers' portfolios.
export const workHeading = "Where the commits went";

export type WorkEntry = {
  period: string;
  company: string;
  role: string;
  summary: string;
  details: string[];
};

export const work: WorkEntry[] = [
  {
    period: "2025 - present",
    company: "(Unnamed) DeFi App",
    role: "Technical Advisor",
    summary:
      "An all-in-one, 100% self-custodial DeFi app - earn, borrow, multiply, loop yields and trade perps, with every position held in the user's own Safe smart account. I set up the monorepo and the indexer it runs on, then wired six lending protocols behind one set of product views.",
    details: [
      "Scaffolded the monorepo from empty: Next.js App Router, pnpm workspaces, strict lint rules and CI workflows",
      "Six protocols behind one set of Borrow / Earn / Multiply views - Morpho Blue, Euler v2, Fluid, Compound v3, Sky (ERC-4626) and Maple Finance",
      "Ponder indexer and its database schema, chain-scoping position IDs so two networks can't collide; on-chain calls run in parallel with indexer queries for sub-second position loads",
      "Cost-basis and PnL engine priced off protocol oracles - real entry cost read at the event block, with Chainlink and historical-API fallbacks for when a feed goes dark - surfacing true Net Borrow Cost, average purchase price and before/after leverage multiples",
      "Stop-Loss, Trailing Stop-Loss and Take-Profit sliders with directional loss-acceptance controls",
      "Product Finder tables for Borrow, Earn and Multiply: sorting, risk-curator filters, live liquidity, correlated-collateral exclusions",
      "Advisory backed by shipped code: hands-on delivery across a large part of the product surface",
    ],
  },
  {
    period: "2024 — 2026",
    company: "Lazy Summer Protocol · Summer.fi",
    role: "Senior Full-Stack Engineer",
    summary:
      "The next-generation Earn protocol app, taken from an empty repository to production. I led the frontend architecture, modernised the Web3 stack onto Viem and Wagmi v2, and built the telemetry that shows a depositor what their position is actually doing.",
    details: [
      "Institutional (RWA) dashboard, with two-layer auth: AWS Cognito for web2 roles, wallet connection for the web3 role",
      "Architected the /earn routes and vault simulation engine, standardising position metrics on real-time net value rather than gross earnings",
      "Owner-versus-viewer vault permissions - one manage view that adapts its controls to whoever is connected",
      "Migrated wallet connectivity off legacy Web3Onboard onto Viem + Wagmi v2, with Safe connectors for execution inside Gnosis Safe apps",
      "Live ERC-20 and native balances in deposit selectors, a global USD / native-token denomination toggle, and tagged cache revalidation behind both",
      "Yield telemetry at 1-hour granularity, up from 3-hour, with a graceful empty state for vaults short on history",
      "Monorepo foundations: authored the initial Turborepo proof-of-concept for the oasis-borrow → summerfi-monorepo move, then cache tuning, SST serverless deploys, TypeScript 5.7.3 across every package, and Lambda helpers keeping aggregation off the request path",
    ],
  },
  {
    period: "2023 — 2025",
    company: "Summer.fi Pro",
    role: "Senior Full-Stack Engineer",
    summary:
      "The 2023 rebrand and the consolidation that followed. I took the multi-protocol Borrow / Multiply / Earn suite onto Layer 2, brought Morpho Blue's isolated markets in, and built the risk-automation layer that lets several triggers guard one position without colliding - while the codebase itself was moving into a monorepo underneath us.",
    details: [
      "Protocol integrations across Maker, Aave v2/v3, Spark, Morpho Blue and Ajna, including Layer 2 networks",
      "Cross-validation for concurrent Stop-Loss, Auto-Buy and Auto-Sell triggers - keeps two automations from firing against each other or committing an impossible LTV",
      "Reactive state machines for DeFi Position Manager proxy creation and token approvals, making 1-click leverage non-blocking",
      "Wallet infrastructure moved to WalletConnect v2 via Web3Onboard, plus EIP-1559 transaction support and Gnosis Safe iframe fixes",
      "Kept the shared libraries, config engine and databases under every integration healthy - including trimming redundant on-chain calls out of Aave v3 reserve reads",
      "Internal telemetry bots reporting live TVL progress toward a $300M protocol goal",
    ],
  },
  {
    period: "2022 — 2023",
    company: "Oasis.app",
    role: "DeFi Frontend Engineer",
    summary:
      "A Maker-native vault product growing into a multi-protocol one. I brought Aave in, shipped the first frontend integration for Spark Lend, built the automation that lets a position defend itself against liquidation, and kept the data layer quick enough to survive traffic spikes.",
    details: [
      "Aave stETH/ETH yield products with 7-day annualised yield engines",
      "Automation UI and flows - stop-loss, take-profit, auto-buy/sell - with Stop-Loss triggers held 2.5% clear of each protocol's liquidation threshold",
      "Faster Aave positions: yield queries initialised once in shared app context rather than per component",
      "Cached multi-network portfolio data to ride out spikes that would otherwise hit RPC rate limits",
      "Shared configuration engine: feature flags, multi-chain RPC providers, cross-chain flash-loan token mapping",
    ],
  },
  {
    period: "2016 - 2022",
    company: "Softax",
    role: "Full-Stack Engineer",
    summary:
      "Six years at a Polish software house building for enterprise clients - vehicle-leasing applications for a major automotive group, retail banking apps for two banks, and the internal tooling the staff behind them ran on. Regulated, integration-heavy work on systems measured in years, where a wrong number is a compliance problem rather than a bug.",
    details: [
      "Customer-facing vehicle leasing applications, and the multi-step flows that turn an enquiry into a signed agreement",
      "Retail banking front-ends, plus the back-office tools and internal systems the operating teams used",
      "Long-running client engagements - features owned across years of maintenance rather than shipped and handed off",
      "Where the habits came from: money handled precisely, flows that must never half-complete, and software answerable to people who aren't engineers - the same instincts DeFi turned out to need",
    ],
  },
];
