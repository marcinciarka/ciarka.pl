// The CV page. Not part of the site bundle: scripts/generate-cv.mjs renders
// it to static HTML and prints it to PDF. Styles live in cv.css.
import { renderToStaticMarkup } from "react-dom/server";
import type { CvContent, Job, Link, Project } from "./content.ts";

function SideSection({
  title,
  items,
  bottom = false,
}: {
  title: string;
  items: (string | Link)[];
  bottom?: boolean;
}) {
  return (
    <div className={bottom ? "side-section bottom" : "side-section"}>
      <div className="side-label">{title}</div>
      <div className="side-list">
        {items.map((item, i) => (
          <div key={i}>
            {typeof item === "string" ? (
              item
            ) : item.href ? (
              <a href={item.href}>{item.text}</a>
            ) : (
              item.text
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function JobEntry({ job }: { job: Job }) {
  return (
    <div className="job">
      <div className="dates">{job.dates}</div>
      <div className={job.items ? "job-body has-items" : "job-body"}>
        <div className="title">
          {job.title} <span className="org">· {job.org}</span>
        </div>
        {job.items ? (
          <div className="items text">
            {job.items.map((item) => (
              <div className="item" key={item.name}>
                <span className="item-name">{item.name}</span>{" "}
                <span>{item.body}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text">{job.body}</div>
        )}
      </div>
    </div>
  );
}

function ProjectEntry({ project }: { project: Project }) {
  return (
    <div className="project">
      <div className="title">
        {project.name}{" "}
        <a className="project-link" href={project.href}>
          {project.link}
        </a>
      </div>
      <div className="text">{project.body}</div>
      <div className="tags">{project.tags.join(" · ")}</div>
    </div>
  );
}

export function Cv({ cv }: { cv: CvContent }) {
  const [first, ...rest] = cv.name.split(" ");
  return (
    <section className="page">
      <header>
        <h1>
          {first}
          <br />
          {rest.join(" ")}
        </h1>
        <div className="role">
          {cv.role.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      </header>

      <main>
        <p className="summary">{cv.summary}</p>
        <div className="section">
          <div className="heading">Experience</div>
          <div className="jobs">
            {cv.experience.map((job) => (
              <JobEntry job={job} key={job.dates} />
            ))}
          </div>
        </div>
        <div className="section">
          <div className="heading">Selected projects</div>
          <div className="projects">
            {cv.projects.map((project) => (
              <ProjectEntry project={project} key={project.name} />
            ))}
          </div>
        </div>
      </main>

      <aside>
        <SideSection title="Contact" items={cv.contact} />
        <SideSection title="Core" items={cv.core} />
        <SideSection title={cv.skills.title} items={cv.skills.items} />
        <SideSection title="Availability" items={cv.availability} />
        <SideSection title="Education" items={cv.education} bottom />
        <SideSection title="Languages" items={cv.languages} />
      </aside>
    </section>
  );
}

// `baseHref` is the file:// URL of this folder, so the relative cv.css link
// and the font URLs inside it resolve when Chrome opens the page from a
// temp directory.
export function renderCv(cv: CvContent, baseHref: string): string {
  return (
    "<!doctype html>" +
    renderToStaticMarkup(
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <base href={baseHref} />
          <title>{`${cv.name} - ${cv.role[0]}, CV`}</title>
          <link rel="stylesheet" href="cv.css" />
        </head>
        <body>
          <Cv cv={cv} />
        </body>
      </html>,
    )
  );
}
