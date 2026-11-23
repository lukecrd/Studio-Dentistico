import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Mail,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Send,
  Unlink,
  Pencil,
  Smartphone,
  AlertCircle,
  FlaskConical,
} from 'lucide-react';
import type { ReminderMessage, SmsConfig, WhatsAppConfig } from '../types';
import { extractConfirmationCode, fmtDate, fmtTime } from '../api';

interface RemindersViewProps {
  reminders: ReminderMessage[];
  whatsapp: WhatsAppConfig;
  sms: SmsConfig;
  smsLoading: boolean;
  onSaveWhatsApp: (payload: {
    phone: string;
    sender_name: string;
    default_prefix: string;
  }) => Promise<void>;
  onDisconnectWhatsApp: () => Promise<void>;
  onRefreshSms: () => Promise<void>;
  onSaveSmsDevice: (payload: {
    device_id: string;
    sim_subscription_id: number | null;
  }) => Promise<void>;
  onSendSmsTest: (payload: {
    recipient: string;
    message: string;
    device_id?: string;
    sim_subscription_id?: number | null;
  }) => Promise<void>;
  onPrepareNow: (windowMode: '24h' | '48h') => Promise<void>;
  onSendWhatsApp: (reminderId: number) => Promise<void>;
  onSendReminderSms: (reminderId: number) => Promise<void>;
  onCopySuccess: (msg: string) => void;
  onOpenPublicConfirm: (code: string) => void;
}

const STATUS_META: Record<
  ReminderMessage['status'],
  { label: string; colorClass: string; icon: typeof Clock }
> = {
  prepared: { label: 'Da inviare', colorClass: 'text-[var(--color-warn)]', icon: Clock },
  sent: {
    label: 'Inviato su WhatsApp',
    colorClass: 'text-[var(--color-clinical)]',
    icon: Send,
  },
  responded: {
    label: 'Risposta ricevuta',
    colorClass: 'text-[var(--color-clinical)]',
    icon: CheckCircle2,
  },
  cancelled: { label: 'Annullato', colorClass: 'text-[var(--color-muted)]', icon: XCircle },
  expired: { label: 'Scaduto', colorClass: 'text-[var(--color-muted)]', icon: XCircle },
};

export function RemindersView({
  reminders,
  whatsapp,
  sms,
  smsLoading,
  onSaveWhatsApp,
  onDisconnectWhatsApp,
  onRefreshSms,
  onSaveSmsDevice,
  onSendSmsTest,
  onPrepareNow,
  onSendWhatsApp,
  onSendReminderSms,
  onCopySuccess,
  onOpenPublicConfirm,
}: RemindersViewProps) {
  const [phone, setPhone] = useState(whatsapp.phone || '');
  const [senderName, setSenderName] = useState(whatsapp.sender_name || 'Studio Odontoiatrico');
  const [defaultPrefix, setDefaultPrefix] = useState(whatsapp.default_prefix || '+39');
  const [editingConfig, setEditingConfig] = useState(!whatsapp.connected);
  const [savingConfig, setSavingConfig] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const [deviceId, setDeviceId] = useState(sms.device_id || '');
  const [simSubId, setSimSubId] = useState<string>(
    sms.sim_subscription_id !== null && sms.sim_subscription_id !== undefined
      ? String(sms.sim_subscription_id)
      : ''
  );
  const [savingDevice, setSavingDevice] = useState(false);
  const [showSmsTest, setShowSmsTest] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');
  const [testMessage, setTestMessage] = useState(
    'Promemoria di prova da AgendaSmart · Studio Odontoiatrico.'
  );
  const [sendingTest, setSendingTest] = useState(false);

  const [windowMode, setWindowMode] = useState<'24h' | '48h'>('48h');
  const [running, setRunning] = useState(false);
  const [sendingWaId, setSendingWaId] = useState<number | null>(null);
  const [sendingSmsId, setSendingSmsId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const phoneInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPhone(whatsapp.phone || '');
    setSenderName(whatsapp.sender_name || 'Studio Odontoiatrico');
    setDefaultPrefix(whatsapp.default_prefix || '+39');
    if (!whatsapp.connected) {
      setEditingConfig(true);
    }
  }, [whatsapp.connected, whatsapp.phone, whatsapp.sender_name, whatsapp.default_prefix]);

  useEffect(() => {
    setDeviceId(sms.device_id || '');
    setSimSubId(
      sms.sim_subscription_id !== null && sms.sim_subscription_id !== undefined
        ? String(sms.sim_subscription_id)
        : ''
    );
  }, [sms.device_id, sms.sim_subscription_id]);

  const handleSaveConfig = async (e: FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await onSaveWhatsApp({
        phone,
        sender_name: senderName,
        default_prefix: defaultPrefix,
      });
      setEditingConfig(false);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await onDisconnectWhatsApp();
      setEditingConfig(true);
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSaveDevice = async (e: FormEvent) => {
    e.preventDefault();
    setSavingDevice(true);
    try {
      await onSaveSmsDevice({
        device_id: deviceId.trim(),
        sim_subscription_id: simSubId !== '' ? Number(simSubId) : null,
      });
    } finally {
      setSavingDevice(false);
    }
  };

  const handleSendTestSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSendingTest(true);
    try {
      await onSendSmsTest({
        recipient: testRecipient.trim(),
        message: testMessage.trim(),
        device_id: deviceId.trim() || undefined,
        sim_subscription_id: simSubId !== '' ? Number(simSubId) : null,
      });
      setTestRecipient('');
    } finally {
      setSendingTest(false);
    }
  };

  const handleRun = async () => {
    setRunning(true);
    try {
      await onPrepareNow(windowMode);
    } finally {
      setRunning(false);
    }
  };

  const handleSendWa = async (reminderId: number) => {
    setSendingWaId(reminderId);
    try {
      await onSendWhatsApp(reminderId);
    } finally {
      setSendingWaId(null);
    }
  };

  const handleSendSms = async (reminderId: number) => {
    setSendingSmsId(reminderId);
    try {
      await onSendReminderSms(reminderId);
    } finally {
      setSendingSmsId(null);
    }
  };

  const focusWhatsAppSetup = () => {
    setEditingConfig(true);
    setTimeout(() => {
      phoneInputRef.current?.focus();
      phoneInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  };

  const handleCopy = async (message: ReminderMessage) => {
    try {
      await navigator.clipboard.writeText(message.body);
      setCopiedId(message.id);
      onCopySuccess('Messaggio copiato negli appunti');
      setTimeout(() => setCopiedId((prev) => (prev === message.id ? null : prev)), 2000);
    } catch {
      onCopySuccess('Copia non disponibile in questo browser');
    }
  };

  const smsHostLabel = (() => {
    try {
      return new URL(sms.base_url).host;
    } catch {
      return sms.base_url || 'api.textbee.dev';
    }
  })();

  const activeDevicesCount = sms.devices.filter((d) => d.enabled).length;
  const selectedDeviceObj =
    sms.devices.find((d) => d.id === deviceId) ||
    sms.devices.find((d) => d.enabled) ||
    sms.devices[0];
  const availableSims = selectedDeviceObj?.sims || [];

  return (
    <div className="space-y-5">
      {/* Channels Configuration Grid: WhatsApp + TextBee SMS */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
        {/* Studio WhatsApp Connection Panel */}
        <section className="surface-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--color-line)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-[var(--color-clinical-tint)] text-[var(--color-clinical)] flex items-center justify-center shrink-0 mt-0.5">
                <MessageCircle className="w-[18px] h-[18px]" />
              </div>
              <div>
                <h2 className="text-[15.5px] font-semibold text-[var(--color-ink)]">
                  Numero WhatsApp dello studio
                </h2>
                <p className="text-[12.5px] text-[var(--color-muted)] mt-0.5">
                  {whatsapp.connected
                    ? whatsapp.cloud_api_configured
                      ? 'Collegato · invio diretto tramite WhatsApp Business API'
                      : 'Collegato · invio rapido tramite WhatsApp Web o app'
                    : 'Collega il numero WhatsApp per inviare i promemoria in chat.'}
                </p>
              </div>
            </div>

            {whatsapp.connected && !editingConfig && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingConfig(true)}
                  className="min-h-[36px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[12.5px] font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-subtle)] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Modifica</span>
                </button>
                <button
                  type="button"
                  disabled={disconnecting}
                  onClick={handleDisconnect}
                  className="min-h-[36px] px-3 rounded-lg border border-[var(--color-alert-border)] bg-white text-[12.5px] font-medium text-[var(--color-alert)] hover:bg-[var(--color-alert-tint)] transition-colors inline-flex items-center gap-1.5 disabled:opacity-60 whitespace-nowrap shrink-0"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  <span>{disconnecting ? 'Rimozione…' : 'Scollega'}</span>
                </button>
              </div>
            )}
          </div>

          {whatsapp.connected && !editingConfig ? (
            <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-[13px]">
              <div>
                <div className="text-[11.5px] text-[var(--color-muted)] font-medium">
                  Numero collegato
                </div>
                <div className="mt-1 font-mono text-[13.5px] font-semibold text-[var(--color-ink)] tabular-nums flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[var(--color-clinical)] shrink-0" />
                  <span>{whatsapp.phone}</span>
                </div>
              </div>
              <div>
                <div className="text-[11.5px] text-[var(--color-muted)] font-medium">
                  Firma mittente
                </div>
                <div className="mt-1 font-medium text-[var(--color-ink)]">
                  {whatsapp.sender_name}
                </div>
              </div>
              <div>
                <div className="text-[11.5px] text-[var(--color-muted)] font-medium">
                  Canale attivo
                </div>
                <div className="mt-1 text-[var(--color-ink-soft)]">
                  {whatsapp.cloud_api_configured
                    ? 'WhatsApp Business API'
                    : `WhatsApp Web (${whatsapp.default_prefix})`}
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSaveConfig} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                <div className="sm:col-span-5">
                  <label
                    htmlFor="wa-studio-phone"
                    className="block text-[12px] font-semibold text-[var(--color-ink-soft)] mb-1.5"
                  >
                    Numero WhatsApp
                  </label>
                  <input
                    ref={phoneInputRef}
                    id="wa-studio-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    placeholder="+39 333 123 4567"
                    className="w-full min-h-[40px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white font-mono text-[13px] tabular-nums text-[var(--color-ink)]"
                  />
                </div>

                <div className="sm:col-span-5">
                  <label
                    htmlFor="wa-sender-name"
                    className="block text-[12px] font-semibold text-[var(--color-ink-soft)] mb-1.5"
                  >
                    Firma mittente
                  </label>
                  <input
                    id="wa-sender-name"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    maxLength={80}
                    placeholder="Studio Odontoiatrico"
                    className="w-full min-h-[40px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[13px] text-[var(--color-ink)]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="wa-default-prefix"
                    className="block text-[12px] font-semibold text-[var(--color-ink-soft)] mb-1.5"
                  >
                    Prefisso
                  </label>
                  <input
                    id="wa-default-prefix"
                    value={defaultPrefix}
                    onChange={(e) => setDefaultPrefix(e.target.value)}
                    required
                    placeholder="+39"
                    className="w-full min-h-[40px] px-2.5 rounded-lg border border-[var(--color-line-strong)] bg-white font-mono text-[13px] tabular-nums text-[var(--color-ink)]"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[12px] text-[var(--color-muted)] max-w-md">
                  Apre la chat WhatsApp con destinatario e testo pronti e registra l&apos;invio
                  nello storico.
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  {whatsapp.connected && (
                    <button
                      type="button"
                      onClick={() => setEditingConfig(false)}
                      className="min-h-[38px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[12.5px] font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-subtle)] whitespace-nowrap"
                    >
                      Annulla
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={savingConfig}
                    className="min-h-[38px] px-4 rounded-lg bg-[var(--color-clinical)] text-white text-[12.5px] font-semibold hover:bg-[var(--color-clinical-hover)] transition-colors disabled:opacity-60 whitespace-nowrap"
                  >
                    {savingConfig ? 'Salvataggio…' : 'Collega numero'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </section>

        {/* TextBee SMS Gateway Panel */}
        <section className="surface-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--color-line)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-[var(--color-clinical-tint)] text-[var(--color-clinical)] flex items-center justify-center shrink-0 mt-0.5">
                <Smartphone className="w-[18px] h-[18px]" />
              </div>
              <div>
                <h2 className="text-[15.5px] font-semibold text-[var(--color-ink)]">
                  Gateway SMS · TextBee
                </h2>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px]">
                  {sms.configured ? (
                    <span className="inline-flex items-center gap-1 font-medium text-[var(--color-clinical)]">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Connesso · {smsHostLabel}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-medium text-[var(--color-alert)]">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Chiave API server non configurata</span>
                    </span>
                  )}
                  <span className="text-[var(--color-muted)] tabular-nums">
                    ·{' '}
                    {sms.devices.length === 0
                      ? 'Nessun telefono abbinato'
                      : `${activeDevicesCount}/${sms.devices.length} dispositivi attivi`}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={smsLoading}
              onClick={() => void onRefreshSms()}
              className="min-h-[36px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[12.5px] font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-subtle)] transition-colors inline-flex items-center gap-1.5 disabled:opacity-60 whitespace-nowrap shrink-0 self-start sm:self-center"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${smsLoading ? 'animate-spin' : ''}`} />
              <span>{smsLoading ? 'Aggiornamento…' : 'Ricarica dispositivi'}</span>
            </button>
          </div>

          <div className="p-5 space-y-4">
            {sms.error && (
              <div className="text-[12.5px] text-[var(--color-alert)] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{sms.error}</span>
              </div>
            )}

            <form onSubmit={handleSaveDevice} className="space-y-3">
              {sms.devices.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className={availableSims.length > 1 ? 'sm:col-span-5' : 'sm:col-span-8'}>
                    <label
                      htmlFor="sms-device-select"
                      className="block text-[12px] font-semibold text-[var(--color-ink-soft)] mb-1.5"
                    >
                      Dispositivo Android TextBee
                    </label>
                    <select
                      id="sms-device-select"
                      value={deviceId}
                      onChange={(e) => setDeviceId(e.target.value)}
                      className="w-full min-h-[40px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[13px] text-[var(--color-ink)]"
                    >
                      <option value="">Automatico (primo dispositivo attivo)</option>
                      {sms.devices.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.label} {!d.enabled ? '(disabilitato)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {availableSims.length > 1 && (
                    <div className="sm:col-span-4">
                      <label
                        htmlFor="sms-sim-select"
                        className="block text-[12px] font-semibold text-[var(--color-ink-soft)] mb-1.5"
                      >
                        SIM di invio
                      </label>
                      <select
                        id="sms-sim-select"
                        value={simSubId}
                        onChange={(e) => setSimSubId(e.target.value)}
                        className="w-full min-h-[40px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[13px] text-[var(--color-ink)]"
                      >
                        <option value="">Predefinita telefono</option>
                        {availableSims.map((sim) => (
                          <option key={sim.subscriptionId} value={String(sim.subscriptionId)}>
                            SIM {sim.simSlotIndex + 1} · {sim.carrierName}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className={availableSims.length > 1 ? 'sm:col-span-3' : 'sm:col-span-4'}>
                    <button
                      type="submit"
                      disabled={savingDevice}
                      className="w-full min-h-[40px] px-4 rounded-lg bg-[var(--color-clinical)] text-white text-[12.5px] font-semibold hover:bg-[var(--color-clinical-hover)] transition-colors disabled:opacity-60 whitespace-nowrap"
                    >
                      {savingDevice ? 'Salvataggio…' : 'Salva'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-[12.5px] text-[var(--color-ink-soft)] leading-relaxed">
                    La chiave API TextBee è autenticata lato server, ma sull&apos;account non risulta
                    ancora abbinato uno smartphone Android. Installa l&apos;app{' '}
                    <span className="font-semibold text-[var(--color-ink)]">TextBee</span> sul
                    telefono dello studio, registra il dispositivo e clicca{' '}
                    <span className="font-semibold text-[var(--color-ink)]">
                      Ricarica dispositivi
                    </span>
                    .
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-8">
                      <label
                        htmlFor="sms-device-id"
                        className="block text-[12px] font-semibold text-[var(--color-ink-soft)] mb-1.5"
                      >
                        Device ID TextBee (opzionale)
                      </label>
                      <input
                        id="sms-device-id"
                        value={deviceId}
                        onChange={(e) => setDeviceId(e.target.value)}
                        placeholder="Lascia vuoto per selezione automatica"
                        className="w-full min-h-[40px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white font-mono text-[12.5px] text-[var(--color-ink)]"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <button
                        type="submit"
                        disabled={savingDevice}
                        className="w-full min-h-[40px] px-3.5 rounded-lg border border-[var(--color-line-strong)] bg-white text-[12.5px] font-semibold text-[var(--color-ink)] hover:bg-[var(--color-surface-subtle)] transition-colors disabled:opacity-60 whitespace-nowrap"
                      >
                        {savingDevice ? 'Salvataggio…' : 'Salva Device ID'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </form>

            {/* Inline Test SMS Toggle & Form */}
            <div className="pt-3 border-t border-[var(--color-line)]">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setShowSmsTest((prev) => !prev)}
                  className="min-h-[34px] text-[12.5px] font-semibold text-[var(--color-clinical)] hover:text-[var(--color-clinical-hover)] inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  <span>{showSmsTest ? 'Nascondi SMS di prova' : 'Invia SMS di prova'}</span>
                  {showSmsTest ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
                <span className="text-[11.5px] text-[var(--color-muted)]">
                  Chiave protetta lato server
                </span>
              </div>

              {showSmsTest && (
                <form onSubmit={handleSendTestSubmit} className="mt-3 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-5">
                      <label
                        htmlFor="sms-test-recipient"
                        className="block text-[11.5px] font-semibold text-[var(--color-ink-soft)] mb-1"
                      >
                        Numero destinatario
                      </label>
                      <input
                        id="sms-test-recipient"
                        type="tel"
                        required
                        value={testRecipient}
                        onChange={(e) => setTestRecipient(e.target.value)}
                        placeholder="+39 333 123 4567"
                        className="w-full min-h-[38px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white font-mono text-[12.5px] tabular-nums text-[var(--color-ink)]"
                      />
                    </div>
                    <div className="sm:col-span-7">
                      <label
                        htmlFor="sms-test-message"
                        className="block text-[11.5px] font-semibold text-[var(--color-ink-soft)] mb-1"
                      >
                        Testo SMS
                      </label>
                      <input
                        id="sms-test-message"
                        required
                        maxLength={600}
                        value={testMessage}
                        onChange={(e) => setTestMessage(e.target.value)}
                        className="w-full min-h-[38px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[12.5px] text-[var(--color-ink)]"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={!sms.configured || sendingTest}
                      className="min-h-[36px] px-4 rounded-lg bg-[var(--color-clinical)] text-white text-[12.5px] font-semibold hover:bg-[var(--color-clinical-hover)] transition-colors inline-flex items-center gap-1.5 disabled:opacity-60 whitespace-nowrap"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{sendingTest ? 'Invio SMS…' : 'Invia SMS di prova'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Outbox Queue Panel */}
      <section className="surface-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-line)] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold text-[var(--color-ink)]">
              Coda promemoria
            </h2>
            <p className="text-[12.5px] text-[var(--color-muted)] mt-0.5">
              Messaggi con link e codice monouso inviabili via SMS (TextBee) o WhatsApp
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              className="inline-flex items-center p-1 bg-[var(--color-surface-subtle)] border border-[var(--color-line)] rounded-lg"
              role="group"
              aria-label="Finestra temporale preparazione promemoria"
            >
              <button
                type="button"
                onClick={() => setWindowMode('24h')}
                className={`px-2.5 py-1.5 text-[12px] font-medium rounded-md transition-all whitespace-nowrap ${
                  windowMode === '24h'
                    ? 'bg-white text-[var(--color-ink)] shadow-[0_1px_2px_rgba(15,23,42,0.08)]'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                }`}
              >
                Finestra 24h
              </button>
              <button
                type="button"
                onClick={() => setWindowMode('48h')}
                className={`px-2.5 py-1.5 text-[12px] font-medium rounded-md transition-all whitespace-nowrap ${
                  windowMode === '48h'
                    ? 'bg-white text-[var(--color-ink)] shadow-[0_1px_2px_rgba(15,23,42,0.08)]'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                }`}
              >
                Prossime 48h
              </button>
            </div>

            <button
              type="button"
              disabled={running}
              onClick={handleRun}
              className="min-h-[38px] px-4 rounded-lg bg-[var(--color-clinical)] text-white text-[12.5px] font-semibold hover:bg-[var(--color-clinical-hover)] transition-colors inline-flex items-center gap-2 disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
              <span>{running ? 'Controllo…' : 'Prepara promemoria ora'}</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse">
            <thead>
              <tr className="bg-[var(--color-surface-subtle)] border-b border-[var(--color-line)]">
                <th className="px-5 py-3 text-left text-[11.5px] font-semibold text-[var(--color-muted)]">
                  Cliente e appuntamento
                </th>
                <th className="px-5 py-3 text-left text-[11.5px] font-semibold text-[var(--color-muted)]">
                  Destinatario
                </th>
                <th className="px-5 py-3 text-left text-[11.5px] font-semibold text-[var(--color-muted)]">
                  Stato
                </th>
                <th className="px-5 py-3 text-right text-[11.5px] font-semibold text-[var(--color-muted)]">
                  Azioni messaggio
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reminders.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <Mail className="w-8 h-8 text-[var(--color-line-strong)] mx-auto mb-2.5" />
                    <div className="text-[14px] font-semibold text-[var(--color-ink)]">
                      Nessun promemoria nella coda
                    </div>
                    <p className="text-[12.5px] text-[var(--color-muted)] mt-1 max-w-md mx-auto">
                      La routine automatica controlla ogni 15 minuti gli appuntamenti a 24 ore.
                      Seleziona «Prossime 48h» e clicca «Prepara promemoria ora» per generare subito
                      i messaggi degli appuntamenti imminenti.
                    </p>
                  </td>
                </tr>
              ) : (
                reminders.map((m) => {
                  const isSentViaSms = m.status === 'sent' && m.sent_via === 'textbee_sms';
                  const baseMeta = STATUS_META[m.status] || STATUS_META.prepared;
                  const statusLabel = isSentViaSms ? 'Inviato via SMS' : baseMeta.label;
                  const StatusIcon = isSentViaSms ? Smartphone : baseMeta.icon;
                  const code = extractConfirmationCode(m.body);
                  const isExpanded = expandedId === m.id;
                  const isCopied = copiedId === m.id;
                  const canSend = m.status === 'prepared' || m.status === 'sent';
                  const isSendingWa = sendingWaId === m.id;
                  const isSendingSms = sendingSmsId === m.id;

                  return (
                    <tr
                      key={m.id}
                      className="hover:bg-[var(--color-surface-subtle)]/40 transition-colors"
                    >
                      <td className="px-5 py-4 align-top">
                        <div className="text-[13.5px] font-semibold text-[var(--color-ink)]">
                          {m.patient}
                        </div>
                        <div className="text-[12px] text-[var(--color-muted)] mt-0.5 tabular-nums">
                          {m.procedure} ·{' '}
                          {fmtDate(m.starts_at, {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                        {isExpanded && (
                          <div className="mt-3 p-3 rounded-lg bg-[var(--color-surface-subtle)] border border-[var(--color-line)] text-[12px] text-[var(--color-ink-soft)] leading-relaxed whitespace-pre-wrap max-w-xl">
                            {m.body}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4 align-top font-mono text-[12.5px] text-[var(--color-ink-soft)] tabular-nums whitespace-nowrap">
                        {m.recipient}
                      </td>

                      <td className="px-5 py-4 align-top">
                        <div
                          className={`inline-flex items-center gap-1.5 text-[12.5px] font-semibold ${baseMeta.colorClass}`}
                        >
                          <StatusIcon className="w-4 h-4 shrink-0" />
                          <span>{statusLabel}</span>
                        </div>
                        {m.sent_at && (
                          <div className="text-[11px] text-[var(--color-muted)] mt-0.5 tabular-nums">
                            Inviato alle {fmtTime(m.sent_at)}
                            {m.sent_from ? ` · ${m.sent_from}` : ''}
                          </div>
                        )}
                        {code && (
                          <div className="font-mono text-[11px] text-[var(--color-muted)] mt-0.5">
                            Codice: {code}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4 align-top text-right">
                        <div className="inline-flex items-center justify-end gap-2 flex-wrap">
                          {canSend && (
                            <button
                              type="button"
                              disabled={!sms.configured || isSendingSms}
                              onClick={() => handleSendSms(m.id)}
                              className={`min-h-[34px] px-3.5 rounded-lg text-[12px] font-semibold transition-colors inline-flex items-center gap-1.5 disabled:opacity-55 whitespace-nowrap shrink-0 ${
                                isSentViaSms
                                  ? 'border border-[var(--color-line-strong)] bg-white text-[var(--color-clinical)] hover:bg-[var(--color-clinical-tint)]/50'
                                  : 'bg-[var(--color-clinical)] text-white hover:bg-[var(--color-clinical-hover)]'
                              }`}
                            >
                              <Smartphone className="w-3.5 h-3.5" />
                              <span>
                                {isSendingSms
                                  ? 'Invio SMS…'
                                  : isSentViaSms
                                    ? 'Reinvia SMS'
                                    : 'Invia SMS'}
                              </span>
                            </button>
                          )}

                          {canSend &&
                            (!whatsapp.connected ? (
                              <button
                                type="button"
                                onClick={focusWhatsAppSetup}
                                className="min-h-[34px] px-3 rounded-lg border border-[var(--color-clinical)]/40 bg-[var(--color-clinical-tint)]/55 text-[12px] font-semibold text-[var(--color-clinical)] hover:bg-[var(--color-clinical-tint)] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>Collega WhatsApp</span>
                              </button>
                            ) : whatsapp.cloud_api_configured ? (
                              <button
                                type="button"
                                disabled={isSendingWa}
                                onClick={() => handleSendWa(m.id)}
                                className="min-h-[34px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[12px] font-semibold text-[var(--color-clinical)] hover:bg-[var(--color-clinical-tint)]/50 transition-colors inline-flex items-center gap-1.5 disabled:opacity-60 whitespace-nowrap shrink-0"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>
                                  {isSendingWa
                                    ? 'Invio…'
                                    : m.status === 'sent' && !isSentViaSms
                                      ? 'Reinvia WhatsApp'
                                      : 'WhatsApp'}
                                </span>
                              </button>
                            ) : (
                              <a
                                href={m.wa_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => {
                                  void handleSendWa(m.id);
                                }}
                                className="min-h-[34px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[12px] font-semibold text-[var(--color-clinical)] hover:bg-[var(--color-clinical-tint)]/50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>
                                  {m.status === 'sent' && !isSentViaSms
                                    ? 'Reinvia WhatsApp'
                                    : 'WhatsApp'}
                                </span>
                              </a>
                            ))}

                          <button
                            type="button"
                            onClick={() => handleCopy(m)}
                            className="min-h-[34px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[12px] font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-subtle)] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-[var(--color-clinical)]" />
                                <span>Copiato</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copia</span>
                              </>
                            )}
                          </button>

                          {code && (m.status === 'prepared' || m.status === 'sent') && (
                            <button
                              type="button"
                              onClick={() => onOpenPublicConfirm(code)}
                              className="min-h-[34px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[12px] font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-clinical)] hover:bg-[var(--color-surface-subtle)] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Apri conferma</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : m.id)}
                            className="min-h-[34px] px-2 rounded-lg text-[12px] font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)] inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                          >
                            <span>Testo</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
