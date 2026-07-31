"use client";

import { FormEvent, useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Spell = {
  id: string;
  name: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  rangeFeet: number | null;
  components: string[];
  duration: string;
  concentration: boolean;
  ritual: boolean;
  classes: string[];
  description: string;
  attackType: string | null;
  savingThrow: string | null;
  damageDice: string | null;
  damageType: string | null;
  healingDice: string | null;
  areaShape: string | null;
  areaSizeFeet: number | null;
  higherLevels: string | null;
  notes: string | null;
  source: string;
};

const emptyForm = {
  name: "",
  level: "0",
  school: "",
  castingTime: "1 acción",
  range: "",
  rangeFeet: "",
  components: "",
  duration: "",
  concentration: false,
  ritual: false,
  classes: "",
  description: "",
  attackType: "",
  savingThrow: "",
  damageDice: "",
  damageType: "",
  healingDice: "",
  areaShape: "",
  areaSizeFeet: "",
  higherLevels: "",
  notes: "",
};

export default function AdminSpellsPage() {
  const [spells, setSpells] = useState<Spell[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<string>("all");

  async function loadSpells() {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/admin/spells`, {
        credentials: "include",
      });

      const data = await response.json().catch(() => null);

      if (response.status === 401) {
        window.location.href = `/login?redirect=${encodeURIComponent("/admin/spells")}`;
        return;
      }

      if (response.status === 403) {
        setError("No tienes permisos de administrador.");
        return;
      }

      if (!response.ok) {
        setError(data?.message ?? "No se pudieron cargar los hechizos.");
        return;
      }

      setSpells(data.spells ?? []);
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadSpells();
  }, []);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function startEdit(spell: Spell) {
    setEditingId(spell.id);
    setForm({
      name: spell.name,
      level: String(spell.level),
      school: spell.school,
      castingTime: spell.castingTime,
      range: spell.range,
      rangeFeet: spell.rangeFeet !== null ? String(spell.rangeFeet) : "",
      components: spell.components.join(", "),
      duration: spell.duration,
      concentration: spell.concentration,
      ritual: spell.ritual,
      classes: spell.classes.join(", "),
      description: spell.description,
      attackType: spell.attackType ?? "",
      savingThrow: spell.savingThrow ?? "",
      damageDice: spell.damageDice ?? "",
      damageType: spell.damageType ?? "",
      healingDice: spell.healingDice ?? "",
      areaShape: spell.areaShape ?? "",
      areaSizeFeet: spell.areaSizeFeet !== null ? String(spell.areaSizeFeet) : "",
      higherLevels: spell.higherLevels ?? "",
      notes: spell.notes ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanName = form.name.trim();
    const cleanSchool = form.school.trim();
    const cleanRange = form.range.trim();
    const cleanDuration = form.duration.trim();
    const cleanDescription = form.description.trim();

    if (!cleanName || !cleanSchool || !cleanRange || !cleanDuration || !cleanDescription) {
      setError("Nombre, escuela, alcance, duración y descripción son obligatorios.");
      return;
    }

    setError("");
    setSuccess("");
    setIsSaving(true);

    const payload = {
      name: cleanName,
      level: Number(form.level),
      school: cleanSchool,
      castingTime: form.castingTime.trim(),
      range: cleanRange,
      rangeFeet: form.rangeFeet === "" ? "" : Number(form.rangeFeet),
      components: form.components.split(",").map((c) => c.trim()).filter(Boolean),
      duration: cleanDuration,
      concentration: form.concentration,
      ritual: form.ritual,
      classes: form.classes.split(",").map((c) => c.trim()).filter(Boolean),
      description: cleanDescription,
      attackType: form.attackType || null,
      savingThrow: form.savingThrow || null,
      damageDice: form.damageDice.trim() || null,
      damageType: form.damageType.trim() || null,
      healingDice: form.healingDice.trim() || null,
      areaShape: form.areaShape || null,
      areaSizeFeet: form.areaSizeFeet === "" ? "" : Number(form.areaSizeFeet),
      higherLevels: form.higherLevels.trim() || null,
      notes: form.notes.trim() || null,
    };

    try {
      const url = editingId ? `${API_URL}/admin/spells/${editingId}` : `${API_URL}/admin/spells`;
      const method = editingId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (response.status === 401) {
        window.location.href = `/login?redirect=${encodeURIComponent("/admin/spells")}`;
        return;
      }

      if (!response.ok) {
        setError(data?.message ?? "No se pudo guardar el hechizo.");
        return;
      }

      setSuccess(editingId ? `Hechizo actualizado: ${data.spell.name}` : `Hechizo creado: ${data.spell.name}`);
      resetForm();
      await loadSpells();
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(spell: Spell) {
    const confirmed = window.confirm(`¿Eliminar "${spell.name}" del catálogo? Esta acción no se puede deshacer.`);
    if (!confirmed) return;

    setIsDeletingId(spell.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API_URL}/admin/spells/${spell.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.message ?? "No se pudo eliminar el hechizo.");
        return;
      }

      setSuccess(`Hechizo eliminado: ${spell.name}`);
      setSpells((current) => current.filter((s) => s.id !== spell.id));
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setIsDeletingId(null);
    }
  }

  const filteredSpells = levelFilter === "all"
    ? spells
    : spells.filter((s) => String(s.level) === levelFilter);

  return (
    <main className="relative flex h-screen flex-col overflow-hidden bg-zinc-950 p-6 text-white">
      {/* Imagen de fondo */}
      <div
        className="pointer-events-none absolute inset-0 opacity-100"
        style={{
          backgroundImage: "url('/backgrounds/spells-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/10 via-zinc-950/10 to-zinc-950/10" />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col overflow-hidden">
        <header className="mb-8 flex flex-shrink-0 flex-col gap-4 rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-yellow-400">
              Initiative Forge
            </p>
            <h1 className="mt-2 text-3xl font-black">Administración de hechizos</h1>
            <p className="mt-1 text-zinc-400">
              Agrega, edita o elimina hechizos del catálogo disponible en fichas y combate.
            </p>
          </div>

          <div className="flex gap-3">
            <a
              href="/admin/weapons"
              className="rounded-xl border border-zinc-700 px-4 py-3 font-semibold text-zinc-200 transition hover:bg-zinc-800"
            >
              Armas
            </a>
            <a
              href="/admin/races"
              className="rounded-xl border border-zinc-700 px-4 py-3 font-semibold text-zinc-200 transition hover:bg-zinc-800"
            >
              Razas
            </a>
            <a
              href="/admin/users"
              className="rounded-xl border border-zinc-700 px-4 py-3 font-semibold text-zinc-200 transition hover:bg-zinc-800"
            >
              Usuarios
            </a>
            <a
              href="/dashboard"
              className="rounded-xl border border-zinc-700 px-4 py-3 font-semibold text-zinc-200 transition hover:bg-zinc-800"
            >
              Volver al dashboard
            </a>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-6 overflow-hidden lg:grid-cols-[440px_1fr]">
          <section className="min-h-0 overflow-y-auto rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <h2 className="text-xl font-black">
              {editingId ? "Editar hechizo" : "Crear hechizo"}
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              {editingId ? "Actualiza los datos y guarda los cambios." : "Agrega un nuevo hechizo al catálogo compartido."}
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-300">Nombre</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
                  placeholder="Ej: Bola de Fuego"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">Nivel</label>
                  <select
                    value={form.level}
                    onChange={(e) => setForm({ ...form, level: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
                  >
                    <option value="0">Truco (0)</option>
                    {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>Nivel {n}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">Escuela</label>
                  <input
                    value={form.school}
                    onChange={(e) => setForm({ ...form, school: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
                    placeholder="Evocación"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">Tiempo de lanzamiento</label>
                  <input
                    value={form.castingTime}
                    onChange={(e) => setForm({ ...form, castingTime: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">Duración</label>
                  <input
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">Alcance (texto)</label>
                  <input
                    value={form.range}
                    onChange={(e) => setForm({ ...form, range: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
                    placeholder="60 pies (18 m)"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">Alcance (pies)</label>
                  <input
                    type="number"
                    value={form.rangeFeet}
                    onChange={(e) => setForm({ ...form, rangeFeet: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-300">Descripción</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">Tipo de ataque</label>
                  <select
                    value={form.attackType}
                    onChange={(e) => setForm({ ...form, attackType: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
                  >
                    <option value="">Ninguno / no aplica</option>
                    <option value="melee_spell">Cuerpo a cuerpo (conjuro)</option>
                    <option value="ranged_spell">A distancia (conjuro)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">Salvación</label>
                  <select
                    value={form.savingThrow}
                    onChange={(e) => setForm({ ...form, savingThrow: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
                  >
                    <option value="">Ninguna</option>
                    <option value="strength">Fuerza</option>
                    <option value="dexterity">Destreza</option>
                    <option value="constitution">Constitución</option>
                    <option value="intelligence">Inteligencia</option>
                    <option value="wisdom">Sabiduría</option>
                    <option value="charisma">Carisma</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">Dados de daño</label>
                  <input
                    value={form.damageDice}
                    onChange={(e) => setForm({ ...form, damageDice: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
                    placeholder="3d6"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">Tipo de daño</label>
                  <input
                    value={form.damageType}
                    onChange={(e) => setForm({ ...form, damageType: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
                    placeholder="fuego"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-300">Dado de curación (si aplica)</label>
                <input
                  value={form.healingDice}
                  onChange={(e) => setForm({ ...form, healingDice: e.target.value })}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
                  placeholder="1d8"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">Forma de área</label>
                  <select
                    value={form.areaShape}
                    onChange={(e) => setForm({ ...form, areaShape: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
                  >
                    <option value="">Sin área</option>
                    <option value="cone">Cono</option>
                    <option value="cube">Cubo</option>
                    <option value="sphere">Esfera</option>
                    <option value="line">Línea</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">Tamaño de área (ft)</label>
                  <input
                    type="number"
                    value={form.areaSizeFeet}
                    onChange={(e) => setForm({ ...form, areaSizeFeet: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-300">
                  Componentes (separados por coma)
                </label>
                <input
                  value={form.components}
                  onChange={(e) => setForm({ ...form, components: e.target.value })}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
                  placeholder="V, S, M"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-300">
                  Clases (separadas por coma)
                </label>
                <input
                  value={form.classes}
                  onChange={(e) => setForm({ ...form, classes: e.target.value })}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
                  placeholder="Mago, Hechicero"
                />
              </div>

              <div className="flex gap-6">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={form.concentration}
                    onChange={(e) => setForm({ ...form, concentration: e.target.checked })}
                    className="accent-yellow-400"
                  />
                  Concentración
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={form.ritual}
                    onChange={(e) => setForm({ ...form, ritual: e.target.checked })}
                    className="accent-yellow-400"
                  />
                  Ritual
                </label>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-300">Escalado (niveles superiores)</label>
                <textarea
                  value={form.higherLevels}
                  onChange={(e) => setForm({ ...form, higherLevels: e.target.value })}
                  rows={2}
                  className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
                  placeholder="+1d6 por cada nivel superior."
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-300">Notas</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
                />
              </div>

              {error ? (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              ) : null}

              {success ? (
                <div className="rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-200">
                  {success}
                </div>
              ) : null}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 rounded-xl bg-yellow-500 px-4 py-3 font-bold text-zinc-950 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear hechizo"}
                </button>

                {editingId ? (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-xl border border-zinc-700 px-4 py-3 font-semibold text-zinc-200 transition hover:bg-zinc-800"
                  >
                    Cancelar
                  </button>
                ) : null}
              </div>
            </form>
          </section>

          <section className="flex min-h-0 flex-col rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">Catálogo de hechizos</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  {filteredSpells.length} de {spells.length} hechizo(s)
                </p>
              </div>

              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-yellow-400"
              >
                <option value="all">Todos los niveles</option>
                <option value="0">Trucos</option>
                {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>Nivel {n}</option>
                ))}
              </select>
            </div>

            <div className="mt-6 min-h-0 flex-1 overflow-y-auto rounded-2xl border border-zinc-800">
              {isLoading ? (
                <div className="bg-zinc-950 p-4 text-sm text-zinc-400">Cargando hechizos...</div>
              ) : filteredSpells.length === 0 ? (
                <div className="bg-zinc-950 p-4 text-sm text-zinc-400">No hay hechizos todavía.</div>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {filteredSpells.map((spell) => (
                    <div
                      key={spell.id}
                      className="flex flex-col gap-2 bg-zinc-950 p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="font-bold text-white">
                          {spell.name}{" "}
                          <span className="text-xs font-normal text-zinc-500">
                            {spell.level === 0 ? "(truco)" : `(Nv.${spell.level})`}
                          </span>
                        </p>
                        <p className="text-sm text-zinc-400">
                          {spell.school}
                          {spell.damageDice ? ` · ${spell.damageDice} ${spell.damageType}` : ""}
                          {spell.healingDice ? ` · Cura ${spell.healingDice}` : ""}
                        </p>
                        {spell.savingThrow ? (
                          <p className="mt-1 text-xs text-zinc-500">Salvación: {spell.savingThrow}</p>
                        ) : null}
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(spell)}
                          className="rounded-xl border border-zinc-700 px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(spell)}
                          disabled={isDeletingId === spell.id}
                          className="rounded-xl border border-red-500 px-3 py-2 text-sm font-bold text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isDeletingId === spell.id ? "Eliminando..." : "Eliminar"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}