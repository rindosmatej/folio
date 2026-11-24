import {sha256} from '@noble/hashes/sha256';
import {bytesToHex,utf8ToBytes} from '@noble/hashes/utils';
export const key=()=>bytesToHex(crypto.getRandomValues(new Uint8Array(24)));
export const digest=s=>bytesToHex(sha256(utf8ToBytes(s)));
let active;
export function within(db,fn){const writes=[];active={db,writes};db.run("BEGIN");try{const value=fn();return {value,writes}}finally{db.run("ROLLBACK");active=null}}
export function all(s,...a){const stmt=active.db.prepare(s);try{stmt.bind(a);const rows=[];while(stmt.step())rows.push(stmt.getAsObject());return rows}finally{stmt.free()}}
export const one=(s,...a)=>all(s,...a)[0];
export function sql(s,...a){active.db.run(s,a);active.writes.push([s,a])}
export const tx=fn=>fn();
export function fail(message, status = 400) {
  throw Object.assign(Error(message), { status });
}
export const can = (u, sid) =>
  (u?.role === "admin" || (u?.role === "teacher" && u.subjects?.includes(sid))) && !!one("SELECT id FROM subjects WHERE id=? AND id NOT IN (SELECT id FROM removed_subjects)",sid);
export function access(u, sid) {
  if (!can(u, sid)) fail("K tomuto předmětu nemáte přístup.", 403);
}
export const visible = (sid) =>
  !!one("SELECT visible FROM subjects WHERE id=?", sid)?.visible;
export const published = (t) => t?.published && visible(t.sid);
export const unpack = (r) => ({ ...r, body: JSON.parse(r.body) });
export function admin(u) {
  if (u?.role !== "admin") fail("Tuto akci může provést pouze správce.", 403);
}
