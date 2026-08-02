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
    tech: [
      "Next.js",
      "TypeScript",
      "Bun",
      "WebSockets",
      "Web Audio API",
      "WebGL",
    ],
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
      "An all-in-one, 100% self-custodial DeFi app - earn, borrow, multiply, loop yields and trade perps, with every position held in the user's own Safe smart account.",
    details: [
      "Set the platform architecture from an empty repository: Turborepo workspace, Next.js application, Tailwind design layer",
      "Designed the data layer end to end - database schema plus a deployed on-chain indexer feeding the app",
      "Advisory backed by shipped code: hands-on delivery across a large part of the product surface",
    ],
  },
  {
    period: "2024 — 2026",
    company: "Lazy Summer Protocol · Summer.fi",
    role: "Senior Full-Stack Engineer",
    summary:
      "Built from an empty repository to production - the app, its data layer, and the institutional dashboard behind it.",
    details: [
      "90% of the institutional dashboard, with two-layer auth: AWS Cognito for web2 roles, wallet connection for the web3 role",
      "Next.js application and supporting databases taken from scaffold to production",
      "Interactive charts for protocol and position data",
      "Lambda helper functions moving aggregation work off the request path",
      "Cut build times through Turborepo cache tuning and reworked CI workflows",
    ],
  },
  {
    period: "2023 — 2025",
    company: "Summer.fi Pro",
    role: "Senior Full-Stack Engineer",
    summary:
      "The 2023 rebrand - taking the multi-protocol Borrow / Multiply / Earn suite onto Layer 2 and keeping the shared foundations underneath it healthy.",
    details: [
      "Layer 2 network integrations across Maker, Aave v2/v3, Spark, Morpho Blue and Ajna",
      "Maintained the shared libraries and databases every protocol integration depends on",
      "2,100+ commits and 500+ PRs across oasis-borrow and summerfi-monorepo",
    ],
  },
  {
    period: "2022 — 2023",
    company: "Oasis.app",
    role: "DeFi Frontend Engineer",
    summary:
      "Widening a Maker-native vault product into a multi-protocol one, and giving positions the automation to defend themselves.",
    details: [
      "Aave UI integration - a second lending protocol inside a Maker-native product",
      "Automation UI and transaction flows: stop-loss, take-profit, auto-buy/sell",
    ],
  },
  {
    period: "2016 - 2022",
    company: "Softax",
    role: "Full-Stack Engineer",
    summary:
      "Six years delivering software for automotive and banking clients - regulated, integration-heavy work where correctness and long-term maintenance mattered more than novelty.",
    details: [
      "Built and shipped client applications for enterprise automotive and banking customers",
      "Contributed to react-native-community/cli",
      "Real-time audio/DSP experiments (noise-monitor: client-side FFT analysis)",
      "Shipped LLM-backed apps from 2020, three years before the current wave",
    ],
  },
];

export type ProtocolActivity = {
  name: string;
  since: string;
  activity: number;
  note: string;
};

// Commit + PR counts per protocol/domain, from the verified footprint matrix.
// TODO(marcin): confirm pre-2022 Maker/Oasis work - the earlier aggregation date was unverified.
export const protocolMatrix: ProtocolActivity[] = [
  {
    name: "MakerDAO / Oasis",
    since: "2022",
    activity: 1598,
    note: "MCD vault portals, Multiply proxy actions, liquidation protection",
  },
  {
    name: "Multiply & Earn",
    since: "2022",
    activity: 884,
    note: "1-click levered yield strategies (DPM)",
  },
  {
    name: "Aave v2/v3",
    since: "2022",
    activity: 413,
    note: "eMode leverage, stETH/ETH vaults, APY engines",
  },
  {
    name: "Automation",
    since: "2022",
    activity: 283,
    note: "Stop-loss, take-profit, auto-buy/sell keeper UIs",
  },
  {
    name: "Spark",
    since: "2023",
    activity: 127,
    note: "Spark Lend in Summer.fi Omni-Kit",
  },
  {
    name: "Uniswap v2/v3",
    since: "2023",
    activity: 84,
    note: "Swap widgets, slippage controls, swap-and-deposit",
  },
  {
    name: "Morpho Blue",
    since: "2024",
    activity: 80,
    note: "Isolated lending markets, vault strategies",
  },
  {
    name: "Ajna",
    since: "2023",
    activity: 41,
    note: "Oracle-less P2P lending pools",
  },
  {
    name: "Compound v2/v3",
    since: "2024",
    activity: 29,
    note: "Lending market integrations",
  },
];

// Closing note folded in after the bars - keeps 1inch mentioned without a
// standalone low-activity row damaging the credibility of the matrix.
export const protocolMatrixFootnote =
  "also shipped against 1inch and other swap aggregators.";

export const skills = {
  web3: [
    "Viem",
    "Wagmi",
    "Ethers.js",
    "EIP-712",
    "Subgraphs/GraphQL",
    "Foundry",
    "Solidity (working)",
  ],
  frontend: [
    "React",
    "Next.js",
    "TypeScript",
    "RxJS",
    "Zustand",
    "Tailwind CSS",
    "Canvas/WebGL",
    "Web Audio API",
  ],
  backend: [
    "Node.js",
    "Bun",
    "WebSockets",
    "PostgreSQL",
    "Prisma",
    "LLM APIs (OpenAI/Anthropic)",
  ],
  tooling: ["Turborepo", "Vite", "Vitest/Jest", "GitHub Actions", "Docker"],
};
