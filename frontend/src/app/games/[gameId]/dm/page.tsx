"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { io, Socket } from "socket.io-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type CurrentUser = { id: string; name: string; email: string };
type GameDetail = { id: string; name: string; role: "DM" | "PLAYER" };

type Character = {
  id: string;
  name: string;
  level: number;
  tokenImagePath: string | null;
};

type GameCharacterSelection = {
  id: string;
  userId: string;
  characterId: string;
  isActive: boolean;
  character: Character;
  user: { id: string; name: string; email: string };
};

type DiceRoll = {
  id: string;
  characterName: string;
  expression: string;
  rolls: number[];
  total: number;
};

type Npc = {
  id: string;
  name: string;
  description: string;
  notes: string;
  hp: number | null;
  maxHp: number | null;
  ac: number | null;
};

type Monster = {
  id: string;
  name: string;
  description: string;
  notes: string;
  hp: number | null;
  maxHp: number | null;
  ac: number | null;
  speed: number | null;
  damageDice: string | null;
  damageType: string | null;
  tokenImagePath: string | null;
};

// Entrada del catálogo GLOBAL de monstruos (/presets/monster-catalog),
// reusable entre partidas. Al "cargarlo", se crea una copia en el bestiario
// de ESTA partida (Monster de arriba), incluido el token.
type CatalogMonster = {
  id: string;
  name: string;
  crLabel: string;
  ac: number;
  hp: number;
  hitDice: string;
  speedWalk: number;
  tokenImagePath: string | null;
  attacks: { name: string; damage: string; damageType: string }[];
  traits: string;
  source: string;
};

function getImageUrl(path: string | null) {
  if (!path) return "";
  return path.startsWith("http") ? path : `${API_URL}${path}`;
}

const DICE_TYPES = [4, 6, 8, 10, 12, 20, 100];

const emptyNpcForm = { name: "", description: "", notes: "", hp: "", maxHp: "", ac: "" };
const emptyMonsterForm = { name: "", description: "", notes: "", hp: "", maxHp: "", ac: "", speed: "", damageDice: "", damageType: "" };

export default function DmScreenPage() {
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId;

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [game, setGame] = useState<GameDetail | null>(null);
  const [selections, setSelections] = useState<GameCharacterSelection[]>([]);

  const [dmNotes, setDmNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);

  const [npcs, setNpcs] = useState<Npc[]>([]);
  const [monsters, setMonsters] = useState<Monster[]>([]);
  const [isNpcModalOpen, setIsNpcModalOpen] = useState(false);
  const [isMonsterModalOpen, setIsMonsterModalOpen] = useState(false);
  const [npcForm, setNpcForm] = useState(emptyNpcForm);
  const [monsterForm, setMonsterForm] = useState(emptyMonsterForm);

  // Catálogo global de monstruos, para importar al bestiario de esta partida.
  const [catalogMonsters, setCatalogMonsters] = useState<CatalogMonster[]>([]);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [isImportingId, setIsImportingId] = useState<string | null>(null);

  const [diceLog, setDiceLog] = useState<DiceRoll[]>([]);
  const [isDiceModalOpen, setIsDiceModalOpen] = useState(false);
  const [diceSides, setDiceSides] = useState(20);
  const [diceCount, setDiceCount] = useState(1);
  const [diceModifier, setDiceModifier] = useState(0);
  const [isRolling, setIsRolling] = useState(false);

  const [isLevelModalOpen, setIsLevelModalOpen] = useState(false);
  const [levelInput, setLevelInput] = useState(1);
  const [isApplyingLevel, setIsApplyingLevel] = useState(false);
  const [isResting, setIsResting] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  useEffect(() => {
    loadCatalogMonsters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  // Catálogo global — no bloquea la carga principal de la pantalla del DM si
  // falla, ya que solo se usa para el botón de "importar del catálogo".
  async function loadCatalogMonsters() {
    if (!gameId) return;
    try {
      const response = await fetch(`${API_URL}/presets/monster-catalog`, { credentials: "include" });
      const data = await response.json().catch(() => null);
      if (!response.ok) return;
      setCatalogMonsters((data?.monsters ?? []) as CatalogMonster[]);
    } catch {
      // silencioso
    }
  }

  async function loadAll() {
    if (!gameId) return;
    setIsLoading(true);
    setError("");

    try {
      const [meRes, gameRes, charsRes, notesRes, npcsRes, monstersRes, diceRes] = await Promise.all([
        fetch(`${API_URL}/auth/me`, { credentials: "include", cache: "no-store" }),
        fetch(`${API_URL}/games/${gameId}`, { credentials: "include" }),
        fetch(`${API_URL}/games/${gameId}/characters`, { credentials: "include" }),
        fetch(`${API_URL}/games/${gameId}/dm/notes`, { credentials: "include" }),
        fetch(`${API_URL}/games/${gameId}/npcs`, { credentials: "include" }),
        fetch(`${API_URL}/games/${gameId}/monsters`, { credentials: "include" }),
        fetch(`${API_URL}/games/${gameId}/dice/log`, { credentials: "include" }),
      ]);

      if (meRes.status === 401) {
        window.location.href = `/login?redirect=${encodeURIComponent(`/games/${gameId}/dm`)}`;
        return;
      }

      const [meData, gameData, charsData, notesData, npcsData, monstersData, diceData] = await Promise.all([
        meRes.json().catch(() => null),
        gameRes.json().catch(() => null),
        charsRes.json().catch(() => null),
        notesRes.json().catch(() => null),
        npcsRes.json().catch(() => null),
        monstersRes.json().catch(() => null),
        diceRes.json().catch(() => null),
      ]);

      if (!meRes.ok || !meData?.user) { setError("No se pudo cargar tu sesión."); return; }
      if (!gameRes.ok) { setError(gameData?.message ?? "No se pudo cargar la partida."); return; }

      if (gameData.role !== "DM") {
        setError("Solo el DM puede acceder a esta pantalla.");
        return;
      }

      setCurrentUser(meData.user as CurrentUser);
      setGame({ id: gameData.game.id, name: gameData.game.name, role: gameData.role });
      setSelections(((charsData?.selections ?? []) as GameCharacterSelection[]).filter((s) => s.isActive));
      setDmNotes(notesData?.notes ?? "");
      setNpcs((npcsData?.npcs ?? []) as Npc[]);
      setMonsters((monstersData?.monsters ?? []) as Monster[]);
      setDiceLog((diceData?.rolls ?? []) as DiceRoll[]);
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setIsLoading(false);
    }
  }

  // ─── Socket ─────────────────────────────────────────────────────────────────
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

  // ─── Notas del DM ───────────────────────────────────────────────────────────
  async function saveDmNotes() {
    if (!gameId) return;
    setNotesSaving(true);
    try {
      await fetch(`${API_URL}/games/${gameId}/dm/notes`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: dmNotes }),
      });
    } catch {
      setError("No se pudo guardar las notas.");
    } finally {
      setNotesSaving(false);
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
        body: JSON.stringify({ sides: diceSides, count: diceCount, modifier: diceModifier, characterName: `${currentUser?.name} (DM)` }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setError(data?.message ?? "No se pudo tirar los dados."); return; }
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

  // ─── Subir de nivel ─────────────────────────────────────────────────────────
  async function applyLevelUp() {
    if (!gameId) return;
    setIsApplyingLevel(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${API_URL}/games/${gameId}/party/level-up`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: levelInput }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setError(data?.message ?? "No se pudo subir de nivel al grupo."); return; }
      setMessage(data.message);
      setIsLevelModalOpen(false);
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setIsApplyingLevel(false);
    }
  }

  // ─── Descansos ──────────────────────────────────────────────────────────────
  async function applyRest(type: "short" | "long") {
    if (!gameId) return;
    const confirmed = window.confirm(
      type === "long"
        ? "¿Aplicar descanso largo? Restaura PG completos y todos los espacios de conjuro de todos los jugadores."
        : "¿Aplicar descanso corto? Restaura la mitad de los PG máximos y la mitad (redondeado hacia abajo) de los espacios de conjuro gastados de todos los jugadores."
    );
    if (!confirmed) return;

    setIsResting(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${API_URL}/games/${gameId}/party/rest`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setError(data?.message ?? "No se pudo aplicar el descanso."); return; }
      setMessage(data.message);
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setIsResting(false);
    }
  }

  // ─── NPCs ───────────────────────────────────────────────────────────────────
  async function createNpc() {
    if (!gameId || !npcForm.name.trim()) return;
    try {
      const response = await fetch(`${API_URL}/games/${gameId}/npcs`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(npcForm),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setError(data?.message ?? "No se pudo crear el NPC."); return; }
      setNpcs((current) => [...current, data.npc as Npc].sort((a, b) => a.name.localeCompare(b.name)));
      setNpcForm(emptyNpcForm);
      setIsNpcModalOpen(false);
    } catch {
      setError("No se pudo conectar con el backend.");
    }
  }

  async function deleteNpc(npc: Npc) {
    if (!gameId) return;
    const confirmed = window.confirm(`¿Eliminar a ${npc.name}?`);
    if (!confirmed) return;
    try {
      await fetch(`${API_URL}/games/${gameId}/npcs/${npc.id}`, { method: "DELETE", credentials: "include" });
      setNpcs((current) => current.filter((n) => n.id !== npc.id));
    } catch {
      setError("No se pudo eliminar el NPC.");
    }
  }

  // ─── Monstruos ──────────────────────────────────────────────────────────────
  async function createMonster() {
    if (!gameId || !monsterForm.name.trim()) return;
    try {
      const response = await fetch(`${API_URL}/games/${gameId}/monsters`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(monsterForm),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setError(data?.message ?? "No se pudo crear el monstruo."); return; }
      setMonsters((current) => [...current, data.monster as Monster].sort((a, b) => a.name.localeCompare(b.name)));
      setMonsterForm(emptyMonsterForm);
      setIsMonsterModalOpen(false);
    } catch {
      setError("No se pudo conectar con el backend.");
    }
  }

  async function deleteMonster(monster: Monster) {
    if (!gameId) return;
    const confirmed = window.confirm(`¿Eliminar a ${monster.name}?`);
    if (!confirmed) return;
    try {
      await fetch(`${API_URL}/games/${gameId}/monsters/${monster.id}`, { method: "DELETE", credentials: "include" });
      setMonsters((current) => current.filter((m) => m.id !== monster.id));
    } catch {
      setError("No se pudo eliminar el monstruo.");
    }
  }

  // Copia un monstruo del catálogo GLOBAL al bestiario de ESTA partida —
  // trae stats, token y un resumen de ataques/rasgos como descripción, para
  // que quede utilizable de una en el tablero de combate.
  async function importFromCatalog(catalogMonster: CatalogMonster) {
    if (!gameId) return;
    setIsImportingId(catalogMonster.id);
    setError("");

    const attacksSummary = catalogMonster.attacks
      .map((a) => `${a.name}: ${a.damage}${a.damageType ? ` ${a.damageType}` : ""}`)
      .join(" · ");
    const primaryAttack = catalogMonster.attacks[0];

    try {
      const response = await fetch(`${API_URL}/games/${gameId}/monsters`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: catalogMonster.name,
          description: `CR ${catalogMonster.crLabel} · ${attacksSummary}`,
          notes: catalogMonster.traits,
          hp: catalogMonster.hp,
          maxHp: catalogMonster.hp,
          ac: catalogMonster.ac,
          speed: catalogMonster.speedWalk,
          damageDice: primaryAttack?.damage ?? null,
          damageType: primaryAttack?.damageType ?? null,
          tokenImagePath: catalogMonster.tokenImagePath,
          source: catalogMonster.source,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setError(data?.message ?? "No se pudo importar el monstruo."); return; }
      setMonsters((current) => [...current, data.monster as Monster].sort((a, b) => a.name.localeCompare(b.name)));
      setMessage(`${catalogMonster.name} agregado al bestiario de la partida.`);
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setIsImportingId(null);
    }
  }

  const filteredCatalogMonsters = catalogMonsters.filter((m) =>
    m.name.toLowerCase().includes(catalogSearch.trim().toLowerCase())
  );

  if (isLoading) {
    return <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">Cargando pantalla de DM...</main>;
  }

  if (error && !game) {
    return (
      <main className="min-h-screen bg-zinc-950 p-6 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-500/40 bg-red-500/10 p-6 text-red-200">{error}</div>
      </main>
    );
  }

  if (!game) return null;

  return (
    <main className="min-h-screen bg-zinc-950 p-4 text-white md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-yellow-400">Pantalla de DM — {game.name}</p>
          <a href={`/games/${gameId}`} className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800">
            Volver
          </a>
        </div>

        {error && <div className="mb-4 rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
        {message && <div className="mb-4 rounded-2xl border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-200">{message}</div>}

        <div className="grid gap-4 xl:grid-cols-[1fr_1fr_320px]">

          {/* ─── Columna izquierda: Lista de jugadores + acciones ───────────── */}
          <div className="space-y-4">
            <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
              <h2 className="text-lg font-black">Lista de jugadores</h2>
              <div className="mt-3 space-y-2">
                {selections.length === 0 ? (
                  <p className="text-sm text-zinc-500">Aún no hay jugadores con personaje activo.</p>
                ) : (
                  selections.map((sel) => (
                    <div key={sel.id} className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-yellow-500/40 bg-zinc-900">
                        {sel.character.tokenImagePath ? (
                          <img src={getImageUrl(sel.character.tokenImagePath)} alt={sel.character.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-sm font-black text-zinc-600">
                            {sel.character.name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-white">{sel.character.name}</p>
                        <p className="text-xs text-zinc-500">{sel.user.name} · Nivel {sel.character.level}</p>
                      </div>
                      <a href={`/characters/${sel.character.id}`} target="_blank" rel="noreferrer"
                        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-bold text-zinc-300 transition hover:bg-zinc-800">
                        Ver ficha
                      </a>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => { setLevelInput(1); setIsLevelModalOpen(true); }}
                  className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-sm font-bold text-yellow-300 transition hover:bg-yellow-500/20">
                  Subir de Nivel
                </button>
                <a href={`/games/${gameId}/maps/new`}
                  className="rounded-xl border border-zinc-700 px-3 py-2 text-center text-sm font-bold text-zinc-200 transition hover:bg-zinc-800">
                  Generar mapa
                </a>
                <button type="button" onClick={() => applyRest("short")} disabled={isResting}
                  className="rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-sm font-bold text-sky-300 transition hover:bg-sky-500/20 disabled:opacity-60">
                  Descanso Corto
                </button>
                <button type="button" onClick={() => setIsMonsterModalOpen(true)}
                  className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-300 transition hover:bg-red-500/20">
                  Añadir monstruo
                </button>
                <button type="button" onClick={() => setIsCatalogModalOpen(true)}
                  className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-300 transition hover:bg-red-500/20">
                  Del catálogo
                </button>
                <button type="button" onClick={() => applyRest("long")} disabled={isResting}
                  className="rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-sm font-bold text-sky-300 transition hover:bg-sky-500/20 disabled:opacity-60">
                  Descanso largo
                </button>
                <button type="button" onClick={() => setIsNpcModalOpen(true)}
                  className="rounded-xl border border-purple-500/40 bg-purple-500/10 px-3 py-2 text-sm font-bold text-purple-300 transition hover:bg-purple-500/20">
                  Añadir NPC
                </button>
              </div>

              <a href={`/games/${gameId}/combat`}
                className="mt-2 block rounded-xl bg-yellow-500 px-3 py-3 text-center text-sm font-black text-zinc-950 transition hover:bg-yellow-400">
                Gestionar combate
              </a>
            </section>
          </div>

          {/* ─── Columna central: Notas + NPCs + Monstruos ──────────────────── */}
          <div className="space-y-4">
            <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black">Notas del DM</h2>
                <button type="button" onClick={saveDmNotes} disabled={notesSaving}
                  className="rounded-lg bg-yellow-500 px-3 py-1.5 text-xs font-bold text-zinc-950 transition hover:bg-yellow-400 disabled:opacity-60">
                  {notesSaving ? "Guardando..." : "Guardar"}
                </button>
              </div>
              <textarea value={dmNotes} onChange={(e) => setDmNotes(e.target.value)} rows={6}
                placeholder="Notas privadas de la sesión..."
                className="mt-3 w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition focus:border-yellow-400" />
            </section>

            <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black">Lista de NPC</h2>
                <button type="button" onClick={() => setIsNpcModalOpen(true)}
                  className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-purple-500">
                  + NPC
                </button>
              </div>
              <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                {npcs.length === 0 ? (
                  <p className="text-sm text-zinc-500">Sin NPCs registrados.</p>
                ) : (
                  npcs.map((npc) => (
                    <div key={npc.id} className="flex items-start justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                      <div>
                        <p className="text-sm font-bold text-white">{npc.name}</p>
                        {npc.description && <p className="text-xs text-zinc-400">{npc.description}</p>}
                        {(npc.hp !== null || npc.ac !== null) && (
                          <p className="text-xs text-zinc-500">
                            {npc.hp !== null ? `PG ${npc.hp}${npc.maxHp ? `/${npc.maxHp}` : ""}` : ""}
                            {npc.ac !== null ? ` · CA ${npc.ac}` : ""}
                          </p>
                        )}
                      </div>
                      <button type="button" onClick={() => deleteNpc(npc)} className="text-xs font-bold text-red-400 hover:text-red-300">
                        Eliminar
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-black">Lista de monstruos</h2>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setIsCatalogModalOpen(true)}
                    className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-bold text-red-300 transition hover:bg-red-500/10">
                    Del catálogo
                  </button>
                  <button type="button" onClick={() => setIsMonsterModalOpen(true)}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-500">
                    + Monstruo
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                Estos monstruos (con su token) son los que vas a poder elegir como enemigos en el tablero de combate.
              </p>
              <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                {monsters.length === 0 ? (
                  <p className="text-sm text-zinc-500">Sin monstruos registrados.</p>
                ) : (
                  monsters.map((monster) => (
                    <div key={monster.id} className="flex items-start justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                      <div className="flex items-start gap-2">
                        <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-full border border-zinc-700 bg-zinc-900">
                          {monster.tokenImagePath ? (
                            <img src={getImageUrl(monster.tokenImagePath)} alt="" className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{monster.name}</p>
                          {monster.description && <p className="text-xs text-zinc-400">{monster.description}</p>}
                          <p className="text-xs text-zinc-500">
                            {monster.hp !== null ? `PG ${monster.hp}` : ""}
                            {monster.ac !== null ? ` · CA ${monster.ac}` : ""}
                            {monster.damageDice ? ` · ${monster.damageDice} ${monster.damageType ?? ""}` : ""}
                          </p>
                        </div>
                      </div>
                      <button type="button" onClick={() => deleteMonster(monster)} className="text-xs font-bold text-red-400 hover:text-red-300">
                        Eliminar
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* ─── Columna derecha: Objetos + Dados ────────────────────────────── */}
          <div className="space-y-4">
            <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
              <h2 className="text-lg font-black">Objetos disponibles</h2>
              <div className="mt-3 rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-6 text-center">
                <p className="text-sm text-zinc-500">Aún no hay tienda generada para esta sesión.</p>
              </div>
            </section>

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
                      <p className="text-xs text-zinc-500">{roll.expression} → [{roll.rolls.join(", ")}]</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* ─── Modal: Subir de nivel ──────────────────────────────────────────── */}
      {isLevelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setIsLevelModalOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <h3 className="text-xl font-black">Subir de nivel al grupo</h3>
            <p className="mt-1 text-sm text-zinc-400">Se aplicará a los {selections.length} personaje(s) activos de la partida.</p>
            <label className="mt-4 block">
              <span className="mb-1 block text-sm font-bold text-zinc-300">Nuevo nivel</span>
              <input type="number" min={1} max={20} value={levelInput} onChange={(e) => setLevelInput(Number(e.target.value))}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-yellow-400" />
            </label>
            <button type="button" onClick={applyLevelUp} disabled={isApplyingLevel}
              className="mt-5 w-full rounded-xl bg-yellow-500 px-4 py-3 font-black text-zinc-950 transition hover:bg-yellow-400 disabled:opacity-60">
              {isApplyingLevel ? "Aplicando..." : `Subir a nivel ${levelInput}`}
            </button>
            <button type="button" onClick={() => setIsLevelModalOpen(false)}
              className="mt-2 w-full rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ─── Modal: Añadir NPC ──────────────────────────────────────────────── */}
      {isNpcModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setIsNpcModalOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <h3 className="text-xl font-black">Añadir NPC</h3>
            <div className="mt-4 space-y-3">
              <input value={npcForm.name} onChange={(e) => setNpcForm({ ...npcForm, name: e.target.value })} placeholder="Nombre"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-purple-400" />
              <textarea value={npcForm.description} onChange={(e) => setNpcForm({ ...npcForm, description: e.target.value })}
                placeholder="Descripción breve" rows={2}
                className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-purple-400" />
              <textarea value={npcForm.notes} onChange={(e) => setNpcForm({ ...npcForm, notes: e.target.value })}
                placeholder="Notas del DM (secreto, motivación...)" rows={2}
                className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-purple-400" />
              <div className="grid grid-cols-3 gap-2">
                <input type="number" value={npcForm.hp} onChange={(e) => setNpcForm({ ...npcForm, hp: e.target.value })} placeholder="PG"
                  className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm text-white outline-none focus:border-purple-400" />
                <input type="number" value={npcForm.maxHp} onChange={(e) => setNpcForm({ ...npcForm, maxHp: e.target.value })} placeholder="PG máx"
                  className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm text-white outline-none focus:border-purple-400" />
                <input type="number" value={npcForm.ac} onChange={(e) => setNpcForm({ ...npcForm, ac: e.target.value })} placeholder="CA"
                  className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm text-white outline-none focus:border-purple-400" />
              </div>
            </div>
            <button type="button" onClick={createNpc} disabled={!npcForm.name.trim()}
              className="mt-5 w-full rounded-xl bg-purple-600 px-4 py-3 font-black text-white transition hover:bg-purple-500 disabled:opacity-60">
              Crear NPC
            </button>
            <button type="button" onClick={() => setIsNpcModalOpen(false)}
              className="mt-2 w-full rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ─── Modal: Añadir Monstruo ─────────────────────────────────────────── */}
      {isMonsterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setIsMonsterModalOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <h3 className="text-xl font-black">Añadir monstruo</h3>
            <div className="mt-4 space-y-3">
              <input value={monsterForm.name} onChange={(e) => setMonsterForm({ ...monsterForm, name: e.target.value })} placeholder="Nombre"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-red-400" />
              <textarea value={monsterForm.description} onChange={(e) => setMonsterForm({ ...monsterForm, description: e.target.value })}
                placeholder="Descripción breve" rows={2}
                className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-red-400" />
              <div className="grid grid-cols-4 gap-2">
                <input type="number" value={monsterForm.hp} onChange={(e) => setMonsterForm({ ...monsterForm, hp: e.target.value })} placeholder="PG"
                  className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm text-white outline-none focus:border-red-400" />
                <input type="number" value={monsterForm.ac} onChange={(e) => setMonsterForm({ ...monsterForm, ac: e.target.value })} placeholder="CA"
                  className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm text-white outline-none focus:border-red-400" />
                <input type="number" value={monsterForm.speed} onChange={(e) => setMonsterForm({ ...monsterForm, speed: e.target.value })} placeholder="Vel."
                  className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm text-white outline-none focus:border-red-400" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input value={monsterForm.damageDice} onChange={(e) => setMonsterForm({ ...monsterForm, damageDice: e.target.value })} placeholder="Daño (1d8+2)"
                  className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm text-white outline-none focus:border-red-400" />
                <input value={monsterForm.damageType} onChange={(e) => setMonsterForm({ ...monsterForm, damageType: e.target.value })} placeholder="Tipo de daño"
                  className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm text-white outline-none focus:border-red-400" />
              </div>
              <textarea value={monsterForm.notes} onChange={(e) => setMonsterForm({ ...monsterForm, notes: e.target.value })}
                placeholder="Notas tácticas" rows={2}
                className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-red-400" />
            </div>
            <button type="button" onClick={createMonster} disabled={!monsterForm.name.trim()}
              className="mt-5 w-full rounded-xl bg-red-600 px-4 py-3 font-black text-white transition hover:bg-red-500 disabled:opacity-60">
              Crear monstruo
            </button>
            <button type="button" onClick={() => setIsMonsterModalOpen(false)}
              className="mt-2 w-full rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {isCatalogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setIsCatalogModalOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <h3 className="text-xl font-black">Importar del catálogo</h3>
            <p className="mt-1 text-sm text-zinc-400">
              Se agrega una copia (con token) al bestiario de esta partida.
            </p>
            <input value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)}
              placeholder="Buscar monstruo..."
              className="mt-4 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-red-400" />

            <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
              {catalogMonsters.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  El catálogo global todavía no tiene monstruos cargados. Un admin puede agregarlos en /admin/monsters.
                </p>
              ) : filteredCatalogMonsters.length === 0 ? (
                <p className="text-sm text-zinc-500">Sin resultados para &quot;{catalogSearch}&quot;.</p>
              ) : (
                filteredCatalogMonsters.map((cm) => {
                  const alreadyAdded = monsters.some((m) => m.name === cm.name);
                  return (
                    <div key={cm.id} className="flex items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-full border border-zinc-700 bg-zinc-900">
                          {cm.tokenImagePath ? (
                            <img src={getImageUrl(cm.tokenImagePath)} alt="" className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">
                            {cm.name} <span className="text-xs font-normal text-zinc-500">CR {cm.crLabel}</span>
                          </p>
                          <p className="text-xs text-zinc-500">CA {cm.ac} · PG {cm.hp}</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => importFromCatalog(cm)}
                        disabled={isImportingId === cm.id}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-500 disabled:opacity-60">
                        {isImportingId === cm.id ? "Agregando..." : alreadyAdded ? "Agregar otra vez" : "Agregar"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <button type="button" onClick={() => setIsCatalogModalOpen(false)}
              className="mt-4 w-full rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800">
              Cerrar
            </button>
          </div>
        </div>
      )}

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
    </main>
  );
}