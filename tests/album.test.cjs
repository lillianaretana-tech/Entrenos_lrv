const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
test('shared album returns all 2002 pages with cover first and closing last',async()=>{
 const rows=Array.from({length:2002},(_,i)=>({id:String(i),object_path:'space/'+i,is_cover:i===0,is_closing:i===2001}));
 const ranges=[],orders=[];let handler;
 const db={from(table){if(table==='memory_share_links')return{select(){return this},eq(){return this},async maybeSingle(){return{data:{space_id:'space',can_view:true,can_contribute:false}}}};if(table==='spaces')return{select(){return this},eq(){return this},async single(){return{data:{id:'space',name:'Familia'}}}};
 const q={select(){return q},eq(){return q},order(...args){orders.push(args);return q},async range(a,b){ranges.push([a,b]);return{data:rows.slice(a,b+1),error:null}}};return q},storage:{from(){return{async createSignedUrl(path){return{data:{signedUrl:'https://example.test/'+path}}}}}}};
 let code=fs.readFileSync(__dirname+'/../supabase/functions/memory-guest/index.ts','utf8').replace(/^import .*;\n/gm,'');
 code=stripTypeScriptTypes(code);
 vm.runInNewContext(code,{Deno:{env:{get:key=>key},serve:fn=>handler=fn},createClient:(url,key)=>key==='SUPABASE_SERVICE_ROLE_KEY'?db:{auth:{getUser:async()=>({data:{user:{id:'visitor'}}})}},crypto:globalThis.crypto,TextEncoder,Response,console});
 const request=body=>new Request('https://example.test',{method:'POST',headers:{authorization:'Bearer fake'},body:JSON.stringify({token:'a'.repeat(64),...body})});
 const response=await handler(request({action:'open'})),data=await response.json();
 assert.equal(response.status,200);assert.equal(data.files.length,2002);assert.equal(data.files[0].is_cover,true);assert.equal(data.files.at(-1).is_closing,true);assert.equal(ranges.length,5);assert.deepEqual(ranges.at(-1),[2000,2499]);assert.ok(orders.some(([name,options])=>name==='is_closing'&&options.ascending));
 assert.equal((await handler(request({action:'edit',media_id:'0'}))).status,403);
});
