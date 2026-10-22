import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Content-Type":"application/json"};
const out=(x:any,s=200)=>new Response(JSON.stringify(x),{status:s,headers:H});
const hex=(b:ArrayBuffer)=>Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,"0")).join("");
Deno.serve(async req=>{if(req.method==="OPTIONS")return new Response("ok",{headers:H});try{
 const jwt=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"");if(!jwt)return out({error:"Sesión requerida"},401);
 const url=Deno.env.get("SUPABASE_URL")!,pub=Deno.env.get("SUPABASE_ANON_KEY")!,svc=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const au=createClient(url,pub,{global:{headers:{Authorization:"Bearer "+jwt}}});const {data:u,error:ue}=await au.auth.getUser(jwt);if(ue||!u.user)return out({error:"Sesión inválida"},401);
 const db=createClient(url,svc),i=await req.json(),token=String(i.token||"");if(!/^[0-9a-f]{64}$/.test(token))return out({error:"Enlace inválido"},400);
 const hash=hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token)));const {data:l}=await db.from("memory_share_links").select("space_id,can_view,can_contribute,revoked_at").eq("token_hash",hash).maybeSingle();
 if(!l||l.revoked_at||!l.can_view)return out({error:"Este enlace ya no está disponible"},403);
 const action=String(i.action||"open");
 if(action==="edit"){
   if(!l.can_contribute)return out({error:"Este enlace es solo para ver"},403);
   const mediaId=String(i.media_id||"");if(!mediaId)return out({error:"Recuerdo inválido"},400);
   const {data:m}=await db.from("media").select("id,memory_id,space_id").eq("id",mediaId).eq("space_id",l.space_id).maybeSingle();
   if(!m)return out({error:"Recuerdo inválido"},404);
   const clean=(v:any)=>{const s=String(v??"").trim();return s?s:null};
   const title=clean(i.title),story=clean(i.story),date=clean(i.captured_date_text);
   const {error:me}=await db.from("media").update({title,story,captured_date_text:date}).eq("id",m.id).eq("space_id",l.space_id);
   if(me)return out({error:"No pudimos guardar la información"},500);
   if(m.memory_id){const {error:re}=await db.from("memories").update({title,story,captured_date_text:date}).eq("id",m.memory_id).eq("space_id",l.space_id);if(re)return out({error:"La foto cambió, pero no pudimos completar el recuerdo"},500);}
   return out({ok:true,title,story,captured_date_text:date});
 }
 if(action==="add"){
   if(!l.can_contribute)return out({error:"Este enlace es solo para ver"},403);
   const path=String(i.object_path||""),kind=i.kind==="video"?"video":"photo",mime=String(i.mime_type||""),size=Number(i.size_bytes||0);
   if(!path.startsWith(l.space_id+"/guest/")||size<1||size>25*1024*1024)return out({error:"Archivo no permitido"},400);
   const {data:m,error:me}=await db.from("memories").insert({space_id:l.space_id,title:i.title||null,story:i.story||null,captured_date_text:i.captured_date_text||null}).select("id").single();if(me)return out({error:"No pudimos preparar el recuerdo"},500);
   const {data:up,error:se}=await db.storage.from("entrenos-private").createSignedUploadUrl(path);
   if(se||!up?.token){await db.from("memories").delete().eq("id",m.id);return out({error:"No pudimos preparar la foto"},500)}
   return out({memory_id:m.id,path,upload_token:up.token});
 }
 if(action==="finish"){
   if(!l.can_contribute)return out({error:"Este enlace es solo para ver"},403);
   const path=String(i.object_path||"");if(!path.startsWith(l.space_id+"/guest/"))return out({error:"Archivo no permitido"},400);
   const {data:mem}=await db.from("memories").select("id").eq("id",i.memory_id).eq("space_id",l.space_id).maybeSingle();if(!mem)return out({error:"Recuerdo inválido"},400);
   const {error:e}=await db.from("media").insert({space_id:l.space_id,memory_id:mem.id,kind:i.kind==="video"?"video":"photo",object_path:path,mime_type:i.mime_type||null,size_bytes:Number(i.size_bytes||0),title:i.title||null,story:i.story||null,captured_date_text:i.captured_date_text||null});if(e)return out({error:"No pudimos terminar de guardar"},500);return out({ok:true});
 }
 const {data:s}=await db.from("spaces").select("id,name").eq("id",l.space_id).single();
 const r:any[]=[];
 for(let offset=0;;offset+=500){
   const {data:page,error:e}=await db.from("media").select("id,object_path,kind,title,story,captured_at,captured_date_text,sort_order,is_cover,is_closing,thumbnail_y,created_at").eq("space_id",l.space_id).order("is_cover",{ascending:false}).order("is_closing",{ascending:true}).order("sort_order").order("created_at",{ascending:false}).order("id").range(offset,offset+499);
   if(e)return out({error:"No pudimos cargar el álbum"},500);
   r.push(...(page||[]));if((page||[]).length<500)break;
 }
 const files:any[]=[];
 for(let offset=0;offset<r.length;offset+=24){
   files.push(...await Promise.all(r.slice(offset,offset+24).map(async x=>{const {data:z}=await db.storage.from("entrenos-private").createSignedUrl(x.object_path,1800);return{...x,url:z?.signedUrl||null}})));
 }
 return out({space:s,can_contribute:l.can_contribute,files:files.filter(x=>x.url)});
}catch(e){console.error(e);return out({error:"No pudimos abrir estos Recuerdos"},500)}});
