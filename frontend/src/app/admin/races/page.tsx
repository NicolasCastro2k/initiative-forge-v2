"use client";

import { FormEvent, useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type AbilityKey = "strength" | "dexterity" | "constitution" | "intelligence" | "wisdom" | "charisma";

type Race = {
  id: string;
  name: string;
  source: string;
  speed: number;
  size: string;
  abilityBonuses: Partial<Record<AbilityKey, number>>;
  traits: string[];
  languages: string[];
  appearance: string;
  commonClasses: string[];
  isSrd: boolean;
};

const ABILITY_KEYS: { key: AbilityKey; label: string }[] = [
  { key: "strength", label: "Fuerza" },
  { key: "dexterity", label: "Destreza" },
  { key: "constitution", label: "Constitución" },
  { key: "intelligence", label: "Inteligencia" },
  { key: "wisdom", label: "Sabiduría" },
  { key: "charisma", label: "Carisma" },
];

const emptyForm = {
  name: "",
  source: "Personalizada",
  speed: "30",
  size: "Medium",
  abilityBonuses: { strength: "", dexterity: "", constitution: "", intelligence: "", wisdom: "", charisma: "" } as Record<AbilityKey, string>,
  traits: "",
  languages: "",
  appearance: "",
  commonClasses: "",
};

export default function AdminRacesPage() {
  const [races, setRaces] = useState<Race[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  async function loadRaces() {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/admin/races`, {
        credentials: "include",
      });

      const data = await response.json().catch(() => null);

      if (response.status === 401) {
        window.location.href = `/login?redirect=${encodeURIComponent("/admin/races")}`;
        return;
      }

      if (response.status === 403) {
        setError("No tienes permisos de administrador.");
        return;
      }

      if (!response.ok) {
        setError(data?.message ?? "No se pudieron cargar las razas.");
        return;
      }

      setRaces(data.races ?? []);
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadRaces();
  }, []);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function startEdit(race: Race) {
    setEditingId(race.id);
    setForm({
      name: race.name,
      source: race.source,
      speed: String(race.speed),
      size: race.size,
      abilityBonuses: {
        strength: race.abilityBonuses.strength !== undefined ? String(race.abilityBonuses.strength) : "",
        dexterity: race.abilityBonuses.dexterity !== undefined ? String(race.abilityBonuses.dexterity) : "",
        constitution: race.abilityBonuses.constitution !== undefined ? String(race.abilityBonuses.constitution) : "",
        intelligence: race.abilityBonuses.intelligence !== undefined ? String(race.abilityBonuses.intelligence) : "",
        wisdom: race.abilityBonuses.wisdom !== undefined ? String(race.abilityBonuses.wisdom) : "",
        charisma: race.abilityBonuses.charisma !== undefined ? String(race.abilityBonuses.charisma) : "",
      },
      traits: race.traits.join(", "),
      languages: race.languages.join(", "),
      appearance: race.appearance,
      commonClasses: race.commonClasses.join(", "),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanName = form.name.trim();

    if (!cleanName) {
      setError("El nombre de la raza es obligatorio.");
      return;
    }

    setError("");
    setSuccess("");
    setIsSaving(true);

    const abilityBonuses: Partial<Record<AbilityKey, number>> = {};
    ABILITY_KEYS.forEach(({ key }) => {
      const v = form.abilityBonuses[key];
      if (v !== "" && v !== undefined) abilityBonuses[key] = Number(v);
    });

    const payload = {
      name: cleanName,
      source: form.source.trim() || "Personalizada",
      speed: Number(form.speed) || 30,
      size: form.size.trim() || "Medium",
      abilityBonuses,
      traits: form.traits.split(",").map((t) => t.trim()).filter(Boolean),
      languages: form.languages.split(",").map((l) => l.trim()).filter(Boolean),
      appearance: form.appearance.trim(),
      commonClasses: form.commonClasses.split(",").map((c) => c.trim()).filter(Boolean),
      isSrd: false,
    };

    try {
      const url = editingId ? `${API_URL}/admin/races/${editingId}` : `${API_URL}/admin/races`;
      const method = editingId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (response.status === 401) {
        window.location.href = `/login?redirect=${encodeURIComponent("/admin/races")}`;
        return;
      }

      if (!response.ok) {
        setError(data?.message ?? "No se pudo guardar la raza.");
        return;
      }

      setSuccess(editingId ? `Raza actualizada: ${data.race.name}` : `Raza creada: ${data.race.name}`);
      resetForm();
      await loadRaces();
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(race: Race) {
    const confirmed = window.confirm(`¿Eliminar "${race.name}" del catálogo? Esta acción no se puede deshacer.`);
    if (!confirmed) return;

    setIsDeletingId(race.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API_URL}/admin/races/${race.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.message ?? "No se pudo eliminar la raza.");
        return;
      }

      setSuccess(`Raza eliminada: ${race.name}`);
      setRaces((current) => current.filter((r) => r.id !== race.id));
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setIsDeletingId(null);
    }
  }

  return (
    <main className="relative flex h-screen flex-col overflow-hidden bg-zinc-950 p-6 text-white">
      {/* Imagen de fondo */}
      <div
        className="pointer-events-none absolute inset-0 opacity-100"
        style={{
          backgroundImage: "url('/backgrounds/races-bg.jpg')",
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
            <h1 className="mt-2 text-3xl font-black">Administración de razas</h1>
            <p className="mt-1 text-zinc-400">
              Agrega, edita o elimina razas del catálogo disponible en las fichas de personaje.
            </p>
          </div>

          <div className="flex gap-3">
            <a
              href="/admin/spells"
              className="rounded-xl border border-zinc-700 px-4 py-3 font-semibold text-zinc-200 transition hover:bg-zinc-800"
            >
              Hechizos
            </a>
            <a
              href="/admin/weapons"
              className="rounded-xl border border-zinc-700 px-4 py-3 font-semibold text-zinc-200 transition hover:bg-zinc-800"
            >
              Armas
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
              {editingId ? "Editar raza" : "Crear raza"}
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              {editingId ? "Actualiza los datos y guarda los cambios." : "Agrega una nueva raza al catálogo compartido."}
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-300">Nombre</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
                  placeholder="Ej: Aasimar"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">Velocidad (ft)</label>
                  <input
                    type="number"
                    value={form.speed}
                    onChange={(e) => setForm({ ...form, speed: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">Tamaño</label>
                  <select
                    value={form.size}
                    onChange={(e) => setForm({ ...form, size: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
                  >
                    <option value="Small">Pequeño</option>
                    <option value="Medium">Mediano</option>
                    <option value="Large">Grande</option>
                  </select>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-zinc-300">Bonificadores de característica</p>
                <div className="grid grid-cols-3 gap-2">
                  {ABILITY_KEYS.map(({ key, label }) => (
                    <div key={key}>
                      <label className="mb-1 block text-xs text-zinc-400">{label}</label>
                      <input
                        type="number"
                        value={form.abilityBonuses[key]}
                        onChange={(e) => setForm({ ...form, abilityBonuses: { ...form.abilityBonuses, [key]: e.target.value } })}
                        placeholder="0"
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm text-white outline-none transition focus:border-yellow-400"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-300">Apariencia (descripción breve)</label>
                <textarea
                  value={form.appearance}
                  onChange={(e) => setForm({ ...form, appearance: e.target.value })}
                  rows={3}
                  className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
                  placeholder="Ej: Altos, delgados, rasgos elegantes, orejas largas..."
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-300">
                  Clases más comunes (separadas por coma)
                </label>
                <input
                  value={form.commonClasses}
                  onChange={(e) => setForm({ ...form, commonClasses: e.target.value })}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
                  placeholder="Mago, Hechicero, Brujo"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-300">
                  Rasgos raciales (separados por coma)
                </label>
                <input
                  value={form.traits}
                  onChange={(e) => setForm({ ...form, traits: e.target.value })}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
                  placeholder="Visión en penumbra, Trance..."
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-300">
                  Idiomas (separados por coma)
                </label>
                <input
                  value={form.languages}
                  onChange={(e) => setForm({ ...form, languages: e.target.value })}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
                  placeholder="Común, Élfico"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-300">Fuente</label>
                <input
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
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
                  {isSaving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear raza"}
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
            <h2 className="text-xl font-black">Catálogo de razas</h2>
            <p className="mt-1 text-sm text-zinc-400">
              {races.length} raza(s) disponibles en las fichas de personaje.
            </p>

            <div className="mt-6 min-h-0 flex-1 overflow-y-auto rounded-2xl border border-zinc-800">
              {isLoading ? (
                <div className="bg-zinc-950 p-4 text-sm text-zinc-400">Cargando razas...</div>
              ) : races.length === 0 ? (
                <div className="bg-zinc-950 p-4 text-sm text-zinc-400">No hay razas todavía.</div>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {races.map((race) => (
                    <div
                      key={race.id}
                      className="flex flex-col gap-2 bg-zinc-950 p-4 md:flex-row md:items-start md:justify-between"
                    >
                      <div>
                        <p className="font-bold text-white">{race.name}</p>
                        <p className="text-sm text-zinc-400">
                          {race.speed}ft · {race.size === "Small" ? "Pequeño" : race.size === "Large" ? "Grande" : "Mediano"}
                          {Object.keys(race.abilityBonuses).length > 0 && (
                            <> · {Object.entries(race.abilityBonuses).map(([k, v]) => `${ABILITY_KEYS.find((a) => a.key === k)?.label ?? k} +${v}`).join(", ")}</>
                          )}
                        </p>
                        {race.appearance && (
                          <p className="mt-1 text-xs text-green-300">{race.appearance}</p>
                        )}
                        {race.commonClasses.length > 0 && (
                          <p className="mt-1 text-xs text-zinc-500">
                            Clases comunes: {race.commonClasses.join(", ")}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(race)}
                          className="rounded-xl border border-zinc-700 px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(race)}
                          disabled={isDeletingId === race.id}
                          className="rounded-xl border border-red-500 px-3 py-2 text-sm font-bold text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isDeletingId === race.id ? "Eliminando..." : "Eliminar"}
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