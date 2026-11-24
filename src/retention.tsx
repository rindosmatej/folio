import React, { useState } from "react";
import { act, api, useData } from "./api";
import { Field, State } from "./ui";

export function Retention() {
  const [revision, refresh] = useState(0);
  const { data, error } = useData("retention?v=" + revision);
  const [message, notice] = useState("");
  const [busy, wait] = useState(false);
  function submit(work: () => Promise<string>) {
    return act(async () => {
      wait(true);
      try {
        notice(await work());
        refresh((v) => v + 1);
      } finally {
        wait(false);
      }
    });
  }
  if (!data) return <State error={error} />;
  return (
    <>
      <h1>Uchovávání dat</h1>
      <p role="status">{message}</p>
      <form
        key={data.rules.version}
        className="panel stack"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const days = (name: string) =>
            form.get(name) ? Number(form.get(name)) : null;
          submit(async () => {
            await api("retention-save", {
              games: days("games"),
              comments: days("comments"),
              version: data.rules.version,
            });
            return "Pravidla byla uložena.";
          })();
        }}
      >
        <h2>Lhůty školy</h2>
        <p>
          Lhůta běží od ukončení hry nebo uzavření dotazníku. Prázdné pole
          pravidlo vypne. Uložení pravidel zveřejní lhůty na stránce o soukromí.
          Výmaz správce potvrzuje zvlášť.
        </p>
        <Field label="Výsledky kvízů · počet dní">
          <input
            type="number"
            min="1"
            max="36500"
            name="games"
            defaultValue={data.rules.games ?? ""}
          />
        </Field>
        <Field label="Slovní komentáře · počet dní">
          <input
            type="number"
            min="1"
            max="36500"
            name="comments"
            defaultValue={data.rules.comments ?? ""}
          />
        </Field>
        <button disabled={busy}>Uložit pravidla</button>
      </form>
      <section className="panel">
        <h2>Po lhůtě</h2>
        <p>
          Výmaz hry odstraní celý průběh včetně hráčů a odpovědí. U dotazníku se
          odstraní texty komentářů, souhrnné četnosti zůstanou. Přehled zahrnuje
          až 50 her a 50 dotazníků najednou.
        </p>
        {(
          [
            ["games", "Kvízy"],
            ["comments", "Dotazníky s komentáři"],
          ] as const
        ).map(([key, title]) => (
          <div key={key}>
            <h3>
              {title} ({data[key].length})
            </h3>
            {data[key].length > 0 ? (
              <ul>
                {data[key].map((item: any) => (
                  <li key={item.id}>
                    {item.title} ·{" "}
                    {new Date(item.date).toLocaleDateString("cs-CZ")}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Žádné položky k výmazu.</p>
            )}
          </div>
        ))}
        <button
          className="secondary"
          disabled={busy}
          onClick={() => refresh((v) => v + 1)}
        >
          Obnovit náhled
        </button>{" "}
        <button
          disabled={busy || !(data.games.length + data.comments.length)}
          onClick={() => {
            if (
              window.confirm(
                "Trvale odstranit uvedené hry (" +
                  data.games.length +
                  ") a texty komentářů v uvedených dotaznících (" +
                  data.comments.length +
                  ")?",
              )
            )
              submit(async () => {
                await api("retention-purge", { stamp: data.stamp });
                return "Uvedená data byla odstraněna.";
              })();
          }}
        >
          Odstranit uvedená data
        </button>
      </section>
    </>
  );
}
export function PublicRetention() {
  const { data, error } = useData("retention-policy");
  return (
    <section>
      <h2>Lhůty uchování</h2>
      {data ? (
        <>
          <p>
            Výsledky kvízů od ukončení hry:{" "}
            {data.games ? data.games + " dní" : "lhůta zatím nebyla nastavena"}.
          </p>
          <p>
            Slovní komentáře od uzavření dotazníku:{" "}
            {data.comments
              ? data.comments + " dní"
              : "lhůta zatím nebyla nastavena"}
            . Po uplynutí lhůty provádí výmaz správce.
          </p>
        </>
      ) : (
        <State error={error} />
      )}
    </section>
  );
}
