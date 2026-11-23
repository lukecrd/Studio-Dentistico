import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CheckCircle2,
  Clock,
  X,
  RotateCcw,
  AlertTriangle,
  Phone,
  DoorOpen,
  UserCheck,
  CalendarDays,
  Download,
  Printer,
} from 'lucide-react';
import type {
  AgendaData,
  AgendaFilters,
  Appointment,
  BookingPrefill,
  CatalogData,
  Proposal,
  ViewMode,
} from '../types';
import {
  dateISO,
  downloadCsv,
  fmtDate,
  fmtTime,
  fmtTimeRange,
  initials,
  mondayOfWeek,
  plusDays,
} from '../api';

interface AgendaViewProps {
  date: Date;
  view: ViewMode;
  filters: AgendaFilters;
  agenda: AgendaData;
  catalog: CatalogData;
  proposals: Proposal[];
  onChangeView: (view: ViewMode) => void;
  onShiftDate: (delta: number) => void;
  onGoToday: () => void;
  onChangeFilters: (next: AgendaFilters) => void;
  onOpenNewBooking: (prefill?: BookingPrefill) => void;
  onCancelAppointment: (appointmentId: number) => Promise<void>;
  onNavigateToProposals: () => void;
}

const HOURS = Array.from({ length: 10 }, (_, i) => 8 + i); // 08:00 - 17:00

export function AgendaView({
  date,
  view,
  filters,
  agenda,
  catalog,
  proposals,
  onChangeView,
  onShiftDate,
  onGoToday,
  onChangeFilters,
  onOpenNewBooking,
  onCancelAppointment,
  onNavigateToProposals,
}: AgendaViewProps) {
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryGroupBy, setSummaryGroupBy] = useState<'professional' | 'chair'>('professional');

  useEffect(() => {
    if (!summaryOpen) {
      document.body.classList.remove('printing-summary');
    }
    return () => {
      document.body.classList.remove('printing-summary');
    };
  }, [summaryOpen]);

  const allAppointments = agenda.appointments || [];
  const weekStart = useMemo(() => mondayOfWeek(date), [date]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => plusDays(weekStart, i)),
    [weekStart]
  );

  const visibleProfessionals = useMemo(
    () =>
      catalog.professionals.filter(
        (p) => !filters.professional || String(p.id) === filters.professional
      ),
    [catalog.professionals, filters.professional]
  );

  const filteredAppointments = useMemo(
    () =>
      allAppointments.filter(
        (a) =>
          (!filters.professional || String(a.professional_id) === filters.professional) &&
          (!filters.chair || String(a.chair_id) === filters.chair) &&
          (!filters.procedure || String(a.procedure_id) === filters.procedure)
      ),
    [allAppointments, filters]
  );

  const hasActiveFilters = Boolean(filters.professional || filters.chair || filters.procedure);

  const uniquePatients = useMemo(
    () => new Set(filteredAppointments.map((a) => a.patient_id)).size,
    [filteredAppointments]
  );

  const pendingApprovals = useMemo(
    () => proposals.filter((p) => p.state === 'accepted_waiting_approval').length,
    [proposals]
  );

  const confirmedCount = useMemo(
    () => filteredAppointments.filter((a) => a.confirmation_state === 'confirmed').length,
    [filteredAppointments]
  );

  const todayISO = dateISO(new Date());

  const rangeLabel =
    view === 'week'
      ? `${fmtDate(weekStart, { day: 'numeric', month: 'long' })} – ${fmtDate(weekDays[6], {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}`
      : fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const handleConfirmCancel = async () => {
    if (!selectedAppointment) return;
    setCancelling(true);
    try {
      await onCancelAppointment(selectedAppointment.id);
      setSelectedAppointment(null);
      setConfirmingCancel(false);
    } finally {
      setCancelling(false);
    }
  };

  const sortedFilteredAppointments = useMemo(
    () =>
      [...filteredAppointments].sort(
        (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
      ),
    [filteredAppointments]
  );

  const summaryGroups = useMemo(() => {
    if (summaryGroupBy === 'professional') {
      const groups = visibleProfessionals.map((prof) => ({
        id: `prof-${prof.id}`,
        title: prof.name,
        subtitle: prof.specialty,
        accent: prof.color,
        items: sortedFilteredAppointments.filter((a) => a.professional_id === prof.id),
      }));
      return groups.filter((g) => g.items.length > 0);
    }
    const groups = catalog.chairs
      .filter((c) => !filters.chair || String(c.id) === filters.chair)
      .map((chair) => {
        const resList = chair.resources
          ? chair.resources
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [];
        return {
          id: `chair-${chair.id}`,
          title: chair.name,
          subtitle: resList.length ? resList.join(' · ') : 'Poltrona operativa',
          accent: '#0f766e',
          items: sortedFilteredAppointments.filter((a) => a.chair_id === chair.id),
        };
      });
    return groups.filter((g) => g.items.length > 0);
  }, [
    summaryGroupBy,
    visibleProfessionals,
    catalog.chairs,
    filters.chair,
    sortedFilteredAppointments,
  ]);

  const handleExportCsv = () => {
    const filename =
      view === 'week' ? `agenda-settimana-${dateISO(weekStart)}.csv` : `agenda-${dateISO(date)}.csv`;
    const rows = sortedFilteredAppointments.map((a) => {
      const startDate = new Date(a.starts_at);
      const endDate = new Date(startDate.getTime() + a.duration * 60000);
      const statusLabel =
        a.confirmation_state === 'confirmed'
          ? 'Confermato'
          : a.reminder_status === 'prepared'
            ? 'Promemoria pronto'
            : 'Prenotato';
      return [
        dateISO(startDate),
        fmtTime(startDate),
        fmtTime(endDate),
        a.duration,
        a.patient,
        a.phone,
        a.procedure,
        a.professional,
        a.chair,
        statusLabel,
      ];
    });
    downloadCsv(
      filename,
      [
        'Data',
        'Ora inizio',
        'Ora fine',
        'Durata (min)',
        'Paziente',
        'Telefono',
        'Trattamento',
        'Professionista',
        'Stanza / Poltrona',
        'Conferma',
      ],
      rows
    );
  };

  const handlePrintSummary = () => {
    document.body.classList.add('printing-summary');
    const cleanup = () => {
      document.body.classList.remove('printing-summary');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    setTimeout(cleanup, 1500);
  };

  const nowDate = new Date();
  const isViewingToday = view === 'day' && dateISO(date) === todayISO;
  const currentHour = nowDate.getHours();

  const renderAppointmentCard = (appt: Appointment, compact = false) => {
    const prof = catalog.professionals.find((p) => p.id === appt.professional_id);
    const accent = prof?.color || appt.color || '#0f766e';

    return (
      <button
        key={appt.id}
        type="button"
        onClick={() => {
          setSelectedAppointment(appt);
          setConfirmingCancel(false);
        }}
        className="w-full text-left group rounded-lg border border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-[0_4px_12px_rgba(15,23,42,0.07)] hover:-translate-y-[1px] transition-all duration-150 overflow-hidden mb-1.5 last:mb-0"
      >
        <div className="h-[2.5px] w-full" style={{ backgroundColor: accent }} />
        <div className={compact ? 'p-2.5' : 'px-3 py-2.5'}>
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-mono text-[11px] font-medium text-[var(--color-muted)] tabular-nums">
              {fmtTimeRange(appt.starts_at, appt.duration)}
            </span>
            {appt.confirmation_state === 'confirmed' && (
              <span
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-clinical)]"
                title="Confermato dal paziente"
              >
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                {!compact && <span>Confermato</span>}
              </span>
            )}
            {appt.confirmation_state !== 'confirmed' && appt.reminder_status === 'prepared' && (
              <span
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-warn)]"
                title="Promemoria pronto da inviare"
              >
                <Clock className="w-3.5 h-3.5 shrink-0" />
                {!compact && <span>In coda</span>}
              </span>
            )}
          </div>

          <div className="text-[13.5px] font-semibold text-[var(--color-ink)] truncate leading-snug group-hover:text-[var(--color-clinical)] transition-colors">
            {appt.patient}
          </div>

          <div className="text-[12px] text-[var(--color-ink-soft)] mt-0.5 truncate">
            {appt.procedure} <span className="text-slate-300">·</span>{' '}
            <span className="tabular-nums text-[var(--color-muted)]">{appt.duration} min</span>
          </div>

          <div className="text-[11.5px] text-[var(--color-muted)] mt-1.5 truncate">
            {compact ? `${appt.professional.split(' ')[0]} · ${appt.chair}` : appt.chair}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-5">
      {/* Inline Operational Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 surface-card divide-y lg:divide-y-0 lg:divide-x divide-[var(--color-line)]">
        <div className="px-5 py-4">
          <div className="text-[12px] text-[var(--color-muted)] font-medium">
            {view === 'week' ? 'Appuntamenti settimana' : 'Appuntamenti giorno'}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-[var(--font-display)] text-[26px] font-bold tracking-tight text-[var(--color-ink)] tabular-nums">
              {filteredAppointments.length}
            </span>
            <span className="text-[12px] text-[var(--color-muted)] tabular-nums">
              {confirmedCount > 0 ? `${confirmedCount} confermati` : 'prenotati'}
            </span>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="text-[12px] text-[var(--color-muted)] font-medium">Pazienti in agenda</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-[var(--font-display)] text-[26px] font-bold tracking-tight text-[var(--color-ink)] tabular-nums">
              {uniquePatients}
            </span>
            <span className="text-[12px] text-[var(--color-muted)]">
              su {catalog.patients.length} in anagrafica
            </span>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="text-[12px] text-[var(--color-muted)] font-medium">
            Anticipi da approvare
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span
              className={`font-[var(--font-display)] text-[26px] font-bold tracking-tight tabular-nums ${
                pendingApprovals > 0 ? 'text-[var(--color-warn)]' : 'text-[var(--color-ink)]'
              }`}
            >
              {pendingApprovals}
            </span>
            {pendingApprovals > 0 && (
              <button
                type="button"
                onClick={onNavigateToProposals}
                className="text-[12px] font-semibold text-[var(--color-clinical)] hover:underline whitespace-nowrap"
              >
                Gestisci →
              </button>
            )}
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="text-[12px] text-[var(--color-muted)] font-medium">Stanze operative</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-[var(--font-display)] text-[26px] font-bold tracking-tight text-[var(--color-ink)] tabular-nums">
              {catalog.chairs.length}
            </span>
            <span className="text-[12px] text-[var(--color-muted)]">
              · {catalog.professionals.length} professionisti
            </span>
          </div>
        </div>
      </div>

      {/* Main Clinical Schedule Board */}
      <section className="surface-card overflow-hidden">
        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-[var(--color-line)] flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div>
            <h2 className="text-[16px] font-semibold text-[var(--color-ink)] capitalize">
              {rangeLabel}
            </h2>
            <p className="text-[12.5px] text-[var(--color-muted)] mt-0.5">
              Clicca su uno slot libero per fissare un appuntamento, oppure su una visita per gestirla.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Segmented Day/Week switch */}
            <div
              className="inline-flex items-center p-1 bg-[var(--color-surface-subtle)] border border-[var(--color-line)] rounded-lg"
              role="group"
              aria-label="Modalità vista agenda"
            >
              <button
                type="button"
                onClick={() => onChangeView('day')}
                className={`px-3 py-1.5 text-[12.5px] font-medium rounded-md transition-all whitespace-nowrap shrink-0 ${
                  view === 'day'
                    ? 'bg-white text-[var(--color-ink)] shadow-[0_1px_2px_rgba(15,23,42,0.08)]'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                }`}
              >
                Giorno
              </button>
              <button
                type="button"
                onClick={() => onChangeView('week')}
                className={`px-3 py-1.5 text-[12.5px] font-medium rounded-md transition-all whitespace-nowrap shrink-0 ${
                  view === 'week'
                    ? 'bg-white text-[var(--color-ink)] shadow-[0_1px_2px_rgba(15,23,42,0.08)]'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                }`}
              >
                Settimana
              </button>
            </div>

            {/* Range Navigation */}
            <div className="inline-flex items-center border border-[var(--color-line-strong)] rounded-lg bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => onShiftDate(-1)}
                aria-label="Periodo precedente"
                className="min-h-[36px] px-2.5 text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-subtle)] transition-colors border-r border-[var(--color-line)]"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onGoToday}
                className="min-h-[36px] px-3 text-[12.5px] font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-subtle)] transition-colors whitespace-nowrap"
              >
                Oggi
              </button>
              <button
                type="button"
                onClick={() => onShiftDate(1)}
                aria-label="Periodo successivo"
                className="min-h-[36px] px-2.5 text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-subtle)] transition-colors border-l border-[var(--color-line)]"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Inline Filters */}
            <select
              aria-label="Filtra per professionista"
              value={filters.professional}
              onChange={(e) => onChangeFilters({ ...filters, professional: e.target.value })}
              className="min-h-[36px] px-3 pr-7 rounded-lg border border-[var(--color-line-strong)] bg-white text-[12.5px] text-[var(--color-ink-soft)] hover:border-slate-400 max-w-[180px]"
            >
              <option value="">Tutti i professionisti</option>
              {catalog.professionals.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Filtra per poltrona"
              value={filters.chair}
              onChange={(e) => onChangeFilters({ ...filters, chair: e.target.value })}
              className="min-h-[36px] px-3 pr-7 rounded-lg border border-[var(--color-line-strong)] bg-white text-[12.5px] text-[var(--color-ink-soft)] hover:border-slate-400 max-w-[160px]"
            >
              <option value="">Tutte le poltrone</option>
              {catalog.chairs.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Filtra per prestazione"
              value={filters.procedure}
              onChange={(e) => onChangeFilters({ ...filters, procedure: e.target.value })}
              className="min-h-[36px] px-3 pr-7 rounded-lg border border-[var(--color-line-strong)] bg-white text-[12.5px] text-[var(--color-ink-soft)] hover:border-slate-400 max-w-[175px]"
            >
              <option value="">Tutte le prestazioni</option>
              {catalog.procedures.map((pr) => (
                <option key={pr.id} value={String(pr.id)}>
                  {pr.name}
                </option>
              ))}
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => onChangeFilters({ professional: '', chair: '', procedure: '' })}
                className="min-h-[36px] px-2.5 inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reimposta</span>
              </button>
            )}

            <div className="inline-flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSummaryOpen(true)}
                className="min-h-[36px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[12.5px] font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-subtle)] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Printer className="w-3.5 h-3.5 text-[var(--color-muted)]" />
                <span>Riepilogo</span>
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={sortedFilteredAppointments.length === 0}
                title="Esporta gli appuntamenti visibili in CSV"
                className="min-h-[36px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[12.5px] font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-subtle)] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5 text-[var(--color-muted)]" />
                <span>CSV</span>
              </button>
            </div>
          </div>
        </div>

        {/* Schedule Grid */}
        <div className="overflow-x-auto">
          {view === 'day' ? (
            <table className="w-full min-w-[820px] border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 w-[76px] bg-[var(--color-surface-subtle)] border-b border-r border-[var(--color-line)] px-3 py-3 text-left text-[11px] font-semibold text-[var(--color-muted)]">
                    Ora
                  </th>
                  {visibleProfessionals.map((prof) => {
                    const profApptCount = filteredAppointments.filter(
                      (a) => a.professional_id === prof.id
                    ).length;
                    return (
                      <th
                        key={prof.id}
                        className="bg-[var(--color-surface-subtle)] border-b border-r last:border-r-0 border-[var(--color-line)] px-3.5 py-3 text-left align-top"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-sm shrink-0"
                              style={{ backgroundColor: prof.color }}
                              aria-hidden="true"
                            />
                            <span className="text-[13px] font-semibold text-[var(--color-ink)] truncate">
                              {prof.name}
                            </span>
                          </div>
                          <span className="font-mono text-[11px] text-[var(--color-muted)] tabular-nums shrink-0">
                            {profApptCount}
                          </span>
                        </div>
                        <div className="text-[11px] font-normal text-[var(--color-muted)] mt-0.5 pl-[18px] truncate">
                          {prof.specialty}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {HOURS.map((hour) => {
                  const isCurrentHour = isViewingToday && currentHour === hour;
                  return (
                    <tr key={hour} className="group/row">
                      <td
                        className={`sticky left-0 z-10 w-[76px] border-b border-r border-[var(--color-line)] px-3 py-3 align-top font-mono text-[11.5px] tabular-nums ${
                          isCurrentHour
                            ? 'bg-[var(--color-clinical-tint)] text-[var(--color-clinical)] font-semibold'
                            : 'bg-slate-50/95 text-[var(--color-muted)] font-medium'
                        }`}
                      >
                        {String(hour).padStart(2, '0')}:00
                      </td>
                      {visibleProfessionals.map((prof) => {
                        const slotAppts = filteredAppointments.filter(
                          (a) =>
                            new Date(a.starts_at).getHours() === hour &&
                            a.professional_id === prof.id
                        );
                        return (
                          <td
                            key={prof.id}
                            className={`border-b border-r last:border-r-0 border-slate-100 p-2 align-top min-w-[170px] h-[88px] transition-colors relative group/cell ${
                              isCurrentHour ? 'bg-teal-50/20' : 'bg-white'
                            } hover:bg-slate-50/75`}
                          >
                            {slotAppts.length > 0 ? (
                              slotAppts.map((a) => renderAppointmentCard(a, false))
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenNewBooking({
                                    dateISO: dateISO(date),
                                    hour,
                                    professionalId: prof.id,
                                  })
                                }
                                aria-label={`Nuovo appuntamento alle ${String(hour).padStart(2, '0')}:00 con ${prof.name}`}
                                className="w-full h-full min-h-[70px] rounded-lg border border-dashed border-transparent group-hover/cell:border-slate-300 flex items-center justify-center gap-1 text-[11.5px] font-medium text-transparent group-hover/cell:text-[var(--color-muted)] hover:!text-[var(--color-clinical)] hover:!border-[var(--color-clinical)]/40 hover:bg-[var(--color-clinical-tint)]/70 transition-all"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Prenota</span>
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[1120px] border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 w-[76px] bg-[var(--color-surface-subtle)] border-b border-r border-[var(--color-line)] px-3 py-3 text-left text-[11px] font-semibold text-[var(--color-muted)]">
                    Ora
                  </th>
                  {weekDays.map((day) => {
                    const iso = dateISO(day);
                    const isToday = iso === todayISO;
                    const dayCount = filteredAppointments.filter(
                      (a) => dateISO(a.starts_at) === iso
                    ).length;
                    return (
                      <th
                        key={iso}
                        className={`border-b border-r last:border-r-0 border-[var(--color-line)] px-3 py-3 text-left align-top ${
                          isToday ? 'bg-[var(--color-clinical-tint)]' : 'bg-[var(--color-surface-subtle)]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-[12.5px] font-semibold capitalize ${
                              isToday ? 'text-[var(--color-clinical)]' : 'text-[var(--color-ink)]'
                            }`}
                          >
                            {fmtDate(day, { weekday: 'short', day: 'numeric', month: 'short' })}
                          </span>
                          <span className="font-mono text-[11px] text-[var(--color-muted)] tabular-nums">
                            {dayCount}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {HOURS.map((hour) => (
                  <tr key={hour}>
                    <td className="sticky left-0 z-10 w-[76px] bg-slate-50/95 border-b border-r border-[var(--color-line)] px-3 py-3 align-top font-mono text-[11.5px] font-medium text-[var(--color-muted)] tabular-nums">
                      {String(hour).padStart(2, '0')}:00
                    </td>
                    {weekDays.map((day) => {
                      const iso = dateISO(day);
                      const isToday = iso === todayISO;
                      const slotAppts = filteredAppointments.filter(
                        (a) =>
                          dateISO(a.starts_at) === iso &&
                          new Date(a.starts_at).getHours() === hour
                      );
                      return (
                        <td
                          key={iso}
                          className={`border-b border-r last:border-r-0 border-slate-100 p-1.5 align-top min-w-[150px] h-[82px] group/cell transition-colors ${
                            isToday ? 'bg-teal-50/25' : 'bg-white'
                          } hover:bg-slate-50/75`}
                        >
                          {slotAppts.length > 0 ? (
                            slotAppts.map((a) => renderAppointmentCard(a, true))
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                onOpenNewBooking({
                                  dateISO: iso,
                                  hour,
                                  professionalId: filters.professional
                                    ? Number(filters.professional)
                                    : undefined,
                                })
                              }
                              aria-label={`Nuovo appuntamento il ${iso} alle ${String(hour).padStart(2, '0')}:00`}
                              className="w-full h-full min-h-[66px] rounded-lg border border-dashed border-transparent group-hover/cell:border-slate-300 flex items-center justify-center text-transparent group-hover/cell:text-[var(--color-muted)] hover:!text-[var(--color-clinical)] hover:bg-[var(--color-clinical-tint)]/70 transition-all"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Appointment Detail & Safe Cancellation Modal */}
      {selectedAppointment && (
        <div
          className="fixed inset-0 z-50 bg-[var(--color-backdrop)] backdrop-blur-[2px] flex items-center justify-center p-4 animate-fade-in"
          onClick={() => {
            if (!cancelling) {
              setSelectedAppointment(null);
              setConfirmingCancel(false);
            }
          }}
        >
          <div
            className="w-full max-w-[460px] bg-white border border-[var(--color-line)] rounded-xl shadow-2xl overflow-hidden animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="appt-modal-title"
          >
            <div
              className="h-1 w-full"
              style={{ backgroundColor: selectedAppointment.color || '#0f766e' }}
            />
            <div className="px-6 py-5 border-b border-[var(--color-line)] flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-[var(--color-clinical-tint)] text-[var(--color-clinical)] font-semibold text-sm flex items-center justify-center shrink-0">
                  {initials(selectedAppointment.patient)}
                </div>
                <div className="min-w-0">
                  <h3
                    id="appt-modal-title"
                    className="text-[17px] font-semibold text-[var(--color-ink)] truncate"
                  >
                    {selectedAppointment.patient}
                  </h3>
                  <div className="text-[12.5px] text-[var(--color-muted)] flex items-center gap-1.5 mt-0.5 font-mono tabular-nums">
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    <span>{selectedAppointment.phone}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedAppointment(null);
                  setConfirmingCancel(false);
                }}
                aria-label="Chiudi dettaglio"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--color-muted)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-ink)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-[13px]">
                <div>
                  <div className="text-[11.5px] text-[var(--color-muted)] font-medium">
                    Prestazione
                  </div>
                  <div className="font-semibold text-[var(--color-ink)] mt-0.5">
                    {selectedAppointment.procedure}
                  </div>
                  <div className="text-[12px] text-[var(--color-muted)] tabular-nums">
                    {selectedAppointment.duration} minuti · {selectedAppointment.specialty}
                  </div>
                </div>

                <div>
                  <div className="text-[11.5px] text-[var(--color-muted)] font-medium">
                    Data e orario
                  </div>
                  <div className="font-semibold text-[var(--color-ink)] mt-0.5 flex items-center gap-1.5 capitalize">
                    <CalendarDays className="w-3.5 h-3.5 text-[var(--color-muted)] shrink-0" />
                    <span>
                      {fmtDate(selectedAppointment.starts_at, {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  </div>
                  <div className="font-mono text-[12px] text-[var(--color-ink-soft)] tabular-nums mt-0.5">
                    {fmtTimeRange(selectedAppointment.starts_at, selectedAppointment.duration)}
                  </div>
                </div>

                <div>
                  <div className="text-[11.5px] text-[var(--color-muted)] font-medium">
                    Professionista
                  </div>
                  <div className="font-medium text-[var(--color-ink)] mt-0.5 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-[var(--color-muted)] shrink-0" />
                    <span>{selectedAppointment.professional}</span>
                  </div>
                </div>

                <div>
                  <div className="text-[11.5px] text-[var(--color-muted)] font-medium">
                    Stanza / Poltrona
                  </div>
                  <div className="font-medium text-[var(--color-ink)] mt-0.5 flex items-center gap-1.5">
                    <DoorOpen className="w-3.5 h-3.5 text-[var(--color-muted)] shrink-0" />
                    <span>{selectedAppointment.chair}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--color-line)] flex items-center justify-between text-[12.5px]">
                <span className="text-[var(--color-muted)]">Stato conferma</span>
                {selectedAppointment.confirmation_state === 'confirmed' ? (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--color-clinical)]">
                    <CheckCircle2 className="w-4 h-4" />
                    Confermato dal paziente
                  </span>
                ) : selectedAppointment.reminder_status === 'prepared' ? (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--color-warn)]">
                    <Clock className="w-4 h-4" />
                    Promemoria pronto da inviare
                  </span>
                ) : (
                  <span className="text-[var(--color-ink-soft)]">Prenotato · nessun promemoria</span>
                )}
              </div>

              {confirmingCancel ? (
                <div className="rounded-lg border border-[var(--color-alert-border)] bg-[var(--color-alert-tint)] p-4 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-[var(--color-alert)] shrink-0 mt-0.5" />
                    <div className="text-[12.5px] text-red-900 leading-relaxed">
                      Annullando l&apos;appuntamento delle{' '}
                      <strong className="font-mono tabular-nums">
                        {fmtTime(selectedAppointment.starts_at)}
                      </strong>
                      , lo slot verrà liberato e AgendaSmart cercherà automaticamente appuntamenti
                      successivi compatibili da proporre in <strong>Anticipi</strong>.
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={cancelling}
                      onClick={() => setConfirmingCancel(false)}
                      className="min-h-[38px] px-3.5 rounded-lg border border-[var(--color-line-strong)] bg-white text-[12.5px] font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-subtle)] transition-colors whitespace-nowrap"
                    >
                      Mantieni appuntamento
                    </button>
                    <button
                      type="button"
                      disabled={cancelling}
                      onClick={handleConfirmCancel}
                      className="min-h-[38px] px-4 rounded-lg bg-[var(--color-alert)] text-white text-[12.5px] font-semibold hover:bg-[var(--color-alert-hover)] transition-colors disabled:opacity-60 whitespace-nowrap"
                    >
                      {cancelling ? 'Annullamento…' : 'Conferma disdetta'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pt-2 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmingCancel(true)}
                    className="min-h-[40px] px-4 rounded-lg border border-[var(--color-alert-border)] bg-white text-[13px] font-semibold text-[var(--color-alert)] hover:bg-[var(--color-alert-tint)] transition-colors whitespace-nowrap"
                  >
                    Annulla e libera slot
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedAppointment(null)}
                    className="min-h-[40px] px-4 rounded-lg border border-[var(--color-line-strong)] bg-white text-[13px] font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-subtle)] transition-colors whitespace-nowrap"
                  >
                    Chiudi
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Printable Daily / Weekly Summary Sheet Modal */}
      {summaryOpen && (
        <div
          className="fixed inset-0 z-50 bg-[var(--color-backdrop)] backdrop-blur-[2px] flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSummaryOpen(false)}
        >
          <div
            className="print-summary-root w-full max-w-[920px] max-h-[90vh] bg-white border border-[var(--color-line)] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="summary-sheet-title"
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-[var(--color-line)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-clinical)]">
                  AgendaSmart · Studio Odontoiatrico
                </div>
                <h3
                  id="summary-sheet-title"
                  className="text-[19px] font-bold text-[var(--color-ink)] capitalize mt-0.5"
                >
                  Riepilogo {view === 'week' ? 'settimanale' : 'giornaliero'} · {rangeLabel}
                </h3>
                <p className="text-[12.5px] text-[var(--color-muted)] mt-0.5 tabular-nums">
                  {sortedFilteredAppointments.length} appuntamenti · {confirmedCount} confermati ·{' '}
                  {uniquePatients} pazienti
                </p>
              </div>

              <div className="no-print flex flex-wrap items-center gap-2 shrink-0">
                <div
                  className="inline-flex items-center p-0.5 bg-[var(--color-surface-subtle)] border border-[var(--color-line)] rounded-lg"
                  role="group"
                  aria-label="Raggruppa riepilogo per"
                >
                  <button
                    type="button"
                    onClick={() => setSummaryGroupBy('professional')}
                    className={`px-2.5 py-1.5 text-[12px] font-medium rounded-md transition-colors whitespace-nowrap ${
                      summaryGroupBy === 'professional'
                        ? 'bg-white text-[var(--color-ink)] shadow-[0_1px_2px_rgba(24,35,29,0.08)]'
                        : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                    }`}
                  >
                    Per professionista
                  </button>
                  <button
                    type="button"
                    onClick={() => setSummaryGroupBy('chair')}
                    className={`px-2.5 py-1.5 text-[12px] font-medium rounded-md transition-colors whitespace-nowrap ${
                      summaryGroupBy === 'chair'
                        ? 'bg-white text-[var(--color-ink)] shadow-[0_1px_2px_rgba(24,35,29,0.08)]'
                        : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                    }`}
                  >
                    Per poltrona
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={sortedFilteredAppointments.length === 0}
                  className="min-h-[36px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[12.5px] font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-subtle)] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintSummary}
                  className="min-h-[36px] px-3.5 rounded-lg bg-[var(--color-clinical)] text-white text-[12.5px] font-semibold hover:bg-[var(--color-clinical-hover)] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Stampa / PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSummaryOpen(false)}
                  aria-label="Chiudi riepilogo"
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--color-muted)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-ink)] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {summaryGroups.length === 0 ? (
                <div className="py-10 text-center text-[13.5px] text-[var(--color-muted)]">
                  Nessun appuntamento pianificato nel periodo selezionato.
                </div>
              ) : (
                summaryGroups.map((group) => (
                  <div
                    key={group.id}
                    className="border border-[var(--color-line)] rounded-lg overflow-hidden break-inside-avoid"
                  >
                    <div className="px-4 py-2.5 bg-[var(--color-surface-subtle)] border-b border-[var(--color-line)] flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: group.accent }}
                          aria-hidden="true"
                        />
                        <span className="text-[13.5px] font-semibold text-[var(--color-ink)] truncate">
                          {group.title}
                        </span>
                        <span className="text-[12px] text-[var(--color-muted)] truncate">
                          · {group.subtitle}
                        </span>
                      </div>
                      <span className="font-mono text-[11.5px] text-[var(--color-muted)] tabular-nums shrink-0">
                        {group.items.length} {group.items.length === 1 ? 'visita' : 'visite'}
                      </span>
                    </div>

                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[var(--color-line)] text-[11px] font-semibold text-[var(--color-muted)]">
                          {view === 'week' && <th className="px-4 py-2">Data</th>}
                          <th className="px-4 py-2">Orario</th>
                          <th className="px-4 py-2">Paziente</th>
                          <th className="px-4 py-2">Trattamento</th>
                          <th className="px-4 py-2">
                            {summaryGroupBy === 'professional' ? 'Poltrona' : 'Professionista'}
                          </th>
                          <th className="px-4 py-2 text-right">Stato</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[12.5px]">
                        {group.items.map((appt) => (
                          <tr key={appt.id}>
                            {view === 'week' && (
                              <td className="px-4 py-2.5 text-[var(--color-ink-soft)] capitalize whitespace-nowrap">
                                {fmtDate(appt.starts_at, {
                                  weekday: 'short',
                                  day: 'numeric',
                                  month: 'short',
                                })}
                              </td>
                            )}
                            <td className="px-4 py-2.5 font-mono text-[12px] font-medium text-[var(--color-ink)] tabular-nums whitespace-nowrap">
                              {fmtTimeRange(appt.starts_at, appt.duration)}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="font-semibold text-[var(--color-ink)]">
                                {appt.patient}
                              </div>
                              <div className="font-mono text-[11.5px] text-[var(--color-muted)] tabular-nums">
                                {appt.phone}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-[var(--color-ink-soft)]">
                              <span>{appt.procedure}</span>
                              <span className="text-[var(--color-muted)] tabular-nums">
                                {' '}
                                ({appt.duration} min)
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-[var(--color-ink-soft)]">
                              {summaryGroupBy === 'professional' ? appt.chair : appt.professional}
                            </td>
                            <td className="px-4 py-2.5 text-right whitespace-nowrap">
                              {appt.confirmation_state === 'confirmed' ? (
                                <span className="font-semibold text-[var(--color-clinical)]">
                                  Confermato
                                </span>
                              ) : (
                                <span className="text-[var(--color-muted)]">In attesa</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
