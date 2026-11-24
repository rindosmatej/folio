import { one, all, sql, admin, access, fail, digest } from "./db.mjs";
export function removalPreview(kind, id, u) {
  const table = { subject: "subjects", area: "areas", task: "tasks" }[kind];
  if (!["subject", "area", "task"].includes(kind)) fail("Neznámá položka.");
  if (kind === "subject") admin(u);
  const row = one("SELECT * FROM " + table + " WHERE id=?", id);
  if (
    !row ||
    (kind === "subject" && one("SELECT 1 FROM removed_subjects WHERE id=?", id))
  )
    fail("Položka již není dostupná.", 404);
  const sid = kind === "subject" ? id : row.sid;
  access(u, sid);
  const tasks =
    kind === "subject"
      ? all("SELECT id,version FROM tasks WHERE sid=? ORDER BY id", sid)
      : kind === "area"
        ? all(
            "SELECT t.id,t.version FROM tasks t JOIN task_areas m ON m.task=t.id WHERE m.area=? ORDER BY t.id",
            id,
          )
        : [{ id, version: row.version }];
  const areas = all(
    "SELECT id,title,version FROM areas WHERE sid=? ORDER BY pos,id",
    sid,
  );
  const stamp = digest(JSON.stringify([kind, id, row.version, tasks, areas]));
  return {
    kind,
    id,
    sid,
    title: kind === "task" ? JSON.parse(row.body).title : row.title,
    taskCount: tasks.length,
    areaCount: areas.length,
    targets: kind === "area" ? areas.filter((a) => a.id !== id) : [],
    stamp,
  };
}
export function remove(d, u) {
  const p = removalPreview(d.kind, d.id, u);
  if (p.stamp !== d.stamp)
    fail("Obsah se mezitím změnil. Otevřete potvrzení znovu.", 409);
  const { kind, id, sid } = p;
  if (kind === "area" && d.target) {
    if (!p.targets.some((a) => a.id === d.target))
      fail("Vyberte jinou oblast stejného předmětu.");
    sql(
      "UPDATE tasks SET version=version+1 WHERE id IN (SELECT task FROM task_areas WHERE area=?)",
      id,
    );
    sql("UPDATE task_areas SET area=? WHERE area=?", d.target, id);
  } else {
    if (kind === "area" && p.taskCount && d.mode !== "cascade")
      fail("Potvrďte také smazání úkolů nebo je přesuňte.");
    const select =
      kind === "subject"
        ? "SELECT id FROM tasks WHERE sid=?"
        : kind === "area"
          ? "SELECT task FROM task_areas WHERE area=?"
          : "SELECT id FROM tasks WHERE id=?";
    const where = kind === "subject" ? "sid=?" : "task IN (" + select + ")";
    sql(
      "UPDATE runs SET ended=?,early=1,phase='final',deadline=NULL,remaining=NULL,version=version+1 WHERE ended IS NULL AND " +
        where,
      Date.now(),
      id,
    );
    const t = all(select, id);
    // Detach historical runs before removing their source task.
    sql(
      "INSERT OR IGNORE INTO removed_run_sources SELECT id FROM runs WHERE task IN (" +
        select +
        ")",
      id,
    );
    sql("UPDATE runs SET task=NULL WHERE task IN (" + select + ")", id);
    for (const x of t) {
      const tid = x.id ?? x.task;
      sql("DELETE FROM task_areas WHERE task=?", tid);
      sql("DELETE FROM tasks WHERE id=?", tid);
    }
  }
  if (kind === "area") sql("DELETE FROM areas WHERE id=?", id);
  if (kind === "subject") {
    sql("DELETE FROM areas WHERE sid=?", sid);
    sql("DELETE FROM shares WHERE sid=?", sid);
    sql(
      "UPDATE feedback_forms SET status='closed',closed_at=?,version=version+1 WHERE sid=? AND status='open'",
      Date.now(),sid,
    );
    sql("UPDATE subjects SET visible=0,version=version+1 WHERE id=?", sid);
    sql("INSERT INTO removed_subjects VALUES(?)", sid);
  }
  return { sid };
}
