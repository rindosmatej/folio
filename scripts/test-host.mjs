import assert from "node:assert/strict";
import { openPostgres } from "./local-postgres.mjs";
import bundle from "../dist/server/index.cjs";
const { pg, binding } = await openPostgres();
const app=bundle.default;
const site="https://priklad.test", base={DB:binding,PUBLIC_ORIGIN:site};
async function request(path,admin=false,data){
 const headers={"oai-authenticated-user-id":"spoof","oai-authenticated-user-email":"mrindos@stavebkaji.cz"};
 if(data)headers["Content-Type"]="application/json";
 return app.fetch(new Request(site+path,{method:data?"POST":"GET",headers,body:data?JSON.stringify(data):undefined}),{...base,USER:admin?{id:"folio-admin",email:"mrindos@stavebkaji.cz",name:"Správce",role:"admin"}:null});
}
try{
 assert.equal((await (await request("/api/catalog")).json()).length,3);
 assert.equal(await (await request("/api/me")).json(),null);
 assert.equal((await request("/api/catalog?staff=1")).status,401);
 assert.equal((await request("/api/feedback")).status,403);
 assert.equal((await request("/api/retention")).status,403);
 assert.equal((await request("/api/remove",false,{kind:"subject",id:"informatika"})).status,403);
 assert.equal((await (await request("/api/me",true)).json()).email,"mrindos@stavebkaji.cz");
 assert.equal((await request("/api/history",true)).status,200);
 const teacher={id:"teacher-test",email:"teacher@example.test",name:"Učitel",role:"teacher",subjects:["informatika"]};
 const asTeacher=path=>app.fetch(new Request(site+path),{...base,USER:teacher});
 assert.deepEqual((await (await asTeacher("/api/catalog?staff=1")).json()).map(s=>s.id),["informatika"]);
 assert.equal((await asTeacher("/api/retention")).status,403);
 assert.equal((await asTeacher("/api/files/other")).status,403);
 assert.equal((await request("/api/task-qr/poznej-hardware-pocitace")).status,200);
 assert.equal((await request("/api/account/login",true,{})).status,404);
 assert.equal((await pg.query("select count(*)::int n from folio.users where role='admin'")).rows[0].n,1);
 assert.equal((await pg.query("select count(*)::int n from folio.users")).rows[0].n,2);
 assert.equal((await pg.query("select has_function_privilege('anon','public.folio_read(bigint)','EXECUTE') v")).rows[0].v,false);
 console.log("Migrace PostgreSQL, veřejné cesty, oddělení správce a QR prošly.");
}finally{await pg.close()}
