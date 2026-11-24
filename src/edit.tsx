import {RemoveContent} from "./removal";
import { TaskImport } from "./task-import";
import React, { useState, useRef } from "react";
import { api, useData, act, go, uid, file } from "./api";
import { State, Field, TaskBody, Media, Prompt } from "./ui";
import { quiz, task, settings, validateGame } from "../lib/schema.mjs";
import { parseImport, decodeTxt } from "../lib/import.mjs";
const search = new URLSearchParams(location.search),
  fresh = search.get("sid") || "";
const emptyQuiz = {
  title: "Nový kvíz",
  settings: settings.parse({}),
  questions: [],
};
const emptyTask = { title: "Nový úkol", intro: "", blocks: [] };
const replace = (a: any[], i: number, x: any) =>
  a.map((e, j) => (j === i ? x : e));
function move(a: any[], i: number, d: number) {
  const b = [...a];
  [b[i], b[i + d]] = [b[i + d], b[i]];
  return b;
}
function Order({
  a,
  i,
  set,
}: {
  a: any[];
  i: number;
  set: (v: any[]) => void;
}) {
  return (
    <div className="actions small">
      <button disabled={!i} onClick={() => set(move(a, i, -1))}>
        Posunout výš
      </button>
      <button disabled={i === a.length - 1} onClick={() => set(move(a, i, 1))}>
        Posunout níž
      </button>
      <button onClick={() => set(a.filter((_, j) => j !== i))}>Odebrat</button>
    </div>
  );
}
function Input({ label, v, on, area = false, type = "text" }: any) {
  return (
    <Field label={label}>
      {area ? (
        <textarea value={v ?? ""} onChange={(e) => on(e.target.value)} />
      ) : (
        <input
          type={type}
          value={v ?? ""}
          onChange={(e) =>
            on(type === "number" ? Number(e.target.value) : e.target.value)
          }
        />
      )}
    </Field>
  );
}
function Upload({ sid, on, accept, busy }: any) {
  const [msg, set] = useState(""),
    [existing, list] = useState<any[] | null>(null);
  return (
    <div className="stack">
      <Field label="Nahrát soubor · nejvýše 4 MB">
        <input
          type="file"
          accept={
            accept ||
            ".pdf,.txt,.jpg,.jpeg,.png,.webp,.mp3,.wav,.ogg,.mp4,.webm"
          }
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (f.size > 4 * 1024 * 1024) {
              set("Soubor je větší než 4 MB.");
              return;
            }
            const r = new XMLHttpRequest();
            r.open(
              "POST",
              "/api/upload?sid=" +
                encodeURIComponent(sid) +
                "&name=" +
                encodeURIComponent(f.name),
            );
            busy?.(1);
            set("Nahrávání…");
            r.upload.onprogress = (e) => {
              if (e.lengthComputable)
                set(Math.round((100 * e.loaded) / e.total) + " %");
            };
            r.onload = () => {
              try {
                const v = JSON.parse(r.responseText);
                if (r.status >= 300) throw Error(v.error);
                on(v);
                set("Nahráno: " + v.name);
              } catch (e) {
                set((e as Error).message);
              }
            };
            r.onerror = () => set("Nahrávání selhalo. Zkontrolujte připojení.");
            r.onloadend = () => busy?.(-1);
            r.send(f);
          }}
        />
        <small>
          {accept || "PDF, TXT, JPG, PNG, WebP, MP3, WAV, OGG, MP4, WebM"} ·{" "}
          {msg}
        </small>
      </Field>
      {existing ? (
        <Field label="Existující příloha předmětu">
          <select
            defaultValue=""
            onChange={(e) => {
              const f = existing.find((x) => x.id === e.target.value);
              if (f) {
                on(f);
                set("Vybráno: " + f.name);
                list(null);
              }
            }}
          >
            <option value="">Vyberte soubor</option>
            {existing
              .filter(
                (f) =>
                  !accept ||
                  accept
                    .split(",")
                    .includes("." + f.name.split(".").pop().toLowerCase()),
              )
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
          </select>
        </Field>
      ) : (
        <button onClick={act(async () => list(await api("files/" + sid)))}>
          Vybrat z příloh předmětu
        </button>
      )}
    </div>
  );
}
export function TaskEditor({ id }: { id: string }) {
  const isNew = id === "novy",
    { data, error } = useData(
      isNew ? "subject/" + fresh + "?staff=1" : "task/" + id + "?staff=1",
      2500,
    );
  if (!data) return <State error={error} />;
  return <TaskForm saved={isNew ? { sid: fresh, body: emptyTask } : data} />;
}
function TaskForm({ saved }: { saved: any }) {
  const [b, set] = useState<any>(saved.body),
    [version, ver] = useState(saved.version),
    [pub, publish] = useState(!!saved.published),
    [area, selectArea] = useState(saved.area?.id || search.get("area") || ""),
    [importing, showImport] = useState(search.get("import") === "1"),
    [pos, order] = useState(saved.pos || 0),
    [preview, pre] = useState(false),
    [files, setFiles] = useState(saved.files || {}),
    [pending, pend] = useState(0);
  const { data: s } = useData("subject/" + saved.sid + "?staff=1", 3000);
  const patch = (v: any) => set({ ...b, ...v }),
    blocks = (v: any) => patch({ blocks: v });
  const add = (kind: string) =>
    blocks([
      ...b.blocks,
      (
        {
          text: { kind, text: "" },
          image: { kind, file: "", alt: "", caption: "" },
          file: { kind, file: "", label: "" },
          link: { kind, url: "", label: "" },
          quiz: { kind, quiz: s?.quizzes[0]?.id || "" },
        } as any
      )[kind],
    ]);
  return (
    <>
      <a href={"/ucitel/predmet/" + saved.sid}>‹ {s?.title || "Předmět"}</a>
      <h1>{saved.id ? "Upravit úkol" : "Přidat úkol"}</h1>
      <div className="actions">
        <button onClick={() => showImport(!importing)}>
          {importing ? "Zavřít import" : "Importovat z TXT"}
        </button>
        <button onClick={() => pre(!preview)}>
          {preview ? "Zpět do editoru" : "Náhled úkolu"}
        </button>
        <button
          disabled={!!pending || !s}
          onClick={act(async () => {
            const r = await api("task", {
              id: saved.id,
              sid: saved.sid,
              version,
              area: area || s?.areas[0]?.id,
              body: task.parse(b),
              published: pub,
              pos,
            });
            go("/ucitel/ukol/" + r.id);
          })}
        >
          Uložit úkol
        </button>
      </div>
      {importing && (
        <TaskImport
          areas={s?.areas || []}
          apply={(body, selected) => {
            if (
              (saved.id ||
                b.title !== "Nový úkol" ||
                b.blocks.length ||
                b.intro) &&
              !confirm(
                "Nahradit název, úvod a bloky aktuálního zadání importem?",
              )
            )
              return;
            set({ ...b, ...body });
            if (selected) selectArea(selected);
            showImport(false);
            pre(false);
          }}
        />
      )}
      {preview ? (
        <TaskBody t={{ body: b, files }} preview />
      ) : (
        <div className="stack">
          <Field label="Vzdělávací oblast">
            <select
              value={area || s?.areas[0]?.id || ""}
              onChange={(e) => selectArea(e.target.value)}
            >
              {s?.areas.map((a: any) => (
                <option value={a.id} key={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </Field>
          <Input
            label="Název"
            v={b.title}
            on={(title: string) => patch({ title })}
          />
          <Input
            label="Úvod"
            area
            v={b.intro}
            on={(intro: string) => patch({ intro })}
          />
          <Input label="Pořadí v oblasti" type="number" v={pos} on={order} />
          <label>
            <input
              type="checkbox"
              checked={pub}
              onChange={(e) => publish(e.target.checked)}
            />{" "}
            {pub ? "Publikováno" : "Koncept"}
          </label>
          <h3>Titulní fotografie</h3>
          {b.cover && (
            <img
              className="mini"
              src={file(b.cover)}
              alt="Titulní fotografie"
            />
          )}
          <Upload
            sid={saved.sid}
            accept=".jpg,.jpeg,.png,.webp"
            busy={(n: number) => pend((p) => p + n)}
            on={(v: any) => patch({ cover: v.id })}
          />
          <h2>Zadání</h2>
          {b.blocks.map((x: any, i: number) => {
            const update = (p: any) =>
              set((old: any) => ({
                ...old,
                blocks: replace(old.blocks, i, { ...old.blocks[i], ...p }),
              }));
            return (
              <section className="panel stack" key={i}>
                <h3>
                  {i + 1}.{" "}
                  {
                    (
                      {
                        text: "Text",
                        file: "Soubor",
                        image: "Obrázek",
                        link: "Webový odkaz",
                        quiz: "Kvíz",
                      } as any
                    )[x.kind]
                  }
                </h3>
                {x.kind === "text" ? (
                  <Input
                    label="Text (nadpis #, zvýraznění **text**, seznam - nebo 1.)"
                    area
                    v={x.text}
                    on={(text: string) => update({ text })}
                  />
                ) : x.kind === "quiz" ? (
                  <>
                    <Field label="Uložený kvíz">
                      <select
                        value={x.quiz}
                        onChange={(e) => update({ quiz: e.target.value })}
                      >
                        {s?.quizzes.map((q: any) => (
                          <option key={q.id} value={q.id}>
                            {q.title}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {saved.id &&
                      saved.body.blocks.some((y: any) => y.quiz === x.quiz) && (
                        <a
                          href={"/ucitel/kviz/" + x.quiz + "?task=" + saved.id}
                        >
                          Spustit soutěž z tohoto úkolu
                        </a>
                      )}
                  </>
                ) : (
                  <>
                    {["file", "image"].includes(x.kind) && (
                      <>
                        <Upload
                          sid={saved.sid}
                          accept={
                            x.kind === "image"
                              ? ".png,.jpg,.jpeg,.webp"
                              : undefined
                          }
                          busy={(n: number) => pend((p) => p + n)}
                          on={(v: any) => {
                            update({ file: v.id });
                            setFiles((f: any) => ({ ...f, [v.id]: v }));
                          }}
                        />
                        {x.file && <a href={file(x.file)}>Otevřít přílohu</a>}
                      </>
                    )}
                    {Object.entries({
                      label: "Název",
                      url: "Adresa https://…",
                      alt: "Alternativní text",
                      caption: "Popisek",
                    })
                      .filter(([k]) => k in x)
                      .map(([k, l]) => (
                        <Input
                          key={k}
                          label={l}
                          v={x[k]}
                          on={(v: string) => update({ [k]: v })}
                        />
                      ))}
                  </>
                )}
                <Order a={b.blocks} i={i} set={blocks} />
              </section>
            );
          })}
          <div className="actions">
            {["text", "image", "file", "link", "quiz"].map((k, i) => (
              <button key={k} onClick={() => add(k)}>
                + {["Text", "Obrázek", "Soubor", "Odkaz", "Kvíz"][i]}
              </button>
            ))}
          </div>
        </div>
      )}
    {saved.published && saved.id && <a className="btn secondary" href={"/ukol/"+encodeURIComponent(saved.id)+"?qr=1"} target="_blank" rel="noreferrer">Promítnout QR kód úkolu</a>}
    {saved.id&&<RemoveContent kind="task" id={saved.id}/>}</>
  );
}
export function QuizEditor({ id, admin }: { id: string; admin: boolean }) {
  const isNew = id === "novy",
    { data, error } = useData(
      isNew
        ? "subject/" + fresh + "?staff=1"
        : "quiz/" +
            id +
            (search.get("task") ? "?task=" + search.get("task") : ""),
      2500,
    );
  if (!data) return <State error={error} />;
  return (
    <QuizForm
      saved={isNew ? { sid: fresh, body: emptyQuiz, runs: [] } : data}
      admin={admin}
    />
  );
}
function QuizForm({ saved, admin }: { saved: any; admin: boolean }) {
  const [b, set] = useState(saved.body),
    [version, ver] = useState(saved.version),
    [base, baseline] = useState(saved.body),
    [tab, select] = useState("Otázky"),
    [launch, start] = useState<any>(() =>
      search.get("start") === "1" ? { ...saved.body.settings } : null,
    ),
    [pending, pend] = useState(0),
    [preview, show] = useState(""),
    [txt, text] = useState(""),
    [importing, imp] = useState(false),
    [request] = useState(uid),
    lock = useRef(false);
  const { data: subjects } = useData("catalog?staff=1");
  const shared = !!saved.useOnly;
  const upd = (p: any) => set({ ...b, ...p }),
    questions = (v: any) => upd({ questions: v }),
    busy = (n: number) => pend((p) => p + n);
  const save = async () => {
    const r = await api("quiz", {
      id: saved.id,
      sid: saved.sid,
      version,
      body: quiz.parse(b),
    });
    if (!saved.id) {
      go("/ucitel/kviz/" + r.id);
      return r.id;
    }
    ver(version + 1);
    baseline(b);
    return r.id;
  };
  const prepare = async (useChanges: boolean) => {
    const chosen = useChanges ? b : base;
    if (!shared) validateGame(chosen);
    if (useChanges && JSON.stringify(b) !== JSON.stringify(base)) await save();
    start({ ...chosen.settings });
  };
  let imported: any[] = [],
    err = "";
  if (txt) {
    try {
      imported = parseImport(txt);
    } catch (e) {
      err = (e as Error).message;
    }
  }
  return (
    <>
      <a href={"/ucitel/predmet/" + saved.sid}>‹ Předmět</a>
      <div className="heading">
        <h1>{b.title}</h1>
        <button
          disabled={!!pending}
          onClick={act(async () => {
            if (!saved.id) {
              validateGame(b);
              const r = await api("quiz", {
                sid: saved.sid,
                body: quiz.parse(b),
              });
              go("/ucitel/kviz/" + r.id + "?start=1");
              return;
            }
            if (!shared && JSON.stringify(b) !== JSON.stringify(base)) {
              select("Spuštění");
              return;
            }
            await prepare(false);
          })}
        >
          Spustit soutěž
        </button>
      </div>
      {saved.runs
        ?.filter((r: any) => !r.ended)
        .map((r: any) => (
          <a className="row" key={r.id} href={"/moderator/" + r.id}>
            PIN {r.pin} · {r.group || "Soutěž"} · Pokračovat v moderování
          </a>
        ))}
      {tab === "Spuštění" && !launch && (
        <div className="panel">
          <h3>Máte rozepsané změny</h3>
          <button onClick={act(() => prepare(true))}>
            Uložit a pokračovat
          </button>{" "}
          <button onClick={act(() => prepare(false))}>
            Spustit uloženou verzi
          </button>
        </div>
      )}
      {launch && (
        <section className="panel stack">
          <h2>Nastavení tohoto běhu</h2>
          <Settings s={launch} set={start} />
          <div className="actions">
            <button
              onClick={act(async () => {
                if (lock.current) return;
                lock.current = true;
                try {
                  const r = await api("create", {
                    quiz: saved.id,
                    task: search.get("task"),
                    request,
                    version,
                    settings: launch,
                  });
                  go("/moderator/" + r.id);
                } finally {
                  lock.current = false;
                }
              })}
            >
              Otevřít lobby a vytvořit PIN
            </button>
            <button onClick={() => start(null)}>Zrušit</button>
          </div>
        </section>
      )}
      {!shared && (
        <>
          <nav className="tabs">
            {["Otázky", "Nastavení soutěže", "Historie"].map((t) => (
              <button
                key={t}
                aria-pressed={tab === t}
                onClick={() => select(t)}
              >
                {t}
              </button>
            ))}
          </nav>
          {tab === "Historie" ? (
            <>
              {saved.runs
                .filter((r: any) => r.ended)
                .map((r: any) => (
                  <a className="row" key={r.id} href={"/moderator/" + r.id}>
                    {new Date(r.started).toLocaleString("cs-CZ")} ·{" "}
                    {r.group || "Bez označení"} ·{" "}
                    {r.early ? "Předčasně ukončeno" : "Dokončeno"}
                  </a>
                ))}
              {!saved.runs.some((r: any) => r.ended) && (
                <p>Žádná dokončená soutěž.</p>
              )}
            </>
          ) : tab === "Nastavení soutěže" ? (
            <Settings
              s={b.settings}
              set={(settings: any) => upd({ settings })}
            />
          ) : tab === "Otázky" ? (
            <div className="stack">
              <Input
                label="Název kvízu"
                v={b.title}
                on={(title: string) => upd({ title })}
              />
              {b.questions.map((q: any, i: number) => (
                <Question
                  key={q.id}
                  q={q}
                  i={i}
                  sid={saved.sid}
                  busy={busy}
                  change={(v: any) =>
                    set((old: any) => ({
                      ...old,
                      questions: replace(old.questions, i, {
                        ...old.questions[i],
                        ...v,
                      }),
                    }))
                  }
                >
                  <Order a={b.questions} i={i} set={questions} />
                  <button
                    onClick={() =>
                      questions([
                        ...b.questions.slice(0, i + 1),
                        { ...structuredClone(q), id: uid() },
                        ...b.questions.slice(i + 1),
                      ])
                    }
                  >
                    Duplikovat otázku
                  </button>
                  <button onClick={() => show(preview === q.id ? "" : q.id)}>
                    Náhled
                  </button>
                  {preview === q.id && <Preview q={q} />}
                </Question>
              ))}
              <div className="actions">
                <button
                  onClick={() => questions([...b.questions, newQuestion()])}
                >
                  Přidat otázku
                </button>
                <button onClick={() => imp(!importing)}>Importovat TXT</button>
              </div>
              {importing && (
                <div className="panel stack">
                  <Input area label="Text importu" v={txt} on={text} />
                  <input
                    type="file"
                    accept=".txt"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f)
                        act(async () => {
                          const a = await f.arrayBuffer();
                          text(decodeTxt(a));
                        })();
                    }}
                  />
                  <p>{err || "Počet otázek: " + imported.length}</p>
                  <ol>
                    {imported.map((q) => (
                      <li key={q.id}>
                        {q.text} ·{" "}
                        {q.options.map((o: any) => o.text).join(" / ")}
                      </li>
                    ))}
                  </ol>
                  <button
                    disabled={!imported.length}
                    onClick={() => {
                      questions([
                        ...b.questions,
                        ...imported.map((q) => ({ ...q, id: uid() })),
                      ]);
                      imp(false);
                      text("");
                    }}
                  >
                    Potvrdit import
                  </button>
                </div>
              )}
            </div>
          ) : null}
          {tab !== "Historie" && (
            <button className="save" disabled={!!pending} onClick={act(save)}>
              Uložit kvíz
            </button>
          )}
          {admin && saved.id && (
            <details>
              <summary>Zpřístupnit kvíz jiným předmětům</summary>
              {subjects
                ?.filter((s: any) => s.id !== saved.sid)
                .map((s: any) => (
                  <label key={s.id}>
                    <input
                      type="checkbox"
                      checked={saved.shared.includes(s.id)}
                      onChange={(e) =>
                        act(() =>
                          api("share", {
                            id: saved.id,
                            sids: e.target.checked
                              ? [...saved.shared, s.id]
                              : saved.shared.filter((v: string) => v !== s.id),
                          }),
                        )()
                      }
                    />{" "}
                    {s.title}{" "}
                  </label>
                ))}
            </details>
          )}
        </>
      )}
    </>
  );
}
const bool = [
  { id: "true", text: "Pravda" },
  { id: "false", text: "Nepravda" },
];
function newQuestion() {
  return {
    id: uid(),
    text: "Nová otázka",
    type: "one",
    seconds: 25,
    media: [],
    options: [
      { id: uid(), text: "" },
      { id: uid(), text: "" },
    ],
    correct: [],
    explanation: "",
    unit: "",
    value: 0,
    tolerance: 0,
  };
}
function Question({ q, i, sid, change, busy, children }: any) {
  return (
    <section className="panel stack">
      <h3>Otázka {i + 1}</h3>
      <Input
        label="Zadání"
        area
        v={q.text}
        on={(text: string) => change({ text })}
      />
      {q.media.map((m: any, j: number) => {
        const set = (x: any) =>
          change({ media: replace(q.media, j, { ...m, ...x }) });
        return (
          <div key={j} className="inset">
            <Media m={m} />
            <Upload
              sid={sid}
              busy={busy}
              accept=".jpg,.jpeg,.png,.webp,.wav,.mp3,.ogg,.mp4,.webm"
              on={(v: any) => set({ file: v.id, type: v.type })}
            />
            {Object.entries({
              caption: "Popisek",
              alt: "Alternativní text",
              transcript: "Přepis nebo titulky",
            }).map(([k, l]) => (
              <Input
                key={k}
                label={l}
                v={m[k]}
                on={(v: string) => set({ [k]: v })}
              />
            ))}
            <Order a={q.media} i={j} set={(media: any) => change({ media })} />
          </div>
        );
      })}
      <Upload
        sid={sid}
        busy={busy}
        accept=".jpg,.jpeg,.png,.webp,.wav,.mp3,.ogg,.mp4,.webm"
        on={(v: any) =>
          change({
            media: [
              ...q.media,
              {
                file: v.id,
                type: v.type,
                alt: "",
                caption: "",
                transcript: "",
              },
            ],
          })
        }
      />
      <Field label="Umístění textového zadání">
        <select
          value={Math.min(q.textPosition || 0, q.media.length)}
          onChange={(e) => change({ textPosition: +e.target.value })}
        >
          {Array.from({ length: q.media.length + 1 }, (_, n) => (
            <option key={n} value={n}>
              {n ? "Po médiu " + n : "Před médii"}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Způsob odpovědi">
        <select
          value={q.type}
          onChange={(e) =>
            change({
              type: e.target.value,
              options:
                e.target.value === "bool"
                  ? bool
                  : q.type === "bool"
                    ? newQuestion().options
                    : q.options,
              correct: [],
            })
          }
        >
          {Object.entries({
            one: "Jedna správná",
            many: "Více správných",
            bool: "Pravda / nepravda",
            number: "Číselná odpověď",
          }).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </Field>
      {q.type === "number" ? (
        <>
          {Object.entries({
            value: "Správná hodnota",
            tolerance: "Tolerance",
            unit: "Jednotka",
          }).map(([k, l]) => (
            <Input
              key={k}
              label={l}
              type={k === "unit" ? "text" : "number"}
              v={q[k]}
              on={(v: any) => change({ [k]: v })}
            />
          ))}
        </>
      ) : (
        <>
          {q.options.map((o: any, j: number) => (
            <div className="inset" key={o.id}>
              <label>
                <input
                  type={q.type === "many" ? "checkbox" : "radio"}
                  name={"correct-" + q.id}
                  checked={q.correct.includes(o.id)}
                  onChange={(e) =>
                    change({
                      correct:
                        q.type === "many"
                          ? e.target.checked
                            ? [...q.correct, o.id]
                            : q.correct.filter((v: string) => v !== o.id)
                          : [o.id],
                    })
                  }
                />{" "}
                Správná možnost {j + 1}
              </label>
              {q.type === "bool" ? (
                <p>{o.text}</p>
              ) : (
                <>
                  <Input
                    label="Text možnosti"
                    v={o.text}
                    on={(text: string) =>
                      change({ options: replace(q.options, j, { ...o, text }) })
                    }
                  />
                  {o.file && (
                    <img className="mini" src={file(o.file)} alt={o.text} />
                  )}
                  <Upload
                    sid={sid}
                    busy={busy}
                    accept=".jpg,.jpeg,.png,.webp"
                    on={(v: any) =>
                      change({
                        options: replace(q.options, j, { ...o, file: v.id }),
                      })
                    }
                  />
                  <button
                    onClick={() =>
                      change({
                        options: q.options.filter(
                          (_: any, n: number) => n !== j,
                        ),
                        correct: q.correct.filter((v: string) => v !== o.id),
                      })
                    }
                  >
                    Odebrat možnost
                  </button>
                </>
              )}
            </div>
          ))}
          {q.type !== "bool" && (
            <button
              onClick={() =>
                change({ options: [...q.options, { id: uid(), text: "" }] })
              }
            >
              Přidat možnost
            </button>
          )}
        </>
      )}
      <Input
        type="number"
        label="Čas na otázku (3–300 s)"
        v={q.seconds}
        on={(seconds: number) => change({ seconds })}
      />
      <Input
        area
        label="Vysvětlení"
        v={q.explanation}
        on={(explanation: string) => change({ explanation })}
      />
      <div className="actions">{children}</div>
    </section>
  );
}
function Preview({ q }: any) {
  const [phone, set] = useState(true);
  return (
    <div className="inset w-full">
      <button onClick={() => set(!phone)}>
        {phone ? "Přepnout na projektor" : "Přepnout na telefon"}
      </button>
      <div className={"preview " + (phone ? "phone" : "")}>
        <Prompt q={q} />
        {q.type === "number" ? (
          <input placeholder={q.unit} />
        ) : (
          q.options.map((o: any) => (
            <p key={o.id}>
              {o.file && <img className="mini" src={file(o.file)} alt="" />}
              {o.text}
            </p>
          ))
        )}
      </div>
    </div>
  );
}
function Settings({ s, set }: any) {
  const patch = (k: string, v: any) => set({ ...s, [k]: v });
  return (
    <div className="settings">
      {Object.entries({
        mode: ["Řízení hry", { auto: "Automatické", manual: "Moderované" }],
        ranks: [
          "Zobrazení pořadí",
          {
            each: "Po každé otázce",
            interval: "Po každých N otázkách",
            final: "Až ve finále",
            private: "Jen pro učitele",
          },
        ],
        top: ["Počet míst na projektoru", { 3: "3", 5: "5", 10: "10" }],
      }).map(([k, [l, options]]) => (
        <Field key={k} label={String(l)}>
          <select
            value={s[k]}
            onChange={(e) =>
              patch(k, k === "top" ? +e.target.value : e.target.value)
            }
          >
            {Object.entries(options).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
      ))}
      {Object.entries({
        group: "Třída nebo skupina",
        threshold: "Automatický start od počtu hráčů (0 = ručně)",
        seconds: "Společný čas v s (0 = podle otázky)",
        countdown: "Odpočet před otázkou (0–10 s)",
        solution: "Zobrazení řešení (2–60 s)",
        board: "Zobrazení pořadí (2–60 s)",
        interval: "Interval pořadí v otázkách",
      }).map(([k, l]) => (
        <Input
          key={k}
          type={k === "group" ? "text" : "number"}
          label={l}
          v={s[k]}
          on={(v: any) => patch(k, v)}
        />
      ))}
      {Object.entries({
        closeAll: "Uzavřít po odpovědi všech hráčů",
        personal: "Zobrazit hráči vlastní pozici",
        fixed: "Pevných 1 000 bodů (jinak 500–1 000 podle času)",
        shuffle: "Promíchat otázky",
        shuffleOptions: "Promíchat možnosti",
        sound: "Závěrečná znělka",
      }).map(([k, l]) => (
        <label key={k}>
          <input
            type="checkbox"
            checked={s[k]}
            onChange={(e) => patch(k, e.target.checked)}
          />{" "}
          {l}
        </label>
      ))}
    </div>
  );
}
