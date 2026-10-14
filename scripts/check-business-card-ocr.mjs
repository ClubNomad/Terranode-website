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

const chooserMarkup = { innerHTML: '' };
const applicationRoot = {};
const topBar = {};
const focusedSelectors = [];
const modalPanel = { querySelector: selector => ({ focus: () => focusedSelectors.push(selector) }) };
const chooserContext = vm.createContext({
  modal: 'form',
  method: 'business_card',
  draft: { name: '', company: '', phone: '', email: '', note: '', role: 'client', projectIds: [], companyProjectIds: [] },
  data: { projects: [] },
  fileData: null,
  esc: value => String(value ?? ''),
  $: id => id === 'overlay' ? chooserMarkup : applicationRoot,
  document: {
    addEventListener: () => {},
    querySelector: selector => selector === '.top' ? topBar : modalPanel,
  },
});
new vm.Script(readClient('WorkspaceClient4.html'), { filename: 'WorkspaceClient4.html' }).runInContext(chooserContext);
vm.runInContext('renderModal()', chooserContext);
const sourceMarkup = chooserMarkup.innerHTML;
for (const [id, label] of [['cameraChoice', 'Use camera'], ['photosChoice', 'Choose from photos'], ['filesChoice', 'Browse files']]) {
  assert.match(sourceMarkup, new RegExp(`id="${id}"[^>]*>${label}<`), `business card source choice is available: ${label}`);
}
assert.match(sourceMarkup, /role="group" aria-label="Choose a business card photo source"/, 'source choices are grouped for assistive technology');
assert.deepEqual(focusedSelectors, ['#cameraChoice'], 'the dialog starts on a visible source choice');
const fileInputs = [...sourceMarkup.matchAll(/<input hidden type="file" id="(source\w+)"([^>]*)>/g)];
assert.deepEqual(fileInputs.map(([, id]) => id), ['sourceCamera', 'sourcePhotos', 'sourceFiles']);
for (const [, id, attributes] of fileInputs) {
  assert.match(attributes, /accept="image\/\*"/);
  assert.match(attributes, /onchange="chooseSourceFromInput\(this\)"/, `${id} uses the existing review path`);
}
assert.match(fileInputs[0][2], /capture="environment"/, 'the camera choice opens the rear camera');
assert.doesNotMatch(fileInputs[1][2] + fileInputs[2][2], /capture=/, 'photo and file choices do not force the camera');
const openedSources = [];
chooserContext.document.getElementById = id => ({ click: () => openedSources.push(id) });
for (const source of ['Camera', 'Photos', 'Files']) vm.runInContext(`openCardSource('${source}')`, chooserContext);
assert.deepEqual(openedSources, ['sourceCamera', 'sourcePhotos', 'sourceFiles']);
const selectedFile = { name: 'card.jpg' };
const input = { files: [selectedFile], value: 'card.jpg' };
let receivedFile;
chooserContext.chooseSource = file => { receivedFile = file; };
chooserContext.testInput = input;
vm.runInContext('chooseSourceFromInput(testInput)', chooserContext);
assert.equal(receivedFile, selectedFile, 'all source choices pass the original file to card review');
assert.equal(input.value, '', 'the picker resets so the same image can be selected again');

console.log('PASS: OCR reuse and retry work, card fields remain reviewable, and camera, photo, and file choices share the existing review flow.');
