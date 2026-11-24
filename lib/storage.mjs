import {transact as postgres} from "./postgres-store.mjs";
import initSqlJs from 'sql.js/dist/sql-asm.js';
import schema from './schema-sql.json';
import {within} from './db.mjs';
const tables=['users','subjects','tasks','files','quizzes','shares','runs','players','player_avatars','answers','areas','subject_icons','task_areas','feedback_forms','feedback_counts','feedback_receipts','removed_subjects','removed_run_sources','retention_policy','migrations'];
let cached,queue=Promise.resolve();
async function snapshot(conn){
 const version=await conn.prepare('SELECT v FROM revision WHERE id=1').first('v')||0;
 if(cached?.version===version)return cached;
 const set=await conn.batch(['revision',...tables].map(t=>conn.prepare('SELECT * FROM '+t+' ORDER BY rowid')));
 const SQL=await initSqlJs(),db=new SQL.Database();db.run(schema);
 tables.forEach((t,i)=>{for(const row of set[i+1].results){const keys=Object.keys(row);db.run('INSERT INTO '+t+'('+keys.join(',')+') VALUES('+keys.map(()=>'?').join(',')+')',Object.values(row))}});
 cached?.db.close();cached={db,version:set[0].results[0]?.v||0};return cached;
}
async function perform(binding,fn){
 const conn=binding.withSession?binding.withSession('first-primary'):binding;
 for(let n=0;n<12;n++){const snap=await snapshot(conn),result=within(snap.db,fn);
 if(!result.writes.length)return result.value;
 const guard=conn.prepare('INSERT INTO revision(id,v) VALUES(1,1) ON CONFLICT(id) DO UPDATE SET v=CASE WHEN v=? THEN v+1 ELSE -1 END').bind(snap.version);
 try{await conn.batch([guard,...result.writes.map(([s,args])=>conn.prepare(s).bind(...args))]);}
 catch(e){if(/CHECK constraint failed/.test(String(e))){continue}throw e}
 for(const [s,args] of result.writes)snap.db.run(s,args);snap.version++;return result.value;
 }throw Object.assign(Error('Souběžný zápis. Opakujte požadavek.'),{status:409});
}
// Each isolate serializes its synchronous SQL view. The D1 revision guard
// atomically rejects a stale mutation from another isolate.
export function transact(binding,fn){if(binding.rpc)return postgres(binding,fn);const next=queue.then(()=>perform(binding,fn));queue=next.then(()=>{},()=>{});return next}
