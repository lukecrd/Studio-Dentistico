import { useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import type { Chair, Procedure } from '../types';
import { parseJsonArray } from '../api';

interface ProceduresViewProps {
  procedures: Procedure[];
  chairs: Chair[];
  onCreateProcedure: (payload: {
    name: string;
    duration: number;
    specialty: string;
    resources: string[];
  }) => Promise<void>;
  onUpdateProcedure: (
    id: number,
    payload: {
      name: string;
      duration: number;
      specialty: string;
      resources: string[];
    }
  ) => Promise<void>;
  onDeleteProcedure: (id: number) => Promise<void>;
}

export function ProceduresView({
  procedures,
  chairs,
  onCreateProcedure,
  onUpdateProcedure,
  onDeleteProcedure,
}: ProceduresViewProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('30');
  const [specialty, setSpecialty] = useState('');
  const [resourcesText, setResourcesText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setDuration('30');
    setSpecialty('');
    setResourcesText('');
  };

  const startEdit = (proc: Procedure) => {
    setEditingId(proc.id);
    setName(proc.name);
    setDuration(String(proc.duration));
    setSpecialty(proc.specialty);
    setResourcesText(parseJsonArray<string>(proc.resources).join(', '));
    setConfirmId(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const resources = resourcesText
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
      const payload = {
        name,
        duration: Number(duration),
        specialty,
        resources,
      };
      if (editingId !== null) {
        await onUpdateProcedure(editingId, payload);
      } else {
        await onCreateProcedure(payload);
      }
      resetForm();
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await onDeleteProcedure(id);
      setConfirmId(null);
      if (editingId === id) resetForm();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
      <div className="xl:col-span-8 space-y-5">
        {/* Procedures Table */}
        <section className="surface-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--color-line)]">
            <h2 className="text-[16px] font-semibold text-[var(--color-ink)]">
              Catalogo trattamenti ({procedures.length})
            </h2>
            <p className="text-[12.5px] text-[var(--color-muted)] mt-0.5">
              Durate standard, specialità e dotazioni richieste in poltrona
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[660px] border-collapse">
              <thead>
                <tr className="bg-[var(--color-surface-subtle)] border-b border-[var(--color-line)]">
                  <th className="px-5 py-3 text-left text-[11.5px] font-semibold text-[var(--color-muted)]">
                    Trattamento
                  </th>
                  <th className="px-5 py-3 text-left text-[11.5px] font-semibold text-[var(--color-muted)]">
                    Specialità
                  </th>
                  <th className="px-5 py-3 text-right text-[11.5px] font-semibold text-[var(--color-muted)]">
                    Durata
                  </th>
                  <th className="px-5 py-3 text-left text-[11.5px] font-semibold text-[var(--color-muted)]">
                    Attrezzature
                  </th>
                  <th className="px-5 py-3 text-right text-[11.5px] font-semibold text-[var(--color-muted)]">
                    Gestione
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {procedures.map((proc) => {
                  const res = parseJsonArray<string>(proc.resources);
                  const isEditing = editingId === proc.id;
                  const isConfirming = confirmId === proc.id;
                  const isDeleting = deletingId === proc.id;

                  return (
                    <tr
                      key={proc.id}
                      className={`transition-colors ${
                        isEditing
                          ? 'bg-[var(--color-clinical-tint)]/45'
                          : 'hover:bg-[var(--color-surface-subtle)]/50'
                      }`}
                    >
                      <td className="px-5 py-3.5 text-[13.5px] font-semibold text-[var(--color-ink)]">
                        {proc.name}
                      </td>
                      <td className="px-5 py-3.5 text-[13px] text-[var(--color-ink-soft)]">
                        {proc.specialty}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-[12.5px] text-[var(--color-ink)] tabular-nums whitespace-nowrap">
                        {proc.duration} min
                      </td>
                      <td className="px-5 py-3.5 text-[12.5px] text-[var(--color-muted)]">
                        {res.length ? res.join(' · ') : 'Nessuna specifica'}
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        {isConfirming ? (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => setConfirmId(null)}
                              className="min-h-[34px] px-2.5 rounded-lg border border-[var(--color-line-strong)] bg-white text-[12px] font-medium text-[var(--color-ink)] whitespace-nowrap"
                            >
                              Annulla
                            </button>
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => handleConfirmDelete(proc.id)}
                              className="min-h-[34px] px-3 rounded-lg bg-[var(--color-alert)] text-white text-[12px] font-semibold hover:bg-[var(--color-alert-hover)] transition-colors disabled:opacity-60 whitespace-nowrap"
                            >
                              {isDeleting ? 'Rimozione…' : 'Conferma'}
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(proc)}
                              className="min-h-[34px] px-2.5 rounded-lg border border-[var(--color-line-strong)] bg-white text-[12px] font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-subtle)] transition-colors inline-flex items-center gap-1 whitespace-nowrap"
                            >
                              <Pencil className="w-3.5 h-3.5 text-[var(--color-clinical)]" />
                              <span>Modifica</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmId(proc.id)}
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
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Room Equipment Matrix */}
        <section className="surface-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--color-line)]">
            <h2 className="text-[15.5px] font-semibold text-[var(--color-ink)]">
              Dotazione delle stanze attive
            </h2>
            <p className="text-[12.5px] text-[var(--color-muted)] mt-0.5">
              Riferimento rapido delle attrezzature verificate durante la prenotazione
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {chairs.map((c) => {
              const res = parseJsonArray<string>(c.resources);
              return (
                <div
                  key={c.id}
                  className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                >
                  <span className="text-[13.5px] font-semibold text-[var(--color-ink)]">
                    {c.name}
                  </span>
                  <span className="text-[12.5px] text-[var(--color-ink-soft)]">
                    {res.length ? res.join(' · ') : 'Nessuna attrezzatura specifica'}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Add / Edit Procedure Form */}
      <section className="xl:col-span-4 surface-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-line)] flex items-start justify-between gap-2">
          <div>
            <h2 className="text-[15.5px] font-semibold text-[var(--color-ink)] flex items-center gap-2">
              {editingId !== null ? (
                <Pencil className="w-4 h-4 text-[var(--color-clinical)]" />
              ) : (
                <Plus className="w-4 h-4 text-[var(--color-clinical)]" />
              )}
              <span>{editingId !== null ? 'Modifica trattamento' : 'Aggiungi trattamento'}</span>
            </h2>
            <p className="text-[12.5px] text-[var(--color-muted)] mt-0.5">
              {editingId !== null
                ? 'Aggiorna durata, specialità o attrezzature richieste'
                : 'Le risorse indicate saranno obbligatorie sulla poltrona scelta'}
            </p>
          </div>
          {editingId !== null && (
            <button
              type="button"
              onClick={resetForm}
              aria-label="Annulla modifica trattamento"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-muted)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-ink)] shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label
              htmlFor="proc-name"
              className="block text-[12px] font-semibold text-[var(--color-ink-soft)] mb-1.5"
            >
              Nome trattamento
            </label>
            <input
              id="proc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              placeholder="es. Sbiancamento"
              className="w-full min-h-[42px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[13.5px] text-[var(--color-ink)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="proc-duration"
                className="block text-[12px] font-semibold text-[var(--color-ink-soft)] mb-1.5"
              >
                Durata (min)
              </label>
              <input
                id="proc-duration"
                type="number"
                min={10}
                max={480}
                step={5}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                required
                className="w-full min-h-[42px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[13.5px] font-mono tabular-nums text-[var(--color-ink)]"
              />
            </div>

            <div>
              <label
                htmlFor="proc-specialty"
                className="block text-[12px] font-semibold text-[var(--color-ink-soft)] mb-1.5"
              >
                Specialità
              </label>
              <input
                id="proc-specialty"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                required
                placeholder="es. Estetica"
                className="w-full min-h-[42px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[13.5px] text-[var(--color-ink)]"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="proc-resources"
              className="block text-[12px] font-semibold text-[var(--color-ink-soft)] mb-1.5"
            >
              Attrezzature necessarie
            </label>
            <input
              id="proc-resources"
              value={resourcesText}
              onChange={(e) => setResourcesText(e.target.value)}
              placeholder="es. turbina, radiologia"
              className="w-full min-h-[42px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[13.5px] text-[var(--color-ink)]"
            />
            <p className="mt-1 text-[11.5px] text-[var(--color-muted)]">
              Separa più dotazioni con una virgola.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {editingId !== null && (
              <button
                type="button"
                onClick={resetForm}
                className="min-h-[42px] px-3.5 rounded-lg border border-[var(--color-line-strong)] bg-white text-[13px] font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-subtle)] transition-colors whitespace-nowrap"
              >
                Annulla
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 min-h-[42px] px-4 rounded-lg bg-[var(--color-clinical)] text-white text-[13px] font-semibold hover:bg-[var(--color-clinical-hover)] transition-colors disabled:opacity-60"
            >
              {submitting
                ? 'Salvataggio…'
                : editingId !== null
                  ? 'Salva modifiche'
                  : 'Salva trattamento'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
