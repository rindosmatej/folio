import React, { useState, useRef } from "react";
import { api, act, useData, go, uid } from "./api";
import { Field, State, Icon } from "./ui";
import { AnswerPie } from "./answer-pie";
const root = "/ucitel/vazba";
const status: Record<string, string> = {
  draft: "Koncept",
  open: "Sběr otevřen",
  closed: "Ukončeno",
};
const types: Record<string, string> = {
  one: "Jedna možnost",
  many: "Více možností",
  scale: "Škála 1–5",
  text: "Slovní odpověď",
};
type Question = {
  id: string;
  title: string;
  type: string;
  options: string[];
  required: boolean;
};
const bank = [
  {
    title: "Jak dobře rozumíš dnešnímu tématu?",
    type: "scale",
    options: [],
    required: true,
  },
  {
    title: "Jaké bylo tempo hodiny?",
    type: "one",
    options: ["Příliš pomalé", "Vyhovovalo mi", "Příliš rychlé"],
    required: true,
  },
  {
    title: "Co ti pomohlo učivu porozumět?",
    type: "many",
    options: [
      "Výklad",
      "Názorná ukázka",
      "Samostatná práce",
      "Práce ve skupině",
    ],
    required: false,
  },
  {
    title: "Co by se příště mohlo změnit?",
    type: "text",
    options: [],
    required: false,
  },
  {
    title: "Kterým tématům se chceš ještě věnovat?",
    type: "text",
    options: [],
    required: false,
  },
];
function fromBank(i: number): Question {
  return { ...structuredClone(bank[i]), id: uid() };
}
export function FeedbackSpace({ id }: { id?: string }) {
  if (!id) return <FeedbackList />;
  if (id === "novy") return <Editor />;
  return <FeedbackDetail id={id} />;
}
function FeedbackList() {
  const { data, error } = useData("feedback", 5000);
  return (
    <>
      <div className="heading">
        <h1>Zpětná vazba</h1>
        <a className="btn" href={root + "/novy"}>
          Nový dotazník
        </a>
      </div>
      {!data ? (
        <State error={error} />
      ) : data.length ? (
        data.map((f: any) => (
          <a key={f.id} className="row feedback-row" href={root + "/" + f.id}>
            <span>
              <strong>{f.title}</strong>
              <small>{f.subject}</small>
            </span>
            <span>
              {status[f.status]} · odevzdáno {f.responses}
            </span>
          </a>
        ))
      ) : (
        <div className="panel">
          <h2>Zatím tu není žádný dotazník</h2>
          <p>
            Pro první hodinu můžete použít připravené otázky k tempu a
            porozumění učivu.
          </p>
        </div>
      )}
    </>
  );
}
function Editor({ f }: { f?: any }) {
  const { data: subs, error } = useData("catalog?staff=1"),
    [title, setTitle] = useState(f?.title || "Ohlédnutí za hodinou"),
    [sid, setSid] = useState(f?.sid || ""),
    [qs, set] = useState<Question[]>(
      () => f?.questions || [0, 1, 2, 3].map(fromBank),
    ),
    [busy, wait] = useState(false);
  const change = (i: number, p: Partial<Question>) =>
    set(qs.map((q, j) => (j === i ? { ...q, ...p } : q)));
  if (!subs) return <State error={error} />;
  return (
    <>
      <a href={root}>‹ Zpětná vazba</a>
      <h1>{f ? "Upravit koncept" : "Nový dotazník"}</h1>
      <form
        className="stack feedback-editor"
        onSubmit={(e) => {
          e.preventDefault();
          if (busy) return;
          act(async () => {
            wait(true);
            try {
              const r = await api("feedback", {
                id: f?.id,
                version: f?.version,
                sid: sid || subs[0]?.id,
                title,
                questions: qs,
              });
              go(root + "/" + r.id);
            } finally {
              wait(false);
            }
          })();
        }}
      >
        <div className="panel stack">
          <Field label="Název dotazníku">
            <input
              required
              value={title}
              maxLength={160}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label="Předmět">
            <select
              required
              value={sid || subs[0]?.id || ""}
              onChange={(e) => setSid(e.target.value)}
            >
              {subs.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {qs.map((q, i) => (
          <section key={q.id} className="panel stack">
            <h3>Otázka {i + 1}</h3>
            <Field label="Znění otázky">
              <input
                required
                maxLength={160}
                value={q.title}
                onChange={(e) => change(i, { title: e.target.value })}
              />
            </Field>
            <Field label="Typ odpovědi">
              <select
                value={q.type}
                onChange={(e) =>
                  change(i, {
                    type: e.target.value,
                    options: q.options.length ? q.options : ["Ano", "Ne"],
                  })
                }
              >
                {Object.entries(types).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            {["one", "many"].includes(q.type) && (
              <Field label="Možnosti odpovědi (každá na vlastním řádku)">
                <textarea
                  required
                  value={q.options.join("\n")}
                  onChange={(e) =>
                    change(i, { options: e.target.value.split("\n") })
                  }
                />
              </Field>
            )}
            {q.type === "scale" && <p>1 = nejméně · 5 = nejvíce</p>}
            <label>
              <input
                type="checkbox"
                checked={q.required}
                onChange={(e) => change(i, { required: e.target.checked })}
              />{" "}
              Povinná otázka
            </label>
            <div className="actions">
              <button
                type="button"
                disabled={!i}
                onClick={() => {
                  const a = [...qs];
                  [a[i - 1], a[i]] = [a[i], a[i - 1]];
                  set(a);
                }}
              >
                Posunout výš
              </button>
              <button
                type="button"
                onClick={() => set(qs.filter((x) => x.id !== q.id))}
              >
                Odebrat otázku
              </button>
            </div>
          </section>
        ))}
        <Field label="Přidat otázku">
          <select
            value=""
            disabled={qs.length >= 20}
            onChange={(e) => {
              if (e.target.value)
                set([
                  ...qs,
                  e.target.value === "custom"
                    ? {
                        id: uid(),
                        title: "",
                        type: "one",
                        options: ["Ano", "Ne"],
                        required: true,
                      }
                    : fromBank(+e.target.value),
                ]);
            }}
          >
            <option value="">
              Vyberte otázku ze vzoru nebo přidejte vlastní
            </option>
            <option value="custom">Vlastní otázka</option>
            {bank.map((x, i) => (
              <option key={i} value={i}>
                {x.title}
              </option>
            ))}
          </select>
        </Field>
        <button disabled={busy || !qs.length || !subs.length}>
          Uložit koncept
        </button>
      </form>
    </>
  );
}
function FeedbackDetail({ id }: { id: string }) {
  const {data:config}=useData("config");
  const { data: f, error } = useData("feedback/" + id, 3500),
    [edit, setEdit] = useState(false),
    [copied, copy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  if (!f) return <State error={error} />;
  if (edit && f.status === "draft") return <Editor f={f} />;
  const url = (config?.publicOrigin || location.origin) + "/zpetna-vazba/" + f.share;
  const transition = (status: string) =>
    act(async () => {
      if (
        status === "closed" &&
        !confirm("Ukončit sběr odpovědí? Výsledky zůstanou dostupné.")
      )
        return;
      await api("feedback-status", { id, version: f.version, status });
      location.reload();
    });
  return (
    <>
      <a href={root}>‹ Zpětná vazba</a>
      <h1>{f.title}</h1>
      <p>
        {status[f.status]} · počet odevzdaných dotazníků: <b>{f.responses}</b>
      </p>
      {f.status === "draft" ? (
        <>
          <div className="actions">
            <button onClick={transition("open")}>
              Otevřít sběr a vytvořit QR
            </button>
            <button onClick={() => setEdit(true)}>Upravit otázky</button>
          </div>
          <h2>Otázky v dotazníku</h2>
          {f.questions.map((q: Question, i: number) => (
            <div className="row" key={q.id}>
              <strong>
                {i + 1}. {q.title}
              </strong>
              <span>{types[q.type]}</span>
            </div>
          ))}
        </>
      ) : (
        <>
          {f.status === "open" && (
            <section className="panel feedback-share">
              <img src={"/api/feedback-qr/" + id} alt="QR kód dotazníku" />
              <div>
                <h2>Sdílet se třídou</h2>
                <a href={url}>{url}</a>
                <div className="actions">
                  <button onClick={() => dialog.current?.showModal()}>
                    Promítnout QR
                  </button>
                  <button
                    onClick={act(async () => {
                      await navigator.clipboard.writeText(url);
                      copy(true);
                    })}
                  >
                    {copied ? "Zkopírováno" : "Kopírovat odkaz"}
                  </button>
                  <button onClick={transition("closed")}>Ukončit sběr</button>
                </div>
              </div>
              <dialog className="feedback-projection" ref={dialog}>
                <h2>{f.title}</h2>
                <img
                  src={"/api/feedback-qr/" + id}
                  alt="Naskenuj pro vyplnění dotazníku"
                />
                <button onClick={() => dialog.current?.close()}>
                  Zavřít projekci
                </button>
              </dialog>
            </section>
          )}
          <h2>Vyhodnocení</h2>
          {!f.responses ? (
            <p>Zatím nikdo neodpověděl.</p>
          ) : (
            f.questions.map((q: Question, i: number) => {
              const r = f.results[i];
              return (
                <section key={q.id} className="panel feedback-result">
                  <h3>
                    {i + 1}. {q.title}
                  </h3>
                  <p>
                    Odpovědělo {r.answered} z {f.responses}
                    {q.type === "scale" && r.answered
                      ? " · průměr " +
                        (
                          r.rows.reduce(
                            (sum: number, v: any) =>
                              sum + Number(v.label) * v.count,
                            0,
                          ) / r.answered
                        ).toLocaleString("cs-CZ", {
                          maximumFractionDigits: 1,
                        }) +
                        " z 5"
                      : ""}
                  </p>
                  {q.type === "text" && f.comments_removed ? <p>Texty komentářů byly odstraněny podle pravidel uchovávání.</p> : !r.answered ? (
                    <p>Bez odpovědi.</p>
                  ) : q.type === "text" ? (
                    r.rows.map((v: any, j: number) => (
                      <blockquote key={j}>
                        {v.label}{v.count > 1 && <small> · {v.count}×</small>}
                      </blockquote>
                    ))
                  ) : (
                    <AnswerPie rows={r.rows} multiple={q.type === "many"} />
                  )}
                </section>
              );
            })
          )}
        </>
      )}
    </>
  );
}
function receiptFor(share: string) {
  const k = "folio-feedback-" + share;
  try {
    let n = localStorage.getItem(k);
    if (n) return n;
    n = uid();
    localStorage.setItem(k, n);
    return n;
  } catch {
    return uid();
  }
}
export function Respond({ share }: { share: string }) {
  const { data: f, error } = useData("survey/" + share),
    [answers, set] = useState<Record<string, any>>({}),
    [done, complete] = useState(() => {
      try {
        return localStorage.getItem("folio-feedback-done-" + share) === "1";
      } catch {
        return false;
      }
    }),
    [busy, wait] = useState(false),
    [receipt] = useState(() => receiptFor(share));
  const update = (id: string, v: any) => set((old) => ({ ...old, [id]: v }));
  return (
    <main className="wrap page narrow feedback-form">
      {done ? (
        <>
          <h1>Děkujeme za zpětnou vazbu</h1>
          <p>Tvoje odpovědi byly přijaty.</p>
        </>
      ) : !f ? (
        <State error={error} />
      ) : f.status === "closed" ? (
        <>
          <h1>{f.title}</h1>
          <p>Sběr odpovědí už skončil.</p>
        </>
      ) : (
        <>
          <div className="kicker">ANONYMNÍ ZPĚTNÁ VAZBA</div>
          <h1>{f.title}</h1>
          <p>
            Učitel uvidí souhrn voleb a anonymní komentáře. Do komentářů nepiš
            své jméno.
          </p>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (busy) return;
              act(async () => {
                wait(true);
                try {
                  await api("respond/" + share, { answers, receipt });
                  try {
                    localStorage.setItem("folio-feedback-done-" + share, "1");
                  } catch {}
                  complete(true);
                } finally {
                  wait(false);
                }
              })();
            }}
          >
            {f.questions.map((q: Question, i: number) => (
              <fieldset className="panel" key={q.id}>
                <legend>
                  {i + 1}. {q.title}
                  {!q.required && <small> · nepovinné</small>}
                </legend>
                {q.type === "text" ? (
                  <textarea
                    aria-label={q.title}
                    maxLength={1200}
                    required={q.required}
                    onChange={(e) => update(q.id, e.target.value)}
                  />
                ) : (
                  <>
                    {q.type === "scale" && <p>1 = nejméně · 5 = nejvíce</p>}
                    <div
                      className={
                        q.type === "scale"
                          ? "feedback-scale"
                          : "feedback-choices"
                      }
                    >
                      {(q.type === "scale"
                        ? ["1", "2", "3", "4", "5"]
                        : q.options
                      ).map((o, j) => (
                        <label key={j}>
                          <input
                            type={q.type === "many" ? "checkbox" : "radio"}
                            name={q.id}
                            required={q.required && q.type !== "many"}
                            checked={(answers[q.id] || []).includes(j)}
                            onChange={(e) =>
                              update(
                                q.id,
                                q.type === "many"
                                  ? e.target.checked
                                    ? [...(answers[q.id] || []), j]
                                    : (answers[q.id] || []).filter(
                                        (x: number) => x !== j,
                                      )
                                  : [j],
                              )
                            }
                          />
                          <span>{o}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </fieldset>
            ))}
            <button disabled={busy}>
              {busy ? "Odesílání…" : "Odeslat anonymně"}
            </button>
          </form>
        </>
      )}
    </main>
  );
}
