import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response } from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'agendasmart.sqlite'));
db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');

db.exec(`
  CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS professionals(
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    specialty TEXT NOT NULL,
    color TEXT NOT NULL,
    procedure_ids TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS chairs(
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    resources TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS procedures(
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    duration INTEGER NOT NULL,
    specialty TEXT NOT NULL,
    resources TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS patients(
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS appointments(
    id INTEGER PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id),
    professional_id INTEGER NOT NULL REFERENCES professionals(id),
    chair_id INTEGER NOT NULL REFERENCES chairs(id),
    procedure_id INTEGER NOT NULL REFERENCES procedures(id),
    starts_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'booked',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS proposals(
    id INTEGER PRIMARY KEY,
    appointment_id INTEGER NOT NULL REFERENCES appointments(id),
    freed_appointment_id INTEGER NOT NULL REFERENCES appointments(id),
    state TEXT NOT NULL DEFAULT 'pending_patient',
    offered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at TEXT,
    approved_by TEXT,
    approved_at TEXT
  );
  CREATE TABLE IF NOT EXISTS audit(
    id INTEGER PRIMARY KEY,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions(
    token_hash TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS appointment_confirmations(
    id INTEGER PRIMARY KEY,
    appointment_id INTEGER NOT NULL REFERENCES appointments(id),
    code_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at TEXT
  );
  CREATE TABLE IF NOT EXISTS message_outbox(
    id INTEGER PRIMARY KEY,
    appointment_id INTEGER NOT NULL REFERENCES appointments(id),
    confirmation_id INTEGER NOT NULL REFERENCES appointment_confirmations(id),
    type TEXT NOT NULL,
    recipient TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'prepared',
    sent_at TEXT,
    sent_via TEXT,
    sent_from TEXT,
    provider_message_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(appointment_id, type)
  );
  CREATE TABLE IF NOT EXISTS studio_settings(
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const chairCols = db.prepare('PRAGMA table_info(chairs)').all() as Array<{ name: string }>;
if (!chairCols.some((column) => column.name === 'active')) {
  db.exec('ALTER TABLE chairs ADD COLUMN active INTEGER NOT NULL DEFAULT 1');
}

const outboxCols = db.prepare('PRAGMA table_info(message_outbox)').all() as Array<{ name: string }>;
for (const col of ['sent_at', 'sent_via', 'sent_from', 'provider_message_id']) {
  if (!outboxCols.some((column) => column.name === col)) {
    db.exec(`ALTER TABLE message_outbox ADD COLUMN ${col} TEXT`);
  }
}

const proposalCols = db.prepare('PRAGMA table_info(proposals)').all() as Array<{ name: string }>;
for (const col of ['invite_code_hash', 'invite_code', 'sms_sent_at', 'move_sms_sent_at']) {
  if (!proposalCols.some((column) => column.name === col)) {
    db.exec(`ALTER TABLE proposals ADD COLUMN ${col} TEXT`);
  }
}

const count = (table: string): number =>
  Number((db.prepare(`SELECT COUNT(*) n FROM ${table}`).get() as { n: number }).n);

const auditStmt = db.prepare('INSERT INTO audit(actor,action,details) VALUES(?,?,?)');
const log = (actor: string, action: string, details: unknown) => {
  auditStmt.run(actor, action, typeof details === 'string' ? details : JSON.stringify(details));
};

// Seed demo users
if (!count('users')) {
  const salt = 'agendasmart-demo-v5';
  const passwordHash = crypto.scryptSync('agenda2025!', salt, 64).toString('hex');
  db.prepare('INSERT INTO users(username,password_hash,role) VALUES(?,?,?)').run(
    'segreteria',
    `${salt}:${passwordHash}`,
    'admin'
  );
  db.prepare('INSERT INTO users(username,password_hash,role) VALUES(?,?,?)').run(
    'admin',
    `${salt}:${passwordHash}`,
    'admin'
  );
}

// Seed demo clinical catalog & appointments
if (!count('professionals')) {
  const procedures: Array<[string, number, string, string[]]> = [
    ['Igiene', 45, 'Igiene', ['kit igiene']],
    ['Prima visita', 45, 'Odontoiatria', ['radiologia']],
    ['Conservativa', 60, 'Conservativa', ['turbina']],
    ['Endodonzia', 90, 'Endodonzia', ['turbina', 'microscopio']],
    ['Implantologia', 90, 'Chirurgia', ['chirurgia', 'radiologia']],
    ['Chirurgia orale', 60, 'Chirurgia', ['chirurgia']],
    ['Protesi', 60, 'Protesi', ['scanner intraorale']],
    ['Ortodonzia', 45, 'Ortodonzia', ['scanner intraorale']],
    ['Controllo', 30, 'Odontoiatria', []],
  ];
  const addProc = db.prepare('INSERT INTO procedures(name,duration,specialty,resources) VALUES(?,?,?,?)');
  for (const [name, duration, specialty, resources] of procedures) {
    addProc.run(name, duration, specialty, JSON.stringify(resources));
  }

  const sets = [
    [1, 2, 8, 9],
    [1, 2, 3, 4, 8, 9],
    [2, 3, 7, 8, 9],
    [2, 4, 5, 6, 8, 9],
    [2, 5, 6, 7, 8, 9],
  ];
  const colors = ['#c77b55', '#3d7465', '#9d7644', '#6b6394', '#437691'];
  const names: Array<[string, string, string]> = [
    ['Elena', 'Rossi', 'Igiene'],
    ['Marco', 'Bianchi', 'Odontoiatria'],
    ['Sara', 'Conti', 'Conservativa'],
    ['Luca', 'Moretti', 'Endodonzia'],
    ['Giulia', 'Ferrari', 'Chirurgia'],
  ];
  const addProf = db.prepare(
    'INSERT INTO professionals(name,specialty,color,procedure_ids) VALUES(?,?,?,?)'
  );
  names.forEach(([first, last, specialty], i) => {
    addProf.run(`${first} ${last}`, specialty, colors[i], JSON.stringify(sets[i]));
  });

  const addChair = db.prepare('INSERT INTO chairs(name,resources) VALUES(?,?)');
  const chairResources = [
    ['kit igiene'],
    ['radiologia', 'turbina'],
    ['turbina', 'scanner intraorale'],
    ['turbina', 'microscopio'],
    ['chirurgia', 'radiologia', 'scanner intraorale'],
  ];
  chairResources.forEach((resList, i) => {
    addChair.run(`Poltrona ${i + 1}`, JSON.stringify(resList));
  });

  const patients: Array<[string, string]> = [
    ['Anna Verdi', '+39 333 100 2001'],
    ['Paolo Neri', '+39 333 100 2002'],
    ['Maria Gallo', '+39 333 100 2003'],
    ['Davide Romano', '+39 333 100 2004'],
    ['Laura Greco', '+39 333 100 2005'],
    ['Matteo Costa', '+39 333 100 2006'],
    ['Chiara Fontana', '+39 333 100 2007'],
    ['Andrea Ricci', '+39 333 100 2008'],
    ['Francesca Marino', '+39 333 100 2009'],
    ['Stefano Bruno', '+39 333 100 2010'],
    ['Giada Riva', '+39 333 100 2011'],
    ['Tommaso Leone', '+39 333 100 2012'],
  ];
  const addPatient = db.prepare('INSERT INTO patients(name,phone) VALUES(?,?)');
  patients.forEach(([name, phone]) => addPatient.run(name, phone));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const offset = (days: number, hour = 9, minute = 0) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };

  const appts: Array<[number, number, number, number, number, number]> = [
    [1, 1, 1, 1, 0, 9],
    [2, 2, 2, 2, 0, 9],
    [3, 3, 3, 3, 0, 10],
    [4, 4, 4, 4, 0, 11],
    [5, 5, 5, 5, 0, 14],
    [6, 2, 2, 9, 1, 9],
    [7, 1, 1, 1, 1, 10],
    [8, 3, 3, 3, 2, 9],
    [9, 4, 4, 4, 2, 11],
    [10, 5, 5, 6, 3, 10],
    [11, 2, 2, 2, 3, 14],
    [12, 1, 1, 1, 4, 9],
    [3, 3, 3, 3, 4, 11],
    [6, 4, 4, 4, 5, 9],
    [8, 5, 5, 5, 6, 10],
    [9, 2, 2, 9, 7, 9],
    [12, 1, 1, 1, 8, 9],
  ];
  const addAppt = db.prepare(
    'INSERT INTO appointments(patient_id,professional_id,chair_id,procedure_id,starts_at) VALUES(?,?,?,?,?)'
  );
  for (const [patientId, profId, chairId, procId, day, hour] of appts) {
    addAppt.run(patientId, profId, chairId, procId, offset(day, hour));
  }

  log(
    'sistema',
    'demo_seed',
    'Creati professionisti, poltrone, procedure, pazienti e appuntamenti fittizi.'
  );
}

// Keep Controllo qualification available for all professionals
const controlProcedure = db.prepare("SELECT id FROM procedures WHERE name='Controllo'").get() as
  | { id: number }
  | undefined;
if (controlProcedure) {
  const updateProf = db.prepare('UPDATE professionals SET procedure_ids=? WHERE id=?');
  const allProfs = db.prepare('SELECT id,procedure_ids FROM professionals').all() as Array<{
    id: number;
    procedure_ids: string;
  }>;
  for (const pro of allProfs) {
    const ids = JSON.parse(pro.procedure_ids) as number[];
    if (!ids.includes(controlProcedure.id)) {
      updateProf.run(JSON.stringify([...ids, controlProcedure.id]), pro.id);
    }
  }
}

// Seed 2 realistic future demo cancellations once so the Disdette section is immediately actionable
const hasAnyCancellation =
  Number(
    (
      db.prepare("SELECT COUNT(*) n FROM appointments WHERE status='cancelled'").get() as {
        n: number;
      }
    ).n
  ) > 0;
const hasCancellationAudit = Boolean(
  db
    .prepare(
      "SELECT 1 FROM audit WHERE action IN ('appointment_cancelled','demo_cancellations_seed') LIMIT 1"
    )
    .get()
);
if (!hasAnyCancellation && !hasCancellationAudit && count('patients') >= 7 && count('chairs') >= 3) {
  const demoBase = new Date();
  demoBase.setHours(0, 0, 0, 0);
  const demoSlot = (days: number, hour: number) => {
    const d = new Date(demoBase);
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };
  db.prepare(
    "INSERT INTO appointments(patient_id,professional_id,chair_id,procedure_id,starts_at,status) VALUES(?,?,?,?,?,'cancelled')"
  ).run(7, 1, 1, 1, demoSlot(1, 11));
  db.prepare(
    "INSERT INTO appointments(patient_id,professional_id,chair_id,procedure_id,starts_at,status) VALUES(?,?,?,?,?,'cancelled')"
  ).run(4, 3, 3, 3, demoSlot(1, 15));
  log(
    'sistema',
    'demo_cancellations_seed',
    'Inserite 2 disdette dimostrativi con slot futuri liberi da rimpiazzare.'
  );
}

const hashValue = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

function getSession(req: Request): { username: string; role: string } | null {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const cookieToken = req.headers.cookie?.match(/agenda_session=([^;]+)/)?.[1] ?? null;
  const token = bearerToken || cookieToken;
  if (!token) return null;

  const row = db
    .prepare(
      `SELECT s.username, COALESCE(u.role, 'admin') AS role
       FROM sessions s
       LEFT JOIN users u ON u.username = s.username
       WHERE s.token_hash=? AND s.expires_at>?`
    )
    .get(hashValue(token), new Date().toISOString()) as { username: string; role: string } | undefined;

  return row || null;
}

function requireAuth(req: Request, res: Response): { username: string; role: string } | null {
  const session = getSession(req);
  if (!session) {
    res.status(401).json({ error: 'Accesso richiesto' });
    return null;
  }
  return session;
}

const confirmationAttempts = new Map<string, { count: number; reset: number }>();
function allowConfirmationAttempt(ip: string): boolean {
  let entry = confirmationAttempts.get(ip);
  if (!entry || Date.now() > entry.reset) {
    entry = { count: 0, reset: Date.now() + 900_000 };
  }
  entry.count += 1;
  confirmationAttempts.set(ip, entry);
  return entry.count <= 30;
}

function resolvePublicAppUrl(req?: Request): string {
  const configured = (process.env.PUBLIC_APP_URL || process.env.APP_URL || '').trim();
  if (configured && !configured.startsWith('MY_')) {
    return configured.replace(/\/$/, '');
  }
  if (req) {
    const proto = (req.headers['x-forwarded-proto'] as string) || 'http';
    const host = req.headers.host || `localhost:${PORT}`;
    return `${proto}://${host}`.replace(/\/$/, '');
  }
  return `http://localhost:${PORT}`;
}

function getSetting(key: string): { value: string; updated_at: string } | null {
  const row = db
    .prepare('SELECT value, updated_at FROM studio_settings WHERE key=?')
    .get(key) as { value: string; updated_at: string } | undefined;
  return row || null;
}

function setSetting(key: string, value: string): void {
  db.prepare(
    `INSERT INTO studio_settings(key, value, updated_at) VALUES(?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`
  ).run(key, value);
}

function normalizeWhatsAppPhone(raw: string, defaultPrefix = '+39'): {
  digits: string;
  formatted: string;
} | null {
  const cleaned = raw.trim().replace(/[\s\-().]/g, '');
  if (!cleaned) return null;
  let normalized = cleaned;
  if (normalized.startsWith('00')) {
    normalized = `+${normalized.slice(2)}`;
  } else if (!normalized.startsWith('+')) {
    const prefixClean = defaultPrefix.trim().replace(/[^\d+]/g, '') || '+39';
    normalized = `${prefixClean.startsWith('+') ? prefixClean : `+${prefixClean}`}${normalized}`;
  }
  const digits = normalized.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  return { digits, formatted: `+${digits}` };
}

function getWhatsAppConfig() {
  const phoneRow = getSetting('whatsapp_phone');
  const senderRow = getSetting('whatsapp_sender_name');
  const prefixRow = getSetting('whatsapp_default_prefix');
  const cloudApiConfigured = Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN?.trim() &&
      process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
  );

  return {
    connected: Boolean(phoneRow?.value),
    phone: phoneRow?.value || '',
    sender_name: senderRow?.value || 'Studio Odontoiatrico',
    default_prefix: prefixRow?.value || '+39',
    cloud_api_configured: cloudApiConfigured,
    updated_at: phoneRow?.updated_at || null,
  };
}

function buildWhatsAppUrl(recipient: string, body: string, defaultPrefix = '+39'): string {
  const normalized = normalizeWhatsAppPhone(recipient, defaultPrefix);
  const digits = normalized?.digits || recipient.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(body)}`;
}

interface TextBeeSim {
  subscriptionId: number;
  carrierName: string;
  simSlotIndex: number;
  serviceState: string;
}

interface TextBeeDevice {
  id: string;
  brand: string;
  model: string;
  enabled: boolean;
  label: string;
  sims: TextBeeSim[];
}

function getTextBeeSettings() {
  const apiKey = (process.env.TEXTBEE_API_KEY || '').trim();
  const baseUrl = (process.env.TEXTBEE_BASE_URL || 'https://api.textbee.dev/api/v1')
    .trim()
    .replace(/\/$/, '');
  const savedDevice = getSetting('textbee_device_id')?.value?.trim() || '';
  const envDevice = (process.env.TEXTBEE_DEVICE_ID || '').trim();
  const savedSimRaw = getSetting('textbee_sim_subscription_id')?.value?.trim() || '';
  const parsedSim = savedSimRaw !== '' && Number.isInteger(Number(savedSimRaw)) ? Number(savedSimRaw) : null;
  return {
    configured: Boolean(apiKey),
    apiKey,
    baseUrl,
    deviceId: savedDevice || envDevice || '',
    simSubscriptionId: parsedSim,
  };
}

async function fetchTextBeeDevices(): Promise<{ devices: TextBeeDevice[]; error: string | null }> {
  const cfg = getTextBeeSettings();
  if (!cfg.configured) {
    return { devices: [], error: 'Chiave API TextBee non configurata sul server' };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(`${cfg.baseUrl}/gateway/devices`, {
      headers: { 'x-api-key': cfg.apiKey },
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => ({}))) as {
      data?: Array<{
        _id?: string;
        id?: string;
        brand?: string;
        model?: string;
        enabled?: boolean;
        name?: string;
        simInfo?: {
          sims?: Array<{
            subscriptionId?: number;
            carrierName?: string;
            displayName?: string;
            simSlotIndex?: number;
            serviceState?: string;
          }>;
        };
      }>;
      message?: string;
      error?: string;
    };
    if (!response.ok) {
      return {
        devices: [],
        error: payload.message || payload.error || `Errore TextBee HTTP ${response.status}`,
      };
    }
    const rawList = Array.isArray(payload.data) ? payload.data : [];
    const devices: TextBeeDevice[] = rawList
      .map((d) => {
        const id = String(d._id || d.id || '');
        const brand = String(d.brand || '').trim();
        const model = String(d.model || '').trim();
        const name = String(d.name || '').trim();
        const label =
          name || [brand, model].filter(Boolean).join(' ') || `Dispositivo ${id.slice(0, 6)}`;
        const sims: TextBeeSim[] = Array.isArray(d.simInfo?.sims)
          ? d.simInfo!.sims
              .filter((s) => typeof s.subscriptionId === 'number')
              .map((s) => ({
                subscriptionId: Number(s.subscriptionId),
                carrierName: String(s.displayName || s.carrierName || 'SIM').trim(),
                simSlotIndex: typeof s.simSlotIndex === 'number' ? s.simSlotIndex : 0,
                serviceState: String(s.serviceState || '').trim(),
              }))
          : [];
        return {
          id,
          brand,
          model,
          enabled: d.enabled !== false,
          label,
          sims,
        };
      })
      .filter((d) => Boolean(d.id));
    return { devices, error: null };
  } catch (err) {
    return {
      devices: [],
      error: err instanceof Error ? err.message : 'Impossibile contattare api.textbee.dev',
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function dispatchTextBeeSms(params: {
  recipientE164: string;
  message: string;
  deviceIdOverride?: string;
  simSubscriptionIdOverride?: number | null;
}): Promise<{ ok: true; batchId: string | null; deviceId: string | null } | { ok: false; error: string }> {
  const cfg = getTextBeeSettings();
  if (!cfg.configured) {
    return { ok: false, error: 'Chiave API TextBee non configurata sul server' };
  }

  let resolvedDeviceId = (params.deviceIdOverride || cfg.deviceId || '').trim();
  if (!resolvedDeviceId) {
    const { devices } = await fetchTextBeeDevices();
    const activeDevice = devices.find((d) => d.enabled) || devices[0];
    if (activeDevice) {
      resolvedDeviceId = activeDevice.id;
    }
  }

  const resolvedSim =
    params.simSubscriptionIdOverride !== undefined
      ? params.simSubscriptionIdOverride
      : cfg.simSubscriptionId;

  const endpoint = resolvedDeviceId
    ? `${cfg.baseUrl}/gateway/devices/${encodeURIComponent(resolvedDeviceId)}/send-sms`
    : `${cfg.baseUrl}/gateway/send-sms`;

  const requestBody: Record<string, unknown> = {
    recipients: [params.recipientE164],
    message: params.message,
  };
  if (typeof resolvedSim === 'number' && Number.isInteger(resolvedSim)) {
    requestBody.simSubscriptionId = resolvedSim;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cfg.apiKey,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => ({}))) as {
      data?: { smsBatchId?: string; id?: string; _id?: string };
      message?: string | string[];
      error?: string;
    };

    if (!response.ok) {
      const rawMsg = Array.isArray(payload.message)
        ? payload.message.join(', ')
        : payload.message || payload.error || '';
      if (!resolvedDeviceId && (response.status === 404 || response.status === 400)) {
        return {
          ok: false,
          error:
            'Nessun dispositivo Android attivo su TextBee. Apri l’app TextBee sullo smartphone, associa il telefono al tuo account e riprova.',
        };
      }
      return {
        ok: false,
        error: rawMsg || `Invio SMS rifiutato da TextBee (HTTP ${response.status})`,
      };
    }

    const batchId = payload.data?.smsBatchId || payload.data?.id || payload.data?._id || null;
    return { ok: true, batchId, deviceId: resolvedDeviceId || null };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Errore connessione TextBee: ${err.message}`
          : 'Errore connessione TextBee',
    };
  } finally {
    clearTimeout(timeout);
  }
}

function generateShortCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(10);
  let out = '';
  for (let i = 0; i < 10; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

function formatItalianDateTime(iso: string): string {
  return new Intl.DateTimeFormat('it-IT', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Rome',
  }).format(new Date(iso));
}

async function sendAppointmentMoveSms(
  appointmentId: number,
  actor: string
): Promise<{ ok: true; phone: string } | { ok: false; error: string }> {
  const row = db
    .prepare(
      `SELECT a.id, a.starts_at, p.name patient, p.phone, pr.name procedure,
              pro.name professional, c.name chair
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       JOIN procedures pr ON pr.id = a.procedure_id
       JOIN professionals pro ON pro.id = a.professional_id
       JOIN chairs c ON c.id = a.chair_id
       WHERE a.id=? AND a.status='booked'`
    )
    .get(appointmentId) as
    | {
        id: number;
        starts_at: string;
        patient: string;
        phone: string;
        procedure: string;
        professional: string;
        chair: string;
      }
    | undefined;

  if (!row) {
    return { ok: false, error: 'Appuntamento non trovato o non più attivo' };
  }

  const whatsapp = getWhatsAppConfig();
  const normalized = normalizeWhatsAppPhone(row.phone, whatsapp.default_prefix);
  if (!normalized) {
    return { ok: false, error: 'Numero di telefono del paziente non valido per SMS' };
  }

  const firstName = row.patient.split(' ')[0] || row.patient;
  const when = formatItalianDateTime(row.starts_at);
  const message = `Ciao ${firstName}, confermiamo lo spostamento del tuo appuntamento di ${row.procedure}: nuovo orario ${when} con ${row.professional} (${row.chair}). — ${whatsapp.sender_name}`;

  const result = await dispatchTextBeeSms({
    recipientE164: normalized.formatted,
    message,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  log(actor, 'appointment_move_sms_sent', {
    appointment_id: row.id,
    name: row.patient,
    phone: normalized.formatted,
    starts_at: row.starts_at,
  });
  return { ok: true, phone: normalized.formatted };
}

function prepareReminderBatch(baseUrl?: string, windowMode: '24h' | '48h' = '24h') {
  const now = Date.now();
  const from = new Date(
    now + (windowMode === '48h' ? 1 * 3600_000 : 23 * 3600_000)
  ).toISOString();
  const to = new Date(
    now + (windowMode === '48h' ? 48 * 3600_000 : 25 * 3600_000)
  ).toISOString();
  const origin = (baseUrl || resolvePublicAppUrl()).replace(/\/$/, '');
  const waConfig = getWhatsAppConfig();

  db.prepare(
    "UPDATE appointment_confirmations SET state='expired' WHERE state='pending' AND expires_at<=?"
  ).run(new Date().toISOString());

  db.prepare(
    "UPDATE message_outbox SET status='expired' WHERE status IN ('prepared','sent') AND confirmation_id IN (SELECT id FROM appointment_confirmations WHERE state='expired')"
  ).run();

  const due = db
    .prepare(
      `SELECT a.id appointment_id, a.starts_at, p.name patient, p.phone,
              pr.name procedure, pr.duration, pro.name professional
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       JOIN procedures pr ON pr.id = a.procedure_id
       JOIN professionals pro ON pro.id = a.professional_id
       WHERE a.status='booked' AND a.starts_at>? AND a.starts_at<=?
         AND NOT EXISTS (
           SELECT 1 FROM message_outbox m
           WHERE m.appointment_id = a.id
             AND (m.type='24h_confirmation' OR m.type LIKE '24h_confirmation:%')
             AND m.status IN ('prepared','sent','responded')
         )`
    )
    .all(from, to) as Array<{
    appointment_id: number;
    starts_at: string;
    patient: string;
    phone: string;
    procedure: string;
    duration: number;
    professional: string;
  }>;

  const createConfirmation = db.prepare(
    'INSERT INTO appointment_confirmations(appointment_id,code_hash,expires_at) VALUES(?,?,?)'
  );
  const createMessage = db.prepare(
    'INSERT INTO message_outbox(appointment_id,confirmation_id,type,recipient,body) VALUES(?,?,?,?,?)'
  );

  const created: Array<{ outbox_id: number; appointment_id: number }> = [];
  for (const item of due) {
    const code = crypto.randomBytes(5).toString('hex').toUpperCase();
    const expires = new Date(new Date(item.starts_at).getTime() + 3 * 3600_000).toISOString();
    const confirmationId = Number(
      createConfirmation.run(item.appointment_id, hashValue(code), expires).lastInsertRowid
    );
    const link = `${origin}/conferma?confirm=${encodeURIComponent(code)}`;
    const when = new Intl.DateTimeFormat('it-IT', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'Europe/Rome',
    }).format(new Date(item.starts_at));

    const senderSignature = waConfig.sender_name ? ` — ${waConfig.sender_name}` : '';
    const body = `Buongiorno ${item.patient}, ti ricordiamo l'appuntamento di ${item.procedure} con ${item.professional} il ${when}. Conferma o disdici qui: ${link} Codice: ${code}.${senderSignature}`;
    const outboxId = Number(
      createMessage.run(
        item.appointment_id,
        confirmationId,
        `24h_confirmation:${item.starts_at}:${confirmationId}`,
        item.phone,
        body
      ).lastInsertRowid
    );
    created.push({ outbox_id: outboxId, appointment_id: item.appointment_id });
    log('sistema', 'reminder_prepared', {
      outbox_id: outboxId,
      appointment_id: item.appointment_id,
    });
  }
  return created;
}

interface AppointmentRow {
  id: number;
  patient_id: number;
  professional_id: number;
  chair_id: number;
  procedure_id: number;
  starts_at: string;
  status: string;
}

function cancellationProposals(ap: AppointmentRow, actor: string, offer = true) {
  if (!offer) return [];
  const proc = db.prepare('SELECT * FROM procedures WHERE id=?').get(ap.procedure_id) as {
    id: number;
    duration: number;
    name: string;
  };
  const prof = db.prepare('SELECT * FROM professionals WHERE id=?').get(ap.professional_id) as {
    id: number;
    name: string;
    procedure_ids: string;
  };
  const chair = db.prepare('SELECT * FROM chairs WHERE id=?').get(ap.chair_id) as
    | { id: number; name: string; resources: string; active: number }
    | undefined;
  if (!chair?.active) return [];

  const start = new Date(ap.starts_at);
  const end = new Date(start.getTime() + proc.duration * 60_000);

  const candidates = db
    .prepare(
      `SELECT a.*, p.name patient, p.phone, pr.name procedure, pr.duration,
              pr.resources procedure_resources, pro.procedure_ids, c.resources
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       JOIN procedures pr ON pr.id = a.procedure_id
       JOIN professionals pro ON pro.id = a.professional_id
       JOIN chairs c ON c.id = a.chair_id
       WHERE a.status='booked' AND a.starts_at>?
       ORDER BY a.starts_at`
    )
    .all(new Date().toISOString()) as unknown as Array<
    AppointmentRow & {
      patient: string;
      phone: string;
      procedure: string;
      duration: number;
      procedure_resources: string;
    }
  >;

  const profProcedures = JSON.parse(prof.procedure_ids) as number[];
  const chairResources = JSON.parse(chair.resources) as string[];

  const eligible = candidates.filter((c) => {
    const reqResources = JSON.parse(c.procedure_resources) as string[];
    const hasProConflict = db
      .prepare(
        `SELECT 1 FROM appointments a JOIN procedures p ON p.id=a.procedure_id
         WHERE a.status='booked' AND a.professional_id=?
           AND julianday(a.starts_at)<julianday(?)
           AND julianday(a.starts_at)+(p.duration/1440.0)>julianday(?)`
      )
      .get(prof.id, end.toISOString(), start.toISOString());

    const hasChairConflict = db
      .prepare(
        `SELECT 1 FROM appointments a JOIN procedures p ON p.id=a.procedure_id
         WHERE a.status='booked' AND a.chair_id=?
           AND julianday(a.starts_at)<julianday(?)
           AND julianday(a.starts_at)+(p.duration/1440.0)>julianday(?)`
      )
      .get(chair.id, end.toISOString(), start.toISOString());

    return (
      profProcedures.includes(c.procedure_id) &&
      reqResources.every((r) => chairResources.includes(r)) &&
      c.duration <= proc.duration &&
      !hasProConflict &&
      !hasChairConflict
    );
  });

  const created = [];
  for (const c of eligible) {
    const result = db
      .prepare('INSERT INTO proposals(appointment_id,freed_appointment_id) VALUES(?,?)')
      .run(c.id, ap.id);
    const proposalId = Number(result.lastInsertRowid);
    created.push({
      id: proposalId,
      patient: c.patient,
      procedure: c.procedure,
      original: c.starts_at,
      slot: ap.starts_at,
      professional: prof.name,
      chair: chair.name,
    });
    log(actor, 'proposal_created', {
      proposal_id: proposalId,
      appointment_id: c.id,
      freed_appointment_id: ap.id,
    });
  }
  return created;
}

function findConfirmation(code: string) {
  if (typeof code !== 'string' || !/^\w{10}$/.test(code)) return null;
  return db
    .prepare(
      `SELECT c.*, a.starts_at, a.status appointment_status,
              p.name patient, pr.name procedure, pro.name professional
       FROM appointment_confirmations c
       JOIN appointments a ON a.id = c.appointment_id
       JOIN patients p ON p.id = a.patient_id
       JOIN procedures pr ON pr.id = a.procedure_id
       JOIN professionals pro ON pro.id = a.professional_id
       WHERE c.code_hash=?`
    )
    .get(hashValue(code.toUpperCase())) as
    | {
        id: number;
        appointment_id: number;
        expires_at: string;
        state: string;
        starts_at: string;
        appointment_status: string;
        patient: string;
        procedure: string;
        professional: string;
      }
    | undefined
    | null;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ ok: true, version: '5.0.0' });
  });

  // Auth routes
  app.post('/api/login', (req, res) => {
    const { username, password } = req.body || {};
    const u = db.prepare('SELECT * FROM users WHERE username=?').get(username || '') as
      | { username: string; password_hash: string; role: string }
      | undefined;

    const [salt, expected] = (u?.password_hash || ':').split(':');
    const actual = crypto.scryptSync(String(password || ''), salt || 'missing', 64).toString('hex');
    const valid =
      Boolean(u) &&
      crypto.timingSafeEqual(
        Buffer.from(actual, 'hex'),
        Buffer.from(expected || '0'.repeat(128), 'hex')
      );

    if (!valid || !u) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 12 * 3600_000).toISOString();
    db.prepare('INSERT INTO sessions(token_hash,username,expires_at) VALUES(?,?,?)').run(
      hashValue(token),
      u.username,
      expires
    );
    log(u.username, 'login', { role: u.role });

    const isSecure = req.headers['x-forwarded-proto'] === 'https' || req.secure;
    const cookieParts = [
      `agenda_session=${token}`,
      'HttpOnly',
      'Path=/',
      'Max-Age=43200',
      isSecure ? 'SameSite=None; Secure' : 'SameSite=Lax',
    ];
    res.setHeader('Set-Cookie', cookieParts.join('; '));
    return res.json({ username: u.username, role: u.role, token });
  });

  app.post('/api/logout', (req, res) => {
    const session = getSession(req);
    if (session) {
      db.prepare('DELETE FROM sessions WHERE username=?').run(session.username);
    }
    const isSecure = req.headers['x-forwarded-proto'] === 'https' || req.secure;
    const cookieParts = [
      'agenda_session=',
      'HttpOnly',
      'Path=/',
      'Max-Age=0',
      isSecure ? 'SameSite=None; Secure' : 'SameSite=Lax',
    ];
    res.setHeader('Set-Cookie', cookieParts.join('; '));
    return res.json({ ok: true });
  });

  app.get('/api/me', (req, res) => {
    return res.json({ user: getSession(req) });
  });

  // Agenda
  app.get('/api/agenda', (req, res) => {
    if (!requireAuth(req, res)) return;
    const from =
      (typeof req.query.from === 'string' && req.query.from) ||
      new Date().toISOString().slice(0, 10);
    const to = (typeof req.query.to === 'string' && req.query.to) || from;

    const rows = db
      .prepare(
        `SELECT a.*, p.name patient, p.phone, pr.name procedure, pr.duration, pr.specialty,
                pro.name professional, pro.color, c.name chair,
                (SELECT state FROM appointment_confirmations x WHERE x.appointment_id=a.id ORDER BY x.id DESC LIMIT 1) confirmation_state,
                (SELECT status FROM message_outbox m WHERE m.appointment_id=a.id ORDER BY m.id DESC LIMIT 1) reminder_status
         FROM appointments a
         JOIN patients p ON p.id = a.patient_id
         JOIN procedures pr ON pr.id = a.procedure_id
         JOIN professionals pro ON pro.id = a.professional_id
         JOIN chairs c ON c.id = a.chair_id
         WHERE a.status='booked' AND a.starts_at>=? AND a.starts_at<?
         ORDER BY a.starts_at`
      )
      .all(`${from}T00:00:00`, `${to}T23:59:59.999`);

    return res.json({
      appointments: rows,
      professionals: db.prepare('SELECT * FROM professionals').all(),
      chairs: db.prepare('SELECT * FROM chairs WHERE active=1').all(),
    });
  });

  // Catalog
  app.get('/api/catalog', (req, res) => {
    if (!requireAuth(req, res)) return;
    return res.json({
      professionals: db
        .prepare(
          `SELECT pro.*,
                  (SELECT COUNT(*) FROM appointments a WHERE a.professional_id = pro.id) AS appointments_count
           FROM professionals pro
           ORDER BY pro.id ASC`
        )
        .all(),
      chairs: db.prepare('SELECT * FROM chairs WHERE active=1 ORDER BY id ASC').all(),
      procedures: db
        .prepare(
          `SELECT pr.*,
                  (SELECT COUNT(*) FROM appointments a WHERE a.procedure_id = pr.id) AS appointments_count
           FROM procedures pr
           ORDER BY pr.id ASC`
        )
        .all(),
      patients: db
        .prepare(
          `SELECT p.*,
                  (SELECT COUNT(*) FROM appointments a WHERE a.patient_id = p.id) AS appointments_count,
                  (SELECT COUNT(*) FROM appointments a WHERE a.patient_id = p.id AND a.status = 'booked') AS booked_count
           FROM patients p
           ORDER BY p.id ASC`
        )
        .all(),
    });
  });

  // Patients
  app.get('/api/patients/:id', (req, res) => {
    if (!requireAuth(req, res)) return;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID cliente non valido' });
    }
    const patient = db
      .prepare(
        `SELECT p.*,
                (SELECT COUNT(*) FROM appointments a WHERE a.patient_id = p.id) AS appointments_count,
                (SELECT COUNT(*) FROM appointments a WHERE a.patient_id = p.id AND a.status = 'booked') AS booked_count
         FROM patients p
         WHERE p.id=?`
      )
      .get(id);
    if (!patient) {
      return res.status(404).json({ error: 'Cliente non trovato' });
    }

    const appointments = db
      .prepare(
        `SELECT a.id, a.starts_at, a.status, pr.name procedure, pr.duration,
                pro.name professional, pro.color, c.name chair,
                (SELECT state FROM appointment_confirmations x WHERE x.appointment_id=a.id ORDER BY x.id DESC LIMIT 1) confirmation_state
         FROM appointments a
         JOIN procedures pr ON pr.id = a.procedure_id
         JOIN professionals pro ON pro.id = a.professional_id
         JOIN chairs c ON c.id = a.chair_id
         WHERE a.patient_id=?
         ORDER BY a.starts_at DESC`
      )
      .all(id);

    const reminders = db
      .prepare(
        `SELECT m.id, m.appointment_id, m.recipient, m.status, m.sent_at, m.sent_via, m.sent_from,
                m.created_at, a.starts_at, pr.name procedure
         FROM message_outbox m
         JOIN appointments a ON a.id = m.appointment_id
         JOIN procedures pr ON pr.id = a.procedure_id
         WHERE a.patient_id=?
         ORDER BY m.id DESC
         LIMIT 30`
      )
      .all(id);

    return res.json({ patient, appointments, reminders });
  });

  app.post('/api/patients', (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const { name, phone, notes = '' } = req.body || {};
    if (
      typeof name !== 'string' ||
      name.trim().length < 2 ||
      typeof phone !== 'string' ||
      phone.trim().length < 5
    ) {
      return res.status(400).json({ error: 'Inserisci nome e telefono validi' });
    }
    const r = db
      .prepare('INSERT INTO patients(name,phone,notes) VALUES(?,?,?)')
      .run(name.trim(), phone.trim(), String(notes).trim());
    const id = Number(r.lastInsertRowid);
    log(auth.username, 'patient_created', { patient_id: id, name: name.trim() });
    return res.status(201).json({ id });
  });

  app.put('/api/patients/:id', (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID cliente non valido' });
    }
    const existing = db.prepare('SELECT id FROM patients WHERE id=?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Cliente non trovato' });
    }
    const { name, phone, notes = '' } = req.body || {};
    if (
      typeof name !== 'string' ||
      name.trim().length < 2 ||
      typeof phone !== 'string' ||
      phone.trim().length < 5
    ) {
      return res.status(400).json({ error: 'Inserisci nome e telefono validi' });
    }
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanNotes = String(notes).trim().slice(0, 500);
    db.prepare('UPDATE patients SET name=?, phone=?, notes=? WHERE id=?').run(
      cleanName,
      cleanPhone,
      cleanNotes,
      id
    );
    log(auth.username, 'patient_updated', { patient_id: id, name: cleanName, phone: cleanPhone });
    return res.json({
      patient: { id, name: cleanName, phone: cleanPhone, notes: cleanNotes },
    });
  });

  app.delete('/api/patients/:id', (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID cliente non valido' });
    }

    const patient = db.prepare('SELECT * FROM patients WHERE id=?').get(id) as
      | { id: number; name: string; phone: string }
      | undefined;
    if (!patient) {
      return res.status(404).json({ error: 'Cliente non trovato' });
    }

    const apptRows = db
      .prepare('SELECT id FROM appointments WHERE patient_id=?')
      .all(id) as Array<{ id: number }>;
    const apptIds = apptRows.map((row) => row.id);

    db.exec('BEGIN');
    try {
      for (const apptId of apptIds) {
        db.prepare('DELETE FROM message_outbox WHERE appointment_id=?').run(apptId);
        db.prepare('DELETE FROM appointment_confirmations WHERE appointment_id=?').run(apptId);
        db.prepare('DELETE FROM proposals WHERE appointment_id=? OR freed_appointment_id=?').run(
          apptId,
          apptId
        );
      }
      db.prepare('DELETE FROM appointments WHERE patient_id=?').run(id);
      db.prepare('DELETE FROM patients WHERE id=?').run(id);
      log(auth.username, 'patient_deleted', {
        patient_id: id,
        name: patient.name,
        phone: patient.phone,
        removed_appointments: apptIds.length,
      });
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Impossibile eliminare il cliente',
      });
    }

    return res.json({ ok: true, removed_appointments: apptIds.length });
  });

  // Professionals
  app.post('/api/professionals', (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const { name, specialty, procedure_ids = [], color = '#365d48' } = req.body || {};
    const ids = [...new Set((Array.isArray(procedure_ids) ? procedure_ids : []).map(Number))];
    const existingProcs = (db.prepare('SELECT id FROM procedures').all() as Array<{ id: number }>).map(
      (x) => x.id
    );
    if (
      typeof name !== 'string' ||
      name.trim().length < 3 ||
      typeof specialty !== 'string' ||
      !specialty.trim() ||
      !ids.length ||
      ids.some((id) => !existingProcs.includes(id))
    ) {
      return res.status(400).json({ error: 'Controlla nome, specialità e trattamenti abilitati' });
    }
    const r = db
      .prepare('INSERT INTO professionals(name,specialty,color,procedure_ids) VALUES(?,?,?,?)')
      .run(name.trim(), specialty.trim(), String(color || '#365d48'), JSON.stringify(ids));
    const id = Number(r.lastInsertRowid);
    log(auth.username, 'professional_created', { professional_id: id, name: name.trim() });
    return res.status(201).json({ id });
  });

  app.put('/api/professionals/:id', (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID professionista non valido' });
    }
    const existing = db.prepare('SELECT id FROM professionals WHERE id=?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Professionista non trovato' });
    }
    const { name, specialty, procedure_ids = [], color = '#365d48' } = req.body || {};
    const ids = [...new Set((Array.isArray(procedure_ids) ? procedure_ids : []).map(Number))];
    const existingProcs = (db.prepare('SELECT id FROM procedures').all() as Array<{ id: number }>).map(
      (x) => x.id
    );
    if (
      typeof name !== 'string' ||
      name.trim().length < 3 ||
      typeof specialty !== 'string' ||
      !specialty.trim() ||
      !ids.length ||
      ids.some((pid) => !existingProcs.includes(pid))
    ) {
      return res.status(400).json({ error: 'Controlla nome, specialità e trattamenti abilitati' });
    }
    db.prepare('UPDATE professionals SET name=?, specialty=?, color=?, procedure_ids=? WHERE id=?').run(
      name.trim(),
      specialty.trim(),
      String(color || '#365d48'),
      JSON.stringify(ids),
      id
    );
    log(auth.username, 'professional_updated', { professional_id: id, name: name.trim() });
    return res.json({ ok: true });
  });

  app.delete('/api/professionals/:id', (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const id = Number(req.params.id);
    const prof = db.prepare('SELECT * FROM professionals WHERE id=?').get(id) as
      | { id: number; name: string }
      | undefined;
    if (!prof) return res.status(404).json({ error: 'Professionista non trovato' });
    const total = Number(
      (db.prepare('SELECT COUNT(*) n FROM professionals').get() as { n: number }).n
    );
    if (total <= 1) {
      return res.status(409).json({ error: 'Deve restare almeno un professionista in studio' });
    }
    const apptCount = Number(
      (
        db.prepare('SELECT COUNT(*) n FROM appointments WHERE professional_id=?').get(id) as {
          n: number;
        }
      ).n
    );
    if (apptCount > 0) {
      return res.status(409).json({
        error: `Impossibile eliminare: ${prof.name} ha ${apptCount} appuntamenti collegati in agenda/archivio`,
      });
    }
    db.prepare('DELETE FROM professionals WHERE id=?').run(id);
    log(auth.username, 'professional_deleted', { professional_id: id, name: prof.name });
    return res.json({ ok: true });
  });

  // Procedures
  app.post('/api/procedures', (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const { name, duration, specialty, resources = [] } = req.body || {};
    const mins = Number(duration);
    const resourcesList = [
      ...new Set(
        (Array.isArray(resources) ? resources : []).map((x) => String(x).trim()).filter(Boolean)
      ),
    ];
    if (
      typeof name !== 'string' ||
      name.trim().length < 2 ||
      typeof specialty !== 'string' ||
      !specialty.trim() ||
      !Number.isInteger(mins) ||
      mins < 10 ||
      mins > 480 ||
      resourcesList.some((x) => x.length > 60)
    ) {
      return res.status(400).json({ error: 'Controlla nome, specialità, durata e attrezzature' });
    }
    const r = db
      .prepare('INSERT INTO procedures(name,duration,specialty,resources) VALUES(?,?,?,?)')
      .run(name.trim(), mins, specialty.trim(), JSON.stringify(resourcesList));
    const id = Number(r.lastInsertRowid);
    log(auth.username, 'procedure_created', { procedure_id: id, name: name.trim() });
    return res.status(201).json({ id });
  });

  app.put('/api/procedures/:id', (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT id FROM procedures WHERE id=?').get(id);
    if (!existing) return res.status(404).json({ error: 'Trattamento non trovato' });

    const { name, duration, specialty, resources = [] } = req.body || {};
    const mins = Number(duration);
    const resourcesList = [
      ...new Set(
        (Array.isArray(resources) ? resources : []).map((x) => String(x).trim()).filter(Boolean)
      ),
    ];
    if (
      typeof name !== 'string' ||
      name.trim().length < 2 ||
      typeof specialty !== 'string' ||
      !specialty.trim() ||
      !Number.isInteger(mins) ||
      mins < 10 ||
      mins > 480 ||
      resourcesList.some((x) => x.length > 60)
    ) {
      return res.status(400).json({ error: 'Controlla nome, specialità, durata e attrezzature' });
    }
    db.prepare('UPDATE procedures SET name=?, duration=?, specialty=?, resources=? WHERE id=?').run(
      name.trim(),
      mins,
      specialty.trim(),
      JSON.stringify(resourcesList),
      id
    );
    log(auth.username, 'procedure_updated', { procedure_id: id, name: name.trim() });
    return res.json({ ok: true });
  });

  app.delete('/api/procedures/:id', (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const id = Number(req.params.id);
    const proc = db.prepare('SELECT * FROM procedures WHERE id=?').get(id) as
      | { id: number; name: string }
      | undefined;
    if (!proc) return res.status(404).json({ error: 'Trattamento non trovato' });

    const total = Number(
      (db.prepare('SELECT COUNT(*) n FROM procedures').get() as { n: number }).n
    );
    if (total <= 1) {
      return res.status(409).json({ error: 'Deve restare almeno un trattamento nel catalogo' });
    }
    const apptCount = Number(
      (
        db.prepare('SELECT COUNT(*) n FROM appointments WHERE procedure_id=?').get(id) as {
          n: number;
        }
      ).n
    );
    if (apptCount > 0) {
      return res.status(409).json({
        error: `Impossibile eliminare: "${proc.name}" è presente in ${apptCount} appuntamenti in agenda/archivio`,
      });
    }

    db.exec('BEGIN');
    try {
      const profs = db.prepare('SELECT id, procedure_ids FROM professionals').all() as Array<{
        id: number;
        procedure_ids: string;
      }>;
      for (const prof of profs) {
        const currentIds = JSON.parse(prof.procedure_ids) as number[];
        if (currentIds.includes(id)) {
          const nextIds = currentIds.filter((pid) => pid !== id);
          db.prepare('UPDATE professionals SET procedure_ids=? WHERE id=?').run(
            JSON.stringify(nextIds),
            prof.id
          );
        }
      }
      db.prepare('DELETE FROM procedures WHERE id=?').run(id);
      log(auth.username, 'procedure_deleted', { procedure_id: id, name: proc.name });
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Impossibile eliminare il trattamento',
      });
    }
    return res.json({ ok: true });
  });

  // Chairs / Rooms
  app.post('/api/chairs', (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const { name, resources = [] } = req.body || {};
    const resourcesList = [
      ...new Set(
        (Array.isArray(resources) ? resources : []).map((x) => String(x).trim()).filter(Boolean)
      ),
    ];
    if (
      typeof name !== 'string' ||
      name.trim().length < 2 ||
      resourcesList.some((x) => x.length > 60)
    ) {
      return res.status(400).json({ error: 'Nome poltrona e risorse non validi' });
    }
    const r = db
      .prepare('INSERT INTO chairs(name,resources) VALUES(?,?)')
      .run(name.trim(), JSON.stringify(resourcesList));
    const id = Number(r.lastInsertRowid);
    log(auth.username, 'chair_created', { chair_id: id, name: name.trim() });
    return res.status(201).json({ id });
  });

  app.delete('/api/chairs/:id', (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const id = Number(req.params.id);
    const room = db.prepare('SELECT * FROM chairs WHERE id=? AND active=1').get(id);
    if (!room) return res.status(404).json({ error: 'Stanza non trovata' });
    const activeCount = (
      db.prepare('SELECT COUNT(*) n FROM chairs WHERE active=1').get() as { n: number }
    ).n;
    if (activeCount <= 1) return res.status(409).json({ error: 'Deve restare almeno una stanza' });
    if (db.prepare("SELECT 1 FROM appointments WHERE chair_id=? AND status='booked' LIMIT 1").get(id)) {
      return res
        .status(409)
        .json({ error: 'Annulla o sposta prima gli appuntamenti di questa stanza' });
    }
    const history = db.prepare('SELECT 1 FROM appointments WHERE chair_id=? LIMIT 1').get(id);
    if (history) {
      db.prepare('UPDATE chairs SET active=0 WHERE id=?').run(id);
    } else {
      db.prepare('DELETE FROM chairs WHERE id=?').run(id);
    }
    log(auth.username, 'chair_deactivated', { chair_id: id });
    return res.json({ ok: true });
  });

  // WhatsApp studio connection settings
  app.get('/api/whatsapp/config', (req, res) => {
    if (!requireAuth(req, res)) return;
    return res.json({ whatsapp: getWhatsAppConfig() });
  });

  app.put('/api/whatsapp/config', (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const { phone, sender_name = 'Studio Odontoiatrico', default_prefix = '+39' } = req.body || {};
    const prefixClean = String(default_prefix || '+39').trim();
    if (!/^\+\d{1,4}$/.test(prefixClean)) {
      return res.status(400).json({ error: 'Prefisso internazionale non valido (es. +39)' });
    }
    const normalized = normalizeWhatsAppPhone(String(phone || ''), prefixClean);
    if (!normalized) {
      return res
        .status(400)
        .json({ error: 'Inserisci un numero WhatsApp valido con prefisso (es. +39 333 123 4567)' });
    }
    const cleanSender = String(sender_name || '').trim().slice(0, 80) || 'Studio Odontoiatrico';

    setSetting('whatsapp_phone', normalized.formatted);
    setSetting('whatsapp_sender_name', cleanSender);
    setSetting('whatsapp_default_prefix', prefixClean);
    log(auth.username, 'whatsapp_connected', {
      phone: normalized.formatted,
      sender_name: cleanSender,
    });
    return res.json({ whatsapp: getWhatsAppConfig() });
  });

  app.delete('/api/whatsapp/config', (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    db.prepare("DELETE FROM studio_settings WHERE key='whatsapp_phone'").run();
    log(auth.username, 'whatsapp_disconnected', {});
    return res.json({ whatsapp: getWhatsAppConfig() });
  });

  // Reminders
  app.get('/api/reminders', (req, res) => {
    if (!requireAuth(req, res)) return;
    const whatsapp = getWhatsAppConfig();
    const rawMessages = db
      .prepare(
        `SELECT m.*, p.name patient, a.starts_at, pr.name procedure
         FROM message_outbox m
         JOIN appointments a ON a.id = m.appointment_id
         JOIN patients p ON p.id = a.patient_id
         JOIN procedures pr ON pr.id = a.procedure_id
         ORDER BY m.id DESC LIMIT 200`
      )
      .all() as unknown as Array<{
      id: number;
      recipient: string;
      body: string;
      [key: string]: unknown;
    }>;

    const messages = rawMessages.map((m) => ({
      ...m,
      wa_url: buildWhatsAppUrl(m.recipient, m.body, whatsapp.default_prefix),
    }));

    const smsCfg = getTextBeeSettings();
    return res.json({
      messages,
      prepared_window_hours: 24,
      whatsapp,
      sms: {
        configured: smsCfg.configured,
        base_url: smsCfg.baseUrl,
        device_id: smsCfg.deviceId,
        sim_subscription_id: smsCfg.simSubscriptionId,
      },
    });
  });

  // TextBee SMS Gateway config & test dispatch
  app.get('/api/sms/config', async (req, res) => {
    if (!requireAuth(req, res)) return;
    const cfg = getTextBeeSettings();
    const { devices, error } = await fetchTextBeeDevices();
    return res.json({
      sms: {
        configured: cfg.configured,
        base_url: cfg.baseUrl,
        device_id: cfg.deviceId,
        sim_subscription_id: cfg.simSubscriptionId,
        devices,
        error,
      },
    });
  });

  app.put('/api/sms/config', async (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const deviceId = String(req.body?.device_id || '').trim().slice(0, 120);
    if (deviceId) {
      setSetting('textbee_device_id', deviceId);
    } else {
      db.prepare("DELETE FROM studio_settings WHERE key='textbee_device_id'").run();
    }
    const rawSim = req.body?.sim_subscription_id;
    if (rawSim === null || rawSim === '' || rawSim === undefined) {
      db.prepare("DELETE FROM studio_settings WHERE key='textbee_sim_subscription_id'").run();
    } else if (Number.isInteger(Number(rawSim))) {
      setSetting('textbee_sim_subscription_id', String(Number(rawSim)));
    }
    log(auth.username, 'sms_device_updated', {
      device_id: deviceId || 'automatico',
      sim_subscription_id: rawSim === null || rawSim === '' || rawSim === undefined ? 'predefinita' : Number(rawSim),
    });
    const cfg = getTextBeeSettings();
    const { devices, error } = await fetchTextBeeDevices();
    return res.json({
      sms: {
        configured: cfg.configured,
        base_url: cfg.baseUrl,
        device_id: cfg.deviceId,
        sim_subscription_id: cfg.simSubscriptionId,
        devices,
        error,
      },
    });
  });

  app.post('/api/sms/test', async (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const whatsapp = getWhatsAppConfig();
    const recipient = String(req.body?.recipient || '').trim();
    const message = String(req.body?.message || '').trim();
    const deviceId = typeof req.body?.device_id === 'string' ? req.body.device_id.trim() : undefined;
    const rawSim = req.body?.sim_subscription_id;
    const simSubscriptionIdOverride =
      rawSim === null || rawSim === '' || rawSim === undefined
        ? undefined
        : Number.isInteger(Number(rawSim))
          ? Number(rawSim)
          : undefined;

    const normalized = normalizeWhatsAppPhone(recipient, whatsapp.default_prefix);
    if (!normalized) {
      return res.status(400).json({ error: 'Inserisci un numero destinatario valido (es. +39 333 123 4567)' });
    }
    if (message.length < 2 || message.length > 600) {
      return res.status(400).json({ error: 'Inserisci un testo tra 2 e 600 caratteri' });
    }

    const result = await dispatchTextBeeSms({
      recipientE164: normalized.formatted,
      message,
      deviceIdOverride: deviceId,
      simSubscriptionIdOverride,
    });
    if (!result.ok) {
      return res.status(502).json({ error: result.error });
    }
    log(auth.username, 'sms_test_sent', {
      phone: normalized.formatted,
      device_id: result.deviceId || 'default',
    });
    return res.json({ ok: true, batch_id: result.batchId, device_id: result.deviceId });
  });

  app.post('/api/reminders/run', (req, res) => {
    if (!requireAuth(req, res)) return;
    const windowMode = req.body?.window === '48h' ? '48h' : '24h';
    const messages = prepareReminderBatch(resolvePublicAppUrl(req), windowMode);
    return res.json({ prepared: messages.length, messages, window: windowMode });
  });

  app.post('/api/reminders/:id/send-sms', async (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const id = Number(req.params.id);
    const whatsapp = getWhatsAppConfig();

    const msg = db
      .prepare('SELECT * FROM message_outbox WHERE id=?')
      .get(id) as unknown as
      | {
          id: number;
          appointment_id: number;
          recipient: string;
          body: string;
          status: string;
        }
      | undefined;

    if (!msg) return res.status(404).json({ error: 'Promemoria non trovato' });
    if (msg.status === 'cancelled' || msg.status === 'expired') {
      return res.status(409).json({ error: 'Questo promemoria non è più valido per l’invio' });
    }

    const normalizedRecipient = normalizeWhatsAppPhone(msg.recipient, whatsapp.default_prefix);
    if (!normalizedRecipient) {
      return res.status(400).json({ error: 'Numero destinatario non valido per SMS' });
    }

    const deviceIdOverride =
      typeof req.body?.device_id === 'string' ? req.body.device_id.trim() : undefined;

    const result = await dispatchTextBeeSms({
      recipientE164: normalizedRecipient.formatted,
      message: msg.body,
      deviceIdOverride,
    });

    if (!result.ok) {
      return res.status(502).json({ error: result.error });
    }

    db.prepare(
      "UPDATE message_outbox SET status='sent', sent_at=CURRENT_TIMESTAMP, sent_via='textbee_sms', sent_from=?, provider_message_id=? WHERE id=?"
    ).run(result.deviceId ? `TextBee (${result.deviceId.slice(0, 8)})` : 'TextBee SMS', result.batchId, msg.id);

    log(auth.username, 'reminder_sent_sms', {
      outbox_id: msg.id,
      appointment_id: msg.appointment_id,
      phone: normalizedRecipient.formatted,
      device_id: result.deviceId || 'default',
    });

    return res.json({
      ok: true,
      provider: 'textbee',
      batch_id: result.batchId,
      device_id: result.deviceId,
    });
  });

  app.post('/api/reminders/:id/send', async (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const id = Number(req.params.id);
    const whatsapp = getWhatsAppConfig();
    if (!whatsapp.connected) {
      return res
        .status(409)
        .json({ error: 'Collega prima un numero WhatsApp dello studio per inviare i promemoria' });
    }

    const msg = db
      .prepare('SELECT * FROM message_outbox WHERE id=?')
      .get(id) as unknown as
      | {
          id: number;
          appointment_id: number;
          recipient: string;
          body: string;
          status: string;
        }
      | undefined;

    if (!msg) return res.status(404).json({ error: 'Promemoria non trovato' });
    if (msg.status === 'cancelled' || msg.status === 'expired') {
      return res.status(409).json({ error: 'Questo promemoria non è più valido per l’invio' });
    }

    const normalizedRecipient = normalizeWhatsAppPhone(msg.recipient, whatsapp.default_prefix);
    if (!normalizedRecipient) {
      return res.status(400).json({ error: 'Numero destinatario non valido per WhatsApp' });
    }

    const waUrl = buildWhatsAppUrl(msg.recipient, msg.body, whatsapp.default_prefix);

    if (whatsapp.cloud_api_configured) {
      try {
        const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!.trim();
        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN!.trim();
        const graphRes = await fetch(
          `https://graph.facebook.com/v21.0/${encodeURIComponent(phoneNumberId)}/messages`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: normalizedRecipient.digits,
              type: 'text',
              text: { preview_url: false, body: msg.body },
            }),
          }
        );
        const graphJson = (await graphRes.json().catch(() => ({}))) as {
          messages?: Array<{ id?: string }>;
          error?: { message?: string };
        };
        if (!graphRes.ok) {
          return res.status(502).json({
            error:
              graphJson.error?.message ||
              'Errore durante l’invio tramite WhatsApp Business Cloud API',
          });
        }
        const providerMsgId = graphJson.messages?.[0]?.id || null;
        db.prepare(
          "UPDATE message_outbox SET status='sent', sent_at=CURRENT_TIMESTAMP, sent_via='cloud_api', sent_from=?, provider_message_id=? WHERE id=?"
        ).run(whatsapp.phone, providerMsgId, msg.id);
        log(auth.username, 'reminder_sent_whatsapp', {
          outbox_id: msg.id,
          appointment_id: msg.appointment_id,
          mode: 'cloud_api',
          from: whatsapp.phone,
        });
        return res.json({ ok: true, mode: 'cloud_api', wa_url: waUrl });
      } catch (err) {
        return res.status(502).json({
          error:
            err instanceof Error
              ? `Errore connessione WhatsApp API: ${err.message}`
              : 'Errore connessione WhatsApp API',
        });
      }
    }

    // WhatsApp Web / App dispatch mode (records send with linked studio number)
    db.prepare(
      "UPDATE message_outbox SET status='sent', sent_at=CURRENT_TIMESTAMP, sent_via='whatsapp_web', sent_from=? WHERE id=?"
    ).run(whatsapp.phone, msg.id);
    log(auth.username, 'reminder_sent_whatsapp', {
      outbox_id: msg.id,
      appointment_id: msg.appointment_id,
      mode: 'whatsapp_web',
      from: whatsapp.phone,
    });
    return res.json({ ok: true, mode: 'whatsapp_web', wa_url: waUrl });
  });

  // Public Confirmation Portal
  app.get('/api/public/confirm', (req, res) => {
    const ip = req.socket.remoteAddress || 'unknown';
    if (!allowConfirmationAttempt(ip)) {
      return res.status(429).json({ error: 'Troppi tentativi, riprova più tardi' });
    }
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const c = findConfirmation(code);
    if (!c) return res.status(404).json({ error: 'Codice non valido' });
    if (c.state !== 'pending' || c.appointment_status !== 'booked') {
      return res.status(409).json({ error: 'Questo appuntamento non è più in attesa di conferma' });
    }
    if (c.expires_at < new Date().toISOString()) {
      db.prepare("UPDATE appointment_confirmations SET state='expired' WHERE id=?").run(c.id);
      return res.status(410).json({ error: 'Il codice è scaduto' });
    }
    return res.json({
      appointment: {
        patient: c.patient.split(' ')[0],
        procedure: c.procedure,
        professional: c.professional,
        starts_at: c.starts_at,
      },
    });
  });

  app.post('/api/public/confirm', (req, res) => {
    const ip = req.socket.remoteAddress || 'unknown';
    if (!allowConfirmationAttempt(ip)) {
      return res.status(429).json({ error: 'Troppi tentativi, riprova più tardi' });
    }
    const { code, action } = req.body || {};
    const c = findConfirmation(String(code || ''));
    if (!c) return res.status(404).json({ error: 'Codice non valido' });
    if (c.state !== 'pending' || c.appointment_status !== 'booked') {
      return res.status(409).json({ error: 'Questo appuntamento non è più in attesa di conferma' });
    }
    if (c.expires_at < new Date().toISOString()) {
      db.prepare("UPDATE appointment_confirmations SET state='expired' WHERE id=?").run(c.id);
      return res.status(410).json({ error: 'Il codice è scaduto' });
    }
    if (action === 'confirm') {
      db.prepare(
        "UPDATE appointment_confirmations SET state='confirmed', responded_at=CURRENT_TIMESTAMP WHERE id=?"
      ).run(c.id);
      db.prepare(
        "UPDATE message_outbox SET status='responded' WHERE confirmation_id=? AND status IN ('prepared','sent')"
      ).run(c.id);
      log('cliente_codice', 'appointment_confirmed', {
        appointment_id: c.appointment_id,
        confirmation_id: c.id,
      });
      return res.json({ state: 'confirmed' });
    }
    if (action === 'cancel') {
      db.prepare("UPDATE appointments SET status='cancelled' WHERE id=?").run(c.appointment_id);
      db.prepare(
        "UPDATE appointment_confirmations SET state='cancelled', responded_at=CURRENT_TIMESTAMP WHERE id=?"
      ).run(c.id);
      db.prepare(
        "UPDATE message_outbox SET status='cancelled' WHERE appointment_id=? AND status IN ('prepared','sent')"
      ).run(c.appointment_id);
      log('cliente_codice', 'appointment_cancelled', {
        appointment_id: c.appointment_id,
        confirmation_id: c.id,
      });
      const ap = db
        .prepare('SELECT * FROM appointments WHERE id=?')
        .get(c.appointment_id) as unknown as AppointmentRow;
      const proposals = cancellationProposals(ap, 'cliente_codice', true);
      return res.json({ state: 'cancelled', proposals: proposals.length });
    }
    return res.status(400).json({ error: 'Scegli conferma o disdetta' });
  });

  // Audit
  app.get('/api/audit', (req, res) => {
    if (!requireAuth(req, res)) return;
    return res.json({ events: db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT 120').all() });
  });

  // Appointments
  app.post('/api/appointments', (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const { patient_id, professional_id, chair_id, procedure_id, starts_at } = req.body || {};
    const proc = db.prepare('SELECT * FROM procedures WHERE id=?').get(procedure_id) as
      | { id: number; duration: number; resources: string }
      | undefined;
    const prof = db.prepare('SELECT * FROM professionals WHERE id=?').get(professional_id) as
      | { id: number; procedure_ids: string }
      | undefined;
    const chair = db.prepare('SELECT * FROM chairs WHERE id=? AND active=1').get(chair_id) as
      | { id: number; resources: string }
      | undefined;

    if (
      !proc ||
      !prof ||
      !chair ||
      !db.prepare('SELECT id FROM patients WHERE id=?').get(patient_id)
    ) {
      return res.status(400).json({ error: 'Selezione incompleta' });
    }

    const profProcedures = JSON.parse(prof.procedure_ids) as number[];
    const procResources = JSON.parse(proc.resources) as string[];
    const chairResources = JSON.parse(chair.resources) as string[];

    if (
      !profProcedures.includes(Number(procedure_id)) ||
      !procResources.every((r) => chairResources.includes(r))
    ) {
      return res
        .status(400)
        .json({ error: 'Professionista o poltrona incompatibile con la prestazione' });
    }

    const start = new Date(starts_at);
    const end = new Date(start.getTime() + proc.duration * 60_000);
    if (!Number.isFinite(start.getTime())) {
      return res.status(400).json({ error: 'Data non valida' });
    }

    const conflict = db
      .prepare(
        `SELECT a.id FROM appointments a JOIN procedures p ON p.id=a.procedure_id
         WHERE a.status='booked' AND (a.professional_id=? OR a.chair_id=?)
           AND julianday(a.starts_at)<julianday(?)
           AND julianday(a.starts_at)+(p.duration/1440.0)>julianday(?)`
      )
      .get(prof.id, chair.id, end.toISOString(), start.toISOString());

    if (conflict) {
      return res.status(409).json({ error: 'Sovrapposizione per professionista o poltrona' });
    }

    const result = db
      .prepare(
        'INSERT INTO appointments(patient_id,professional_id,chair_id,procedure_id,starts_at) VALUES(?,?,?,?,?)'
      )
      .run(patient_id, prof.id, chair.id, proc.id, start.toISOString());
    const id = Number(result.lastInsertRowid);
    log(auth.username, 'appointment_created', {
      appointment_id: id,
      patient_id,
      professional_id,
      chair_id,
      procedure_id,
      starts_at: start.toISOString(),
    });
    return res.status(201).json({ id });
  });

  app.post('/api/appointments/:id/cancel', (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const id = Number(req.params.id);
    const offer = req.body?.offer !== false;
    const ap = db
      .prepare("SELECT * FROM appointments WHERE id=? AND status='booked'")
      .get(id) as AppointmentRow | undefined;

    if (!ap) return res.status(404).json({ error: 'Appuntamento non trovato' });

    db.prepare("UPDATE appointments SET status='cancelled' WHERE id=?").run(id);
    db.prepare(
      "UPDATE appointment_confirmations SET state='cancelled', responded_at=CURRENT_TIMESTAMP WHERE appointment_id=? AND state='pending'"
    ).run(id);
    db.prepare(
      "UPDATE message_outbox SET status='cancelled' WHERE appointment_id=? AND status IN ('prepared','sent')"
    ).run(id);
    log(auth.username, 'appointment_cancelled', { appointment_id: id });

    const created = cancellationProposals(ap, auth.username, offer);
    const proc = db.prepare('SELECT * FROM procedures WHERE id=?').get(ap.procedure_id) as {
      duration: number;
    };
    const prof = db.prepare('SELECT * FROM professionals WHERE id=?').get(ap.professional_id) as {
      name: string;
    };
    const chair = db.prepare('SELECT * FROM chairs WHERE id=?').get(ap.chair_id) as { name: string };
    const patient = db.prepare('SELECT * FROM patients WHERE id=?').get(ap.patient_id) as {
      name: string;
    };

    return res.json({
      freed: {
        id,
        starts_at: ap.starts_at,
        duration: proc.duration,
        professional: prof.name,
        chair: chair.name,
        patient: patient.name,
      },
      proposals: created,
    });
  });

  // Public Proposal Response Portal (Real SMS Advance Offer)
  app.get('/api/public/proposal', (req, res) => {
    const ip = req.socket.remoteAddress || 'unknown';
    if (!allowConfirmationAttempt(ip)) {
      return res.status(429).json({ error: 'Troppi tentativi, riprova più tardi' });
    }
    const code = typeof req.query.code === 'string' ? req.query.code.trim().toUpperCase() : '';
    if (!/^[A-Z0-9]{10}$/.test(code)) {
      return res.status(404).json({ error: 'Codice proposta non valido' });
    }
    const row = db
      .prepare(
        `SELECT q.*, p.name patient, pr.name procedure, pr.duration,
                a.starts_at original_starts_at, a.status appointment_status,
                f.starts_at freed_starts_at, f.status freed_status,
                fpro.name freed_professional, fch.name freed_chair
         FROM proposals q
         JOIN appointments a ON a.id = q.appointment_id
         JOIN patients p ON p.id = a.patient_id
         JOIN procedures pr ON pr.id = a.procedure_id
         JOIN appointments f ON f.id = q.freed_appointment_id
         JOIN professionals fpro ON fpro.id = f.professional_id
         JOIN chairs fch ON fch.id = f.chair_id
         WHERE q.invite_code_hash=?`
      )
      .get(hashValue(code)) as
      | {
          id: number;
          state: string;
          patient: string;
          procedure: string;
          duration: number;
          original_starts_at: string;
          appointment_status: string;
          freed_starts_at: string;
          freed_status: string;
          freed_professional: string;
          freed_chair: string;
        }
      | undefined;

    if (!row) return res.status(404).json({ error: 'Proposta non trovata o codice scaduto' });
    if (row.state !== 'pending_patient' || row.appointment_status !== 'booked' || row.freed_status !== 'cancelled') {
      return res.status(409).json({ error: 'Questa proposta di anticipo non è più disponibile' });
    }
    if (new Date(row.freed_starts_at).getTime() < Date.now()) {
      return res.status(410).json({ error: 'Lo slot proposto è già trascorso' });
    }

    return res.json({
      proposal: {
        patient: row.patient.split(' ')[0],
        procedure: row.procedure,
        duration: row.duration,
        original_starts_at: row.original_starts_at,
        freed_starts_at: row.freed_starts_at,
        freed_professional: row.freed_professional,
        freed_chair: row.freed_chair,
      },
    });
  });

  app.post('/api/public/proposal', (req, res) => {
    const ip = req.socket.remoteAddress || 'unknown';
    if (!allowConfirmationAttempt(ip)) {
      return res.status(429).json({ error: 'Troppi tentativi, riprova più tardi' });
    }
    const code = String(req.body?.code || '').trim().toUpperCase();
    const action = req.body?.action;
    if (!/^[A-Z0-9]{10}$/.test(code)) {
      return res.status(404).json({ error: 'Codice proposta non valido' });
    }
    if (action !== 'accept' && action !== 'decline') {
      return res.status(400).json({ error: 'Scegli se accettare o rifiutare lo spostamento' });
    }

    const row = db
      .prepare(
        `SELECT q.id, q.state, a.status appointment_status, f.starts_at freed_starts_at, f.status freed_status
         FROM proposals q
         JOIN appointments a ON a.id = q.appointment_id
         JOIN appointments f ON f.id = q.freed_appointment_id
         WHERE q.invite_code_hash=?`
      )
      .get(hashValue(code)) as
      | {
          id: number;
          state: string;
          appointment_status: string;
          freed_starts_at: string;
          freed_status: string;
        }
      | undefined;

    if (!row) return res.status(404).json({ error: 'Proposta non trovata' });
    if (row.state !== 'pending_patient' || row.appointment_status !== 'booked' || row.freed_status !== 'cancelled') {
      return res.status(409).json({ error: 'Questa proposta non è più in attesa di risposta' });
    }
    if (new Date(row.freed_starts_at).getTime() < Date.now()) {
      return res.status(410).json({ error: 'Lo slot proposto è già trascorso' });
    }

    const nextState = action === 'accept' ? 'accepted_waiting_approval' : 'declined';
    db.prepare('UPDATE proposals SET state=?, responded_at=CURRENT_TIMESTAMP WHERE id=?').run(
      nextState,
      row.id
    );
    log('cliente_sms', action === 'accept' ? 'proposal_patient_accept' : 'proposal_patient_decline', {
      proposal_id: row.id,
    });
    return res.json({ state: nextState });
  });

  app.post('/api/appointments/:id/send-move-sms', async (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID appuntamento non valido' });
    }
    const result = await sendAppointmentMoveSms(id, auth.username);
    if (!result.ok) {
      return res.status(502).json({ error: result.error });
    }
    db.prepare(
      "UPDATE proposals SET move_sms_sent_at=CURRENT_TIMESTAMP WHERE appointment_id=? AND state='approved'"
    ).run(id);
    return res.json({ ok: true, phone: result.phone });
  });

  // Proposals
  app.get('/api/proposals', (req, res) => {
    if (!requireAuth(req, res)) return;
    const proposals = db
      .prepare(
        `SELECT q.*, p.name patient, p.phone, pr.name procedure, pr.duration,
                a.starts_at original_starts_at, f.starts_at freed_starts_at,
                fpro.name freed_professional, fch.name freed_chair,
                opro.name original_professional, och.name original_chair
         FROM proposals q
         JOIN appointments a ON a.id = q.appointment_id
         JOIN patients p ON p.id = a.patient_id
         JOIN procedures pr ON pr.id = a.procedure_id
         JOIN appointments f ON f.id = q.freed_appointment_id
         JOIN professionals fpro ON fpro.id = f.professional_id
         JOIN chairs fch ON fch.id = f.chair_id
         JOIN professionals opro ON opro.id = a.professional_id
         JOIN chairs och ON och.id = a.chair_id
         ORDER BY q.id DESC`
      )
      .all();
    return res.json({ proposals });
  });

  app.post('/api/proposals/:id/send-sms', async (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const id = Number(req.params.id);
    const row = db
      .prepare(
        `SELECT q.id, q.state, q.invite_code, p.name patient, p.phone,
                pr.name procedure, f.starts_at freed_starts_at,
                fpro.name freed_professional, fch.name freed_chair
         FROM proposals q
         JOIN appointments a ON a.id = q.appointment_id
         JOIN patients p ON p.id = a.patient_id
         JOIN procedures pr ON pr.id = a.procedure_id
         JOIN appointments f ON f.id = q.freed_appointment_id
         JOIN professionals fpro ON fpro.id = f.professional_id
         JOIN chairs fch ON fch.id = f.chair_id
         WHERE q.id=?`
      )
      .get(id) as
      | {
          id: number;
          state: string;
          invite_code: string | null;
          patient: string;
          phone: string;
          procedure: string;
          freed_starts_at: string;
          freed_professional: string;
          freed_chair: string;
        }
      | undefined;

    if (!row) return res.status(404).json({ error: 'Proposta non trovata' });
    if (row.state !== 'pending_patient') {
      return res.status(409).json({ error: 'La proposta non è più in attesa di risposta del paziente' });
    }

    const whatsapp = getWhatsAppConfig();
    const normalized = normalizeWhatsAppPhone(row.phone, whatsapp.default_prefix);
    if (!normalized) {
      return res.status(400).json({ error: 'Numero di telefono del paziente non valido per SMS' });
    }

    const code = row.invite_code || generateShortCode();
    const appUrl = resolvePublicAppUrl(req);
    const link = `${appUrl}/anticipo?proposal=${code}`;
    const firstName = row.patient.split(' ')[0] || row.patient;
    const when = formatItalianDateTime(row.freed_starts_at);
    const body = `Ciao ${firstName}, si è liberato uno slot anticipato per ${row.procedure}: ${when} con ${row.freed_professional}. Accetta o rifiuta qui: ${link} (Codice: ${code}) — ${whatsapp.sender_name}`;

    const result = await dispatchTextBeeSms({
      recipientE164: normalized.formatted,
      message: body,
    });
    if (!result.ok) {
      return res.status(502).json({ error: result.error });
    }

    db.prepare(
      'UPDATE proposals SET invite_code_hash=?, invite_code=?, sms_sent_at=CURRENT_TIMESTAMP WHERE id=?'
    ).run(hashValue(code), code, id);

    log(auth.username, 'proposal_sms_sent', {
      proposal_id: id,
      name: row.patient,
      phone: normalized.formatted,
    });
    return res.json({ ok: true, code, link });
  });

  app.post('/api/proposals/:id/:action', async (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const id = Number(req.params.id);
    const action = req.params.action;
    if (!['accept', 'decline', 'approve', 'reject'].includes(action)) {
      return res.status(404).json({ error: 'Azione non valida' });
    }

    const p = db.prepare('SELECT * FROM proposals WHERE id=?').get(id) as
      | { id: number; appointment_id: number; freed_appointment_id: number; state: string }
      | undefined;
    if (!p) return res.status(404).json({ error: 'Proposta non trovata' });

    if (action === 'accept' || action === 'decline') {
      if (p.state !== 'pending_patient') {
        return res.status(409).json({ error: 'La proposta non è più in attesa' });
      }
      const nextState = action === 'accept' ? 'accepted_waiting_approval' : 'declined';
      db.prepare('UPDATE proposals SET state=?, responded_at=CURRENT_TIMESTAMP WHERE id=?').run(
        nextState,
        id
      );
      log(auth.username, `proposal_${action}`, { proposal_id: id });
      return res.json({ state: nextState });
    }

    if (p.state !== 'accepted_waiting_approval') {
      return res.status(409).json({ error: 'Serve prima l’accettazione del paziente' });
    }

    if (action === 'reject') {
      db.prepare(
        "UPDATE proposals SET state='rejected', approved_by=?, approved_at=CURRENT_TIMESTAMP WHERE id=?"
      ).run(auth.username, id);
      log(auth.username, 'proposal_rejected', { proposal_id: id });
      return res.json({ state: 'rejected' });
    }

    // approve
    const target = db
      .prepare("SELECT * FROM appointments WHERE id=? AND status='booked'")
      .get(p.appointment_id) as unknown as AppointmentRow | undefined;
    const freed = db
      .prepare("SELECT * FROM appointments WHERE id=? AND status='cancelled'")
      .get(p.freed_appointment_id) as unknown as AppointmentRow | undefined;
    if (!target || !freed) {
      return res.status(409).json({ error: 'Appuntamento o spazio non più disponibile' });
    }

    const targetProc = db.prepare('SELECT * FROM procedures WHERE id=?').get(target.procedure_id) as {
      duration: number;
      resources: string;
    };
    const destinationPro = db
      .prepare('SELECT * FROM professionals WHERE id=?')
      .get(freed.professional_id) as { procedure_ids: string };
    const destinationChair = db
      .prepare('SELECT * FROM chairs WHERE id=?')
      .get(freed.chair_id) as { active: number; resources: string } | undefined;

    const destinationEnd = new Date(
      new Date(freed.starts_at).getTime() + targetProc.duration * 60_000
    ).toISOString();

    if (
      !destinationChair?.active ||
      !(JSON.parse(destinationPro.procedure_ids) as number[]).includes(target.procedure_id) ||
      !(JSON.parse(targetProc.resources) as string[]).every((r) =>
        (JSON.parse(destinationChair.resources) as string[]).includes(r)
      )
    ) {
      return res.status(409).json({
        error: 'Professionista o stanza non attiva o non compatibile con la prestazione',
      });
    }

    const conflict = db
      .prepare(
        `SELECT 1 FROM appointments a JOIN procedures p ON p.id=a.procedure_id
         WHERE a.id<>? AND a.status='booked' AND (a.professional_id=? OR a.chair_id=?)
           AND julianday(a.starts_at)<julianday(?)
           AND julianday(a.starts_at)+(p.duration/1440.0)>julianday(?)`
      )
      .get(target.id, freed.professional_id, freed.chair_id, destinationEnd, freed.starts_at);
    if (conflict) {
      return res.status(409).json({ error: 'Lo spazio è stato occupato nel frattempo' });
    }

    db.prepare('UPDATE appointments SET starts_at=?, professional_id=?, chair_id=? WHERE id=?').run(
      freed.starts_at,
      freed.professional_id,
      freed.chair_id,
      target.id
    );
    db.prepare(
      "UPDATE appointment_confirmations SET state='cancelled', responded_at=CURRENT_TIMESTAMP WHERE appointment_id=? AND state='pending'"
    ).run(target.id);
    db.prepare(
      "UPDATE message_outbox SET status='cancelled' WHERE appointment_id=? AND status IN ('prepared','sent')"
    ).run(target.id);
    db.prepare(
      "UPDATE proposals SET state='approved', approved_by=?, approved_at=CURRENT_TIMESTAMP WHERE id=?"
    ).run(auth.username, id);

    log(auth.username, 'proposal_approved', {
      proposal_id: id,
      appointment_id: target.id,
      old_starts_at: target.starts_at,
      new_starts_at: freed.starts_at,
    });

    let smsSent = false;
    let smsError: string | null = null;
    if (req.body?.send_sms === true) {
      const smsRes = await sendAppointmentMoveSms(target.id, auth.username);
      if (smsRes.ok) {
        smsSent = true;
        db.prepare('UPDATE proposals SET move_sms_sent_at=CURRENT_TIMESTAMP WHERE id=?').run(id);
      } else {
        smsError = smsRes.error;
      }
    }

    return res.json({ state: 'approved', sms_sent: smsSent, sms_error: smsError });
  });

  // Cancellations listing & direct slot replacement
  app.get('/api/cancellations', (req, res) => {
    if (!requireAuth(req, res)) return;
    const nowIso = new Date().toISOString();

    const cancelledRows = db
      .prepare(
        `SELECT a.*, p.name patient, p.phone, pr.name procedure, pr.duration, pr.specialty,
                pro.name professional, pro.color, pro.procedure_ids prof_procedure_ids,
                c.name chair, c.active chair_active, c.resources chair_resources
         FROM appointments a
         JOIN patients p ON p.id = a.patient_id
         JOIN procedures pr ON pr.id = a.procedure_id
         JOIN professionals pro ON pro.id = a.professional_id
         JOIN chairs c ON c.id = a.chair_id
         WHERE a.status='cancelled'
         ORDER BY a.starts_at DESC`
      )
      .all() as unknown as Array<
      AppointmentRow & {
        patient: string;
        phone: string;
        procedure: string;
        duration: number;
        specialty: string;
        professional: string;
        color: string;
        prof_procedure_ids: string;
        chair: string;
        chair_active: number;
        chair_resources: string;
      }
    >;

    const futureBooked = db
      .prepare(
        `SELECT a.*, p.name patient, p.phone, pr.name procedure, pr.duration,
                pr.resources procedure_resources, pro.name professional, c.name chair
         FROM appointments a
         JOIN patients p ON p.id = a.patient_id
         JOIN procedures pr ON pr.id = a.procedure_id
         JOIN professionals pro ON pro.id = a.professional_id
         JOIN chairs c ON c.id = a.chair_id
         WHERE a.status='booked' AND a.starts_at>?
         ORDER BY a.starts_at ASC`
      )
      .all(nowIso) as unknown as Array<
      AppointmentRow & {
        patient: string;
        phone: string;
        procedure: string;
        duration: number;
        procedure_resources: string;
        professional: string;
        chair: string;
      }
    >;

    const items = cancelledRows.map((ap) => {
      const start = new Date(ap.starts_at);
      const end = new Date(start.getTime() + ap.duration * 60_000);
      const endIso = end.toISOString();

      const replacement = db
        .prepare(
          `SELECT a.id, a.starts_at, p.name patient, pr.name procedure, pr.duration,
                  pro.name professional, c.name chair
           FROM appointments a
           JOIN patients p ON p.id = a.patient_id
           JOIN procedures pr ON pr.id = a.procedure_id
           JOIN professionals pro ON pro.id = a.professional_id
           JOIN chairs c ON c.id = a.chair_id
           WHERE a.status='booked' AND (a.professional_id=? OR a.chair_id=?)
             AND julianday(a.starts_at)<julianday(?)
             AND julianday(a.starts_at)+(pr.duration/1440.0)>julianday(?)
           ORDER BY a.starts_at ASC
           LIMIT 1`
        )
        .get(ap.professional_id, ap.chair_id, endIso, ap.starts_at) as
        | {
            id: number;
            starts_at: string;
            patient: string;
            procedure: string;
            duration: number;
            professional: string;
            chair: string;
          }
        | undefined;

      const pendingProposals = Number(
        (
          db
            .prepare(
              "SELECT COUNT(*) n FROM proposals WHERE freed_appointment_id=? AND state IN ('pending_patient','accepted_waiting_approval')"
            )
            .get(ap.id) as { n: number }
        ).n
      );

      const isPast = end.getTime() < Date.now();
      let slotStatus: 'free' | 'replaced' | 'past' | 'inactive_room' = 'free';
      if (replacement) {
        slotStatus = 'replaced';
      } else if (isPast) {
        slotStatus = 'past';
      } else if (!ap.chair_active) {
        slotStatus = 'inactive_room';
      }

      const profProcedureIds = JSON.parse(ap.prof_procedure_ids) as number[];
      const chairResources = JSON.parse(ap.chair_resources) as string[];

      const candidates =
        slotStatus === 'free'
          ? futureBooked
              .filter((c) => {
                if (c.id === ap.id) return false;
                const reqResources = JSON.parse(c.procedure_resources) as string[];
                return (
                  profProcedureIds.includes(c.procedure_id) &&
                  reqResources.every((r) => chairResources.includes(r)) &&
                  c.duration <= ap.duration &&
                  new Date(c.starts_at).getTime() !== start.getTime()
                );
              })
              .map((c) => ({
                id: c.id,
                patient: c.patient,
                phone: c.phone,
                procedure: c.procedure,
                duration: c.duration,
                starts_at: c.starts_at,
                professional: c.professional,
                chair: c.chair,
              }))
          : [];

      return {
        id: ap.id,
        patient_id: ap.patient_id,
        professional_id: ap.professional_id,
        chair_id: ap.chair_id,
        procedure_id: ap.procedure_id,
        starts_at: ap.starts_at,
        patient: ap.patient,
        phone: ap.phone,
        procedure: ap.procedure,
        duration: ap.duration,
        specialty: ap.specialty,
        professional: ap.professional,
        color: ap.color,
        chair: ap.chair,
        chair_active: Boolean(ap.chair_active),
        slot_status: slotStatus,
        replaced_by: replacement || null,
        pending_proposals_count: pendingProposals,
        candidates,
      };
    });

    return res.json({ cancellations: items });
  });

  app.post('/api/cancellations/:id/replace', async (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return;

    const freedId = Number(req.params.id);
    const appointmentId = Number(req.body?.appointment_id);
    if (!Number.isInteger(freedId) || !Number.isInteger(appointmentId)) {
      return res.status(400).json({ error: 'Seleziona un appuntamento valido da spostare' });
    }

    const freed = db
      .prepare("SELECT * FROM appointments WHERE id=? AND status='cancelled'")
      .get(freedId) as unknown as AppointmentRow | undefined;
    const target = db
      .prepare("SELECT * FROM appointments WHERE id=? AND status='booked'")
      .get(appointmentId) as unknown as AppointmentRow | undefined;

    if (!freed || !target) {
      return res.status(404).json({ error: 'Slot disdetto o appuntamento non più disponibile' });
    }

    const targetProc = db.prepare('SELECT * FROM procedures WHERE id=?').get(target.procedure_id) as {
      duration: number;
      resources: string;
    };
    const destinationPro = db
      .prepare('SELECT * FROM professionals WHERE id=?')
      .get(freed.professional_id) as { procedure_ids: string };
    const destinationChair = db
      .prepare('SELECT * FROM chairs WHERE id=?')
      .get(freed.chair_id) as { active: number; resources: string } | undefined;

    if (
      !destinationChair?.active ||
      !(JSON.parse(destinationPro.procedure_ids) as number[]).includes(target.procedure_id) ||
      !(JSON.parse(targetProc.resources) as string[]).every((r) =>
        (JSON.parse(destinationChair.resources) as string[]).includes(r)
      )
    ) {
      return res.status(409).json({
        error: 'Professionista o stanza non attiva o non compatibile con la prestazione',
      });
    }

    const destinationEnd = new Date(
      new Date(freed.starts_at).getTime() + targetProc.duration * 60_000
    ).toISOString();

    const conflict = db
      .prepare(
        `SELECT 1 FROM appointments a JOIN procedures p ON p.id=a.procedure_id
         WHERE a.id<>? AND a.status='booked' AND (a.professional_id=? OR a.chair_id=?)
           AND julianday(a.starts_at)<julianday(?)
           AND julianday(a.starts_at)+(p.duration/1440.0)>julianday(?)`
      )
      .get(target.id, freed.professional_id, freed.chair_id, destinationEnd, freed.starts_at);

    if (conflict) {
      return res.status(409).json({ error: 'Lo slot è già stato occupato nel frattempo' });
    }

    db.prepare('UPDATE appointments SET starts_at=?, professional_id=?, chair_id=? WHERE id=?').run(
      freed.starts_at,
      freed.professional_id,
      freed.chair_id,
      target.id
    );

    // Invalidate outdated confirmations & reminders for moved appointment
    db.prepare(
      "UPDATE appointment_confirmations SET state='cancelled', responded_at=CURRENT_TIMESTAMP WHERE appointment_id=? AND state='pending'"
    ).run(target.id);
    db.prepare(
      "UPDATE message_outbox SET status='cancelled' WHERE appointment_id=? AND status IN ('prepared','sent')"
    ).run(target.id);

    // Resolve any pending proposals targeting this freed slot
    db.prepare(
      "UPDATE proposals SET state='approved', approved_by=?, approved_at=CURRENT_TIMESTAMP WHERE freed_appointment_id=? AND appointment_id=? AND state IN ('pending_patient','accepted_waiting_approval')"
    ).run(auth.username, freed.id, target.id);
    db.prepare(
      "UPDATE proposals SET state='rejected', approved_by=?, approved_at=CURRENT_TIMESTAMP WHERE freed_appointment_id=? AND appointment_id<>? AND state IN ('pending_patient','accepted_waiting_approval')"
    ).run(auth.username, freed.id, target.id);

    log(auth.username, 'cancellation_replaced', {
      freed_appointment_id: freed.id,
      appointment_id: target.id,
      old_starts_at: target.starts_at,
      new_starts_at: freed.starts_at,
    });

    let smsSent = false;
    let smsError: string | null = null;
    if (req.body?.send_sms === true) {
      const smsRes = await sendAppointmentMoveSms(target.id, auth.username);
      if (smsRes.ok) {
        smsSent = true;
      } else {
        smsError = smsRes.error;
      }
    }

    return res.json({ ok: true, appointment_id: target.id, sms_sent: smsSent, sms_error: smsError });
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Endpoint non trovato' });
  });

  // Frontend serving (Vite dev middleware or built dist/)
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(ROOT, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AgendaSmart V5 pronta su http://0.0.0.0:${PORT}`);
    try {
      prepareReminderBatch();
    } catch (error) {
      console.error('Preparazione promemoria:', error);
    }
    const timer = setInterval(() => {
      try {
        prepareReminderBatch();
      } catch (error) {
        console.error('Preparazione promemoria:', error);
      }
    }, 15 * 60 * 1000);
    timer.unref();
  });
}

startServer();
