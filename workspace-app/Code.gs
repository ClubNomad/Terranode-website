/* Terranode Contacts + Project Media — Workspace-backed private team app.
  * The app runs as its Workspace owner and checks team access on the server.
 * The website's existing Google Forms and response tabs are left untouched.
 */
let TN_CONFIG_CACHE_;
function config_() {
  if (TN_CONFIG_CACHE_) return TN_CONFIG_CACHE_;
  const raw = PropertiesService.getScriptProperties().getProperty('TERRANODE_CONFIG');
  if (!raw) throw new Error('Terranode setup is incomplete. Add the TERRANODE_CONFIG script property.');
  let config;
  try { config = JSON.parse(raw); } catch (_) { throw new Error('The TERRANODE_CONFIG script property is not valid JSON.'); }
  const required = ['owner','admins','hub','projects','intake','sourceParent','contactSheet','sourceSheet','companySheet','clientResponses','vendorResponses','clientForm','vendorForm'];
  const missing = required.filter(key => config[key] == null || config[key] === '');
  if (missing.length || !Array.isArray(config.admins) || !config.admins.length) throw new Error('TERRANODE_CONFIG is missing required settings.');
  TN_CONFIG_CACHE_ = config;
  return TN_CONFIG_CACHE_;
}
const T = new Proxy({}, { get: (_target, key) => config_()[key] });
const CONTACT_HEADERS = ['ID','Name','Company','Phone','Email','Role','Note','Project IDs','Created','Updated'];
const SOURCE_HEADERS = ['ID','Contact ID','Kind','Source key','Source URL','Original filename','Context','Created'];
const COMPANY_HEADERS = ['Company key','Company','Project IDs','Updated'];

function checkOwner_() {
  const owner = Session.getEffectiveUser().getEmail().toLowerCase();
    if (owner !== T.owner) throw new Error('Open this Terranode app from its Workspace owner account.');
}
function checkWebUser_() {
  checkOwner_();
  const visitor = (Session.getActiveUser().getEmail() || '').toLowerCase();
  if (!T.admins.includes(visitor)) throw new Error('This private Terranode workspace is limited to approved team accounts.');
}
function doGet() {
  checkWebUser_();
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setTitle('Terranode Workspace');
}
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
function hub_() { checkOwner_(); return SpreadsheetApp.openById(T.hub); }
function tab_(book, name, headers) {
  let sheet = book.getSheetByName(name);
  if (!sheet) { sheet = book.insertSheet(name); sheet.appendRow(headers); sheet.setFrozenRows(1); }
  return sheet;
}
function sheets_() {
  const book = hub_();
  return {book, contacts:tab_(book,T.contactSheet,CONTACT_HEADERS), sources:tab_(book,T.sourceSheet,SOURCE_HEADERS), companies:tab_(book,T.companySheet,COMPANY_HEADERS)};
}
function rows_(sheet) { const n=sheet.getLastRow(); return n<2?[]:sheet.getRange(2,1,n-1,sheet.getLastColumn()).getValues().map((row,i)=>({row:i+2,values:row})); }
function text_(x) { return x==null?'':String(x); }
function safeCell_(value) { const text=text_(value); return /^[\s]*[=+@-]/.test(text) ? "'"+text : text; }
function ids_(x) { try { const v=JSON.parse(text_(x)||'[]'); return Array.isArray(v)?v.map(String):[]; } catch (_) { return []; } }
function uniq_(a) { return [...new Set(a.filter(Boolean))]; }
function normalizedEmail_(x) { return text_(x).trim().toLowerCase(); }
function normalizedPhone_(x) { return text_(x).replace(/\D/g,''); }
function companyKey_(x) { return text_(x).trim().toLowerCase().replace(/\s+/g,' '); }
function roleUnion_(a,b) { return a===b?a:'both'; }
function now_() { return new Date().toISOString(); }
function contactFrom_(entry) { const v=entry.values; return {row:entry.row,id:text_(v[0]),name:text_(v[1]),company:text_(v[2]),phone:text_(v[3]),email:text_(v[4]),role:text_(v[5])||'client',note:text_(v[6]),projectIds:ids_(v[7]),created:text_(v[8]),updated:text_(v[9])}; }
function sourceFrom_(entry) { const v=entry.values; return {id:text_(v[0]),contactId:text_(v[1]),kind:text_(v[2]),sourceKey:text_(v[3]),url:text_(v[4]),filename:text_(v[5]),context:text_(v[6]),created:text_(v[7])}; }
function contactRow_(c) { return [c.id,c.name,c.company,c.phone,c.email,c.role,c.note,JSON.stringify(c.projectIds||[]),c.created,c.updated]; }
function projects_() {
  const root=DriveApp.getFolderById(T.projects), result=[];
  const it=root.getFolders();
  while(it.hasNext()) {
    const folder=it.next(); if(folder.getId()===T.intake)continue;
    const group=folder.getName().trim();
    if(group==='Residential'||group==='Commercial') {
      const children=folder.getFolders();
      while(children.hasNext()) {const project=children.next();result.push({id:project.getId(),name:project.getName(),group,url:project.getUrl()});}
    } else result.push({id:folder.getId(),name:folder.getName(),group:'Projects',url:folder.getUrl()});
  }
  return result.sort((a,b)=>a.name.localeCompare(b.name));
}

// Media stays in Drive. The app only chooses a destination and makes one folder per upload.
function categoryFolder_(category) {
  const requested = text_(category).trim();
  if (!['Residential', 'Commercial'].includes(requested)) throw new Error('Choose Residential or Commercial.');
  const folders = DriveApp.getFolderById(T.projects).getFolders();
  while (folders.hasNext()) {
    const folder = folders.next();
    if (folder.getName().trim() === requested) return folder;
  }
  throw new Error('The project category is missing in Drive.');
}
function projectById_(id) { return projects_().find(project => project.id === text_(id)); }
function intakeBatches_() {
  const batches = [], folders = DriveApp.getFolderById(T.intake).getFolders();
  while (folders.hasNext()) {
    const folder = folders.next();
    batches.push({id:folder.getId(), name:folder.getName(), url:folder.getUrl()});
  }
  return batches.sort((a,b) => a.name.localeCompare(b.name));
}
function createProjectFolder(category, name) {
  checkWebUser_();
  const projectName = text_(name).trim();
  if (projectName.length < 2 || projectName.length > 120 || /[\/\\\x00-\x1f]/.test(projectName)) {
    throw new Error('Enter a project name of 2–120 characters without slashes.');
  }
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const parent = categoryFolder_(category), folders = parent.getFolders();
    while (folders.hasNext()) {
      const folder = folders.next();
      if (folder.getName().trim().toLowerCase() === projectName.toLowerCase()) {
        return {id:folder.getId(), name:folder.getName(), url:folder.getUrl(), existing:true};
      }
    }
    const folder = parent.createFolder(projectName);
    CacheService.getScriptCache().remove('workspaceMediaSnapshot:v1');
    const result={id:folder.getId(), name:folder.getName(), url:folder.getUrl(), existing:false};
    enqueueWorkspaceAlert_({key:'workspace:project:'+folder.getId(),type:'Project folder created',recordId:folder.getId(),url:folder.getUrl(),details:{project:folder.getName()}});
    return result;
  } finally { lock.releaseLock(); }
}
function createUploadBatch(destinationId, note) {
  checkWebUser_();
  const project = projectById_(destinationId);
  if (destinationId !== T.intake && !project) throw new Error('Choose an existing project or the unsorted intake.');
  const parent = DriveApp.getFolderById(project ? project.id : T.intake);
  const context = text_(note).trim().replace(/[\/\\\x00-\x1f]/g,' ').replace(/\s+/g,' ').slice(0,60);
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HHmmss');
  const name = stamp + (context ? ' — ' + context : ' — Upload') + ' — ' + Utilities.getUuid().slice(0,6);
  const folder = parent.createFolder(name);
  CacheService.getScriptCache().remove('workspaceMediaSnapshot:v1');
  if (context) folder.setDescription('Batch note: ' + context);
  return {id:folder.getId(), name, url:folder.getUrl(), destination:project ? project.name : 'Unsorted intake'};
}
const MAX_DIRECT_MEDIA_BYTES = 45 * 1024 * 1024;
function uploadMediaFile(form) {
  checkWebUser_();
  if (!form) throw new Error('Choose one or more media files.');
  const batchId = text_(form.batchId), folder = DriveApp.getFolderById(batchId), parent = batchParent_(folder);
  const blob = form.mediaFile;
  if (!blob || typeof blob.getBytes !== 'function') throw new Error('Choose a photo or video file.');
  const size = Number(form.byteSize) || blob.getBytes().length;
  if (size <= 0) throw new Error('That file is empty.');
  if (size > MAX_DIRECT_MEDIA_BYTES) throw new Error('This file is over 45 MB. Open the batch folder in Drive and use Drive’s Upload option for this original.');
  const name = text_(form.originalName || blob.getName()).trim().slice(0, 250);
  const mime = text_(form.mediaType || blob.getContentType()).toLowerCase();
  const extension = (name.match(/\.([a-z0-9]+)$/i) || [,''])[1].toLowerCase();
  const allowedExtensions = ['jpg','jpeg','png','heic','heif','tif','tiff','webp','avif','gif','bmp','dng','arw','cr2','cr3','nef','raf','orf','rw2','mp4','mov','m4v','3gp','avi','webm','mts','m2ts'];
  if (!mime.startsWith('image/') && !mime.startsWith('video/') && !allowedExtensions.includes(extension)) throw new Error('Choose an image or video file.');
  const hash = text_(form.sha256).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('The file check did not finish. Select the file again and retry.');
  const files = folder.getFiles();
  while (files.hasNext()) {
    const existing = files.next(), description = text_(existing.getDescription());
    if (description.includes('Terranode upload SHA-256: ' + hash)) return {duplicate:true,name:existing.getName(),url:existing.getUrl(),size:existing.getSize(),destination:parent.getName()};
  }
  blob.setName(name);
  const file = folder.createFile(blob);
  const batchNote = text_(folder.getDescription()).replace(/^Batch note: /,'').trim();
  const uploadedAt = now_(), deviceModified = Number(form.deviceModified) || 0;
  const metadata = [
    'Terranode upload SHA-256: ' + hash,
    'Batch folder: ' + folder.getName(),
    'Uploaded: ' + uploadedAt,
    'Original filename: ' + name,
    'Original MIME type: ' + (mime || 'unknown'),
    'Original file size: ' + size + ' bytes',
    deviceModified ? 'File modified on device: ' + new Date(deviceModified).toISOString() : '',
    batchNote ? 'Batch note: ' + batchNote : ''
  ].filter(Boolean).join('\n');
  file.setDescription(metadata);
  CacheService.getScriptCache().remove('workspaceMediaSnapshot:v1');
  return {duplicate:false,id:file.getId(),name:file.getName(),url:file.getUrl(),size:file.getSize(),mime:file.getMimeType(),uploadedAt,destination:parent.getName()};
}
function batchParent_(folder) {
  const allowed = new Set([T.intake, ...projects_().map(project => project.id)]);
  const parents = folder.getParents();
  while (parents.hasNext()) {
    const parent = parents.next();
    if (allowed.has(parent.getId())) return parent;
  }
  throw new Error('That upload folder is outside Terranode project media.');
}
function getBatchStatus(batchId) {
  checkWebUser_();
  const folder = DriveApp.getFolderById(text_(batchId)), parent = batchParent_(folder);
  const files = folder.getFiles(), names = {}, items = [];
  while (files.hasNext()) {
    const file = files.next(), item = {name:file.getName(), size:file.getSize()};
    items.push(item);
    if (!names[item.name]) names[item.name] = [];
    names[item.name].push(item.size);
  }
  return {name:folder.getName(), url:folder.getUrl(), destination:parent.getName(), count:items.length,
    bytes:items.reduce((total,item) => total + item.size,0),
    sameNames:Object.keys(names).filter(name => names[name].length > 1).map(name => ({name,sizes:names[name]}))};
}
function moveIntakeBatch(batchId, projectId) {
  checkWebUser_();
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const project = projectById_(projectId);
    if (!project) throw new Error('Choose a project folder.');
    const folder = DriveApp.getFolderById(text_(batchId));
    if (batchParent_(folder).getId() !== T.intake) throw new Error('This batch is no longer in the unsorted intake.');
    const target = DriveApp.getFolderById(project.id), names = target.getFoldersByName(folder.getName());
    if (names.hasNext()) throw new Error('A batch folder with this name already exists in that project. Review it in Drive first.');
    folder.moveTo(target);
    CacheService.getScriptCache().remove('workspaceMediaSnapshot:v1');
    return {id:folder.getId(), name:folder.getName(), url:folder.getUrl(), destination:project.name};
  } finally { lock.releaseLock(); }
}
function companyProjects_(sheet) {
  const out={};
  rows_(sheet).forEach(entry=>{const v=entry.values;out[text_(v[0])]={name:text_(v[1]),projectIds:ids_(v[2])};});
  return out;
}
function duplicates_(contacts) {
  const pairs=[];
  for(let i=0;i<contacts.length;i++)for(let j=i+1;j<contacts.length;j++) {
    const a=contacts[i],b=contacts[j];
    const email=normalizedEmail_(a.email)&&normalizedEmail_(a.email)===normalizedEmail_(b.email);
    const phone=normalizedPhone_(a.phone).length>=7&&normalizedPhone_(a.phone)===normalizedPhone_(b.phone);
    if(email||phone)pairs.push({first:a,second:b,reason:email?'email':'phone'});
  }
  return pairs;
}
function getState() {
  checkWebUser_();
  const s=sheets_(), contacts=rows_(s.contacts).map(contactFrom_), sources=rows_(s.sources).map(sourceFrom_), companies=companyProjects_(s.companies);
  contacts.forEach(c=>{c.sources=sources.filter(source=>source.contactId===c.id);c.companyProjectIds=companies[companyKey_(c.company)]?.projectIds||[];delete c.row;});
  return {contacts,projects:projects_(),intakeBatches:intakeBatches_(),intakeId:T.intake,companies,duplicates:duplicates_(contacts),clientFormUrl:T.clientForm,vendorFormUrl:T.vendorForm,hubUrl:'https://docs.google.com/spreadsheets/d/'+T.hub+'/edit',projectsUrl:DriveApp.getFolderById(T.projects).getUrl(),intakeUrl:DriveApp.getFolderById(T.intake).getUrl()};
}
function matches_(contacts,draft,excludeId) {
  const email=normalizedEmail_(draft.email),phone=normalizedPhone_(draft.phone);
  return contacts.filter(c=>c.id!==excludeId&&((email&&email===normalizedEmail_(c.email))||(phone.length>=7&&phone===normalizedPhone_(c.phone))));
}
function cleanDraft_(input) {
  const d=input||{};let name=text_(d.name).trim(),company=text_(d.company).trim();
  if(!name||name.length>180)throw new Error('Enter a name of 180 characters or fewer.');
  if(!['client','vendor','both'].includes(d.role))throw new Error('Choose Client, Vendor, or Both.');
  const role=d.role;
  const projectSet=new Set(projects_().map(p=>p.id));
  return {name,company:company.slice(0,180),phone:text_(d.phone).trim().slice(0,80),email:text_(d.email).trim().slice(0,250),role,note:text_(d.note).trim().slice(0,5000),projectIds:uniq_(Array.isArray(d.projectIds)?d.projectIds.map(String).filter(id=>projectSet.has(id)):[]),companyProjectIds:uniq_(Array.isArray(d.companyProjectIds)?d.companyProjectIds.map(String).filter(id=>projectSet.has(id)):[])};
}
function saveCompanyProjects_(sheet,company,projectIds) {
  const key=companyKey_(company);if(!key)return;
  const found=rows_(sheet).find(entry=>text_(entry.values[0])===key), row=[key,company,JSON.stringify(projectIds),now_()];
  if(found)sheet.getRange(found.row,1,1,row.length).setValues([row]);else sheet.appendRow(row);
}
function sourceFolder_() {
  const parent=DriveApp.getFolderById(T.sourceParent),it=parent.getFoldersByName('Terranode Contact Originals');
  return it.hasNext()?it.next():parent.createFolder('Terranode Contact Originals');
}
function saveSourceFile_(input) {
  if(!input)return null;
  const filename=text_(input.name).trim().slice(0,200),mime=text_(input.mime).trim(),data=text_(input.base64);
  if(!filename||!data||data.length>14000000)throw new Error('Choose a contact card or photo under 10 MB.');
  if(!(/^image\//.test(mime)||/vcard|x-vcard|octet-stream|text\/plain/.test(mime)))throw new Error('Choose a photo or vCard file.');
  const bytes=Utilities.base64Decode(data),blob=Utilities.newBlob(bytes,mime||'application/octet-stream',filename);
  const file=sourceFolder_().createFile(blob);return {url:file.getUrl(),filename:file.getName(),key:'file:'+file.getId()};
}
function saveContact(input) {
  checkWebUser_();const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    const s=sheets_(),activity=activitySheet_(),submissionKey=text_(input.submissionKey).trim()||Utilities.getUuid(),eventKey='workspace:contact:'+submissionKey;
    const prior=findActivityRow_(activity,eventKey);
    if(prior)return {saved:true,id:text_(activity.getRange(prior,4).getValue()),duplicate:true,notification:text_(activity.getRange(prior,6).getValue())};
    const all=rows_(s.contacts).map(contactFrom_),d=cleanDraft_(input.draft),existingId=text_(input.id),mergeInto=text_(input.mergeInto);
    const matches=matches_(all,d,existingId);
    if(!existingId&&!mergeInto&&!input.keepSeparate&&matches.length)return {possibleMatches:matches.map(c=>({id:c.id,name:c.name,company:c.company,email:c.email,phone:c.phone}))};
    let c=all.find(x=>x.id===(existingId||mergeInto));
    if((existingId||mergeInto)&&!c)throw new Error('Contact no longer exists. Refresh and try again.');
    const timestamp=now_();
    if(c&&mergeInto) c={...c,name:c.name||d.name,company:c.company||d.company,phone:c.phone||d.phone,email:c.email||d.email,role:roleUnion_(c.role,d.role),note:uniq_([c.note,d.note]).join('\n'),projectIds:uniq_([...c.projectIds,...d.projectIds]),updated:timestamp};
    else if(c)c={...c,...d,updated:timestamp};
    else c={id:Utilities.getUuid(),...d,created:timestamp,updated:timestamp};
    let savedRow=c.row;
    if(savedRow)s.contacts.getRange(savedRow,1,1,CONTACT_HEADERS.length).setValues([contactRow_(c)]);
    else {s.contacts.appendRow(contactRow_(c));savedRow=s.contacts.getLastRow();}
    if(d.company&&input.updateCompanyProjects)saveCompanyProjects_(s.companies,d.company,d.companyProjectIds);
    const kind=['manual','vcard','business_card'].includes(input.kind)?input.kind:'manual';
    let sourceFile=null;
    if(!existingId) {
      sourceFile=saveSourceFile_(input.file);
      s.sources.appendRow([Utilities.getUuid(),c.id,kind,sourceFile?.key||'manual:'+Utilities.getUuid(),sourceFile?.url||'',sourceFile?.filename||'',text_(input.sourceNote).slice(0,500),timestamp]);
    }
    c.row=savedRow;
    let alert={status:'Workspace pending'};
    try { alert=enqueueWorkspaceAlert_({key:eventKey,type:existingId?'Contact updated':mergeInto?'Contact linked':'Contact added',recordId:c.id,url:sheetRowUrl_('https://docs.google.com/spreadsheets/d/'+T.hub+'/edit',s.contacts,savedRow),details:contactAlertDetails_(c,kind,sourceFile,projects_())}); }
    catch(error) { console.error('Contact saved; alert will retry: '+error.message); }
    return {saved:true,id:c.id,notification:alert.status};
  } finally {lock.releaseLock();}
}
function mergeContacts(keepId,removeId,requestId) {
  checkWebUser_();const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    const s=sheets_(),activity=activitySheet_(),eventKey='workspace:merge:'+(text_(requestId).trim()||Utilities.getUuid());
    const prior=findActivityRow_(activity,eventKey);
    if(prior)return {saved:true,id:text_(activity.getRange(prior,4).getValue()),duplicate:true,notification:text_(activity.getRange(prior,6).getValue())};
    const all=rows_(s.contacts).map(contactFrom_),keep=all.find(x=>x.id===keepId),drop=all.find(x=>x.id===removeId);
    if(!keep||!drop||keep.id===drop.id)throw new Error('Select two existing contacts.');
    const merged={...keep,name:keep.name||drop.name,company:keep.company||drop.company,phone:keep.phone||drop.phone,email:keep.email||drop.email,role:roleUnion_(keep.role,drop.role),note:uniq_([keep.note,drop.note]).join('\n'),projectIds:uniq_([...keep.projectIds,...drop.projectIds]),updated:now_()};
    s.contacts.getRange(keep.row,1,1,CONTACT_HEADERS.length).setValues([contactRow_(merged)]);
    rows_(s.sources).forEach(entry=>{if(text_(entry.values[1])===removeId)s.sources.getRange(entry.row,2).setValue(keepId);});
    s.contacts.deleteRow(drop.row);
    const url='https://docs.google.com/spreadsheets/d/'+T.hub+'/edit#gid='+s.contacts.getSheetId()+'&range=A'+keep.row;
    const alert=enqueueWorkspaceAlert_({key:eventKey,type:'Contact records merged',recordId:keepId,url:url,details:{name:merged.name,company:merged.company,email:merged.email,phone:merged.phone,source:'Duplicate review'}});
    return {saved:true,id:keepId,notification:alert.status};
  } finally {lock.releaseLock();}
}
function formValue_(headers,values,label) {const i=headers.indexOf(label);return i<0?'':text_(values[i]).trim();}
function syncResponse_(sheet,rowNumber,s) {
  const vendor=sheet.getName()===T.vendorResponses,client=sheet.getName()===T.clientResponses;
  if(!vendor&&!client||rowNumber<2)return false;
  const sourceKey='google-form:'+sheet.getSheetId()+':'+rowNumber;
  if(rows_(s.sources).some(entry=>text_(entry.values[3])===sourceKey))return false;
  const width=sheet.getLastColumn(),headers=sheet.getRange(1,1,1,width).getValues()[0].map(text_),values=sheet.getRange(rowNumber,1,1,width).getValues()[0];
  const get=label=>formValue_(headers,values,label);
  const d=vendor?{name:get('Your name'),company:get('Company name'),phone:get('Business phone'),email:get('Work email'),role:'vendor',note:[get('Your trade or service'),get('Regions served'),get('Website or portfolio')].filter(Boolean).join(' | '),projectIds:[]}:{name:get('Your name'),company:get('Company or organization'),phone:get('Phone number'),email:get('Email address'),role:'client',note:[get('What are you hoping to create or improve?'),get('Where is it?')].filter(Boolean).join(' | '),projectIds:[]};
  if(!d.name||(!d.email&&!d.phone))return false;
  const all=rows_(s.contacts).map(contactFrom_),matches=matches_(all,d,''),match=matches.length===1?matches[0]:null,timestamp=now_();
  let c;
  if(match)c={...match,name:match.name||d.name,company:match.company||d.company,phone:match.phone||d.phone,email:match.email||d.email,role:roleUnion_(match.role,d.role),note:uniq_([match.note,d.note]).join('\n'),updated:timestamp};
  else c={id:Utilities.getUuid(),...d,created:timestamp,updated:timestamp};
  if(c.row)s.contacts.getRange(c.row,1,1,CONTACT_HEADERS.length).setValues([contactRow_(c)]);else s.contacts.appendRow(contactRow_(c));
  const url='https://docs.google.com/spreadsheets/d/'+T.hub+'/edit#gid='+sheet.getSheetId()+'&range=A'+rowNumber;
  s.sources.appendRow([Utilities.getUuid(),c.id,vendor?'trade_form':'client_form',sourceKey,url,'',sheet.getName()+' row '+rowNumber,timestamp]);
  return true;
}
function handleTerranodeContactForm(e) {
  checkOwner_();if(!e||!e.range||e.source.getId()!==T.hub)return;
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {syncResponse_(e.range.getSheet(),e.range.getRow(),sheets_());} finally {lock.releaseLock();}
}
function syncExistingTerranodeContacts() {
  checkWebUser_();const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {const s=sheets_();let added=0;[T.clientResponses,T.vendorResponses].forEach(name=>{const sheet=s.book.getSheetByName(name);if(sheet)for(let row=2;row<=sheet.getLastRow();row++)if(syncResponse_(sheet,row,s))added++;});return added;}finally{lock.releaseLock();}
}
function installTerranodeContactTrigger() {
  checkWebUser_();const exists=ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='handleTerranodeContactForm');
  if(!exists)ScriptApp.newTrigger('handleTerranodeContactForm').forSpreadsheet(T.hub).onFormSubmit().create();
  return {triggerInstalled:true,existingRowsSynced:syncExistingTerranodeContacts()};
}


const OPERATIONS_TABLES_ = [
  {type:'Inquiry', sheet:'Enquiries', person:'Name', email:'Email', phone:'Phone', company:'Company', project:'Location', location:'Location', projectType:'Project type', summary:'Project idea', budget:'Budget', timing:'Timing', planningStage:'Planning stage', status:'Status', owner:'Owner', nextStep:'Next step', followUp:'Follow-up due', source:'Source response', editable:{owner:'Owner',status:'Status',nextStep:'Next step',followUp:'Follow-up due'}},
  {type:'Change request', sheet:'Change Requests', person:'Requestor', contact:'Contact', project:'Project ID or address', summary:'Requested change', timing:'Timing or budget', status:'Status', owner:'Owner', followUp:'Follow-up due', decision:'Decision', decisionEvidence:'Decision evidence', editable:{owner:'Owner',status:'Status',decision:'Decision',approvedAmount:'Approved amount CAD',decisionEvidence:'Decision evidence',followUp:'Follow-up due'}},
  {type:'Trade partner', sheet:'Trade Partners', person:'Contact name', email:'Email', phone:'Phone', company:'Company', summary:'Trade or service', timing:'Availability', headOffice:'Head office', regions:'Regions served', credentials:'Credentials', portfolio:'Portfolio', projectSize:'Typical project size and availability', status:'Status', owner:'Owner', notes:'Notes', editable:{owner:'Owner',status:'Status',notes:'Notes'}},
  {type:'Site log', sheet:'Site Logs', person:'Reporter', project:'Project ID or address', summary:'Work completed', visitDate:'Visit date', notes:'Observations', nextStep:'Next actions', status:'Status', owner:'Owner', followUp:'Follow-up due', editable:{owner:'Owner',status:'Status',followUp:'Follow-up due'}},
  {type:'Purchase request', sheet:'Purchases', person:'Requested by', project:'Project ID or address', summary:'Item or service', notes:'Reason', company:'Supplier', amount:'Amount CAD', neededBy:'Needed by', status:'Status', owner:'Owner', decisionEvidence:'Approval evidence', editable:{owner:'Owner',status:'Status',decisionEvidence:'Approval evidence'}},
  {type:'Client communication', sheet:'Client Contact', person:'Client contact', actor:'Logged by', project:'Project ID or address', summary:'Conversation', nextStep:'Next action', status:'Status', owner:'Owner', followUp:'Follow-up due', contactMethod:'Contact method', editable:{owner:'Owner',status:'Status',nextStep:'Next action',followUp:'Follow-up due'}}
];

function normalizeCrm_(value) { return text_(value).trim().toLowerCase().replace(/\s+/g,' '); }
function isoCrmDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value.toISOString();
  if (!value) return '';
  const date = new Date(value);
  return isNaN(date.getTime()) ? text_(value) : date.toISOString();
}
function headerValue_(headers, values, label) {
  const index = headers.indexOf(label);
  return index < 0 ? '' : values[index];
}
function sheetRowUrl_(hubUrl, sheet, row) {
  return hubUrl + '#gid=' + sheet.getSheetId() + '&range=A' + row;
}
function parseObject_(value) {
  try {
    const parsed = JSON.parse(text_(value) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_) { return {}; }
}
function ensureAlertDetailsColumn_(sheet) {
  if (sheet && text_(sheet.getRange(1,9).getValue()).trim() !== 'Alert details') sheet.getRange(1,9).setValue('Alert details');
}
function activitySheet_() {
  const sheet = hub_().getSheetByName('Activity');
  if (!sheet) throw new Error('The Operations Hub Activity tab is missing.');
  ensureAlertDetailsColumn_(sheet);
  return sheet;
}
function findActivityRow_(sheet, sourceKey) {
  const last = sheet.getLastRow();
  if (last < 2) return 0;
  const found = sheet.getRange(2,1,last-1,1).createTextFinder(sourceKey).matchEntireCell(true).findNext();
  return found ? found.getRow() : 0;
}
function workspaceAlertStatus_(sourceKey) {
  return /^workspace:/.test(text_(sourceKey));
}
function retryableWorkspaceAlert_(sourceKey, status) {
  return workspaceAlertStatus_(sourceKey) && status === 'Workspace pending';
}
function workspaceActivityDetails_(sheet, row) {
  return parseObject_(sheet.getRange(row,9).getValue());
}
function enqueueWorkspaceAlert_(event) {
  let sheet, row, key = text_(event.key);
  if (!key || !/^workspace:[a-z0-9:_-]{8,180}$/i.test(key)) throw new Error('The workspace alert key is invalid.');
  try {
    sheet = activitySheet_();
    row = findActivityRow_(sheet,key);
    if (!row) {
      const received = event.received instanceof Date ? event.received : new Date();
      sheet.appendRow([key,received,text_(event.type).slice(0,100),text_(event.recordId).slice(0,200),text_(event.url), 'Workspace pending', '', '', JSON.stringify(event.details || {})]);
      row = sheet.getLastRow();
    }
    deliverWorkspaceAlert_(sheet,row);
  } catch (error) {
    console.error('Terranode alert could not be recorded or sent: ' + error.message);
    if (sheet && row) {
      sheet.getRange(row,6).setValue('Workspace pending');
      sheet.getRange(row,8).setValue(text_(error.message).slice(0,500));
    }
  }
  return {status: sheet && row ? text_(sheet.getRange(row,6).getValue()) : 'Workspace pending'};
}
function deliverWorkspaceAlert_(sheet,row) {
  const values = sheet.getRange(row,1,1,9).getValues()[0];
  if (values[5] === 'Sent') return;
  sheet.getRange(row,7).setValue(new Date());
  try {
    const details = parseObject_(values[8]);
    const lines = [
      'A saved item is ready in Terranode Workspace.',
      'Type: ' + text_(values[2]),
      'Received: ' + (values[1] instanceof Date ? Utilities.formatDate(values[1],Session.getScriptTimeZone(),'yyyy-MM-dd HH:mm z') : text_(values[1])),
      'Record: ' + text_(values[3])
    ];
    [['Contact',details.name],['Company',details.company],['Email',details.email],['Phone',details.phone],['Relationship',details.role],['Project',details.project],['Source',details.source],['Original file',details.filename],['Files',details.fileSummary],['Updated fields',details.changedFields],['Owner',details.owner],['Status',details.status],['Follow-up due',details.followUp],['Next step',details.nextStep]].forEach(function(pair) {
      if (pair[1]) lines.push(pair[0] + ': ' + text_(pair[1]).slice(0,500));
    });
    if (details.note) lines.push('Note: ' + text_(details.note).slice(0,300));
    lines.push('', 'Open the secure record: ' + text_(values[4]));
    if (details.sourceUrl) lines.push('Open the original: ' + text_(details.sourceUrl));
    lines.push('', 'Terranode Inc. · Grounded in place. Built to connect.');
    MailApp.sendEmail({to:T.owner,subject:'Terranode · ' + text_(values[2]) + ' · ' + text_(values[3]),body:lines.join('\n'),name:'Terranode Workspace'});
    sheet.getRange(row,6).setValue('Sent');
    sheet.getRange(row,8).clearContent();
  } catch (error) {
    sheet.getRange(row,6).setValue('Workspace pending');
    sheet.getRange(row,8).setValue(text_(error.message).slice(0,500));
    console.error('Terranode alert is queued for retry: ' + error.message);
  }
}
function contactAlertDetails_(contact,kind,file,projects) {
  return {
    name:contact.name, company:contact.company, email:contact.email, phone:contact.phone, role:contact.role,
    project:(projects || []).filter(function(project){return (contact.projectIds || []).includes(project.id);}).map(function(project){return project.name;}).join(', '),
    source:kind === 'business_card' ? 'Business card photo' : kind === 'vcard' ? 'Contact card import' : contact.id ? 'Team contact entry' : 'Team contact entry',
    filename:file && file.filename || '', sourceUrl:file && file.url || ''
  };
}
function findUnseenMediaFiles_(folder,seen) {
  const files = folder.getFiles(), found = [];
  while (files.hasNext()) {
    const file = files.next();
    if (!seen.has(file.getId())) found.push({id:file.getId(),name:file.getName(),size:file.getSize(),created:file.getDateCreated()});
  }
  return found;
}
function mediaBatchFolders_() {
  const cutover = Number(PropertiesService.getScriptProperties().getProperty('workspaceMediaCutover') || 0);
  if (!cutover) return [];
  const roots = [{id:T.intake,name:'General upload',projectId:''}].concat(projects_().map(function(project){return {id:project.id,name:project.name,projectId:project.id};}));
  const batches = [], pattern = /^\d{4}-\d{2}-\d{2} \d{6} — .+ — [a-f0-9]{6}$/i;
  roots.forEach(function(root) {
    const rootFolder = DriveApp.getFolderById(root.id), folders = rootFolder.getFolders();
    while (folders.hasNext()) {
      const folder = folders.next();
      if (!pattern.test(folder.getName()) || folder.getDateCreated().getTime() < cutover) continue;
      batches.push({folder,root});
    }
  });
  return batches;
}
function mediaActivityFileIds_(sheet) {
  const seen = new Set(), last = sheet.getLastRow();
  if (last < 2) return seen;
  const rows = sheet.getRange(2,1,last-1,9).getValues();
  rows.forEach(function(row) {
    if (!/^workspace:media:/.test(text_(row[0]))) return;
    const details = parseObject_(row[8]);
    (Array.isArray(details.fileIds) ? details.fileIds : []).forEach(function(id){if(id)seen.add(String(id));});
  });
  return seen;
}
function mediaFileKey_(fileIds) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,fileIds.slice().sort().join('|'));
  return digest.map(function(byte){return ('0'+((byte+256)%256).toString(16)).slice(-2);}).join('');
}
function mediaFolderRecord_(folder,root,hub,companies,contacts) {
  const files=folder.getFiles(), names=[];
  let count=0,bytes=0,latest=folder.getDateCreated();
  while(files.hasNext()) {
    const file=files.next(); count++; bytes+=file.getSize();
    if(names.length<20) names.push({name:file.getName(),url:file.getUrl(),size:file.getSize(),mime:file.getMimeType(),created:isoCrmDate_(file.getDateCreated())});
    if(file.getDateCreated().getTime()>latest.getTime()) latest=file.getDateCreated();
  }
  if (!count) return null;
  const companyKeys=Object.keys(companies).filter(function(key){return root.projectId && companies[key].projectIds.includes(root.projectId);});
  const companyNames=companyKeys.map(function(key){return companies[key].name;});
  const related=contacts.filter(function(contact){return root.projectId && ((contact.projectIds||[]).includes(root.projectId)||(contact.companyProjectIds||[]).includes(root.projectId));});
  const note=text_(folder.getDescription()).replace(/^Batch note:\s*/,'');
  return {type:'Media batch',id:folder.getId(),name:folder.getName(),received:isoCrmDate_(latest),person:'',email:'',phone:'',company:companyNames.join(', '),companyKey:companyNames.length===1?companyKey_(companyNames[0]):'',companyNames:companyNames,companyKeys:companyKeys,projectText:root.name,projectId:root.projectId,projectIds:root.projectId?[root.projectId]:[],projectLabel:root.name,projectFilterKey:root.projectId||'text:'+normalizeCrm_(root.name),summary:(count+' original file'+(count===1?'':'s')+' · '+(bytes/1048576).toFixed(1)+' MB')+(note?' · '+note:''),status:'Uploaded',owner:'',followUp:'',recordUrl:folder.getUrl(),sourceUrl:'',contactIds:related.map(function(c){return c.id;}),contactNames:related.map(function(c){return c.name;}),contactKeys:related.map(function(c){return 'id:'+c.id;}),contactRoles:uniq_(related.map(function(c){return c.role;})),files:names,fileCount:count,bytes:bytes};
}
function operationRecord_(spec,sheet,row,headers,values,hubUrl) {
  const read=function(key){return headerValue_(headers,values,spec[key]||'');};
  const id=text_(headerValue_(headers,values,'Record ID')).trim();
  if (!id) return null;
  const rawContact=text_(read('contact')).trim(), parsedEmail=rawContact.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const record={
    type:spec.type,id:id,name:text_(read('person')).trim()||id,person:text_(read('person')).trim(),email:text_(read('email')).trim()||(parsedEmail?parsedEmail[0]:''),phone:text_(read('phone')).trim()||(!parsedEmail?rawContact:''),company:text_(read('company')).trim(),projectText:text_(read('project')).trim(),summary:text_(read('summary')).trim(),status:text_(read('status')).trim(),owner:text_(read('owner')).trim(),nextStep:text_(read('nextStep')).trim(),followUp:isoCrmDate_(read('followUp')),notes:text_(read('notes')).trim(),timing:text_(read('timing')).trim(),decision:text_(read('decision')).trim(),decisionEvidence:text_(read('decisionEvidence')).trim(),approvedAmount:text_(read('approvedAmount')).trim(),amount:text_(read('amount')).trim(),neededBy:isoCrmDate_(read('neededBy')),visitDate:isoCrmDate_(read('visitDate')),projectType:text_(read('projectType')).trim(),location:text_(read('location')).trim(),budget:text_(read('budget')).trim(),planningStage:text_(read('planningStage')).trim(),headOffice:text_(read('headOffice')).trim(),regions:text_(read('regions')).trim(),credentials:text_(read('credentials')).trim(),portfolio:text_(read('portfolio')).trim(),projectSize:text_(read('projectSize')).trim(),contactMethod:text_(read('contactMethod')).trim(),actor:text_(read('actor')).trim(),received:isoCrmDate_(read('received') || values[1]),recordUrl:sheetRowUrl_(hubUrl,sheet,row),sourceUrl:/^https:\/\/docs\.google\.com\//i.test(text_(read('source')).trim())?text_(read('source')).trim():'',contactIds:[],contactNames:[],contactKeys:[],contactRoles:[],projectIds:[],projectId:'',projectLabel:'',projectFilterKey:'',editable:{}
  };
  Object.keys(spec.editable).forEach(function(key) {
    const label=spec.editable[key], column=headers.indexOf(label);
    if (column >= 0) record.editable[key]={label:label,value:isoCrmDate_(values[column]),type:key==='followUp'?'date':key==='notes'||key==='decisionEvidence'||key==='nextStep'?'textarea':'text'};
  });
  return record;
}
function associateOperationRecords_(records,contacts,projects,companies) {
  const projectById={}, projectByName={},contactsById={},contactsByEmail={},contactsByPhone={},contactsByName={},contactsByCompany={},contactsByProject={};
  const addIndex=function(index,key,contact){if(!key)return;(index[key]||(index[key]=[])).push(contact);};
  projects.forEach(function(project){projectById[project.id]=project;projectByName[normalizeCrm_(project.name)]=project;});
  contacts.forEach(function(contact){
    contactsById[contact.id]=contact;
    addIndex(contactsByEmail,normalizedEmail_(contact.email),contact);
    const phone=normalizedPhone_(contact.phone);if(phone.length>=7)addIndex(contactsByPhone,phone,contact);
    addIndex(contactsByName,normalizeCrm_(contact.name),contact);
    addIndex(contactsByCompany,companyKey_(contact.company),contact);
    uniq_([].concat(contact.projectIds||[],contact.companyProjectIds||[])).forEach(function(id){addIndex(contactsByProject,id,contact);});
  });
  records.forEach(function(record) {
    let matched=[];
    if (record.type==='Contact') matched=contactsById[record.id]?[contactsById[record.id]]:[];
    else if (record.type==='Company') matched=contactsByCompany[record.companyKey]||[];
    else if (record.type==='Project' && record.projectId) matched=contactsByProject[record.projectId]||[];
    else if (record.email || normalizedPhone_(record.phone).length>=7) {
      matched=uniq_([].concat(contactsByEmail[normalizedEmail_(record.email)]||[],contactsByPhone[normalizedPhone_(record.phone)]||[]));
    } else matched=contactsByName[normalizeCrm_(record.person)]||[];
    record.contactIds=uniq_(matched.map(function(c){return c.id;}));
    record.contactNames=uniq_(matched.map(function(c){return c.name;}));
    record.contactRoles=uniq_(matched.map(function(c){return c.role;}));
    record.contactKeys=uniq_(record.contactIds.map(function(id){return 'id:'+id;})
      .concat(record.email?['email:'+normalizeCrm_(record.email)]:[])
      .concat(record.phone?['phone:'+normalizedPhone_(record.phone)]:[])
      .concat(record.person?['name:'+normalizeCrm_(record.person)]:[]));
    if (!record.company && matched.length===1) record.company=matched[0].company;
    const projectCompanies=record.type==='Project'&&record.projectIds&&record.projectIds.length?Object.keys(companies).filter(function(key){return record.projectIds.some(function(id){return companies[key].projectIds.includes(id);});}):[];
    record.companyNames=uniq_([].concat(record.company?[record.company]:[],projectCompanies.map(function(key){return companies[key].name;})));
    record.companyKeys=uniq_([].concat(record.companyKey?[record.companyKey]:[],projectCompanies));
    if (!record.company && record.companyNames.length===1) record.company=record.companyNames[0];
    if (!record.companyKey && record.companyNames.length===1) record.companyKey=companyKey_(record.companyNames[0]);
    if (record.type==='Contact') {
      const contact=matched[0];
      record.projectIds=uniq_([].concat(contact.projectIds||[],contact.companyProjectIds||[]));
    } else if (record.type==='Company') {
      record.projectIds=record.projectIds||[];
    } else if (record.projectId) {
      record.projectIds=[record.projectId];
    } else if (record.projectText) {
      const project=projectById[record.projectText]||projectByName[normalizeCrm_(record.projectText)];
      if (project) {record.projectId=project.id;record.projectIds=[project.id];}
    }
    record.projectIds=uniq_(record.projectIds||[]);
    record.projectLabel=record.projectId && projectById[record.projectId] ? projectById[record.projectId].name : (record.projectText||'');
    record.projectFilterKey=record.projectId||('text:'+normalizeCrm_(record.projectLabel));
  });
  return records;
}
function operationRecords_(book,hubUrl,contacts,projects,companies,contactSources) {
  const records=[],sourcesByContact={};
  contactSources.forEach(function(source){(sourcesByContact[source.contactId]||(sourcesByContact[source.contactId]=[])).push(source);});
  OPERATIONS_TABLES_.forEach(function(spec) {
    const sheet=book.getSheetByName(spec.sheet);
    if (!sheet || sheet.getLastRow()<2) return;
    const width=sheet.getLastColumn(),headers=sheet.getRange(1,1,1,width).getValues()[0].map(text_);
    sheet.getRange(2,1,sheet.getLastRow()-1,width).getValues().forEach(function(values,index) {
      const record=operationRecord_(spec,sheet,index+2,headers,values,hubUrl);
      if (record) records.push(record);
    });
  });
  contacts.forEach(function(contact) {
    const sources=sourcesByContact[contact.id]||[];
    records.push({type:'Contact',id:contact.id,name:contact.name,person:contact.name,email:contact.email,phone:contact.phone,company:contact.company,companyKey:companyKey_(contact.company),projectText:'',projectId:'',projectIds:uniq_([].concat(contact.projectIds||[],contact.companyProjectIds||[])),projectLabel:'',projectFilterKey:'',summary:contact.note,status:'Saved',owner:'',followUp:'',received:isoCrmDate_(contact.updated||contact.created),recordUrl:hubUrl+'#gid='+book.getSheetByName(T.contactSheet).getSheetId()+'&range=A'+contact.row,sourceUrl:'',contactIds:[contact.id],contactNames:[contact.name],contactKeys:['id:'+contact.id].concat(contact.email?['email:'+normalizeCrm_(contact.email)]:[]).concat(contact.phone?['phone:'+normalizedPhone_(contact.phone)]:[]).concat(['name:'+normalizeCrm_(contact.name)]),contactRoles:[contact.role],sources:sources,editable:{}});
  });
  const companySheet=book.getSheetByName(T.companySheet);
  if (companySheet && companySheet.getLastRow()>1) {
    const headers=companySheet.getRange(1,1,1,companySheet.getLastColumn()).getValues()[0].map(text_);
    companySheet.getRange(2,1,companySheet.getLastRow()-1,companySheet.getLastColumn()).getValues().forEach(function(values,index) {
      const key=text_(headerValue_(headers,values,'Company key'));
      const name=text_(headerValue_(headers,values,'Company'));
      if (!name) return;
      const ids=ids_(headerValue_(headers,values,'Project IDs'));
      const sheetUrl=sheetRowUrl_(hubUrl,companySheet,index+2);
      records.push({type:'Company',id:key||companyKey_(name),name:name,person:'',email:'',phone:'',company:name,companyKey:companyKey_(name),projectText:ids.map(function(id){return (projects.find(function(p){return p.id===id;})||{}).name||id;}).join(', '),projectIds:ids,projectId:'',projectLabel:'',projectFilterKey:'',summary:ids.length+' linked project'+(ids.length===1?'':'s'),status:'',owner:'',followUp:'',received:isoCrmDate_(headerValue_(headers,values,'Updated')),recordUrl:sheetUrl,sourceUrl:'',contactIds:[],contactNames:[],contactKeys:[],contactRoles:[],editable:{}});
    });
  }
  projects.forEach(function(project) {
    records.push({type:'Project',id:project.id,name:project.name,person:'',email:'',phone:'',company:'',companyKey:'',projectText:project.name,projectId:project.id,projectIds:[project.id],projectLabel:project.name,projectFilterKey:project.id,summary:project.group+' project folder',status:'',owner:'',followUp:'',received:'',recordUrl:project.url,sourceUrl:'',contactIds:[],contactNames:[],contactKeys:[],contactRoles:[],editable:{}});
  });
  return associateOperationRecords_(records,contacts,projects,companies);
}
function closedCrmStatus_(status) {
  return /^(closed|complete|completed|declined|rejected|cancelled|canceled|not proceeding|lost|withdrawn|resolved)$/i.test(text_(status).trim());
}
function filterOperationRecords_(records,filters) {
  const f=filters||{},query=normalizeCrm_(f.query),terms=query.split(' ').filter(Boolean);
  return records.filter(function(record) {
    if (f.type && record.type!==f.type) return false;
    if (f.project && record.projectFilterKey!==f.project && !record.projectIds.includes(f.project)) return false;
    if (f.company && !(record.companyKeys||[record.companyKey]).includes(f.company)) return false;
    if (f.contact && !record.contactIds.includes(f.contact) && !record.contactKeys.includes(f.contact)) return false;
    if (f.relationship && !record.contactRoles.includes(f.relationship)) return false;
    if (f.status && normalizeCrm_(record.status)!==normalizeCrm_(f.status)) return false;
    if (f.owner && normalizeCrm_(record.owner)!==normalizeCrm_(f.owner)) return false;
    const received=(record.received||'').slice(0,10);
    if (f.from && (!received || received<f.from)) return false;
    if (f.to && (!received || received>f.to)) return false;
    if (terms.length) {
      const searchable=normalizeCrm_([record.type,record.id,record.name,record.person,record.email,record.phone,record.company,record.projectLabel,record.projectText,record.summary,record.status,record.owner,record.nextStep,record.notes,record.timing,record.decision,record.contactNames.join(' ')].join(' '));
      if (!terms.every(function(term){return searchable.includes(term);})) return false;
    }
    return true;
  });
}
function operationFilterOptions_(records,contacts,projects) {
  const contactsById={};contacts.forEach(function(contact){contactsById[contact.id]=contact;});
  const unique=function(items) {const seen=new Map();items.filter(Boolean).forEach(function(item){if(!seen.has(item.value))seen.set(item.value,item);});return Array.from(seen.values()).sort(function(a,b){return a.label.localeCompare(b.label);});};
  const companyOptions=unique(records.reduce(function(out,r){return out.concat(r.companyNames&&r.companyNames.length?r.companyNames.map(function(name){return {value:companyKey_(name),label:name};}):r.company?[{value:r.companyKey,label:r.company}]:[]);},[]));
  const projectOptions=unique(records.filter(function(r){return r.projectLabel;}).map(function(r){return {value:r.projectFilterKey,label:r.projectLabel};}));
  const contactOptions=unique(records.filter(function(r){return r.person;}).map(function(r){const match=(r.contactIds||[]).map(function(id){return contactsById[id];}).find(Boolean);return {value:match?match.id:'name:'+normalizeCrm_(r.person),label:match?match.name:r.person};}));
  return {types:unique(records.map(function(r){return {value:r.type,label:r.type};})),projects:projectOptions,companies:companyOptions,contacts:contactOptions,relationships:[{value:'client',label:'Client'},{value:'vendor',label:'Vendor'},{value:'both',label:'Client + vendor'}],statuses:unique(records.filter(function(r){return r.status;}).map(function(r){return {value:r.status,label:r.status};})),owners:unique(records.filter(function(r){return r.owner;}).map(function(r){return {value:r.owner,label:r.owner};}))};
}
function operationsMetrics_(records,activity) {
  const intakeTypes=['Inquiry','Change request','Trade partner','Site log','Purchase request','Client communication'];
  const today=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd');
  return {
    newSubmissions:records.filter(function(r){return intakeTypes.includes(r.type)&&normalizeCrm_(r.status)==='new';}).length,
    openInquiries:records.filter(function(r){return r.type==='Inquiry'&&!closedCrmStatus_(r.status);}).length,
    openChanges:records.filter(function(r){return r.type==='Change request'&&!closedCrmStatus_(r.status);}).length,
    followUpsDue:records.filter(function(r){return r.followUp&&(r.followUp.slice(0,10)<=today)&&!closedCrmStatus_(r.status);}).length,
    alertIssues:(activity||[]).filter(function(a){return a.notification==='Pending'||a.notification==='Workspace pending';}).length
  };
}
function activityRecords_(sheet,hubUrl) {
  if (!sheet || sheet.getLastRow()<2) return [];
  const width=Math.max(8,Math.min(9,sheet.getLastColumn()));
  return sheet.getRange(2,1,sheet.getLastRow()-1,width).getValues().map(function(values,index) {
    const details=parseObject_(values[8]);
    const url=text_(values[4]);
    return {key:text_(values[0]),received:isoCrmDate_(values[1]),type:text_(values[2]),recordId:text_(values[3]),url:/^https:\/\/(docs|drive)\.google\.com\//i.test(url)?url:'',notification:text_(values[5]),lastAttempt:isoCrmDate_(values[6]),error:text_(values[7]),details:details};
  }).sort(function(a,b){return (b.received||'').localeCompare(a.received||'');});
}
function mediaBatchRecords_(projects,contacts,companies,hub) {
  const cache=CacheService.getScriptCache(),cacheKey='workspaceMediaSnapshot:v1',cached=cache.get(cacheKey);
  if(cached){try{return JSON.parse(cached);}catch(_) {cache.remove(cacheKey);}}
  const records=[];
  const roots=[{id:T.intake,name:'General upload',projectId:''}].concat(projects.map(function(p){return {id:p.id,name:p.name,projectId:p.id};}));
  const pattern=/^\d{4}-\d{2}-\d{2} \d{6} — .+ — [a-f0-9]{6}$/i;
  roots.forEach(function(root) {
    const parent=DriveApp.getFolderById(root.id),folders=parent.getFolders();
    while(folders.hasNext()) {
      const folder=folders.next();
      if(!pattern.test(folder.getName()))continue;
      const record=mediaFolderRecord_(folder,root,hub,companies,contacts);
      if(record)records.push(record);
    }
  });
  try {const encoded=JSON.stringify(records);if(encoded.length<95000)cache.put(cacheKey,encoded,90);}catch(_) {}
  return records;
}
function getOperationsState(filters,offset) {
  checkWebUser_();
  const sheets=sheets_(),book=sheets.book,hubUrl='https://docs.google.com/spreadsheets/d/'+T.hub+'/edit';
  const projects=projects_(),companies=companyProjects_(sheets.companies),contacts=rows_(sheets.contacts).map(contactFrom_);
  const sourceRows=rows_(sheets.sources).map(sourceFrom_),sourcesByContact={};
  sourceRows.forEach(function(source){(sourcesByContact[source.contactId]||(sourcesByContact[source.contactId]=[])).push(source);});
  contacts.forEach(function(contact){contact.sources=sourcesByContact[contact.id]||[];contact.companyProjectIds=companies[companyKey_(contact.company)]?companies[companyKey_(contact.company)].projectIds:[];});
  const mediaRecords=mediaBatchRecords_(projects,contacts,companies,book),records=operationRecords_(book,hubUrl,contacts,projects,companies,sourceRows).concat(mediaRecords);
  const activitySheet=activitySheet_(),activity=activityRecords_(activitySheet,hubUrl),filtered=filterOperationRecords_(records,filters||{});
  const start=Math.max(0,Math.min(2000,Number(offset)||0)),pageSize=75;
  return {records:filtered.slice(start,start+pageSize),recordCount:filtered.length,offset:start,hasMore:start+pageSize<filtered.length,summary:operationsMetrics_(filtered,activity),options:operationFilterOptions_(records,contacts,projects),activity:activity.slice(0,12),mediaDirectory:mediaRecords.map(function(r){return {id:r.id,name:r.name,projectIds:r.projectIds,summary:r.summary,recordUrl:r.recordUrl};}).slice(0,200),projectDirectory:projects.map(function(p){return {id:p.id,name:p.name,group:p.group,url:p.url};}),hubUrl:hubUrl,projectsUrl:DriveApp.getFolderById(T.projects).getUrl(),updatedAt:now_()};
}
function installWorkspaceCrmMaintenance() {
  checkWebUser_();
  const props=PropertiesService.getScriptProperties();
  if(!props.getProperty('workspaceMediaCutover'))props.setProperty('workspaceMediaCutover',String(Date.now()));
  const triggers=ScriptApp.getProjectTriggers().filter(function(trigger){return trigger.getHandlerFunction()==='maintainWorkspaceAlerts';});
  if(triggers.length>1)triggers.slice(1).forEach(function(trigger){ScriptApp.deleteTrigger(trigger);});
  if(!triggers.length)ScriptApp.newTrigger('maintainWorkspaceAlerts').timeBased().everyMinutes(10).create();
  return {triggerInstalled:true,mediaCutover:props.getProperty('workspaceMediaCutover')};
}
function maintainWorkspaceAlerts() {
  checkOwner_();
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(1000))return;
  try {
    const sheet=activitySheet_(),seen=mediaActivityFileIds_(sheet),now=Date.now();
    mediaBatchFolders_().forEach(function(batch) {
      try {
        if(batch.folder.getLastUpdated().getTime()>now-120000)return;
        const files=findUnseenMediaFiles_(batch.folder,seen);
        if(!files.length)return;
        enqueueMediaAlert_(batch.folder,batch.root,files,seen);
      } catch(error) {console.error('Media alert scan skipped '+batch.folder.getName()+': '+error.message);}
    });
    let attempts=0;
    if(sheet.getLastRow()>1) {
      const rows=sheet.getRange(2,1,sheet.getLastRow()-1,6).getValues();
      rows.forEach(function(values,index){if(attempts<20&&retryableWorkspaceAlert_(values[0],values[5])){attempts++;deliverWorkspaceAlert_(sheet,index+2);}});
    }
  } finally {lock.releaseLock();}
}
function enqueueMediaAlert_(folder,root,files,seen) {
  const ids=files.map(function(file){return file.id;}).filter(function(id){return !seen.has(id);});
  if(!ids.length)return {status:'Sent',newFiles:0};
  const key='workspace:media:'+mediaFileKey_(ids),parentName=root.name;
  const bytes=files.filter(function(file){return ids.includes(file.id);}).reduce(function(total,file){return total+file.size;},0);
  const size=(bytes/1048576).toFixed(1)+' MB';
  const result=enqueueWorkspaceAlert_({key:key,type:'Project media upload',recordId:folder.getId(),url:folder.getUrl(),details:{project:parentName,fileSummary:ids.length+' original file'+(ids.length===1?'':'s')+' · '+size,filename:folder.getName(),fileIds:ids}});
  ids.forEach(function(id){seen.add(id);});
  CacheService.getScriptCache().remove('workspaceMediaSnapshot:v1');
  return result;
}
function notifyMediaUploadBatch(batchId) {
  checkWebUser_();
  const folder=DriveApp.getFolderById(text_(batchId)),parent=batchParent_(folder),project=projects_().find(function(p){return p.id===parent.getId();});
  const root={id:parent.getId(),name:project?project.name:'General upload',projectId:project?project.id:''};
  const sheet=activitySheet_(),seen=mediaActivityFileIds_(sheet),files=findUnseenMediaFiles_(folder,seen);
  if(!files.length)return {status:'Sent',newFiles:0};
  const result=enqueueMediaAlert_(folder,root,files,seen);
  return {status:result.status,newFiles:files.length};
}
function updateOperationsRecord(input) {
  checkWebUser_();
  const request=input||{},spec=OPERATIONS_TABLES_.find(function(item){return item.type===text_(request.type);});
  if(!spec)throw new Error('This record type does not have editable workflow fields.');
  const id=text_(request.id).trim(),requestId=text_(request.requestId).trim()||Utilities.getUuid();
  if(!id)throw new Error('Choose a record to update.');
  const key='workspace:record:'+requestId;
  const updates=request.updates||{},allowed=spec.editable;
  Object.keys(updates).forEach(function(field){if(!Object.prototype.hasOwnProperty.call(allowed,field))throw new Error('That field cannot be changed here.');});
  if(!Object.keys(updates).length)throw new Error('Enter at least one update.');
  const book=hub_(),lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    const activity=activitySheet_(),existing=findActivityRow_(activity,key);
    if(existing)return {saved:true,notification:text_(activity.getRange(existing,6).getValue())};
    const sheet=book.getSheetByName(spec.sheet);
    if(!sheet)throw new Error('The Operations Hub register is missing.');
    const width=sheet.getLastColumn(),headers=sheet.getRange(1,1,1,width).getValues()[0].map(text_),last=sheet.getLastRow();
    if(last<2)throw new Error('That record no longer exists. Refresh and try again.');
    const data=sheet.getRange(2,1,last-1,width).getValues(),index=data.findIndex(function(row){return text_(row[0])===id;});
    if(index<0)throw new Error('That record no longer exists. Refresh and try again.');
    const row=index+2,changed=[],details={changedFields:[]};
    Object.keys(updates).forEach(function(field) {
      const label=allowed[field],column=headers.indexOf(label),raw=text_(updates[field]).trim();
      if(column<0)throw new Error('The '+label+' field is missing from the Hub register.');
      if(raw.length>2000)throw new Error(label+' must be 2,000 characters or fewer.');
      let value=raw;
      if(field==='followUp') {
        if(raw&&!/^\d{4}-\d{2}-\d{2}$/.test(raw))throw new Error('Enter the follow-up date as YYYY-MM-DD.');
        if(raw) {
          const parts=raw.split('-').map(Number),date=new Date(parts[0],parts[1]-1,parts[2]);
          if(date.getFullYear()!==parts[0]||date.getMonth()!==parts[1]-1||date.getDate()!==parts[2])throw new Error('Enter a valid follow-up date.');
          value=date;
        } else value='';
      } else value=safeCell_(raw);
      sheet.getRange(row,column+1).setValue(value);
      changed.push(label+': '+(raw||'cleared'));
      details[field]=raw.slice(0,400);
      details.changedFields.push(label);
    });
    SpreadsheetApp.flush();
    const recordUrl=sheetRowUrl_('https://docs.google.com/spreadsheets/d/'+T.hub+'/edit',sheet,row);
    const result=enqueueWorkspaceAlert_({key:key,type:'CRM record updated',recordId:id,url:recordUrl,details:details});
    return {saved:true,notification:result.status,changed:changed};
  } finally {lock.releaseLock();}
}

