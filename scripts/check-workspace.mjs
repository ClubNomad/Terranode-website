import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const app = resolve(root, 'workspace-app');
const config = {
  owner: 'info@terranode.ca',
  admins: ['info@terranode.ca', 'ms@terranode.ca', 'dp@terranode.ca'],
  ...Object.fromEntries(['hub','projects','intake','sourceParent','contactSheet','sourceSheet','companySheet','clientResponses','vendorResponses','clientForm','vendorForm'].map(key => [key, 'test-only'])),
};
let activeUser = 'info@terranode.ca';
const context = vm.createContext({
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => JSON.stringify(config) }) },
  Session: {
    getEffectiveUser: () => ({ getEmail: () => 'info@terranode.ca' }),
    getActiveUser: () => ({ getEmail: () => activeUser }),
  },
});
new vm.Script(readFileSync(resolve(app, 'Code.gs'), 'utf8'), { filename: 'Code.gs' }).runInContext(context);
for (const file of readdirSync(app).filter(name => /^WorkspaceClient\d+\.html$/.test(name))) {
  const source = readFileSync(resolve(app, file), 'utf8').replace(/^<script>\s*/, '').replace(/\s*<\/script>\s*$/, '');
  new vm.Script(source, { filename: file });
}
vm.runInContext('projects_ = () => []', context);
assert.throws(() => vm.runInContext("cleanDraft_({name:'A',role:''})", context), /Choose Client, Vendor, or Both/);
assert.equal(vm.runInContext("cleanDraft_({name:'A',role:'vendor'}).role", context), 'vendor');
assert.equal(vm.runInContext("cleanDraft_({name:'A',role:'both'}).role", context), 'both');
for (const email of config.admins) {
  activeUser = email;
  assert.doesNotThrow(() => vm.runInContext('checkWebUser_()', context));
}
activeUser = 'another@terranode.ca';
assert.throws(() => vm.runInContext('checkWebUser_()', context), /limited to approved team accounts/);
activeUser = '';
assert.throws(() => vm.runInContext('checkWebUser_()', context), /limited to approved team accounts/);
console.log('PASS: Apps Script syntax, explicit contact roles, and exact team allowlist.');
