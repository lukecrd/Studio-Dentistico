import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, CheckCircle2, XCircle, AlertCircle, CalendarDays, UserCheck } from 'lucide-react';
import { api } from '../api';
import { BrandMark } from './BrandMark';

interface PublicConfirmationViewProps {
  initialCode?: string;
  onExitPortal: () => void;
}

interface PublicAppointment {
  patient: string;
  procedure: string;
  professional: string;
  starts_at: string;
}

export function PublicConfirmationView({
  initialCode = '',
  onExitPortal,
}: PublicConfirmationViewProps) {
  const [inputCode, setInputCode] = useState(initialCode.toUpperCase());
  const [activeCode, setActiveCode] = useState(initialCode.toUpperCase());
  const [loading, setLoading] = useState(Boolean(initialCode));
  const [submitting, setSubmitting] = useState(false);
  const [appointment, setAppointment] = useState<PublicAppointment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultState, setResultState] = useState<'confirmed' | 'cancelled' | null>(null);

  const lookupCode = useCallback(async (codeToVerify: string) => {
    const clean = codeToVerify.trim().toUpperCase();
    if (!clean) return;
    setActiveCode(clean);
    setLoading(true);
    setError(null);
    setAppointment(null);
    setResultState(null);
    try {
      const data = await api<{ appointment: PublicAppointment }>(
        `/api/public/confirm?code=${encodeURIComponent(clean)}`
      );
      setAppointment(data.appointment);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Codice non disponibile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialCode) {
      lookupCode(initialCode);
    }
  }, [initialCode, lookupCode]);

  const handleCodeSubmit = (e: FormEvent) => {
    e.preventDefault();
    lookupCode(inputCode);
  };

  const handleDecision = async (action: 'confirm' | 'cancel') => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api<{ state: 'confirmed' | 'cancelled' }>('/api/public/confirm', {
        method: 'POST',
        body: JSON.stringify({ code: activeCode, action }),
      });
      setResultState(res.state);
      setAppointment(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operazione non completata');
    } finally {
      setSubmitting(false);
    }
  };

  const resetToCodeEntry = () => {
    setActiveCode('');
    setInputCode('');
    setAppointment(null);
    setError(null);
    setResultState(null);
  };

  const formattedWhen = appointment
    ? new Intl.DateTimeFormat('it-IT', {
        dateStyle: 'full',
        timeStyle: 'short',
        timeZone: 'Europe/Rome',
      }).format(new Date(appointment.starts_at))
    : '';

  return (
    <main className="min-h-screen bg-[var(--color-canvas)] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-[460px]">
        <div className="bg-white border border-[var(--color-line)] rounded-2xl p-8 sm:p-9 shadow-[0_8px_30px_rgba(24,35,29,0.04)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <BrandMark />
              <div>
                <div className="font-[var(--font-display)] text-[17px] font-bold tracking-[-0.025em] text-[var(--color-ink)] leading-tight">
                  AgendaSmart
                </div>
                <div className="text-[11.5px] text-[var(--color-muted)] mt-0.5">
                  Portale conferme pazienti
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onExitPortal}
              className="text-[12px] font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)] inline-flex items-center gap-1 whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Area studio</span>
            </button>
          </div>

          {loading ? (
            <div className="mt-8 py-6 text-center space-y-2">
              <div className="text-[17px] font-semibold text-[var(--color-ink)]">
                Verifica appuntamento
              </div>
              <p className="text-[13.5px] text-[var(--color-muted)]">
                Controllo del codice monouso in corso…
              </p>
            </div>
          ) : resultState ? (
            <div className="mt-8 space-y-4">
              <div className="flex items-center gap-2.5">
                {resultState === 'confirmed' ? (
                  <CheckCircle2 className="w-6 h-6 text-[var(--color-clinical)] shrink-0" />
                ) : (
                  <XCircle className="w-6 h-6 text-[var(--color-alert)] shrink-0" />
                )}
                <h1 className="text-[22px] font-bold tracking-[-0.025em] text-[var(--color-ink)]">
                  {resultState === 'confirmed'
                    ? 'Appuntamento confermato'
                    : 'Disdetta registrata'}
                </h1>
              </div>
              <p className="text-[14px] text-[var(--color-ink-soft)] leading-relaxed">
                {resultState === 'confirmed'
                  ? 'Grazie, abbiamo registrato la tua conferma in agenda. Ti aspettiamo in studio.'
                  : 'La disdetta è stata registrata e lo spazio è stato liberato. Grazie per averci avvisato.'}
              </p>
              <button
                type="button"
                onClick={onExitPortal}
                className="w-full min-h-[42px] mt-2 px-4 rounded-lg border border-[var(--color-line-strong)] bg-white text-[13px] font-semibold text-[var(--color-ink)] hover:bg-[var(--color-surface-subtle)] transition-colors"
              >
                Torna ad AgendaSmart
              </button>
            </div>
          ) : appointment ? (
            <div className="mt-8 space-y-5">
              <div>
                <h1 className="text-[24px] font-bold tracking-[-0.025em] text-[var(--color-ink)]">
                  Ciao {appointment.patient}.
                </h1>
                <p className="text-[14px] text-[var(--color-ink-soft)] mt-1">
                  Ecco i dettagli del tuo prossimo appuntamento:
                </p>
              </div>

              <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-subtle)] p-4 space-y-2.5">
                <div className="text-[15.5px] font-semibold text-[var(--color-ink)]">
                  {appointment.procedure}
                </div>
                <div className="flex items-center gap-2 text-[13.5px] text-[var(--color-ink-soft)] capitalize">
                  <CalendarDays className="w-4 h-4 text-[var(--color-clinical)] shrink-0" />
                  <span>{formattedWhen}</span>
                </div>
                <div className="flex items-center gap-2 text-[13.5px] text-[var(--color-ink-soft)]">
                  <UserCheck className="w-4 h-4 text-[var(--color-clinical)] shrink-0" />
                  <span>con {appointment.professional}</span>
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-[#ebd0cb] bg-[var(--color-alert-tint)] px-3.5 py-2.5 text-[13px] text-[var(--color-alert)] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleDecision('confirm')}
                  className="w-full min-h-[46px] px-4 rounded-lg bg-[var(--color-clinical)] text-white text-[14px] font-semibold hover:bg-[var(--color-clinical-hover)] transition-colors disabled:opacity-60"
                >
                  {submitting ? 'Registrazione…' : 'Conferma appuntamento'}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleDecision('cancel')}
                  className="w-full min-h-[46px] px-4 rounded-lg border border-[#e3c3bd] bg-white text-[14px] font-semibold text-[var(--color-alert)] hover:bg-[var(--color-alert-tint)] transition-colors disabled:opacity-60"
                >
                  Disdici appuntamento
                </button>
              </div>

              <p className="text-[12px] text-[var(--color-muted)] text-center">
                Il codice <span className="font-mono">{activeCode}</span> è personale e utilizzabile
                una sola volta.
              </p>
            </div>
          ) : (
            <div className="mt-8 space-y-5">
              <div>
                <h1 className="text-[24px] font-bold tracking-[-0.025em] text-[var(--color-ink)]">
                  Conferma appuntamento
                </h1>
                <p className="text-[14px] text-[var(--color-ink-soft)] mt-1 leading-relaxed">
                  Inserisci il codice di 10 caratteri ricevuto nel promemoria dello studio.
                </p>
              </div>

              {error && (
                <div className="rounded-lg border border-[#ebd0cb] bg-[var(--color-alert-tint)] px-3.5 py-2.5 text-[13px] text-[var(--color-alert)] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div>{error}</div>
                    {activeCode && (
                      <button
                        type="button"
                        onClick={resetToCodeEntry}
                        className="mt-1 underline font-medium"
                      >
                        Inserisci un altro codice
                      </button>
                    )}
                  </div>
                </div>
              )}

              <form onSubmit={handleCodeSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="public-confirm-code"
                    className="block text-[12px] font-semibold text-[var(--color-ink-soft)] mb-1.5"
                  >
                    Codice di conferma
                  </label>
                  <input
                    id="public-confirm-code"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    autoComplete="one-time-code"
                    minLength={10}
                    maxLength={10}
                    required
                    placeholder="Es. A1B2C3D4E5"
                    className="w-full min-h-[46px] px-3.5 rounded-lg border border-[var(--color-line-strong)] bg-white font-mono text-[15px] tracking-[0.12em] uppercase text-[var(--color-ink)]"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full min-h-[44px] px-4 rounded-lg bg-[var(--color-clinical)] text-white text-[14px] font-semibold hover:bg-[var(--color-clinical-hover)] transition-colors"
                >
                  Verifica codice
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
