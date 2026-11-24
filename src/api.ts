import { useEffect, useState } from "react";
export async function api(path: string, data?: any, token?: string) {
  const r = await fetch("/api/" + path, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      ...(data !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const v = await r.json().catch(()=>null);
  if (!r.ok) throw Error(v?.error || `Požadavek selhal (HTTP ${r.status}).`);
  return v;
}
export function useData(path: string, interval = 0, token?: string) {
  const [data, set] = useState<any>(null),
    [error, err] = useState("");
  useEffect(() => {
    let live = true,
      busy = false;
    set(null);
    err("");
    async function load() {
      if (busy) return;
      busy = true;
      try {
        const v = await api(path, undefined, token);
        if (live) {
          set(v);
          err("");
        }
      } catch (e) {
        if (live) {
          err(String((e as Error).message));
          set(null);
        }
      } finally {
        busy = false;
      }
    }
    load();
    const timer = interval ? setInterval(load, interval) : undefined;
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [path, interval, token]);
  return { data, error };
}
export const file = (id: string, run = "") =>
  "/soubor/" +
  encodeURIComponent(id) +
  (run ? "?run=" + encodeURIComponent(run) : "");
export function act(fn: () => any) {
  return async () => {
    try {
      await fn();
    } catch (e) {
      window.dispatchEvent(
        new CustomEvent("folio-error", {
          detail:
            (e as any).name === "ZodError"
              ? "Zkontrolujte vyplnění pole " +
                (e as any).issues[0].path.join(".") +
                "."
              : (e as Error).message,
        }),
      );
    }
  };
}
export const go = (p: string) => location.assign(p);
export const uid = () =>
  globalThis.crypto.randomUUID?.() ||
  Array.from(crypto.getRandomValues(new Uint32Array(4))).join("-");
export const subjectCover=(cover:string)=>cover.startsWith('file:')?file(cover.slice(5)):'/motiv/'+encodeURIComponent(cover);
