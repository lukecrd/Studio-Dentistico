import { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  CalendarClock,
  Smartphone,
  ExternalLink,
  Phone,
} from 'lucide-react';
import type { Proposal } from '../types';
import { fmtDate, fmtTime } from '../api';

interface ProposalsViewProps {
  proposals: Proposal[];
  smsConfigured: boolean;
  onProposalAction: (
    proposalId: number,
    action: 'accept' | 'decline' | 'approve' | 'reject',
    options?: { sendSms?: boolean }
  ) => Promise<void>;
  onSendProposalSms: (proposalId: number) => Promise<void>;
  onSendMoveSms: (appointmentId: number) => Promise<void>;
  onOpenPublicProposal: (code: string) => void;
}

type ProposalFilter = 'all' | 'pending_patient' | 'accepted_waiting_approval' | 'completed';

const STATE_META: Record<
  Proposal['state'],
  { label: string; colorClass: string; icon: typeof Clock }
> = {
  pending_patient: {
    label: 'In attesa paziente',
    colorClass: 'text-[var(--color-warn)]',
    icon: Clock,
  },
  accepted_waiting_approval: {
    label: 'Accettata · da approvare',
    colorClass: 'text-[var(--color-clinical)]',
    icon: AlertCircle,
  },
  approved: {
    label: 'Approvata e spostata',
    colorClass: 'text-[var(--color-clinical)]',
    icon: CheckCircle2,
  },
  declined: {
    label: 'Rifiutata dal paziente',
    colorClass: 'text-[var(--color-muted)]',
    icon: XCircle,
  },
  rejected: {
    label: 'Non approvata',
    colorClass: 'text-[var(--color-alert)]',
    icon: XCircle,
  },
};

export function ProposalsView({
  proposals,
  smsConfigured,
  onProposalAction,
  onSendProposalSms,
  onSendMoveSms,
  onOpenPublicProposal,
}: ProposalsViewProps) {
  const [filter, setFilter] = useState<ProposalFilter>('all');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [sendingSmsId, setSendingSmsId] = useState<number | null>(null);
  const [sendingMoveId, setSendingMoveId] = useState<number | null>(null);
  const [autoSendMoveSms, setAutoSendMoveSms] = useState<boolean>(smsConfigured);

  const counts = useMemo(
    () => ({
      all: proposals.length,
      pending_patient: proposals.filter((p) => p.state === 'pending_patient').length,
      accepted_waiting_approval: proposals.filter((p) => p.state === 'accepted_waiting_approval')
        .length,
      completed: proposals.filter((p) =>
        ['approved', 'declined', 'rejected'].includes(p.state)
      ).length,
    }),
    [proposals]
  );

  const visibleProposals = useMemo(() => {
    if (filter === 'all') return proposals;
    if (filter === 'completed') {
      return proposals.filter((p) => ['approved', 'declined', 'rejected'].includes(p.state));
    }
    return proposals.filter((p) => p.state === filter);
  }, [proposals, filter]);

  const handleAction = async (
    id: number,
    action: 'accept' | 'decline' | 'approve' | 'reject'
  ) => {
    setBusyId(id);
    try {
      await onProposalAction(id, action, {
        sendSms: action === 'approve' ? autoSendMoveSms && smsConfigured : false,
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleSendSms = async (id: number) => {
    setSendingSmsId(id);
    try {
      await onSendProposalSms(id);
    } finally {
      setSendingSmsId(null);
    }
  };

  const handleSendMoveSms = async (appointmentId: number, proposalId: number) => {
    setSendingMoveId(proposalId);
    try {
      await onSendMoveSms(appointmentId);
    } finally {
      setSendingMoveId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 3-Step Safeguard Workflow Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 bg-white border border-[var(--color-line)] rounded-xl divide-y md:divide-y-0 md:divide-x divide-[var(--color-line)]">
        <div className="p-5">
          <div className="font-mono text-[11px] font-semibold text-[var(--color-clinical)] mb-1">
            01. Slot liberato
          </div>
          <div className="text-[13.5px] font-semibold text-[var(--color-ink)]">
            Candidati compatibili
          </div>
          <p className="text-[12.5px] text-[var(--color-muted)] mt-1 leading-relaxed">
            Ogni disdetta individua appuntamenti futuri compatibili per durata, professionista e
            poltrona.
          </p>
        </div>
        <div className="p-5">
          <div className="font-mono text-[11px] font-semibold text-[var(--color-warn)] mb-1">
            02. Proposta reale via SMS
          </div>
          <div className="text-[13.5px] font-semibold text-[var(--color-ink)]">
            Link monouso al paziente
          </div>
          <p className="text-[12.5px] text-[var(--color-muted)] mt-1 leading-relaxed">
            Invia al paziente un SMS con link personale per accettare o rifiutare lo slot anticipato
            dal proprio telefono.
          </p>
        </div>
        <div className="p-5">
          <div className="font-mono text-[11px] font-semibold text-[var(--color-ink)] mb-1">
            03. Approvazione e SMS conferma
          </div>
          <div className="text-[13.5px] font-semibold text-[var(--color-ink)]">
            Spostamento controllato
          </div>
          <p className="text-[12.5px] text-[var(--color-muted)] mt-1 leading-relaxed">
            «Approva e sposta» aggiorna agenda, medico e poltrona e invia al paziente l&apos;SMS con
            il nuovo orario confermato.
          </p>
        </div>
      </div>

      {/* Proposals Table Panel */}
      <section className="bg-white border border-[var(--color-line)] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-line)] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold text-[var(--color-ink)]">
              Proposte di anticipo
            </h2>
            <p className="text-[12.5px] text-[var(--color-muted)] mt-0.5">
              Invia offerte via SMS TextBee e approva gli spostamenti in sicurezza
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {smsConfigured && (
              <label className="inline-flex items-center gap-2 text-[12px] font-medium text-[var(--color-ink-soft)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoSendMoveSms}
                  onChange={(e) => setAutoSendMoveSms(e.target.checked)}
                  className="accent-[var(--color-clinical)] w-3.5 h-3.5"
                />
                <span>Invia SMS conferma all&apos;approvazione</span>
              </label>
            )}

            <div className="inline-flex items-center p-1 bg-[var(--color-surface-subtle)] border border-[var(--color-line)] rounded-lg overflow-x-auto">
              {(
                [
                  ['all', `Tutte (${counts.all})`],
                  ['pending_patient', `In attesa (${counts.pending_patient})`],
                  [
                    'accepted_waiting_approval',
                    `Da approvare (${counts.accepted_waiting_approval})`,
                  ],
                  ['completed', `Storico (${counts.completed})`],
                ] as Array<[ProposalFilter, string]>
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
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse">
            <thead>
              <tr className="bg-[var(--color-surface-subtle)] border-b border-[var(--color-line)]">
                <th className="px-5 py-3 text-left text-[11.5px] font-semibold text-[var(--color-muted)]">
                  Paziente e prestazione
                </th>
                <th className="px-5 py-3 text-left text-[11.5px] font-semibold text-[var(--color-muted)]">
                  Spostamento proposto
                </th>
                <th className="px-5 py-3 text-left text-[11.5px] font-semibold text-[var(--color-muted)]">
                  Stato
                </th>
                <th className="px-5 py-3 text-right text-[11.5px] font-semibold text-[var(--color-muted)]">
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf0eb]">
              {visibleProposals.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <CalendarClock className="w-8 h-8 text-[var(--color-line-strong)] mx-auto mb-2.5" />
                    <div className="text-[14px] font-semibold text-[var(--color-ink)]">
                      Nessuna proposta in questa vista
                    </div>
                    <p className="text-[12.5px] text-[var(--color-muted)] mt-1 max-w-md mx-auto">
                      Annulla un appuntamento futuro dall&apos;Agenda per liberare uno slot e
                      generare proposte di anticipo compatibili.
                    </p>
                  </td>
                </tr>
              ) : (
                visibleProposals.map((p) => {
                  const meta = STATE_META[p.state];
                  const StatusIcon = meta.icon;
                  const isBusy = busyId === p.id;
                  const isSendingSms = sendingSmsId === p.id;
                  const isSendingMove = sendingMoveId === p.id;

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-[var(--color-surface-subtle)]/50 transition-colors"
                    >
                      <td className="px-5 py-4 align-middle">
                        <div className="text-[13.5px] font-semibold text-[var(--color-ink)]">
                          {p.patient}
                        </div>
                        <div className="text-[12px] text-[var(--color-muted)] mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>
                            {p.procedure}
                            {p.duration ? ` · ${p.duration} min` : ''}
                          </span>
                          {p.phone && (
                            <span className="font-mono tabular-nums inline-flex items-center gap-1 text-[11.5px]">
                              <Phone className="w-3 h-3" />
                              {p.phone}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4 align-middle">
                        <div className="flex items-center gap-3 flex-wrap">
                          <div>
                            <div className="text-[11px] text-[var(--color-muted)]">Attuale</div>
                            <div className="font-mono text-[12.5px] text-[var(--color-ink-soft)] tabular-nums">
                              {fmtDate(p.original_starts_at, { day: 'numeric', month: 'short' })}{' '}
                              {fmtTime(p.original_starts_at)}
                            </div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-[var(--color-muted)] shrink-0" />
                          <div>
                            <div className="text-[11px] text-[var(--color-clinical)] font-medium">
                              Slot liberato
                            </div>
                            <div className="font-mono text-[12.5px] font-semibold text-[var(--color-ink)] tabular-nums">
                              {fmtDate(p.freed_starts_at, { day: 'numeric', month: 'short' })}{' '}
                              {fmtTime(p.freed_starts_at)}
                            </div>
                            {(p.freed_professional || p.freed_chair) && (
                              <div className="text-[11px] text-[var(--color-muted)]">
                                {[p.freed_professional, p.freed_chair].filter(Boolean).join(' · ')}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 align-middle">
                        <div
                          className={`inline-flex items-center gap-1.5 text-[12.5px] font-semibold ${meta.colorClass}`}
                        >
                          <StatusIcon className="w-4 h-4 shrink-0" />
                          <span>{meta.label}</span>
                        </div>
                        {p.sms_sent_at && p.state === 'pending_patient' && (
                          <div className="text-[11px] text-[var(--color-clinical)] mt-0.5 tabular-nums">
                            SMS inviato alle {fmtTime(p.sms_sent_at)}
                            {p.invite_code ? ` · Cod. ${p.invite_code}` : ''}
                          </div>
                        )}
                        {p.approved_by && (
                          <div className="text-[11px] text-[var(--color-muted)] mt-0.5">
                            da {p.approved_by}
                            {p.move_sms_sent_at
                              ? ` · SMS conferma alle ${fmtTime(p.move_sms_sent_at)}`
                              : ''}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4 align-middle text-right">
                        <div className="inline-flex items-center justify-end gap-2 flex-wrap">
                          {p.state === 'pending_patient' && (
                            <>
                              <button
                                type="button"
                                disabled={!smsConfigured || isSendingSms || isBusy}
                                onClick={() => handleSendSms(p.id)}
                                className={`min-h-[34px] px-3 rounded-lg text-[12px] font-semibold transition-colors inline-flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap shrink-0 ${
                                  p.sms_sent_at
                                    ? 'border border-[var(--color-line-strong)] bg-white text-[var(--color-clinical)] hover:bg-[var(--color-clinical-tint)]/50'
                                    : 'bg-[var(--color-clinical)] text-white hover:bg-[var(--color-clinical-hover)]'
                                }`}
                              >
                                <Smartphone className="w-3.5 h-3.5" />
                                <span>
                                  {isSendingSms
                                    ? 'Invio SMS…'
                                    : p.sms_sent_at
                                      ? 'Reinvia SMS'
                                      : 'Invia SMS proposta'}
                                </span>
                              </button>

                              {p.invite_code && (
                                <button
                                  type="button"
                                  onClick={() => onOpenPublicProposal(p.invite_code!)}
                                  className="min-h-[34px] px-2.5 rounded-lg border border-[var(--color-line-strong)] bg-white text-[12px] font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-clinical)] hover:bg-[var(--color-surface-subtle)] transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  <span>Apri link</span>
                                </button>
                              )}

                              <button
                                type="button"
                                disabled={isBusy || isSendingSms}
                                onClick={() => handleAction(p.id, 'accept')}
                                className="min-h-[34px] px-2.5 rounded-lg border border-[var(--color-line-strong)] bg-white text-[12px] font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-subtle)] transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
                              >
                                Segna accettata
                              </button>

                              <button
                                type="button"
                                disabled={isBusy || isSendingSms}
                                onClick={() => handleAction(p.id, 'decline')}
                                className="min-h-[34px] px-2.5 rounded-lg border border-[var(--color-line-strong)] bg-white text-[12px] font-medium text-[var(--color-muted)] hover:text-[var(--color-alert)] hover:border-[#e3c3bd] transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
                              >
                                Rifiuta
                              </button>
                            </>
                          )}

                          {p.state === 'accepted_waiting_approval' && (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleAction(p.id, 'approve')}
                                className="min-h-[36px] px-3.5 rounded-lg bg-[var(--color-clinical)] text-white text-[12px] font-semibold hover:bg-[var(--color-clinical-hover)] transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
                              >
                                {isBusy
                                  ? 'Approvazione…'
                                  : autoSendMoveSms && smsConfigured
                                    ? 'Approva e invia SMS'
                                    : 'Approva e sposta'}
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleAction(p.id, 'reject')}
                                className="min-h-[36px] px-3 rounded-lg border border-[#e3c3bd] bg-white text-[12px] font-semibold text-[var(--color-alert)] hover:bg-[var(--color-alert-tint)] transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
                              >
                                Non approvare
                              </button>
                            </>
                          )}

                          {p.state === 'approved' && (
                            <button
                              type="button"
                              disabled={!smsConfigured || isSendingMove}
                              onClick={() => handleSendMoveSms(p.appointment_id, p.id)}
                              className="min-h-[34px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[12px] font-medium text-[var(--color-clinical)] hover:bg-[var(--color-clinical-tint)]/50 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap shrink-0"
                            >
                              <Smartphone className="w-3.5 h-3.5" />
                              <span>
                                {isSendingMove
                                  ? 'Invio…'
                                  : p.move_sms_sent_at
                                    ? 'Reinvia SMS conferma'
                                    : 'Invia SMS conferma'}
                              </span>
                            </button>
                          )}

                          {['declined', 'rejected'].includes(p.state) && (
                            <span className="text-[12px] text-[var(--color-muted)]">Conclusa</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
