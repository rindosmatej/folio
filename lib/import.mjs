export function parseImport(text) {
  const questions = [];
  let q,
    line = 0,
    start = 0;
  const err = (msg, at = line) => {
    throw Error("Řádek " + at + ": " + msg);
  };
  function finish() {
    if (!q) return;
    if (!q.text) err("Chybí zadání.", start);
    if (q.type === "bool") {
      q.options = [
        { id: "true", text: "Pravda" },
        { id: "false", text: "Nepravda" },
      ];
      if (!q.correct.length) err("Chybí odpověď.", start);
    } else if (
      q.options.length < 2 ||
      !q.correct.length ||
      (q.type === "one" && q.correct.length !== 1)
    )
      err("Zkontrolujte možnosti a správné odpovědi.", start);
    questions.push(q);
  }
  for (const raw of text.replace(/^\uFEFF/, "").split(/\r\n|\n|\r/)) {
    line++;
    const s = raw.trim();
    if (!s) continue;
    if (s.startsWith("?")) {
      finish();
      start = line;
      q = {
        id: "i-" + line,
        text: s.slice(1).trim(),
        type: "one",
        options: [],
        correct: [],
        media: [],
        seconds: 25,
        explanation: "",
      };
      continue;
    }
    if (!q) err("Začněte otázkou označenou otazníkem.");
    if (/^[+-]/.test(s)) {
      const id = "o" + q.options.length,
        t = s.slice(1).trim();
      if (!t) err("Prázdná možnost.");
      q.options.push({ id, text: t });
      if (s[0] === "+") q.correct.push(id);
    } else if (/^typ:/i.test(s)) {
      const t = s.split(":")[1].trim().toLowerCase();
      if (!["více", "pravda/nepravda", "jedna"].includes(t))
        err("Neznámý typ otázky.");
      q.type = t === "více" ? "many" : t === "jedna" ? "one" : "bool";
    } else if (/^odpověď:/i.test(s)) {
      const v = s
        .slice(s.indexOf(":") + 1)
        .trim()
        .toLowerCase();
      if (!["pravda", "nepravda"].includes(v))
        err("Použijte pravda nebo nepravda.");
      q.correct = [v === "pravda" ? "true" : "false"];
    } else if (/^vysvětlení:/i.test(s))
      q.explanation = s.slice(s.indexOf(":") + 1).trim();
    else err("Neznámý zápis.");
  }
  finish();
  if (!questions.length) err("Soubor neobsahuje otázky.", 1);
  return questions;
}

export function decodeTxt(bytes) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1250").decode(bytes);
  }
}
