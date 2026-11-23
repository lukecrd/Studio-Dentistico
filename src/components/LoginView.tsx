import { useState, type FormEvent } from 'react';
import { AlertCircle, ArrowRight, KeyRound, CalendarCheck2, Smartphone, Users } from 'lucide-react';
import { BrandMark } from './BrandMark';

import studioHeroImage from '../assets/images/dental_studio_architecture_1795379180404.jpg';

interface LoginViewProps {
  onLogin: (username: string, password: string) => Promise<void>;
  onOpenPublicPortal: () => void;
}

const STUDIO_HERO_IMAGE = studioHeroImage;

export function LoginView({ onLogin, onOpenPublicPortal }: LoginViewProps) {
  const [username, setUsername] = useState('segreteria');
  const [password, setPassword] = useState('agenda2025!');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

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
    <main className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-white">
      {/* Left Architectural Editorial Showcase */}
      <section className="relative hidden lg:flex lg:col-span-7 flex-col justify-between overflow-hidden bg-[#0f172a] p-12 text-white">
        {!imgFailed ? (
          <img
            src={STUDIO_HERO_IMAGE}
            alt="Interno contemporaneo di uno studio odontoiatrico con pietra travertino e luce naturale"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
        ) : (
          <div
            className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#134e4a] to-[#0f172a]"
            aria-hidden="true"
          />
        )}

        {/* Measured Contrast Scrim */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-slate-950/92 via-slate-950/45 to-slate-950/25"
          aria-hidden="true"
        />

        {/* Top Brand Mark */}
        <div className="relative z-10 flex items-center gap-3">
          <BrandMark tone="dark" />
          <div>
            <div className="font-[var(--font-display)] text-[17px] font-bold tracking-[-0.02em] text-white leading-tight">
              AgendaSmart
            </div>
            <div className="text-[12px] text-slate-200/80 mt-0.5">
              Studio Odontoiatrico
            </div>
          </div>
        </div>

        {/* Bottom Editorial Statement */}
        <div className="relative z-10 max-w-[540px] space-y-6">
          <h2 className="font-[var(--font-display)] text-[34px] xl:text-[38px] font-bold tracking-[-0.03em] leading-[1.15] text-white">
            Ogni poltrona coordinata, ogni disdetta recuperata con precisione.
          </h2>
          <p className="text-[15px] text-slate-200/90 leading-relaxed max-w-[46ch]">
            Un’unica agenda condivisa per professionisti, stanze operative, promemoria SMS e
            proposte di anticipo confermate direttamente dal paziente.
          </p>

          <div className="pt-5 border-t border-white/15 grid grid-cols-3 gap-6 text-[12.5px]">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-teal-300 font-semibold">
                <CalendarCheck2 className="w-4 h-4 shrink-0" />
                <span>Agenda clinica</span>
              </div>
              <p className="text-slate-300/85 leading-snug">
                Controllo abilitazioni e attrezzature per poltrona
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-teal-300 font-semibold">
                <Smartphone className="w-4 h-4 shrink-0" />
                <span>SMS e WhatsApp</span>
              </div>
              <p className="text-slate-300/85 leading-snug">
                Promemoria 24h e proposte di anticipo dal telefono
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-teal-300 font-semibold">
                <Users className="w-4 h-4 shrink-0" />
                <span>Schede pazienti</span>
              </div>
              <p className="text-slate-300/85 leading-snug">
                Storico visite, conferme e riepiloghi pronti da stampare
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Right Workspace Sign-In Column */}
      <section className="lg:col-span-5 flex flex-col justify-between px-6 py-10 sm:px-12 lg:px-14 bg-white">
        {/* Mobile Brand Header */}
        <div className="flex items-center gap-3 lg:hidden">
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

        <div className="w-full max-w-[380px] mx-auto my-auto py-8">
          <div className="text-[12px] font-semibold text-[var(--color-clinical)] tracking-tight mb-2">
            Area riservata segreteria
          </div>
          <h1 className="text-[30px] font-bold tracking-[-0.03em] text-[var(--color-ink)] leading-tight">
            Accedi allo studio.
          </h1>
          <p className="mt-2 text-[14px] text-[var(--color-muted)] leading-relaxed">
            Inserisci le tue credenziali per aprire il calendario operativo e gestire gli
            appuntamenti della giornata.
          </p>

          {error && (
            <div className="mt-5 rounded-lg border border-[var(--color-alert-border)] bg-[var(--color-alert-tint)] px-3.5 py-2.5 text-[13px] text-[var(--color-alert)] flex items-start gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div>
              <label
                htmlFor="login-user"
                className="block text-[12.5px] font-semibold text-[var(--color-ink-soft)] mb-1.5"
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
                className="block text-[12.5px] font-semibold text-[var(--color-ink-soft)] mb-1.5"
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
              className="w-full min-h-[44px] mt-2 px-4 rounded-lg bg-[var(--color-clinical)] text-white text-[14px] font-semibold hover:bg-[var(--color-clinical-hover)] transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-60 shadow-[0_1px_2px_rgba(15,118,110,0.2)]"
            >
              <span>{submitting ? 'Accesso in corso…' : 'Accedi all’agenda'}</span>
              {!submitting && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="mt-7 pt-6 border-t border-[var(--color-line)] space-y-3">
            <p className="text-[12px] text-[var(--color-muted)]">
              Accesso demo · utente{' '}
              <span className="font-mono text-[var(--color-ink-soft)]">segreteria</span> o{' '}
              <span className="font-mono text-[var(--color-ink-soft)]">admin</span>
            </p>
            <button
              type="button"
              onClick={onOpenPublicPortal}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-clinical)] hover:text-[var(--color-clinical-hover)] hover:underline transition-colors"
            >
              <KeyRound className="w-3.5 h-3.5 shrink-0" />
              <span>Sei un paziente? Apri il portale conferma codice</span>
            </button>
          </div>
        </div>

        <div className="text-[11.5px] text-[var(--color-muted)] text-center lg:text-left">
          AgendaSmart · Gestione operativa studio odontoiatrico
        </div>
      </section>
    </main>
  );
}
