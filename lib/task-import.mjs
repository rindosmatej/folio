export const sampleTask = `Název: Co prozradí data o třídě?
Oblast: Data a informace
Úvod: Zpracuj anonymní tabulku a zjisti, jak spolužáci cestují do školy.

Text:
# Postup
1. Stáhni si tabulku.
2. Spočítej četnosti jednotlivých způsobů dopravy.
3. Vytvoř sloupcový graf.

Soubor: Tabulka pro zpracování
Text:
Napiš dvě věty o tom, co lze z grafu vyčíst.
Obrázek: Ukázka výsledného grafu
Odkaz: Nápověda k tabulkám | https://help.libreoffice.org/`;
export function parseTaskTxt(raw) {
  const lines = raw.replace(/^\uFEFF/, "").split(/\r\n|\n|\r/);
  const body = { title: "", intro: "", blocks: [] };
  let area = "",
    field = "",
    buffer = [],
    start = 1;
  const seen = new Set();
  const err = (n, m) => {
    throw Error("Řádek " + n + " · " + m);
  };
  function finish() {
    const text = buffer.join("\n").trim();
    buffer = [];
    if (!field) return;
    if (!text) err(start, "Doplň obsah pole " + field + ".");
    if (["název", "oblast", "úvod"].includes(field) && seen.has(field))
      err(start, "Pole " + field + " je uvedeno dvakrát.");
    seen.add(field);
    if (field === "název") {
      if (text.length > 240 || text.includes("\n"))
        err(start, "Název musí být na jednom řádku a mít nejvýše 240 znaků.");
      body.title = text;
    } else if (field === "oblast") area = text;
    else if (field === "úvod") body.intro = text;
    else if (field === "text") body.blocks.push({ kind: "text", text });
    else if (field === "soubor")
      body.blocks.push({ kind: "file", label: text, file: "" });
    else if (field === "obrázek")
      body.blocks.push({ kind: "image", caption: text, alt: text, file: "" });
    else {
      const split = text.indexOf("|"),
        label = text.slice(0, split).trim(),
        url = text.slice(split + 1).trim();
      if (
        split < 1 ||
        !label ||
        !/^https?:\/\//i.test(url) ||
        !URL.canParse(url)
      )
        err(start, "Použij Odkaz: název | https://adresa");
      body.blocks.push({ kind: "link", label, url });
    }
  }
  lines.forEach((line, i) => {
    const m = /^(Název|Oblast|Úvod|Text|Soubor|Obrázek|Odkaz):\s*(.*)$/i.exec(
      line.trimStart(),
    );
    if (m) {
      finish();
      field = m[1].toLocaleLowerCase("cs");
      start = i + 1;
      buffer = [m[2]];
    } else if (field) buffer.push(line);
    else if (line.trim()) err(i + 1, "Začni řádkem Název: …");
  });
  finish();
  if (!body.title) err(1, "Chybí název úkolu.");
  if (!body.blocks.length)
    err(lines.length, "Přidej blok Text, Soubor, Obrázek nebo Odkaz.");
  return { body, area };
}
