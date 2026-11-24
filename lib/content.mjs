import {areasFor,subjectIcon,setSubjectIcon,defaults,assignArea} from "./areas.mjs";
import { z } from "zod";
import {
  one,
  all,
  sql,

  can,
  access,
  visible,
  published,
  unpack,
  key,
  fail,
  admin,
  tx,
} from "./db.mjs";
import { quiz, task } from "./schema.mjs";
import { sync, publicRun, moderates } from "./game.mjs";
import spec from "../seed/index.json";
import sizes from "../seed/sizes.json";
export {spec};
export function seed() {
  if (one("SELECT 1 FROM migrations WHERE name='seed-v1'")) return;
  tx(() => {
    for (const [i, s] of spec.subjects.entries())
      sql(
        "INSERT INTO subjects VALUES(?,?,?,?,?,1,?,1)",
        s.id,
        s.title,
        s.description,
        s.theme,
        s.cover,
        i,
      );
    for (const f of spec.files) {

      sql(
        "INSERT INTO files VALUES(?,?,?,?,?)",
        f.id,
        f.sid,
        f.name,
        f.type,
        sizes[f.path],
      );
    }
    const q = spec.quiz;
    sql(
      "INSERT INTO quizzes VALUES(?,?,?,?,1)",
      q.id,
      q.sid,
      "folio-admin",
      JSON.stringify(quiz.parse(q)),
    );
    for (const [i, t] of spec.tasks.entries())
      sql(
        "INSERT INTO tasks VALUES(?,?,?,1,?,1)",
        t.id,
        t.sid,
        JSON.stringify(task.parse(t)),
        i,
      );
    sql("INSERT INTO migrations VALUES('seed-v1')");
  });
}
const linked = (b, id) => b.cover === id || b.blocks.some((x) => x.file === id);
const qfiles = (q) =>
  [...q.media, ...q.options].map((x) => x.file).filter(Boolean);
export function readable(f, u, run) {
  if (can(u, f.sid)) return true;
  if(one("SELECT 1 FROM subjects WHERE id=? AND visible=1 AND cover=?",f.sid,"file:"+f.id))return true;
  if (
    all(
      "SELECT t.* FROM tasks t JOIN subjects s ON s.id=t.sid WHERE (s.visible=1 AND t.published=1) OR ?=1",
      u?.role === "admin" ? 1 : 0,
    ).some((t) => linked(JSON.parse(t.body), f.id))
  )
    return true;
  if (run) {
    const r = sync(run);
    if (
      (publicRun(r) || moderates(u, r)) &&
      ["question", "solution", "board"].includes(r.phase)
    )
      return qfiles(r.body.questions[r.idx]).includes(f.id);
  }
  return false;
}
export const filesMeta = (ids) =>
  Object.fromEntries(
    [...new Set(ids.filter(Boolean))].map((id) => [
      id,
      one("SELECT id,name,type,size FROM files WHERE id=?", id),
    ]),
  );
export function catalog(u, staff = false) {
  if (staff && !u) fail("Přihlaste se.", 401);
  return all("SELECT * FROM subjects ORDER BY pos,title")
    .filter((s) => (staff ? can(u, s.id) : s.visible))
    .map((s) => ({
      ...s,
      icon: subjectIcon(s.id),
      count: one(
        "SELECT count(*) n FROM tasks WHERE sid=? AND (published=1 OR ?=1)",
        s.id,
        staff ? 1 : 0,
      ).n,
    }));
}
export function lesson(id, u, staff) {
  const t = one("SELECT * FROM tasks WHERE id=?", id);
  if (!t || !(staff ? can(u, t.sid) : published(t)))
    fail("Úkol není dostupný.", 404);
  const b = unpack(t);
  return {
    ...b,
    area:one('SELECT a.id,a.title FROM task_areas m JOIN areas a ON a.id=m.area WHERE m.task=?',id),
    files: filesMeta([b.body.cover, ...b.body.blocks.map((x) => x.file)]),
    games: all(
      "SELECT r.id,r.pin,r.qid,r.body,u.name FROM runs r JOIN users u ON u.id=r.owner WHERE task=? AND ended IS NULL",
      id,
    )
      .filter((x) => sync(x.id).phase === "lobby")
      .map((x) => ({
        pin: x.pin,
        quiz: x.qid,
        name: x.name,
        group: JSON.parse(x.body).settings.group,
      })),
  };
}
export function shelf(id, u, staff) {
  const s = one("SELECT * FROM subjects WHERE id=?", id);
  if (!s || !(staff ? can(u, id) : s.visible))
    fail("Předmět není dostupný.", 404);
  return {
    ...s,
    icon:subjectIcon(id),areas:areasFor(id,staff),
    tasks:all("SELECT t.* FROM tasks t JOIN task_areas m ON m.task=t.id WHERE t.sid=? AND (t.published=1 OR ?=1) ORDER BY m.created_order DESC LIMIT 3",id,staff?1:0).map(unpack),
    quizzes: staff
      ? all(
          "SELECT q.* FROM quizzes q WHERE q.sid=? OR EXISTS(SELECT 1 FROM shares s WHERE s.qid=q.id AND s.sid=?)",
          id,
          id,
        ).map((q) => ({
          id: q.id,
          title: JSON.parse(q.body).title,
          editable: can(u, q.sid),
        }))
      : [],
  };
}
export function quizDetail(id, u, taskId) {
  const q = one("SELECT * FROM quizzes WHERE id=?", id);
  if (!q) fail("Kvíz nenalezen.", 404);
  if (!can(u, q.sid)) {
    const t = taskId && one("SELECT * FROM tasks WHERE id=?", taskId);
    if (
      !t ||
      !can(u, t.sid) ||
      !JSON.parse(t.body).blocks.some((b) => b.quiz === id) ||
      !one("SELECT 1 FROM shares WHERE qid=? AND sid=?", id, t.sid)
    )
      fail("Kvíz není dostupný.", 403);
    const b = JSON.parse(q.body);
    return {
      id,
      sid: t.sid,
      useOnly: true,
      body: { title: b.title, settings: b.settings, questions: [] },
      runs: all(
        "SELECT id,pin,started,ended,early FROM runs WHERE task=? AND qid=? AND owner=?",
        t.id,
        id,
        u.id,
      ),
    };
  }
  const full = unpack(q);
  for (const question of full.body.questions)
    for (const m of question.media)
      m.type = one("SELECT type FROM files WHERE id=?", m.file)?.type;
  return {
    ...full,
    shared: all("SELECT sid FROM shares WHERE qid=?", id)
      .filter((s) => can(u, s.sid))
      .map((s) => s.sid),
    runs: all(
      "SELECT id,pin,sid,owner,started,ended,early,body FROM runs WHERE qid=? ORDER BY started DESC",
      id,
    )
      .filter((r) => moderates(u, r))
      .map((r) => ({
        id: r.id,
        pin: r.pin,
        started: r.started,
        ended: r.ended,
        early: r.early,
        group: JSON.parse(r.body).settings.group,
      })),
  };
}
function validateFile(id, sid, allowed) {
  if (!id) return;
  const f = one("SELECT type FROM files WHERE id=? AND sid=?", id, sid);
  if (!f) fail("Příloha nepatří k předmětu.");
  if (allowed && !allowed.test(f.type))
    fail("Tento typ přílohy nelze v daném bloku použít.");
}
export function save(path, d, u) {
  if (!u) fail("Přihlaste se.", 401);
  if (path === "subject") {
    admin(u);
    const title = z.string().trim().min(1).max(160).parse(d.title),
      description = z.string().max(2000).parse(d.description);
    const id = d.id || key(),
      old = one("SELECT * FROM subjects WHERE id=?", id);
    if(d.id && (!old||one("SELECT id FROM removed_subjects WHERE id=?",id)))fail("Předmět již není dostupný.",404);
    if (old && old.version !== d.version)
      fail("Předmět byl mezitím upraven.", 409);
    const theme = [
      "blue",
      "green",
      "orange",
      "#205c8c",
      "#a5543c",
      "#347663",
    ].includes(d.theme)
      ? d.theme
      : "blue";
    sql(
      "INSERT INTO subjects VALUES(?,?,?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,theme=excluded.theme,visible=excluded.visible,pos=excluded.pos,version=version+1",
      id,
      title,
      description,
      theme,
      old?.cover || spec.subjects[0].cover,
      d.visible ? 1 : 0,
      Number(d.pos) || 0,
    );
    if(!old)defaults(id);setSubjectIcon(id,d.icon);
    return { id };
  }
  if (path === "share") {
    admin(u);
    tx(() => {
      sql("DELETE FROM shares WHERE qid=?", d.id);
      for (const sid of new Set(d.sids))
        sql("INSERT INTO shares VALUES(?,?)", d.id, sid);
    });
    return {};
  }
  const table = path === "task" ? "tasks" : "quizzes",
    id = d.id || key(),
    old = one("SELECT * FROM " + table + " WHERE id=?", id),
    sid = old?.sid || d.sid;
  access(u, sid);
  if(d.id&&!old)fail("Položka již není dostupná.",404);
  if (old && old.version !== d.version)
    fail("Někdo mezitím uložil změny. Otevřete aktuální verzi.", 409);
  const body = (path === "task" ? task : quiz).parse(d.body);
  if (path === "task") {
    validateFile(body.cover, sid, /^image\//);
    for (const b of body.blocks) {
      if(d.published && ["file","image"].includes(b.kind)&&!b.file)fail("Před zveřejněním doplňte soubor nebo odeberte prázdný blok.");
      validateFile(b.file, sid, b.kind === "image" ? /^image\// : null);
      if (
        b.quiz &&
        !one(
          "SELECT 1 FROM quizzes WHERE id=? AND (sid=? OR EXISTS(SELECT 1 FROM shares WHERE qid=? AND sid=?))",
          b.quiz,
          sid,
          b.quiz,
          sid,
        )
      )
        fail("Kvíz nebyl zpřístupněn pro předmět.");
    }
    sql(
      "INSERT INTO tasks VALUES(?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET body=excluded.body,published=excluded.published,pos=excluded.pos,version=version+1",
      id,
      sid,
      JSON.stringify(body),
      d.published ? 1 : 0,
      Number(d.pos) || 0,
    );
    assignArea(id,sid,d.area);
  } else {
    body.questions.forEach((q) => {
      q.media.forEach((m) =>
        validateFile(m.file, sid, /^(image|video|audio)\//),
      );
      q.options.forEach((o) => validateFile(o.file, sid, /^image\//));
    });
    sql(
      "INSERT INTO quizzes VALUES(?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET body=excluded.body,version=version+1",
      id,
      sid,
      u.id,
      JSON.stringify(body),
    );
  }
  return { id };
}
