import init from "sql.js/dist/sql-asm.js";
import schema from "./schema-sql.json";
import keys from "./postgres-keys.json";
import {within} from "./db.mjs";
let engine, cache, queue=Promise.resolve();
function rows(db,table){
  const s=db.prepare("SELECT * FROM "+table), out=new Map();
  try{while(s.step()){const r=s.getAsObject();out.set(JSON.stringify(keys[table].map(k=>r[k])),r)}}finally{s.free()}
  return out;
}
async function perform(pg,fn){
  engine ??= await init();
  for(let attempt=0;attempt<16;attempt++){
    const snapshot=await pg.rpc("folio_read",{known:cache?.rev??-1});
    if(snapshot.tables){
      const db=new engine.Database();
      db.run(schema);
      for(const [table,records] of Object.entries(snapshot.tables)){
        if(!keys[table])throw Error("Unexpected table");
        for(const row of records){
          const cols=Object.keys(row);
          db.run("INSERT INTO "+table+"("+cols.join(",")+") VALUES("+cols.map(()=>"?").join(",")+")",Object.values(row));
        }
      }
      cache?.db.close();cache={rev:snapshot.rev,db};
    }
    const {db,rev}=cache;
    const {writes,value}=within(db,fn);
    if(!writes.length)return value;
    const tables=[...new Set(writes.map(([statement])=>{
      const match=/^\s*(?:INSERT(?: OR (?:IGNORE|REPLACE))? INTO|UPDATE|DELETE FROM)\s+(\w+)/i.exec(statement);
      if(!match||!keys[match[1]])throw Error("Unsupported write");
      return match[1];
    }))];
    const before=Object.fromEntries(tables.map(t=>[t,rows(db,t)])),changes={};
    db.run("BEGIN");
    try{
      for(const [sql,args] of writes)db.run(sql,args);
      for(const t of tables){
        const after=rows(db,t),old=before[t];
        changes[t]={del:[...old].filter(([k])=>!after.has(k)).map(([,v])=>v),
          put:[...after].filter(([k,v])=>JSON.stringify(old.get(k))!==JSON.stringify(v)).map(([,v])=>v)};
      }
      if(await pg.rpc("folio_commit",{expected:rev,changes})){
        db.run("COMMIT");cache.rev++;return value;
      }
    }catch(e){db.run("ROLLBACK");throw e}
    db.run("ROLLBACK");
    await new Promise(resolve=>setTimeout(resolve,5+Math.random()*30));
  }
  throw Object.assign(Error("Data se souběžně mění. Opakujte akci."),{status:409});
}
export function transact(pg,fn){
 const next=queue.then(()=>perform(pg,fn));queue=next.catch(()=>{});return next;
}
