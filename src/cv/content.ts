// CV copy for both PDFs. Edit here, then `npm run cv`.
//
// Plain text everywhere: React escapes it, so "&" and "<" are safe.
// "\n" starts a new line inside one sidebar item.

export type Link = { text: string; href?: string };

// A job has either `body` (one paragraph) or `items` (sub-projects shown as a
// two-column list), not both.
export type Job = { dates: string; title: string; org: string } & (
  | { body: string; items?: never }
  | { items: { name: string; body: string }[]; body?: never }
);

export type Project = {
  name: string;
  link: string;
  href: string;
  body: string;
  tags: string[];
};

export type CvContent = {
  file: string;
  name: string;
  role: string[];
  summary: string;
  contact: Link[];
  core: string[];
  skills: { title: string; items: string[] };
  availability: string[];
  education: string[];
  languages: string[];
  experience: Job[];
  projects: Project[];
};

const contact: Link[] = [
  { text: "Warsaw, Poland" },
  { text: "cv@plamka.net", href: "mailto:cv@plamka.net" },
  { text: "github.com/marcinciarka", href: "https://github.com/marcinciarka" },
  {
    text: "linkedin.com/in/marcin-ciarka-942405147",
    href: "https://linkedin.com/in/marcin-ciarka-942405147",
  },
  { text: "telegram / discord: marcinciarka" },
];

const core = [
  "TypeScript · React · Next.js (App Router, RSC)",
  "Node · Bun · PostgreSQL (Prisma, Kysely)",
  "AWS (ECS, Cognito) · Docker · SST · CI/CD",
  "Turborepo · Vite libraries",
  "CSS Modules · Tailwind · WebGL · Web Audio",
];

const availability = ["Remote · CET", "B2B contract"];
const education = ["BA, Advertising Photography\nWarszawska Szkoła Reklamy"];
const languages = ["Polish — native · English — professional"];

const softax: Job = {
  dates: "2016 — 2022",
  title: "Full-Stack Engineer",
  org: "Softax",
  body: "Regulated enterprise work: vehicle-leasing applications for a major automotive group, retail banking front-ends for two banks, and their back-office tools.",
};

const shared = { name: "Marcin Ciarka", contact, core, availability, education, languages };

export const variants: CvContent[] = [
  {
    ...shared,
    file: "marcin_ciarka_cv.pdf",
    role: ["Senior Full-Stack Engineer", "DeFi & Web3"],
    summary:
      "Full-stack engineer, 10 years building for the web, the last four shipping production DeFi: frontends, backend data pipelines, and the risk automation that keeps positions safe. I take repositories from empty to production.",
    skills: {
      title: "Web3",
      items: [
        "Viem · Wagmi v2 · WalletConnect v2",
        "Safe smart accounts · EIP-1559",
        "Ponder indexers · Chainlink feeds",
        "BigNumber.js precision math",
        "Multicall data pipelines",
      ],
    },
    experience: [
      {
        dates: "2026 — now",
        title: "Technical Advisor (contract)",
        org: "DeFi platform, under NDA",
        body: "Started the codebase for a self-custodial earn / borrow / multiply / loop / perps app on Safe smart accounts, and am its largest contributor across product, SDK and backend. Built position flows across seven lending protocols, Shield Stop-Loss / Trailing Stop / Take-Profit guardians, the cost-basis and PnL engine, and a market-data pipeline for ~15 protocols.",
      },
      {
        dates: "2022 — 2026",
        title: "Senior Full-Stack Engineer",
        org: "Summer.fi (formerly Oasis.app)",
        items: [
          {
            name: "Lazy Summer Protocol",
            body: "Co-built the Earn app from empty repo to production as TVL approached $200M, main contributor from 2025; vault simulation engine; institutional vault admin dashboard and its auth (Cognito, RBAC, TOTP MFA).",
          },
          {
            name: "Summer.fi Pro",
            body: "Multi-protocol Borrow / Multiply / Earn suite onto Layer 2; trigger cross-validation for Stop-Loss, Auto-Buy and Auto-Sell; typed runtime config used during incidents; dependency cleanup across 1,497 files.",
          },
          {
            name: "Oasis.app",
            body: "Grew Maker-native vaults into a multi-protocol product; first Spark Lend frontend integration; Aave stETH/ETH yield engines.",
          },
        ],
      },
      softax,
    ],
    projects: [
      {
        name: "ChainVibe",
        link: "chainvi.be",
        href: "https://chainvi.be/",
        body: "Multi-tenant on-chain event streaming: one server-side WebSocket fanned out to every client, with RPC failover, tx dedupe and Postgres-persisted metrics. Published as @chainvibe/components.",
        tags: ["Bun", "viem", "WebSockets", "PostgreSQL", "React"],
      },
      {
        name: "Summer Resonance",
        link: "resonance.summer.fi",
        href: "https://resonance.summer.fi/",
        body: "Live protocol telemetry you can hear: deposits, withdrawals and TVL mapped to a generative Web Audio soundscape with WebGL animation.",
        tags: ["Next.js", "TypeScript", "Web Audio", "WebGL"],
      },
    ],
  },
  {
    ...shared,
    file: "marcin_ciarka_cv_nondefi.pdf",
    role: ["Senior Full-Stack Engineer", "Frontend Architecture & Platform"],
    summary:
      "Full-stack engineer, 10 years building for the web, the last four in fintech: frontends, backend data pipelines, and the risk automation that keeps positions safe. I take repositories from empty to production.",
    skills: {
      title: "Practice",
      items: [
        "Design systems & component libraries",
        "Real-time data (WebSockets, streaming)",
        "Data pipelines & event indexing",
        "High-precision numeric & financial logic",
        "Auth & access control (RBAC, MFA)",
      ],
    },
    experience: [
      {
        dates: "2026 — now",
        title: "Technical Advisor (contract)",
        org: "Fintech platform, under NDA",
        body: "Started the codebase for a self-custodial investing app on smart-contract accounts, and am its largest contributor across product, SDK and backend. Built position flows across seven lending providers, automated stop-loss and take-profit protection, the cost-basis and PnL engine, and a market-data pipeline for ~15 providers.",
      },
      {
        dates: "2022 — 2026",
        title: "Senior Full-Stack Engineer",
        org: "Summer.fi (formerly Oasis.app)",
        items: [
          {
            name: "Savings product",
            body: "Co-built from empty repo to production as assets under management approached $200M, main contributor from 2025; yield simulation engine; institutional admin dashboard and its auth (Cognito, RBAC, TOTP MFA).",
          },
          {
            name: "Pro platform",
            body: "Borrow / leverage / savings suite on a new infrastructure tier; trigger cross-validation for stop-loss and rebalancing; typed runtime config used during incidents; dependency cleanup across 1,497 files.",
          },
          {
            name: "Core app",
            body: "Grew a single-provider product into a multi-provider platform; first integrations for two new lending partners and their yield engines.",
          },
        ],
      },
      softax,
    ],
    projects: [
      {
        name: "ChainVibe",
        link: "chainvi.be",
        href: "https://chainvi.be/",
        body: "Multi-tenant live event streaming: one server-side WebSocket fanned out to every client, with failover, dedupe and Postgres-persisted metrics. Published as an npm component library.",
        tags: ["Bun", "WebSockets", "PostgreSQL", "React"],
      },
      {
        name: "Resonance",
        link: "resonance.summer.fi",
        href: "https://resonance.summer.fi/",
        body: "Live product telemetry you can hear: deposits, withdrawals and balances mapped to a generative Web Audio soundscape with WebGL animation.",
        tags: ["Next.js", "TypeScript", "Web Audio", "WebGL"],
      },
    ],
  },
];
