import { InfoPage, pages, PageId } from "./site-info";
import {Respond} from "./feedback";
import { AreaLinks, AreaPage } from "./library-areas";
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Header, Footer, Icon, State, Field, TaskBody } from "./ui";
import { api, act, useData, file, go, subjectCover } from "./api";
import { Teacher } from "./staff";
import { Game, Join } from "./play";
const [route, id, sub] = location.pathname.split("/").filter(Boolean);
function Home() {
  const { data, error } = useData("catalog"),
    [term, set] = useState("");
  return (
    <>
      <section className="hero">
        <div className="heroPhoto" />
        <div className="wrap heroInner">
          <div className="eyebrow">
            <b /> STAVEBKA JIHLAVA
          </div>
          <h1>
            Knihovna
            <br />
            <em>výukových aktivit</em>
          </h1>
          <p>Otevři si předmět, vyber úkol a pusť se do práce.</p>
        </div>
      </section>
      <main className="wrap library">
        <div className="heading">
          <div>
            <div className="kicker">KNIHOVNA</div>
            <h2>Předměty</h2>
          </div>
          <label className="search">
            <Icon name="search" size={18} />
            <input
              aria-label="Hledat předmět"
              placeholder="Hledat předmět"
              value={term}
              onChange={(e) => set(e.target.value)}
            />
          </label>
        </div>
        {!data ? (
          <State error={error} />
        ) : (
          <div className="gridCards">
            {data
              .filter((s: any) =>
                s.title
                  .toLocaleLowerCase("cs")
                  .includes(term.toLocaleLowerCase("cs")),
              )
              .map((s: any) => (
                <a
                  style={
                    {
                      "--subject-color":
                        (
                          {
                            blue: "#205c8c",
                            green: "#347663",
                            orange: "#a5543c",
                          } as any
                        )[s.theme] || s.theme,
                    } as React.CSSProperties
                  }
                  className="subject"
                  href={"/predmet/" + s.id}
                  key={s.id}
                >
                  <div className="cardImg">
                    <img src={subjectCover(s.cover)} alt="" />
                    <span className="subjectIcon">
                      <Icon name={s.icon} />
                    </span>
                  </div>
                  <div className="cardBody">
                    <h3>{s.title}</h3>
                    <p>{s.description}</p>
                    <div className="cardFoot">
                      <span>
                        <Icon name="book" size={16} /> {s.count}{" "}
                        {s.count === 1
                          ? "úkol"
                          : s.count >= 2 && s.count <= 4
                            ? "úkoly"
                            : "úkolů"}
                      </span>
                      <Icon name="arrow" size={19} />
                    </div>
                  </div>
                </a>
              ))}
            {!data.some((s: any) =>
              s.title
                .toLocaleLowerCase("cs")
                .includes(term.toLocaleLowerCase("cs")),
            ) && <p>Žádný předmět neodpovídá hledání.</p>}
          </div>
        )}
      </main>
    </>
  );
}
function Subject() {
  const { data: s, error } = useData("subject/" + id);
  if (!s) return <State error={error} />;
  return (
    <main className="wrap page">
      <a href="/">‹ Všechny předměty</a>
      <img className="subject-hero" src={subjectCover(s.cover)} alt="" />
      <h1>{s.title}</h1>
      <p className="lead">{s.description}</p>
      <AreaLinks s={s} />
      <h2>Poslední úkoly</h2>
      <div className="gridCards">
        {s.tasks.map((t: any) => (
          <a className="subject" key={t.id} href={"/ukol/" + t.id}>
            {t.body.cover && (
              <img className="thumb" src={file(t.body.cover)} alt="" />
            )}
            <div className="cardBody">
              <h3>{t.body.title}</h3>
              <p>{t.body.intro}</p>
            </div>
          </a>
        ))}
      </div>
      {!s.tasks.length && (
        <p>V tomto předmětu zatím nejsou zveřejněné úkoly.</p>
      )}
    </main>
  );
}
function Task() {
  const qr = React.useRef<HTMLDialogElement>(null);
  const { data: t, error } = useData("task/" + id, 4000);
  const loaded=!!t;
  useEffect(()=>{if(loaded && new URLSearchParams(location.search).get("qr")==="1") qr.current?.showModal()},[loaded]);
  return (
    <main className="wrap page">
      {t ? (
        <>
          <a href={"/predmet/" + t.sid}>‹ Předmět</a>
          {t.area && (
            <>
              {" "}
              / <a href={"/oblast/" + t.area.id}>{t.area.title}</a>
            </>
          )}
          <div className="actions"><button className="secondary" onClick={()=>qr.current?.showModal()}>Promítnout QR kód úkolu</button></div>
          <dialog ref={qr} aria-label="QR kód úkolu" className="task-projection">
            <h2>{t.body.title}</h2><img src={"/api/task-qr/"+encodeURIComponent(id)} alt="QR kód pro otevření tohoto úkolu"/><p>Načti kód fotoaparátem a otevři zadání.</p><button onClick={()=>qr.current?.close()}>Zavřít projekci</button>
          </dialog>
          <TaskBody t={t} />
        </>
      ) : (
        <State error={error} />
      )}
    </main>
  );
}
function App() {
  const [msg, set] = useState("");
  useEffect(() => {
    const fn = (e: any) => set(e.detail);
    window.addEventListener("folio-error", fn);
    return () => window.removeEventListener("folio-error", fn);
  }, []);
  const play = ["hra", "projekce", "moderator"].includes(route);
  return (
    <>
      {!play && route !== "ucitel" && <Header />}
      {msg && (
        <div className="alert" role="alert">
          {msg}
          <button onClick={() => set("")}>Zavřít</button>
        </div>
      )}
      {!route ? (
        <Home />
      ) : route === "informace" && Object.prototype.hasOwnProperty.call(pages,id) ? (
        <InfoPage id={id as PageId} />
      ) : route === "predmet" ? (
        <Subject />
      ) : route === "oblast" ? (
        <AreaPage id={id} />
      ) : route === "ukol" ? (
        <Task />
      ) : route === "zpetna-vazba" ? <Respond share={id}/> : route === "pripojit" ? (
        <Join pin={id} />
      ) : play ? (
        <Game id={id} role={route} />
      ) : route === "ucitel" ? (
        <Teacher section={id} id={sub} />
      ) : (
        <main className="wrap page">
          <h1>Stránka nenalezena</h1>
          <a href="/">Otevřít knihovnu</a>
        </main>
      )}
      {!play && <Footer />}
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
