const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
test('admin gallery shows fixed roles, correct dates, and valid controls',async()=>{
 const html=fs.readFileSync(__dirname+'/../index.html','utf8');
 const code=html.slice(html.indexOf('async function loadMemoryGallery()'),html.indexOf('function updateMemorySelected()'));
 const gallery={innerHTML:''};
 const files=[{id:'cover',memory_id:'m1',kind:'photo',is_cover:true,is_closing:false,captured_date_text:'1970'},{id:'normal',memory_id:'m2',kind:'photo',is_cover:false,is_closing:false},{id:'closing',memory_id:'m3',kind:'photo',is_cover:false,is_closing:true}];
 const q={select(){return q},eq(){return q},order(){return q},async range(){return{data:files,error:null}}};
 const ctx=vm.createContext({document:{getElementById:()=>gallery},currentMemorySpace:{id:'space'},sb:{from:()=>q,storage:{from:()=>({createSignedUrl:async()=>({data:{signedUrl:'https://example.test/photo'}})})}},escapeHtml:x=>String(x??''),formatMemoryDate:x=>x,encodeURIComponent});
 vm.runInContext(code,ctx);await vm.runInContext('loadMemoryGallery()',ctx);
 const cards=gallery.innerHTML.match(/<article[\s\S]*?<\/article>/g);
 assert.equal(cards.length,3);assert.match(cards[0],/⭐ Portada fija/);assert.match(cards[0],/1970/);assert.doesNotMatch(cards[0],/Fecha pendiente|🔢 Mover/);assert.match(cards[1],/🔢 Mover/);assert.match(cards[2],/❤️ Cierre fijo/);assert.doesNotMatch(cards[2],/🔢 Mover/);
 for(const [,handler]of gallery.innerHTML.matchAll(/onclick="([^"]*)"/g))assert.doesNotThrow(()=>new Function(handler));
});
