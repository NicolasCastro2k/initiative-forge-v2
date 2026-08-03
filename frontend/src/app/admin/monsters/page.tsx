"use client";

import { FormEvent, useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type MonsterAttack = {
  name: string;
  attackBonus: string;
  reach: string;
  rangeShort: string;
  rangeLong: string;
  damage: string;
  damageType: string;
};

type Monster = {
  id: string;
  name: string;
  nameEn: string | null;
  cr: number;
  crLabel: string;
  ac: number;
  hp: number;
  hitDice: string;
  speedWalk: number;
  speedFly: number;
  speedSwim: number;
  speedClimb: number;
  speedBurrow: number;
  size: string;
  strength: number;
  dexterity: number;
  constitution: number;
  attacks: MonsterAttack[];
  traits: string;
  vulnerabilities: string | null;
  resistances: string | null;
  immunities: string | null;
  conditionImmunities: string | null;
  multiattack: boolean;
  tokenImagePath: string | null;
  source: string;
};

function getImageUrl(path: string | null) {
  if (!path) return "";
  return path.startsWith("http") ? path : `${API_URL}${path}`;
}

const emptyForm = {
  name: "",
  nameEn: "",
  cr: "0",
  crLabel: "0",
  ac: "10",
  hp: "1",
  hitDice: "",
  speedWalk: "30",
  speedFly: "0",
  speedSwim: "0",
  speedClimb: "0",
  speedBurrow: "0",
  size: "Mediano",
  strength: "10",
  dexterity: "10",
  constitution: "10",
  traits: "",
  vulnerabilities: "",
  resistances: "",
  immunities: "",
  conditionImmunities: "",
  multiattack: false,
  source: "Personalizada",
};

const SIZES = ["Diminuto", "Pequeño", "Mediano", "Grande", "Enorme", "Gargantuesco"];

export default function AdminMonstersPage() {
  const [monsters, setMonsters] = useState<Monster[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [attacks, setAttacks] = useState<MonsterAttack[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [isUploadingToken, setIsUploadingToken] = useState(false);
  const [editingTokenPath, setEditingTokenPath] = useState<string | null>(null);

  async function loadMonsters() {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/admin/monsters`, {
        credentials: "include",
      });

      const data = await response.json().catch(() => null);

      if (response.status === 401) {
        window.location.href = `/login?redirect=${encodeURIComponent("/admin/monsters")}`;
        return;
      }

      if (response.status === 403) {
        setError("No tienes permisos de administrador.");
        return;
      }

      if (!response.ok) {
        setError(data?.message ?? "No se pudieron cargar los monstruos.");
        return;
      }

      setMonsters(data.monsters ?? []);
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadMonsters();
  }, []);

  function resetForm() {
    setForm(emptyForm);
    setAttacks([]);
    setEditingId(null);
    setEditingTokenPath(null);
  }

  function startEdit(monster: Monster) {
    setEditingId(monster.id);
    setForm({
      name: monster.name,
      nameEn: monster.nameEn ?? "",
      cr: String(monster.cr),
      crLabel: monster.crLabel,
      ac: String(monster.ac),
      hp: String(monster.hp),
      hitDice: monster.hitDice,
      speedWalk: String(monster.speedWalk),
      speedFly: String(monster.speedFly),
      speedSwim: String(monster.speedSwim),
      speedClimb: String(monster.speedClimb),
      speedBurrow: String(monster.speedBurrow),
      size: monster.size,
      strength: String(monster.strength),
      dexterity: String(monster.dexterity),
      constitution: String(monster.constitution),
      traits: monster.traits,
      vulnerabilities: monster.vulnerabilities ?? "",
      resistances: monster.resistances ?? "",
      immunities: monster.immunities ?? "",
      conditionImmunities: monster.conditionImmunities ?? "",
      multiattack: monster.multiattack,
      source: monster.source,
    });
    setAttacks(
      (monster.attacks ?? []).map((a) => ({
        name: a.name ?? "",
        attackBonus: a.attackBonus ?? "",
        reach: a.reach ?? "",
        rangeShort: a.rangeShort !== undefined && a.rangeShort !== null ? String(a.rangeShort) : "",
        rangeLong: a.rangeLong !== undefined && a.rangeLong !== null ? String(a.rangeLong) : "",
        damage: a.damage ?? "",
        damageType: a.damageType ?? "",
      }))
    );
    setEditingTokenPath(monster.tokenImagePath);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function uploadToken(file: File | null) {
    if (!file || !editingId) return;
    setIsUploadingToken(true);
    setError("");

    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await fetch(`${API_URL}/admin/monsters/${editingId}/image`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.imagePath) {
        setError(data?.message ?? "No se pudo subir el token.");
        return;
      }
      setEditingTokenPath(data.imagePath as string);
      setMonsters((current) => current.map((m) => (m.id === editingId ? { ...m, tokenImagePath: data.imagePath } : m)));
      setSuccess("Token actualizado.");
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setIsUploadingToken(false);
    }
  }

  function addAttackRow() {
    setAttacks((current) => [...current, { name: "", attackBonus: "+0", reach: "5 ft", rangeShort: "", rangeLong: "", damage: "", damageType: "" }]);
  }

  function updateAttackRow(index: number, patch: Partial<MonsterAttack>) {
    setAttacks((current) => current.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  function removeAttackRow(index: number) {
    setAttacks((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanName = form.name.trim();
    const cleanHitDice = form.hitDice.trim();

    if (!cleanName || !cleanHitDice) {
      setError("Nombre y dado de golpe son obligatorios.");
      return;
    }

    setError("");
    setSuccess("");
    setIsSaving(true);

    const payload = {
      name: cleanName,
      nameEn: form.nameEn.trim() || null,
      cr: Number(form.cr) || 0,
      crLabel: form.crLabel.trim() || String(Number(form.cr) || 0),
      ac: Number(form.ac) || 10,
      hp: Number(form.hp) || 1,
      hitDice: cleanHitDice,
      speedWalk: Number(form.speedWalk) || 0,
      speedFly: Number(form.speedFly) || 0,
      speedSwim: Number(form.speedSwim) || 0,
      speedClimb: Number(form.speedClimb) || 0,
      speedBurrow: Number(form.speedBurrow) || 0,
      size: form.size,
      strength: Number(form.strength) || 10,
      dexterity: Number(form.dexterity) || 10,
      constitution: Number(form.constitution) || 10,
      attacks: attacks
        .filter((a) => a.name.trim())
        .map((a) => ({
          name: a.name.trim(),
          attackBonus: a.attackBonus.trim(),
          reach: a.reach.trim() || null,
          rangeShort: a.rangeShort.trim() === "" ? null : Number(a.rangeShort),
          rangeLong: a.rangeLong.trim() === "" ? null : Number(a.rangeLong),
          damage: a.damage.trim(),
          damageType: a.damageType.trim(),
        })),
      traits: form.traits.trim(),
      vulnerabilities: form.vulnerabilities.trim() || null,
      resistances: form.resistances.trim() || null,
      immunities: form.immunities.trim() || null,
      conditionImmunities: form.conditionImmunities.trim() || null,
      multiattack: form.multiattack,
      source: form.source.trim() || "Personalizada",
    };

    try {
      const url = editingId ? `${API_URL}/admin/monsters/${editingId}` : `${API_URL}/admin/monsters`;
      const method = editingId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (response.status === 401) {
        window.location.href = `/login?redirect=${encodeURIComponent("/admin/monsters")}`;
        return;
      }

      if (!response.ok) {
        setError(data?.message ?? "No se pudo guardar el monstruo.");
        return;
      }

      setSuccess(editingId ? `Monstruo actualizado: ${data.monster.name}` : `Monstruo creado: ${data.monster.name}`);
      resetForm();
      await loadMonsters();
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(monster: Monster) {
    const confirmed = window.confirm(`¿Eliminar "${monster.name}" del catálogo? Esta acción no se puede deshacer.`);
    if (!confirmed) return;

    setIsDeletingId(monster.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API_URL}/admin/monsters/${monster.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.message ?? "No se pudo eliminar el monstruo.");
        return;
      }

      setSuccess(`Monstruo eliminado: ${monster.name}`);
      setMonsters((current) => current.filter((m) => m.id !== monster.id));
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setIsDeletingId(null);
    }
  }

  return (
    <main className="relative flex h-screen flex-col overflow-hidden bg-zinc-950 p-6 text-white">
      <div className="absolute inset-0 bg-gradient-to-b from-red-950/30 via-zinc-950/70 to-zinc-950/90" />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col overflow-hidden">
        <header className="mb-8 flex flex-shrink-0 flex-col gap-4 rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-400">
              Initiative Forge
            </p>
            <h1 className="mt-2 text-3xl font-black">Administración de monstruos</h1>
            <p className="mt-1 text-zinc-400">
              Catálogo de enemigos para el tablero de combate, con token propio para colocarlos en el mapa.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a href="/admin/beasts" className="rounded-xl border border-zinc-700 px-4 py-3 font-semibold text-zinc-200 transition hover:bg-zinc-800">
              Bestias
            </a>
            <a href="/admin/weapons" className="rounded-xl border border-zinc-700 px-4 py-3 font-semibold text-zinc-200 transition hover:bg-zinc-800">
              Armas
            </a>
            <a href="/admin/spells" className="rounded-xl border border-zinc-700 px-4 py-3 font-semibold text-zinc-200 transition hover:bg-zinc-800">
              Hechizos
            </a>
            <a href="/admin/races" className="rounded-xl border border-zinc-700 px-4 py-3 font-semibold text-zinc-200 transition hover:bg-zinc-800">
              Razas
            </a>
            <a href="/dashboard" className="rounded-xl border border-zinc-700 px-4 py-3 font-semibold text-zinc-200 transition hover:bg-zinc-800">
              Volver al dashboard
            </a>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-6 overflow-hidden lg:grid-cols-[440px_1fr]">
          <section className="min-h-0 overflow-y-auto rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <h2 className="text-xl font-black">
              {editingId ? "Editar monstruo" : "Crear monstruo"}
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              {editingId
                ? "Actualiza los datos y guarda los cambios."
                : "Agrega un nuevo monstruo al catálogo del tablero de combate."}
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">Nombre</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-red-400"
                    placeholder="Ej: Goblin"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">Nombre (inglés)</label>
                  <input
                    value={form.nameEn}
                    onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-red-400"
                    placeholder="Goblin (opcional)"
                  />
                </div>
              </div>

              {editingId ? (
                <div>
                  <span className="mb-2 block text-sm font-semibold text-zinc-300">
                    Token (se muestra en el mapa de combate al colocarlo como enemigo)
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950">
                      {editingTokenPath ? (
                        <img src={getImageUrl(editingTokenPath)} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-zinc-600">Sin token</div>
                      )}
                    </div>
                    <label className="flex-1 cursor-pointer rounded-xl border border-zinc-700 px-4 py-3 text-center text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800">
                      {isUploadingToken ? "Subiendo..." : "Subir imagen"}
                      <input type="file" accept="image/*" className="hidden" disabled={isUploadingToken}
                        onChange={(e) => { void uploadToken(e.target.files?.[0] ?? null); e.currentTarget.value = ""; }} />
                    </label>
                  </div>
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-zinc-700 px-4 py-3 text-xs text-zinc-500">
                  Podrás subir el token después de crear el monstruo (editándolo).
                </p>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">CR (número)</label>
                  <input
                    type="number" step="0.01"
                    value={form.cr}
                    onChange={(e) => setForm({ ...form, cr: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-red-400"
                  />
                  <p className="mt-1 text-[11px] text-zinc-500">0.25 = CR 1/4</p>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">CR (etiqueta)</label>
                  <input
                    value={form.crLabel}
                    onChange={(e) => setForm({ ...form, crLabel: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-red-400"
                    placeholder="1/4"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">Tamaño</label>
                  <select
                    value={form.size}
                    onChange={(e) => setForm({ ...form, size: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-red-400"
                  >
                    {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">CA</label>
                  <input type="number" value={form.ac} onChange={(e) => setForm({ ...form, ac: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-red-400" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">PG</label>
                  <input type="number" value={form.hp} onChange={(e) => setForm({ ...form, hp: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-red-400" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">Dado de golpe</label>
                  <input value={form.hitDice} onChange={(e) => setForm({ ...form, hitDice: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-red-400" placeholder="2d6" />
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-zinc-300">Velocidad (ft)</p>
                <div className="grid grid-cols-5 gap-2">
                  {([
                    ["speedWalk", "Andar"],
                    ["speedFly", "Volar"],
                    ["speedSwim", "Nadar"],
                    ["speedClimb", "Trepar"],
                    ["speedBurrow", "Excavar"],
                  ] as const).map(([key, label]) => (
                    <div key={key}>
                      <label className="mb-1 block text-[11px] text-zinc-400">{label}</label>
                      <input type="number" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-center text-sm text-white outline-none transition focus:border-red-400" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">FUE</label>
                  <input type="number" value={form.strength} onChange={(e) => setForm({ ...form, strength: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-red-400" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">DES</label>
                  <input type="number" value={form.dexterity} onChange={(e) => setForm({ ...form, dexterity: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-red-400" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">CON</label>
                  <input type="number" value={form.constitution} onChange={(e) => setForm({ ...form, constitution: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-red-400" />
                </div>
              </div>

              {/* Ataques */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-zinc-300">Ataques</p>
                  <button type="button" onClick={addAttackRow}
                    className="rounded-lg border border-zinc-700 px-3 py-1 text-xs font-bold text-zinc-200 transition hover:bg-zinc-800">
                    + Ataque
                  </button>
                </div>
                <div className="space-y-2">
                  {attacks.length === 0 ? (
                    <p className="text-xs text-zinc-500">Sin ataques todavía.</p>
                  ) : (
                    attacks.map((atk, i) => (
                      <div key={i} className="space-y-1.5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-2">
                        <div className="grid grid-cols-[1fr_70px_28px] gap-1.5">
                          <input value={atk.name} onChange={(e) => updateAttackRow(i, { name: e.target.value })}
                            placeholder="Cimitarra"
                            className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white outline-none focus:border-red-400" />
                          <input value={atk.attackBonus} onChange={(e) => updateAttackRow(i, { attackBonus: e.target.value })}
                            placeholder="+4"
                            className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white outline-none focus:border-red-400" />
                          <button type="button" onClick={() => removeAttackRow(i)}
                            className="rounded-lg border border-red-500/50 text-xs font-bold text-red-300 transition hover:bg-red-500/10">✕</button>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          <input value={atk.reach} onChange={(e) => updateAttackRow(i, { reach: e.target.value })}
                            placeholder="Alcance (5 ft)"
                            className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white outline-none focus:border-red-400" />
                          <input value={atk.rangeShort} onChange={(e) => updateAttackRow(i, { rangeShort: e.target.value })}
                            placeholder="Alcance corto (ft)" type="number"
                            className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white outline-none focus:border-red-400" />
                          <input value={atk.rangeLong} onChange={(e) => updateAttackRow(i, { rangeLong: e.target.value })}
                            placeholder="Alcance largo (ft)" type="number"
                            className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white outline-none focus:border-red-400" />
                          <input value={atk.damageType} onChange={(e) => updateAttackRow(i, { damageType: e.target.value })}
                            placeholder="Tipo (cortante)"
                            className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white outline-none focus:border-red-400" />
                        </div>
                        <input value={atk.damage} onChange={(e) => updateAttackRow(i, { damage: e.target.value })}
                          placeholder="Daño: 1d6 + 2"
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white outline-none focus:border-red-400" />
                      </div>
                    ))
                  )}
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                <input type="checkbox" checked={form.multiattack}
                  onChange={(e) => setForm({ ...form, multiattack: e.target.checked })}
                  className="accent-red-400" />
                Multiataque
              </label>

              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-300">Rasgos (regeneración, aliento, etc.)</label>
                <textarea value={form.traits} onChange={(e) => setForm({ ...form, traits: e.target.value })} rows={3}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-red-400"
                  placeholder="Regeneración 10 PV al inicio de su turno..." />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">Resistencias</label>
                  <input value={form.resistances} onChange={(e) => setForm({ ...form, resistances: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-red-400" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">Inmunidades</label>
                  <input value={form.immunities} onChange={(e) => setForm({ ...form, immunities: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-red-400" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">Vulnerabilidades</label>
                  <input value={form.vulnerabilities} onChange={(e) => setForm({ ...form, vulnerabilities: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-red-400" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">Inmun. a condiciones</label>
                  <input value={form.conditionImmunities} onChange={(e) => setForm({ ...form, conditionImmunities: e.target.value })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-red-400" />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-300">Fuente</label>
                <input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-red-400" />
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
                  className="flex-1 rounded-xl bg-red-600 px-4 py-3 font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear monstruo"}
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
            <h2 className="text-xl font-black">Catálogo de monstruos</h2>
            <p className="mt-1 text-sm text-zinc-400">
              {monsters.length} monstruo(s) disponibles para el tablero de combate.
            </p>

            <div className="mt-6 min-h-0 flex-1 overflow-y-auto rounded-2xl border border-zinc-800">
              {isLoading ? (
                <div className="bg-zinc-950 p-4 text-sm text-zinc-400">Cargando monstruos...</div>
              ) : monsters.length === 0 ? (
                <div className="bg-zinc-950 p-4 text-sm text-zinc-400">No hay monstruos todavía.</div>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {monsters.map((monster) => (
                    <div
                      key={monster.id}
                      className="flex flex-col gap-2 bg-zinc-950 p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
                          {monster.tokenImagePath ? (
                            <img src={getImageUrl(monster.tokenImagePath)} alt="" className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div>
                          <p className="font-bold text-white">
                            {monster.name} <span className="text-xs font-normal text-zinc-500">CR {monster.crLabel}</span>
                          </p>
                          <p className="text-sm text-zinc-400">
                            CA {monster.ac} · PG {monster.hp} ({monster.hitDice}) · {monster.size}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {monster.attacks.length} ataque(s){monster.multiattack ? " · Multiataque" : ""}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(monster)}
                          className="rounded-xl border border-zinc-700 px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(monster)}
                          disabled={isDeletingId === monster.id}
                          className="rounded-xl border border-red-500 px-3 py-2 text-sm font-bold text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isDeletingId === monster.id ? "Eliminando..." : "Eliminar"}
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