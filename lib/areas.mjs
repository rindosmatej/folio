import { all, one, sql, access, can, key, fail } from "./db.mjs";
import { icons, defaultIcon } from "./icons.mjs";
const info = [
  ["data", "Data a informace", "data"],
  ["algoritmy", "Algoritmizace", "code"],
  ["technologie", "Digitální technologie", "chip"],
  ["systemy", "Informační systémy", "network"],
];
export const subjectIcon = (sid) =>
  one("SELECT icon FROM subject_icons WHERE sid=?", sid)?.icon ||
  defaultIcon(sid);
function validIcon(icon) {
  if (!Object.hasOwn(icons, icon)) fail("Vyberte ikonu z nabídky.");
  return icon;
}
export function setSubjectIcon(sid, icon) {
  if (icon !== undefined)
    sql(
      "INSERT INTO subject_icons VALUES(?,?) ON CONFLICT(sid) DO UPDATE SET icon=excluded.icon",
      sid,
      validIcon(icon),
    );
}
export function defaults(sid) {
  const rows =
    sid === "informatika"
      ? info
      : [
          [
            "obecne",
            { grafika: "Fotografie", kresleni: "Technické kreslení" }[sid] ||
              "Obecné úkoly",
            defaultIcon(sid),
          ],
        ];
  rows.forEach(([suffix, title, icon], pos) =>
    sql(
      "INSERT OR IGNORE INTO areas(id,sid,title,icon,pos) VALUES(?,?,?,?,?)",
      sid + "-" + suffix,
      sid,
      title,
      icon,
      pos,
    ),
  );
}
export function initializeAreas() {
  if (one("SELECT 1 FROM migrations WHERE name='learning-areas-v1'")) return;
  for (const s of all("SELECT id FROM subjects")) defaults(s.id);
  let order = 0;
  for (const t of all("SELECT id,sid FROM tasks ORDER BY rowid")) {
    let area = t.sid + "-obecne";
    if (t.sid === "informatika") {
      if (t.id === "poznej-hardware-pocitace") area = "informatika-technologie";
      else
        sql(
          "INSERT OR IGNORE INTO areas(id,sid,title,icon,pos) VALUES(?,?,'K zařazení','book',4)",
          area,
          t.sid,
        );
    }
    sql("INSERT INTO task_areas VALUES(?,?,?)", t.id, area, ++order);
  }
  sql("INSERT INTO migrations VALUES('learning-areas-v1')");
}
export function areasFor(sid, staff) {
  return all(
    "SELECT a.*, (SELECT count(*) FROM task_areas m JOIN tasks t ON t.id=m.task WHERE m.area=a.id AND (t.published=1 OR ?=1)) count FROM areas a WHERE a.sid=? ORDER BY pos,title",
    staff ? 1 : 0,
    sid,
  );
}
export function saveArea(d, u) {
  access(u, d.sid);
  const title = String(d.title || "").trim();
  if (!title || title.length > 100) fail("Zadejte název oblasti do 100 znaků.");
  const old =
    d.id && one("SELECT * FROM areas WHERE id=? AND sid=?", d.id, d.sid);
  if (d.id && !old) fail("Oblast nenalezena.", 404);
  if (old && old.version !== d.version)
    fail("Oblast byla mezitím změněna.", 409);
  if (
    all("SELECT id,title FROM areas WHERE sid=?", d.sid).some(
      (a) =>
        a.id !== d.id &&
        a.title.toLocaleLowerCase("cs") === title.toLocaleLowerCase("cs"),
    )
  )
    fail("Oblast s tímto názvem již existuje.");
  const id = old?.id || key();
  sql(
    "INSERT INTO areas(id,sid,title,icon,pos) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,icon=excluded.icon,version=version+1",
    id,
    d.sid,
    title,
    validIcon(d.icon || "book"),
    old?.pos ??
      one("SELECT coalesce(max(pos),-1)+1 n FROM areas WHERE sid=?", d.sid).n,
  );
  return { id };
}
export function assignArea(task, sid, selected) {
  const old = one("SELECT area FROM task_areas WHERE task=?", task);
  const area =
    selected ??
    old?.area ??
    one("SELECT id FROM areas WHERE sid=? ORDER BY pos LIMIT 1", sid)?.id;
  if (!area || !one("SELECT id FROM areas WHERE id=? AND sid=?", area, sid))
    fail("Vyberte oblast tohoto předmětu.");
  if (!old)
    sql(
      "INSERT INTO task_areas SELECT ?,?,coalesce(max(created_order),0)+1 FROM task_areas",
      task,
      area,
    );
  else if (old.area !== area)
    sql("UPDATE task_areas SET area=? WHERE task=?", area, task);
}
export function areaDetail(id, u, staff) {
  const a = one(
    "SELECT a.*,s.title subject,s.visible FROM areas a JOIN subjects s ON s.id=a.sid WHERE a.id=?",
    id,
  );
  if (!a || !(staff ? can(u, a.sid) : a.visible))
    fail("Oblast není dostupná.", 404);
  return {
    ...a,
    tasks: all(
      "SELECT t.id,t.published,t.pos,json_extract(t.body,'$.title') title,json_extract(t.body,'$.intro') intro,json_extract(t.body,'$.cover') cover FROM tasks t JOIN task_areas m ON m.task=t.id WHERE m.area=? AND (t.published=1 OR ?=1) ORDER BY t.pos,m.created_order",
      id,
      staff ? 1 : 0,
    ),
  };
}
