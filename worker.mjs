import {policy,retention} from "./lib/retention.mjs";
import {removalPreview,remove} from "./lib/removal.mjs";
import {listFeedback,detailFeedback,publicFeedback,saveFeedback,feedbackStatus,submitFeedback} from "./lib/feedback.mjs";
import {initializeAreas,saveArea,areaDetail,setSubjectIcon} from "./lib/areas.mjs";
import {transact} from './lib/storage.mjs';
import {one,all,sql,key,fail,access,admin} from './lib/db.mjs';
import {spec,seed,catalog,shelf,lesson,quizDetail,save,readable} from './lib/content.mjs';
import {create,join,answer,command,view} from './lib/game.mjs';
import {fileTypeFromBuffer} from 'file-type/core';
import Qr from 'qrcode/lib/core/qrcode.js';
import Svg from 'qrcode/lib/renderer/svg-tag.js';
import assets from './generated-assets.mjs';

const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'};
const json=(v,status=200)=>Response.json(v,{status,headers});
const binary=name=>Uint8Array.from(atob(assets[name]),c=>c.charCodeAt(0));
async function read(req,limit){
 if(Number(req.headers.get('Content-Length')||0)>limit)fail('Soubor je příliš velký.',413);
 const reader=req.body?.getReader();if(!reader)return new Uint8Array();
 const chunks=[];let total=0;for(;;){const{done,value}=await reader.read();if(done)break;total+=value.length;if(total>limit){await reader.cancel();fail('Požadavek překročil limit.',413)}chunks.push(value)}
 const out=new Uint8Array(total);let off=0;for(const c of chunks){out.set(c,off);off+=c.length}return out
}
async function validate(name,bytes){
 const ext=name.split('.').pop().toLowerCase(),types={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',mp3:'audio/mpeg',ogg:'audio/ogg',wav:'audio/wav',mp4:'video/mp4',webm:'video/webm',pdf:'application/pdf',txt:'text/plain'};
 const type=types[ext];if(!type||!bytes.length)fail('Nepodporovaný nebo prázdný soubor.');
 if(ext==='txt'){try{new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(bytes.includes(0))throw Error()}catch{fail('Text musí být v UTF-8.')}}
 else{const x=await fileTypeFromBuffer(bytes);if(x?.mime!==type&&!(ext==='wav'&&x?.ext==='wav')&&!(ext==='ogg'&&['audio/opus','application/ogg'].includes(x?.mime)))fail('Obsah souboru neodpovídá příponě.')}
 return type
}
function fileResponse(bytes,type,range,extra={}){
 const h={...headers,...extra,'Content-Type':type,'Accept-Ranges':'bytes'};
 const m=/^bytes=(\d+)-(\d*)$/.exec(range||'');if(!m)return new Response(bytes,{headers:h});
 const start=+m[1],end=m[2]?Math.min(+m[2],bytes.length-1):bytes.length-1;
 if(start>end)return new Response(null,{status:416,headers:{...h,'Content-Range':'bytes */'+bytes.length}});
 return new Response(bytes.subarray(start,end+1),{status:206,headers:{...h,'Content-Range':`bytes ${start}-${end}/${bytes.length}`}})
}
export default {async fetch(req,env){
 try{const url=new URL(req.url),p=url.pathname.split('/').filter(Boolean),get=k=>url.searchParams.get(k),staff=get('staff')==='1',token=req.headers.get('Authorization')?.replace(/^Bearer /,'');
 const run=fn=>transact(env.DB,()=>{seed();initializeAreas();const u=env.USER||null; if(u?.role==='teacher'){const old=one("SELECT id,email,name,role FROM users WHERE id=?",u.id); if(!old)sql("INSERT INTO users VALUES(?,?,?,?)",u.id,u.email,u.name,"teacher");else if(old.email!==u.email||old.name!==u.name)sql("UPDATE users SET email=?,name=? WHERE id=?",u.email,u.name,u.id);} return fn(u)});
 if(req.method==='GET'&&!['api','soubor','motiv'].includes(p[0])){const name=['/app.js','/style.css'].includes(url.pathname)?url.pathname.slice(1):'index.html';return new Response(binary(name),{headers:{...headers,'Content-Type':name==='app.js'?'text/javascript':name==='style.css'?'text/css':'text/html; charset=utf-8'}})}
 if(req.method==='GET'&&p[0]==='motiv'){const name=p[1];if(name!=='hero.jpg'&&!await run(u=>catalog(u,!!u).some(s=>s.cover===name)||catalog(null).some(s=>s.cover===name)))fail('Nenalezeno.',404);if(!assets[name])fail('Nenalezeno.',404);return fileResponse(binary(name),'image/jpeg')}
 if(req.method==='GET'&&p[0]==='soubor'){const f=await run(u=>{const f=one('SELECT * FROM files WHERE id=?',p[1]);if(!f||!readable(f,u,get('run')))fail('Soubor není dostupný.',404);return f});const source=spec.files.find(x=>x.id===f.id),obj=source?null:await env.BUCKET.get('files/'+f.id);if(!source&&!obj)fail('Soubor nenalezen.',404);return fileResponse(source?binary(source.path):new Uint8Array(await obj.arrayBuffer()),f.type,req.headers.get('Range'),{'Content-Disposition':(get('download')||!/^(image|audio|video)\//.test(f.type)?'attachment':'inline')+"; filename*=UTF-8''"+encodeURIComponent(f.name)})}
 if(p[0]!=='api')fail('Nenalezeno.',404);
 if(req.method==='POST'){
 if(req.headers.get('Origin')&&req.headers.get('Origin')!==url.origin)fail('Nepovolený původ.',403);

 if(p[1]==='subject-photo'){
   await run(u=>{if(!u)fail("Přihlaste se.",401)});
   const data=await new Response(await read(req,4400000),{headers:{'Content-Type':req.headers.get('Content-Type')||''}}).formData();
   const d=JSON.parse(String(data.get('subject'))),photo=data.get('photo');if(!photo||typeof photo==='string'||photo.size>4*1024*1024)fail('Vyberte obrázek do 4 MB.');
   const authorize=u=>{if(d.photoOnly){access(u,d.id);const s=one("SELECT version FROM subjects WHERE id=?",d.id);if(!s||s.version!==d.version)fail("Předmět byl mezitím upraven.",409)}else admin(u)};
   await run(authorize);
   const bytes=new Uint8Array(await photo.arrayBuffer()),name=photo.name.split(/[\\/]/).pop().slice(0,160),type=await validate(name,bytes);if(!type.startsWith("image/"))fail("Vyberte obrázek JPG, PNG nebo WebP.");
   const fid=key();await env.BUCKET.put("files/"+fid,bytes);
   try{return json(await run(u=>{authorize(u);const id=d.photoOnly?d.id:save("subject",d,u).id;if(d.photoOnly)setSubjectIcon(id,d.icon);sql("INSERT INTO files VALUES(?,?,?,?,?)",fid,id,name,type,bytes.length);sql("UPDATE subjects SET cover=?, version=version+? WHERE id=?","file:"+fid,d.photoOnly?1:0,id);return {id,cover:"file:"+fid}}))}catch(e){await env.BUCKET.delete("files/"+fid);throw e}
 }
 if(p[1]==='upload'){const sid=get('sid'),name=(get('name')||'').split(/[\\/]/).pop().slice(0,160);await run(u=>access(u,sid));const bytes=await read(req,4*1024*1024),type=await validate(name,bytes),fid=key();await env.BUCKET.put('files/'+fid,bytes);try{await run(u=>{access(u,sid);sql('INSERT INTO files VALUES(?,?,?,?,?)',fid,sid,name,type,bytes.length)})}catch(e){await env.BUCKET.delete('files/'+fid);throw e}return json({id:fid,name,type,size:bytes.length})}
 if(!req.headers.get('Content-Type')?.includes('application/json'))fail('Očekává se JSON.',415);const d=JSON.parse(new TextDecoder().decode(await read(req,2*1024*1024))||'{}');
 if(p[1]==='respond')return json(await transact(env.DB,()=>submitFeedback(p[2],d)));
 return json(await run(u=>{switch(p[1]){case 'remove':return remove(d,u);case 'feedback':return saveFeedback(d,u);case 'feedback-status':return feedbackStatus(d,u);case 'area':return saveArea(d,u);case 'subject-icon':{access(u,d.id);if(one('SELECT version FROM subjects WHERE id=?',d.id)?.version!==d.version)fail('Předmět byl mezitím upraven.',409);setSubjectIcon(d.id,d.icon);sql('UPDATE subjects SET version=version+1 WHERE id=?',d.id);return {id:d.id}}case 'retention-save':return retention(u,'save',d);case 'retention-purge':return retention(u,'purge',d);case 'subject':case 'task':case 'quiz':case 'share':return save(p[1],d,u);case 'create':return create(u,d);case 'join':return join(d.pin,d.name,d.avatar);case 'answer':return answer(p[2],token,d);case 'command':return command(p[2],u,d);default:fail('Nenalezeno.',404)}}))}
 if(req.method!=='GET')fail('Nepodporovaná metoda.',405);
 if(p[1]==='survey')return json(await transact(env.DB,()=>publicFeedback(p[2])));
 const v=await run(u=>{switch(p[1]){case 'retention':return retention(u,'preview');case 'retention-policy':return policy();case 'task-qr':return lesson(p[2],null,false).id;case 'removal':return removalPreview(p[2],p[3],u);case 'feedback':return p[2]?detailFeedback(p[2],u):listFeedback(u);case 'feedback-qr':{const f=detailFeedback(p[2],u);if(f.status!=='open')fail('Nejprve otevřete sběr.',409);return f.share;}case 'me':return u;case 'config':return {publicOrigin:env.PUBLIC_ORIGIN||url.origin,adminOrigin:env.ADMIN_ORIGIN||null};case 'files':access(u,p[2]);return all('SELECT id,name,type,size FROM files WHERE sid=? ORDER BY name',p[2]);case 'catalog':return catalog(u,staff);case 'area':return areaDetail(p[2],u,staff);case 'subject':return shelf(p[2],u,staff);case 'task':return lesson(p[2],u,staff);case 'quiz':return quizDetail(p[2],u,get('task'));case 'game':return view(p[2],u,token,staff);case 'qr':case 'projectqr':return view(p[2],u,null,p[1]==='qr').pin;case 'history':if(!u)fail('Přihlaste se.',403);return all("SELECT r.id,r.pin,r.started,r.ended,r.early,json_extract(r.body,'$.title') title,json_extract(r.body,'$.settings.group') className,(SELECT count(*) FROM players p WHERE p.run=r.id) players,r.sid,r.owner FROM runs r ORDER BY r.started DESC").filter(r=>u.role==='admin'||(r.owner===u.id&&u.subjects.includes(r.sid)));default:fail('Nenalezeno.',404)}});
 if(p[1]==='task-qr')return new Response(Svg.render(Qr.create((env.PUBLIC_ORIGIN||url.origin)+'/ukol/'+encodeURIComponent(v)),{width:480,margin:4}),{headers:{...headers,'Content-Type':'image/svg+xml'}});
 if(p[1]==='feedback-qr')return new Response(Svg.render(Qr.create((env.PUBLIC_ORIGIN||url.origin)+'/zpetna-vazba/'+v),{width:420,margin:4}),{headers:{...headers,'Content-Type':'image/svg+xml'}});
 if(['qr','projectqr'].includes(p[1]))return new Response(Svg.render(Qr.create((env.PUBLIC_ORIGIN||url.origin)+'/pripojit/'+v),{width:300,margin:4}),{headers:{...headers,'Content-Type':'image/svg+xml'}});return json(v);
 }catch(e){const status=e.status||(e.name==='ZodError'||e instanceof SyntaxError?400:500);if(status===500)console.error('Folio: '+e.message);return json({error:status===500?'Server požadavek nedokončil.':e.name==='ZodError'?'Neplatná hodnota pole '+e.issues[0].path.join('.')+'.':e.message},status)}
}};
