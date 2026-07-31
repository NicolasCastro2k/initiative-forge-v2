// Va en: frontend/src/app/games/[gameId]/player/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { AbilityKey, abilityLabels, skillLabels, getModifier, signed } from "@/utils/dnd5e";
import {
  BeastPreset, DRUID_CLASS_ID, MOON_DRUID_SUBCLASS_ID, WILD_SHAPE_USES_MAX,
  isBeastEligible, describeBeastSpeed, primaryBeastSpeed,
} from "@/utils/wildshape";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type CurrentUser = { id: string; name: string; email: string };

type GameDetail = { id: string; name: string; role: "DM" | "PLAYER" };

type Attack = { name: string; attackBonus: string; damage: string };
type EquipmentItem = { quantity: number; name: string; type?: "weapon" | "consumable" | "misc" };

type SheetData = {
  identity: { characterName: string; className: string; level: number; race: string };
  abilities: Record<AbilityKey, number>;
  combat: { armorClass: number; maxHp: number; currentHp: number; temporaryHp: number; speed: number };
  attacks: Attack[];
  equipment: EquipmentItem[];
  currency: { cp: number; sp: number; ep: number; gp: number; pp: number };
  proficiencies: {
    proficiencyBonus: number;
    savingThrows: Record<AbilityKey, boolean>;
    skills: Record<string, boolean>;
  };
  spells: {
    spellSaveDc: number;
    spellAttackBonus: number;
    slots: Record<string, { total: number; expended: number }>;
    spellsByLevel: Record<string, string[]>;
  };
  wildShape: {
    active: boolean;
    beastId: string | null;
    beastName: string;
    usesRemaining: number;
    usesMax: number;
    saved: {
      armorClass: number;
      speed: number;
      maxHp: number;
      currentHp: number;
      temporaryHp: number;
      attacks: Attack[];
      tokenImagePath: string | null;
    } | null;
  };
};

type Character = {
  id: string;
  name: string;
  level: number;
  classId: string | null;
  subclassId: string | null;
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
    abilities: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    combat: { armorClass: 10, maxHp: 10, currentHp: 10, temporaryHp: 0, speed: 30 },
    attacks: [],
    equipment: [],
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    proficiencies: {
      proficiencyBonus: 2,
      savingThrows: { strength: false, dexterity: false, constitution: false, intelligence: false, wisdom: false, charisma: false },
      skills: {
        acrobatics: false, animalHandling: false, arcana: false, athletics: false,
        deception: false, history: false, insight: false, intimidation: false,
        investigation: false, medicine: false, nature: false, perception: false,
        performance: false, persuasion: false, religion: false, sleightOfHand: false,
        stealth: false, survival: false,
      },
    },
    spells: {
      spellSaveDc: 0,
      spellAttackBonus: 0,
      slots: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [String(i + 1), { total: 0, expended: 0 }])),
      spellsByLevel: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [String(i), []])),
    },
    wildShape: { active: false, beastId: null, beastName: "", usesRemaining: 2, usesMax: 2, saved: null },
  };
}

function normalizeSheetData(raw: unknown): SheetData {
  const defaults = getDefaultSheetData();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return defaults;
  const r = raw as Record<string, unknown>;
  const rawProf = (r.proficiencies ?? {}) as Record<string, unknown>;

  return {
    identity: { ...defaults.identity, ...((r.identity ?? {}) as object) },
    abilities: { ...defaults.abilities, ...((r.abilities ?? {}) as object) },
    combat: { ...defaults.combat, ...((r.combat ?? {}) as object) },
    attacks: Array.isArray(r.attacks) ? (r.attacks as Attack[]) : [],
    equipment: Array.isArray(r.equipment) ? (r.equipment as EquipmentItem[]) : [],
    currency: { ...defaults.currency, ...((r.currency ?? {}) as object) },
    proficiencies: {
      ...defaults.proficiencies,
      ...rawProf,
      savingThrows: { ...defaults.proficiencies.savingThrows, ...((rawProf.savingThrows ?? {}) as object) },
      skills: { ...defaults.proficiencies.skills, ...((rawProf.skills ?? {}) as object) },
    },
    spells: {
      ...defaults.spells,
      ...((r.spells ?? {}) as object),
      slots: ((r.spells as Record<string, unknown> | undefined)?.slots as SheetData["spells"]["slots"]) ?? defaults.spells.slots,
      spellsByLevel:
        ((r.spells as Record<string, unknown> | undefined)?.spellsByLevel as SheetData["spells"]["spellsByLevel"]) ??
        defaults.spells.spellsByLevel,
    },
    wildShape: {
      ...defaults.wildShape,
      ...((r.wildShape ?? {}) as object),
      saved: ((r.wildShape as Record<string, unknown> | undefined)?.saved as SheetData["wildShape"]["saved"]) ?? null,
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
  const [beasts, setBeasts] = useState<BeastPreset[]>([]);
  const [sheetData, setSheetData] = useState<SheetData>(getDefaultSheetData());

  const [journal, setJournal] = useState("");
  const [journalSaving, setJournalSaving] = useState(false);
  const [journalSavedAt, setJournalSavedAt] = useState<number | null>(null);

  const [diceLog, setDiceLog] = useState<DiceRoll[]>([]);
  const [isDiceModalOpen, setIsDiceModalOpen] = useState(false);
  const [diceTab, setDiceTab] = useState<"personalizado" | "caracteristica" | "habilidad" | "salvacion" | "ataque">("habilidad");
  const [diceMode, setDiceMode] = useState<"normal" | "advantage" | "disadvantage">("normal");
  const [diceSides, setDiceSides] = useState(20);
  const [diceCount, setDiceCount] = useState(1);
  const [diceModifier, setDiceModifier] = useState(0);
  const [isRolling, setIsRolling] = useState(false);
  const [rollOverlay, setRollOverlay] = useState<{ phase: "loading" | "result"; roll?: DiceRoll } | null>(null);

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
      const [meRes, gameRes, charsRes, journalRes, diceRes, beastsRes] = await Promise.all([
        fetch(`${API_URL}/auth/me`, { credentials: "include" }),
        fetch(`${API_URL}/games/${gameId}`, { credentials: "include" }),
        fetch(`${API_URL}/games/${gameId}/characters`, { credentials: "include" }),
        fetch(`${API_URL}/games/${gameId}/journal`, { credentials: "include" }),
        fetch(`${API_URL}/games/${gameId}/dice/log`, { credentials: "include" }),
        fetch(`${API_URL}/presets/beasts`, { credentials: "include" }),
      ]);

      if (meRes.status === 401) {
        window.location.href = `/login?redirect=${encodeURIComponent(`/games/${gameId}/player`)}`;
        return;
      }

      const [meData, gameData, charsData, journalData, diceData, beastsData] = await Promise.all([
        meRes.json().catch(() => null),
        gameRes.json().catch(() => null),
        charsRes.json().catch(() => null),
        journalRes.json().catch(() => null),
        diceRes.json().catch(() => null),
        beastsRes.json().catch(() => null),
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
      setBeasts((beastsData?.beasts ?? []) as BeastPreset[]);
      setDiceLog((diceData?.rolls ?? []) as DiceRoll[]);
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setIsLoading(false);
    }
  }

  // ─── Socket — registro de dados en tiempo real ─────────────────────────────
  // Ref (no state) para que el listener de socket siempre lea el characterId
  // actual sin tener que reconectar el socket cada vez que `selection` cambia.
  const selectionCharacterIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectionCharacterIdRef.current = selection?.character.id ?? null;
  }, [selection]);

  useEffect(() => {
    if (!game || !gameId) return;

    const socket: Socket = io(API_URL, { withCredentials: true, transports: ["websocket", "polling"] });

    socket.on("connect", () => socket.emit("join:game", gameId));

    socket.on("dice:rolled", (payload: { roll: DiceRoll }) => {
      setDiceLog((current) => [payload.roll, ...current].slice(0, 50));
    });

    // Si el DM (o cualquiera) cambia CA/PG/velocidad de tu combatiente desde
    // el tablero de combate, reflejarlo aquí — así, si luego tocas +1/-1 PG
    // desde tu pantalla, no pisas ese cambio con datos viejos.
    socket.on("combat:updated", (payload: { encounter: { combatants: { characterId: string | null; ac: number; hp: number; maxHp: number; speed: number }[] } | null }) => {
      const myCombatant = payload.encounter?.combatants.find((c) => c.characterId === selectionCharacterIdRef.current);
      if (!myCombatant) return;
      setSheetData((prev) => ({
        ...prev,
        combat: { ...prev.combat, armorClass: myCombatant.ac, maxHp: myCombatant.maxHp, currentHp: myCombatant.hp, speed: myCombatant.speed },
      }));
    });

    return () => {
      socket.emit("leave:game", gameId);
      socket.disconnect();
    };
  }, [game, gameId]);

  // ─── Guardar ficha (HP, moneda) ─────────────────────────────────────────────
  async function saveSheetPatch(
    patch: Partial<SheetData>,
    savingFlag: (v: boolean) => void,
    tokenImagePath?: string | null,
    syncCombatant?: boolean,
  ) {
    if (!selection) return;
    savingFlag(true);

    const newSheetData = { ...sheetData, ...patch };
    setSheetData(newSheetData);
    if (tokenImagePath !== undefined) {
      setSelection((current) => (current ? { ...current, character: { ...current.character, tokenImagePath } } : current));
    }

    try {
      await fetch(`${API_URL}/characters/${selection.character.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetData: newSheetData,
          ...(tokenImagePath !== undefined ? { tokenImagePath } : {}),
          ...(syncCombatant ? { syncCombatant: true } : {}),
        }),
      });
    } catch {
      setError("No se pudo guardar el cambio.");
    } finally {
      savingFlag(false);
    }
  }

  function updateHp(delta: number) {
    const rawHp = sheetData.combat.currentHp + delta;
    if (sheetData.wildShape.active && rawHp <= 0) {
      revertWildShape(Math.abs(Math.min(0, rawHp)));
      return;
    }
    const newHp = Math.max(0, Math.min(sheetData.combat.maxHp, rawHp));
    saveSheetPatch({ combat: { ...sheetData.combat, currentHp: newHp } }, setIsSavingHp, undefined, true);
  }

  function setHpDirect(value: number) {
    if (sheetData.wildShape.active && value <= 0) {
      revertWildShape(Math.abs(value));
      return;
    }
    const clamped = Math.max(0, Math.min(sheetData.combat.maxHp, value));
    saveSheetPatch({ combat: { ...sheetData.combat, currentHp: clamped } }, setIsSavingHp, undefined, true);
  }

  // ─── Forma Salvaje ──────────────────────────────────────────────────────────
  const isDruid = selection?.character.classId === DRUID_CLASS_ID;
  const isMoonDruid = selection?.character.subclassId === MOON_DRUID_SUBCLASS_ID;
  const eligibleBeasts = useMemo(() => {
    if (!isDruid) return [];
    return beasts
      .filter((b) => isBeastEligible(b, sheetData.identity.level, isMoonDruid))
      .sort((a, b) => a.cr - b.cr || a.name.localeCompare(b.name));
  }, [beasts, isDruid, isMoonDruid, sheetData.identity.level]);

  function transformInto(beast: BeastPreset) {
    if (sheetData.wildShape.usesRemaining <= 0 && !sheetData.wildShape.active) return;

    const spendUse = !sheetData.wildShape.active;
    const saved = sheetData.wildShape.saved ?? {
      armorClass: sheetData.combat.armorClass,
      speed: sheetData.combat.speed,
      maxHp: sheetData.combat.maxHp,
      currentHp: sheetData.combat.currentHp,
      temporaryHp: sheetData.combat.temporaryHp,
      attacks: sheetData.attacks,
      tokenImagePath: selection?.character.tokenImagePath ?? null,
    };

    saveSheetPatch({
      combat: { ...sheetData.combat, armorClass: beast.ac, speed: primaryBeastSpeed(beast), maxHp: beast.hp, currentHp: beast.hp, temporaryHp: 0 },
      attacks: beast.attacks,
      wildShape: {
        ...sheetData.wildShape,
        active: true,
        beastId: beast.id,
        beastName: beast.name,
        usesRemaining: spendUse ? Math.max(0, sheetData.wildShape.usesRemaining - 1) : sheetData.wildShape.usesRemaining,
        saved,
      },
    }, () => {}, beast.tokenImagePath ?? null, true);
  }

  // excessDamage: si la reversión ocurre porque los PG de la bestia llegaron
  // a 0, el daño sobrante pasa al personaje (regla de 5e).
  function revertWildShape(excessDamage = 0) {
    const saved = sheetData.wildShape.saved;
    if (!saved) {
      saveSheetPatch({ wildShape: { ...sheetData.wildShape, active: false, beastId: null, beastName: "" } }, () => {}, undefined, true);
      return;
    }
    saveSheetPatch({
      combat: { ...sheetData.combat, armorClass: saved.armorClass, speed: saved.speed, maxHp: saved.maxHp, currentHp: Math.max(0, saved.currentHp - excessDamage), temporaryHp: saved.temporaryHp },
      attacks: saved.attacks,
      wildShape: { ...sheetData.wildShape, active: false, beastId: null, beastName: "", saved: null },
    }, () => {}, saved.tokenImagePath, true);
  }

  function restoreWildShapeUses() {
    saveSheetPatch({ wildShape: { ...sheetData.wildShape, usesRemaining: sheetData.wildShape.usesMax } }, () => {});
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
  // Cuando se pasan opts (tiradas automáticas de característica/habilidad/
  // salvación/ataque), se usan esos valores en vez de los del formulario
  // "Personalizado". El modificador se calcula siempre a partir de la ficha
  // del personaje (sheetData.abilities / proficiencies), nunca a mano.
  // El modo (normal/ventaja/desventaja) se toma de `diceMode` salvo que se
  // pase explícito en opts.
  async function rollDice(opts?: {
    sides: number;
    count: number;
    modifier: number;
    label?: string;
    mode?: "normal" | "advantage" | "disadvantage";
  }) {
    if (!gameId) return;

    const sides = opts?.sides ?? diceSides;
    const count = opts?.count ?? diceCount;
    const modifier = opts?.modifier ?? diceModifier;
    const label = opts?.label;
    const mode = opts?.mode ?? diceMode;

    // Cerramos el modal de inmediato y mostramos el gif de "calculando".
    setIsDiceModalOpen(false);
    setRollOverlay({ phase: "loading" });
    setIsRolling(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/games/${gameId}/dice/roll`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sides,
          count,
          modifier,
          label,
          mode,
          characterName: sheetData.identity.characterName || currentUser?.name,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.message ?? "No se pudo tirar los dados.");
        setRollOverlay(null);
        return;
      }
      const roll = data.roll as DiceRoll;
      // El propio socket también nos notificará, pero agregamos de inmediato
      // para que se sienta instantáneo sin esperar el round-trip del socket.
      setDiceLog((current) => {
        if (current.some((r) => r.id === roll.id)) return current;
        return [roll, ...current].slice(0, 50);
      });

      // Deja el gif visible un momento antes de mostrar el resultado, para
      // que se note la animación en vez de saltar directo al número.
      await new Promise((resolve) => setTimeout(resolve, 900));
      setRollOverlay({ phase: "result", roll });
      setTimeout(() => {
        setRollOverlay((current) => (current?.roll?.id === roll.id ? null : current));
      }, 4000);
    } catch {
      setError("No se pudo conectar con el backend.");
      setRollOverlay(null);
    } finally {
      setIsRolling(false);
    }
  }

  function saveModifier(ability: AbilityKey) {
    const base = getModifier(sheetData.abilities[ability]);
    const proficient = sheetData.proficiencies.savingThrows[ability];
    return base + (proficient ? sheetData.proficiencies.proficiencyBonus : 0);
  }

  function skillModifier(skill: { key: string; ability: AbilityKey }) {
    const base = getModifier(sheetData.abilities[skill.ability]);
    const proficient = sheetData.proficiencies.skills[skill.key];
    return base + (proficient ? sheetData.proficiencies.proficiencyBonus : 0);
  }

  function attackModifier(attack: Attack) {
    const parsed = parseInt(String(attack.attackBonus).replace(/[^\d-]/g, ""), 10);
    return Number.isFinite(parsed) ? parsed : 0;
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

              {/* Forma Salvaje — solo druidas */}
              {isDruid && (
                <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-zinc-300">🐾 Forma Salvaje</p>
                    <span className="rounded-full border border-zinc-700 px-2.5 py-0.5 text-xs font-bold text-zinc-400">
                      Usos: {sheetData.wildShape.usesRemaining}/{WILD_SHAPE_USES_MAX}
                    </span>
                  </div>

                  {sheetData.wildShape.active ? (
                    <div className="mt-2">
                      <p className="font-black text-yellow-300">{sheetData.wildShape.beastName}</p>
                      <button type="button" onClick={() => revertWildShape(0)}
                        className="mt-2 w-full rounded-xl bg-yellow-500 px-3 py-2 text-sm font-black text-zinc-950 transition hover:bg-yellow-400">
                        Revertir forma
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-1">
                        {eligibleBeasts.length === 0 ? (
                          <p className="py-2 text-center text-xs text-zinc-500">Sin bestias disponibles a tu nivel.</p>
                        ) : (
                          eligibleBeasts.map((beast) => (
                            <button key={beast.id} type="button" disabled={sheetData.wildShape.usesRemaining <= 0}
                              onClick={() => transformInto(beast)}
                              className="flex w-full items-center justify-between rounded-lg border border-zinc-800 px-2.5 py-1.5 text-left text-xs transition hover:border-yellow-400 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50">
                              <span className="font-bold text-zinc-200">{beast.name}</span>
                              <span className="text-zinc-500">CR {beast.crLabel} · CA {beast.ac} · PG {beast.hp}</span>
                            </button>
                          ))
                        )}
                      </div>
                      <button type="button" onClick={restoreWildShapeUses}
                        className="mt-2 w-full rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-800">
                        Restaurar usos (descanso)
                      </button>
                    </>
                  )}
                </div>
              )}

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

            {/* Pestañas: de dónde sale el modificador de la tirada */}
            <div className="mt-4 grid grid-cols-5 gap-1 rounded-xl border border-zinc-800 bg-zinc-950 p-1 text-[11px]">
              {([
                ["habilidad", "Habil."],
                ["caracteristica", "Carac."],
                ["salvacion", "Salv."],
                ["ataque", "Ataque"],
                ["personalizado", "Otro"],
              ] as const).map(([tab, label]) => (
                <button key={tab} type="button" onClick={() => setDiceTab(tab)}
                  className={[
                    "rounded-lg px-1.5 py-1.5 font-bold transition",
                    diceTab === tab ? "bg-yellow-500 text-zinc-950" : "text-zinc-400 hover:bg-zinc-800",
                  ].join(" ")}>
                  {label}
                </button>
              ))}
            </div>

            {/* Ventaja / Desventaja — aplica a las tiradas de d20 (todas las
                pestañas automáticas usan d20; en "Otro" solo tiene efecto si
                el dado elegido es d20). Se tiran dos veces y se conserva el
                mejor resultado (ventaja) o el peor (desventaja); el 1 y el 20
                naturales del dado elegido no se ven afectados por esto. */}
            <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl border border-zinc-800 bg-zinc-950 p-1 text-xs">
              {([
                ["normal", "Normal"],
                ["advantage", "Ventaja"],
                ["disadvantage", "Desventaja"],
              ] as const).map(([mode, label]) => (
                <button key={mode} type="button" onClick={() => setDiceMode(mode)}
                  className={[
                    "rounded-lg px-2 py-1.5 font-bold transition",
                    diceMode === mode
                      ? mode === "advantage"
                        ? "bg-green-500 text-zinc-950"
                        : mode === "disadvantage"
                          ? "bg-red-500 text-zinc-950"
                          : "bg-zinc-700 text-white"
                      : "text-zinc-400 hover:bg-zinc-800",
                  ].join(" ")}>
                  {label}
                </button>
              ))}
            </div>
            {diceTab === "personalizado" && diceSides !== 20 && diceMode !== "normal" && (
              <p className="mt-1 text-[11px] text-zinc-500">
                Ventaja/desventaja solo aplica a d20 — con d{diceSides} se ignorará.
              </p>
            )}

            {/* Habilidades (18) — modificador = característica + competencia */}
            {diceTab === "habilidad" && (
              <div className="mt-4 max-h-72 space-y-1.5 overflow-y-auto pr-1">
                {skillLabels.map((skill) => {
                  const mod = skillModifier(skill);
                  return (
                    <button key={skill.key} type="button" disabled={isRolling}
                      onClick={() => rollDice({ sides: 20, count: 1, modifier: mod, label: skill.label })}
                      className="flex w-full items-center justify-between rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-left transition hover:border-yellow-400 hover:bg-zinc-900 disabled:opacity-60">
                      <span className="text-sm font-bold text-zinc-200">
                        {skill.label}
                        {sheetData.proficiencies.skills[skill.key] && <span className="ml-1.5 text-yellow-400">●</span>}
                      </span>
                      <span className="text-sm font-black text-yellow-300">{signed(mod)}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Características (6) — prueba de característica pura */}
            {diceTab === "caracteristica" && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {abilityLabels.map((ability) => {
                  const mod = getModifier(sheetData.abilities[ability.key]);
                  return (
                    <button key={ability.key} type="button" disabled={isRolling}
                      onClick={() => rollDice({ sides: 20, count: 1, modifier: mod, label: ability.label })}
                      className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 transition hover:border-yellow-400 hover:bg-zinc-900 disabled:opacity-60">
                      <p className="text-xs font-bold text-zinc-400">{ability.short}</p>
                      <p className="text-lg font-black text-yellow-300">{signed(mod)}</p>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Salvaciones (6) — característica + competencia si aplica */}
            {diceTab === "salvacion" && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {abilityLabels.map((ability) => {
                  const mod = saveModifier(ability.key);
                  return (
                    <button key={ability.key} type="button" disabled={isRolling}
                      onClick={() => rollDice({ sides: 20, count: 1, modifier: mod, label: `Salvación de ${ability.label}` })}
                      className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 transition hover:border-yellow-400 hover:bg-zinc-900 disabled:opacity-60">
                      <p className="text-xs font-bold text-zinc-400">
                        {ability.short}
                        {sheetData.proficiencies.savingThrows[ability.key] && <span className="ml-1 text-yellow-400">●</span>}
                      </p>
                      <p className="text-lg font-black text-yellow-300">{signed(mod)}</p>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Ataques de la ficha — usa el bonif. de ataque ya calculado */}
            {diceTab === "ataque" && (
              <div className="mt-4 max-h-72 space-y-1.5 overflow-y-auto pr-1">
                {sheetData.attacks.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-zinc-700 px-3 py-4 text-center text-sm text-zinc-500">
                    Tu ficha no tiene ataques cargados.
                  </p>
                ) : (
                  sheetData.attacks.map((attack, i) => {
                    const mod = attackModifier(attack);
                    return (
                      <button key={`${attack.name}-${i}`} type="button" disabled={isRolling}
                        onClick={() => rollDice({ sides: 20, count: 1, modifier: mod, label: `Ataque: ${attack.name}` })}
                        className="flex w-full items-center justify-between rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-left transition hover:border-yellow-400 hover:bg-zinc-900 disabled:opacity-60">
                        <span>
                          <span className="block text-sm font-bold text-zinc-200">{attack.name}</span>
                          <span className="block text-xs text-zinc-500">{attack.damage}</span>
                        </span>
                        <span className="text-sm font-black text-yellow-300">{signed(mod)}</span>
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {/* Personalizado — tirada libre de cualquier dado */}
            {diceTab === "personalizado" && (
              <>
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

                <button type="button" onClick={() => rollDice()} disabled={isRolling}
                  className="mt-5 w-full rounded-xl bg-yellow-500 px-4 py-3 font-black text-zinc-950 transition hover:bg-yellow-400 disabled:opacity-60">
                  {isRolling ? "Tirando..." : `Tirar ${diceCount}d${diceSides}${diceModifier !== 0 ? (diceModifier > 0 ? `+${diceModifier}` : diceModifier) : ""}`}
                </button>
              </>
            )}

            <button type="button" onClick={() => setIsDiceModalOpen(false)}
              className="mt-4 w-full rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800">
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
      {/* ─── Overlay: tirando / resultado ──────────────────────────────────────
          Se abre justo cuando se cierra el modal de "Lanzar dados". Primero
          muestra el gif de carga (frontend/public/dice-loading.gif) y, al
          terminar, el mismo cuadro cambia al resultado de la tirada. */}
      {rollOverlay && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={() => rollOverlay.phase === "result" && setRollOverlay(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xs rounded-3xl border border-zinc-800 bg-zinc-900 p-6 text-center shadow-2xl">
            {rollOverlay.phase === "loading" || !rollOverlay.roll ? (
              <>
                {/* Coloca aquí tu gif en frontend/public/dice-loading.gif */}
                <img src="/dice-loading.gif" alt="Tirando dados..." className="mx-auto h-32 w-32 object-contain" />
                <p className="mt-4 font-bold text-zinc-300">Tirando dados...</p>
              </>
            ) : (
              (() => {
                const roll = rollOverlay.roll;
                const isNat20 = roll.rolls.length === 1 && roll.rolls[0] === 20;
                const isNat1 = roll.rolls.length === 1 && roll.rolls[0] === 1;
                return (
                  <>
                    <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">{roll.characterName}</p>
                    <p className="mt-1 text-xs text-zinc-500">{roll.expression}</p>
                    <p className={[
                      "mt-3 text-6xl font-black",
                      isNat20 ? "text-green-400" : isNat1 ? "text-red-400" : "text-yellow-300",
                    ].join(" ")}>
                      {roll.total}
                    </p>
                    {isNat20 && <p className="mt-1 text-sm font-black text-green-400">¡20 natural!</p>}
                    {isNat1 && <p className="mt-1 text-sm font-black text-red-400">1 natural...</p>}
                    <p className="mt-2 text-xs text-zinc-500">[{roll.rolls.join(", ")}]</p>
                    <button type="button" onClick={() => setRollOverlay(null)}
                      className="mt-4 w-full rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800">
                      Cerrar
                    </button>
                  </>
                );
              })()
            )}
          </div>
        </div>
      )}
    </main>
  );
}