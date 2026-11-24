import {frequencies} from "./frequencies.mjs";
import {avatars, defaultAvatar} from "./avatars.mjs";
function randomInt(lo,hi){if(hi===undefined){hi=lo;lo=0}const range=hi-lo,cap=4294967296-(4294967296%range);let n;do{n=crypto.getRandomValues(new Uint32Array(1))[0]}while(n>=cap);return lo+n%range}
import {
  one,
  all,
  sql,
  fail,
  key,
  can,
  access,
  visible,
  published,
  unpack,
  digest,
} from "./db.mjs";
import { settings, validateGame } from "./schema.mjs";
const now = Date.now;
const get = (id) => {
  const r = one("SELECT * FROM runs WHERE id=?", id);
  if (!r) fail("Soutěž nebyla nalezena.", 404);
  return unpack(r);
};
export const moderates = (u, r) =>
  u?.role==="admin" || (can(u,r.sid) && u.id===r.owner);
export const publicRun = (r) =>
  visible(r.sid) && !one("SELECT 1 FROM removed_run_sources WHERE run=?",r.id) &&
  (!r.task || published(one("SELECT * FROM tasks WHERE id=?", r.task)));
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
}
export function create(u, d) {
  const q = one("SELECT * FROM quizzes WHERE id=?", d.quiz);
  if (!q) fail("Kvíz nenalezen.", 404);
  const t = d.task && one("SELECT * FROM tasks WHERE id=?", d.task);
  const sid = t ? t.sid : q.sid;
  access(u, sid);
  if (
    !visible(sid) ||
    (d.task &&
      (!published(t) ||
        !JSON.parse(t.body).blocks.some((b) => b.quiz === q.id))) ||
    (sid !== q.sid &&
      !one("SELECT 1 FROM shares WHERE sid=? AND qid=?", sid, q.id))
  )
    fail("Pro spuštění zveřejněte předmět a vybrané zadání.");
  if (!d.request || typeof d.request !== "string")
    fail("Chybí identifikátor požadavku.");
  const old = one(
    "SELECT id FROM runs WHERE owner=? AND request=?",
    u.id,
    d.request,
  );
  if (old) return old;
  if (d.version !== undefined && d.version !== q.version)
    fail("Kvíz byl mezitím upraven. Obnovte detail před spuštěním.", 409);
  const b = JSON.parse(q.body);
  try {
    validateGame(b);
  } catch (e) {
    fail(e.message);
  }
  b.settings = settings.parse({ ...b.settings, ...d.settings });
  if (b.settings.shuffle) shuffle(b.questions);
  if (b.settings.shuffleOptions)
    b.questions
      .filter((x) => x.type !== "bool")
      .forEach((x) => shuffle(x.options));
  let pin;
  do {
    pin = String(randomInt(100000, 1000000));
  } while (one("SELECT 1 FROM runs WHERE ended IS NULL AND pin=?", pin));
  const id = key();
  sql(
    "INSERT INTO runs(id,pin,owner,sid,qid,task,request,body,phase,idx,version,started) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
    id,
    pin,
    u.id,
    sid,
    q.id,
    t?.id || null,
    d.request,
    JSON.stringify(b),
    "lobby",
    0,
    1,
    now(),
  );
  return { id };
}
const count = (r) =>
  one("SELECT count(*) AS n FROM players WHERE run=?", r.id).n;
function advance(r, time) {
  const s = r.body.settings,
    q = r.body.questions[r.idx];
  let p = r.phase,
    idx = r.idx,
    sec = null;
  if (p === "lobby") {
    if (!count(r)) fail("Počkejte na prvního hráče.");
    p = "countdown";
    sec = s.countdown;
  } else if (p === "countdown") {
    p = "question";
    sec = s.seconds || q.seconds;
  } else if (p === "question") {
    p = "solution";
    sec = s.mode === "auto" ? s.solution : null;
  } else if (
    p === "solution" &&
    (s.ranks === "each" ||
      (s.ranks === "interval" && (idx + 1) % s.interval === 0))
  ) {
    p = "board";
    sec = s.mode === "auto" ? s.board : null;
  } else if (idx + 1 < r.body.questions.length) {
    p = "countdown";
    idx++;
    sec = s.countdown;
  } else p = "final";
  sql(
    "UPDATE runs SET phase=?,idx=?,deadline=?,ended=?,version=version+1 WHERE id=?",
    p,
    idx,
    sec === null ? null : time + sec * 1000,
    p === "final" ? time : null,
    r.id,
  );
}
export function sync(id) {
  let r = get(id);
  while (
    r.deadline !== null &&
    r.remaining === null &&
    now() >= r.deadline &&
    r.phase !== "final"
  ) {
    advance(r, r.deadline);
    r = get(id);
  }
  return r;
}
export function join(pin, name, avatar = defaultAvatar) {
  const found = one("SELECT id FROM runs WHERE pin=? AND ended IS NULL", pin);
  if (!found) fail("PIN není platný nebo soutěž skončila.", 404);
  let r = sync(found.id);
  if (!publicRun(r) || r.phase !== "lobby") fail("Lobby je uzavřené.", 409);
  name = String(name || "")
    .trim()
    .normalize("NFC");
  if (!name || name.length > 40) fail("Přezdívka musí mít 1 až 40 znaků.");
  const n = name.toLocaleLowerCase("cs");
  if (one("SELECT 1 FROM players WHERE run=? AND normalized=?", r.id, n))
    fail("Tuto přezdívku již někdo používá.", 409);
  if(!avatars.some(a=>a.id===avatar)) fail("Vyber platného avatara.");
  const token = key(), playerId = key();
  sql(
    "INSERT INTO players VALUES(?,?,?,?,?,?)",
    playerId,
    r.id,
    name,
    n,
    digest(token),
    now(),
  );
  sql("INSERT INTO player_avatars VALUES(?,?)",playerId,avatar);
  if (
    r.body.settings.threshold &&
    r.deadline === null &&
    count(r) >= r.body.settings.threshold
  )
    sql(
      "UPDATE runs SET deadline=?,version=version+1 WHERE id=?",
      now() + 3000,
      r.id,
    );
  return { id: r.id, token };
}
function identity(r, token) {
  return (
    token &&
    one("SELECT * FROM players WHERE run=? AND token=?", r.id, digest(token))
  );
}
function ranking(r) {
  return all(
    "SELECT p.id,p.name,v.avatar,coalesce(sum(a.points),0) points FROM players p LEFT JOIN player_avatars v ON v.player=p.id LEFT JOIN answers a ON a.player=p.id WHERE p.run=? GROUP BY p.id ORDER BY points DESC,p.joined,p.id",
    r.id,
  );
}
export function answer(id, token, d) {
  const r = sync(id),
    p = identity(r, token);
  if (!publicRun(r) || !p) fail("Připojte se ke hře.", 403);
  if (d.idx !== r.idx) fail("Otázka již skončila.", 409);
  if (one("SELECT 1 FROM answers WHERE player=? AND idx=?", p.id, r.idx))
    return { accepted: true };
  if (r.phase !== "question" || r.remaining !== null || now() >= r.deadline)
    fail("Otázka nyní nepřijímá odpovědi.", 409);
  const q = r.body.questions[r.idx],
    s = r.body.settings;
  let v = d.value,
    ok = false;
  if (q.type === "number") {
    const raw = String(v).trim().replace(",", ".");
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)) fail("Zadejte číslo.");
    v = Number(raw);
    ok = Math.abs(v - q.value) <= q.tolerance;
  } else {
    if (
      !Array.isArray(v) ||
      !v.length ||
      new Set(v).size !== v.length ||
      (q.type !== "many" && v.length !== 1) ||
      v.some((x) => !q.options.some((o) => o.id === x))
    )
      fail("Vyberte platnou odpověď.");
    ok = v.length === q.correct.length && q.correct.every((x) => v.includes(x));
  }
  const at = now();
  if (at >= r.deadline) fail("Čas vypršel.", 409);
  const points = ok
    ? s.fixed
      ? 1000
      : 500 +
        Math.round(
          500 *
            Math.min(1, (r.deadline - at) / ((s.seconds || q.seconds) * 1000)),
        )
    : 0;
  sql(
    "INSERT INTO answers VALUES(?,?,?,?,?)",
    p.id,
    r.idx,
    JSON.stringify(v),
    points,
    at,
  );
  if (s.closeAll && responses(r) === count(r)) advance(r, at);
  return { accepted: true };
}
const responses = (r) =>
  one(
    "SELECT count(*) n FROM answers a JOIN players p ON p.id=a.player WHERE p.run=? AND idx=?",
    r.id,
    r.idx,
  ).n;
export function command(id, u, d) {
  let r = sync(id);
  if (!moderates(u, r)) fail("Moderování není povoleno.", 403);
  if (d.action === "volume") {
    if (!Number.isFinite(d.volume) || d.volume < 0 || d.volume > 1)
      fail("Neplatná hlasitost.");
    sql("UPDATE runs SET volume=? WHERE id=?", d.volume, id);
    return {};
  }
  if (r.version !== d.version || r.phase === "final") return {};
  if (d.action === "end")
    sql(
      "UPDATE runs SET phase='final',ended=?,early=1,deadline=NULL,remaining=NULL,version=version+1 WHERE id=?",
      now(),
      id,
    );
  else if (d.action === "pause" && r.remaining === null && r.phase !== "lobby")
    sql(
      "UPDATE runs SET remaining=?,deadline=NULL,version=version+1 WHERE id=?",
      r.deadline === null ? -1 : Math.max(0, r.deadline - now()),
      id,
    );
  else if (d.action === "resume" && r.remaining !== null)
    sql(
      "UPDATE runs SET deadline=?,remaining=NULL,version=version+1 WHERE id=?",
      r.remaining < 0 ? null : now() + r.remaining,
      id,
    );
  else if (d.action === "next" && r.remaining === null) advance(r, now());
  else fail("Tento krok není dostupný.", 409);
  return {};
}
function summary(r, i) {
  const vals = all(
    "SELECT value,count(*) n FROM answers a JOIN players p ON p.id=a.player WHERE p.run=? AND idx=? GROUP BY value",
    r.id,
    i,
  );
  return vals.map((x) => ({ value: JSON.parse(x.value), n: x.n }));
}
export function view(id, u, token, host = false) {
  const r = sync(id),
    mod = host && moderates(u, r);
  if ((host && !mod) || (!mod && !publicRun(r)))
    fail("Přístup není povolen.", 403);
  const p = identity(r, token),
    s = r.body.settings,
    q = r.body.questions[r.idx],
    a =
      p &&
      one("SELECT points FROM answers WHERE player=? AND idx=?", p.id, r.idx);
  const out = {
    id,
    pin: r.pin,
    title: r.body.title,
    group: s.group,
    phase: r.phase,
    idx: r.idx,
    version: r.version,
    deadline: r.deadline,
    serverTime: now(),
    paused: r.remaining !== null,
    total: r.body.questions.length,
    count: count(r),
    responses: responses(r),
    accepted: !!a,
    early: !!r.early,
    sound: s.sound,
    volume: r.volume,
  };
  if(p) out.player={name:p.name,avatar:one("SELECT avatar FROM player_avatars WHERE player=?",p.id)?.avatar||defaultAvatar};
  if(r.phase==='lobby'){
    out.players=all("SELECT p.name,coalesce(a.avatar,?) avatar FROM players p LEFT JOIN player_avatars a ON a.player=p.id WHERE p.run=? ORDER BY p.joined,p.id",defaultAvatar,id);
    out.names=out.players.map(x=>x.name);
  }
  if (["question", "solution", "board"].includes(r.phase)) {
    out.question = {
      text: q.text,
      textPosition: q.textPosition || 0,
      type: q.type,
      options: q.options,
      media: q.media.map((m) => ({
        ...m,
        type: one("SELECT type FROM files WHERE id=?", m.file)?.type,
      })),
      unit: q.unit,
    };
    if (r.phase !== "question") {
      out.solution =
        q.type === "number"
          ? String(q.value) + " " + q.unit
          : q.correct
              .map((k) => q.options.find((o) => o.id === k)?.text || k)
              .join(", ");
      out.correctOptions =
        q.type === "number"
          ? []
          : q.options.filter((o) => q.correct.includes(o.id));
      out.explanation = q.explanation;
      out.distribution = summary(r, r.idx);
      out.frequencies = frequencies(q,out.distribution,out.count);
      if (p) out.points = a?.points || 0;
    }
  }
  if (
    mod ||
    r.phase === "board" ||
    (r.phase === "final" && s.ranks !== "private")
  ) {
    const ranks = ranking(r);
    out.ranks = (mod ? ranks : ranks.slice(0, s.top)).map(
      ({ name, points, avatar }) => ({ name, points, avatar:avatar||defaultAvatar }),
    );
  }
  if (
    p &&
    s.personal &&
    ["board", "final", "solution"].includes(r.phase) &&
    s.ranks !== "private" &&
    (s.ranks !== "final" || r.phase === "final")
  )
    {const ranks=ranking(r),index=ranks.findIndex(x=>x.id===p.id);out.rank=index+1;out.totalPoints=ranks[index].points;}
  if (mod && r.phase === "final") {
    out.started = r.started;
    out.ended = r.ended;
    out.history = r.body.questions.map((q, i) => {const groups=summary(r,i);return {
      skipped:r.early && i>r.idx,
      frequencies:frequencies(q,groups,out.count),
      text: q.text,
      distribution: groups.map((d) => ({
        ...d,
        label: Array.isArray(d.value)
          ? d.value
              .map((k) => q.options.find((o) => o.id === k)?.text || k)
              .join(", ")
          : String(d.value),
      })),
    }});
  }
  return out;
}
