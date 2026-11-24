import { admin, all, one, sql, digest, fail } from "./db.mjs";
import { z } from "zod";
const day = 86400000;
export function policy() {
  return (
    one("SELECT games,comments,version FROM retention_policy WHERE id=1") || {
      games: null,
      comments: null,
      version: 0,
    }
  );
}
export function retention(u, action, d = {}) {
  admin(u);
  const rules = policy();
  if (action === "save") {
    const days = z.number().int().min(1).max(36500).nullable();
    const { games, comments, version } = z
      .object({ games: days, comments: days, version: z.number().int() })
      .parse(d);
    if (version !== rules.version)
      fail("Pravidla se mezitím změnila. Obnovte stránku.", 409);
    sql(
      "INSERT OR REPLACE INTO retention_policy VALUES(1,?,?,?)",
      games,
      comments,
      version + 1,
    );
    return {};
  }
  const now = Date.now();
  const games =
    rules.games === null
      ? []
      : all(
          "SELECT id,json_extract(body,'$.title') title,ended date FROM runs WHERE ended<=? ORDER BY ended,id LIMIT 50",
          now - day * rules.games,
        );
  const comments =
    rules.comments === null
      ? []
      : all(
          `SELECT id,title,closed_at date FROM feedback_forms f WHERE status='closed' AND closed_at<=? AND comments_removed=0 AND EXISTS(SELECT 1 FROM feedback_counts c,json_each(f.questions) q WHERE c.form=f.id AND c.question=json_extract(q.value,'$.id') AND json_extract(q.value,'$.type')='text' AND c.answer<>'') ORDER BY closed_at,id LIMIT 50`,
          now - day * rules.comments,
        );
  const stamp = digest(JSON.stringify([rules, games, comments]));
  if (action !== "purge") return { rules, games, comments, stamp };
  if (stamp !== d.stamp) fail("Seznam se změnil. Znovu načtěte náhled.", 409);
  for (const { id } of games) {
    for (const table of ["answers", "player_avatars"])
      sql(
        "DELETE FROM " +
          table +
          " WHERE player IN (SELECT id FROM players WHERE run=?)",
        id,
      );
    sql("DELETE FROM players WHERE run=?", id);
    sql("DELETE FROM removed_run_sources WHERE run=?", id);
    sql("DELETE FROM runs WHERE id=?", id);
  }
  for (const { id } of comments) {
    sql(
      "DELETE FROM feedback_counts WHERE form=? AND answer<>'' AND question IN (SELECT json_extract(value,'$.id') FROM feedback_forms,json_each(questions) WHERE feedback_forms.id=? AND json_extract(value,'$.type')='text')",
      id,
      id,
    );
    sql(
      "UPDATE feedback_forms SET comments_removed=1,version=version+1 WHERE id=?",
      id,
    );
  }
  return { games: games.length, comments: comments.length };
}
