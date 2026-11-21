import { useState, type FormEvent } from 'react';
import { AlertCircle, ArrowRight, KeyRound } from 'lucide-react';
import { BrandMark } from './BrandMark';

interface LoginViewProps {
  onLogin: (username: string, password: string) => Promise<void>;
  onOpenPublicPortal: () => void;
}

export function LoginView({ onLogin, onOpenPublicPortal }: LoginViewProps) {
  const [username, setUsername] = useState('segreteria');
  const [password, setPassword] = useState('agenda2025!');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onLogin(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Credenziali non valide');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--color-canvas)] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-[440px]">
        <div className="bg-white border border-[var(--color-line)] rounded-2xl p-8 sm:p-9 shadow-[0_8px_30px_rgba(24,35,29,0.04)]">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div>
              <div className="font-[var(--font-display)] text-[17px] font-bold tracking-[-0.025em] text-[var(--color-ink)] leading-tight">
                AgendaSmart
              </div>
              <div className="text-[11.5px] text-[var(--color-muted)] mt-0.5">
                Studio Odontoiatrico
              </div>
            </div>
          </div>

          <h1 className="mt-8 text-[28px] font-bold tracking-[-0.03em] text-[var(--color-ink)] leading-tight">
            Buongiorno.
          </h1>
          <p className="mt-1.5 text-[14px] text-[var(--color-ink-soft)] leading-relaxed">
            Accedi all&apos;agenda condivisa dello studio per gestire visite, poltrone e recupero
            disdette.
          </p>

          {error && (
            <div className="mt-5 rounded-lg border border-[#ebd0cb] bg-[var(--color-alert-tint)] px-3.5 py-2.5 text-[13px] text-[var(--color-alert)] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="login-user"
                className="block text-[12px] font-semibold text-[var(--color-ink-soft)] mb-1.5"
              >
                Utente
              </label>
              <input
                id="login-user"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                className="w-full min-h-[44px] px-3.5 rounded-lg border border-[var(--color-line-strong)] bg-white text-[14px] text-[var(--color-ink)]"
              />
            </div>

            <div>
              <label
                htmlFor="login-pass"
                className="block text-[12px] font-semibold text-[var(--color-ink-soft)] mb-1.5"
              >
                Password
              </label>
              <input
                id="login-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full min-h-[44px] px-3.5 rounded-lg border border-[var(--color-line-strong)] bg-white text-[14px] text-[var(--color-ink)]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[44px] mt-2 px-4 rounded-lg bg-[var(--color-clinical)] text-white text-[14px] font-semibold hover:bg-[var(--color-clinical-hover)] transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <span>{submitting ? 'Accesso in corso…' : 'Accedi all’agenda'}</span>
              {!submitting && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-[var(--color-line)] flex flex-col gap-3 text-center">
            <p className="text-[12px] text-[var(--color-muted)]">
              Credenziali demo precompilate · utente{' '}
              <span className="font-mono text-[var(--color-ink-soft)]">segreteria</span> o{' '}
              <span className="font-mono text-[var(--color-ink-soft)]">admin</span>
            </p>
            <button
              type="button"
              onClick={onOpenPublicPortal}
              className="inline-flex items-center justify-center gap-1.5 text-[12.5px] font-medium text-[var(--color-clinical)] hover:underline"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Sei un paziente? Apri il portale conferma codice</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
