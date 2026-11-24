import {account,currentIdentity} from "./auth.mjs";
import bundle from "../dist/server/index.cjs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const env=process.env;
async function supabase(path,options={}){
  const key=env.SUPABASE_SERVER_KEY;
  const response=await fetch(env.SUPABASE_URL.replace(/\/$/,"")+path,{
    ...options,headers:{apikey:key,...(!key.startsWith("sb_")?{Authorization:"Bearer "+key}:{}),...options.headers}
  });
  if(!response.ok)throw Error("Supabase HTTP "+response.status);
  return response;
}
const DB={async rpc(name,data){
  return (await supabase("/rest/v1/rpc/"+name,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)})).json();
}};
const pathFor=id=>"/storage/v1/object/folio-files/"+id.split("/").map(encodeURIComponent).join("/");
const BUCKET={
  put:(id,bytes)=>supabase(pathFor(id),{method:"POST",headers:{"Content-Type":"application/octet-stream"},body:bytes}),
  async get(id){return supabase(pathFor(id).replace("/object/","/object/authenticated/"))},
  delete:id=>supabase("/storage/v1/object/folio-files",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({prefixes:[id]})})
};

export const config = { api: { bodyParser: false } };
export function createHandler({ db = DB, bucket = BUCKET, localOrigin } = {}) {
 return async function handler(req,res){
  try{
    const adminMode=(env.FOLIO_MODE||(localOrigin?"admin":"public"))==="admin";
    const publicOrigin=localOrigin||env.FOLIO_PUBLIC_ORIGIN;
    const adminOrigin=localOrigin ? (adminMode?localOrigin:undefined) : env.FOLIO_ADMIN_ORIGIN;
    if((db===DB&&(!env.SUPABASE_URL||!env.SUPABASE_SERVER_KEY))||!publicOrigin)throw Error("Chybí konfigurace Folia.");
    const local=localOrigin||env.VERCEL_ENV==="development";
    const origin=(local?"http://":"https://")+req.headers.host;
    const ADMIN=adminMode && origin===adminOrigin;
    if(adminMode&&!ADMIN){res.writeHead(403).end("Použijte adresu administrace.");return;}
    if(!ADMIN&&origin!==publicOrigin){res.writeHead(403).end("Použijte veřejnou adresu Folia.");return;}
    const url=new URL(req.url,origin);
    if(url.pathname==="/api/index" && url.searchParams.has("_folio_path")){
      url.pathname="/"+url.searchParams.get("_folio_path");
      url.searchParams.delete("_folio_path");
    }
    if(url.origin!==origin){res.writeHead(400).end();return;}
    if(!ADMIN && /^\/(ucitel|moderator)(\/|$)/.test(url.pathname)){
      if(adminOrigin){res.writeHead(302,{Location:adminOrigin+url.pathname}).end();return;}
      res.writeHead(404).end();return;
    }
    const headers=new Headers();
    for(const [name,value] of Object.entries(req.headers))if(value!=null)headers.set(name,String(value));
    const hasBody=!["GET","HEAD"].includes(req.method);
    if(hasBody&&headers.get("origin")!==origin){res.writeHead(403).end("Neplatný původ požadavku.");return;}
    const user=ADMIN && env.SUPABASE_URL && env.SUPABASE_ANON_KEY ? await currentIdentity(req) : null;
    if(url.pathname.startsWith("/api/account/")){
      if(!ADMIN){res.writeHead(404).end();return;}
      if(!env.SUPABASE_URL||!env.SUPABASE_ANON_KEY||!env.FOLIO_ADMIN_AUTH_ID){res.writeHead(503,{"Content-Type":"application/json","Cache-Control":"no-store"}).end(JSON.stringify({error:"Není nastavena konfigurace Supabase Auth."}));return;}
      await account(req,res,url.pathname,!!local,user);return;
    }
    const result=await bundle.default.fetch(new Request(url,{method:req.method,headers,body:hasBody?Readable.toWeb(req):undefined,duplex:"half"}),{DB:db,BUCKET:bucket,USER:user,PUBLIC_ORIGIN:publicOrigin,ADMIN_ORIGIN:adminOrigin});
    res.writeHead(result.status,Object.fromEntries(result.headers));
    if(result.body)await pipeline(Readable.fromWeb(result.body),res);else res.end();
  }catch(error){
    console.error(error.message);
    if(!res.headersSent)res.writeHead(500);
    res.end("Folio nedokončilo požadavek.");
  }
 };
}

export default createHandler();
