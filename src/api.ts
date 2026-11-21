const TOKEN_STORAGE_KEY = 'agendasmart_session_token';

export function getStoredToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage restrictions
  }
}

export async function api<T = unknown>(url: string, opts: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((opts.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    credentials: 'include',
    ...opts,
    headers,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((payload as { error?: string }).error || 'Errore di comunicazione');
  }
  return payload as T;
}

export function dateISO(value: Date | string): string {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export function plusDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function mondayOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setHours(12, 0, 0, 0);
  return d;
}

export function fmtDate(
  value: Date | string,
  options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }
): string {
  return new Intl.DateTimeFormat('it-IT', options).format(new Date(value));
}

export function fmtTime(value: Date | string): string {
  return new Intl.DateTimeFormat('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function fmtTimeRange(startsAt: string, durationMinutes: number): string {
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return `${fmtTime(start)}–${fmtTime(end)}`;
}

export function parseJsonArray<T = string>(raw: string | T[] | undefined | null): T[] {
  if (Array.isArray(raw)) return raw;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

export function extractConfirmationCode(messageBody: string): string | null {
  const match = messageBody.match(/Codice:\s*([A-Z0-9]{10})/i);
  return match ? match[1].toUpperCase() : null;
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  demo_seed: 'Inizializzazione dati demo',
  demo_cancellations_seed: 'Disdette demo inizializzate',
  login: 'Accesso operatore',
  appointment_created: 'Nuovo appuntamento',
  appointment_cancelled: 'Disdetta appuntamento',
  appointment_move_sms_sent: 'SMS conferma spostamento inviato',
  cancellation_replaced: 'Slot disdetto rimpiazzato',
  appointment_confirmed: 'Conferma paziente',
  proposal_created: 'Proposta di anticipo generata',
  proposal_sms_sent: 'SMS proposta di anticipo inviato',
  proposal_patient_accept: 'Anticipo accettato dal paziente via SMS',
  proposal_patient_decline: 'Anticipo rifiutato dal paziente via SMS',
  proposal_accept: 'Accettazione paziente registrata',
  proposal_decline: 'Rifiuto paziente registrato',
  proposal_approved: 'Anticipo approvato e spostato',
  proposal_rejected: 'Anticipo non approvato',
  reminder_prepared: 'Promemoria 24h preparato',
  reminder_sent_whatsapp: 'Promemoria inviato su WhatsApp',
  reminder_sent_sms: 'Promemoria inviato via SMS (TextBee)',
  sms_device_updated: 'Dispositivo SMS TextBee aggiornato',
  sms_test_sent: 'SMS di prova inviato (TextBee)',
  whatsapp_connected: 'Numero WhatsApp collegato',
  whatsapp_disconnected: 'Numero WhatsApp scollegato',
  patient_created: 'Nuovo cliente registrato',
  patient_updated: 'Scheda cliente modificata',
  patient_deleted: 'Cliente eliminato',
  professional_created: 'Nuovo professionista aggiunto',
  professional_updated: 'Professionista modificato',
  professional_deleted: 'Professionista eliminato',
  procedure_created: 'Nuovo trattamento aggiunto',
  procedure_updated: 'Trattamento modificato',
  procedure_deleted: 'Trattamento eliminato',
  chair_created: 'Nuova stanza aggiunta',
  chair_deactivated: 'Stanza rimossa / archiviata',
};

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>
): void {
  const escapeCell = (val: string | number | null | undefined): string => {
    const str = val === null || val === undefined ? '' : String(val);
    if (/[;"\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [
    headers.map(escapeCell).join(';'),
    ...rows.map((row) => row.map(escapeCell).join(';')),
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function formatAuditDetails(raw: string): string {
  try {
    const obj = JSON.parse(raw);
    if (typeof obj !== 'object' || obj === null) return String(obj);
    const parts: string[] = [];
    if (obj.name) parts.push(String(obj.name));
    if (obj.phone) parts.push(String(obj.phone));
    if (obj.from) parts.push(`Da: ${obj.from}`);
    if (obj.sender_name) parts.push(String(obj.sender_name));
    if (obj.role) parts.push(`Ruolo: ${obj.role}`);
    if (obj.appointment_id) parts.push(`Appuntamento #${obj.appointment_id}`);
    if (obj.proposal_id) parts.push(`Proposta #${obj.proposal_id}`);
    if (obj.freed_appointment_id) parts.push(`Slot liberato #${obj.freed_appointment_id}`);
    if (obj.patient_id && !obj.name) parts.push(`Cliente #${obj.patient_id}`);
    if (obj.chair_id && !obj.name) parts.push(`Stanza #${obj.chair_id}`);
    if (obj.outbox_id) parts.push(`Messaggio #${obj.outbox_id}`);
    if (obj.starts_at) {
      parts.push(
        fmtDate(obj.starts_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
      );
    }
    if (obj.old_starts_at && obj.new_starts_at) {
      parts.push(
        `${fmtDate(obj.old_starts_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} → ${fmtDate(obj.new_starts_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
      );
    }
    return parts.length ? parts.join(' · ') : raw;
  } catch {
    return raw;
  }
}
