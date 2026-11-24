import React, { useState } from "react";
import { api, act, go } from "./api";
const names = { subject: "předmět", area: "oblast", task: "úkol" };
export function RemoveContent({
  kind,
  id,
}: {
  kind: keyof typeof names;
  id: string;
}) {
  const [preview, set] = useState<any>(null),
    [target, select] = useState(""),
    [pending, busy] = useState(false);
  return (
    <section className="remove-content">
      {!preview ? (
        <button
          type="button"
          className="remove-link"
          onClick={act(async () => {
            const p = await api("removal/" + kind + "/" + id);
            select(p.targets[0]?.id || "");
            set(p);
          })}
        >
          Smazat {names[kind]}
        </button>
      ) : (
        <div className="panel stack confirm-remove">
          <h3>
            Smazat {names[kind]} „{preview.title}“?
          </h3>
          {kind === "subject" && (
            <p>
              Počet oblastí: {preview.areaCount}. Počet úkolů:{" "}
              {preview.taskCount}. Budou odebrány z knihovny včetně přímých
              odkazů. Probíhající soutěže a sběr zpětné vazby tohoto předmětu se
              ukončí.
            </p>
          )}
          {kind === "area" && preview.taskCount > 0 && (
            <label>
              Co udělat s úkoly ({preview.taskCount})?
              <select value={target} onChange={(e) => select(e.target.value)}>
                {preview.targets.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    Přesunout do oblasti {a.title}
                  </option>
                ))}
                <option value="">Smazat společně s oblastí</option>
              </select>
            </label>
          )}
          {kind === "task" && (
            <p>Úkol přestane být dostupný i na přímém odkazu.</p>
          )}
          <div className="actions">
            <button
              type="button"
              className="danger"
              disabled={pending}
              onClick={act(async () => {
                busy(true);
                try {
                  const r = await api("remove", {
                    kind,
                    id,
                    stamp: preview.stamp,
                    target,
                    mode: target ? "move" : "cascade",
                  });
                  go(
                    kind === "subject" ? "/ucitel" : "/ucitel/predmet/" + r.sid,
                  );
                } finally {
                  busy(false);
                }
              })}
            >
              Potvrdit smazání
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => set(null)}
            >
              Zrušit
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
