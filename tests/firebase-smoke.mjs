import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context = { window: {} };
vm.runInNewContext(readFileSync(new URL('../firebase-config.js', import.meta.url), 'utf8'), context);
const config = context.window.ESCALA_FIREBASE_CONFIG;
const root = `projects/${config.projectId}/databases/(default)/documents`;
const endpoint = `https://firestore.googleapis.com/v1/${root}`;
const sessions = [];
const documents = [];
let checks = 0;
async function request(url, method, body, token) {
  const response = await fetch(url, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}
function check(result, expected, label) {
  assert.equal(result.status, expected, `${label}: ${result.data.error?.message || result.status}`);
  checks++;
  console.log(`PASS ${label}`);
}
function fields(data) {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, { stringValue: value }]));
}
function write(name, data, creating = false) {
  return { update: { name, fields: fields(data) },
    ...(creating ? { currentDocument: { exists: false } } : { updateMask: { fieldPaths: Object.keys(data) } }),
    updateTransforms: (creating ? ['createdAt', 'updatedAt'] : ['updatedAt']).map(fieldPath => ({ fieldPath, setToServerValue: 'REQUEST_TIME' })) };
}
async function commit(writes, session) {
  return request(`${endpoint}:commit`, 'POST', { writes }, session?.idToken);
}
try {
  for (let i = 0; i < 2; i++) {
    const result = await request(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${config.apiKey}`, 'POST', { returnSecureToken: true });
    check(result, 200, `anonymous session ${i + 1}`);
    sessions.push(result.data);
  }
  const [a, b] = sessions;
  assert.notEqual(a.localId, b.localId);
  const name = `${root}/escala_comments/validation-${Date.now()}`;
  const base = { serviceId: '01', stage: '', task: '', author: 'Teste de integração', text: 'Teste temporário de sincronização ESCALA', ownerUid: a.localId };
  check(await commit([write(name, base, true)], a), 200, 'create comment as owner');
  documents.push(name);
  const second = await request(`https://firestore.googleapis.com/v1/${name}`, 'GET', undefined, b.idToken);
  check(second, 200, 'read comment from independent session');
  assert.equal(second.data.fields.text.stringValue, base.text);
  check(await request(`${endpoint}:runQuery`, 'POST', { structuredQuery: { from: [{ collectionId: 'escala_comments' }], where: { fieldFilter: { field: { fieldPath: 'serviceId' }, op: 'EQUAL', value: { stringValue: '01' } } } } }, b.idToken), 200, 'application service query');
  check(await commit([write(name, { text: 'Tentativa de outra sessão' })], b), 403, 'deny non-owner edit');
  check(await commit([{ delete: name }], b), 403, 'deny non-owner delete');
  check(await commit([write(name, { text: 'x'.repeat(2001) })], a), 403, 'deny oversized edit');
  check(await commit([write(name, { ownerUid: b.localId })], a), 403, 'deny ownership change');
  check(await commit([write(name, { serviceId: '02' })], a), 403, 'deny service change');
  check(await commit([write(name, { isAdmin: 'true' })], a), 403, 'deny extra fields');
  check(await commit([write(name, { text: '' })], a), 403, 'deny empty edit');
  const invalidName = `${name}-invalid`;
  check(await commit([write(invalidName, { ...base, ownerUid: b.localId }, true)], a), 403, 'deny forged owner');
  check(await commit([write(invalidName, { ...base, text: 'x'.repeat(2001) }, true)], a), 403, 'deny oversized create');
  check(await commit([write(invalidName, base, true)]), 403, 'deny anonymous HTTP write without auth');
  check(await commit([write(`${root}/gantt/validation`, base, true)], a), 403, 'deny writes outside comments');
  check(await commit([write(name, { text: 'Teste atualizado entre sessões' })], a), 200, 'owner edit');
  const updated = await request(`https://firestore.googleapis.com/v1/${name}`, 'GET', undefined, b.idToken);
  check(updated, 200, 'second session reads update');
  assert.equal(updated.data.fields.text.stringValue, 'Teste atualizado entre sessões');
  check(await commit([{ delete: name }], a), 200, 'owner delete');
  documents.length = 0;
  check(await request(`https://firestore.googleapis.com/v1/${name}`, 'GET', undefined, b.idToken), 404, 'second session observes deletion');
  console.log(`All ${checks} live Firebase checks passed.`);
} finally {
  for (const name of documents) await commit([{ delete: name }], sessions[0]);
  for (const session of sessions) {
    const result = await request(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${config.apiKey}`, 'POST', { idToken: session.idToken });
    if (result.status !== 200) console.error('Failed to clean up a temporary test session.');
  }
}
