import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readClient = (file) => readFileSync(resolve(root, 'workspace-app', file), 'utf8')
  .replace(/^<script>\s*/, '').replace(/\s*<\/script>\s*$/, '');
const context = vm.createContext({
  ocrWorkerPromise: null,
  Promise,
});

for (const file of ['WorkspaceClient5.html', 'WorkspaceClient6.html', 'WorkspaceClient7.html']) {
  new vm.Script(readClient(file), { filename: file }).runInContext(context);
}

const calls = [];
const worker = {
  recognize: async () => ({ data: { text: 'Morgan Lee\nProject Manager\nNorthstar Construction Ltd.\n416 555 0134\nmorgan.lee@northstar.example', confidence: 94 } }),
};
const api = { createWorker: async (...args) => { calls.push(args); return worker; } };
context.api = api;
const [first, second] = await Promise.all([
  vm.runInContext('getBusinessCardWorker(api, () => {})', context, { timeout: 1000, displayErrors: true }),
  vm.runInContext('getBusinessCardWorker(api, () => {})', context, { timeout: 1000, displayErrors: true }),
].map((promise) => promise));
assert.equal(first, worker);
assert.equal(second, worker);
assert.equal(calls.length, 1, 'worker initialization is shared while loading');
assert.equal(calls[0][0], 'eng');
assert.equal(calls[0][2].cachePath, 'terranode-contact-ocr-v1');

const suggestions = vm.runInContext(
  "extractContactFields('Morgan Lee\\nProject Manager\\nNorthstar Construction Ltd.\\n416 555 0134\\nmorgan.lee@northstar.example')",
  context,
);
assert.equal(suggestions.name, 'Morgan Lee');
assert.equal(suggestions.company, 'Northstar Construction Ltd.');
assert.equal(suggestions.phone, '416 555 0134');
assert.equal(suggestions.email, 'morgan.lee@northstar.example');
assert.match(suggestions.note, /Project Manager/);
assert.equal('role' in suggestions, false, 'OCR must not assign a contact role');

const retryContext = vm.createContext({ ocrWorkerPromise: null, Promise });
new vm.Script(readClient('WorkspaceClient5.html')).runInContext(retryContext);
let attempts = 0;
const retryApi = { createWorker: async () => { if (++attempts === 1) throw new Error('temporary load failure'); return worker; } };
retryContext.api = retryApi;
await assert.rejects(vm.runInContext('getBusinessCardWorker(api, () => {})', retryContext), /temporary load failure/);
assert.equal(await vm.runInContext('getBusinessCardWorker(api, () => {})', retryContext), worker);
assert.equal(attempts, 2, 'failed worker initialization can be retried');

console.log('PASS: OCR worker initialization is reused, failed initialization retries, and card fields remain reviewable without inferring a role.');
