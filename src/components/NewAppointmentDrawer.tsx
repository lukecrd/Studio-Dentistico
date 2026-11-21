import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { X, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { BookingPrefill, CatalogData } from '../types';
import { dateISO, parseJsonArray } from '../api';

interface NewAppointmentDrawerProps {
  open: boolean;
  prefill?: BookingPrefill;
  defaultDate: Date;
  catalog: CatalogData;
  onClose: () => void;
  onSubmit: (payload: {
    patient_id: number;
    procedure_id: number;
    professional_id: number;
    chair_id: number;
    starts_at: string;
  }) => Promise<void>;
}

export function NewAppointmentDrawer({
  open,
  prefill,
  defaultDate,
  catalog,
  onClose,
  onSubmit,
}: NewAppointmentDrawerProps) {
  const [patientId, setPatientId] = useState<string>('');
  const [procedureId, setProcedureId] = useState<string>('');
  const [professionalId, setProfessionalId] = useState<string>('');
  const [chairId, setChairId] = useState<string>('');
  const [startsAt, setStartsAt] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    const initialProc =
      (prefill?.procedureId
        ? catalog.procedures.find((p) => p.id === prefill.procedureId)
        : undefined) || catalog.procedures[0];
    const initialPatient = catalog.patients[0];
    const targetDate = prefill?.dateISO || dateISO(defaultDate);
    const targetHour = String(prefill?.hour ?? 9).padStart(2, '0');
    const targetMinute = String(prefill?.minute ?? 0).padStart(2, '0');

    setPatientId(initialPatient ? String(initialPatient.id) : '');
    setProcedureId(initialProc ? String(initialProc.id) : '');

    if (prefill?.professionalId) {
      setProfessionalId(String(prefill.professionalId));
    } else if (catalog.professionals[0]) {
      setProfessionalId(String(catalog.professionals[0].id));
    }

    if (prefill?.chairId) {
      setChairId(String(prefill.chairId));
    } else if (catalog.chairs[0]) {
      setChairId(String(catalog.chairs[0].id));
    }

    setStartsAt(`${targetDate}T${targetHour}:${targetMinute}`);
  }, [open, prefill, defaultDate, catalog]);

  const selectedProcedure = useMemo(
    () => catalog.procedures.find((p) => String(p.id) === procedureId),
    [catalog.procedures, procedureId]
  );

  const requiredResources = useMemo(
    () => parseJsonArray<string>(selectedProcedure?.resources),
    [selectedProcedure]
  );

  const selectedProfessional = useMemo(
    () => catalog.professionals.find((p) => String(p.id) === professionalId),
    [catalog.professionals, professionalId]
  );

  const selectedChair = useMemo(
    () => catalog.chairs.find((c) => String(c.id) === chairId),
    [catalog.chairs, chairId]
  );

  const isProfCompatible = useMemo(() => {
    if (!selectedProcedure || !selectedProfessional) return true;
    const enabledIds = parseJsonArray<number>(selectedProfessional.procedure_ids);
    return enabledIds.includes(selectedProcedure.id);
  }, [selectedProcedure, selectedProfessional]);

  const isChairCompatible = useMemo(() => {
    if (!selectedProcedure || !selectedChair) return true;
    const chairRes = parseJsonArray<string>(selectedChair.resources);
    return requiredResources.every((r) => chairRes.includes(r));
  }, [selectedProcedure, selectedChair, requiredResources]);

  // Auto-select compatible chair & professional when procedure changes if current is incompatible
  const handleProcedureChange = (nextProcId: string) => {
    setProcedureId(nextProcId);
    const proc = catalog.procedures.find((p) => String(p.id) === nextProcId);
    if (!proc) return;
    const req = parseJsonArray<string>(proc.resources);

    const currentProf = catalog.professionals.find((p) => String(p.id) === professionalId);
    if (!currentProf || !parseJsonArray<number>(currentProf.procedure_ids).includes(proc.id)) {
      const compatibleProf = catalog.professionals.find((p) =>
        parseJsonArray<number>(p.procedure_ids).includes(proc.id)
      );
      if (compatibleProf) setProfessionalId(String(compatibleProf.id));
    }

    const currentChair = catalog.chairs.find((c) => String(c.id) === chairId);
    if (
      !currentChair ||
      !req.every((r) => parseJsonArray<string>(currentChair.resources).includes(r))
    ) {
      const compatibleChair = catalog.chairs.find((c) =>
        req.every((r) => parseJsonArray<string>(c.resources).includes(r))
      );
      if (compatibleChair) setChairId(String(compatibleChair.id));
    }
  };

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        patient_id: Number(patientId),
        procedure_id: Number(procedureId),
        professional_id: Number(professionalId),
        chair_id: Number(chairId),
        starts_at: new Date(startsAt).toISOString(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossibile salvare l’appuntamento');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#18231d]/40 backdrop-blur-[1px] flex justify-end"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="w-full max-w-[460px] h-full bg-white border-l border-[var(--color-line)] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-new-appt-title"
      >
        <div className="px-6 py-5 border-b border-[var(--color-line)] flex items-center justify-between gap-4">
          <div>
            <h2
              id="drawer-new-appt-title"
              className="text-[18px] font-semibold text-[var(--color-ink)]"
            >
              Nuovo appuntamento
            </h2>
            <p className="text-[12.5px] text-[var(--color-muted)] mt-0.5">
              Controllo automatico abilitazioni, attrezzature e sovrapposizioni
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi pannello"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--color-muted)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-ink)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {prefill?.replacingLabel && (
            <div className="rounded-lg border border-[#d6e5d9] bg-[var(--color-clinical-tint)]/60 px-4 py-3 text-[12.5px] text-[var(--color-clinical)]">
              <div className="font-semibold">Rimpiazzo slot disdetto</div>
              <div className="mt-0.5 text-[var(--color-ink-soft)]">{prefill.replacingLabel}</div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-[#ebd0cb] bg-[var(--color-alert-tint)] px-4 py-3 text-[13px] text-[var(--color-alert)] flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="booking-patient"
              className="block text-[12px] font-semibold text-[var(--color-ink-soft)] mb-1.5"
            >
              Paziente
            </label>
            <select
              id="booking-patient"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              required
              className="w-full min-h-[42px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[13.5px] text-[var(--color-ink)]"
            >
              {catalog.patients.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name} · {p.phone}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="booking-procedure"
              className="block text-[12px] font-semibold text-[var(--color-ink-soft)] mb-1.5"
            >
              Prestazione
            </label>
            <select
              id="booking-procedure"
              value={procedureId}
              onChange={(e) => handleProcedureChange(e.target.value)}
              required
              className="w-full min-h-[42px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[13.5px] text-[var(--color-ink)]"
            >
              {catalog.procedures.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name} · {p.duration} min ({p.specialty})
                </option>
              ))}
            </select>
            {selectedProcedure && (
              <div className="mt-1.5 text-[12px] text-[var(--color-muted)]">
                Attrezzature richieste:{' '}
                <span className="text-[var(--color-ink-soft)] font-medium">
                  {requiredResources.length ? requiredResources.join(' · ') : 'nessuna specifica'}
                </span>
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="booking-professional"
              className="block text-[12px] font-semibold text-[var(--color-ink-soft)] mb-1.5"
            >
              Professionista
            </label>
            <select
              id="booking-professional"
              value={professionalId}
              onChange={(e) => setProfessionalId(e.target.value)}
              required
              className="w-full min-h-[42px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[13.5px] text-[var(--color-ink)]"
            >
              {catalog.professionals.map((p) => {
                const enabled = selectedProcedure
                  ? parseJsonArray<number>(p.procedure_ids).includes(selectedProcedure.id)
                  : true;
                return (
                  <option key={p.id} value={String(p.id)}>
                    {p.name} ({p.specialty}){!enabled ? ' — non abilitato' : ''}
                  </option>
                );
              })}
            </select>
            {!isProfCompatible && (
              <p className="mt-1.5 text-[12px] text-[var(--color-alert)]">
                Questo professionista non risulta abilitato per la prestazione selezionata.
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="booking-chair"
              className="block text-[12px] font-semibold text-[var(--color-ink-soft)] mb-1.5"
            >
              Stanza / Poltrona
            </label>
            <select
              id="booking-chair"
              value={chairId}
              onChange={(e) => setChairId(e.target.value)}
              required
              className="w-full min-h-[42px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[13.5px] text-[var(--color-ink)]"
            >
              {catalog.chairs.map((c) => {
                const chairRes = parseJsonArray<string>(c.resources);
                const compatible = requiredResources.every((r) => chairRes.includes(r));
                return (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                    {chairRes.length ? ` · ${chairRes.join(', ')}` : ''}
                    {!compatible ? ' — risorse mancanti' : ''}
                  </option>
                );
              })}
            </select>
            {!isChairCompatible && (
              <p className="mt-1.5 text-[12px] text-[var(--color-alert)]">
                La stanza selezionata non dispone delle attrezzature richieste.
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="booking-datetime"
              className="block text-[12px] font-semibold text-[var(--color-ink-soft)] mb-1.5"
            >
              Data e ora
            </label>
            <input
              id="booking-datetime"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              required
              className="w-full min-h-[42px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[13.5px] font-mono tabular-nums text-[var(--color-ink)]"
            />
          </div>

          {isProfCompatible && isChairCompatible && selectedProcedure && (
            <div className="rounded-lg border border-[#d6e5d9] bg-[var(--color-clinical-tint)]/50 px-3.5 py-2.5 text-[12.5px] text-[var(--color-clinical)] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Combinazione professionista e poltrona compatibile.</span>
            </div>
          )}

          <div className="pt-4 border-t border-[var(--color-line)] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="min-h-[40px] px-4 rounded-lg border border-[var(--color-line-strong)] bg-white text-[13px] font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-subtle)] transition-colors whitespace-nowrap"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[40px] px-5 rounded-lg bg-[var(--color-clinical)] text-white text-[13px] font-semibold hover:bg-[var(--color-clinical-hover)] transition-colors disabled:opacity-60 whitespace-nowrap"
            >
              {submitting ? 'Salvataggio…' : 'Conferma appuntamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
