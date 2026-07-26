"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { io, Socket } from "socket.io-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type CurrentUser = { id: string; name: string; email: string };

type GameDetail = { id: string; name: string; role: "DM" | "PLAYER" };

type Attack = { name: string; attackBonus: string; damage: string };
type EquipmentItem = { quantity: number; name: string; type?: "weapon" | "consumable" | "misc" };

type SheetData = {
  identity: { characterName: string; className: string; level: number; race: string };
  combat: { armorClass: number; maxHp: number; currentHp: number; temporaryHp: number; speed: number };
  attacks: Attack[];
  equipment: EquipmentItem[];
  currency: { cp: number; sp: number; ep: number; gp: number; pp: number };
  spells: {
    spellSaveDc: number;
    spellAttackBonus: number;
    slots: Record<string, { total: number; expended: number }>;
    spellsByLevel: Record<string, string[]>;
  };
};

type Character = {
  id: string;
  name: string;
  level: number;
  tokenImagePath: string | null;
  portraitImagePath: string | null;
  sheetData: unknown;
};

type GameCharacterSelection = {
  id: string;
  userId: string;
  characterId: string;
  isActive: boolean;
  character: Character;
};

type DiceRoll = {
  id: string;
  gameId: string;
  userId: string;
  characterName: string;
  expression: string;
  rolls: number[];
  modifier: number;
  total: number;
  createdAt: string;
};

function getImageUrl(path: string | null) {
  if (!path) return "";
  return path.startsWith("http") ? path : `${API_URL}${path}`;
}

function getDefaultSheetData(): SheetData {
  return {
    identity: { characterName: "", className: "", level: 1, race: "" },
    combat: { armorClass: 10, maxHp: 10, currentHp: 10, temporaryHp: 0, speed: 30 },
    attacks: [],
    equipment: [],
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    spells: {
      spellSaveDc: 0,
      spellAttackBonus: 0,
      slots: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [String(i + 1), { total: 0, expended: 0 }])),
      spellsByLevel: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [String(i), []])),
    },
  };
}

function normalizeSheetData(raw: unknown): SheetData {
  const defaults = getDefaultSheetData();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return defaults;
  const r = raw as Record<string, unknown>;
  return {
    identity: { ...defaults.identity, ...((r.identity ?? {}) as object) },
    combat: { ...defaults.combat, ...((r.combat ?? {}) as object) },
    attacks: Array.isArray(r.attacks) ? (r.attacks as Attack[]) : [],
    equipment: Array.isArray(r.equipment) ? (r.equipment as EquipmentItem[]) : [],
    currency: { ...defaults.currency, ...((r.currency ?? {}) as object) },
    spells: {
      ...defaults.spells,
      ...((r.spells ?? {}) as object),
      slots: ((r.spells as Record<string, unknown> | undefined)?.slots as SheetData["spells"]["slots"]) ?? defaults.spells.slots,
      spellsByLevel:
        ((r.spells as Record<string, unknown> | undefined)?.spellsByLevel as SheetData["spells"]["spellsByLevel"]) ??
        defaults.spells.spellsByLevel,
    },
  };
}

const DICE_TYPES = [4, 6, 8, 10, 12, 20, 100];
type InventoryTab = "todos" | "armas" | "consumible" | "opciones";

export default function PlayerScreenPage() {
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId;

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [game, setGame] = useState<GameDetail | null>(null);
  const [selection, setSelection] = useState<GameCharacterSelection | null>(null);
  const [sheetData, setSheetData] = useState<SheetData>(getDefaultSheetData());

  const [journal, setJournal] = useState("");
  const [journalSaving, setJournalSaving] = useState(false);
  const [journalSavedAt, setJournalSavedAt] = useState<number | null>(null);

  const [diceLog, setDiceLog] = useState<DiceRoll[]>([]);
  const [isDiceModalOpen, setIsDiceModalOpen] = useState(false);
  const [diceSides, setDiceSides] = useState(20);
  const [diceCount, setDiceCount] = useState(1);
  const [diceModifier, setDiceModifier] = useState(0);
  const [isRolling, setIsRolling] = useState(false);

  const [isShopOpen, setIsShopOpen] = useState(false);
  const [inventoryTab, setInventoryTab] = useState<InventoryTab>("todos");
  const [spellLevelFilter, setSpellLevelFilter] = useState<string>("all");

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingHp, setIsSavingHp] = useState(false);
  const [isSavingCurrency, setIsSavingCurrency] = useState(false);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  async function loadAll() {
    if (!gameId) return;
    setIsLoading(true);
    setError("");

    try {
      const [meRes, gameRes, charsRes, journalRes, diceRes] = await Promise.all([
        fetch(`${API_URL}/auth/me`, { credentials: "include" }),
        fetch(`${API_URL}/games/${gameId}`, { credentials: "include" }),
        fetch(`${API_URL}/games/${gameId}/characters`, { credentials: "include" }),
        fetch(`${API_URL}/games/${gameId}/journal`, { credentials: "include" }),
        fetch(`${API_URL}/games/${gameId}/dice/log`, { credentials: "include" }),
      ]);

      if (meRes.status === 401) {
        window.location.href = `/login?redirect=${encodeURIComponent(`/games/${gameId}/player`)}`;
        return;
      }

      const [meData, gameData, charsData, journalData, diceData] = await Promise.all([
        meRes.json().catch(() => null),
        gameRes.json().catch(() => null),
        charsRes.json().catch(() => null),
        journalRes.json().catch(() => null),
        diceRes.json().catch(() => null),
      ]);

      if (!meRes.ok || !meData?.user) { setError("No se pudo cargar tu sesión."); return; }
      if (!gameRes.ok) { setError(gameData?.message ?? "No se pudo cargar la partida."); return; }

      setCurrentUser(meData.user as CurrentUser);
      setGame({ id: gameData.game.id, name: gameData.game.name, role: gameData.role });

      const selections = (charsData?.selections ?? []) as GameCharacterSelection[];
      const mySelection = selections.find((s) => s.userId === meData.user.id && s.isActive) ?? null;
      setSelection(mySelection);

      if (mySelection) {
        setSheetData(normalizeSheetData(mySelection.character.sheetData));
      }

      setJournal(journalData?.journal ?? "");
      setDiceLog((diceData?.rolls ?? []) as DiceRoll[]);
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setIsLoading(false);
    }
  }

  // ─── Socket — registro de dados en tiempo real ─────────────────────────────
  useEffect(() => {
    if (!game || !gameId) return;

    const socket: Socket = io(API_URL, { withCredentials: true, transports: ["websocket", "polling"] });

    socket.on("connect", () => socket.emit("join:game", gameId));

    socket.on("dice:rolled", (payload: { roll: DiceRoll }) => {
      setDiceLog((current) => [payload.roll, ...current].slice(0, 50));
    });

    return () => {
      socket.emit("leave:game", gameId);
      socket.disconnect();
    };
  }, [game, gameId]);

  // ─── Guardar ficha (HP, moneda) ─────────────────────────────────────────────
  async function saveSheetPatch(patch: Partial<SheetData>, savingFlag: (v: boolean) => void) {
    if (!selection) return;
    savingFlag(true);

    const newSheetData = { ...sheetData, ...patch };
    setSheetData(newSheetData);

    try {
      await fetch(`${API_URL}/characters/${selection.character.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetData: newSheetData }),
      });
    } catch {
      setError("No se pudo guardar el cambio.");
    } finally {
      savingFlag(false);
    }
  }

  function updateHp(delta: number) {
    const newHp = Math.max(0, Math.min(sheetData.combat.maxHp, sheetData.combat.currentHp + delta));
    saveSheetPatch({ combat: { ...sheetData.combat, currentHp: newHp } }, setIsSavingHp);
  }

  function setHpDirect(value: number) {
    const clamped = Math.max(0, Math.min(sheetData.combat.maxHp, value));
    saveSheetPatch({ combat: { ...sheetData.combat, currentHp: clamped } }, setIsSavingHp);
  }

  function updateCurrency(coin: keyof SheetData["currency"], value: number) {
    saveSheetPatch({ currency: { ...sheetData.currency, [coin]: Math.max(0, value) } }, setIsSavingCurrency);
  }

  function toggleSpellSlot(level: string, delta: 1 | -1) {
    const slot = sheetData.spells.slots[level] ?? { total: 0, expended: 0 };
    const newExpended = Math.max(0, Math.min(slot.total, slot.expended + delta));
    saveSheetPatch(
      { spells: { ...sheetData.spells, slots: { ...sheetData.spells.slots, [level]: { ...slot, expended: newExpended } } } },
      () => {}
    );
  }

  // ─── Diario de viaje ─────────────────────────────────────────────────────────
  async function saveJournal() {
    if (!gameId) return;
    setJournalSaving(true);
    try {
      await fetch(`${API_URL}/games/${gameId}/journal`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journal }),
      });
      setJournalSavedAt(Date.now());
    } catch {
      setError("No se pudo guardar el diario.");
    } finally {
      setJournalSaving(false);
    }
  }

  // ─── Dados ──────────────────────────────────────────────────────────────────
  async function rollDice() {
    if (!gameId) return;
    setIsRolling(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/games/${gameId}/dice/roll`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sides: diceSides,
          count: diceCount,
          modifier: diceModifier,
          characterName: sheetData.identity.characterName || currentUser?.name,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.message ?? "No se pudo tirar los dados.");
        return;
      }
      // El propio socket también nos notificará, pero agregamos de inmediato
      // para que se sienta instantáneo sin esperar el round-trip del socket.
      setDiceLog((current) => {
        if (current.some((r) => r.id === data.roll.id)) return current;
        return [data.roll as DiceRoll, ...current].slice(0, 50);
      });
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setIsRolling(false);
    }
  }

  // ─── Inventario filtrado ────────────────────────────────────────────────────
  const filteredInventory = useMemo(() => {
    const weapons = sheetData.attacks.map((a) => ({ kind: "weapon" as const, name: a.name, detail: `${a.attackBonus} · ${a.damage}` }));
    const equipment = sheetData.equipment.map((e) => ({
      kind: (e.type ?? "misc") as "weapon" | "consumable" | "misc",
      name: e.name,
      detail: `x${e.quantity}`,
    }));
    const all = [...weapons, ...equipment];

    if (inventoryTab === "todos") return all;
    if (inventoryTab === "armas") return all.filter((i) => i.kind === "weapon");
    if (inventoryTab === "consumible") return all.filter((i) => i.kind === "consumable");
    return all.filter((i) => i.kind === "misc");
  }, [sheetData.attacks, sheetData.equipment, inventoryTab]);

  const hpPercent = sheetData.combat.maxHp > 0 ? (sheetData.combat.currentHp / sheetData.combat.maxHp) * 100 : 0;
  const hpColor = hpPercent > 50 ? "bg-green-500" : hpPercent > 20 ? "bg-yellow-500" : "bg-red-500";

  if (isLoading) {
    return <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">Cargando pantalla de jugador...</main>;
  }

  if (error && !game) {
    return (
      <main className="min-h-screen bg-zinc-950 p-6 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-500/40 bg-red-500/10 p-6 text-red-200">{error}</div>
      </main>
    );
  }

  if (!game) return null;

  if (!selection) {
    return (
      <main className="min-h-screen bg-zinc-950 p-6 text-white">
        <div className="mx-auto max-w-2xl rounded-3xl border border-yellow-500/40 bg-yellow-500/10 p-8 text-center">
          <p className="text-xl font-black text-yellow-200">No tienes un personaje activo en esta partida.</p>
          <p className="mt-2 text-yellow-100/70">Selecciona un personaje para ver tu pantalla de jugador.</p>
          <a href={`/games/${gameId}/characters`}
            className="mt-6 inline-block rounded-xl bg-yellow-500 px-6 py-3 font-bold text-zinc-950 transition hover:bg-yellow-400">
            Seleccionar personaje
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-4 text-white md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-yellow-400">Pantalla de jugador — {game.name}</p>
          <a href={`/games/${gameId}`} className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800">
            Volver
          </a>
        </div>

        {error && <div className="mb-4 rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

        <div className="grid gap-4 xl:grid-cols-[1fr_1fr_320px]">

          {/* ─── Columna izquierda: Diario + Inventario ─────────────────────── */}
          <div className="space-y-4">
            <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black">Diario de viaje</h2>
                <button type="button" onClick={saveJournal} disabled={journalSaving}
                  className="rounded-lg bg-yellow-500 px-3 py-1.5 text-xs font-bold text-zinc-950 transition hover:bg-yellow-400 disabled:opacity-60">
                  {journalSaving ? "Guardando..." : "Guardar"}
                </button>
              </div>
              <textarea value={journal} onChange={(e) => setJournal(e.target.value)} rows={10}
                placeholder="Escribe aquí tus notas de aventura..."
                className="mt-3 w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition focus:border-yellow-400" />
              {journalSavedAt && <p className="mt-1 text-xs text-zinc-500">Guardado.</p>}
            </section>

            <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
              <h2 className="text-lg font-black">Objetos</h2>
              <div className="mt-3 flex gap-2 border-b border-zinc-800 pb-2">
                {(["todos", "armas", "consumible", "opciones"] as InventoryTab[]).map((tab) => (
                  <button key={tab} type="button" onClick={() => setInventoryTab(tab)}
                    className={[
                      "rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition",
                      inventoryTab === tab ? "bg-yellow-500 text-zinc-950" : "text-zinc-400 hover:bg-zinc-800",
                    ].join(" ")}>
                    {tab}
                  </button>
                ))}
              </div>
              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
                {filteredInventory.length === 0 ? (
                  <p className="text-sm text-zinc-500">Sin objetos en esta categoría.</p>
                ) : (
                  filteredInventory.map((item, i) => (
                    <div key={i} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                      <span className="text-sm text-zinc-200">{item.name}</span>
                      <span className="text-xs text-zinc-500">{item.detail}</span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* ─── Columna central: Ficha resumida + Hechizos ─────────────────── */}
          <div className="space-y-4">
            <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
              <h1 className="text-2xl font-black">{sheetData.identity.characterName || selection.character.name}</h1>
              <p className="text-sm text-zinc-400">
                {sheetData.identity.race || "Sin raza"} · {sheetData.identity.className || "Sin clase"} · Nivel {sheetData.identity.level}
              </p>

              {/* Barra de vida */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-zinc-300">PG</span>
                  <span className="font-bold text-zinc-300">
                    {sheetData.combat.currentHp} / {sheetData.combat.maxHp}
                    {sheetData.combat.temporaryHp > 0 ? ` (+${sheetData.combat.temporaryHp})` : ""}
                  </span>
                </div>
                <div className="mt-1 h-4 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div className={`h-4 rounded-full transition-all ${hpColor}`} style={{ width: `${Math.max(0, Math.min(100, hpPercent))}%` }} />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button type="button" onClick={() => updateHp(-1)} disabled={isSavingHp}
                    className="rounded-lg border border-red-500/50 px-3 py-1 text-sm font-bold text-red-300 transition hover:bg-red-500/10">-1</button>
                  <button type="button" onClick={() => updateHp(-5)} disabled={isSavingHp}
                    className="rounded-lg border border-red-500/50 px-3 py-1 text-sm font-bold text-red-300 transition hover:bg-red-500/10">-5</button>
                  <input type="number" value={sheetData.combat.currentHp}
                    onChange={(e) => setHpDirect(Number(e.target.value))}
                    className="w-16 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-center text-sm text-white outline-none focus:border-yellow-400" />
                  <button type="button" onClick={() => updateHp(5)} disabled={isSavingHp}
                    className="rounded-lg border border-green-500/50 px-3 py-1 text-sm font-bold text-green-300 transition hover:bg-green-500/10">+5</button>
                  <button type="button" onClick={() => updateHp(1)} disabled={isSavingHp}
                    className="rounded-lg border border-green-500/50 px-3 py-1 text-sm font-bold text-green-300 transition hover:bg-green-500/10">+1</button>
                </div>
              </div>

              <a href={`/characters/${selection.character.id}`} target="_blank" rel="noreferrer"
                className="mt-4 block rounded-xl border border-zinc-700 px-4 py-2 text-center text-sm font-bold text-zinc-200 transition hover:bg-zinc-800">
                Ver ficha completa
              </a>

              {/* Moneda */}
              <div className="mt-4 grid grid-cols-5 gap-2">
                {(["cp", "sp", "ep", "gp", "pp"] as const).map((coin) => (
                  <div key={coin}>
                    <label className="mb-1 block text-center text-xs font-bold text-zinc-400">{coin.toUpperCase()}</label>
                    <input type="number" value={sheetData.currency[coin]} disabled={isSavingCurrency}
                      onChange={(e) => updateCurrency(coin, Number(e.target.value))}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-1 py-1.5 text-center text-sm text-white outline-none focus:border-yellow-400" />
                  </div>
                ))}
              </div>

              <button type="button" onClick={() => setIsShopOpen(true)}
                className="mt-3 w-full rounded-xl border border-zinc-700 px-4 py-2 text-sm font-bold text-zinc-200 transition hover:bg-zinc-800">
                Abrir tienda
              </button>
            </section>

            <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black">Hechizos</h2>
                <select value={spellLevelFilter} onChange={(e) => setSpellLevelFilter(e.target.value)}
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-white outline-none focus:border-yellow-400">
                  <option value="all">Todos los niveles</option>
                  <option value="0">Trucos</option>
                  {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>Nivel {n}</option>)}
                </select>
              </div>

              {(sheetData.spells.spellSaveDc > 0 || sheetData.spells.spellAttackBonus !== 0) && (
                <p className="mt-1 text-xs text-zinc-500">
                  CD {sheetData.spells.spellSaveDc} · Ataque {sheetData.spells.spellAttackBonus >= 0 ? "+" : ""}{sheetData.spells.spellAttackBonus}
                </p>
              )}

              {/* Espacios de conjuro */}
              <div className="mt-3 grid grid-cols-3 gap-2 md:grid-cols-5">
                {Array.from({ length: 9 }, (_, i) => String(i + 1))
                  .filter((lvl) => spellLevelFilter === "all" || spellLevelFilter === lvl)
                  .map((lvl) => {
                    const slot = sheetData.spells.slots[lvl] ?? { total: 0, expended: 0 };
                    if (slot.total === 0 && spellLevelFilter === "all") return null;
                    const available = slot.total - slot.expended;
                    return (
                      <div key={lvl} className="rounded-xl border border-zinc-800 bg-zinc-950 p-2 text-center">
                        <p className="text-xs font-bold text-zinc-400">Nv.{lvl}</p>
                        <p className="text-lg font-black text-yellow-300">{available}/{slot.total}</p>
                        <div className="mt-1 flex justify-center gap-1">
                          <button type="button" onClick={() => toggleSpellSlot(lvl, 1)}
                            className="rounded border border-red-500/40 px-1.5 text-xs text-red-300 hover:bg-red-500/10">Gastar</button>
                          <button type="button" onClick={() => toggleSpellSlot(lvl, -1)}
                            className="rounded border border-green-500/40 px-1.5 text-xs text-green-300 hover:bg-green-500/10">+</button>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Lista de hechizos conocidos */}
              <div className="mt-3 max-h-48 space-y-1 overflow-y-auto">
                {Object.entries(sheetData.spells.spellsByLevel)
                  .filter(([lvl]) => spellLevelFilter === "all" || spellLevelFilter === lvl)
                  .flatMap(([lvl, names]) => names.map((name) => ({ lvl, name })))
                  .filter((s) => s.name.trim() !== "")
                  .map((s, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-zinc-950 px-3 py-1.5 text-sm">
                      <span className="text-zinc-200">{s.name}</span>
                      <span className="text-xs text-zinc-500">{s.lvl === "0" ? "Truco" : `Nv.${s.lvl}`}</span>
                    </div>
                  ))}
                {Object.values(sheetData.spells.spellsByLevel).every((arr) => arr.length === 0) && (
                  <p className="text-sm text-zinc-500">Sin hechizos conocidos.</p>
                )}
              </div>
            </section>
          </div>

          {/* ─── Columna derecha: Token + Combate + Dados ───────────────────── */}
          <div className="space-y-4">
            <section className="flex flex-col items-center rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
              <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-yellow-500/40 bg-zinc-950">
                {selection.character.tokenImagePath ? (
                  <img src={getImageUrl(selection.character.tokenImagePath)} alt={selection.character.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-4xl font-black text-zinc-700">
                    {selection.character.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <p className="mt-2 text-sm font-bold text-zinc-300">CA {sheetData.combat.armorClass} · {sheetData.combat.speed}ft</p>
            </section>

            <a href={`/games/${gameId}/combat`}
              className="block rounded-2xl bg-yellow-500 px-4 py-4 text-center font-black text-zinc-950 shadow-2xl transition hover:bg-yellow-400">
              Entra al combate
            </a>

            <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black">Registro de dados</h2>
                <button type="button" onClick={() => setIsDiceModalOpen(true)}
                  className="rounded-lg bg-yellow-500 px-3 py-1.5 text-xs font-bold text-zinc-950 transition hover:bg-yellow-400">
                  Lanzar dados
                </button>
              </div>
              <div className="mt-3 max-h-96 space-y-1.5 overflow-y-auto">
                {diceLog.length === 0 ? (
                  <p className="text-sm text-zinc-500">Sin tiradas todavía.</p>
                ) : (
                  diceLog.map((roll) => (
                    <div key={roll.id} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-yellow-300">{roll.characterName}</span>
                        <span className="text-lg font-black text-white">{roll.total}</span>
                      </div>
                      <p className="text-xs text-zinc-500">
                        {roll.expression} → [{roll.rolls.join(", ")}]
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* ─── Modal: Lanzar dados ────────────────────────────────────────────── */}
      {isDiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setIsDiceModalOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <h3 className="text-xl font-black">Lanzar dados</h3>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-bold text-zinc-300">Tipo de dado</label>
              <div className="grid grid-cols-4 gap-2">
                {DICE_TYPES.map((d) => (
                  <button key={d} type="button" onClick={() => setDiceSides(d)}
                    className={[
                      "rounded-xl border px-3 py-2 text-sm font-bold transition",
                      diceSides === d ? "border-yellow-400 bg-yellow-500/20 text-yellow-200" : "border-zinc-700 text-zinc-300 hover:bg-zinc-800",
                    ].join(" ")}>
                    d{d}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-bold text-zinc-300">Cantidad</label>
                <input type="number" min={1} max={20} value={diceCount} onChange={(e) => setDiceCount(Number(e.target.value))}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-yellow-400" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold text-zinc-300">Modificador</label>
                <input type="number" value={diceModifier} onChange={(e) => setDiceModifier(Number(e.target.value))}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-yellow-400" />
              </div>
            </div>

            <button type="button" onClick={rollDice} disabled={isRolling}
              className="mt-5 w-full rounded-xl bg-yellow-500 px-4 py-3 font-black text-zinc-950 transition hover:bg-yellow-400 disabled:opacity-60">
              {isRolling ? "Tirando..." : `Tirar ${diceCount}d${diceSides}${diceModifier !== 0 ? (diceModifier > 0 ? `+${diceModifier}` : diceModifier) : ""}`}
            </button>

            <button type="button" onClick={() => setIsDiceModalOpen(false)}
              className="mt-2 w-full rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800">
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* ─── Modal: Tienda ──────────────────────────────────────────────────── */}
      {isShopOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setIsShopOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <h3 className="text-xl font-black">Tienda</h3>
            <div className="mt-4 rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-6 text-center">
              <p className="font-bold text-zinc-300">No hay tienda abierta en este momento.</p>
              <p className="mt-2 text-sm text-zinc-500">El DM aún no ha generado una tienda para esta sesión.</p>
            </div>
            <button type="button" onClick={() => setIsShopOpen(false)}
              className="mt-4 w-full rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800">
              Cerrar
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
