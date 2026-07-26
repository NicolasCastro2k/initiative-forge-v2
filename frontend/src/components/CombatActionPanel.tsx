// frontend/src/components/CombatActionPanel.tsx
//
// Panel completo de acciones de combate D&D 5e.
// Uso en combat/page.tsx:
//   import CombatActionPanel from "@/components/CombatActionPanel";
//   <CombatActionPanel ... />

"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type AbilityName = "str" | "dex" | "con" | "int" | "wis" | "cha";

type Condition =
  | "blinded" | "charmed" | "deafened" | "exhaustion" | "frightened"
  | "grappled" | "incapacitated" | "invisible" | "paralyzed" | "petrified"
  | "poisoned" | "prone" | "restrained" | "stunned" | "unconscious";

const CONDITION_LABELS: Record<Condition, string> = {
  blinded: "Cegado", charmed: "Hechizado", deafened: "Ensordecido",
  exhaustion: "Agotamiento", frightened: "Asustado", grappled: "Agarrado",
  incapacitated: "Incapacitado", invisible: "Invisible", paralyzed: "Paralizado",
  petrified: "Petrificado", poisoned: "Envenenado", prone: "Derribado",
  restrained: "Restringido", stunned: "Aturdido", unconscious: "Inconsciente",
};

const ALL_CONDITIONS = Object.keys(CONDITION_LABELS) as Condition[];

const ABILITY_LABELS: Record<AbilityName, string> = {
  str: "FUE", dex: "DES", con: "CON", int: "INT", wis: "SAB", cha: "CAR",
};

type WeaponData = {
  name: string;
  attackBonus: number;  // Ya calculado en la ficha
  damage: string;       // "1d8+3 cortante" — string completo
  count: number;
  sides: number;
  modifier: number;
  damageType: string;
};

type SpellData = {
  name: string;
  level: number;
  school?: string | null;
  attackType?: "melee_spell" | "ranged_spell" | null;
  savingThrow?: string | null;
  damageDice?: string | null;
  damageType?: string | null;
  healingDice?: string | null;
  areaShape?: string | null;
  areaSizeFeet?: number | null;
  description?: string | null;
  higherLevels?: string | null;
  isInCatalog?: boolean;
};

type Combatant = {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  ac: number;
  type: "PLAYER" | "ENEMY";
  ownerUserId: string | null;
  hasAction: boolean;
  hasBonusAction: boolean;
  hasReaction: boolean;
  isDashing: boolean;
  speed: number;
  movementUsed: number;
  conditions: Condition[];
  str: number; dex: number; con: number;
  int: number; wis: number; cha: number;
  character?: {
    level: number;
    tokenImagePath?: string | null;
    owner?: { id: string; name: string; email: string };
  } | null;
};

type SavingThrowResult = {
  ability: AbilityName;
  dc: number;
  roll: { dice: string; rolls: number[]; total: number };
  success: boolean;
  detail: string;
};

// ─── Props ───────────────────────────────────────────────────────────────────

type Props = {
  gameId: string;
  selectedCombatant: Combatant | null;
  activeCombatant: Combatant | null;
  allCombatants: Combatant[];
  isDm: boolean;
  currentUserId: string;
  highlightedTiles: { x: number; y: number; costFeet: number }[];
  onHighlightTiles: (tiles: { x: number; y: number; costFeet: number }[]) => void;
  onSpellAreaPreview: (tiles: { x: number; y: number }[]) => void;
  onCombatUpdated: () => void;
  onLogEntry: (text: string) => void;
};

// ─── Componente ──────────────────────────────────────────────────────────────

type Tab = "move" | "attack" | "spell" | "save" | "conditions";

export default function CombatActionPanel({
  gameId,
  selectedCombatant,
  activeCombatant,
  allCombatants,
  isDm,
  currentUserId,
  onHighlightTiles,
  onSpellAreaPreview,
  onCombatUpdated,
  onLogEntry,
}: Props) {
  const [tab, setTab] = useState<Tab>("move");
  const [weapons, setWeapons] = useState<WeaponData[]>([]);
  const [spells, setSpells] = useState<SpellData[]>([]);
  const [spellSaveDc, setSpellSaveDc] = useState(0);
  const [selectedWeapon, setSelectedWeapon] = useState<WeaponData | null>(null);
  const [selectedSpell, setSelectedSpell] = useState<SpellData | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [advantage, setAdvantage] = useState(false);
  const [disadvantage, setDisadvantage] = useState(false);
  // Campos para lanzar hechizo
  const [spellDamageDice, setSpellDamageDice] = useState("1d6");
  const [spellDamageType, setSpellDamageType] = useState("mágico");
  const [spellSavingThrow, setSpellSavingThrow] = useState<string>("");
  const [spellHalfOnSave, setSpellHalfOnSave] = useState(true);
  const [saveDc, setSaveDc] = useState(14);
  const [saveAbility, setSaveAbility] = useState<AbilityName>("dex");
  const [saveProficiency, setSaveProficiency] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const canControl =
    isDm ||
    (selectedCombatant?.ownerUserId === currentUserId);

  const isActiveTurn = activeCombatant?.id === selectedCombatant?.id;
  const canAct = canControl && (isDm || isActiveTurn);

  // Cargar armas y hechizos cuando cambia el combatiente
  useEffect(() => {
    if (!selectedCombatant) return;
    setError("");
    setLastResult(null);
    setSelectedTargetId("");
    setSelectedTargetIds([]);

    Promise.all([
      fetch(`${API_URL}/games/${gameId}/combat/weapons/${selectedCombatant.id}`, { credentials: "include" })
        .then((r) => r.json()).catch(() => null),
      fetch(`${API_URL}/games/${gameId}/combat/spells/${selectedCombatant.id}`, { credentials: "include" })
        .then((r) => r.json()).catch(() => null),
    ]).then(([weaponData, spellData]) => {
      const loadedWeapons = (weaponData?.weapons ?? []) as WeaponData[];
      const loadedSpells = (spellData?.spells ?? []) as SpellData[];
      setWeapons(loadedWeapons);
      setSpells(loadedSpells);
      setSelectedWeapon(loadedWeapons[0] ?? null);
      setSelectedSpell(loadedSpells[0] ?? null);
      setSpellSaveDc(spellData?.spellSaveDc ?? 0);
    });
  }, [selectedCombatant?.id, gameId]);

  // Cargar casillas alcanzables cuando se activa tab de movimiento
  useEffect(() => {
    if (tab !== "move" || !selectedCombatant || !canAct) {
      onHighlightTiles([]);
      return;
    }

    fetch(`${API_URL}/games/${gameId}/combat/reachable/${selectedCombatant.id}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((data) => onHighlightTiles(data?.reachable ?? []))
      .catch(() => onHighlightTiles([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedCombatant?.id, selectedCombatant?.movementUsed]);

  // Auto-rellenar dados/tipo/salvación cuando el hechizo seleccionado está en el catálogo
  useEffect(() => {
    if (!selectedSpell || !selectedSpell.isInCatalog) return;
    if (selectedSpell.damageDice) setSpellDamageDice(selectedSpell.damageDice);
    if (selectedSpell.damageType) setSpellDamageType(selectedSpell.damageType);
    setSpellSavingThrow(selectedSpell.savingThrow ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSpell?.name]);

  async function handleAttack() {
    if (!selectedCombatant || !selectedWeapon || !selectedTargetId) return;

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/games/${gameId}/combat/action/attack`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attackerId: selectedCombatant.id,
          targetId: selectedTargetId,
          weaponName: selectedWeapon.name,
          advantage,
          disadvantage,
        }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.message); return; }

      const text = `${selectedCombatant.name} → ${data.result.detail}`;
      setLastResult(text);
      onLogEntry(text);
      onCombatUpdated();
    } catch {
      setError("Error de conexión.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSpell() {
    if (!selectedCombatant || !selectedSpell) return;
    if (selectedTargetIds.length === 0) {
      setError("Selecciona al menos un objetivo.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/games/${gameId}/combat/action/spell`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          casterId: selectedCombatant.id,
          spellName: selectedSpell.name,
          targetIds: selectedTargetIds,
          damageDice: spellDamageDice,
          damageType: spellDamageType,
          savingThrow: spellSavingThrow || null,
          halfOnSave: spellHalfOnSave,
        }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.message); return; }

      const text = `${selectedCombatant.name} lanza ${selectedSpell.name}: ${data.result.detail}`;
      setLastResult(text);
      onLogEntry(text);
      onCombatUpdated();
    } catch {
      setError("Error de conexión.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSavingThrow() {
    if (!selectedCombatant) return;

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/games/${gameId}/combat/action/saving-throw`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          combatantId: selectedCombatant.id,
          ability: saveAbility,
          dc: saveDc,
          hasProficiency: saveProficiency,
        }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.message); return; }

      const result = data.result as SavingThrowResult;
      const text = `${selectedCombatant.name} — Salvación ${ABILITY_LABELS[result.ability]}: ${result.detail}`;
      setLastResult(text);
      onLogEntry(text);
    } catch {
      setError("Error de conexión.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDash() {
    if (!selectedCombatant) return;
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/games/${gameId}/combat/action/dash`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ combatantId: selectedCombatant.id }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.message); return; }

      setLastResult(`${selectedCombatant.name} usa Carrera.`);
      onLogEntry(`${selectedCombatant.name} usa Carrera — velocidad duplicada.`);
      onCombatUpdated();
    } catch {
      setError("Error de conexión.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCondition(condition: Condition, remove: boolean) {
    if (!selectedCombatant) return;
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/games/${gameId}/combat/action/condition`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          combatantId: selectedCombatant.id,
          condition,
          remove,
        }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.message); return; }

      const text = `${selectedCombatant.name}: ${condition} ${remove ? "removida" : "aplicada"}`;
      setLastResult(text);
      onLogEntry(text);
      onCombatUpdated();
    } catch {
      setError("Error de conexión.");
    } finally {
      setIsLoading(false);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (!selectedCombatant) {
    return (
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
        <h2 className="text-xl font-black">Acciones</h2>
        <p className="mt-4 text-sm text-zinc-500">
          Selecciona un combatiente en el tablero para ver sus acciones.
        </p>
      </div>
    );
  }

  const remainingFeet = Math.max(
    0,
    (selectedCombatant.isDashing ? selectedCombatant.speed * 2 : selectedCombatant.speed)
    - selectedCombatant.movementUsed
  );
  const remainingTiles = Math.floor(remainingFeet / 5);

  const enemies = allCombatants.filter(
    (c) => c.id !== selectedCombatant.id && c.type === "ENEMY"
  );
  const players = allCombatants.filter(
    (c) => c.id !== selectedCombatant.id && c.type === "PLAYER"
  );
  const possibleTargets = isDm
    ? allCombatants.filter((c) => c.id !== selectedCombatant.id)
    : enemies;

  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900 shadow-2xl">
      {/* Header del combatiente */}
      <div className="border-b border-zinc-800 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
              {selectedCombatant.type === "PLAYER" ? "Jugador" : "Enemigo"}
            </p>
            <h2 className="text-xl font-black">{selectedCombatant.name}</h2>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={[
              "rounded-full px-2 py-0.5 text-xs font-bold",
              selectedCombatant.hp > selectedCombatant.maxHp * 0.5
                ? "bg-green-500/20 text-green-300"
                : selectedCombatant.hp > 0
                  ? "bg-yellow-500/20 text-yellow-300"
                  : "bg-red-500/20 text-red-300",
            ].join(" ")}>
              {selectedCombatant.hp}/{selectedCombatant.maxHp} HP
            </span>
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-bold text-zinc-300">
              CA {selectedCombatant.ac}
            </span>
          </div>
        </div>

        {/* Recursos del turno */}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className={[
            "rounded-full border px-2 py-0.5 text-xs font-bold",
            selectedCombatant.hasAction
              ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-300"
              : "border-zinc-700 bg-zinc-800 text-zinc-500 line-through",
          ].join(" ")}>
            Acción
          </span>
          <span className={[
            "rounded-full border px-2 py-0.5 text-xs font-bold",
            selectedCombatant.hasBonusAction
              ? "border-purple-500/40 bg-purple-500/10 text-purple-300"
              : "border-zinc-700 bg-zinc-800 text-zinc-500 line-through",
          ].join(" ")}>
            Bonus
          </span>
          <span className={[
            "rounded-full border px-2 py-0.5 text-xs font-bold",
            selectedCombatant.hasReaction
              ? "border-sky-500/40 bg-sky-500/10 text-sky-300"
              : "border-zinc-700 bg-zinc-800 text-zinc-500 line-through",
          ].join(" ")}>
            Reacción
          </span>
          <span className={[
            "rounded-full border px-2 py-0.5 text-xs font-bold",
            remainingFeet > 0
              ? "border-green-500/40 bg-green-500/10 text-green-300"
              : "border-zinc-700 bg-zinc-800 text-zinc-500",
          ].join(" ")}>
            {remainingFeet}ft ({remainingTiles} cas.)
          </span>
        </div>

        {/* Condiciones activas */}
        {selectedCombatant.conditions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {selectedCombatant.conditions.map((cond) => (
              <span key={cond} className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-300">
                {CONDITION_LABELS[cond] ?? cond}
              </span>
            ))}
          </div>
        )}

        {!canAct && (
          <p className="mt-2 text-xs text-zinc-500">
            {!canControl
              ? "No controlas este combatiente."
              : "Espera el turno de este combatiente."}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800">
        {(["move", "attack", "spell", "save", "conditions"] as Tab[]).map((t) => {
          const labels: Record<Tab, string> = {
            move: "Mover",
            attack: "Atacar",
            spell: "Hechizo",
            save: "Salvación",
            conditions: "Condiciones",
          };
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={[
                "flex-1 py-3 text-xs font-bold transition",
                tab === t
                  ? "border-b-2 border-yellow-400 text-yellow-300"
                  : "text-zinc-500 hover:text-zinc-300",
              ].join(" ")}
            >
              {labels[t]}
            </button>
          );
        })}
      </div>

      <div className="p-5">
        {/* ─ TAB: MOVER ─────────────────────────────────────────────────────── */}
        {tab === "move" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <p className="text-sm font-bold text-zinc-200">Velocidad</p>
              <p className="mt-1 text-xs text-zinc-400">
                {selectedCombatant.speed} pies base
                {selectedCombatant.isDashing ? " × 2 (Carrera)" : ""}
              </p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-2 rounded-full bg-green-500 transition-all"
                  style={{
                    width: `${Math.max(0, (remainingFeet / (selectedCombatant.isDashing ? selectedCombatant.speed * 2 : selectedCombatant.speed)) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                {remainingFeet} pies restantes · Casillas resaltadas en el tablero
              </p>
            </div>

            {canAct && !selectedCombatant.isDashing && selectedCombatant.hasAction && (
              <button
                type="button"
                onClick={handleDash}
                disabled={isLoading}
                className="w-full rounded-xl border border-green-500/40 px-4 py-3 font-bold text-green-300 transition hover:bg-green-500/10 disabled:opacity-60"
              >
                Carrera (Dash) — duplicar velocidad
              </button>
            )}

            {selectedCombatant.isDashing && (
              <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                ¡Carrera activa! Velocidad duplicada este turno.
              </div>
            )}
          </div>
        )}

        {/* ─ TAB: ATACAR ────────────────────────────────────────────────────── */}
        {tab === "attack" && (
          <div className="space-y-4">
            {weapons.length === 0 ? (
              <p className="text-center text-sm text-zinc-500">
                Este combatiente no tiene ataques en su ficha.
              </p>
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-xs font-bold text-zinc-400">Ataque</label>
                  <select
                    value={selectedWeapon?.name ?? ""}
                    onChange={(e) => {
                      const w = weapons.find((w) => w.name === e.target.value) ?? null;
                      setSelectedWeapon(w);
                    }}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-yellow-400"
                  >
                    {weapons.map((w) => (
                      <option key={w.name} value={w.name}>
                        {w.name} — {w.damage}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedWeapon && (
                  <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-3 text-xs text-yellow-200">
                    <p><span className="font-bold">Ataque:</span> {selectedWeapon.attackBonus >= 0 ? `+${selectedWeapon.attackBonus}` : selectedWeapon.attackBonus}</p>
                    <p><span className="font-bold">Daño:</span> {selectedWeapon.damage}</p>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-bold text-zinc-400">Objetivo</label>
                  <select
                    value={selectedTargetId}
                    onChange={(e) => setSelectedTargetId(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-red-400"
                  >
                    <option value="">— Seleccionar —</option>
                    {possibleTargets.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} (CA {c.ac} · {c.hp}/{c.maxHp} HP)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                    <input type="checkbox" checked={advantage}
                      onChange={(e) => { setAdvantage(e.target.checked); if (e.target.checked) setDisadvantage(false); }}
                      className="accent-yellow-400" />
                    Ventaja
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                    <input type="checkbox" checked={disadvantage}
                      onChange={(e) => { setDisadvantage(e.target.checked); if (e.target.checked) setAdvantage(false); }}
                      className="accent-red-400" />
                    Desventaja
                  </label>
                </div>

                <button type="button"
                  disabled={!canAct || !selectedTargetId || !selectedWeapon || !selectedCombatant.hasAction || isLoading}
                  onClick={handleAttack}
                  className="w-full rounded-xl bg-yellow-500 px-4 py-3 font-bold text-zinc-950 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50">
                  {isLoading ? "Tirando dados..." : `Atacar con ${selectedWeapon?.name ?? "arma"}`}
                </button>

                {!selectedCombatant.hasAction && (
                  <p className="text-center text-xs text-zinc-500">Ya usaste tu acción este turno.</p>
                )}
              </>
            )}
          </div>
        )}

        {/* ─ TAB: HECHIZO ───────────────────────────────────────────────────── */}
        {tab === "spell" && (
          <div className="space-y-4">
            {spells.length === 0 ? (
              <p className="text-center text-sm text-zinc-500">
                Este combatiente no tiene hechizos en su ficha.
              </p>
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-xs font-bold text-zinc-400">Hechizo</label>
                  <select
                    value={selectedSpell?.name ?? ""}
                    onChange={(e) => setSelectedSpell(spells.find((s) => s.name === e.target.value) ?? null)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-purple-400"
                  >
                    {spells.map((s) => (
                      <option key={s.name} value={s.name}>
                        {s.name} {s.level === 0 ? "(truco)" : `(Nv.${s.level})`}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedSpell?.isInCatalog ? (
                  <div className="rounded-2xl border border-purple-500/20 bg-purple-500/10 p-3 text-xs text-purple-200">
                    <p className="font-bold text-purple-300">✓ En el catálogo — dados y tipo autocompletados</p>
                    {selectedSpell.school && <p className="mt-1">Escuela: {selectedSpell.school}</p>}
                    {selectedSpell.description && <p className="mt-1 text-purple-200/80">{selectedSpell.description}</p>}
                    {selectedSpell.higherLevels && (
                      <p className="mt-1 text-purple-200/60">A niveles superiores: {selectedSpell.higherLevels}</p>
                    )}
                  </div>
                ) : selectedSpell ? (
                  <p className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-500">
                    Este hechizo no está en el catálogo — completa los dados y tipo manualmente.
                  </p>
                ) : null}

                {spellSaveDc > 0 && (
                  <p className="text-xs text-purple-300">
                    CD salvación de tu ficha: <span className="font-black">{spellSaveDc}</span>
                  </p>
                )}

                {/* Dados de daño — el jugador los especifica */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-zinc-400">Dados de daño</label>
                    <input value={spellDamageDice}
                      onChange={(e) => setSpellDamageDice(e.target.value)}
                      placeholder="8d6, 3d10+2..."
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-purple-400" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-zinc-400">Tipo de daño</label>
                    <input value={spellDamageType}
                      onChange={(e) => setSpellDamageType(e.target.value)}
                      placeholder="fuego, rayo..."
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-purple-400" />
                  </div>
                </div>

                {/* Salvación */}
                <div>
                  <label className="mb-1 block text-xs font-bold text-zinc-400">Tirada de salvación (opcional)</label>
                  <select value={spellSavingThrow}
                    onChange={(e) => setSpellSavingThrow(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-purple-400">
                    <option value="">Sin salvación (tirada de ataque)</option>
                    <option value="strength">Fuerza</option>
                    <option value="dexterity">Destreza</option>
                    <option value="constitution">Constitución</option>
                    <option value="intelligence">Inteligencia</option>
                    <option value="wisdom">Sabiduría</option>
                    <option value="charisma">Carisma</option>
                  </select>
                </div>

                {spellSavingThrow && (
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                    <input type="checkbox" checked={spellHalfOnSave}
                      onChange={(e) => setSpellHalfOnSave(e.target.checked)}
                      className="accent-purple-400" />
                    Mitad de daño en salvación exitosa
                  </label>
                )}

                {/* Objetivos — selección múltiple */}
                <div>
                  <label className="mb-1 block text-xs font-bold text-zinc-400">
                    Objetivos (selección múltiple)
                  </label>
                  <div className="space-y-1 max-h-32 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950 p-2">
                    {possibleTargets.map((c) => (
                      <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm text-zinc-300 hover:bg-zinc-800">
                        <input type="checkbox"
                          checked={selectedTargetIds.includes(c.id)}
                          onChange={(e) => {
                            setSelectedTargetIds((prev) =>
                              e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                            );
                          }}
                          className="accent-purple-400" />
                        {c.name} ({c.hp}/{c.maxHp} HP)
                      </label>
                    ))}
                  </div>
                </div>

                <button type="button"
                  disabled={!canAct || selectedTargetIds.length === 0 || !selectedSpell || !selectedCombatant.hasAction || isLoading}
                  onClick={handleSpell}
                  className="w-full rounded-xl bg-purple-600 px-4 py-3 font-bold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50">
                  {isLoading ? "Lanzando..." : `Lanzar ${selectedSpell?.name ?? "hechizo"}`}
                </button>

                {!selectedCombatant.hasAction && (
                  <p className="text-center text-xs text-zinc-500">Ya usaste tu acción este turno.</p>
                )}
              </>
            )}
          </div>
        )}

        {/* ─ TAB: SALVACIÓN ─────────────────────────────────────────────────── */}
        {tab === "save" && (
          <div className="space-y-4">
            <p className="text-xs text-zinc-400">
              Pide a {selectedCombatant.name} una tirada de salvación.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-zinc-400">Característica</label>
                <select
                  value={saveAbility}
                  onChange={(e) => setSaveAbility(e.target.value as AbilityName)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
                >
                  {(Object.entries(ABILITY_LABELS) as [AbilityName, string][]).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-zinc-400">Dificultad (CD)</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={saveDc}
                  onChange={(e) => setSaveDc(Number(e.target.value))}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={saveProficiency}
                onChange={(e) => setSaveProficiency(e.target.checked)}
                className="accent-sky-400"
              />
              Añadir bono de competencia
            </label>

            <button
              type="button"
              disabled={isLoading}
              onClick={handleSavingThrow}
              className="w-full rounded-xl bg-sky-600 px-4 py-3 font-bold text-white transition hover:bg-sky-500 disabled:opacity-50"
            >
              {isLoading ? "Tirando..." : `Tirar salvación ${ABILITY_LABELS[saveAbility]} CD ${saveDc}`}
            </button>
          </div>
        )}

        {/* ─ TAB: CONDICIONES ───────────────────────────────────────────────── */}
        {tab === "conditions" && (
          <div className="space-y-3">
            {!isDm && (
              <p className="text-xs text-zinc-500">Solo el DM puede aplicar condiciones.</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {ALL_CONDITIONS.map((cond) => {
                const isActive = selectedCombatant.conditions.includes(cond);
                return (
                  <button
                    key={cond}
                    type="button"
                    disabled={!isDm || isLoading}
                    onClick={() => handleCondition(cond, isActive)}
                    className={[
                      "rounded-xl border px-3 py-2 text-left text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40",
                      isActive
                        ? "border-red-500/50 bg-red-500/20 text-red-300 hover:bg-red-500/10"
                        : "border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-500",
                    ].join(" ")}
                  >
                    {isActive ? "✓ " : ""}{CONDITION_LABELS[cond]}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Resultado de la última acción */}
        {lastResult && (
          <div className="mt-4 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-3 text-xs text-yellow-200">
            {lastResult}
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
