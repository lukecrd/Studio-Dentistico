import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  CalendarDays,
  UserCheck,
  DoorOpen,
} from 'lucide-react';
import { api } from '../api';
import { BrandMark } from './BrandMark';

interface PublicProposalViewProps {
  initialCode?: string;
  onExitPortal: () => void;
}

interface PublicProposal {
  patient: string;
  procedure: string;
  duration: number;
  original_starts_at: string;
  freed_starts_at: string;
  freed_professional: string;
  freed_chair: string;
}

export function PublicProposalView({ initialCode = '', onExitPortal }: PublicProposalViewProps) {
  const [inputCode, setInputCode] = useState(initialCode.toUpperCase());
  const [activeCode, setActiveCode] = useState(initialCode.toUpperCase());
  const [loading, setLoading] = useState(Boolean(initialCode));
  const [submitting, setSubmitting] = useState(false);
  const [proposal, setProposal] = useState<PublicProposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultState, setResultState] = useState<'accepted_waiting_approval' | 'declined' | null>(
    null
  );

  const lookupCode = useCallback(async (codeToVerify: string) => {
    const clean = codeToVerify.trim().toUpperCase();
    if (!clean) return;
    setActiveCode(clean);
    setLoading(true);
    setError(null);
    setProposal(null);
    setResultState(null);
    try {
      const data = await api<{ proposal: PublicProposal }>(
        `/api/public/proposal?code=${encodeURIComponent(clean)}`
      );
      setProposal(data.proposal);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Proposta non disponibile');
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

  const handleDecision = async (action: 'accept' | 'decline') => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api<{ state: 'accepted_waiting_approval' | 'declined' }>(
        '/api/public/proposal',
        {
          method: 'POST',
          body: JSON.stringify({ code: activeCode, action }),
        }
      );
      setResultState(res.state);
      setProposal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operazione non completata');
    } finally {
      setSubmitting(false);
    }
  };

  const formatSlot = (iso: string) =>
    new Intl.DateTimeFormat('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Rome',
    }).format(new Date(iso));

  return (
    <main className="min-h-screen bg-[var(--color-canvas)] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-[480px]">
        <div className="bg-white border border-[var(--color-line)] rounded-2xl p-8 sm:p-9 shadow-[0_8px_30px_rgba(24,35,29,0.04)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <BrandMark />
              <div>
                <div className="font-[var(--font-display)] text-[17px] font-bold tracking-[-0.025em] text-[var(--color-ink)] leading-tight">
                  AgendaSmart
                </div>
                <div className="text-[11.5px] text-[var(--color-muted)] mt-0.5">
                  Proposta anticipo appuntamento
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
                Verifica proposta di anticipo
              </div>
              <p className="text-[13.5px] text-[var(--color-muted)]">
                Controllo disponibilità dello slot in corso…
              </p>
            </div>
          ) : resultState ? (
            <div className="mt-8 space-y-4">
              <div className="flex items-center gap-2.5">
                {resultState === 'accepted_waiting_approval' ? (
                  <CheckCircle2 className="w-6 h-6 text-[var(--color-clinical)] shrink-0" />
                ) : (
                  <XCircle className="w-6 h-6 text-[var(--color-muted)] shrink-0" />
                )}
                <h1 className="text-[22px] font-bold tracking-[-0.025em] text-[var(--color-ink)]">
                  {resultState === 'accepted_waiting_approval'
                    ? 'Richiesta di anticipo inviata'
                    : 'Appuntamento originale mantenuto'}
                </h1>
              </div>
              <p className="text-[14px] text-[var(--color-ink-soft)] leading-relaxed">
                {resultState === 'accepted_waiting_approval'
                  ? 'Grazie! Abbiamo segnalato alla segreteria la tua disponibilità ad anticipare la visita. Riceverai un SMS di conferma appena lo spostamento sarà approvato.'
                  : 'Nessun problema: il tuo appuntamento rimane confermato nella data e nell’orario originali.'}
              </p>
              <button
                type="button"
                onClick={onExitPortal}
                className="w-full min-h-[42px] mt-2 px-4 rounded-lg border border-[var(--color-line-strong)] bg-white text-[13px] font-semibold text-[var(--color-ink)] hover:bg-[var(--color-surface-subtle)] transition-colors"
              >
                Torna ad AgendaSmart
              </button>
            </div>
          ) : proposal ? (
            <div className="mt-8 space-y-5">
              <div>
                <h1 className="text-[24px] font-bold tracking-[-0.025em] text-[var(--color-ink)]">
                  Ciao {proposal.patient}.
                </h1>
                <p className="text-[14px] text-[var(--color-ink-soft)] mt-1">
                  Si è liberato uno spazio anticipato per il tuo trattamento. Vuoi spostare la tua
                  visita?
                </p>
              </div>

              <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-subtle)] p-4 space-y-3">
                <div className="text-[15.5px] font-semibold text-[var(--color-ink)]">
                  {proposal.procedure} ·{' '}
                  <span className="font-mono text-[13.5px] tabular-nums text-[var(--color-muted)]">
                    {proposal.duration} min
                  </span>
                </div>

                <div className="space-y-2 text-[13px]">
                  <div className="flex items-start gap-2 text-[var(--color-muted)]">
                    <CalendarDays className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[11px] font-medium">Appuntamento attuale</div>
                      <div className="capitalize line-through">
                        {formatSlot(proposal.original_starts_at)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 text-[var(--color-clinical)]">
                    <ArrowRight className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[11px] font-semibold">Nuovo slot anticipato</div>
                      <div className="capitalize font-semibold text-[var(--color-ink)]">
                        {formatSlot(proposal.freed_starts_at)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--color-line)] flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-[var(--color-ink-soft)]">
                  <span className="inline-flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-[var(--color-clinical)]" />
                    <span>{proposal.freed_professional}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <DoorOpen className="w-3.5 h-3.5 text-[var(--color-clinical)]" />
                    <span>{proposal.freed_chair}</span>
                  </span>
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
                  onClick={() => handleDecision('accept')}
                  className="w-full min-h-[46px] px-4 rounded-lg bg-[var(--color-clinical)] text-white text-[14px] font-semibold hover:bg-[var(--color-clinical-hover)] transition-colors disabled:opacity-60"
                >
                  {submitting ? 'Registrazione…' : 'Accetta slot anticipato'}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleDecision('decline')}
                  className="w-full min-h-[46px] px-4 rounded-lg border border-[var(--color-line-strong)] bg-white text-[14px] font-semibold text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-subtle)] transition-colors disabled:opacity-60"
                >
                  Mantieni appuntamento attuale
                </button>
              </div>

              <p className="text-[12px] text-[var(--color-muted)] text-center">
                Codice personale <span className="font-mono">{activeCode}</span> · lo spostamento
                sarà confermato dalla segreteria.
              </p>
            </div>
          ) : (
            <div className="mt-8 space-y-5">
              <div>
                <h1 className="text-[24px] font-bold tracking-[-0.025em] text-[var(--color-ink)]">
                  Proposta di anticipo
                </h1>
                <p className="text-[14px] text-[var(--color-ink-soft)] mt-1 leading-relaxed">
                  Inserisci il codice di 10 caratteri ricevuto via SMS dallo studio.
                </p>
              </div>

              {error && (
                <div className="rounded-lg border border-[#ebd0cb] bg-[var(--color-alert-tint)] px-3.5 py-2.5 text-[13px] text-[var(--color-alert)] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleCodeSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="public-proposal-code"
                    className="block text-[12px] font-semibold text-[var(--color-ink-soft)] mb-1.5"
                  >
                    Codice proposta
                  </label>
                  <input
                    id="public-proposal-code"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    autoComplete="one-time-code"
                    minLength={10}
                    maxLength={10}
                    required
                    placeholder="Es. K7M9P2Q4W8"
                    className="w-full min-h-[46px] px-3.5 rounded-lg border border-[var(--color-line-strong)] bg-white font-mono text-[15px] tracking-[0.12em] uppercase text-[var(--color-ink)]"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full min-h-[44px] px-4 rounded-lg bg-[var(--color-clinical)] text-white text-[14px] font-semibold hover:bg-[var(--color-clinical-hover)] transition-colors"
                >
                  Verifica proposta
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
