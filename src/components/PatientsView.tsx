import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Search,
  Trash2,
  UserPlus,
  Users,
  Download,
  FileText,
  X,
  Phone,
  CalendarDays,
  CheckCircle2,
  XCircle,
  Clock,
  Smartphone,
  MessageCircle,
  Save,
} from 'lucide-react';
import type { Patient, PatientDetailData } from '../types';
import { api, dateISO, downloadCsv, fmtDate, fmtTime, fmtTimeRange, initials } from '../api';

interface PatientsViewProps {
  patients: Patient[];
  onCreatePatient: (payload: { name: string; phone: string; notes: string }) => Promise<void>;
  onUpdatePatient: (
    id: number,
    payload: { name: string; phone: string; notes: string }
  ) => Promise<void>;
  onDeletePatient: (id: number) => Promise<void>;
}

export function PatientsView({
  patients,
  onCreatePatient,
  onUpdatePatient,
  onDeletePatient,
}: PatientsViewProps) {
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Patient detail & edit drawer state
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailData, setDetailData] = useState<PatientDetailData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.phone.toLowerCase().includes(q) ||
        (p.notes || '').toLowerCase().includes(q)
    );
  }, [patients, query]);

  useEffect(() => {
    if (!detailId) {
      setDetailData(null);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    api<PatientDetailData>(`/api/patients/${detailId}`)
      .then((res) => {
        if (cancelled) return;
        setDetailData(res);
        setEditName(res.patient.name);
        setEditPhone(res.patient.phone);
        setEditNotes(res.patient.notes || '');
      })
      .catch(() => {
        if (!cancelled) setDetailId(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detailId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onCreatePatient({ name, phone, notes });
      setName('');
      setPhone('');
      setNotes('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!detailId) return;
    setSavingEdit(true);
    try {
      await onUpdatePatient(detailId, {
        name: editName,
        phone: editPhone,
        notes: editNotes,
      });
      const fresh = await api<PatientDetailData>(`/api/patients/${detailId}`);
      setDetailData(fresh);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await onDeletePatient(id);
      setConfirmId(null);
      if (detailId === id) setDetailId(null);
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportCsv = () => {
    downloadCsv(
      `clienti-${dateISO(new Date())}.csv`,
      ['ID', 'Nome e cognome', 'Telefono', 'Note', 'Appuntamenti totali', 'Prenotati attivi'],
      filtered.map((p) => [
        p.id,
        p.name,
        p.phone,
        p.notes || '',
        p.appointments_count ?? 0,
        p.booked_count ?? 0,
      ])
    );
  };

  const detailStats = useMemo(() => {
    if (!detailData) return { total: 0, upcoming: 0, cancelled: 0 };
    const now = Date.now();
    return {
      total: detailData.appointments.length,
      upcoming: detailData.appointments.filter(
        (a) => a.status === 'booked' && new Date(a.starts_at).getTime() >= now
      ).length,
      cancelled: detailData.appointments.filter((a) => a.status === 'cancelled').length,
    };
  }, [detailData]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
      {/* Patient Directory Table */}
      <section className="xl:col-span-8 surface-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-line)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold text-[var(--color-ink)]">
              Anagrafica clienti
            </h2>
            <p className="text-[12.5px] text-[var(--color-muted)] mt-0.5 tabular-nums">
              {filtered.length} di {patients.length} schede · clicca su un cliente per modificarlo
              e vedere lo storico
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-4 h-4 text-[var(--color-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cerca nome o telefono…"
                aria-label="Cerca cliente"
                className="w-full min-h-[38px] pl-9 pr-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[13px] text-[var(--color-ink)] placeholder:text-[var(--color-muted)]"
              />
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              className="min-h-[38px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[12.5px] font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-subtle)] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-[var(--color-muted)]" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[660px] border-collapse">
            <thead>
              <tr className="bg-[var(--color-surface-subtle)] border-b border-[var(--color-line)]">
                <th className="px-5 py-3 text-left text-[11.5px] font-semibold text-[var(--color-muted)]">
                  Cliente
                </th>
                <th className="px-5 py-3 text-left text-[11.5px] font-semibold text-[var(--color-muted)]">
                  Telefono
                </th>
                <th className="px-5 py-3 text-left text-[11.5px] font-semibold text-[var(--color-muted)]">
                  Note
                </th>
                <th className="px-5 py-3 text-right text-[11.5px] font-semibold text-[var(--color-muted)]">
                  Gestione
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <Users className="w-7 h-7 text-[var(--color-line-strong)] mx-auto mb-2" />
                    <div className="text-[14px] font-semibold text-[var(--color-ink)]">
                      Nessun cliente trovato
                    </div>
                    <p className="text-[12.5px] text-[var(--color-muted)] mt-0.5">
                      Modifica la ricerca o aggiungi una nuova scheda dal pannello laterale.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const isConfirming = confirmId === p.id;
                  const isDeleting = deletingId === p.id;
                  const linkedCount = Number(p.appointments_count || 0);

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-[var(--color-surface-subtle)]/50 transition-colors"
                    >
                      <td className="px-5 py-3.5 align-middle">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[var(--color-clinical-tint)] text-[var(--color-clinical)] text-[11.5px] font-semibold flex items-center justify-center shrink-0">
                            {initials(p.name)}
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => setDetailId(p.id)}
                              className="text-[13.5px] font-semibold text-[var(--color-ink)] hover:text-[var(--color-clinical)] text-left transition-colors"
                            >
                              {p.name}
                            </button>
                            {isConfirming && linkedCount > 0 ? (
                              <div className="text-[11.5px] text-[var(--color-alert)] mt-0.5 tabular-nums">
                                Elimina anche {linkedCount}{' '}
                                {linkedCount === 1
                                  ? 'appuntamento collegato'
                                  : 'appuntamenti collegati'}
                              </div>
                            ) : (
                              linkedCount > 0 && (
                                <div className="text-[11.5px] text-[var(--color-muted)] tabular-nums">
                                  {linkedCount}{' '}
                                  {linkedCount === 1 ? 'appuntamento' : 'appuntamenti'}
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 align-middle font-mono text-[12.5px] text-[var(--color-ink-soft)] tabular-nums whitespace-nowrap">
                        {p.phone}
                      </td>
                      <td className="px-5 py-3.5 align-middle text-[13px] text-[var(--color-muted)]">
                        {p.notes || '—'}
                      </td>
                      <td className="px-5 py-3.5 align-middle text-right whitespace-nowrap">
                        {isConfirming ? (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => setConfirmId(null)}
                              className="min-h-[34px] px-2.5 rounded-lg border border-[var(--color-line-strong)] bg-white text-[12px] font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-subtle)] transition-colors whitespace-nowrap"
                            >
                              Annulla
                            </button>
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => handleConfirmDelete(p.id)}
                              className="min-h-[34px] px-3 rounded-lg bg-[var(--color-alert)] text-white text-[12px] font-semibold hover:bg-[var(--color-alert-hover)] transition-colors disabled:opacity-60 whitespace-nowrap"
                            >
                              {isDeleting ? 'Eliminazione…' : 'Conferma'}
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setDetailId(p.id)}
                              className="min-h-[34px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[12px] font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-subtle)] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                            >
                              <FileText className="w-3.5 h-3.5 text-[var(--color-clinical)]" />
                              <span>Scheda</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmId(p.id)}
                              className="min-h-[34px] px-2.5 rounded-lg border border-[var(--color-line-strong)] bg-white text-[12px] font-medium text-[var(--color-alert)] hover:border-[var(--color-alert-border)] hover:bg-[var(--color-alert-tint)] transition-colors inline-flex items-center gap-1 whitespace-nowrap"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Elimina</span>
                            </button>
                          </div>
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

      {/* Add Patient Form */}
      <section className="xl:col-span-4 surface-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-line)]">
          <h2 className="text-[15.5px] font-semibold text-[var(--color-ink)] flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[var(--color-clinical)]" />
            <span>Aggiungi cliente</span>
          </h2>
          <p className="text-[12.5px] text-[var(--color-muted)] mt-0.5">
            Nome e recapito per appuntamenti e promemoria 24h
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label
              htmlFor="patient-name"
              className="block text-[12px] font-semibold text-[var(--color-ink-soft)] mb-1.5"
            >
              Nome e cognome
            </label>
            <input
              id="patient-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              placeholder="es. Giulia Conti"
              className="w-full min-h-[42px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[13.5px] text-[var(--color-ink)]"
            />
          </div>

          <div>
            <label
              htmlFor="patient-phone"
              className="block text-[12px] font-semibold text-[var(--color-ink-soft)] mb-1.5"
            >
              Telefono
            </label>
            <input
              id="patient-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              minLength={5}
              placeholder="+39 333 000 0000"
              className="w-full min-h-[42px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[13.5px] font-mono tabular-nums text-[var(--color-ink)]"
            />
          </div>

          <div>
            <label
              htmlFor="patient-notes"
              className="block text-[12px] font-semibold text-[var(--color-ink-soft)] mb-1.5"
            >
              Note (facoltative)
            </label>
            <input
              id="patient-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              placeholder="Preferenze orarie o note amministrative"
              className="w-full min-h-[42px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[13.5px] text-[var(--color-ink)]"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[42px] px-4 rounded-lg bg-[var(--color-clinical)] text-white text-[13px] font-semibold hover:bg-[var(--color-clinical-hover)] transition-colors disabled:opacity-60"
          >
            {submitting ? 'Salvataggio…' : 'Salva cliente'}
          </button>
        </form>
      </section>

      {/* Slide-Over Patient Detail & Edit Drawer */}
      {detailId !== null && (
        <div
          className="fixed inset-0 z-50 bg-[var(--color-backdrop)] backdrop-blur-[2px] flex justify-end animate-fade-in"
          onClick={() => setDetailId(null)}
        >
          <aside
            className="w-full max-w-[520px] h-full bg-white border-l border-[var(--color-line)] shadow-2xl flex flex-col overflow-hidden animate-slide-right"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="patient-detail-title"
          >
            <div className="px-6 py-5 border-b border-[var(--color-line)] flex items-start justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-[var(--color-clinical-tint)] text-[var(--color-clinical)] text-[13px] font-bold flex items-center justify-center shrink-0">
                  {detailData ? initials(detailData.patient.name) : '…'}
                </div>
                <div className="min-w-0">
                  <h3
                    id="patient-detail-title"
                    className="text-[17px] font-semibold text-[var(--color-ink)] truncate"
                  >
                    {detailData ? detailData.patient.name : 'Caricamento scheda…'}
                  </h3>
                  {detailData && (
                    <div className="text-[12px] text-[var(--color-muted)] mt-0.5 flex items-center gap-2 flex-wrap tabular-nums">
                      <span className="font-mono inline-flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {detailData.patient.phone}
                      </span>
                      <span>·</span>
                      <span>{detailStats.total} visite</span>
                      {detailStats.upcoming > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-[var(--color-clinical)] font-medium">
                            {detailStats.upcoming} in programma
                          </span>
                        </>
                      )}
                      {detailStats.cancelled > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-[var(--color-alert)]">
                            {detailStats.cancelled} disdette
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailId(null)}
                aria-label="Chiudi scheda cliente"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--color-muted)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-ink)] transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingDetail || !detailData ? (
                <div className="space-y-3">
                  <div className="h-32 rounded-lg bg-[var(--color-surface-subtle)] animate-pulse" />
                  <div className="h-44 rounded-lg bg-[var(--color-surface-subtle)] animate-pulse" />
                </div>
              ) : (
                <>
                  {/* Edit Patient Info */}
                  <form onSubmit={handleSaveEdit} className="space-y-3.5">
                    <h4 className="text-[13.5px] font-semibold text-[var(--color-ink)]">
                      Dati anagrafici
                    </h4>
                    <div>
                      <label
                        htmlFor="edit-patient-name"
                        className="block text-[11.5px] font-semibold text-[var(--color-ink-soft)] mb-1"
                      >
                        Nome e cognome
                      </label>
                      <input
                        id="edit-patient-name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        required
                        minLength={2}
                        className="w-full min-h-[40px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[13px] text-[var(--color-ink)]"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="edit-patient-phone"
                          className="block text-[11.5px] font-semibold text-[var(--color-ink-soft)] mb-1"
                        >
                          Telefono
                        </label>
                        <input
                          id="edit-patient-phone"
                          type="tel"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          required
                          minLength={5}
                          className="w-full min-h-[40px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white font-mono text-[13px] tabular-nums text-[var(--color-ink)]"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="edit-patient-notes"
                          className="block text-[11.5px] font-semibold text-[var(--color-ink-soft)] mb-1"
                        >
                          Note
                        </label>
                        <input
                          id="edit-patient-notes"
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          maxLength={500}
                          placeholder="Nessuna nota"
                          className="w-full min-h-[40px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[13px] text-[var(--color-ink)]"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={savingEdit}
                        className="min-h-[38px] px-4 rounded-lg bg-[var(--color-clinical)] text-white text-[12.5px] font-semibold hover:bg-[var(--color-clinical-hover)] transition-colors inline-flex items-center gap-1.5 disabled:opacity-60 whitespace-nowrap"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{savingEdit ? 'Salvataggio…' : 'Salva modifiche'}</span>
                      </button>
                    </div>
                  </form>

                  <div className="border-t border-[var(--color-line)]" />

                  {/* Appointment History */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-[13.5px] font-semibold text-[var(--color-ink)] flex items-center gap-1.5">
                        <CalendarDays className="w-4 h-4 text-[var(--color-clinical)]" />
                        <span>Storico appuntamenti ({detailData.appointments.length})</span>
                      </h4>
                    </div>

                    {detailData.appointments.length === 0 ? (
                      <p className="text-[12.5px] text-[var(--color-muted)]">
                        Nessun appuntamento registrato per questo cliente.
                      </p>
                    ) : (
                      <div className="border border-[var(--color-line)] rounded-lg divide-y divide-slate-100 overflow-hidden">
                        {detailData.appointments.map((appt) => {
                          const isCancelled = appt.status === 'cancelled';
                          const isConfirmed =
                            !isCancelled && appt.confirmation_state === 'confirmed';
                          const isPast = new Date(appt.starts_at).getTime() < Date.now();

                          return (
                            <div
                              key={appt.id}
                              className="px-4 py-3 bg-white flex items-start justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <div className="text-[13px] font-semibold text-[var(--color-ink)]">
                                  {appt.procedure}{' '}
                                  <span className="font-normal text-[var(--color-muted)] tabular-nums">
                                    · {appt.duration} min
                                  </span>
                                </div>
                                <div className="text-[12px] text-[var(--color-ink-soft)] mt-0.5 capitalize tabular-nums">
                                  {fmtDate(appt.starts_at, {
                                    weekday: 'short',
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })}{' '}
                                  ·{' '}
                                  <span className="font-mono">
                                    {fmtTimeRange(appt.starts_at, appt.duration)}
                                  </span>
                                </div>
                                <div className="text-[11.5px] text-[var(--color-muted)] mt-0.5">
                                  {appt.professional} · {appt.chair}
                                </div>
                              </div>

                              <div className="shrink-0 text-right">
                                {isCancelled ? (
                                  <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--color-alert)]">
                                    <XCircle className="w-3.5 h-3.5" />
                                    <span>Disdetto</span>
                                  </span>
                                ) : isConfirmed ? (
                                  <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--color-clinical)]">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Confermato</span>
                                  </span>
                                ) : isPast ? (
                                  <span className="text-[11.5px] font-medium text-[var(--color-muted)]">
                                    Concluso
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[var(--color-warn)]">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>Prenotato</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Reminders Sent History */}
                  {detailData.reminders.length > 0 && (
                    <>
                      <div className="border-t border-[var(--color-line)]" />
                      <div>
                        <h4 className="text-[13.5px] font-semibold text-[var(--color-ink)] mb-3">
                          Promemoria e comunicazioni ({detailData.reminders.length})
                        </h4>
                        <div className="border border-[var(--color-line)] rounded-lg divide-y divide-slate-100 overflow-hidden">
                          {detailData.reminders.map((rem) => {
                            const isSms = rem.sent_via === 'textbee_sms';
                            return (
                              <div
                                key={rem.id}
                                className="px-4 py-2.5 bg-white flex items-center justify-between gap-3 text-[12px]"
                              >
                                <div className="min-w-0">
                                  <div className="font-medium text-[var(--color-ink)] truncate">
                                    {rem.procedure} ·{' '}
                                    <span className="font-mono tabular-nums text-[var(--color-muted)]">
                                      {fmtDate(rem.starts_at, { day: 'numeric', month: 'short' })}{' '}
                                      {fmtTime(rem.starts_at)}
                                    </span>
                                  </div>
                                  {rem.sent_at && (
                                    <div className="text-[11px] text-[var(--color-muted)] tabular-nums">
                                      Inviato il {fmtDate(rem.sent_at, { day: 'numeric', month: 'short' })}{' '}
                                      alle {fmtTime(rem.sent_at)}
                                    </div>
                                  )}
                                </div>
                                <div className="shrink-0 inline-flex items-center gap-1 font-medium text-[var(--color-ink-soft)]">
                                  {isSms ? (
                                    <Smartphone className="w-3.5 h-3.5 text-[var(--color-clinical)]" />
                                  ) : (
                                    <MessageCircle className="w-3.5 h-3.5 text-[var(--color-clinical)]" />
                                  )}
                                  <span>
                                    {rem.status === 'responded'
                                      ? 'Risposto'
                                      : rem.status === 'sent'
                                        ? isSms
                                          ? 'SMS'
                                          : 'WhatsApp'
                                        : rem.status === 'prepared'
                                          ? 'In coda'
                                          : 'Annullato'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
