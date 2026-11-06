import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const context={window:{}};vm.runInNewContext(readFileSync(new URL('../firebase-config.js',import.meta.url),'utf8'),context);
const cfg=context.window.ESCALA_FIREBASE_CONFIG,api='https://firestore.googleapis.com/v1/';
const root=`projects/${cfg.projectId}/databases/(default)/documents`,sessions=[];
let draftPath;
async function req(url,method='GET',body,session){const r=await fetch(url,{method,headers:{'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.idToken}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json().catch(()=>({}))};}
function check(r,status,label){assert.equal(r.status,status,label+': '+(r.data.error?.message||''));console.log('PASS '+label);}
function write(payload,extra={}){const values={schema:{integerValue:'1'},payload:{stringValue:payload},baseRevision:{integerValue:'0'},ownerUid:{stringValue:sessions[0].localId},...extra};return {writes:[{update:{name:draftPath,fields:values},updateTransforms:[{fieldPath:'updatedAt',setToServerValue:'REQUEST_TIME'}]}]};}
try{
 for(let i=0;i<2;i++){const r=await req(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${cfg.apiKey}`,'POST',{returnSecureToken:true});check(r,200,'anonymous session '+i);sessions.push(r.data);}
 const [a,b]=sessions;draftPath=root+'/escala_boards/test-'+crypto.randomUUID()+'/drafts/'+a.localId;
 const before=await req(api+root+'/escala_boards/main','GET',undefined,a);check(before,200,'read public baseline');
 check(await req(api+root+':commit','POST',write('{"draft":"one"}'),a),200,'save private draft');
 check(await req(api+draftPath,'GET',undefined,a),200,'owner can recover draft');
 check(await req(api+draftPath,'GET',undefined,b),403,'another session cannot read draft');
 check(await req(api+draftPath,'GET'),403,'unauthenticated reader denied');
 check(await req(api+root+':commit','POST',write('{"draft":"one"}'),a),403,'identical payload rejected');
 check(await req(api+root+':commit','POST',write('{"draft":"two"}'),b),403,'another session cannot overwrite draft');
 check(await req(api+root+':commit','POST',write('{"draft":"two"}',{extra:{stringValue:'invalid'}}),a),403,'extra fields rejected');
 check(await req(api+root+':commit','POST',write('{"draft":"two"}',{baseRevision:{integerValue:'-1'}}),a),403,'invalid revision rejected');
 check(await req(api+root+':commit','POST',write('{"draft":"two"}'),a),200,'changed payload saved');
 const after=await req(api+root+'/escala_boards/main','GET',undefined,a);check(after,200,'read public baseline after draft');assert.deepEqual(after.data.fields,before.data.fields);console.log('PASS public structure unchanged');
}finally{
 if(draftPath&&sessions[0])check(await req(api+draftPath,'DELETE',undefined,sessions[0]),200,'remove disposable draft');
 for(const session of sessions)check(await req(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${cfg.apiKey}`,'POST',{idToken:session.idToken}),200,'remove disposable identity');
}
