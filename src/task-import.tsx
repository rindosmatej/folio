import React, { useState } from "react";
import { act } from "./api";
import { sampleTask, parseTaskTxt } from "../lib/task-import.mjs";
import { decodeTxt } from "../lib/import.mjs";
import { Field, TaskBody } from "./ui";
export function TaskImport({
  areas,
  apply,
}: {
  areas: any[];
  apply: (b: any, area?: string) => void;
}) {
  const [txt, set] = useState("");
  let parsed: any,
    error = "";
  try {
    if (txt.trim()) parsed = parseTaskTxt(txt);
  } catch (e) {
    error = (e as Error).message;
  }
  const match =
    parsed?.area &&
    areas.find(
      (a) =>
        a.title.localeCompare(parsed.area, "cs", { sensitivity: "base" }) === 0,
    );
  return (
    <section className="panel stack">
      <h2>Import úkolu z TXT</h2>
      <p>
        Vlož zadání nebo načti TXT. Řádky „Soubor:“ a „Obrázek:“ připraví v
        editoru místo pro přílohu.
      </p>
      <div className="actions">
        <button onClick={() => set(sampleTask)}>Vyzkoušet vzor</button>
        <a
          download="vzor-ukolu.txt"
          href={
            "data:text/plain;charset=utf-8," +
            encodeURIComponent("\uFEFF" + sampleTask)
          }
        >
          Stáhnout vzor TXT
        </a>
      </div>
      <Field label="Soubor TXT">
        <input
          type="file"
          accept=".txt,text/plain"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f)
              act(async () => {
                if (f.size > 2 * 1024 * 1024)
                  throw Error("TXT může mít nejvýše 2 MB.");
                set(decodeTxt(await f.arrayBuffer()));
              })();
          }}
        />
      </Field>
      <Field label="Text úkolu">
        <textarea
          rows={9}
          value={txt}
          placeholder={"Název: …\nÚvod: …\nText: …\nSoubor: …"}
          onChange={(e) => set(e.target.value)}
        />
      </Field>
      {error && <p role="alert">{error}</p>}
      {parsed && (
        <>
          <h3>Náhled importu</h3>
          <p>
            {parsed.body.blocks.length} bloků · přílohy k doplnění:{" "}
            {
              parsed.body.blocks.filter((b: any) =>
                ["image", "file"].includes(b.kind),
              ).length
            }
          </p>
          {parsed.area && (
            <p>
              {match
                ? "Oblast: " + match.title
                : "Oblast „" +
                  parsed.area +
                  "“ v předmětu není. Před uložením ji vyber v editoru."}
            </p>
          )}
          <TaskBody preview t={{ body: parsed.body }} />
          <button onClick={() => apply(parsed.body, match?.id)}>
            Přenést do editoru
          </button>
        </>
      )}
    </section>
  );
}
