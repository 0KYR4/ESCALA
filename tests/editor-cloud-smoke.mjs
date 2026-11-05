import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fromData} from '../editor-model.mjs';
const context={window:{}};vm.runInNewContext(readFileSync(new URL('../firebase-config.js',import.meta.url),'utf8'),context);
const cfg=context.window.ESCALA_FIREBASE_CONFIG;
const root=`projects/${cfg.projectId}/databases/(default)/documents`;
const api='https://firestore.googleapis.com/v1/';
const board=`${root}/escala_boards/test-${crypto.randomUUID()}`;
const sessions=[],archives=[];let created=false,checks=0;
const source=JSON.parse(readFileSync(new URL('../index.html',import.meta.url),'utf8').match(/const DATA=([\s\S]*?);\r?\nconst \$/)[1]);
const seed=JSON.stringify(fromData(source));
async function req(url,method='GET',body,session){
 const response=await fetch(url,{method,headers:{'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.idToken}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 return {status:response.status,data:await response.json().catch(()=>({}))};
}
function check(result,expected,label){assert.ok([expected].flat().includes(result.status),label+': '+result.status+' '+(result.data.error?.message||''));checks++;console.log('PASS '+label);}
function fields(object){return Object.fromEntries(Object.entries(object).map(([key,value])=>[key,typeof value==='number'?{integerValue:String(value)}:{stringValue:value}]));}
const time=fieldPath=>({fieldPath,setToServerValue:'REQUEST_TIME'});
function stateWrite(name,object){return {update:{name,fields:fields(object)},updateTransforms:[time('updatedAt')]};}
function archiveWrite(name,object){return {update:{name,fields:fields(object)},currentDocument:{exists:false},updateTransforms:[time('savedAt')]};}
async function commit(writes,session){return req(api+root+':commit','POST',{writes},session);}
function saveWrites(previous,payload,session,extra={}){
 const id=crypto.randomUUID(),archive=board+'/history/'+id;archives.push(archive);
 return [archiveWrite(archive,{revision:previous.revision,payload:previous.payload,savedBy:session.localId}),stateWrite(board,{schema:1,revision:previous.revision+1,payload,updatedBy:session.localId,backupId:id,...extra})];
}
function decode(document){return Object.fromEntries(Object.entries(document.fields).map(([k,v])=>[k,v.stringValue??Number(v.integerValue)]));}
try{
 for(let i=0;i<2;i++){const r=await req(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${cfg.apiKey}`,'POST',{returnSecureToken:true});check(r,200,'independent anonymous session '+(i+1));sessions.push(r.data);}
 const [a,b]=sessions;assert.notEqual(a.localId,b.localId);
 const initial={revision:0,payload:seed};
 check(await commit(saveWrites(initial,seed,a),a),200,'initial shared save with atomic backup');created=true;
 const first=await req(api+board,'GET',undefined,b);check(first,200,'second session reads saved structure');let previous=decode(first.data);assert.equal(previous.payload,seed);
 const edited=JSON.parse(seed);edited.pairs[0].gantt.name='TESTE TEMPORÁRIO DE SINCRONIZAÇÃO';const payload=JSON.stringify(edited);
 check(await commit(saveWrites(previous,payload,b),b),200,'second visitor edits shared structure');
 const current=await req(api+board,'GET',undefined,a);check(current,200,'first visitor sees second visitor edit');previous=decode(current.data);assert.equal(JSON.parse(previous.payload).pairs[0].gantt.name,edited.pairs[0].gantt.name);
 check(await commit(saveWrites({revision:1,payload:seed},seed,a),a),403,'deny stale revision overwrite');
 check(await commit([stateWrite(board,{schema:1,revision:3,payload:seed,updatedBy:a.localId,backupId:'missing'})],a),403,'deny update without backup');
 check(await commit(saveWrites(previous,seed,a,{extra:'forbidden'}),a),403,'deny unknown fields');
 check(await commit(saveWrites(previous,'x'.repeat(650001),a),a),403,'deny oversized payload');
 check(await commit(saveWrites(previous,seed,a,{revision:5}),a),403,'deny revision jump');
 check(await commit(saveWrites(previous,seed,a,{updatedBy:b.localId}),a),403,'deny forged editor identity');
 check(await commit(saveWrites(previous,seed,a)),403,'deny write without authentication');
 check(await req(api+board),403,'deny read without authentication');
 const altered=saveWrites(previous,seed,a);altered[0].update.fields.payload={stringValue:'not the previous version'};
 check(await commit(altered,a),403,'deny corrupted history snapshot');
 check(await commit([stateWrite(archives[0],{payload:'tampered'})],a),403,'deny history mutation');
 const attempts=await Promise.all([commit(saveWrites(previous,seed,a),a),commit(saveWrites(previous,payload,b),b)]);
 assert.equal(attempts.filter(r=>r.status===200).length,1);assert.ok(attempts.some(r=>[403,409,412].includes(r.status)));checks++;console.log('PASS concurrent saves: exactly one winner');
 const latest=await req(api+board,'GET',undefined,a);previous=decode(latest.data);
 check(await commit(saveWrites(previous,seed,a),a),200,'restore previous structure as new revision');
 const query=await req(api+board+':runQuery','POST',{structuredQuery:{from:[{collectionId:'history'}],orderBy:[{field:{fieldPath:'revision'},direction:'DESCENDING'}],limit:10}},b);
 check(query,200,'history query from independent session');assert.ok(query.data.filter(r=>r.document).length>=4);
 check(await commit([{delete:root+'/escala_boards/main'}],a),403,'deny deletion of production structure');
 check(await commit([stateWrite(root+'/unrelated/invalid',{payload:seed})],a),403,'deny writes outside editor paths');
 if(process.argv.includes('--verify-preview')){
   const result=await req(api+root+'/escala_boards/preview','GET',undefined,b);check(result,200,'read preview created by website from independent session');
   assert.equal(JSON.parse(decode(result.data).payload).pairs[0].gantt.name,'VALIDAÇÃO ONLINE ESCALA');
 }
 console.log(`All ${checks} live shared-editor checks passed.`);
}finally{
 if(sessions[0]){
   for(const archive of archives){const result=await commit([{delete:archive}],sessions[0]);if(![200,404].includes(result.status))console.error('Temporary history cleanup failed.');}
   if(created){const result=await commit([{delete:board}],sessions[0]);if(result.status!==200)console.error('Temporary board cleanup failed.');}
 }
 for(const session of sessions)await req(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${cfg.apiKey}`,'POST',{idToken:session.idToken});
}
