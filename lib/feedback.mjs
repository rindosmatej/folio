import { z } from "zod";
import { admin, one, all, sql, access, fail, key, digest } from "./db.mjs";
const text = z.string().trim().min(1).max(160);
const question = z.object({
  id: z.string().regex(/^[A-Za-z0-9-]{1,80}$/),
  title: text,
  type: z.enum(["one", "many", "scale", "text"]),
  options: z.array(z.string().trim().min(1).max(100)).max(12),
  required: z.boolean(),
});
const questions = z.array(question).min(1).max(20);
function formFor(id, u) {
  if (!u) fail("Přihlaste se.", 401);
  const f = one("SELECT * FROM feedback_forms WHERE id=?", id);
  if (!f || (u.role !== "admin" && f.owner !== u.id))
    fail("Dotazník není dostupný.", 404);
  if (u.role !== "admin") access(u, f.sid);
  return { ...f, questions: JSON.parse(f.questions) };
}
export function listFeedback(u) {
  if(!u)fail("Přihlaste se.",403);
  return all("SELECT f.id,f.title,f.status,f.responses,f.sid,f.owner,s.title subject FROM feedback_forms f JOIN subjects s ON s.id=f.sid ORDER BY f.created DESC,f.id").filter(f=>u.role==="admin"||(f.owner===u.id&&u.subjects.includes(f.sid)));
}
export function detailFeedback(id, u) {
  const f = formFor(id, u);
  const buckets = all(
    "SELECT question,answer,n FROM feedback_counts WHERE form=? ORDER BY question,answer",
    id,
  );
  return {
    ...f,
    results: f.questions.map((q) => {
      const parts = buckets.filter((b) => b.question === q.id);
      const opts = q.type === "scale" ? ["1", "2", "3", "4", "5"] : q.options;
      return {
        id: q.id,
        rows:
          q.type === "text"
            ? parts
                .filter((b) => b.answer !== "")
                .map((b) => ({ label: b.answer, count: b.n }))
            : opts.map((label, i) => ({
                label,
                count: parts.find((b) => b.answer === String(i))?.n || 0,
              })),
        answered: f.responses - (parts.find((b) => b.answer === "")?.n || 0),
      };
    }),
  };
}
export function saveFeedback(d, u) {
  if (!u) fail("Přihlaste se.", 401);
  const f = d.id ? formFor(d.id, u) : null;
  if (f && (f.status !== "draft" || f.version !== d.version))
    fail("Dotazník byl změněn nebo již sbírá odpovědi.", 409);
  const sid = d.sid;
  access(u, sid);
  if (!one("SELECT id FROM subjects WHERE id=?", sid)) fail("Vyberte předmět.");
  const title = text.parse(d.title),
    qs = questions.parse(d.questions);
  if (new Set(qs.map((q) => q.id)).size !== qs.length)
    fail("Otázky musí mít různé identifikátory.");
  for (const q of qs) {
    if (["one", "many"].includes(q.type)) {
      if (
        q.options.length < 2 ||
        new Set(q.options.map((o) => o.toLocaleLowerCase("cs"))).size !==
          q.options.length
      )
        fail("Zadejte alespoň dvě různé možnosti.");
    } else q.options = [];
  }
  const id = f?.id || key();
  if (f)
    sql(
      "UPDATE feedback_forms SET sid=?,title=?,questions=?,version=version+1 WHERE id=?",
      sid,
      title,
      JSON.stringify(qs),
      id,
    );
  else
    sql(
      "INSERT INTO feedback_forms(id,sid,owner,title,questions,share,created) VALUES(?,?,?,?,?,?,?)",
      id,
      sid,
      u.id,
      title,
      JSON.stringify(qs),
      key(),
      Date.now(),
    );
  return { id };
}
export function feedbackStatus(d, u) {
  const f = formFor(d.id, u);
  access(u, f.sid);
  if (
    f.version !== d.version ||
    !(
      (f.status === "draft" && d.status === "open") ||
      (f.status === "open" && d.status === "closed")
    )
  )
    fail("Tato změna už není dostupná.", 409);
  sql(
    "UPDATE feedback_forms SET status=?,closed_at=?,version=version+1 WHERE id=?",
    d.status,
    d.status === "closed" ? Date.now() : null,
    f.id,
  );
  return { id: f.id };
}
export function publicFeedback(share) {
  const f = one(
    "SELECT title,questions,status FROM feedback_forms WHERE share=? AND status<>'draft'",
    share,
  );
  if (!f) fail("Dotazník není dostupný.", 404);
  return {
    title: f.title,
    status: f.status,
    questions: f.status === "open" ? JSON.parse(f.questions) : [],
  };
}
export function submitFeedback(share, d) {
  // No identity, IP, timestamp or bundle of answers is written for a respondent.
  const f = one(
    "SELECT id,status,questions FROM feedback_forms WHERE share=?",
    share,
  );
  if (!f || f.status === "draft") fail("Dotazník není dostupný.", 404);
  const nonce = z
      .string()
      .regex(/^[a-f0-9-]{32,80}$/i)
      .parse(d.receipt),
    receipt = digest(share + "|" + nonce);
  if (
    one(
      "SELECT 1 FROM feedback_receipts WHERE form=? AND digest=?",
      f.id,
      receipt,
    )
  )
    return { accepted: true };
  if (f.status !== "open") fail("Sběr odpovědí byl ukončen.", 409);
  const qs = JSON.parse(f.questions),
    answers = z.record(z.unknown()).parse(d.answers);
  if (Object.keys(answers).some((k) => !qs.some((q) => q.id === k)))
    fail("Neznámá otázka.");
  let filled = false;
  const counts = [];
  for (const q of qs) {
    const value = answers[q.id];
    let vals = [];
    if (value !== undefined) {
      if (q.type === "text") {
        const s = z.string().trim().max(1200).parse(value);
        if (s) vals = [s];
      } else {
        const n = q.type === "scale" ? 5 : q.options.length;
        vals = z
          .array(
            z
              .number()
              .int()
              .min(0)
              .max(n - 1),
          )
          .max(q.type === "many" ? n : 1)
          .parse(value);
        if (new Set(vals).size !== vals.length)
          fail("Stejná možnost byla zvolena dvakrát.");
        vals = vals.map(String);
      }
    }
    if (q.required && !vals.length)
      fail("Doplňte odpověď na otázku „" + q.title + "“.");
    if (vals.length) filled = true;
    for (const v of vals.length ? vals : [""]) counts.push([q.id, v]);
  }
  if (!filled) fail("Vyplňte alespoň jednu odpověď.");
  for (const [qid, v] of counts)
    sql(
      "INSERT INTO feedback_counts VALUES(?,?,?,1) ON CONFLICT(form,question,answer) DO UPDATE SET n=n+1",
      f.id,
      qid,
      v,
    );
  sql("INSERT INTO feedback_receipts VALUES(?,?)", f.id, receipt);
  sql("UPDATE feedback_forms SET responses=responses+1 WHERE id=?", f.id);
  return { accepted: true };
}
