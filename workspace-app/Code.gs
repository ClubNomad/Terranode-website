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
    return {id:folder.getId(), name:folder.getName(), url:folder.getUrl(), existing:false};
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
    const s=sheets_(),all=rows_(s.contacts).map(contactFrom_),d=cleanDraft_(input.draft),existingId=text_(input.id),mergeInto=text_(input.mergeInto);
    const matches=matches_(all,d,existingId);
    if(!existingId&&!mergeInto&&!input.keepSeparate&&matches.length)return {possibleMatches:matches.map(c=>({id:c.id,name:c.name,company:c.company,email:c.email,phone:c.phone}))};
    let c=all.find(x=>x.id===(existingId||mergeInto));
    if((existingId||mergeInto)&&!c)throw new Error('Contact no longer exists. Refresh and try again.');
    const timestamp=now_();
    if(c&&mergeInto) c={...c,name:c.name||d.name,company:c.company||d.company,phone:c.phone||d.phone,email:c.email||d.email,role:roleUnion_(c.role,d.role),note:uniq_([c.note,d.note]).join('\n'),projectIds:uniq_([...c.projectIds,...d.projectIds]),updated:timestamp};
    else if(c)c={...c,...d,updated:timestamp};
    else c={id:Utilities.getUuid(),...d,created:timestamp,updated:timestamp};
    if(c.row)s.contacts.getRange(c.row,1,1,CONTACT_HEADERS.length).setValues([contactRow_(c)]);else s.contacts.appendRow(contactRow_(c));
    if(d.company&&input.updateCompanyProjects)saveCompanyProjects_(s.companies,d.company,d.companyProjectIds);
    const kind=['manual','vcard','business_card'].includes(input.kind)?input.kind:'manual';
    if(!existingId) {
      const file=saveSourceFile_(input.file);
      s.sources.appendRow([Utilities.getUuid(),c.id,kind,file?.key||'manual:'+Utilities.getUuid(),file?.url||'',file?.filename||'',text_(input.sourceNote).slice(0,500),timestamp]);
    }
    return {saved:true,id:c.id};
  } finally {lock.releaseLock();}
}
function mergeContacts(keepId,removeId) {
  checkWebUser_();const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    const s=sheets_(),all=rows_(s.contacts).map(contactFrom_),keep=all.find(x=>x.id===keepId),drop=all.find(x=>x.id===removeId);
    if(!keep||!drop||keep.id===drop.id)throw new Error('Select two existing contacts.');
    const merged={...keep,name:keep.name||drop.name,company:keep.company||drop.company,phone:keep.phone||drop.phone,email:keep.email||drop.email,role:roleUnion_(keep.role,drop.role),note:uniq_([keep.note,drop.note]).join('\n'),projectIds:uniq_([...keep.projectIds,...drop.projectIds]),updated:now_()};
    s.contacts.getRange(keep.row,1,1,CONTACT_HEADERS.length).setValues([contactRow_(merged)]);
    rows_(s.sources).forEach(entry=>{if(text_(entry.values[1])===removeId)s.sources.getRange(entry.row,2).setValue(keepId);});
    s.contacts.deleteRow(drop.row);return {saved:true,id:keepId};
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


