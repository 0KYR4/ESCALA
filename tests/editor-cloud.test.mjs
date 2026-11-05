import test from 'node:test';
import assert from 'node:assert/strict';
import {serializeModel,RevisionConflict} from '../editor-cloud.mjs';
test('normalizes before serialization and preserves plain text',()=>{
 let called=false;const payload=serializeModel({text:'<img onerror=alert(1)>'},value=>{called=true;return value;});
 assert.ok(called);assert.equal(JSON.parse(payload).text,'<img onerror=alert(1)>');
});
test('enforces the Firebase limit in UTF-8 bytes',()=>{
 assert.throws(()=>serializeModel({text:'电'.repeat(220000)},v=>v),/grande/);
 assert.doesNotThrow(()=>serializeModel({text:'á'.repeat(100000)},v=>v));
});
test('propagates validation failures and identifies revision conflicts',()=>{
 assert.throws(()=>serializeModel({},()=>{throw Error('modelo inválido');}),/inválido/);
 assert.equal(new RevisionConflict().code,'revision-conflict');
});
