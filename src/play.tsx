import {FrequencyChart} from "./frequency-chart";
import React, { useState, useEffect, useRef } from "react";
import { api, act, useData, go, file } from "./api";
import { Field, State, Prompt, Icon } from "./ui";
import { Avatar, Ranks, Podium, Score } from "./characters";
import { avatars, defaultAvatar } from "../lib/avatars.mjs";
export function Join({ pin: initial }: { pin?: string }) {
  const [pin, set] = useState(initial || ""),
    [name, n] = useState(""),
    [avatar, choose] = useState(
      () =>
        avatars.find((a) => a.id === localStorage.getItem("folio-avatar"))
          ?.id || defaultAvatar,
    );
  return (
    <main className="quiz-join">
      <div className="join-shell">
        <div className="join-head">
          <Avatar id={avatar} />
          <div className="kicker">ŽIVÝ KVÍZ</div>
          <h1>Připojit se ke kvízu</h1>
        </div>
        <form
          className="panel stack"
          onSubmit={(e) => {
            e.preventDefault();
            act(async () => {
              const r = await api("join", { pin, name, avatar });
              localStorage.setItem("folio-avatar", avatar);
              localStorage.setItem("folio-player-" + r.id, r.token);
              go("/hra/" + r.id);
            })();
          }}
        >
          <Field label="Šestimístný PIN">
            <input
              required
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={pin}
              onChange={(e) => set(e.target.value)}
            />
          </Field>
          <Field label="Přezdívka">
            <input
              maxLength={40}
              required
              value={name}
              onChange={(e) => n(e.target.value)}
            />
          </Field>
          <fieldset className="avatar-field">
            <legend>Vyber si avatara</legend>
            <div className="avatar-picker">
              {avatars.map((a) => (
                <label key={a.id}>
                  <input
                    type="radio"
                    name="avatar"
                    checked={avatar === a.id}
                    onChange={() => choose(a.id)}
                  />
                  <span>
                    <Avatar id={a.id} />
                    <b>{a.name}</b>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <button>Připojit se</button>
        </form>
      </div>
    </main>
  );
}
export function Game({ id, role }: { id: string; role: string }) {
  const {data:config}=useData("config");
  const host = role === "moderator",
    phone = role === "hra",
    token = phone
      ? localStorage.getItem("folio-player-" + id) || undefined
      : undefined;
  const { data: g, error } = useData(
    "game/" + id + (host ? "?staff=1" : ""),
    650,
    token,
  );
  const [sel, setSel] = useState<string[]>([]),
    [value, setValue] = useState(""),
    [sent, sentAt] = useState(-1),
    [volume, vol] = useState(1),
    [copied, copy] = useState(false),
    [revealed, reveal] = useState(0);
  const [clock, tick] = useState(Date.now()),
    drift = useRef(0),
    played = useRef(false),
    audioCtx = useRef<AudioContext | null>(null);
  useEffect(() => {
    if (g) drift.current = g.serverTime - Date.now();
  }, [g?.serverTime]);
  useEffect(() => {
    const i = setInterval(() => tick(Date.now()), 200);
    return () => clearInterval(i);
  }, []);
  useEffect(() => {
    setSel([]);
    setValue("");
  }, [g?.idx]);
  useEffect(() => {
    if (g?.phase === "final") {
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        reveal(3);
        return;
      }
      let c = 0;
      reveal(0);
      const i = setInterval(() => {
        reveal(++c);
        if (c >= 3) clearInterval(i);
      }, 700);
      return () => clearInterval(i);
    }
  }, [g?.phase]);
  const playTone = () => {
    if (played.current || !volume || !g.volume || !g.sound) return;
    try {
      const ctx = audioCtx.current || new AudioContext();
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      [392, 494, 587].forEach((f, i) => {
        const o = ctx.createOscillator(),
          v = ctx.createGain();
        o.connect(v);
        v.connect(ctx.destination);
        o.frequency.value = f;
        v.gain.value = 0.06 * volume * g.volume;
        o.start(ctx.currentTime + i * 0.17);
        o.stop(ctx.currentTime + 0.16 + i * 0.17);
      });
      played.current = true;
    } catch {}
  };
  useEffect(() => {
    if (g?.phase === "final" && !phone && audioCtx.current?.state === "running")
      playTone();
  }, [g?.phase]);
  const enableSound = () => {
    if (!audioCtx.current) audioCtx.current = new AudioContext();
    audioCtx.current.resume().catch(() => {});
  };
  if (!g)
    return (
      <main className="game">
        <State error={error} />
        <a href="/">Knihovna</a>
      </main>
    );
  const q = g.question,
    sec =
      g.deadline === null
        ? null
        : Math.max(0, Math.ceil((g.deadline - clock - drift.current) / 1000)),
    accepted = g.accepted || sent === g.idx;
  const answer = async (v: any) => {
    await api("answer/" + id, { idx: g.idx, value: v }, token);
    sentAt(g.idx);
  };
  const cmd = (action: string) =>
    act(async () => {
      if (
        action === "end" &&
        !confirm("Opravdu ukončit soutěž a uložit výsledky?")
      )
        return;
      await api("command/" + id, { action, version: g.version });
    });
  return (
    <main
      className={
        "game quiz-live phase-" +
        g.phase +
        " " +
        (role === "projekce" ? "project" : "")
      }
    >
      <div className="wrap">
        <div className="bar">
          <a className="gameLogo" href={host ? "/ucitel" : "/"}>
            Folio
          </a>
          <span className="live-group">{g.group || "Živá soutěž"}</span>
          {g.player && (
            <span className="self-chip">
              <Avatar id={g.player.avatar} />
              {g.player.name}
            </span>
          )}
          {!phone && (
            <button
              onClick={() => {
                enableSound();
                return document.fullscreenElement
                  ? document.exitFullscreen()
                  : document.documentElement.requestFullscreen();
              }}
            >
              Celá obrazovka
            </button>
          )}
        </div>
        <h1>{g.title}</h1>
        {g.phase === "lobby" ? (
          <>
            <h2>Lobby</h2>
            <p>PIN pro připojení</p>
            <div className="pin">{g.pin}</div>
            {!phone && (
              <>
                <img
                  className="qr"
                  src={host ? "/api/qr/" + id : "/api/projectqr/" + id}
                  alt="QR kód pro připojení"
                />
                <div className="actions">
                  <button
                    onClick={act(async () => {
                      const link = (config?.publicOrigin || location.origin) + "/pripojit/" + g.pin;
                      if (navigator.clipboard) {
                        await navigator.clipboard.writeText(link);
                        copy(true);
                      } else window.prompt("Zkopírujte odkaz pro žáky", link);
                    })}
                  >
                    {copied ? "Odkaz zkopírován" : "Kopírovat odkaz"}
                  </button>
                  {host && (
                    <a className="btn" href={(config?.publicOrigin || location.origin) + "/projekce/" + id} target="_blank">
                      Otevřít projekci
                    </a>
                  )}
                </div>
              </>
            )}
            <h3>
              {phone ? "Jsi v lobby · " : ""}Připojení hráči ({g.count})
            </h3>
            <div className="chips">
              {g.players.map((p: any) => (
                <span key={p.name}>
                  <Avatar id={p.avatar} />
                  {p.name}
                </span>
              ))}
            </div>
          </>
        ) : g.phase === "countdown" ? (
          <>
            <h2>Připrav se na otázku {g.idx + 1}</h2>
            <div className="pin">{sec ?? "Ⅱ"}</div>
          </>
        ) : g.phase === "final" ? (
          <>
            <div className="kicker">VÝSLEDKY</div>
            <h2>{g.early ? "Soutěž předčasně ukončena" : "Soutěž skončila"}</h2>
            {g.ranks && (
              <>
                <Podium rows={g.ranks} revealed={revealed} />
                {!host &&
                  revealed >= Math.min(3, g.ranks.length) &&
                  g.ranks.length > 3 && (
                    <Ranks
                      rows={g.ranks.slice(3)}
                      start={4}
                      own={g.rank ? g.player?.name : undefined}
                    />
                  )}
                <p>
                  Při shodě bodů rozhoduje dřívější připojení, poté
                  identifikátor hráče.
                </p>
              </>
            )}
            {!phone && g.sound && (
              <button onClick={playTone}>Přehrát znělku</button>
            )}
            {host && (
              <>
                <p>
                  {new Date(g.started).toLocaleString("cs-CZ")} ·{" "}
                  {g.group || "Bez označení třídy"}
                </p>
                <h3>Výsledky hráčů ({g.count})</h3>
                <Ranks
                  rows={g.ranks}
                  own={g.rank ? g.player?.name : undefined}
                />
                <h3>Souhrn otázek</h3>
                {g.history.map((h: any, i: number) => (
                  <details key={i}>
                    <summary>
                      {h.text} · {h.skipped?"nepoložená otázka":"odpovědělo "+h.frequencies.answered+" z "+h.frequencies.players}
                    </summary>
                    {!h.skipped&&<FrequencyChart data={h.frequencies}/>}
                  </details>
                ))}
                <a href="/ucitel">Moje předměty</a>
              </>
            )}
          </>
        ) : g.phase === "board" ? (
          <>
            <h2>Průběžné pořadí</h2>
            <Ranks rows={g.ranks} own={g.rank ? g.player?.name : undefined} />
          </>
        ) : (
          <>
            <div className="eyebrow">
              OTÁZKA {g.idx + 1} / {g.total}
            </div>
            <Prompt q={q} run={id} volume={phone ? 1 : g.volume * volume} />
            {g.phase === "question" ? (
              <>
                <p>
                  {g.responses} / {g.count} odpovědí
                </p>
                {phone && accepted ? (
                  <p role="status">Odpověď přijata. Počkej na vyhodnocení.</p>
                ) : q.type === "number" ? (
                  <>
                    {phone && (
                      <Field label={"Číselná odpověď " + q.unit}>
                        <input
                          inputMode="decimal"
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                        />
                      </Field>
                    )}
                    {phone && (
                      <button
                        disabled={g.paused || !value.trim()}
                        onClick={act(() => answer(value))}
                      >
                        Hotovo
                      </button>
                    )}
                  </>
                ) : (
                  <div className="options">
                    {q.options.map((o: any, i: number) => (
                      <button
                        key={o.id}
                        className={
                          "answer-tile tone-" +
                          (i % 4) +
                          (sel.includes(o.id) ? " chosen" : "")
                        }
                        aria-pressed={
                          q.type === "many" && phone
                            ? sel.includes(o.id)
                            : undefined
                        }
                        disabled={!phone || g.paused}
                        onClick={
                          q.type === "many"
                            ? () =>
                                setSel(
                                  sel.includes(o.id)
                                    ? sel.filter((x) => x !== o.id)
                                    : [...sel, o.id],
                                )
                            : act(() => answer([o.id]))
                        }
                      >
                        <span aria-hidden="true" className="answer-symbol">
                          {["▲", "●", "◆", "■"][i % 4]}
                        </span>
                        {o.file && <img src={file(o.file, id)} alt={o.text} />}{" "}
                        <strong>{o.text}</strong>
                        {sel.includes(o.id) && (
                          <span className="answer-check">✓</span>
                        )}
                      </button>
                    ))}
                    {phone && q.type === "many" && (
                      <button
                        disabled={!sel.length || g.paused}
                        onClick={act(() => answer(sel))}
                      >
                        Hotovo
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <h3>Správná odpověď</h3>
                <p>{g.solution}</p>
                {g.correctOptions
                  ?.filter((o: any) => o.file)
                  .map((o: any) => (
                    <img
                      className="mini"
                      key={o.id}
                      src={file(o.file, id)}
                      alt={o.text || "Správná obrázková možnost"}
                    />
                  ))}
                <p>{g.explanation}</p>
                {g.points !== undefined && <b>Získáváš {g.points} bodů.</b>}
                <FrequencyChart data={g.frequencies}/>
              </>
            )}
          </>
        )}
        {host && g.phase !== "lobby" && g.phase !== "final" && (
          <a href={(config?.publicOrigin || location.origin) + "/projekce/" + id} target="_blank">
            Otevřít projekci
          </a>
        )}
        {g.rank && (
          <aside className="personal-rank">
            <Avatar id={g.player.avatar} />
            <div>
              <small>Tvoje pořadí</small>
              <strong>{g.rank}. místo</strong>
            </div>
            <Score value={g.totalPoints} />
          </aside>
        )}
        {g.paused ? (
          <h3>Hra je pozastavena</h3>
        ) : (
          sec !== null &&
          g.phase !== "countdown" && (
            <div className="timer">
              {g.phase === "question" ? "Zbývá" : "Pokračování za"} {sec} s
            </div>
          )
        )}
        {!phone && (
          <Field label="Hlasitost projekce">
            <input
              type="range"
              min="0"
              max="1"
              step=".05"
              value={host ? g.volume : volume}
              onChange={(e) => {
                enableSound();
                const v = +e.target.value;
                if (host)
                  act(() =>
                    api("command/" + id, { action: "volume", volume: v }),
                  )();
                else vol(v);
              }}
            />
          </Field>
        )}
        {host && g.phase !== "final" && (
          <div className="actions">
            <button disabled={g.paused || !g.count} onClick={cmd("next")}>
              {g.phase === "lobby"
                ? "Zahájit soutěž"
                : g.phase === "question"
                  ? "Uzavřít otázku"
                  : "Další krok"}
            </button>
            {g.phase !== "lobby" && (
              <button onClick={cmd(g.paused ? "resume" : "pause")}>
                {g.paused ? "Pokračovat" : "Pozastavit"}
              </button>
            )}
            <button onClick={cmd("end")}>Ukončit soutěž</button>
          </div>
        )}
      </div>
    </main>
  );
}
