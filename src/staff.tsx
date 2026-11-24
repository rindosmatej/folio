import {Login,Accounts} from "./accounts";
import {Retention} from "./retention";
import { RemoveContent } from "./removal";
import { FeedbackSpace } from "./feedback";
import { WorkspaceHeader } from "./workspace-header";
import { AreaLinks, AreaEditor, AreaPage, IconPicker } from "./library-areas";
import { SubjectPhoto, saveWithPhoto } from "./subject-photo";
import React, { useState, useEffect } from "react";
import { api, act, useData, go, uid } from "./api";
import { Field, State, Header } from "./ui";
import { TaskEditor, QuizEditor } from "./edit";
export const staff = (s: string, id = "") =>
  "/ucitel/" + s + (id ? "/" + id : "");
export function Teacher({ section, id }: { section?: string; id?: string }) {
  const [me,setMe]=useState<any>(undefined);const [error,setError]=useState("");
  useEffect(()=>{api("me").then(setMe).catch(e=>setError(e.message))},[]);
  if(me===undefined)return <main className="wrap page"><State error={error}/></main>;
  if(!me)return <Login/>;
  return (
    <>
      <WorkspaceHeader user={me} section={section} />
      <main className="wrap page">
        {section === "ucty" && me.role === "admin" ? <Accounts/> : section === "uchovavani" && me.role === "admin" ? <Retention/> : section === "vazba" ? (
          <FeedbackSpace id={id} />
        ) : section === "souteze" ? (
          <History />
        ) : section === "predmet" ? (
          <Shelf id={id!} me={me} />
        ) : section === "oblast" ? (
          <AreaPage id={id!} staff />
        ) : section === "ukol" ? (
          <TaskEditor id={id!} />
        ) : section === "kviz" ? (
          <QuizEditor id={id!} admin={me.role === "admin"} />
        ) : section === "sprava" ? (
          <SubjectForm id={id} admin={me.role === "admin"} />
        ) : (
          <Dashboard me={me} />
        )}
      </main>
    </>
  );
}
function Dashboard({ me }: { me: any }) {
  const { data, error } = useData("catalog?staff=1", 4000);
  return (
    <>
      <h1>{me.role === "admin" ? "Předměty" : "Moje předměty"}</h1>
      {me.role === "admin" && (
        <a className="btn" href={staff("sprava")}>
          Založit předmět
        </a>
      )}
      {data ? (
        data.map((s: any) => (
          <a key={s.id} className="row" href={staff("predmet", s.id)}>
            <strong>{s.title}</strong>
            <span>
              {s.visible ? "Zveřejněný" : "Skrytý"} · {s.count} úkolů
            </span>
          </a>
        ))
      ) : (
        <State error={error} />
      )}
    </>
  );
}
function Shelf({ id, me }: { id: string; me: any }) {
  const { data: s, error } = useData("subject/" + id + "?staff=1", 3000);
  if (!s) return <State error={error} />;
  return (
    <>
      <h1>{s.title}</h1>
      <p>{s.description}</p>
      <div className="actions">
        <a className="btn" href={staff("ukol", "novy") + "?sid=" + id}>
          Přidat úkol
        </a>
        <a href={staff("ukol", "novy") + "?sid=" + id + "&import=1"}>
          Importovat úkol z TXT
        </a>
        <a
          className="btn secondary"
          href={staff("kviz", "novy") + "?sid=" + id}
        >
          Přidat kvíz
        </a>
        <a href={staff("sprava", id)}>
          {me.role === "admin"
            ? "Nastavení předmětu"
            : "Upravit fotografii a ikonu"}
        </a>
      </div>
      <AreaLinks s={s} staff />
      <AreaEditor sid={id} />
      <h2>Poslední úkoly</h2>
      {s.tasks.map((t: any) => (
        <a key={t.id} className="row" href={staff("ukol", t.id)}>
          <strong>{t.body.title}</strong>
          {t.published ? "Publikováno" : "Koncept"}
        </a>
      ))}
      <h2>Kvízy</h2>
      {s.quizzes.map((q: any) =>
        q.editable ? (
          <a key={q.id} className="row" href={staff("kviz", q.id)}>
            {q.title}
          </a>
        ) : (
          <p key={q.id}>{q.title} · Sdílený k použití v úkolu</p>
        ),
      )}
    </>
  );
}
function SubjectForm({ id, admin }: { id?: string; admin: boolean }) {
  const [photo, change] = useState<File | null>(null),
    [saving, busy] = useState(false);
  const { data } = useData("catalog?staff=1");
  const s = data?.find((x: any) => x.id === id);
  if (!data) return <State />;
  if (id && !s) return <State error="Předmět není dostupný." />;
  return (
    <>
      <form
        className="stack panel"
        onSubmit={(e) => {
          e.preventDefault();
          const d = Object.fromEntries(new FormData(e.currentTarget));
          act(async () => {
            if (saving) return;
            busy(true);
            try {
              const patch = {
                ...d,
                id,
                version: s?.version,
                visible: !!d.visible,
              };
              const r = photo
                ? await saveWithPhoto(
                    admin
                      ? patch
                      : {
                          id,
                          version: s.version,
                          photoOnly: true,
                          icon: d.icon,
                        },
                    photo,
                  )
                : admin
                  ? await api("subject", patch)
                  : await api("subject-icon", {
                      id,
                      version: s.version,
                      icon: d.icon,
                    });
              go(staff("predmet", r.id));
            } finally {
              busy(false);
            }
          })();
        }}
      >
        <h1>{s ? (admin ? "Nastavení předmětu" : s.title) : "Nový předmět"}</h1>
        <IconPicker initial={s?.icon} />
        <SubjectPhoto cover={s?.cover} photo={photo} change={change} />
        {admin && (
          <>
            <Field label="Název">
              <input required name="title" defaultValue={s?.title} />
            </Field>
            <Field label="Popis">
              <textarea name="description" defaultValue={s?.description} />
            </Field>
            <Field label="Motiv">
              <select
                name="theme"
                defaultValue={
                  (
                    {
                      "#205c8c": "blue",
                      "#347663": "green",
                      "#a5543c": "orange",
                    } as any
                  )[s?.theme] || s?.theme
                }
              >
                <option value="blue">Modrý</option>
                <option value="green">Zelený</option>
                <option value="orange">Oranžový</option>
              </select>
            </Field>
            <Field label="Pořadí">
              <input type="number" name="pos" defaultValue={s?.pos || 0} />
            </Field>
            <label>
              <input
                type="checkbox"
                name="visible"
                defaultChecked={!!s?.visible}
              />{" "}
              Zveřejnit předmět
            </label>
          </>
        )}
        <button disabled={saving}>
          {saving ? "Ukládání…" : admin ? "Uložit předmět" : "Uložit změny"}
        </button>
      </form>
      {admin && id && <RemoveContent kind="subject" id={id} />}
    </>
  );
}
function History() {
  const { data, error } = useData("history", 2500);
  return (
    <>
      <h1>Soutěže</h1>
      {!data ? (
        <State error={error} />
      ) : data.length ? (
        data.map((r: any) => (
          <a className="row" href={"/moderator/" + r.id} key={r.id}>
            <strong>
              {r.title} · {r.className || "Bez označení"}
            </strong>
            <span>
              {new Date(r.started).toLocaleString("cs-CZ")} · počet hráčů{" "}
              {r.players} ·{" "}
              {r.ended
                ? r.early
                  ? "Předčasně ukončeno"
                  : "Dokončeno"
                : "PIN " + r.pin}
            </span>
          </a>
        ))
      ) : (
        <p>Zatím zde nejsou žádné soutěže.</p>
      )}
    </>
  );
}
