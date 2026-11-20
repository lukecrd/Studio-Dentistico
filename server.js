const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
fs.mkdirSync(DATA, { recursive: true });
const db = new DatabaseSync(path.join(DATA, 'agendasmart.sqlite'));
db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
db.exec(`
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS professionals(id INTEGER PRIMARY KEY, name TEXT NOT NULL, specialty TEXT NOT NULL, color TEXT NOT NULL, procedure_ids TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS chairs(id INTEGER PRIMARY KEY, name TEXT NOT NULL, resources TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS procedures(id INTEGER PRIMARY KEY, name TEXT NOT NULL, duration INTEGER NOT NULL, specialty TEXT NOT NULL, resources TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS patients(id INTEGER PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS appointments(id INTEGER PRIMARY KEY, patient_id INTEGER NOT NULL REFERENCES patients(id), professional_id INTEGER NOT NULL REFERENCES professionals(id), chair_id INTEGER NOT NULL REFERENCES chairs(id), procedure_id INTEGER NOT NULL REFERENCES procedures(id), starts_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'booked', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS proposals(id INTEGER PRIMARY KEY, appointment_id INTEGER NOT NULL REFERENCES appointments(id), freed_appointment_id INTEGER NOT NULL REFERENCES appointments(id), state TEXT NOT NULL DEFAULT 'pending_patient', offered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, responded_at TEXT, approved_by TEXT, approved_at TEXT);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, details TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, username TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS appointment_confirmations(id INTEGER PRIMARY KEY, appointment_id INTEGER NOT NULL REFERENCES appointments(id), code_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, responded_at TEXT);
CREATE TABLE IF NOT EXISTS message_outbox(id INTEGER PRIMARY KEY, appointment_id INTEGER NOT NULL REFERENCES appointments(id), confirmation_id INTEGER NOT NULL REFERENCES appointment_confirmations(id), type TEXT NOT NULL, recipient TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'prepared', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(appointment_id,type));
`);
if(!db.prepare('PRAGMA table_info(chairs)').all().some(column=>column.name==='active'))db.exec('ALTER TABLE chairs ADD COLUMN active INTEGER NOT NULL DEFAULT 1');
const count = (table) => db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n;
const audit = db.prepare('INSERT INTO audit(actor,action,details) VALUES(?,?,?)');
if (!count('users')) {
  const salt = 'agendasmart-demo-v5';
  const hash = crypto.scryptSync('agenda2025!', salt, 64).toString('hex');
  db.prepare('INSERT INTO users(username,password_hash,role) VALUES(?,?,?)').run('segreteria', `${salt}:${hash}`, 'admin');
  db.prepare('INSERT INTO users(username,password_hash,role) VALUES(?,?,?)').run('admin', `${salt}:${hash}`, 'admin');
}
if (!count('professionals')) {
  const procedures = [['Igiene',45,'Igiene',['kit igiene']],['Prima visita',45,'Odontoiatria',['radiologia']],['Conservativa',60,'Conservativa',['turbina']],['Endodonzia',90,'Endodonzia',['turbina','microscopio']],['Implantologia',90,'Chirurgia',['chirurgia','radiologia']],['Chirurgia orale',60,'Chirurgia',['chirurgia']],['Protesi',60,'Protesi',['scanner intraorale']],['Ortodonzia',45,'Ortodonzia',['scanner intraorale']],['Controllo',30,'Odontoiatria',[]]];
  const addProc = db.prepare('INSERT INTO procedures(name,duration,specialty,resources) VALUES(?,?,?,?)');
  for (const [n,d,s,r] of procedures) addProc.run(n,d,s,JSON.stringify(r));
  const ps = db.prepare('SELECT id,name FROM procedures').all();
  const sets = [[1,2,8,9],[1,2,3,4,8,9],[2,3,7,8,9],[2,4,5,6,8,9],[2,5,6,7,8,9]];
  const colors = ['#c77b55','#527f73','#a07a4c','#786d9c','#52839a'];
  const names = [['Elena','Rossi','Igiene'],['Marco','Bianchi','Odontoiatria'],['Sara','Conti','Conservativa'],['Luca','Moretti','Endodonzia'],['Giulia','Ferrari','Chirurgia']];
  const addProf = db.prepare('INSERT INTO professionals(name,specialty,color,procedure_ids) VALUES(?,?,?,?)');
  names.forEach(([a,b,s],i)=>addProf.run(`${a} ${b}`,s,colors[i],JSON.stringify(sets[i])));
  const addChair = db.prepare('INSERT INTO chairs(name,resources) VALUES(?,?)');
  const resources = [['kit igiene'],['radiologia','turbina'],['turbina','scanner intraorale'],['turbina','microscopio'],['chirurgia','radiologia','scanner intraorale']];
  resources.forEach((r,i)=>addChair.run(`Poltrona ${i+1}`,JSON.stringify(r)));
  const patients = [['Anna Verdi','+39 333 100 2001'],['Paolo Neri','+39 333 100 2002'],['Maria Gallo','+39 333 100 2003'],['Davide Romano','+39 333 100 2004'],['Laura Greco','+39 333 100 2005'],['Matteo Costa','+39 333 100 2006'],['Chiara Fontana','+39 333 100 2007'],['Andrea Ricci','+39 333 100 2008'],['Francesca Marino','+39 333 100 2009'],['Stefano Bruno','+39 333 100 2010'],['Giada Riva','+39 333 100 2011'],['Tommaso Leone','+39 333 100 2012']];
  const addPatient = db.prepare('INSERT INTO patients(name,phone) VALUES(?,?)'); patients.forEach(p=>addPatient.run(...p));
  // Relative dates keep the demo useful whenever it is first opened.
  const today = new Date(); today.setHours(0,0,0,0);
  const offset = (d, h=9, m=0) => { const x=new Date(today); x.setDate(x.getDate()+d); x.setHours(h,m,0,0); return x.toISOString(); };
  const appts = [
    [1,1,1,1,0,9],[2,2,2,2,0,9],[3,3,3,3,0,10],[4,4,4,4,0,11],[5,5,5,5,0,14],[6,2,2,9,1,9],[7,1,1,1,1,10],[8,3,3,3,2,9],[9,4,4,4,2,11],[10,5,5,6,3,10],[11,2,2,2,3,14],[12,1,1,1,4,9],[3,3,3,3,4,11],[6,4,4,4,5,9],[8,5,5,5,6,10],[9,2,2,9,7,9],[12,1,1,1,8,9]
  ];
  const addAppt = db.prepare('INSERT INTO appointments(patient_id,professional_id,chair_id,procedure_id,starts_at) VALUES(?,?,?,?,?)');
  for (const [p,pro,ch,proc,day,hour] of appts) addAppt.run(p,pro,ch,proc,offset(day,hour));
  audit.run('sistema','demo_seed','Creati professionisti, poltrone, procedure, pazienti e appuntamenti fittizi.');
}
// Keep this qualification available in databases created before the demo catalog was corrected.
const controlProcedure = db.prepare("SELECT id FROM procedures WHERE name='Controllo'").get();
if (controlProcedure) {
  const addControl = db.prepare('UPDATE professionals SET procedure_ids=? WHERE id=?');
  for (const pro of db.prepare('SELECT id,procedure_ids FROM professionals').all()) {
    const ids = JSON.parse(pro.procedure_ids);
    if (!ids.includes(controlProcedure.id)) addControl.run(JSON.stringify([...ids, controlProcedure.id]), pro.id);
  }
}

const json = (res, status, data, headers={}) => { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}); res.end(JSON.stringify(data)); };
const readBody = (req) => new Promise((resolve,reject)=>{let raw='';req.on('data',c=>raw+=c);req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{})}catch(e){reject(e)}});});
function session(req) {
  const cookie = req.headers.cookie?.match(/agenda_session=([^;]+)/)?.[1];
  if (!cookie) return null;
  return db.prepare('SELECT username FROM sessions WHERE token_hash=? AND expires_at>?').get(crypto.createHash('sha256').update(cookie).digest('hex'),new Date().toISOString());
}
function requireAuth(req,res) { const s=session(req); if (!s) { json(res,401,{error:'Accesso richiesto'}); return null; } return s; }
const log = (actor, action, details) => audit.run(actor,action,JSON.stringify(details));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const confirmationAttempts=new Map();
function allowConfirmationAttempt(ip){let entry=confirmationAttempts.get(ip);if(!entry||Date.now()>entry.reset)entry={count:0,reset:Date.now()+900000};entry.count++;confirmationAttempts.set(ip,entry);return entry.count<=30;}
const publicAppUrl = (process.env.PUBLIC_APP_URL || `http://localhost:${PORT}`).replace(/\/$/,'');
function prepareReminderBatch() {
  const now=Date.now(), from=new Date(now+23*3600000).toISOString(), to=new Date(now+25*3600000).toISOString();
  db.prepare("UPDATE appointment_confirmations SET state='expired' WHERE state='pending' AND expires_at<=?").run(new Date().toISOString());
  db.prepare("UPDATE message_outbox SET status='expired' WHERE status='prepared' AND confirmation_id IN (SELECT id FROM appointment_confirmations WHERE state='expired')").run();
  const due=db.prepare(`SELECT a.id appointment_id,a.starts_at,p.name patient,p.phone,pr.name procedure,pr.duration,pro.name professional FROM appointments a JOIN patients p ON p.id=a.patient_id JOIN procedures pr ON pr.id=a.procedure_id JOIN professionals pro ON pro.id=a.professional_id WHERE a.status='booked' AND a.starts_at>? AND a.starts_at<=? AND NOT EXISTS(SELECT 1 FROM message_outbox m WHERE m.appointment_id=a.id AND (m.type='24h_confirmation' OR m.type LIKE '24h_confirmation:%') AND m.status='prepared')`).all(from,to);
  const createConfirmation=db.prepare('INSERT INTO appointment_confirmations(appointment_id,code_hash,expires_at) VALUES(?,?,?)');
  const createMessage=db.prepare('INSERT INTO message_outbox(appointment_id,confirmation_id,type,recipient,body) VALUES(?,?,?,?,?)');
  const created=[];
  for(const item of due){
    const code=crypto.randomBytes(5).toString('hex').toUpperCase(), expires=new Date(new Date(item.starts_at).getTime()+3*3600000).toISOString();
    const confirmationId=Number(createConfirmation.run(item.appointment_id,hash(code),expires).lastInsertRowid);
    const link=`${publicAppUrl}/conferma?confirm=${encodeURIComponent(code)}`;
    const when=new Intl.DateTimeFormat('it-IT',{dateStyle:'long',timeStyle:'short',timeZone:'Europe/Rome'}).format(new Date(item.starts_at));
    const body=`Buongiorno ${item.patient}, ti ricordiamo l'appuntamento di ${item.procedure} con ${item.professional} il ${when}. Conferma o disdici qui: ${link} Codice: ${code}.`;
    const outboxId=Number(createMessage.run(item.appointment_id,confirmationId,`24h_confirmation:${item.starts_at}:${confirmationId}`,item.phone,body).lastInsertRowid);
    created.push({outbox_id:outboxId,appointment_id:item.appointment_id});
    log('sistema','reminder_prepared',{outbox_id:outboxId,appointment_id:item.appointment_id});
  }
  return created;
}
function cancellationProposals(ap, actor, offer=true) {
  if(!offer)return [];
  const proc=db.prepare('SELECT * FROM procedures WHERE id=?').get(ap.procedure_id),prof=db.prepare('SELECT * FROM professionals WHERE id=?').get(ap.professional_id),chair=db.prepare('SELECT * FROM chairs WHERE id=?').get(ap.chair_id);
  if(!chair?.active)return [];
  const start=new Date(ap.starts_at),end=new Date(start.getTime()+proc.duration*60000);
  const candidates=db.prepare(`SELECT a.*,p.name patient,p.phone,pr.name procedure,pr.duration,pr.resources procedure_resources,pro.procedure_ids,c.resources FROM appointments a JOIN patients p ON p.id=a.patient_id JOIN procedures pr ON pr.id=a.procedure_id JOIN professionals pro ON pro.id=a.professional_id JOIN chairs c ON c.id=a.chair_id WHERE a.status='booked' AND a.starts_at>? ORDER BY a.starts_at`).all(new Date().toISOString());
  const eligible=candidates.filter(c=>JSON.parse(prof.procedure_ids).includes(c.procedure_id)&&JSON.parse(c.procedure_resources).every(r=>JSON.parse(chair.resources).includes(r))&&c.duration<=proc.duration&&
    !db.prepare(`SELECT 1 FROM appointments a JOIN procedures p ON p.id=a.procedure_id WHERE a.status='booked' AND a.professional_id=? AND julianday(a.starts_at)<julianday(?) AND julianday(a.starts_at)+(p.duration/1440.0)>julianday(?)`).get(prof.id,end.toISOString(),start.toISOString())&&
    !db.prepare(`SELECT 1 FROM appointments a JOIN procedures p ON p.id=a.procedure_id WHERE a.status='booked' AND a.chair_id=? AND julianday(a.starts_at)<julianday(?) AND julianday(a.starts_at)+(p.duration/1440.0)>julianday(?)`).get(chair.id,end.toISOString(),start.toISOString()));
  const created=[];
  for(const c of eligible){const result=db.prepare('INSERT INTO proposals(appointment_id,freed_appointment_id) VALUES(?,?)').run(c.id,ap.id);created.push({id:Number(result.lastInsertRowid),patient:c.patient,procedure:c.procedure,original:c.starts_at,slot:ap.starts_at,professional:prof.name,chair:chair.name});log(actor,'proposal_created',{proposal_id:Number(result.lastInsertRowid),appointment_id:c.id,freed_appointment_id:ap.id});}
  return created;
}
function findConfirmation(code) {
  if(typeof code!=='string'||!/^\w{10}$/.test(code))return null;
  return db.prepare(`SELECT c.*,a.starts_at,a.status appointment_status,p.name patient,pr.name procedure,pro.name professional FROM appointment_confirmations c JOIN appointments a ON a.id=c.appointment_id JOIN patients p ON p.id=a.patient_id JOIN procedures pr ON pr.id=a.procedure_id JOIN professionals pro ON pro.id=a.professional_id WHERE c.code_hash=?`).get(hash(code.toUpperCase()));
}
function api(req,res,url) {
  const s = session(req), actor=s?.username||'sistema';
  if (req.method==='POST' && url.pathname==='/api/login') return readBody(req).then(({username,password})=>{
    const u=db.prepare('SELECT * FROM users WHERE username=?').get(username||'');
    const [salt,expected]=(u?.password_hash||':').split(':');
    const actual=crypto.scryptSync(String(password||''),salt||'missing',64).toString('hex');
    if(!u||!crypto.timingSafeEqual(Buffer.from(actual,'hex'),Buffer.from(expected||'0'.repeat(128),'hex'))) return json(res,401,{error:'Credenziali non valide'});
    const token=crypto.randomBytes(32).toString('hex'), expires=new Date(Date.now()+12*3600000).toISOString();
    db.prepare('INSERT INTO sessions(token_hash,username,expires_at) VALUES(?,?,?)').run(crypto.createHash('sha256').update(token).digest('hex'),u.username,expires);
    log(u.username,'login',{role:u.role}); return json(res,200,{username:u.username,role:u.role},{'Set-Cookie':`agenda_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200`});
  }).catch(()=>json(res,400,{error:'Richiesta non valida'}));
  if (req.method==='POST' && url.pathname==='/api/logout') { if(s) db.prepare('DELETE FROM sessions WHERE username=?').run(s.username); return json(res,200,{ok:true},{'Set-Cookie':'agenda_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'}); }
  if (url.pathname==='/api/me') return json(res,200,{user:s||null});
  if (url.pathname==='/api/agenda' && req.method==='GET') {
    if(!requireAuth(req,res))return;
    const from=url.searchParams.get('from')||new Date().toISOString().slice(0,10), to=url.searchParams.get('to')||from;
    const rows=db.prepare(`SELECT a.*,p.name patient,p.phone,pr.name procedure,pr.duration,pr.specialty,pro.name professional,pro.color,c.name chair,(SELECT state FROM appointment_confirmations x WHERE x.appointment_id=a.id ORDER BY x.id DESC LIMIT 1) confirmation_state,(SELECT status FROM message_outbox m WHERE m.appointment_id=a.id ORDER BY m.id DESC LIMIT 1) reminder_status FROM appointments a JOIN patients p ON p.id=a.patient_id JOIN procedures pr ON pr.id=a.procedure_id JOIN professionals pro ON pro.id=a.professional_id JOIN chairs c ON c.id=a.chair_id WHERE a.status='booked' AND a.starts_at>=? AND a.starts_at<? ORDER BY a.starts_at`).all(`${from}T00:00:00`,`${to}T23:59:59.999`);
    return json(res,200,{appointments:rows,professionals:db.prepare('SELECT * FROM professionals').all(),chairs:db.prepare('SELECT * FROM chairs WHERE active=1').all()});
  }
  if (url.pathname==='/api/catalog' && req.method==='GET') { if(!requireAuth(req,res))return; return json(res,200,{professionals:db.prepare('SELECT * FROM professionals').all(),chairs:db.prepare('SELECT * FROM chairs WHERE active=1').all(),procedures:db.prepare('SELECT * FROM procedures').all(),patients:db.prepare('SELECT * FROM patients').all()}); }
  if(req.method==='POST'&&url.pathname==='/api/patients')return readBody(req).then(({name,phone,notes=''})=>{if(!requireAuth(req,res))return;if(typeof name!=='string'||name.trim().length<2||typeof phone!=='string'||phone.trim().length<5)return json(res,400,{error:'Inserisci nome e telefono validi'});const r=db.prepare('INSERT INTO patients(name,phone,notes) VALUES(?,?,?)').run(name.trim(),phone.trim(),String(notes).trim());const id=Number(r.lastInsertRowid);log(actor,'patient_created',{patient_id:id});return json(res,201,{id});}).catch(()=>json(res,400,{error:'Dati non validi'}));
  if(req.method==='POST'&&url.pathname==='/api/professionals')return readBody(req).then(({name,specialty,procedure_ids=[],color='#456b55'})=>{if(!requireAuth(req,res))return;const ids=[...new Set((Array.isArray(procedure_ids)?procedure_ids:[]).map(Number))],procedures=db.prepare('SELECT id FROM procedures').all().map(x=>x.id);if(typeof name!=='string'||name.trim().length<3||typeof specialty!=='string'||!specialty.trim()||!ids.length||ids.some(id=>!procedures.includes(id)))return json(res,400,{error:'Nome, specialità e almeno una prestazione valida sono obbligatori'});if(!/^#[0-9a-f]{6}$/i.test(color))return json(res,400,{error:'Colore non valido'});const r=db.prepare('INSERT INTO professionals(name,specialty,color,procedure_ids) VALUES(?,?,?,?)').run(name.trim(),specialty.trim(),color,JSON.stringify(ids));const id=Number(r.lastInsertRowid);log(actor,'professional_created',{professional_id:id});return json(res,201,{id});}).catch(()=>json(res,400,{error:'Dati non validi'}));
  if(req.method==='POST'&&url.pathname==='/api/procedures')return readBody(req).then(({name,duration,specialty,resources=[]})=>{if(!requireAuth(req,res))return;const mins=Number(duration),resourcesList=[...new Set((Array.isArray(resources)?resources:[]).map(x=>String(x).trim()).filter(Boolean))];if(typeof name!=='string'||name.trim().length<2||typeof specialty!=='string'||!specialty.trim()||!Number.isInteger(mins)||mins<10||mins>480||resourcesList.some(x=>x.length>60))return json(res,400,{error:'Controlla nome, specialità, durata e attrezzature'});const r=db.prepare('INSERT INTO procedures(name,duration,specialty,resources) VALUES(?,?,?,?)').run(name.trim(),mins,specialty.trim(),JSON.stringify(resourcesList));const id=Number(r.lastInsertRowid);log(actor,'procedure_created',{procedure_id:id});return json(res,201,{id});}).catch(()=>json(res,400,{error:'Dati non validi'}));
  if(req.method==='POST'&&url.pathname==='/api/chairs')return readBody(req).then(({name,resources=[]})=>{if(!requireAuth(req,res))return;const resourcesList=[...new Set((Array.isArray(resources)?resources:[]).map(x=>String(x).trim()).filter(Boolean))];if(typeof name!=='string'||name.trim().length<2||resourcesList.some(x=>x.length>60))return json(res,400,{error:'Nome poltrona e risorse non validi'});const r=db.prepare('INSERT INTO chairs(name,resources) VALUES(?,?)').run(name.trim(),JSON.stringify(resourcesList));const id=Number(r.lastInsertRowid);log(actor,'chair_created',{chair_id:id,name:name.trim()});return json(res,201,{id});}).catch(()=>json(res,400,{error:'Dati non validi'}));
  let roomMatch=url.pathname.match(/^\/api\/chairs\/(\d+)$/);if(req.method==='DELETE'&&roomMatch){if(!requireAuth(req,res))return;const id=Number(roomMatch[1]),room=db.prepare('SELECT * FROM chairs WHERE id=? AND active=1').get(id);if(!room)return json(res,404,{error:'Stanza non trovata'});if(db.prepare('SELECT COUNT(*) n FROM chairs WHERE active=1').get().n<=1)return json(res,409,{error:'Deve restare almeno una stanza'});if(db.prepare("SELECT 1 FROM appointments WHERE chair_id=? AND status='booked' LIMIT 1").get(id))return json(res,409,{error:'Annulla o sposta prima gli appuntamenti di questa stanza'});const history=db.prepare('SELECT 1 FROM appointments WHERE chair_id=? LIMIT 1').get(id);if(history)db.prepare('UPDATE chairs SET active=0 WHERE id=?').run(id);else db.prepare('DELETE FROM chairs WHERE id=?').run(id);log(actor,'chair_deactivated',{chair_id:id});return json(res,200,{ok:true});}
  if(req.method==='GET'&&url.pathname==='/api/reminders'){if(!requireAuth(req,res))return;return json(res,200,{messages:db.prepare(`SELECT m.*,p.name patient,a.starts_at,pr.name procedure FROM message_outbox m JOIN appointments a ON a.id=m.appointment_id JOIN patients p ON p.id=a.patient_id JOIN procedures pr ON pr.id=a.procedure_id ORDER BY m.id DESC LIMIT 200`).all(),prepared_window_hours:24});}
  if(req.method==='POST'&&url.pathname==='/api/reminders/run'){if(!requireAuth(req,res))return;const messages=prepareReminderBatch();return json(res,200,{prepared:messages.length,messages});}
  if(req.method==='GET'&&url.pathname==='/api/public/confirm'){const ip=req.socket.remoteAddress||'unknown';if(!allowConfirmationAttempt(ip))return json(res,429,{error:'Troppi tentativi, riprova più tardi'});const code=url.searchParams.get('code')||'',c=findConfirmation(code);if(!c)return json(res,404,{error:'Codice non valido'});if(c.state!=='pending'||c.appointment_status!=='booked')return json(res,409,{error:'Questo appuntamento non è più in attesa di conferma'});if(c.expires_at<new Date().toISOString()){db.prepare("UPDATE appointment_confirmations SET state='expired' WHERE id=?").run(c.id);return json(res,410,{error:'Il codice è scaduto'});}return json(res,200,{appointment:{patient:c.patient.split(' ')[0],procedure:c.procedure,professional:c.professional,starts_at:c.starts_at}});}
  if(req.method==='POST'&&url.pathname==='/api/public/confirm'){return readBody(req).then(({code,action})=>{const ip=req.socket.remoteAddress||'unknown';if(!allowConfirmationAttempt(ip))return json(res,429,{error:'Troppi tentativi, riprova più tardi'});const c=findConfirmation(code);if(!c)return json(res,404,{error:'Codice non valido'});if(c.state!=='pending'||c.appointment_status!=='booked')return json(res,409,{error:'Questo appuntamento non è più in attesa di conferma'});if(c.expires_at<new Date().toISOString()){db.prepare("UPDATE appointment_confirmations SET state='expired' WHERE id=?").run(c.id);return json(res,410,{error:'Il codice è scaduto'});}if(action==='confirm'){db.prepare("UPDATE appointment_confirmations SET state='confirmed',responded_at=CURRENT_TIMESTAMP WHERE id=?").run(c.id);db.prepare("UPDATE message_outbox SET status='responded' WHERE confirmation_id=? AND status='prepared'").run(c.id);log('cliente_codice','appointment_confirmed',{appointment_id:c.appointment_id,confirmation_id:c.id});return json(res,200,{state:'confirmed'});}if(action==='cancel'){db.prepare("UPDATE appointments SET status='cancelled' WHERE id=?").run(c.appointment_id);db.prepare("UPDATE appointment_confirmations SET state='cancelled',responded_at=CURRENT_TIMESTAMP WHERE id=?").run(c.id);db.prepare("UPDATE message_outbox SET status='cancelled' WHERE appointment_id=? AND status='prepared'").run(c.appointment_id);log('cliente_codice','appointment_cancelled',{appointment_id:c.appointment_id,confirmation_id:c.id});const ap=db.prepare('SELECT * FROM appointments WHERE id=?').get(c.appointment_id);const proposals=cancellationProposals(ap,'cliente_codice',true);return json(res,200,{state:'cancelled',proposals:proposals.length});}return json(res,400,{error:'Scegli conferma o disdetta'});}).catch(()=>json(res,400,{error:'Richiesta non valida'}));}
  if (url.pathname==='/api/audit' && req.method==='GET') { if(!requireAuth(req,res))return; return json(res,200,{events:db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT 80').all()}); }
  if (req.method==='POST' && url.pathname==='/api/appointments') return readBody(req).then(({patient_id,professional_id,chair_id,procedure_id,starts_at})=>{
    if(!requireAuth(req,res))return;
    const proc=db.prepare('SELECT * FROM procedures WHERE id=?').get(procedure_id), prof=db.prepare('SELECT * FROM professionals WHERE id=?').get(professional_id), chair=db.prepare('SELECT * FROM chairs WHERE id=? AND active=1').get(chair_id);
    if(!proc||!prof||!chair||!db.prepare('SELECT id FROM patients WHERE id=?').get(patient_id)) return json(res,400,{error:'Selezione incompleta'});
    if(!JSON.parse(prof.procedure_ids).includes(Number(procedure_id))||!JSON.parse(proc.resources).every(r=>JSON.parse(chair.resources).includes(r))) return json(res,400,{error:'Professionista o poltrona incompatibile con la prestazione'});
    const start=new Date(starts_at), end=new Date(start.getTime()+proc.duration*60000);
    if(!Number.isFinite(start.getTime())) return json(res,400,{error:'Data non valida'});
    const conflict=db.prepare(`SELECT a.id FROM appointments a JOIN procedures p ON p.id=a.procedure_id WHERE a.status='booked' AND (a.professional_id=? OR a.chair_id=?) AND julianday(a.starts_at)<julianday(?) AND julianday(a.starts_at)+(p.duration/1440.0)>julianday(?)`).get(prof.id,chair.id,end.toISOString(),start.toISOString());
    if(conflict)return json(res,409,{error:'Sovrapposizione per professionista o poltrona'});
    const result=db.prepare('INSERT INTO appointments(patient_id,professional_id,chair_id,procedure_id,starts_at) VALUES(?,?,?,?,?)').run(patient_id,prof.id,chair.id,proc.id,start.toISOString());
    log(actor,'appointment_created',{appointment_id:Number(result.lastInsertRowid),patient_id,professional_id,chair_id,procedure_id,starts_at:start.toISOString()}); return json(res,201,{id:Number(result.lastInsertRowid)});
  }).catch(()=>json(res,400,{error:'Dati non validi'}));
  let match=url.pathname.match(/^\/api\/appointments\/(\d+)\/cancel$/);
  if(req.method==='POST'&&match)return readBody(req).then(({offer=true})=>{
    if(!requireAuth(req,res))return;
    const id=Number(match[1]), ap=db.prepare("SELECT * FROM appointments WHERE id=? AND status='booked'").get(id); if(!ap)return json(res,404,{error:'Appuntamento non trovato'});
    db.prepare("UPDATE appointments SET status='cancelled' WHERE id=?").run(id);db.prepare("UPDATE appointment_confirmations SET state='cancelled',responded_at=CURRENT_TIMESTAMP WHERE appointment_id=? AND state='pending'").run(id);db.prepare("UPDATE message_outbox SET status='cancelled' WHERE appointment_id=? AND status='prepared'").run(id);log(actor,'appointment_cancelled',{appointment_id:id});
    const created=cancellationProposals(ap,actor,offer),proc=db.prepare('SELECT * FROM procedures WHERE id=?').get(ap.procedure_id),prof=db.prepare('SELECT * FROM professionals WHERE id=?').get(ap.professional_id),chair=db.prepare('SELECT * FROM chairs WHERE id=?').get(ap.chair_id),patient=db.prepare('SELECT * FROM patients WHERE id=?').get(ap.patient_id);
    return json(res,200,{freed:{id,starts_at:ap.starts_at,duration:proc.duration,professional:prof.name,chair:chair.name,patient:patient.name},proposals:created});
  }).catch(()=>json(res,400,{error:'Richiesta non valida'}));
  match=url.pathname.match(/^\/api\/proposals\/(\d+)\/(accept|decline|approve|reject)$/);
  if(req.method==='POST'&&match)return readBody(req).then(({decision}={})=>{
    if(!requireAuth(req,res))return;
    const id=Number(match[1]), action=match[2], p=db.prepare('SELECT * FROM proposals WHERE id=?').get(id); if(!p)return json(res,404,{error:'Proposta non trovata'});
    if(action==='accept'||action==='decline'){
      if(p.state!=='pending_patient')return json(res,409,{error:'La proposta non è più in attesa'});
      const state=action==='accept'?'accepted_waiting_approval':'declined'; db.prepare('UPDATE proposals SET state=?,responded_at=CURRENT_TIMESTAMP WHERE id=?').run(state,id); log(actor,`proposal_${action}`,{proposal_id:id}); return json(res,200,{state});
    }
    if(p.state!=='accepted_waiting_approval')return json(res,409,{error:'Serve prima l’accettazione simulata del paziente'});
    if(action==='reject'){db.prepare("UPDATE proposals SET state='rejected',approved_by=?,approved_at=CURRENT_TIMESTAMP WHERE id=?").run(actor,id);log(actor,'proposal_rejected',{proposal_id:id});return json(res,200,{state:'rejected'});}
    if(action==='approve'){
      const target=db.prepare('SELECT * FROM appointments WHERE id=? AND status=\'booked\'').get(p.appointment_id), freed=db.prepare('SELECT * FROM appointments WHERE id=? AND status=\'cancelled\'').get(p.freed_appointment_id);
      if(!target||!freed)return json(res,409,{error:'Appuntamento o spazio non più disponibile'});
      const dest=db.prepare('SELECT * FROM appointments WHERE id=?').get(freed.id), len=db.prepare('SELECT duration FROM procedures WHERE id=?').get(target.procedure_id).duration;
      const destinationEnd=new Date(new Date(dest.starts_at).getTime()+len*60000).toISOString();
      const targetProc=db.prepare('SELECT * FROM procedures WHERE id=?').get(target.procedure_id), destinationPro=db.prepare('SELECT * FROM professionals WHERE id=?').get(dest.professional_id), destinationChair=db.prepare('SELECT * FROM chairs WHERE id=?').get(dest.chair_id);
      if(!destinationChair?.active||!JSON.parse(destinationPro.procedure_ids).includes(target.procedure_id)||!JSON.parse(targetProc.resources).every(r=>JSON.parse(destinationChair.resources).includes(r)))return json(res,409,{error:'Professionista o stanza non attiva o non compatibile con la prestazione'});
      const conflict=db.prepare(`SELECT 1 FROM appointments a JOIN procedures p ON p.id=a.procedure_id WHERE a.id<>? AND a.status='booked' AND (a.professional_id=? OR a.chair_id=?) AND julianday(a.starts_at)<julianday(?) AND julianday(a.starts_at)+(p.duration/1440.0)>julianday(?)`).get(target.id,dest.professional_id,dest.chair_id,destinationEnd,dest.starts_at);
      if(conflict)return json(res,409,{error:'Lo spazio è stato occupato nel frattempo'});
      db.prepare('UPDATE appointments SET starts_at=?,professional_id=?,chair_id=? WHERE id=?').run(dest.starts_at,dest.professional_id,dest.chair_id,target.id);db.prepare("UPDATE appointment_confirmations SET state='cancelled',responded_at=CURRENT_TIMESTAMP WHERE appointment_id=? AND state='pending'").run(target.id);db.prepare("UPDATE message_outbox SET status='cancelled' WHERE appointment_id=? AND status='prepared'").run(target.id);
      db.prepare("UPDATE proposals SET state='approved',approved_by=?,approved_at=CURRENT_TIMESTAMP WHERE id=?").run(actor,id); log(actor,'proposal_approved',{proposal_id:id,appointment_id:target.id,old_starts_at:target.starts_at,new_starts_at:dest.starts_at});return json(res,200,{state:'approved'});
    }
  }).catch(()=>json(res,400,{error:'Richiesta non valida'}));
  match=url.pathname.match(/^\/api\/proposals\/?$/);
  if(req.method==='GET'&&url.pathname==='/api/proposals'){if(!requireAuth(req,res))return;return json(res,200,{proposals:db.prepare(`SELECT q.*,p.name patient,pr.name procedure,a.starts_at original_starts_at,f.starts_at freed_starts_at FROM proposals q JOIN appointments a ON a.id=q.appointment_id JOIN patients p ON p.id=a.patient_id JOIN procedures pr ON pr.id=a.procedure_id JOIN appointments f ON f.id=q.freed_appointment_id ORDER BY q.id DESC`).all()});}
  if(url.pathname.startsWith('/api/'))return json(res,404,{error:'Endpoint non trovato'});
  const file=path.join(ROOT,'public',url.pathname==='/'||url.pathname==='/conferma'?'index.html':decodeURIComponent(url.pathname.slice(1)));
  if(!file.startsWith(path.join(ROOT,'public')))return json(res,403,{error:'Percorso non consentito'});
  fs.readFile(file,(err,content)=>{if(err)return json(res,404,{error:'File non trovato'});const type=file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'text/html';res.writeHead(200,{'Content-Type':`${type}; charset=utf-8`,'Cache-Control':'no-store'});res.end(content);});
}
http.createServer((req,res)=>{const url=new URL(req.url,`http://${req.headers.host||'localhost'}`); if(req.method==='GET'&&url.pathname==='/health')return json(res,200,{ok:true,version:'5.0.0'}); api(req,res,url);}).listen(PORT,'0.0.0.0',()=>{console.log(`AgendaSmart V5 pronta: http://localhost:${PORT}`);try{prepareReminderBatch();}catch(error){console.error('Preparazione promemoria:',error.message);}const timer=setInterval(()=>{try{prepareReminderBatch();}catch(error){console.error('Preparazione promemoria:',error.message);}},15*60*1000);timer.unref();});

