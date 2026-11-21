import { useMemo, useState } from 'react';
import { Search, ClipboardList } from 'lucide-react';
import type { AuditEvent } from '../types';
import { AUDIT_ACTION_LABELS, fmtDate, formatAuditDetails } from '../api';

interface AuditViewProps {
  events: AuditEvent[];
}

export function AuditView({ events }: AuditViewProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) => {
      const label = (AUDIT_ACTION_LABELS[e.action] || e.action).toLowerCase();
      const details = formatAuditDetails(e.details).toLowerCase();
      return (
        e.actor.toLowerCase().includes(q) ||
        label.includes(q) ||
        details.includes(q)
      );
    });
  }, [events, query]);

  return (
    <section className="bg-white border border-[var(--color-line)] rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--color-line)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-semibold text-[var(--color-ink)]">
            Registro attività
          </h2>
          <p className="text-[12.5px] text-[var(--color-muted)] mt-0.5 tabular-nums">
            {filtered.length} eventi registrati · tracciabilità per operatore e sistema
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-[var(--color-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtra per operatore o evento…"
            aria-label="Filtra registro attività"
            className="w-full min-h-[38px] pl-9 pr-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[13px] text-[var(--color-ink)] placeholder:text-[var(--color-muted)]"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse">
          <thead>
            <tr className="bg-[var(--color-surface-subtle)] border-b border-[var(--color-line)]">
              <th className="px-5 py-3 text-left text-[11.5px] font-semibold text-[var(--color-muted)]">
                Data e ora
              </th>
              <th className="px-5 py-3 text-left text-[11.5px] font-semibold text-[var(--color-muted)]">
                Operatore
              </th>
              <th className="px-5 py-3 text-left text-[11.5px] font-semibold text-[var(--color-muted)]">
                Evento
              </th>
              <th className="px-5 py-3 text-left text-[11.5px] font-semibold text-[var(--color-muted)]">
                Dettagli
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf0eb]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center">
                  <ClipboardList className="w-7 h-7 text-[var(--color-line-strong)] mx-auto mb-2" />
                  <div className="text-[14px] font-semibold text-[var(--color-ink)]">
                    Nessun evento trovato
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((ev) => (
                <tr
                  key={ev.id}
                  className="hover:bg-[var(--color-surface-subtle)]/40 transition-colors"
                >
                  <td className="px-5 py-3.5 align-top font-mono text-[12px] text-[var(--color-muted)] tabular-nums whitespace-nowrap">
                    {fmtDate(ev.created_at, {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-5 py-3.5 align-top text-[13px] font-semibold text-[var(--color-ink)] whitespace-nowrap">
                    {ev.actor}
                  </td>
                  <td className="px-5 py-3.5 align-top text-[13px] text-[var(--color-ink-soft)] whitespace-nowrap">
                    {AUDIT_ACTION_LABELS[ev.action] || ev.action.replaceAll('_', ' ')}
                  </td>
                  <td className="px-5 py-3.5 align-top text-[12.5px] text-[var(--color-muted)] max-w-md">
                    {formatAuditDetails(ev.details)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
