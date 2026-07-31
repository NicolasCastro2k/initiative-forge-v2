"use client";

import { FormEvent, useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Weapon = {
  id: string;
  name: string;
  category: string;
  attackType: string;
  damageDice: string;
  versatileDice: string | null;
  damageType: string;
  properties: string[];
  rangeNormal: number | null;
  rangeLong: number | null;
  isFinesse: boolean;
  isTwoHanded: boolean;
  isLight: boolean;
  isHeavy: boolean;
  isReach: boolean;
  isThrown: boolean;
  requiresAmmo: boolean;
  requiresLoading: boolean;
  isSpecial: boolean;
  source: string;
};

const emptyForm = {
  name: "",
  category: "simple",
  attackType: "melee",
  damageDice: "",
  versatileDice: "",
  damageType: "",
  properties: "",
  rangeNormal: "",
  rangeLong: "",
  isFinesse: false,
  isTwoHanded: false,
  isLight: false,
  isHeavy: false,
  isReach: false,
  isThrown: false,
  requiresAmmo: false,
  requiresLoading: false,
  isSpecial: false,
};

export default function AdminWeaponsPage() {
  const [weapons, setWeapons] = useState<Weapon[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  async function loadWeapons() {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/admin/weapons`, {
        credentials: "include",
      });

      const data = await response.json().catch(() => null);

      if (response.status === 401) {
        window.location.href = `/login?redirect=${encodeURIComponent("/admin/weapons")}`;
        return;
      }

      if (response.status === 403) {
        setError("No tienes permisos de administrador.");
        return;
      }

      if (!response.ok) {
        setError(data?.message ?? "No se pudieron cargar las armas.");
        return;
      }

      setWeapons(data.weapons ?? []);
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadWeapons();
  }, []);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function startEdit(weapon: Weapon) {
    setEditingId(weapon.id);
    setForm({
      name: weapon.name,
      category: weapon.category,
      attackType: weapon.attackType,
      damageDice: weapon.damageDice,
      versatileDice: weapon.versatileDice ?? "",
      damageType: weapon.damageType,
      properties: weapon.properties.join(", "),
      rangeNormal: weapon.rangeNormal !== null ? String(weapon.rangeNormal) : "",
      rangeLong: weapon.rangeLong !== null ? String(weapon.rangeLong) : "",
      isFinesse: weapon.isFinesse,
      isTwoHanded: weapon.isTwoHanded,
      isLight: weapon.isLight,
      isHeavy: weapon.isHeavy,
      isReach: weapon.isReach,
      isThrown: weapon.isThrown,
      requiresAmmo: weapon.requiresAmmo,
      requiresLoading: weapon.requiresLoading,
      isSpecial: weapon.isSpecial,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanName = form.name.trim();
    const cleanDamageDice = form.damageDice.trim();
    const cleanDamageType = form.damageType.trim();

    if (!cleanName || !cleanDamageDice || !cleanDamageType) {
      setError("Nombre, dado de daño y tipo de daño son obligatorios.");
      return;
    }

    setError("");
    setSuccess("");
    setIsSaving(true);

    const payload = {
      name: cleanName,
      category: form.category,
      attackType: form.attackType,
      damageDice: cleanDamageDice,
      versatileDice: form.versatileDice.trim() || null,
      damageType: cleanDamageType,
      properties: form.properties
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
      rangeNormal: form.rangeNormal === "" ? "" : Number(form.rangeNormal),
      rangeLong: form.rangeLong === "" ? "" : Number(form.rangeLong),
      isFinesse: form.isFinesse,
      isTwoHanded: form.isTwoHanded,
      isLight: form.isLight,
      isHeavy: form.isHeavy,
      isReach: form.isReach,
      isThrown: form.isThrown,
      requiresAmmo: form.requiresAmmo,
      requiresLoading: form.requiresLoading,
      isSpecial: form.isSpecial,
    };

    try {
      const url = editingId ? `${API_URL}/admin/weapons/${editingId}` : `${API_URL}/admin/weapons`;
      const method = editingId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (response.status === 401) {
        window.location.href = `/login?redirect=${encodeURIComponent("/admin/weapons")}`;
        return;
      }

      if (!response.ok) {
        setError(data?.message ?? "No se pudo guardar el arma.");
        return;
      }

      setSuccess(editingId ? `Arma actualizada: ${data.weapon.name}` : `Arma creada: ${data.weapon.name}`);
      resetForm();
      await loadWeapons();
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(weapon: Weapon) {
    const confirmed = window.confirm(`¿Eliminar "${weapon.name}" del catálogo? Esta acción no se puede deshacer.`);
    if (!confirmed) return;

    setIsDeletingId(weapon.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API_URL}/admin/weapons/${weapon.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.message ?? "No se pudo eliminar el arma.");
        return;
      }

      setSuccess(`Arma eliminada: ${weapon.name}`);
      setWeapons((current) => current.filter((w) => w.id !== weapon.id));
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
          backgroundImage: "url('/backgrounds/weapons-bg.jpg')",
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
            <h1 className="mt-2 text-3xl font-black">Administración de armas</h1>
            <p className="mt-1 text-zinc-400">
              Agrega, edita o elimina armas del catálogo disponible en las fichas de personaje.
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
              {editingId ? "Editar arma" : "Crear arma"}
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              {editingId
                ? "Actualiza los datos y guarda los cambios."
                : "Agrega una nueva arma al catálogo compartido."}
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-300">Nombre</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
                  placeholder="Ej: Alabarda élfica"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">Categoría</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
                  >
                    <option value="simple">Simple</option>
                    <option value="martial">Marcial</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">Tipo</label>
                  <select
                    value={form.attackType}
                    onChange={(e) => setForm({ ...form, attackType: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
                  >
                    <option value="melee">Cuerpo a cuerpo</option>
                    <option value="ranged">Distancia</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">Dado de daño</label>
                  <input
                    value={form.damageDice}
                    onChange={(e) => setForm({ ...form, damageDice: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
                    placeholder="1d8"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">Dado versátil</label>
                  <input
                    value={form.versatileDice}
                    onChange={(e) => setForm({ ...form, versatileDice: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
                    placeholder="1d10 (opcional)"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-300">Tipo de daño</label>
                <input
                  value={form.damageType}
                  onChange={(e) => setForm({ ...form, damageType: e.target.value })}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
                  placeholder="cortante, perforante, contundente..."
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-300">
                  Propiedades (separadas por coma)
                </label>
                <input
                  value={form.properties}
                  onChange={(e) => setForm({ ...form, properties: e.target.value })}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
                  placeholder="Ligera, Finesse, Arrojadiza (20/60)"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">Alcance normal (ft)</label>
                  <input
                    type="number"
                    value={form.rangeNormal}
                    onChange={(e) => setForm({ ...form, rangeNormal: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">Alcance largo (ft)</label>
                  <input
                    type="number"
                    value={form.rangeLong}
                    onChange={(e) => setForm({ ...form, rangeLong: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
                  />
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-zinc-300">Propiedades booleanas</p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ["isFinesse", "Finesse"],
                    ["isTwoHanded", "Dos manos"],
                    ["isLight", "Ligera"],
                    ["isHeavy", "Pesada"],
                    ["isReach", "Alcance"],
                    ["isThrown", "Arrojadiza"],
                    ["requiresAmmo", "Munición"],
                    ["requiresLoading", "Carga"],
                    ["isSpecial", "Especial"],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                      <input
                        type="checkbox"
                        checked={form[key]}
                        onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                        className="accent-yellow-400"
                      />
                      {label}
                    </label>
                  ))}
                </div>
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
                  {isSaving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear arma"}
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
            <h2 className="text-xl font-black">Catálogo de armas</h2>
            <p className="mt-1 text-sm text-zinc-400">
              {weapons.length} arma(s) disponibles en las fichas de personaje.
            </p>

            <div className="mt-6 min-h-0 flex-1 overflow-y-auto rounded-2xl border border-zinc-800">
              {isLoading ? (
                <div className="bg-zinc-950 p-4 text-sm text-zinc-400">Cargando armas...</div>
              ) : weapons.length === 0 ? (
                <div className="bg-zinc-950 p-4 text-sm text-zinc-400">No hay armas todavía.</div>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {weapons.map((weapon) => (
                    <div
                      key={weapon.id}
                      className="flex flex-col gap-2 bg-zinc-950 p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="font-bold text-white">{weapon.name}</p>
                        <p className="text-sm text-zinc-400">
                          {weapon.damageDice} {weapon.damageType} ·{" "}
                          {weapon.category === "martial" ? "Marcial" : "Simple"} ·{" "}
                          {weapon.attackType === "ranged" ? "Distancia" : "Cuerpo a cuerpo"}
                        </p>
                        {weapon.properties.length > 0 ? (
                          <p className="mt-1 text-xs text-zinc-500">{weapon.properties.join(", ")}</p>
                        ) : null}
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(weapon)}
                          className="rounded-xl border border-zinc-700 px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(weapon)}
                          disabled={isDeletingId === weapon.id}
                          className="rounded-xl border border-red-500 px-3 py-2 text-sm font-bold text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isDeletingId === weapon.id ? "Eliminando..." : "Eliminar"}
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