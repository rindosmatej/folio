import {RemoveContent} from "./removal";
import React, { useState } from "react";
import { api, act, useData, go, file } from "./api";
import { Icon, Field, State } from "./ui";
import { icons } from "../lib/icons.mjs";
export function IconPicker({ initial = "book" }: { initial?: string }) {
  return (
    <fieldset className="icon-field">
      <legend>Ikona</legend>
      <div>
        {Object.entries(icons).map(([k, label]) => (
          <label key={k} title={label}>
            <input
              type="radio"
              name="icon"
              value={k}
              defaultChecked={k === initial}
            />
            <span>
              <Icon name={k} />
              {label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
const count = (n: number) =>
  n + " " + (n === 1 ? "úkol" : n >= 2 && n <= 4 ? "úkoly" : "úkolů");
export function AreaLinks({ s, staff = false }: { s: any; staff?: boolean }) {
  return (
    <>
      <h2>Vzdělávací oblasti</h2>
      <div className="areas-grid">
        {s.areas.map((a: any) => (
          <a
            className="area-link"
            key={a.id}
            href={(staff ? "/ucitel/oblast/" : "/oblast/") + a.id}
          >
            <span className="area-icon">
              <Icon name={a.icon} />
            </span>
            <span>
              <strong>{a.title}</strong>
              <small>{count(a.count)}</small>
            </span>
          </a>
        ))}
      </div>
    </>
  );
}
export function AreaEditor({ sid, area }: { sid: string; area?: any }) {
  return (
    <details className="area-editor">
      <summary>{area ? "Upravit oblast" : "Přidat vzdělávací oblast"}</summary>
      <form
        className="panel stack"
        onSubmit={(e) => {
          e.preventDefault();
          const d = Object.fromEntries(new FormData(e.currentTarget));
          act(async () => {
            const r = await api("area", {
              ...d,
              sid,
              id: area?.id,
              version: area?.version,
            });
            go("/ucitel/oblast/" + r.id);
          })();
        }}
      >
        <Field label="Název oblasti">
          <input
            required
            maxLength={100}
            name="title"
            defaultValue={area?.title}
          />
        </Field>
        <IconPicker initial={area?.icon} />
        <button>Uložit oblast</button>
      </form>
    </details>
  );
}
const fold = (s: string) =>
  s
    .toLocaleLowerCase("cs")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
export function AreaPage({
  id,
  staff = false,
}: {
  id: string;
  staff?: boolean;
}) {
  const { data: a, error } = useData("area/" + id + (staff ? "?staff=1" : "")),
    [term, set] = useState("");
  if (!a) return <State error={error} />;
  const rows = a.tasks.filter((t: any) =>
    fold(t.title + " " + t.intro).includes(fold(term.trim())),
  );
  return (
    <section className={staff ? "area-page" : "wrap page area-page"}>
      <a href={(staff ? "/ucitel/predmet/" : "/predmet/") + a.sid}>
        ‹ {a.subject}
      </a>
      <h1>
        <Icon name={a.icon} size={36} />
        {a.title}
      </h1>
      {staff && (
        <>
          <div className="actions">
            <a
              className="btn"
              href={"/ucitel/ukol/novy?sid=" + a.sid + "&area=" + a.id}
            >
              Přidat úkol
            </a>
            <a
              href={
                "/ucitel/ukol/novy?sid=" + a.sid + "&area=" + a.id + "&import=1"
              }
            >
              Importovat úkol z TXT
            </a>
          </div>
          <AreaEditor sid={a.sid} area={a} />
        </>
      )}
      <label className="search area-search">
        <Icon name="search" size={18} />
        <input
          aria-label="Hledat úkol v oblasti"
          placeholder="Hledat úkol v oblasti"
          value={term}
          onChange={(e) => set(e.target.value)}
        />
      </label>
      <p role="status">
        {term ? "Nalezeno: " : ""}
        {count(rows.length)}
      </p>
      <div className="gridCards">
        {rows.map((t: any) => (
          <a
            key={t.id}
            className="subject"
            href={(staff ? "/ucitel/ukol/" : "/ukol/") + t.id}
          >
            {t.cover && <img className="thumb" alt="" src={file(t.cover)} />}
            <div className="cardBody">
              <h3>{t.title}</h3>
              <p>{t.intro}</p>
              {staff && (
                <small>{t.published ? "Publikováno" : "Koncept"}</small>
              )}
            </div>
          </a>
        ))}
      </div>
      {!rows.length && (
        <p>
          {term
            ? "Zkus kratší název nebo jiné slovo."
            : "V této oblasti zatím nejsou žádné úkoly."}
        </p>
      )}
    {staff&&<RemoveContent kind="area" id={id}/>}</section>
  );
}
