import React, { useState } from "react";
import { file } from "./api";
export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const shapes: Record<string, React.ReactNode> = {
    data: (
      <>
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v13c0 4 16 4 16 0V5M4 11c0 4 16 4 16 0" />
      </>
    ),
    code: <path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-14-3 18" />,
    chip: (
      <>
        <rect x="6" y="6" width="12" height="12" rx="2" />
        <path d="M9 2v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4M9 18v4m6-4v4" />
      </>
    ),
    network: (
      <>
        <rect x="9" y="2" width="6" height="5" />
        <path d="M12 7v5M5 16v-4h14v4" />
        <rect x="2" y="16" width="6" height="5" />
        <rect x="16" y="16" width="6" height="5" />
      </>
    ),
    wood: (
      <>
        <path d="m3 14 12-10 6 2v6L9 21l-6-2zM3 14l6 2 12-10M9 16v5" />
      </>
    ),
    tools: (
      <path d="m3 20 10-10a6 6 0 0 1 7-7l-4 4 2 2 4-4a6 6 0 0 1-7 7L5 22z" />
    ),
    building: (
      <>
        <path d="M3 21h18M5 21V8l7-5 7 5v13M9 10v2m6-2v2m-6 3v2m6-2v2" />
      </>
    ),
    palette: (
      <>
        <path d="M21 12c0-6-5-10-11-9-7 1-10 10-6 15 2 3 8 5 10 2 1-2-2-3 0-5 2-2 7 1 7-3Z" />
        <circle cx="8" cy="9" r="1" />
        <circle cx="13" cy="7" r="1" />
        <circle cx="17" cy="10" r="1" />
      </>
    ),
    folio: (
      <>
        <path d="m3 6 8-3 10 3-8 3zM3 10l10 3 8-3M3 14l10 3 8-3M3 18l10 3 8-3" />
      </>
    ),
    quiz: (
      <>
        <path d="M13 2 4 14h7l-1 8 10-13h-8z" />
      </>
    ),
    feedback:<path d="M3 4h18v13H9l-5 4v-4H3zM7 9h10M7 12h6"/>,
    people: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M2 20v-2a7 7 0 0 1 14 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 4 5" />
      </>
    ),
    book: (
      <>
        <path d="M3 4c4-1 6 0 9 2 3-2 5-3 9-2v14c-4-1-7 0-9 2-2-2-5-3-9-2zM12 6v14" />
      </>
    ),
    monitor: (
      <>
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8m-4-4v4" />
      </>
    ),
    camera: (
      <>
        <path d="M2 7h5l2-3h6l2 3h5v13H2z" />
        <circle cx="12" cy="13" r="4" />
      </>
    ),
    ruler: (
      <>
        <path d="M2 21 21 2v19zM12 17l5-5v5z" />
      </>
    ),
    search: (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 6 6" />
      </>
    ),
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {shapes[name] || shapes.book}
    </svg>
  );
}
function FolioLogo() {
  return (
    <a className="logo" href="/">
          <i>
            <Icon name="folio" size={28} />
          </i>
          Folio
        </a>
  );
}
export function Header() {
  return (
    <header>
      <div className="wrap bar">
        <FolioLogo />
        <a className="join" href="/pripojit">
          <Icon name="quiz" size={17} />
          Připojit se ke kvízu
        </a>
      </div>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div><FolioLogo /><p>Knihovna výukových aktivit<br/>Stavebka Jihlava</p></div>
        <nav aria-label="Výuka a správa"><h2>Výuka a správa</h2>
          <a href="/ucitel"><Icon name="lock" size={15}/> Administrace</a>
          <a href="/informace/dokumentace">Jak používat Folio</a><a href="/informace/role">Role a oprávnění</a></nav>
        <nav aria-label="Informace o webu"><h2>Informace o webu</h2>
          <a href="/informace/podminky">Podmínky používání</a><a href="/informace/soukromi">Soukromí a sběr dat</a><a href="/informace/bezpecnost">Bezpečnost a hlášení problémů</a></nav>
      </div>
    </footer>
  );
}
export function State({ error = "" }: { error?: string }) {
  return <p role="status">{error || "Načítání…"}</p>;
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Media({
  m,
  run = "",
  type,
  volume = 1,
}: {
  m: any;
  run?: string;
  type?: string;
  volume?: number;
}) {
  const src = file(m.file, run),
    [zoom, set] = useState(false);
  return (
    <figure>
      {(type || m.type || "").startsWith("audio") ? (
        <audio
          controls
          preload="metadata"
          src={src}
          ref={(e) => {
            if (e) e.volume = volume;
          }}
        />
      ) : (type || m.type || "").startsWith("video") ? (
        <video
          controls
          src={src}
          ref={(e) => {
            if (e) e.volume = volume;
          }}
        />
      ) : (
        <button
          className="mediaBtn"
          aria-label="Zvětšit obrázek"
          onClick={() => set(true)}
        >
          <img src={src} alt={m.alt || m.caption || "Obrázek k otázce"} />
        </button>
      )}
      {m.caption && <figcaption>{m.caption}</figcaption>}
      {m.transcript && (
        <details>
          <summary>Přepis</summary>
          {m.transcript}
        </details>
      )}
      {zoom && (
        <dialog
          open
          onKeyDown={(e) => {
            if (e.key === "Escape") set(false);
          }}
        >
          <img src={src} alt={m.alt || ""} />
          <button autoFocus onClick={() => set(false)}>
            Zavřít
          </button>
        </dialog>
      )}
    </figure>
  );
}
export function TextBlock({ text }: { text: string }) {
  const inline = (s: string) =>
    s
      .split(/(\*\*[^*]+\*\*)/)
      .map((x, i) =>
        x.startsWith("**") ? <strong key={i}>{x.slice(2, -2)}</strong> : x,
      );
  return (
    <>
      {text
        .replace(/^(#+[^\n]*)\n/gm, "$1\n\n")
        .split(/\n\s*\n/)
        .map((p, i) =>
          p.startsWith("#") ? (
            <h3 key={i}>{p.replace(/^#+\s*/, "")}</h3>
          ) : p.startsWith("- ") ? (
            <ul key={i}>
              {p.split("\n").map((x, j) => (
                <li key={j}>{inline(x.replace(/^- /, ""))}</li>
              ))}
            </ul>
          ) : /^\d+\. /.test(p) ? (
            <ol key={i}>
              {p.split("\n").map((x, j) => (
                <li key={j}>{inline(x.replace(/^\d+\. /, ""))}</li>
              ))}
            </ol>
          ) : (
            <p key={i}>{inline(p)}</p>
          ),
        )}
    </>
  );
}
export function TaskBody({
  t,
  preview = false,
}: {
  t: any;
  preview?: boolean;
}) {
  const b = t.body;
  return (
    <article className="lesson">
      <h1>{b.title}</h1>
      <p className="lead">{b.intro}</p>
      {b.cover && <img className="cover" alt="" src={file(b.cover)} />}{" "}
      {b.blocks.map((x: any, i: number) => (
        <section key={i}>
          {["file", "image"].includes(x.kind) && !x.file ? (
            <p className="pending-file">
              {x.label || x.caption || "Příloha"} · doplnit soubor
            </p>
          ) : x.kind === "text" ? (
            <TextBlock text={x.text} />
          ) : x.kind === "image" ? (
            <Media m={x} />
          ) : x.kind === "file" ? (
            <a
              className="resource"
              href={file(x.file) + "?download=1"}
              download
            >
              ↓ {x.label || t.files?.[x.file]?.name || "Stáhnout soubor"}{" "}
              <small>
                {t.files?.[x.file]?.type.split("/").pop()?.toUpperCase()}{" "}
                {t.files?.[x.file] &&
                  Math.ceil(t.files[x.file].size / 1024) + " kB"}
              </small>
            </a>
          ) : x.kind === "link" ? (
            <a className="resource" href={x.url}>
              {x.label}
            </a>
          ) : (
            <div className="panel">
              <h3>Živý kvíz</h3>
              {!preview && t.games?.some((g: any) => g.quiz === x.quiz)
                ? t.games
                    .filter((g: any) => g.quiz === x.quiz)
                    .map((g: any) => (
                      <a
                        className="btn"
                        key={g.pin}
                        href={"/pripojit/" + g.pin}
                      >
                        {g.group || g.name} · {g.pin}
                      </a>
                    ))
                : "Soutěž zatím nebyla spuštěna"}
            </div>
          )}
        </section>
      ))}
    </article>
  );
}

export function Prompt({
  q,
  run = "",
  volume = 1,
}: {
  q: any;
  run?: string;
  volume?: number;
}) {
  const parts = q.media.map((m: any, i: number) => (
    <Media key={i} m={m} run={run} volume={volume} />
  ));
  parts.splice(
    Math.min(q.textPosition || 0, parts.length),
    0,
    <h2 key="text">{q.text}</h2>,
  );
  return <>{parts}</>;
}
