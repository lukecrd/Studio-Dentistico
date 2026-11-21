import { useMemo, useState } from 'react';
import {
  Search,
  CalendarX2,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowRight,
  UserPlus,
  CalendarClock,
  X,
  Phone,
  DoorOpen,
  UserCheck,
  Smartphone,
} from 'lucide-react';
import type { BookingPrefill, CancellationItem } from '../types';
import { dateISO, fmtDate, fmtTime, fmtTimeRange } from '../api';

interface CancellationsViewProps {
  cancellations: CancellationItem[];
  smsConfigured: boolean;
  onReplaceWithExisting: (
    freedAppointmentId: number,
    targetAppointmentId: number,
    sendSms: boolean
  ) => Promise<void>;
  onSendMoveSms: (appointmentId: number) => Promise<void>;
  onReplaceWithNew: (prefill: BookingPrefill) => void;
  onGoToAgenda: () => void;
}

type CancellationFilter = 'all' | 'free' | 'replaced' | 'past';

const STATUS_META: Record<
  CancellationItem['slot_status'],
  { label: string; colorClass: string; icon: typeof Clock }
> = {
  free: {
    label: 'Slot libero',
    colorClass: 'text-[var(--color-warn)]',
    icon: Clock,
  },
  replaced: {
    label: 'Rimpiazzato',
    colorClass: 'text-[var(--color-clinical)]',
    icon: CheckCircle2,
  },
  past: {
    label: 'Orario passato',
    colorClass: 'text-[var(--color-muted)]',
    icon: XCircle,
  },
  inactive_room: {
    label: 'Stanza archiviata',
    colorClass: 'text-[var(--color-muted)]',
    icon: XCircle,
  },
};

export function CancellationsView({
  cancellations,
  smsConfigured,
  onReplaceWithExisting,
  onSendMoveSms,
  onReplaceWithNew,
  onGoToAgenda,
}: CancellationsViewProps) {
  const [filter, setFilter] = useState<CancellationFilter>('all');
  const [query, setQuery] = useState('');
  const [activeSlot, setActiveSlot] = useState<CancellationItem | null>(null);
  const [replacingId, setReplacingId] = useState<number | null>(null);
  const [sendMoveSms, setSendMoveSms] = useState<boolean>(smsConfigured);
  const [notifyingId, setNotifyingId] = useState<number | null>(null);

  const counts = useMemo(
    () => ({
      all: cancellations.length,
      free: cancellations.filter((c) => c.slot_status === 'free').length,
      withCandidates: cancellations.filter(
        (c) => c.slot_status === 'free' && c.candidates.length > 0
      ).length,
      replaced: cancellations.filter((c) => c.slot_status === 'replaced').length,
      past: cancellations.filter((c) => c.slot_status === 'past' || c.slot_status === 'inactive_room')
        .length,
    }),
    [cancellations]
  );

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cancellations.filter((item) => {
      if (filter === 'free' && item.slot_status !== 'free') return false;
      if (filter === 'replaced' && item.slot_status !== 'replaced') return false;
      if (
        filter === 'past' &&
        item.slot_status !== 'past' &&
        item.slot_status !== 'inactive_room'
      ) {
        return false;
      }
      if (!q) return true;
      return (
        item.patient.toLowerCase().includes(q) ||
        item.procedure.toLowerCase().includes(q) ||
        item.professional.toLowerCase().includes(q) ||
        item.chair.toLowerCase().includes(q)
      );
    });
  }, [cancellations, filter, query]);

  const buildNewBookingPrefill = (item: CancellationItem): BookingPrefill => {
    const start = new Date(item.starts_at);
    return {
      dateISO: dateISO(start),
      hour: start.getHours(),
      minute: start.getMinutes(),
      professionalId: item.professional_id,
      chairId: item.chair_id,
      procedureId: item.procedure_id,
      replacingLabel: `${fmtDate(start, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })} · ${fmtTimeRange(item.starts_at, item.duration)} · ${item.professional} (${item.chair})`,
    };
  };

  const handleMoveExisting = async (freedId: number, candidateId: number) => {
    setReplacingId(candidateId);
    try {
      await onReplaceWithExisting(freedId, candidateId, sendMoveSms && smsConfigured);
      setActiveSlot(null);
    } finally {
      setReplacingId(null);
    }
  };

  const handleNotifyReplaced = async (appointmentId: number) => {
    setNotifyingId(appointmentId);
    try {
      await onSendMoveSms(appointmentId);
    } finally {
      setNotifyingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Operational Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border border-[var(--color-line)] rounded-xl bg-white divide-y lg:divide-y-0 lg:divide-x divide-[var(--color-line)]">
        <div className="px-5 py-4">
          <div className="text-[12px] text-[var(--color-muted)] font-medium">
            Slot liberi da rimpiazzare
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={`font-[var(--font-display)] text-[26px] font-bold tracking-tight tabular-nums ${
                counts.free > 0 ? 'text-[var(--color-warn)]' : 'text-[var(--color-ink)]'
              }`}
            >
              {counts.free}
            </span>
            <span className="text-[12px] text-[var(--color-muted)]">disponibili in agenda</span>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="text-[12px] text-[var(--color-muted)] font-medium">
            Con candidati compatibili
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-[var(--font-display)] text-[26px] font-bold tracking-tight text-[var(--color-clinical)] tabular-nums">
              {counts.withCandidates}
            </span>
            <span className="text-[12px] text-[var(--color-muted)]">pronti per anticipo</span>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="text-[12px] text-[var(--color-muted)] font-medium">
            Disdette rimpiazzate
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-[var(--font-display)] text-[26px] font-bold tracking-tight text-[var(--color-ink)] tabular-nums">
              {counts.replaced}
            </span>
            <span className="text-[12px] text-[var(--color-muted)]">spazi recuperati</span>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="text-[12px] text-[var(--color-muted)] font-medium">Totale disdette</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-[var(--font-display)] text-[26px] font-bold tracking-tight text-[var(--color-ink)] tabular-nums">
              {counts.all}
            </span>
            <span className="text-[12px] text-[var(--color-muted)]">registrate</span>
          </div>
        </div>
      </div>

      {/* Cancellations Table Panel */}
      <section className="bg-white border border-[var(--color-line)] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-line)] flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold text-[var(--color-ink)]">
              Elenco disdette e rimpiazzi
            </h2>
            <p className="text-[12.5px] text-[var(--color-muted)] mt-0.5">
              Riempi uno slot disdetto spostando un appuntamento futuro compatibile o prenotando un
              nuovo paziente.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center p-1 bg-[var(--color-surface-subtle)] border border-[var(--color-line)] rounded-lg overflow-x-auto">
              {(
                [
                  ['all', `Tutte (${counts.all})`],
                  ['free', `Libere (${counts.free})`],
                  ['replaced', `Rimpiazzate (${counts.replaced})`],
                  ['past', `Passate (${counts.past})`],
                ] as Array<[CancellationFilter, string]>
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                    filter === key
                      ? 'bg-white text-[var(--color-ink)] shadow-[0_1px_2px_rgba(24,35,29,0.08)]'
                      : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-56">
              <Search className="w-4 h-4 text-[var(--color-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cerca paziente o medico…"
                aria-label="Cerca disdette"
                className="w-full min-h-[38px] pl-9 pr-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[12.5px] text-[var(--color-ink)] placeholder:text-[var(--color-muted)]"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse">
            <thead>
              <tr className="bg-[var(--color-surface-subtle)] border-b border-[var(--color-line)]">
                <th className="px-5 py-3 text-left text-[11.5px] font-semibold text-[var(--color-muted)]">
                  Slot liberato
                </th>
                <th className="px-5 py-3 text-left text-[11.5px] font-semibold text-[var(--color-muted)]">
                  Appuntamento disdetto
                </th>
                <th className="px-5 py-3 text-left text-[11.5px] font-semibold text-[var(--color-muted)]">
                  Professionista e stanza
                </th>
                <th className="px-5 py-3 text-left text-[11.5px] font-semibold text-[var(--color-muted)]">
                  Stato
                </th>
                <th className="px-5 py-3 text-right text-[11.5px] font-semibold text-[var(--color-muted)]">
                  Rimpiazzo
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf0eb]">
              {visibleItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <CalendarX2 className="w-8 h-8 text-[var(--color-line-strong)] mx-auto mb-2.5" />
                    <div className="text-[14px] font-semibold text-[var(--color-ink)]">
                      Nessuna disdetta in questa vista
                    </div>
                    <p className="text-[12.5px] text-[var(--color-muted)] mt-1 max-w-md mx-auto">
                      Quando un appuntamento viene annullato dalla segreteria o dal paziente, lo
                      slot compare qui pronto per essere rimpiazzato.
                    </p>
                    <button
                      type="button"
                      onClick={onGoToAgenda}
                      className="mt-4 min-h-[38px] px-4 rounded-lg border border-[var(--color-line-strong)] bg-white text-[12.5px] font-semibold text-[var(--color-ink)] hover:bg-[var(--color-surface-subtle)] transition-colors"
                    >
                      Vai all&apos;Agenda
                    </button>
                  </td>
                </tr>
              ) : (
                visibleItems.map((item) => {
                  const meta = STATUS_META[item.slot_status];
                  const StatusIcon = meta.icon;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-[var(--color-surface-subtle)]/45 transition-colors"
                    >
                      <td className="px-5 py-4 align-middle whitespace-nowrap">
                        <div className="text-[13.5px] font-semibold text-[var(--color-ink)] capitalize">
                          {fmtDate(item.starts_at, {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          })}
                        </div>
                        <div className="font-mono text-[12px] text-[var(--color-ink-soft)] tabular-nums mt-0.5">
                          {fmtTimeRange(item.starts_at, item.duration)}
                        </div>
                      </td>

                      <td className="px-5 py-4 align-middle">
                        <div className="text-[13.5px] font-semibold text-[var(--color-ink)]">
                          {item.patient}
                        </div>
                        <div className="text-[12px] text-[var(--color-muted)] mt-0.5 tabular-nums">
                          {item.procedure} · {item.duration} min
                        </div>
                      </td>

                      <td className="px-5 py-4 align-middle whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-sm shrink-0"
                            style={{ backgroundColor: item.color }}
                            aria-hidden="true"
                          />
                          <span className="text-[13px] font-medium text-[var(--color-ink)]">
                            {item.professional}
                          </span>
                        </div>
                        <div className="text-[12px] text-[var(--color-muted)] pl-[18px] mt-0.5">
                          {item.chair}
                        </div>
                      </td>

                      <td className="px-5 py-4 align-middle">
                        <div
                          className={`inline-flex items-center gap-1.5 text-[12.5px] font-semibold ${meta.colorClass}`}
                        >
                          <StatusIcon className="w-4 h-4 shrink-0" />
                          <span>{meta.label}</span>
                        </div>
                        {item.slot_status === 'free' && (
                          <div className="text-[11.5px] text-[var(--color-muted)] mt-0.5 tabular-nums">
                            {item.candidates.length > 0
                              ? `${item.candidates.length} appuntamenti compatibili`
                              : 'Nessun anticipo compatibile · prenotabile'}
                          </div>
                        )}
                        {item.slot_status === 'replaced' && item.replaced_by && (
                          <div className="text-[11.5px] text-[var(--color-muted)] mt-0.5">
                            Assegnato a{' '}
                            <strong className="font-semibold text-[var(--color-ink-soft)]">
                              {item.replaced_by.patient}
                            </strong>{' '}
                            · {item.replaced_by.procedure}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4 align-middle text-right whitespace-nowrap">
                        {item.slot_status === 'free' ? (
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setActiveSlot(item)}
                              className="min-h-[36px] px-3.5 rounded-lg bg-[var(--color-clinical)] text-white text-[12px] font-semibold hover:bg-[var(--color-clinical-hover)] transition-colors whitespace-nowrap"
                            >
                              Rimpiazza slot
                            </button>
                          </div>
                        ) : item.slot_status === 'replaced' && item.replaced_by ? (
                          <button
                            type="button"
                            disabled={!smsConfigured || notifyingId === item.replaced_by.id}
                            onClick={() => handleNotifyReplaced(item.replaced_by!.id)}
                            className="min-h-[34px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[12px] font-medium text-[var(--color-clinical)] hover:bg-[var(--color-clinical-tint)]/50 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                            <span>
                              {notifyingId === item.replaced_by.id
                                ? 'Invio…'
                                : 'SMS conferma'}
                            </span>
                          </button>
                        ) : (
                          <span className="text-[12px] text-[var(--color-muted)]">Non disponibile</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Replace Slot Modal */}
      {activeSlot && (
        <div
          className="fixed inset-0 z-50 bg-[#18231d]/40 backdrop-blur-[1px] flex items-center justify-center p-4"
          onClick={() => !replacingId && setActiveSlot(null)}
        >
          <div
            className="w-full max-w-[600px] max-h-[88vh] flex flex-col bg-white border border-[var(--color-line)] rounded-xl shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="replace-slot-title"
          >
            <div
              className="h-1 w-full"
              style={{ backgroundColor: activeSlot.color || '#2b5942' }}
            />

            <div className="px-6 py-5 border-b border-[var(--color-line)] flex items-start justify-between gap-4">
              <div>
                <h3
                  id="replace-slot-title"
                  className="text-[18px] font-semibold text-[var(--color-ink)]"
                >
                  Rimpiazza slot disdetto
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-[var(--color-ink-soft)]">
                  <span className="capitalize font-medium">
                    {fmtDate(activeSlot.starts_at, {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </span>
                  <span className="text-[var(--color-muted)]">·</span>
                  <span className="font-mono font-semibold tabular-nums">
                    {fmtTimeRange(activeSlot.starts_at, activeSlot.duration)}
                  </span>
                  <span className="text-[var(--color-muted)]">·</span>
                  <span>{activeSlot.professional}</span>
                  <span className="text-[var(--color-muted)]">·</span>
                  <span>{activeSlot.chair}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveSlot(null)}
                aria-label="Chiudi finestra rimpiazzo"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--color-muted)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-ink)] transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Option 1: Move compatible existing appointment */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div>
                    <h4 className="text-[14px] font-semibold text-[var(--color-ink)]">
                      01. Sposta un appuntamento futuro compatibile
                    </h4>
                    <p className="text-[12px] text-[var(--color-muted)] mt-0.5">
                      Elenco filtrato per durata (≤ {activeSlot.duration} min), abilitazioni di{' '}
                      {activeSlot.professional} e dotazioni di {activeSlot.chair}.
                    </p>
                  </div>
                </div>

                {smsConfigured && activeSlot.candidates.length > 0 && (
                  <label className="mb-3 px-3.5 py-2.5 rounded-lg bg-[var(--color-clinical-tint)]/55 border border-[var(--color-clinical)]/20 flex items-center gap-2.5 text-[12.5px] text-[var(--color-ink)] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={sendMoveSms}
                      onChange={(e) => setSendMoveSms(e.target.checked)}
                      className="accent-[var(--color-clinical)] w-4 h-4 shrink-0"
                    />
                    <Smartphone className="w-4 h-4 text-[var(--color-clinical)] shrink-0" />
                    <span>
                      Invia automaticamente <strong>SMS di conferma spostamento</strong> (TextBee)
                      al paziente spostato
                    </span>
                  </label>
                )}

                {activeSlot.candidates.length === 0 ? (
                  <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-subtle)]/70 p-4 text-[12.5px] text-[var(--color-muted)] flex items-center gap-3">
                    <CalendarClock className="w-5 h-5 text-[var(--color-muted)] shrink-0" />
                    <span>
                      Nessun appuntamento futuro in agenda risulta compatibile con questo slot. Puoi
                      comunque prenotare un nuovo cliente qui sotto.
                    </span>
                  </div>
                ) : (
                  <div className="border border-[var(--color-line)] rounded-lg divide-y divide-[#edf0eb] overflow-hidden">
                    {activeSlot.candidates.map((cand) => {
                      const isBusy = replacingId === cand.id;
                      return (
                        <div
                          key={cand.id}
                          className="p-3.5 bg-white hover:bg-[var(--color-surface-subtle)]/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[13.5px] font-semibold text-[var(--color-ink)]">
                                {cand.patient}
                              </span>
                              <span className="text-[12px] text-[var(--color-muted)] font-mono tabular-nums inline-flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {cand.phone}
                              </span>
                            </div>
                            <div className="text-[12px] text-[var(--color-ink-soft)] mt-0.5">
                              {cand.procedure} ·{' '}
                              <span className="tabular-nums">{cand.duration} min</span>
                            </div>
                            <div className="text-[11.5px] text-[var(--color-muted)] mt-1 flex items-center gap-1.5 flex-wrap">
                              <span>Attuale:</span>
                              <span className="font-mono tabular-nums text-[var(--color-ink-soft)]">
                                {fmtDate(cand.starts_at, { day: 'numeric', month: 'short' })}{' '}
                                {fmtTime(cand.starts_at)}
                              </span>
                              <span>·</span>
                              <span className="inline-flex items-center gap-1">
                                <UserCheck className="w-3 h-3" />
                                {cand.professional}
                              </span>
                              <span>·</span>
                              <span className="inline-flex items-center gap-1">
                                <DoorOpen className="w-3 h-3" />
                                {cand.chair}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={replacingId !== null}
                            onClick={() => handleMoveExisting(activeSlot.id, cand.id)}
                            className="min-h-[38px] px-3.5 rounded-lg bg-[var(--color-clinical)] text-white text-[12px] font-semibold hover:bg-[var(--color-clinical-hover)] transition-colors inline-flex items-center justify-center gap-1.5 disabled:opacity-50 whitespace-nowrap shrink-0"
                          >
                            <span>{isBusy ? 'Spostamento…' : 'Sposta qui'}</span>
                            {!isBusy && <ArrowRight className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-[var(--color-line)]" />

              {/* Option 2: Book brand-new appointment into this freed slot */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-[14px] font-semibold text-[var(--color-ink)]">
                    02. Prenota un nuovo appuntamento nello slot
                  </h4>
                  <p className="text-[12px] text-[var(--color-muted)] mt-0.5">
                    Apre il modulo precompilato su{' '}
                    <span className="font-mono tabular-nums">
                      {fmtDate(activeSlot.starts_at, { day: 'numeric', month: 'short' })}{' '}
                      {fmtTime(activeSlot.starts_at)}
                    </span>{' '}
                    con {activeSlot.professional} e {activeSlot.chair}.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={replacingId !== null}
                  onClick={() => {
                    const prefill = buildNewBookingPrefill(activeSlot);
                    setActiveSlot(null);
                    onReplaceWithNew(prefill);
                  }}
                  className="min-h-[40px] px-4 rounded-lg border border-[var(--color-line-strong)] bg-white text-[12.5px] font-semibold text-[var(--color-ink)] hover:bg-[var(--color-surface-subtle)] transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                >
                  <UserPlus className="w-4 h-4 text-[var(--color-clinical)]" />
                  <span>Nuovo appuntamento</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
