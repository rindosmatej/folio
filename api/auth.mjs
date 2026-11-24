// Server-only Supabase Auth gateway. Never trust user_metadata for privileges.
const env=process.env;
const cookieName='folio_session';
const send=(res,status,data,cookie)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})});res.end(JSON.stringify(data));};
const cookie=(value,age,local)=>`${cookieName}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${local?'':'; Secure'}`;
async function auth(path,{method='GET',body,token,privileged=false}={}){
 const key=privileged?env.SUPABASE_SERVER_KEY:env.SUPABASE_ANON_KEY;
 if(!env.SUPABASE_URL||!key)throw Error('Chybí konfigurace Supabase Auth.');
 const r=await fetch(env.SUPABASE_URL.replace(/\/$/,'')+'/auth/v1'+path,{method,headers:{apikey:key,...(token?{Authorization:'Bearer '+token}:!key.startsWith('sb_')?{Authorization:'Bearer '+key}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 return {ok:r.ok,status:r.status,data:await r.json().catch(()=>({}))};
}
export function identity(user){
 if(!user?.id||!user.email||!user.email_confirmed_at)return null;
 if(user.id===env.FOLIO_ADMIN_AUTH_ID)return {id:'folio-admin',email:user.email,name:'Správce Folia',role:'admin',subjects:[]};
 if(user.app_metadata?.folio_role!=='teacher')return null;
 return {id:user.id,email:user.email,name:String(user.app_metadata.folio_name||user.email).slice(0,160),role:'teacher',subjects:Array.isArray(user.app_metadata.folio_subjects)?user.app_metadata.folio_subjects.filter(x=>typeof x==='string'):[]};
}
function tokenFrom(req){try{return decodeURIComponent((req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'')}catch{return ''}}
export async function currentIdentity(req){const token=tokenFrom(req);if(!token)return null;const r=await auth('/user',{token});if(!r.ok){if([401,403].includes(r.status))return null;throw Error('Ověření relace selhalo.');}return identity(r.data);}
async function body(req){let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>16384)throw Error('Příliš velký požadavek.');chunks.push(c);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
export async function account(req,res,path,local,user){
 if(path==='/api/account/login'&&req.method==='POST'){
  const d=await body(req);if(typeof d.email!=='string'||typeof d.password!=='string')return send(res,400,{error:'Vyplňte e-mail a heslo.'});
  const r=await auth('/token?grant_type=password',{method:'POST',body:{email:d.email,password:d.password}});
  if(!r.ok||!identity(r.data.user))return send(res,401,{error:'Neplatné údaje nebo účet nemá přístup do Folia.'});
  return send(res,200,{ok:true},cookie(r.data.access_token,Math.min(Number(r.data.expires_in)||3600,3600),local));
 }
 if(path==='/api/account/logout'&&req.method==='POST'){
  const token=tokenFrom(req);if(token)await auth('/logout',{method:'POST',token}).catch(()=>{});return send(res,200,{ok:true},cookie('',0,local));
 }
 if(path!=='/api/account/teachers')return send(res,404,{error:'Nenalezeno.'});
 if(user?.role!=='admin')return send(res,403,{error:'Pouze správce.'});
 if(req.method==='GET'){
  const teachers=[];for(let page=1;page<=100;page++){const r=await auth(`/admin/users?page=${page}&per_page=100`,{privileged:true});if(!r.ok)throw Error('Načtení účtů selhalo.');const users=r.data.users||[];for(const x of users){const u=identity(x);if(u?.role==='teacher')teachers.push(u);}if(users.length<100)break;}return send(res,200,teachers);
 }
 if(req.method==='POST'){
  const d=await body(req);if(typeof d.name!=='string'||!d.name.trim()||!Array.isArray(d.subjects)||d.subjects.length>200||d.subjects.some(x=>typeof x!=='string'||x.length>160))return send(res,400,{error:'Neplatné údaje.'});
  const app_metadata={folio_role:'teacher',folio_name:d.name.trim().slice(0,160),folio_subjects:[...new Set(d.subjects)]};
  if(d.id){if(typeof d.id!=='string'||! /^[0-9a-f-]{36}$/i.test(d.id)||d.id===env.FOLIO_ADMIN_AUTH_ID)return send(res,400,{error:'Neplatný účet.'});const old=await auth('/admin/users/'+d.id,{privileged:true});if(!old.ok||identity(old.data)?.role!=='teacher')return send(res,404,{error:'Učitel nenalezen.'});const r=await auth('/admin/users/'+d.id,{method:'PUT',privileged:true,body:{app_metadata:{...old.data.app_metadata,...app_metadata}}});return send(res,r.ok?200:400,r.ok?{ok:true}:{error:'Úprava účtu selhala.'});}
  if(typeof d.email!=='string'||typeof d.password!=='string'||d.password.length<12)return send(res,400,{error:'Vyplňte e-mail a heslo alespoň 12 znaků.'});
  const r=await auth('/admin/users',{method:'POST',privileged:true,body:{email:d.email,password:d.password,email_confirm:true,app_metadata}});return send(res,r.ok?200:400,r.ok?{ok:true}:{error:'Účet se nepodařilo vytvořit. Zkontrolujte e-mail a heslo.'});
 }
 return send(res,405,{error:'Nepodporovaná metoda.'});
}
