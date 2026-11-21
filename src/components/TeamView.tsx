import { useState, type FormEvent } from 'react';
import { Pencil, Trash2, UserPlus, X } from 'lucide-react';
import type { Procedure, Professional } from '../types';
import { initials, parseJsonArray } from '../api';

interface TeamViewProps {
  professionals: Professional[];
  procedures: Procedure[];
  onCreateProfessional: (payload: {
    name: string;
    specialty: string;
    color: string;
    procedure_ids: number[];
  }) => Promise<void>;
  onUpdateProfessional: (
    id: number,
    payload: {
      name: string;
      specialty: string;
      color: string;
      procedure_ids: number[];
    }
  ) => Promise<void>;
  onDeleteProfessional: (id: number) => Promise<void>;
}

const SWATCH_COLORS = ['#2b5942', '#3d7465', '#c77b55', '#9d7644', '#6b6394', '#437691', '#7d5a50'];

export function TeamView({
  professionals,
  procedures,
  onCreateProfessional,
  onUpdateProfessional,
  onDeleteProfessional,
}: TeamViewProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [color, setColor] = useState('#2b5942');
  const [selectedProcedures, setSelectedProcedures] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setSpecialty('');
    setColor('#2b5942');
    setSelectedProcedures([]);
  };

  const startEdit = (prof: Professional) => {
    setEditingId(prof.id);
    setName(prof.name);
    setSpecialty(prof.specialty);
    setColor(prof.color || '#2b5942');
    setSelectedProcedures(parseJsonArray<number>(prof.procedure_ids));
    setConfirmId(null);
  };

  const toggleProcedure = (id: number) => {
    setSelectedProcedures((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name,
        specialty,
        color,
        procedure_ids: selectedProcedures,
      };
      if (editingId !== null) {
        await onUpdateProfessional(editingId, payload);
      } else {
        await onCreateProfessional(payload);
      }
      resetForm();
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await onDeleteProfessional(id);
      setConfirmId(null);
      if (editingId === id) resetForm();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Staff Roster */}
      <section className="xl:col-span-8 bg-white border border-[var(--color-line)] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-line)]">
          <h2 className="text-[16px] font-semibold text-[var(--color-ink)]">
            Team clinico ({professionals.length})
          </h2>
          <p className="text-[12.5px] text-[var(--color-muted)] mt-0.5">
            Abilitazioni per specialità, colore in agenda e prestazioni eseguibili
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse">
            <thead>
              <tr className="bg-[var(--color-surface-subtle)] border-b border-[var(--color-line)]">
                <th className="px-5 py-3 text-left text-[11.5px] font-semibold text-[var(--color-muted)]">
                  Professionista
                </th>
                <th className="px-5 py-3 text-left text-[11.5px] font-semibold text-[var(--color-muted)]">
                  Specialità
                </th>
                <th className="px-5 py-3 text-left text-[11.5px] font-semibold text-[var(--color-muted)]">
                  Trattamenti abilitati
                </th>
                <th className="px-5 py-3 text-right text-[11.5px] font-semibold text-[var(--color-muted)]">
                  Gestione
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf0eb]">
              {professionals.map((prof) => {
                const enabledNames = parseJsonArray<number>(prof.procedure_ids)
                  .map((id) => procedures.find((p) => p.id === id)?.name)
                  .filter(Boolean);
                const isEditing = editingId === prof.id;
                const isConfirming = confirmId === prof.id;
                const isDeleting = deletingId === prof.id;

                return (
                  <tr
                    key={prof.id}
                    className={`transition-colors ${
                      isEditing
                        ? 'bg-[var(--color-clinical-tint)]/45'
                        : 'hover:bg-[var(--color-surface-subtle)]/50'
                    }`}
                  >
                    <td className="px-5 py-4 align-top whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full text-[11.5px] font-bold flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: `${prof.color}1e`,
                            color: prof.color,
                          }}
                        >
                          {initials(prof.name)}
                        </div>
                        <span className="text-[13.5px] font-semibold text-[var(--color-ink)]">
                          {prof.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top text-[13px] text-[var(--color-ink-soft)] whitespace-nowrap">
                      {prof.specialty}
                    </td>
                    <td className="px-5 py-4 align-top text-[12.5px] text-[var(--color-muted)] leading-relaxed">
                      {enabledNames.length ? enabledNames.join(' · ') : '—'}
                    </td>
                    <td className="px-5 py-4 align-top text-right whitespace-nowrap">
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
                            onClick={() => handleConfirmDelete(prof.id)}
                            className="min-h-[34px] px-3 rounded-lg bg-[var(--color-alert)] text-white text-[12px] font-semibold hover:bg-[#993627] transition-colors disabled:opacity-60 whitespace-nowrap"
                          >
                            {isDeleting ? 'Rimozione…' : 'Conferma'}
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(prof)}
                            className="min-h-[34px] px-2.5 rounded-lg border border-[var(--color-line-strong)] bg-white text-[12px] font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-subtle)] transition-colors inline-flex items-center gap-1 whitespace-nowrap"
                          >
                            <Pencil className="w-3.5 h-3.5 text-[var(--color-clinical)]" />
                            <span>Modifica</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmId(prof.id)}
                            className="min-h-[34px] px-2.5 rounded-lg border border-[var(--color-line-strong)] bg-white text-[12px] font-medium text-[var(--color-alert)] hover:border-[#e3c3bd] hover:bg-[var(--color-alert-tint)] transition-colors inline-flex items-center gap-1 whitespace-nowrap"
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

      {/* Add / Edit Professional Form */}
      <section className="xl:col-span-4 bg-white border border-[var(--color-line)] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-line)] flex items-start justify-between gap-2">
          <div>
            <h2 className="text-[15.5px] font-semibold text-[var(--color-ink)] flex items-center gap-2">
              {editingId !== null ? (
                <Pencil className="w-4 h-4 text-[var(--color-clinical)]" />
              ) : (
                <UserPlus className="w-4 h-4 text-[var(--color-clinical)]" />
              )}
              <span>
                {editingId !== null ? 'Modifica professionista' : 'Aggiungi professionista'}
              </span>
            </h2>
            <p className="text-[12.5px] text-[var(--color-muted)] mt-0.5">
              Seleziona almeno un trattamento abilitato
            </p>
          </div>
          {editingId !== null && (
            <button
              type="button"
              onClick={resetForm}
              aria-label="Annulla modifica professionista"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-muted)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-ink)] shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label
              htmlFor="prof-name"
              className="block text-[12px] font-semibold text-[var(--color-ink-soft)] mb-1.5"
            >
              Nome e cognome
            </label>
            <input
              id="prof-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={3}
              placeholder="es. Dott.ssa Chiara Neri"
              className="w-full min-h-[42px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[13.5px] text-[var(--color-ink)]"
            />
          </div>

          <div>
            <label
              htmlFor="prof-specialty"
              className="block text-[12px] font-semibold text-[var(--color-ink-soft)] mb-1.5"
            >
              Specialità
            </label>
            <input
              id="prof-specialty"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              required
              placeholder="es. Ortodonzia"
              className="w-full min-h-[42px] px-3 rounded-lg border border-[var(--color-line-strong)] bg-white text-[13.5px] text-[var(--color-ink)]"
            />
          </div>

          <div>
            <span className="block text-[12px] font-semibold text-[var(--color-ink-soft)] mb-2">
              Colore in agenda
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {SWATCH_COLORS.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => setColor(swatch)}
                  aria-label={`Seleziona colore ${swatch}`}
                  className={`w-7 h-7 rounded-md transition-transform ${
                    color === swatch ? 'ring-2 ring-offset-2 ring-[var(--color-ink)] scale-105' : ''
                  }`}
                  style={{ backgroundColor: swatch }}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                aria-label="Colore personalizzato"
                className="w-8 h-8 rounded cursor-pointer border border-[var(--color-line-strong)] p-0.5 bg-white"
              />
            </div>
          </div>

          <div>
            <span className="block text-[12px] font-semibold text-[var(--color-ink-soft)] mb-2">
              Trattamenti abilitati ({selectedProcedures.length})
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-52 overflow-y-auto p-2.5 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-subtle)]/50">
              {procedures.map((proc) => {
                const checked = selectedProcedures.includes(proc.id);
                return (
                  <label
                    key={proc.id}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-md text-[12.5px] cursor-pointer transition-colors ${
                      checked
                        ? 'bg-white border border-[var(--color-clinical)]/35 text-[var(--color-ink)] font-medium'
                        : 'border border-transparent text-[var(--color-ink-soft)] hover:bg-white/70'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleProcedure(proc.id)}
                      className="accent-[var(--color-clinical)] w-3.5 h-3.5 shrink-0"
                    />
                    <span className="truncate">{proc.name}</span>
                  </label>
                );
              })}
            </div>
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
              disabled={submitting || selectedProcedures.length === 0}
              className="flex-1 min-h-[42px] px-4 rounded-lg bg-[var(--color-clinical)] text-white text-[13px] font-semibold hover:bg-[var(--color-clinical-hover)] transition-colors disabled:opacity-50"
            >
              {submitting
                ? 'Salvataggio…'
                : editingId !== null
                  ? 'Salva modifiche'
                  : 'Salva professionista'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
