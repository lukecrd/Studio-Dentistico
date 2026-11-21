import { useState, type FormEvent } from 'react';
import { DoorOpen, Plus, Trash2 } from 'lucide-react';
import type { Chair } from '../types';
import { parseJsonArray } from '../api';

interface RoomsViewProps {
  chairs: Chair[];
  onCreateChair: (payload: { name: string; resources: string[] }) => Promise<void>;
  onDeleteChair: (id: number) => Promise<void>;
}

export function RoomsView({ chairs, onCreateChair, onDeleteChair }: RoomsViewProps) {
  const [name, setName] = useState('');
  const [resourcesText, setResourcesText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const resources = resourcesText
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
      await onCreateChair({ name, resources });
      setName('');
      setResourcesText('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await onDeleteChair(id);
      setConfirmId(null);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Active Rooms List */}
      <section className="xl:col-span-8 bg-white border border-[var(--color-line)] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-line)]">
          <h2 className="text-[16px] font-semibold text-[var(--color-ink)] tabular-nums">
            Stanze operative attive ({chairs.length})
          </h2>
          <p className="text-[12.5px] text-[var(--color-muted)] mt-0.5">
            Le stanze con appuntamenti prenotati non possono essere rimosse; quelle con storico
            vengono archiviate per preservare l&apos;agenda passata.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[540px] border-collapse">
            <thead>
              <tr className="bg-[var(--color-surface-subtle)] border-b border-[var(--color-line)]">
                <th className="px-5 py-3 text-left text-[11.5px] font-semibold text-[var(--color-muted)]">
                  Stanza / Poltrona
                </th>
                <th className="px-5 py-3 text-left text-[11.5px] font-semibold text-[var(--color-muted)]">
                  Attrezzature disponibili
                </th>
                <th className="px-5 py-3 text-right text-[11.5px] font-semibold text-[var(--color-muted)]">
                  Gestione
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf0eb]">
              {chairs.map((chair) => {
                const res = parseJsonArray<string>(chair.resources);
                const isConfirming = confirmId === chair.id;
                const isDeleting = deletingId === chair.id;

                return (
                  <tr
                    key={chair.id}
                    className="hover:bg-[var(--color-surface-subtle)]/50 transition-colors"
                  >
                    <td className="px-5 py-4 align-middle whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <DoorOpen className="w-4 h-4 text-[var(--color-clinical)] shrink-0" />
                        <span className="text-[13.5px] font-semibold text-[var(--color-ink)]">
                          {chair.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-middle text-[12.5px] text-[var(--color-muted)]">
                      {res.length ? res.join(' · ') : 'Nessuna dotazione specifica'}
                    </td>
                    <td className="px-5 py-4 align-middle text-right whitespace-nowrap">
                      {isConfirming ? (
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => setConfirmId(null)}
                            className="min-h-[34px] px-2.5 rounded-lg border border-[var(--color-line-strong)] bg-white text-[12px] font-medium text-[var(--color-ink)]"
                          >
                            Annulla
                          </button>
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => handleConfirmDelete(chair.id)}
                            className="min-h-[34px] px-3 rounded-lg bg-[var(--color-alert)] text-white text-[12px] font-semibold hover:bg-[#993627] transition-colors disabled:opacity-60"
                          >
                            {isDeleting ? 'Rimozione…' : 'Conferma'}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmId(chair.id)}
                          className="min-h-[34px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[12px] font-medium text-[var(--color-alert)] hover:border-[#e3c3bd] hover:bg-[var(--color-alert-tint)] transition-colors inline-flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Rimuovi</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Add Room Form */}
      <section className="xl:col-span-4 bg-white border border-[var(--color-line)] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-line)]">
          <h2 className="text-[15.5px] font-semibold text-[var(--color-ink)] flex items-center gap-2">
            <Plus className="w-4 h-4 text-[var(--color-clinical)]" />
            <span>Aggiungi stanza</span>
          </h2>
          <p className="text-[12.5px] text-[var(--color-muted)] mt-0.5">
            Sarà subito prenotabile nell&apos;agenda condivisa
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label
              htmlFor="chair-name"
              className="block text-[12px] font-semibold text-[var(--color-ink-soft)] mb-1.5"
            >
              Nome stanza / poltrona
            </label>
            <input
              id="chair-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              placeholder="es. Poltrona 6"
              className="w-full min-h-[42px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[13.5px] text-[var(--color-ink)]"
            />
          </div>

          <div>
            <label
              htmlFor="chair-resources"
              className="block text-[12px] font-semibold text-[var(--color-ink-soft)] mb-1.5"
            >
              Attrezzature disponibili
            </label>
            <input
              id="chair-resources"
              value={resourcesText}
              onChange={(e) => setResourcesText(e.target.value)}
              placeholder="es. turbina, radiologia"
              className="w-full min-h-[42px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[13.5px] text-[var(--color-ink)]"
            />
            <p className="mt-1 text-[11.5px] text-[var(--color-muted)]">
              Separa più attrezzature con una virgola.
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[42px] px-4 rounded-lg bg-[var(--color-clinical)] text-white text-[13px] font-semibold hover:bg-[var(--color-clinical-hover)] transition-colors disabled:opacity-60"
          >
            {submitting ? 'Aggiunta…' : 'Aggiungi stanza'}
          </button>
        </form>
      </section>
    </div>
  );
}
