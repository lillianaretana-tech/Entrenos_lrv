const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const helper=html.slice(html.indexOf('let memoryVoicePending='),html.indexOf('let memoryRecorder=null,'));
function setup(failAt){
 const file=new File(['a recorded family story'],'historia.webm',{type:'audio/webm;codecs=opus'});
 const els=Object.fromEntries(['memorySaveMsg','saveMemoryBtn','memoryTitle','memoryStory','memoryDate','memoryFile','memoryComposer'].map(id=>[id,{value:'',disabled:false,innerHTML:'',textContent:''}]));
 els.memoryTitle.value='Historia';els.memoryStory.value='Contexto';els.memoryFile.files=[];
 els.memoryComposer.querySelectorAll=()=>[els.saveMemoryBtn,els.memoryTitle,els.memoryStory];
 const rows={memories:new Map(),media:new Map()},counts={memories:0,media:0,uploads:0};let stored=null,fail=failAt;
 function maybeFail(key){if(fail===key){fail=null;return {error:new Error('simulated '+key),data:null}}}
 const sb={
 from(table){return {
   select(){let id;const q={eq(k,v){if(k==='id')id=v;return q},async maybeSingle(){return maybeFail(table+'Read')||{data:rows[table].get(id)||null,error:null}}};return q},
   insert(payload){counts[table]++;rows[table].set(payload.id,{...payload});return {select:()=>({single:async()=>maybeFail(table+'Insert')||{data:{...payload},error:null}})}},
   update(payload){let id;const q={eq(k,v){if(k==='id')id=v;return q},select(){return q},async single(){Object.assign(rows[table].get(id),payload);return {data:{id},error:null}}};return q}
 }},
 storage:{from(){return {
   async upload(path,blob,options){counts.uploads++;assert.equal(options.contentType,'audio/webm');const err=maybeFail('upload');if(err)return err;stored=blob;return {data:{path},error:null}},
   async download(){const err=maybeFail('download');if(err)return err;if(fail==='mismatch'){fail=null;return {data:new Blob(['x'.repeat(file.size)]),error:null}}return {data:stored,error:null}}
 }}}
 };
 const ctx=vm.createContext({sb,document:{getElementById:id=>els[id]},currentMemorySpace:{id:'space'},currentUser:{id:'owner'},memoryRecorder:null,memoryRecordedFile:file,crypto:globalThis.crypto,console:{error(){},warn(){}},loadMemoryGallery:async()=>{},closeMemoryComposer(){}});
 vm.runInContext(helper,ctx);
 return{ctx,els,rows,counts,file,save:()=>vm.runInContext('saveMemoryVoice()',ctx)};
}
test('voice verifies file and row before success',async()=>{const x=setup();await x.save();assert.match(x.els.memorySaveMsg.innerHTML,/Guardado ❤️/);assert.equal(x.rows.media.size,1);assert.equal(x.ctx.memoryRecordedFile,x.file);await x.save();assert.equal(x.counts.media,1)});
for(const phase of ['memoriesRead','memoriesInsert','upload','download','mediaInsert','mediaRead','mismatch'])test('retry preserves audio and avoids duplicate rows after '+phase,async()=>{const x=setup(phase);await x.save();assert.match(x.els.memorySaveMsg.innerHTML,/No se pudo guardar/);assert.doesNotMatch(x.els.memorySaveMsg.innerHTML,/Guardado ❤️/);assert.equal(x.ctx.memoryRecordedFile,x.file);assert.equal(x.els.saveMemoryBtn.disabled,false);await x.save();assert.match(x.els.memorySaveMsg.innerHTML,/Guardado ❤️/);assert.equal(x.rows.memories.size,1);assert.equal(x.rows.media.size,1);assert.equal(x.counts.memories,1);assert.equal(x.counts.media,1)});
test('double save uses one pending operation',async()=>{const x=setup();await Promise.all([x.save(),x.save()]);assert.equal(x.counts.media,1);assert.equal(x.counts.uploads,1)});
