import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const app = resolve(root, 'workspace-app');
const config = {
  owner: 'info@terranode.ca',
  ...Object.fromEntries(['hub','projects','intake','sourceParent','contactSheet','sourceSheet','companySheet','clientResponses','vendorResponses','clientForm','vendorForm'].map(key => [key, 'test-only'])),
};
let activeUser = 'info@terranode.ca';
const context = vm.createContext({
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => JSON.stringify(config) }) },
  Session: {
    getEffectiveUser: () => ({ getEmail: () => 'info@terranode.ca' }),
    getActiveUser: () => ({ getEmail: () => activeUser }),
    getScriptTimeZone: () => 'America/Toronto',
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
activeUser = 'info@terranode.ca';
assert.doesNotThrow(() => vm.runInContext('checkWebUser_()', context));
for (const email of ['ms@terranode.ca','dp@terranode.ca','another@terranode.ca','']) {
  activeUser = email;
  assert.throws(() => vm.runInContext('checkWebUser_()', context), /limited to info@terranode\\.ca/);
}

const filterRecords = [
  { type:'Inquiry', id:'ENQ-1', name:'Ava Li', person:'Ava Li', email:'ava@example.test', phone:'416-555-0100', company:'North Build', companyKey:'north build', companyKeys:['north build'], projectLabel:'Maple House', projectText:'Maple House', projectFilterKey:'project-1', projectIds:['project-1'], contactIds:['contact-1'], contactKeys:['id:contact-1','email:ava@example.test','name:ava li'], contactNames:['Ava Li'], contactRoles:['client'], status:'New', owner:'Mara', received:'2026-10-12T14:00:00.000Z', summary:'Kitchen adaptation and reuse' },
  { type:'Trade partner', id:'VEN-2', name:'Lee Chen', person:'Lee Chen', email:'lee@example.test', phone:'416-555-0199', company:'West Supply', companyKey:'west supply', companyKeys:['west supply'], projectLabel:'Harbour House', projectText:'Harbour House', projectFilterKey:'project-2', projectIds:['project-2'], contactIds:['contact-2'], contactKeys:['id:contact-2','email:lee@example.test','name:lee chen'], contactNames:['Lee Chen'], contactRoles:['vendor'], status:'New', owner:'Dev', received:'2026-10-09T14:00:00.000Z', summary:'Lighting supplier' },
];
context.filterRecords = filterRecords;
context.filterSet = {query:'Ava kitchen',type:'Inquiry',project:'project-1',company:'north build',contact:'contact-1',relationship:'client',status:'New',owner:'Mara',from:'2026-10-01',to:'2026-10-20'};
const combined = vm.runInContext('filterOperationRecords_(filterRecords, filterSet)', context);
assert.deepEqual(Array.from(combined, row => row.id), ['ENQ-1'], 'combined CRM filters should intersect');
context.filterSet = {type:'Inquiry',project:'project-2'};
assert.equal(vm.runInContext('filterOperationRecords_(filterRecords, filterSet).length', context), 0, 'different filters should not broaden results');

context.linkRecords = [{
  type:'Inquiry',id:'ENQ-3',name:'Ava Li',person:'Ava Li',email:'AVA@example.test',phone:'',company:'',companyKey:'',companyKeys:[],
  projectText:'Maple House',projectId:'',projectIds:[],contactIds:[],contactNames:[],contactKeys:[],contactRoles:[]
}];
context.linkContacts = [{id:'contact-1',name:'Ava Li',email:'ava@example.test',phone:'',company:'North Build',role:'client',projectIds:['project-1'],companyProjectIds:[]}];
context.linkProjects = [{id:'project-1',name:'Maple House',group:'Residential',url:'https://drive.google.com/drive/folders/project-1'}];
const linked = vm.runInContext('associateOperationRecords_(linkRecords,linkContacts,linkProjects,{})', context)[0];
assert.deepEqual(Array.from(linked.contactIds), ['contact-1'], 'contact association should use a normalized exact email');
assert.equal(linked.projectId, 'project-1', 'project association should use an exact folder name');
context.linkRecords = [{
  type:'Inquiry',id:'ENQ-4',name:'Unknown',person:'Unknown',email:'unknown@example.test',phone:'',company:'',companyKey:'',companyKeys:[],
  projectText:'',projectId:'project-1',projectIds:['project-1'],contactIds:[],contactNames:[],contactKeys:[],contactRoles:[]
}];
assert.equal(vm.runInContext('associateOperationRecords_(linkRecords,linkContacts,linkProjects,{})[0].contactIds.length', context), 0, 'an unrelated email must not inherit all project contacts');

assert.equal(vm.runInContext("retryableWorkspaceAlert_('workspace:contact:request-12345678','Workspace pending')", context), true);
assert.equal(vm.runInContext("retryableWorkspaceAlert_('workspace:contact:request-12345678','Sent')", context), false);
assert.equal(vm.runInContext("retryableWorkspaceAlert_('770779248:2','Pending')", context), false, 'intake retry rows must remain owned by the existing intake service');
assert.equal(vm.runInContext("closedCrmStatus_('Approved')", context), false, 'approved change requests remain open while execution is pending');
assert.equal(vm.runInContext("closedCrmStatus_('Resolved')", context), true, 'resolved records are terminal');

function makeActivitySheet() {
  const rows=[['Source key','Received','Type','Record ID','Record URL','Notification','Last attempt','Error','Alert details']];
  return {
    rows,
    getLastRow(){return rows.length;},
    appendRow(values){rows.push(values.slice());},
    getRange(row,column,numRows=1,numColumns=1){
      const sheet=this;
      return {
        createTextFinder(value){return {matchEntireCell(){return this;},findNext(){for(let i=row-1;i<Math.min(rows.length,row-1+numRows);i++){if(String(rows[i][column-1]||'')===String(value))return {getRow:()=>i+1};}return null;}};},
        getValues(){return Array.from({length:numRows},(_,r)=>Array.from({length:numColumns},(_,c)=>(rows[row-1+r]||[])[column-1+c]??''));},
        getValue(){return (rows[row-1]||[])[column-1]??'';},
        setValue(value){while(rows[row-1].length<column)rows[row-1].push('');rows[row-1][column-1]=value;return this;},
        clearContent(){return this.setValue('');},
      };
    },
  };
}
const memoryActivity=makeActivitySheet();
let failEmail=true;
const sentEmails=[];
context.testActivity=memoryActivity;
context.activitySheet_=()=>context.testActivity;
context.console={error(){}};
context.Utilities={formatDate:(value)=>new Date(value).toISOString()};
context.MailApp={sendEmail(message){if(failEmail)throw new Error('temporary mail failure');sentEmails.push(message);}};
const firstAlert=vm.runInContext("enqueueWorkspaceAlert_({key:'workspace:contact:request-12345678',type:'Contact added',recordId:'contact-1',url:'https://example.test/contacts/contact-1',details:{name:'Ava Li'}})",context);
assert.equal(firstAlert.status,'Workspace pending','mail failure should leave a visible retry state');
assert.match(memoryActivity.rows[1][7],/temporary mail failure/,'failed delivery reason should be recorded');
vm.runInContext("enqueueWorkspaceAlert_({key:'workspace:contact:request-12345678',type:'Contact added',recordId:'contact-1',url:'https://example.test/contacts/contact-1',details:{name:'Ava Li'}})",context);
assert.equal(memoryActivity.rows.length,2,'retries with one request key must not append duplicate Activity rows');
failEmail=false;
const recovered=vm.runInContext("enqueueWorkspaceAlert_({key:'workspace:contact:request-12345678',type:'Contact added',recordId:'contact-1',url:'https://example.test/contacts/contact-1',details:{name:'Ava Li'}})",context);
assert.equal(recovered.status,'Sent','a later retry should mark the alert Sent');
vm.runInContext("enqueueWorkspaceAlert_({key:'workspace:contact:request-12345678',type:'Contact added',recordId:'contact-1',url:'https://example.test/contacts/contact-1',details:{name:'Ava Li'}})",context);
assert.equal(sentEmails.length,1,'a completed alert must not send again');
assert.equal(sentEmails[0].to,'info@terranode.ca','Workspace alerts must go only to the approved internal inbox');

for (const email of ['ms@terranode.ca','dp@terranode.ca','another@terranode.ca','']) {
  activeUser=email;
  assert.throws(() => vm.runInContext('getOperationsState({},0)',context), /limited to info@terranode\\.ca/, 'CRM data endpoint must enforce info-only access');
  assert.throws(() => vm.runInContext("updateOperationsRecord({type:'Inquiry',id:'ENQ-1',updates:{status:'New'}})",context), /limited to info@terranode\\.ca/, 'CRM write endpoint must enforce info-only access');
}
activeUser='info@terranode.ca';
const registerRows=[['Record ID','Received','Name','Email','Status','Owner','Next step','Follow-up due'],['ENQ-1',new Date('2026-10-12T14:00:00Z'),'Ava Li','ava@example.test','New','', '', '']];
const responseRows=[['Timestamp','Name'],['Original response','Ava Li']];
function makeRegisterSheet(rows){return {rows,getLastRow(){return rows.length;},getLastColumn(){return rows[0].length;},getSheetId(){return 11;},getRange(row,column,numRows=1,numColumns=1){const sheet=this;return {getValues(){return Array.from({length:numRows},(_,r)=>Array.from({length:numColumns},(_,c)=>(rows[row-1+r]||[])[column-1+c]??''));},getValue(){return (rows[row-1]||[])[column-1]??'';},setValue(value){rows[row-1][column-1]=value;return this;},clearContent(){return this.setValue('');},createTextFinder(value){return {matchEntireCell(){return this;},findNext(){for(let i=row-1;i<Math.min(rows.length,row-1+numRows);i++)if(String(rows[i][column-1]||'')===String(value))return {getRow:()=>i+1};return null;}};}};}};}
const fakeRegister=makeRegisterSheet(registerRows),fakeResponse=makeRegisterSheet(responseRows);
context.testRegister=fakeRegister;context.testResponse=fakeResponse;context.testHub={getSheetByName(name){return name==='Enquiries'?context.testRegister:name==='Activity'?memoryActivity:name==='Enquiry responses'?context.testResponse:null;}};
context.hub_=()=>context.testHub;context.LockService={getScriptLock:()=>({waitLock(){},releaseLock(){}})};context.SpreadsheetApp={flush(){}};context.Utilities.getUuid=()=> 'request-12345678';
context.checkWebUser_=()=>{};
const updateResult=vm.runInContext("updateOperationsRecord({type:'Inquiry',id:'ENQ-1',requestId:'request-12345678',updates:{status:'In progress',owner:'Mara',nextStep:'Confirm site visit'}})",context);
assert.equal(updateResult.saved,true,'authorized workflow update saves');
assert.equal(fakeRegister.rows[1][4],'In progress');
assert.equal(fakeRegister.rows[1][5],'Mara');
assert.equal(fakeRegister.rows[1][6],'Confirm site visit');
assert.equal(fakeResponse.rows[1][0],'Original response','updates leave the form response tab unchanged');
assert.equal(sentEmails.at(-1).to,'info@terranode.ca','a saved CRM workflow change emails the internal inbox');
assert.throws(()=>vm.runInContext("updateOperationsRecord({type:'Inquiry',id:'ENQ-1',updates:{amount:'1'}})",context),/cannot be changed here/,'dashboard cannot edit an unapproved field');
vm.runInContext("updateOperationsRecord({type:'Inquiry',id:'ENQ-1',requestId:'request-formula-1234',updates:{status:' =IMPORTXML(\"https://bad.test\",\"//a\")'}})",context);
assert.equal(fakeRegister.rows[1][4],"'=IMPORTXML(\"https://bad.test\",\"//a\")",'workflow text that resembles a spreadsheet formula is stored as text');


console.log('PASS: syntax, info-only access, combined CRM filters, exact relationships, alert dedupe, and mail retry recovery.');

