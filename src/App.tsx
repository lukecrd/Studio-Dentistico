import { useCallback, useEffect, useState } from 'react';
import { Calendar, Plus, CheckCircle2, AlertCircle } from 'lucide-react';
import type {
  AgendaData,
  AgendaFilters,
  AuditEvent,
  BookingPrefill,
  CancellationItem,
  CatalogData,
  PageKey,
  Proposal,
  ReminderMessage,
  SmsConfig,
  User,
  ViewMode,
  WhatsAppConfig,
} from './types';
import { api, dateISO, mondayOfWeek, plusDays, setStoredToken } from './api';
import { Sidebar } from './components/Sidebar';
import { AgendaView } from './components/AgendaView';
import { CancellationsView } from './components/CancellationsView';
import { NewAppointmentDrawer } from './components/NewAppointmentDrawer';
import { PatientsView } from './components/PatientsView';
import { ProceduresView } from './components/ProceduresView';
import { TeamView } from './components/TeamView';
import { ProposalsView } from './components/ProposalsView';
import { RemindersView } from './components/RemindersView';
import { RoomsView } from './components/RoomsView';
import { AuditView } from './components/AuditView';
import { LoginView } from './components/LoginView';
import { PublicConfirmationView } from './components/PublicConfirmationView';
import { PublicProposalView } from './components/PublicProposalView';

const PAGE_TITLES: Record<PageKey, { title: string; subtitle: string }> = {
  agenda: { title: 'Agenda condivisa', subtitle: 'Calendario clinico per professionista e poltrona' },
  cancellations: {
    title: 'Disdette e rimpiazzi',
    subtitle: 'Elenco appuntamenti annullati e sostituzione immediata degli slot liberi',
  },
  proposals: { title: 'Proposte di anticipo', subtitle: 'Recupero disdette con approvazione segreteria' },
  reminders: { title: 'Promemoria 24 ore', subtitle: 'Coda messaggi in uscita e link di conferma' },
  patients: { title: 'Clienti', subtitle: 'Anagrafica pazienti e recapiti' },
  procedures: { title: 'Trattamenti', subtitle: 'Catalogo prestazioni, durate e attrezzature' },
  team: { title: 'Professionisti', subtitle: 'Team clinico e abilitazioni operative' },
  rooms: { title: 'Stanze e poltrone', subtitle: 'Gestione sale operative e dotazioni' },
  audit: { title: 'Registro attività', subtitle: 'Tracciabilità cronologica delle operazioni' },
};

interface ToastItem {
  id: number;
  message: string;
  tone: 'success' | 'error';
}

export default function App() {
  const [publicMode, setPublicMode] = useState<{
    mode: 'none' | 'confirm' | 'proposal';
    code: string;
  }>(() => {
    const params = new URLSearchParams(window.location.search);
    if (window.location.pathname === '/anticipo' || params.has('proposal')) {
      return { mode: 'proposal', code: params.get('proposal') || '' };
    }
    if (window.location.pathname === '/conferma' || params.has('confirm')) {
      return { mode: 'confirm', code: params.get('confirm') || '' };
    }
    return { mode: 'none', code: '' };
  });

  const [booting, setBooting] = useState(publicMode.mode === 'none');
  const [user, setUser] = useState<User | null>(null);
  const [page, setPage] = useState<PageKey>('agenda');
  const [date, setDate] = useState<Date>(() => new Date());
  const [view, setView] = useState<ViewMode>('day');
  const [filters, setFilters] = useState<AgendaFilters>({
    professional: '',
    chair: '',
    procedure: '',
  });

  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [agenda, setAgenda] = useState<AgendaData | null>(null);
  const [cancellations, setCancellations] = useState<CancellationItem[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [reminders, setReminders] = useState<ReminderMessage[]>([]);
  const [whatsapp, setWhatsapp] = useState<WhatsAppConfig>({
    connected: false,
    phone: '',
    sender_name: 'Studio Odontoiatrico',
    default_prefix: '+39',
    cloud_api_configured: false,
    updated_at: null,
  });
  const [sms, setSms] = useState<SmsConfig>({
    configured: false,
    base_url: 'https://api.textbee.dev/api/v1',
    device_id: '',
    sim_subscription_id: null,
    devices: [],
    error: null,
  });
  const [smsLoading, setSmsLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  const [bookingDrawerOpen, setBookingDrawerOpen] = useState(false);
  const [bookingPrefill, setBookingPrefill] = useState<BookingPrefill | undefined>(undefined);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, tone: 'success' | 'error' = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3400);
  }, []);

  const loadWorkspaceData = useCallback(async (targetDate: Date, targetView: ViewMode) => {
    setLoadingData(true);
    try {
      const from =
        targetView === 'week' ? dateISO(mondayOfWeek(targetDate)) : dateISO(targetDate);
      const to =
        targetView === 'week' ? dateISO(plusDays(mondayOfWeek(targetDate), 6)) : from;

      const [catalogRes, agendaRes, cancellationsRes, proposalsRes, auditRes, remindersRes] =
        await Promise.all([
          api<CatalogData>('/api/catalog'),
          api<AgendaData>(`/api/agenda?from=${from}&to=${to}`),
          api<{ cancellations: CancellationItem[] }>('/api/cancellations'),
          api<{ proposals: Proposal[] }>('/api/proposals'),
          api<{ events: AuditEvent[] }>('/api/audit'),
          api<{
            messages: ReminderMessage[];
            whatsapp: WhatsAppConfig;
            sms?: {
              configured: boolean;
              base_url: string;
              device_id: string;
              sim_subscription_id: number | null;
            };
          }>('/api/reminders'),
        ]);

      setCatalog(catalogRes);
      setAgenda(agendaRes);
      setCancellations(cancellationsRes.cancellations);
      setProposals(proposalsRes.proposals);
      setAudit(auditRes.events);
      setReminders(remindersRes.messages);
      if (remindersRes.whatsapp) {
        setWhatsapp(remindersRes.whatsapp);
      }
      if (remindersRes.sms) {
        setSms((prev) => ({
          ...prev,
          configured: remindersRes.sms!.configured,
          base_url: remindersRes.sms!.base_url,
          device_id: remindersRes.sms!.device_id,
          sim_subscription_id: remindersRes.sms!.sim_subscription_id ?? null,
        }));
      }
    } finally {
      setLoadingData(false);
    }
  }, []);

  const loadSmsConfig = useCallback(async () => {
    setSmsLoading(true);
    try {
      const res = await api<{ sms: SmsConfig }>('/api/sms/config');
      if (res.sms) {
        setSms(res.sms);
      }
    } catch (err) {
      setSms((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Impossibile verificare TextBee',
      }));
    } finally {
      setSmsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (publicMode.mode !== 'none') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api<{ user: User | null }>('/api/me');
        if (cancelled) return;
        setUser(res.user);
        if (res.user) {
          await loadWorkspaceData(date, view);
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publicMode.mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user && page === 'reminders') {
      void loadSmsConfig();
    }
  }, [user, page, loadSmsConfig]);

  const refreshData = useCallback(
    async (nextDate = date, nextView = view) => {
      await loadWorkspaceData(nextDate, nextView);
    },
    [date, view, loadWorkspaceData]
  );

  const handleLogin = async (username: string, password: string) => {
    const res = await api<{ username: string; role: string; token?: string }>('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (res.token) {
      setStoredToken(res.token);
    }
    setUser({ username: res.username, role: res.role });
    await loadWorkspaceData(date, view);
  };

  const handleLogout = async () => {
    try {
      await api('/api/logout', { method: 'POST' });
    } catch {
      // clear local state regardless
    }
    setStoredToken(null);
    setUser(null);
    setCatalog(null);
    setAgenda(null);
  };

  const handleDateChange = async (nextDate: Date) => {
    setDate(nextDate);
    await loadWorkspaceData(nextDate, view);
  };

  const handleViewChange = async (nextView: ViewMode) => {
    setView(nextView);
    await loadWorkspaceData(date, nextView);
  };

  const handleShiftDate = async (delta: number) => {
    const next = plusDays(date, delta * (view === 'week' ? 7 : 1));
    await handleDateChange(next);
  };

  const handleCreateAppointment = async (payload: {
    patient_id: number;
    procedure_id: number;
    professional_id: number;
    chair_id: number;
    starts_at: string;
  }) => {
    await api('/api/appointments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    showToast('Appuntamento aggiunto in agenda');
    await refreshData();
  };

  const handleCancelAppointment = async (id: number) => {
    try {
      const res = await api<{ proposals: unknown[] }>(`/api/appointments/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ offer: true }),
      });
      await refreshData();
      setPage('cancellations');
      showToast(
        res.proposals.length
          ? `Disdetta registrata: slot libero con ${res.proposals.length} candidati compatibili`
          : 'Disdetta registrata: lo slot è ora disponibile per il rimpiazzo'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Impossibile annullare', 'error');
    }
  };

  const handleReplaceCancellationWithExisting = async (
    freedAppointmentId: number,
    targetAppointmentId: number,
    sendSms = false
  ) => {
    try {
      const res = await api<{ ok: boolean; sms_sent?: boolean; sms_error?: string | null }>(
        `/api/cancellations/${freedAppointmentId}/replace`,
        {
          method: 'POST',
          body: JSON.stringify({ appointment_id: targetAppointmentId, send_sms: sendSms }),
        }
      );
      if (sendSms) {
        if (res.sms_sent) {
          showToast('Slot rimpiazzato e SMS di conferma spostamento inviato');
        } else {
          showToast(
            `Slot rimpiazzato, ma SMS non inviato${res.sms_error ? `: ${res.sms_error}` : ''}`,
            'error'
          );
        }
      } else {
        showToast('Slot disdetto rimpiazzato e agenda aggiornata');
      }
      await refreshData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Impossibile rimpiazzare lo slot', 'error');
    }
  };

  const handleProposalAction = async (
    proposalId: number,
    action: 'accept' | 'decline' | 'approve' | 'reject',
    options?: { sendSms?: boolean }
  ) => {
    try {
      const res = await api<{ state: string; sms_sent?: boolean; sms_error?: string | null }>(
        `/api/proposals/${proposalId}/${action}`,
        {
          method: 'POST',
          body: JSON.stringify({ send_sms: Boolean(options?.sendSms) }),
        }
      );
      if (action === 'approve' && options?.sendSms) {
        if (res.sms_sent) {
          showToast('Appuntamento anticipato e SMS di conferma inviato');
        } else {
          showToast(
            `Appuntamento anticipato, ma SMS non inviato${res.sms_error ? `: ${res.sms_error}` : ''}`,
            'error'
          );
        }
      } else {
        showToast(action === 'approve' ? 'Appuntamento anticipato e spostato' : 'Stato aggiornato');
      }
      await refreshData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Operazione non riuscita', 'error');
    }
  };

  const handleSendProposalSms = async (proposalId: number) => {
    try {
      await api(`/api/proposals/${proposalId}/send-sms`, {
        method: 'POST',
        body: '{}',
      });
      showToast('SMS proposta di anticipo inviato al paziente');
      await refreshData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Invio SMS proposta non riuscito', 'error');
    }
  };

  const handleSendMoveSms = async (appointmentId: number) => {
    try {
      await api(`/api/appointments/${appointmentId}/send-move-sms`, {
        method: 'POST',
        body: '{}',
      });
      showToast('SMS di conferma spostamento inviato al paziente');
      await refreshData();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Invio SMS di conferma non riuscito',
        'error'
      );
    }
  };

  const handleCreatePatient = async (payload: { name: string; phone: string; notes: string }) => {
    try {
      await api('/api/patients', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Cliente aggiunto in anagrafica');
      await refreshData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Errore salvataggio cliente', 'error');
      throw err;
    }
  };

  const handleUpdatePatient = async (
    id: number,
    payload: { name: string; phone: string; notes: string }
  ) => {
    try {
      await api(`/api/patients/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Scheda cliente aggiornata');
      await refreshData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Errore aggiornamento cliente', 'error');
      throw err;
    }
  };

  const handleDeletePatient = async (id: number) => {
    try {
      const res = await api<{ ok: boolean; removed_appointments?: number }>(
        `/api/patients/${id}`,
        { method: 'DELETE' }
      );
      showToast(
        res.removed_appointments
          ? `Cliente eliminato (${res.removed_appointments} appuntamenti collegati rimossi)`
          : 'Cliente eliminato dall’anagrafica'
      );
      await refreshData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Impossibile eliminare il cliente', 'error');
    }
  };

  const handleCreateProcedure = async (payload: {
    name: string;
    duration: number;
    specialty: string;
    resources: string[];
  }) => {
    try {
      await api('/api/procedures', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Trattamento aggiunto al catalogo');
      await refreshData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Errore salvataggio trattamento', 'error');
      throw err;
    }
  };

  const handleUpdateProcedure = async (
    id: number,
    payload: { name: string; duration: number; specialty: string; resources: string[] }
  ) => {
    try {
      await api(`/api/procedures/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Trattamento aggiornato');
      await refreshData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Errore aggiornamento trattamento', 'error');
      throw err;
    }
  };

  const handleDeleteProcedure = async (id: number) => {
    try {
      await api(`/api/procedures/${id}`, { method: 'DELETE' });
      showToast('Trattamento eliminato dal catalogo');
      await refreshData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Impossibile eliminare il trattamento', 'error');
    }
  };

  const handleCreateProfessional = async (payload: {
    name: string;
    specialty: string;
    color: string;
    procedure_ids: number[];
  }) => {
    try {
      await api('/api/professionals', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Professionista aggiunto al team');
      await refreshData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Errore salvataggio professionista', 'error');
      throw err;
    }
  };

  const handleUpdateProfessional = async (
    id: number,
    payload: { name: string; specialty: string; color: string; procedure_ids: number[] }
  ) => {
    try {
      await api(`/api/professionals/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Scheda professionista aggiornata');
      await refreshData();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Errore aggiornamento professionista',
        'error'
      );
      throw err;
    }
  };

  const handleDeleteProfessional = async (id: number) => {
    try {
      await api(`/api/professionals/${id}`, { method: 'DELETE' });
      showToast('Professionista rimosso dal team');
      await refreshData();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Impossibile eliminare il professionista',
        'error'
      );
    }
  };

  const handleCreateChair = async (payload: { name: string; resources: string[] }) => {
    try {
      await api('/api/chairs', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Stanza aggiunta');
      await refreshData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Errore salvataggio stanza', 'error');
      throw err;
    }
  };

  const handleDeleteChair = async (id: number) => {
    try {
      await api(`/api/chairs/${id}`, { method: 'DELETE' });
      showToast('Stanza rimossa');
      await refreshData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Impossibile rimuovere la stanza', 'error');
    }
  };

  const handlePrepareReminders = async (windowMode: '24h' | '48h' = '24h') => {
    try {
      const res = await api<{ prepared: number }>('/api/reminders/run', {
        method: 'POST',
        body: JSON.stringify({ window: windowMode }),
      });
      showToast(
        res.prepared > 0
          ? `${res.prepared} promemoria preparati nella coda`
          : windowMode === '48h'
            ? 'Nessun nuovo appuntamento nelle prossime 48 ore'
            : 'Nessun nuovo appuntamento nella finestra 23–25 ore'
      );
      await refreshData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Errore preparazione promemoria', 'error');
    }
  };

  const handleSaveWhatsApp = async (payload: {
    phone: string;
    sender_name: string;
    default_prefix: string;
  }) => {
    try {
      const res = await api<{ whatsapp: WhatsAppConfig }>('/api/whatsapp/config', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setWhatsapp(res.whatsapp);
      showToast(`Numero WhatsApp ${res.whatsapp.phone} collegato`);
      await refreshData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Impossibile salvare il numero', 'error');
      throw err;
    }
  };

  const handleDisconnectWhatsApp = async () => {
    try {
      const res = await api<{ whatsapp: WhatsAppConfig }>('/api/whatsapp/config', {
        method: 'DELETE',
      });
      setWhatsapp(res.whatsapp);
      showToast('Numero WhatsApp scollegato');
      await refreshData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Errore scollegamento WhatsApp', 'error');
    }
  };

  const handleSendReminderWhatsApp = async (reminderId: number) => {
    try {
      const res = await api<{ ok: boolean; mode: string }>(`/api/reminders/${reminderId}/send`, {
        method: 'POST',
        body: '{}',
      });
      showToast(
        res.mode === 'cloud_api'
          ? 'Promemoria inviato tramite WhatsApp Business API'
          : 'Invio su WhatsApp registrato'
      );
      await refreshData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Invio WhatsApp non riuscito', 'error');
    }
  };

  const handleSaveSmsDevice = async (payload: {
    device_id: string;
    sim_subscription_id: number | null;
  }) => {
    try {
      const res = await api<{ sms: SmsConfig }>('/api/sms/config', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setSms(res.sms);
      showToast('Impostazioni dispositivo SMS TextBee salvate');
      await refreshData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Errore salvataggio dispositivo SMS', 'error');
    }
  };

  const handleSendSmsTest = async (payload: {
    recipient: string;
    message: string;
    device_id?: string;
    sim_subscription_id?: number | null;
  }) => {
    try {
      await api('/api/sms/test', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showToast(`SMS di prova inviato a ${payload.recipient}`);
      await refreshData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Invio SMS di prova non riuscito', 'error');
      throw err;
    }
  };

  const handleSendReminderSms = async (reminderId: number) => {
    try {
      await api(`/api/reminders/${reminderId}/send-sms`, {
        method: 'POST',
        body: '{}',
      });
      showToast('Promemoria inviato via SMS tramite TextBee');
      await refreshData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Invio SMS non riuscito', 'error');
    }
  };

  const openPublicPortal = (code = '') => {
    setPublicMode({ mode: 'confirm', code });
  };

  const openPublicProposal = (code = '') => {
    setPublicMode({ mode: 'proposal', code });
  };

  const exitPublicPortal = () => {
    if (
      window.location.pathname === '/conferma' ||
      window.location.pathname === '/anticipo' ||
      window.location.search.includes('confirm=') ||
      window.location.search.includes('proposal=')
    ) {
      window.history.replaceState({}, '', '/');
    }
    setPublicMode({ mode: 'none', code: '' });
    if (user) {
      refreshData();
    } else {
      setBooting(true);
    }
  };

  if (publicMode.mode === 'confirm') {
    return (
      <PublicConfirmationView
        initialCode={publicMode.code}
        onExitPortal={exitPublicPortal}
      />
    );
  }

  if (publicMode.mode === 'proposal') {
    return (
      <PublicProposalView
        initialCode={publicMode.code}
        onExitPortal={exitPublicPortal}
      />
    );
  }

  if (booting) {
    return (
      <div className="min-h-screen bg-[var(--color-canvas)] flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <div className="font-[var(--font-display)] text-[18px] font-bold text-[var(--color-ink)]">
            AgendaSmart
          </div>
          <div className="text-[13px] text-[var(--color-muted)]">Caricamento studio…</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView onLogin={handleLogin} onOpenPublicPortal={() => openPublicPortal('')} />;
  }

  const openCancellationsCount = cancellations.filter((c) => c.slot_status === 'free').length;
  const pendingApprovalCount = proposals.filter(
    (p) => p.state === 'accepted_waiting_approval'
  ).length;
  const preparedRemindersCount = reminders.filter((r) => r.status === 'prepared').length;
  const headerInfo = PAGE_TITLES[page];

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-ink)]">
      <Sidebar
        currentPage={page}
        onNavigate={setPage}
        user={user}
        openCancellationsCount={openCancellationsCount}
        pendingApprovalCount={pendingApprovalCount}
        preparedRemindersCount={preparedRemindersCount}
        onLogout={handleLogout}
      />

      <main className="lg:pl-[256px] min-h-screen pb-24 lg:pb-12">
        {/* Clean Full-Width Frosted Workspace Header */}
        <header className="lg:sticky lg:top-0 z-20 bg-white/90 backdrop-blur-md border-b border-[var(--color-line)]">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-7 lg:px-9 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--color-muted)]">
                <span>AgendaSmart</span>
                <span aria-hidden="true">/</span>
                <span className="text-[var(--color-clinical)]">{headerInfo.title}</span>
              </div>
              <h1 className="text-[22px] sm:text-[24px] font-bold tracking-[-0.025em] text-[var(--color-ink)] leading-tight mt-0.5">
                {headerInfo.title}
              </h1>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <label className="min-h-[40px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white inline-flex items-center gap-2 text-[13px] text-[var(--color-ink-soft)] hover:border-slate-400 focus-within:border-[var(--color-clinical)] focus-within:ring-2 focus-within:ring-[var(--color-clinical)]/15 transition-all">
                <Calendar className="w-4 h-4 text-[var(--color-muted)] shrink-0" />
                <input
                  type="date"
                  value={dateISO(date)}
                  onChange={(e) => {
                    if (e.target.value) {
                      handleDateChange(new Date(`${e.target.value}T12:00:00`));
                    }
                  }}
                  aria-label="Seleziona data agenda"
                  className="bg-transparent border-0 outline-0 font-mono text-[12.5px] text-[var(--color-ink)] tabular-nums w-[122px]"
                />
              </label>

              <button
                type="button"
                onClick={() => {
                  setBookingPrefill({ dateISO: dateISO(date), hour: 9 });
                  setBookingDrawerOpen(true);
                }}
                className="min-h-[40px] px-4 rounded-lg bg-[var(--color-clinical)] text-white text-[13px] font-semibold hover:bg-[var(--color-clinical-hover)] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-[0_1px_2px_rgba(15,118,110,0.22)]"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>Nuovo appuntamento</span>
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-[1440px] mx-auto px-4 sm:px-7 lg:px-9 py-6 lg:py-7">
          {/* Content Area */}
          {!catalog || !agenda ? (
            <div className="space-y-5">
              <div className="h-[92px] rounded-xl bg-white border border-[var(--color-line)] animate-pulse" />
              <div className="h-[520px] rounded-xl bg-white border border-[var(--color-line)] animate-pulse" />
            </div>
          ) : (
            <div
              className={
                loadingData
                  ? 'opacity-70 transition-opacity duration-150'
                  : 'transition-opacity duration-150'
              }
            >
              {page === 'agenda' && (
                <AgendaView
                  date={date}
                  view={view}
                  filters={filters}
                  agenda={agenda}
                  catalog={catalog}
                  proposals={proposals}
                  onChangeView={handleViewChange}
                  onShiftDate={handleShiftDate}
                  onGoToday={() => handleDateChange(new Date())}
                  onChangeFilters={setFilters}
                  onOpenNewBooking={(prefill) => {
                    setBookingPrefill(prefill);
                    setBookingDrawerOpen(true);
                  }}
                  onCancelAppointment={handleCancelAppointment}
                  onNavigateToProposals={() => setPage('proposals')}
                />
              )}

              {page === 'cancellations' && (
                <CancellationsView
                  cancellations={cancellations}
                  smsConfigured={sms.configured}
                  onReplaceWithExisting={handleReplaceCancellationWithExisting}
                  onSendMoveSms={handleSendMoveSms}
                  onReplaceWithNew={(prefill) => {
                    setBookingPrefill(prefill);
                    setBookingDrawerOpen(true);
                  }}
                  onGoToAgenda={() => setPage('agenda')}
                />
              )}

              {page === 'proposals' && (
                <ProposalsView
                  proposals={proposals}
                  smsConfigured={sms.configured}
                  onProposalAction={handleProposalAction}
                  onSendProposalSms={handleSendProposalSms}
                  onSendMoveSms={handleSendMoveSms}
                  onOpenPublicProposal={(code) => openPublicProposal(code)}
                />
              )}

              {page === 'reminders' && (
                <RemindersView
                  reminders={reminders}
                  whatsapp={whatsapp}
                  sms={sms}
                  smsLoading={smsLoading}
                  onSaveWhatsApp={handleSaveWhatsApp}
                  onDisconnectWhatsApp={handleDisconnectWhatsApp}
                  onRefreshSms={loadSmsConfig}
                  onSaveSmsDevice={handleSaveSmsDevice}
                  onSendSmsTest={handleSendSmsTest}
                  onPrepareNow={handlePrepareReminders}
                  onSendWhatsApp={handleSendReminderWhatsApp}
                  onSendReminderSms={handleSendReminderSms}
                  onCopySuccess={(msg) => showToast(msg)}
                  onOpenPublicConfirm={(code) => openPublicPortal(code)}
                />
              )}

              {page === 'patients' && (
                <PatientsView
                  patients={catalog.patients}
                  onCreatePatient={handleCreatePatient}
                  onUpdatePatient={handleUpdatePatient}
                  onDeletePatient={handleDeletePatient}
                />
              )}

              {page === 'procedures' && (
                <ProceduresView
                  procedures={catalog.procedures}
                  chairs={catalog.chairs}
                  onCreateProcedure={handleCreateProcedure}
                  onUpdateProcedure={handleUpdateProcedure}
                  onDeleteProcedure={handleDeleteProcedure}
                />
              )}

              {page === 'team' && (
                <TeamView
                  professionals={catalog.professionals}
                  procedures={catalog.procedures}
                  onCreateProfessional={handleCreateProfessional}
                  onUpdateProfessional={handleUpdateProfessional}
                  onDeleteProfessional={handleDeleteProfessional}
                />
              )}

              {page === 'rooms' && (
                <RoomsView
                  chairs={catalog.chairs}
                  onCreateChair={handleCreateChair}
                  onDeleteChair={handleDeleteChair}
                />
              )}

              {page === 'audit' && <AuditView events={audit} />}
            </div>
          )}
        </div>
      </main>

      {/* Slide-Over New Appointment Drawer */}
      {catalog && (
        <NewAppointmentDrawer
          open={bookingDrawerOpen}
          prefill={bookingPrefill}
          defaultDate={date}
          catalog={catalog}
          onClose={() => setBookingDrawerOpen(false)}
          onSubmit={handleCreateAppointment}
        />
      )}

      {/* Non-Blocking Toast Stack */}
      <div
        className="fixed right-5 bottom-20 lg:bottom-6 z-50 flex flex-col gap-2 pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto max-w-[390px] px-4 py-3 rounded-xl shadow-[0_10px_30px_rgba(15,23,42,0.18)] border text-[13px] font-medium flex items-center gap-2.5 animate-scale-in ${
              toast.tone === 'error'
                ? 'bg-[#2a1215] border-red-900/60 text-white'
                : 'bg-[#0f172a] border-slate-700/80 text-white'
            }`}
          >
            {toast.tone === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
