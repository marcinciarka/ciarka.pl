import { skills } from "../content";

const GROUPS: { key: keyof typeof skills; label: string }[] = [
  { key: "web3", label: "Web3" },
  { key: "frontend", label: "Frontend" },
  { key: "backend", label: "Backend" },
  { key: "tooling", label: "Tooling" },
];

export function Skills() {
  return (
    <section
      id="skills"
      aria-labelledby="skills-heading"
      className="mx-auto max-w-6xl px-6 py-16 sm:py-20"
    >
      <h2
        id="skills-heading"
        className="font-display text-[clamp(1.75rem,3.5vw,2.75rem)] font-medium tracking-tight text-text"
      >
        Toolbox
      </h2>
      <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {GROUPS.map((g) => (
          <div key={g.key}>
            <h3 className="font-mono text-xs uppercase tracking-wide text-ember">
              {g.label}
            </h3>
            <ul className="mt-4 space-y-2">
              {skills[g.key].map((s) => (
                <li key={s} className="text-sm text-muted">
                  {s}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
