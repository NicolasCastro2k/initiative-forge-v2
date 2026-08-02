"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { io, Socket } from "socket.io-client";
import CombatActionPanel from "@/components/CombatActionPanel";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type TileType = "floor" | "wall" | "pit";

type GameDetail = {
  id: string;
  name: string;
  role: "DM" | "PLAYER";
};

type CurrentUser = {
  id: string;
  name: string;
  email: string;
  isAdmin?: boolean;
};

type BattleMapSummary = {
  id: string;
  gameId: string;
  name: string;
  rows: number;
  cols: number;
  isPublished: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type BattleMap = {
  id: string;
  gameId: string;
  name: string;
  rows: number;
  cols: number;
  gridData: { tiles: TileType[][] };
  isPublished: boolean;
  isActive: boolean;
  role: "DM" | "PLAYER";
};

type CombatantType = "PLAYER" | "ENEMY";

type CombatCharacter = {
  id: string;
  ownerUserId: string;
  name: string;
  raceId: string | null;
  classId: string | null;
  subclassId: string | null;
  backgroundId: string | null;
  level: number;
  sheetData: unknown;
  tokenImagePath: string | null;
  portraitImagePath: string | null;
  createdAt: string;
  updatedAt: string;
  owner?: { id: string; name: string; email: string };
};

type Condition =
  | "blinded" | "charmed" | "deafened" | "exhaustion" | "frightened"
  | "grappled" | "incapacitated" | "invisible" | "paralyzed" | "petrified"
  | "poisoned" | "prone" | "restrained" | "stunned" | "unconscious";

type Combatant = {
  id: string;
  encounterId: string;
  type: CombatantType;
  characterId: string | null;
  ownerUserId: string | null;
  name: string;
  hp: number;
  maxHp: number;
  ac: number;
  x: number;
  y: number;
  initiative: number;
  // Nuevos campos de combate D&D 5e
  speed: number;
  movementUsed: number;
  hasAction: boolean;
  hasBonusAction: boolean;
  hasReaction: boolean;
  isDashing: boolean;
  str: number; dex: number; con: number;
  int: number; wis: number; cha: number;
  conditions: Condition[];
  createdAt: string;
  updatedAt: string;
  character?: CombatCharacter | null;
};

type CombatEncounter = {
  id: string;
  gameId: string;
  currentTurnIndex: number;
  round: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  combatants: Combatant[];
};

function getTileClass(
  tile: TileType,
  isHighlighted: boolean,
  isSpellArea: boolean
) {
  const base = "relative flex aspect-square items-center justify-center transition";
  if (isSpellArea) {
    return `${base} m-1 rounded-md border-2 border-purple-400 bg-purple-500/30 hover:bg-purple-500/40`;
  }
  if (isHighlighted) {
    return `${base} m-1 rounded-md border-2 border-green-400 bg-green-500/20 hover:bg-green-500/30`;
  }
  const styles: Record<TileType, string> = {
    floor: "m-1 rounded-md border border-zinc-700 bg-zinc-800 hover:bg-zinc-700",
    wall: "m-0 rounded-none border border-stone-600 bg-stone-500 hover:bg-stone-400",
    pit: "m-0 rounded-none border border-zinc-950 bg-zinc-950 hover:bg-zinc-900",
  };
  return `${base} ${styles[tile]}`;
}

function getTokenClass(
  combatant: Combatant,
  isSelected: boolean,
  isActive: boolean,
  canControl: boolean,
  hasImage: boolean
) {
  const base = "flex h-8 w-8 items-center justify-center rounded-full border-2 shadow-lg transition overflow-hidden";
  const typeStyle = combatant.type === "PLAYER"
    ? hasImage ? "border-sky-300" : "border-sky-300 bg-sky-500 text-white text-xs font-black"
    : hasImage ? "border-red-300" : "border-red-300 bg-red-600 text-white text-xs font-black";
  const stateStyle = isSelected
    ? "ring-4 ring-yellow-400"
    : isActive ? "ring-4 ring-green-400" : "";
  return `${base} ${typeStyle} ${stateStyle} ${canControl ? "" : "opacity-60"}`;
}

export default function CombatPage() {
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId;

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [game, setGame] = useState<GameDetail | null>(null);
  const [maps, setMaps] = useState<BattleMapSummary[]>([]);
  const [map, setMap] = useState<BattleMap | null>(null);
  const [previewMap, setPreviewMap] = useState<BattleMap | null>(null);
  const [lastVisibleMapId, setLastVisibleMapId] = useState<string | null>(null);
  const [encounter, setEncounter] = useState<CombatEncounter | null>(null);
  const [selectedCombatantId, setSelectedCombatantId] = useState("");
  const [combatLog, setCombatLog] = useState<string[]>(["Pantalla de combate cargada."]);
  const [enemyName, setEnemyName] = useState("");
  const [enemyHp, setEnemyHp] = useState(7);
  const [enemyAc, setEnemyAc] = useState(13);
  const [enemyInitiative, setEnemyInitiative] = useState(10);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingCombat, setIsStartingCombat] = useState(false);
  const [isChangingMap, setIsChangingMap] = useState(false);
  const [isMapPanelOpen, setIsMapPanelOpen] = useState(true);
  const [mapZoom, setMapZoom] = useState(1);
  const [highlightedTiles, setHighlightedTiles] = useState<{ x: number; y: number; costFeet: number }[]>([]);
  const [spellAreaTiles, setSpellAreaTiles] = useState<{ x: number; y: number }[]>([]);
  const [isPlacementMode, setIsPlacementMode] = useState(false);
  const [placementQueue, setPlacementQueue] = useState<Combatant[]>([]);

  // Ref para acceder al mapa activo dentro del handler del socket sin stale closure
  const lastVisibleMapIdRef = useRef<string | null>(null);
  const isDmRef = useRef(false);

  const combatants = useMemo(() => encounter?.combatants ?? [], [encounter]);
  const activeCombatant = combatants[encounter?.currentTurnIndex ?? 0] ?? combatants[0] ?? null;
  const selectedCombatant = combatants.find((c) => c.id === selectedCombatantId);
  const isDm = game?.role === "DM";
  const displayedMap = isDm ? previewMap ?? map : map;
  const isPreviewingHiddenMap = Boolean(isDm && previewMap && previewMap.id !== map?.id);

  // Mantener refs sincronizados
  useEffect(() => { lastVisibleMapIdRef.current = lastVisibleMapId; }, [lastVisibleMapId]);
  useEffect(() => { isDmRef.current = isDm; }, [isDm]);

  // ─── Carga inicial ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadPage() {
      if (!gameId) {
        setError("No se encontró el ID de la partida.");
        setIsLoading(false);
        return;
      }

      try {
        // Las 4 cargas son independientes entre sí a nivel de red (ninguna
        // necesita el resultado de otra para armar su URL), así que se
        // lanzan todas juntas en vez de esperar auth+partida antes de recién
        // pedir combate+mapas.
        const [meResponse, gameResponse, , loadedActiveMap] = await Promise.all([
          fetch(`${API_URL}/auth/me`, { credentials: "include", cache: "no-store" }),
          fetch(`${API_URL}/games/${gameId}`, { credentials: "include" }),
          loadCombat(false),
          loadMaps(),
        ]);

        const [meData, gameData] = await Promise.all([
          meResponse.json().catch(() => null),
          gameResponse.json().catch(() => null),
        ]);

        if (meResponse.status === 401 || gameResponse.status === 401) {
          window.location.href = `/login?redirect=${encodeURIComponent(`/games/${gameId}/combat`)}`;
          return;
        }

        if (!meResponse.ok || !meData?.user) {
          setError("No se pudo cargar tu sesión.");
          return;
        }

        if (!gameResponse.ok) {
          setError(gameData?.message ?? "No se pudo cargar la partida.");
          return;
        }

        setCurrentUser(meData.user as CurrentUser);

        const loadedGame: GameDetail = {
          id: gameData.game.id,
          name: gameData.game.name,
          role: gameData.role,
        };

        setGame(loadedGame);

        // Esta parte sí depende del rol, así que se aplica recién acá —
        // pero la imagen del mapa ya se pidió desde el principio.
        if (loadedActiveMap) {
          setMap(loadedActiveMap);
          setPreviewMap(loadedGame.role === "DM" ? loadedActiveMap : null);
          setLastVisibleMapId(loadedActiveMap.id);
        }
      } catch {
        setError("No se pudo conectar con el backend.");
      } finally {
        setIsLoading(false);
      }
    }

    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  // ─── Socket.io — reemplaza el polling ──────────────────────────────────────
  useEffect(() => {
    if (!game || !gameId) return;

    // La cookie httpOnly viaja automáticamente con withCredentials: true
    const socket: Socket = io(API_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      socket.emit("join:game", gameId);
    });

    // Modo colocación — el DM está colocando fichas antes de iniciar
    socket.on("combat:placement", (payload: { encounter: CombatEncounter | null }) => {
      setEncounter(payload.encounter);
      setIsPlacementMode(true);
      const unplaced = (payload.encounter?.combatants ?? []).filter((c) => c.x === -1 || c.y === -1);
      setPlacementQueue(unplaced);
      setCombatLog((current) => ["El DM está colocando las fichas en el tablero...", ...current]);
    });

    // Movimiento instantáneo — actualiza x/y y movementUsed
    socket.on("combatant:moved", (payload: { combatantId: string; x: number; y: number; movementUsed: number }) => {
      setEncounter((current) => {
        if (!current) return current;
        return {
          ...current,
          combatants: current.combatants.map((c) =>
            c.id === payload.combatantId
              ? { ...c, x: payload.x, y: payload.y, movementUsed: payload.movementUsed }
              : c
          ),
        };
      });
    });

    // Combate actualizado (agregar/eliminar combatiente, cambio de stats)
    socket.on("combat:updated", (payload: { encounter: CombatEncounter | null }) => {
      const loadedEncounter = payload.encounter;
      setEncounter(loadedEncounter);

      if (loadedEncounter?.combatants?.length) {
        setSelectedCombatantId((current) => {
          const stillExists = loadedEncounter.combatants.some((c) => c.id === current);
          if (stillExists) return current;
          const active = loadedEncounter.combatants[loadedEncounter.currentTurnIndex]
            ?? loadedEncounter.combatants[0];
          return active?.id ?? "";
        });
      } else {
        setSelectedCombatantId("");
      }
    });

    // Combate iniciado
    socket.on("combat:started", (payload: { encounter: CombatEncounter | null }) => {
      const loadedEncounter = payload.encounter;
      setEncounter(loadedEncounter);
      setIsPlacementMode(false);
      setPlacementQueue([]);
      const first = loadedEncounter?.combatants?.[loadedEncounter.currentTurnIndex]
        ?? loadedEncounter?.combatants?.[0];
      setSelectedCombatantId(first?.id ?? "");
      setCombatLog((current) => ["¡Combate iniciado!", ...current]);
    });

    // Combate terminado
    socket.on("combat:ended", () => {
      setEncounter(null);
      setSelectedCombatantId("");
      setCombatLog((current) => ["Combate terminado.", ...current]);
    });

    // Mapa cambiado (activar/ocultar)
    socket.on("map:changed", (payload: { maps: BattleMapSummary[] }) => {
      const loadedMaps = payload.maps ?? [];
      setMaps(loadedMaps);

      const activeMap = loadedMaps.find((m) => m.isActive);
      const currentLastId = lastVisibleMapIdRef.current;

      if (!activeMap) {
        if (currentLastId !== null) {
          setMap(null);
          setLastVisibleMapId(null);
          if (!isDmRef.current) setPreviewMap(null);
          setCombatLog((current) => ["El DM ocultó el mapa de combate.", ...current]);
        }
        return;
      }

      if (activeMap.id !== currentLastId) {
        // Cargar el mapa nuevo
        fetch(`${API_URL}/maps/${activeMap.id}`, { credentials: "include" })
          .then((r) => r.json())
          .then((data) => {
            const loadedMap = data.map as BattleMap;
            setMap(loadedMap);
            setLastVisibleMapId(loadedMap.id);
            if (!isDmRef.current) setPreviewMap(null);
            setCombatLog((current) => [`El DM revela el mapa: ${activeMap.name}.`, ...current]);
          })
          .catch(() => null);
      }
    });

    // Hechizo lanzado — mostrar área brevemente en el tablero
    socket.on("spell:cast", (payload: { spellName: string; areaTiles: { x: number; y: number }[] }) => {
      if (payload.areaTiles.length > 0) {
        setSpellAreaTiles(payload.areaTiles);
        setCombatLog((current) => [`${payload.spellName} — área de efecto mostrada.`, ...current]);
        // Limpiar el área después de 3 segundos
        setTimeout(() => setSpellAreaTiles([]), 3000);
      }
    });

    socket.on("connect_error", () => {
      // Silencioso — el juego sigue funcionando sin tiempo real
    });

    return () => {
      socket.emit("leave:game", gameId);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, gameId]);

  // ─── Funciones de carga ─────────────────────────────────────────────────────
  async function loadCombat(silent: boolean) {
    if (!gameId) return;

    try {
      const response = await fetch(`${API_URL}/games/${gameId}/combat`, {
        credentials: "include",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        if (!silent) setError(data?.message ?? "No se pudo cargar el combate.");
        return;
      }

      const loadedEncounter = data.encounter as CombatEncounter | null;
      setEncounter(loadedEncounter);

      if (loadedEncounter?.combatants?.length) {
        setSelectedCombatantId((current) => {
          const stillExists = loadedEncounter.combatants.some((c) => c.id === current);
          if (stillExists) return current;
          const active = loadedEncounter.combatants[loadedEncounter.currentTurnIndex]
            ?? loadedEncounter.combatants[0];
          return active?.id ?? "";
        });
      } else {
        setSelectedCombatantId("");
      }
    } catch {
      if (!silent) setError("No se pudo conectar con el backend.");
    }
  }

  async function loadMaps() {
    if (!gameId) return null;

    const mapsResponse = await fetch(`${API_URL}/games/${gameId}/maps`, { credentials: "include" });
    const mapsData = await mapsResponse.json().catch(() => null);

    if (!mapsResponse.ok) {
      setError(mapsData?.message ?? "No se pudieron cargar los mapas.");
      return null;
    }

    const loadedMaps = (mapsData.maps ?? []) as BattleMapSummary[];
    setMaps(loadedMaps);

    const activeMap = loadedMaps.find((m) => m.isActive);
    if (!activeMap) {
      setMap(null);
      setPreviewMap(null);
      setLastVisibleMapId(null);
      return null;
    }

    return fetchMapById(activeMap.id);
  }

  async function fetchMapById(mapIdToLoad: string) {
    const mapResponse = await fetch(`${API_URL}/maps/${mapIdToLoad}`, { credentials: "include" });
    const mapData = await mapResponse.json().catch(() => null);
    if (!mapResponse.ok) {
      setError(mapData?.message ?? "No se pudo cargar el mapa.");
      return null;
    }
    return mapData.map as BattleMap;
  }

  async function previewMapById(mapIdToPreview: string) {
    setError("");
    const loadedMap = await fetchMapById(mapIdToPreview);
    if (!loadedMap) return;
    setPreviewMap(loadedMap);
    setCombatLog((current) => [
      `Vista previa del DM: ${loadedMap.name}. Aún no es visible para jugadores.`,
      ...current,
    ]);
  }

  // ─── Acciones DM ────────────────────────────────────────────────────────────
  // ─── Preparar combate (modo colocación) ────────────────────────────────────
  async function prepareCombat() {
    if (!gameId || !isDm) return;

    const confirmed = window.confirm(
      "¿Iniciar/reiniciar combate? Podrás colocar las fichas antes de empezar."
    );
    if (!confirmed) return;

    setIsStartingCombat(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/games/${gameId}/combat/prepare`, {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.message ?? "No se pudo preparar el combate.");
        return;
      }

      const loadedEncounter = data.encounter as CombatEncounter | null;
      setEncounter(loadedEncounter);
      setIsPlacementMode(true);
      const unplaced = (loadedEncounter?.combatants ?? []).filter((c) => c.x === -1 || c.y === -1);
      setPlacementQueue(unplaced);
      setCombatLog((current) => ["Modo colocación: haz click en el tablero para colocar cada ficha.", ...current]);
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setIsStartingCombat(false);
    }
  }

  // ─── Confirmar inicio (todas las fichas colocadas) ──────────────────────────
  async function confirmCombatStart() {
    if (!gameId || !isDm) return;

    setError("");

    try {
      const response = await fetch(`${API_URL}/games/${gameId}/combat/start`, {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.message ?? "No se pudo iniciar el combate.");
        return;
      }

      const loadedEncounter = data.encounter as CombatEncounter | null;
      setEncounter(loadedEncounter);
      setIsPlacementMode(false);
      setPlacementQueue([]);
      const first = loadedEncounter?.combatants?.[loadedEncounter.currentTurnIndex]
        ?? loadedEncounter?.combatants?.[0];
      setSelectedCombatantId(first?.id ?? "");
      setCombatLog((current) => ["¡Combate iniciado!", ...current]);
    } catch {
      setError("No se pudo conectar con el backend.");
    }
  }

  async function endCombat() {
    if (!gameId || !isDm) return;

    const confirmed = window.confirm(
      "¿Terminar el combate? Se eliminará el encuentro activo y sus combatientes."
    );
    if (!confirmed) return;

    setError("");

    try {
      const response = await fetch(`${API_URL}/games/${gameId}/combat/end`, {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.message ?? "No se pudo terminar el combate.");
        return;
      }

      setEncounter(null);
      setSelectedCombatantId("");
      setCombatLog((current) => ["Combate terminado.", ...current]);
    } catch {
      setError("No se pudo conectar con el backend.");
    }
  }

  async function activatePreviewMap() {
    if (!previewMap) return;

    setIsChangingMap(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/maps/${previewMap.id}/activate`, {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.map) {
        setError(data?.message ?? "No se pudo mostrar el mapa.");
        return;
      }

      const activatedMap = data.map as BattleMap;

      setMaps((current) =>
        current.map((m) => ({
          ...m,
          isActive: m.id === activatedMap.id,
          isPublished: m.id === activatedMap.id,
        }))
      );
      setMap({ ...previewMap, isActive: true, isPublished: true });
      setPreviewMap({ ...previewMap, isActive: true, isPublished: true });
      setLastVisibleMapId(activatedMap.id);

      setCombatLog((current) => [
        `El DM muestra el mapa a los jugadores: ${previewMap.name}.`,
        ...current,
      ]);
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setIsChangingMap(false);
    }
  }

  async function hideAllMaps() {
    if (!game) return;

    setIsChangingMap(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/games/${game.id}/maps/hide-all`, {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.message ?? "No se pudieron ocultar los mapas.");
        return;
      }

      setMaps((current) => current.map((m) => ({ ...m, isActive: false, isPublished: false })));
      setMap(null);
      setLastVisibleMapId(null);
      if (previewMap) setPreviewMap({ ...previewMap, isActive: false, isPublished: false });

      setCombatLog((current) => ["El DM oculta todos los mapas a los jugadores.", ...current]);
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setIsChangingMap(false);
    }
  }

  // ─── Movimiento (optimistic) ────────────────────────────────────────────────
  async function moveCombatant(combatant: Combatant, x: number, y: number) {
    if (!gameId) return;

    const previousX = combatant.x;
    const previousY = combatant.y;
    const previousMovementUsed = combatant.movementUsed;

    // Calcular costo del movimiento (Chebyshev × 5 pies)
    const dx = Math.abs(x - previousX);
    const dy = Math.abs(y - previousY);
    const costFeet = Math.max(dx, dy) * 5;
    const newMovementUsed = previousMovementUsed + costFeet;

    // Mover el token en pantalla de inmediato + actualizar movementUsed
    setEncounter((current) => {
      if (!current) return current;
      return {
        ...current,
        combatants: current.combatants.map((c) =>
          c.id === combatant.id ? { ...c, x, y, movementUsed: newMovementUsed } : c
        ),
      };
    });

    setCombatLog((current) => [`${combatant.name} se mueve a (${x}, ${y}).`, ...current]);

    try {
      const response = await fetch(
        `${API_URL}/games/${gameId}/combat/combatants/${combatant.id}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ x, y }),
        }
      );
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        // Revertir posición y movementUsed si el servidor rechazó
        setEncounter((current) => {
          if (!current) return current;
          return {
            ...current,
            combatants: current.combatants.map((c) =>
              c.id === combatant.id ? { ...c, x: previousX, y: previousY, movementUsed: previousMovementUsed } : c
            ),
          };
        });
        setError(data?.message ?? "No se pudo mover el combatiente.");
      }
      // Si salió bien, el socket actualiza a todos los demás
      // No necesitamos setEncounter aquí porque el socket nos notificará
    } catch {
      setEncounter((current) => {
        if (!current) return current;
        return {
          ...current,
          combatants: current.combatants.map((c) =>
            c.id === combatant.id ? { ...c, x: previousX, y: previousY, movementUsed: previousMovementUsed } : c
          ),
        };
      });
      setError("No se pudo conectar con el backend.");
    }
  }

  // ─── Turno siguiente ────────────────────────────────────────────────────────
  async function nextTurn() {
    if (!gameId || !isDm) {
      setCombatLog((current) => ["Solo el DM puede avanzar el turno.", ...current]);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/games/${gameId}/combat/next-turn`, {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.message ?? "No se pudo avanzar el turno.");
        return;
      }

      const loadedEncounter = data.encounter as CombatEncounter | null;
      setEncounter(loadedEncounter);

      const nextCombatant = loadedEncounter?.combatants?.[loadedEncounter.currentTurnIndex]
        ?? loadedEncounter?.combatants?.[0];
      setSelectedCombatantId(nextCombatant?.id ?? "");

      if (nextCombatant) {
        setCombatLog((current) => [
          `Turno de ${nextCombatant.name}. Ronda ${loadedEncounter?.round ?? 1}.`,
          ...current,
        ]);
      }
    } catch {
      setError("No se pudo conectar con el backend.");
    }
  }

  // ─── Agregar/eliminar enemigos ──────────────────────────────────────────────
  async function addEnemy(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!gameId || !isDm) {
      setCombatLog((current) => ["Solo el DM puede agregar enemigos.", ...current]);
      return;
    }
    if (!displayedMap) {
      setCombatLog((current) => [
        "Debes previsualizar o mostrar un mapa antes de colocar enemigos.",
        ...current,
      ]);
      return;
    }

    const name = enemyName.trim();
    if (!name) {
      setCombatLog((current) => ["El enemigo necesita un nombre.", ...current]);
      return;
    }

    const freeTile = findFirstFreeTile();
    if (!freeTile) {
      setCombatLog((current) => [
        "No hay casillas libres de suelo para colocar al enemigo.",
        ...current,
      ]);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/games/${gameId}/combat/enemies`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          hp: enemyHp,
          maxHp: enemyHp,
          ac: enemyAc,
          initiative: enemyInitiative,
          x: freeTile.x,
          y: freeTile.y,
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.message ?? "No se pudo agregar el enemigo.");
        return;
      }

      setEncounter(data.encounter as CombatEncounter | null);
      if (data.combatant?.id) setSelectedCombatantId(data.combatant.id);

      setEnemyName("");
      setEnemyHp(7);
      setEnemyAc(13);
      setEnemyInitiative(10);

      setCombatLog((current) => [
        `${name} entra al combate en (${freeTile.x}, ${freeTile.y}).`,
        ...current,
      ]);
    } catch {
      setError("No se pudo conectar con el backend.");
    }
  }

  async function removeSelectedEnemy() {
    if (!gameId || !isDm || !selectedCombatant) return;

    const confirmed = window.confirm(`¿Eliminar a ${selectedCombatant.name} del combate?`);
    if (!confirmed) return;

    try {
      const response = await fetch(
        `${API_URL}/games/${gameId}/combat/combatants/${selectedCombatant.id}`,
        { method: "DELETE", credentials: "include" }
      );
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.message ?? "No se pudo eliminar el combatiente.");
        return;
      }

      setEncounter(data.encounter as CombatEncounter | null);
      const first = (data.encounter as CombatEncounter | null)?.combatants?.[
        (data.encounter as CombatEncounter | null)?.currentTurnIndex ?? 0
      ] ?? (data.encounter as CombatEncounter | null)?.combatants?.[0];
      setSelectedCombatantId(first?.id ?? "");

      setCombatLog((current) => [
        `${selectedCombatant.name} fue eliminado del combate.`,
        ...current,
      ]);
    } catch {
      setError("No se pudo conectar con el backend.");
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────
  function canControlCombatant(combatant: Combatant) {
    if (isDm) return true;
    if (combatant.type === "ENEMY") return false;
    if (!currentUser) return false;
    return combatant.ownerUserId === currentUser.id;
  }

  function canActWithCombatant(combatant: Combatant) {
    if (isDm) return true;
    return canControlCombatant(combatant) && activeCombatant?.id === combatant.id;
  }

  function getSelectedCombatantRestrictionMessage() {
    if (!selectedCombatant) return "";
    if (isDm) return "Como DM puedes controlar este combatiente.";
    if (!canControlCombatant(selectedCombatant)) return "Puedes ver este combatiente, pero no controlarlo.";
    if (activeCombatant?.id !== selectedCombatant.id) return "Controlas este personaje, pero aún no es su turno.";
    return "Es tu turno. Puedes mover y actuar con este personaje.";
  }

  function getCombatantAt(x: number, y: number) {
    return combatants.find((c) => c.x === x && c.y === y && c.x !== -1 && c.y !== -1);
  }

  function canMoveTo(x: number, y: number) {
    if (!displayedMap) return false;
    const tile = displayedMap.gridData.tiles[y]?.[x];
    return tile === "floor" && !getCombatantAt(x, y);
  }

  function findFirstFreeTile() {
    if (!displayedMap) return null;
    for (let y = 0; y < displayedMap.rows; y++) {
      for (let x = 0; x < displayedMap.cols; x++) {
        if (displayedMap.gridData.tiles[y]?.[x] === "floor" && !getCombatantAt(x, y)) {
          return { x, y };
        }
      }
    }
    return null;
  }

  function handleCellClick(x: number, y: number) {
    // ─── Modo colocación ────────────────────────────────────────────────────
    if (isPlacementMode && isDm) {
      if (!displayedMap) return;
      const tile = displayedMap.gridData.tiles[y]?.[x];
      if (tile !== "floor") {
        setCombatLog((current) => ["Solo puedes colocar fichas en casillas de suelo.", ...current]);
        return;
      }
      // Verificar que la casilla no esté ocupada por otra ficha ya colocada
      const occupied = combatants.find((c) => c.x === x && c.y === y);
      if (occupied) {
        setCombatLog((current) => [`Casilla ocupada por ${occupied.name}.`, ...current]);
        return;
      }

      const nextToPlace = placementQueue[0];
      if (!nextToPlace) return;

      // Mover la ficha a esa posición
      moveCombatant(nextToPlace, x, y);

      // Sacarla de la cola y actualizar el encuentro local
      const newQueue = placementQueue.slice(1);
      setPlacementQueue(newQueue);

      setCombatLog((current) => [
        `${nextToPlace.name} colocado en (${x}, ${y}).${newQueue.length > 0 ? ` Siguiente: ${newQueue[0].name}` : " Todas las fichas colocadas."}`,
        ...current,
      ]);
      return;
    }

    // ─── Modo combate normal ────────────────────────────────────────────────
    if (!displayedMap || !selectedCombatant) return;

    const combatantAtCell = getCombatantAt(x, y);
    if (combatantAtCell) {
      setSelectedCombatantId(combatantAtCell.id);
      setCombatLog((current) => [
        canControlCombatant(combatantAtCell)
          ? `${combatantAtCell.name} seleccionado.`
          : `${combatantAtCell.name} seleccionado. No controlas este combatiente.`,
        ...current,
      ]);
      return;
    }

    if (!canControlCombatant(selectedCombatant)) {
      setCombatLog((current) => [`No puedes mover a ${selectedCombatant.name}.`, ...current]);
      return;
    }
    if (!canActWithCombatant(selectedCombatant)) {
      setCombatLog((current) => [
        `No puedes actuar con ${selectedCombatant.name} ahora. Espera su turno.`,
        ...current,
      ]);
      return;
    }
    if (!canMoveTo(x, y)) {
      setCombatLog((current) => ["Movimiento bloqueado: esa casilla no es transitable.", ...current]);
      return;
    }

    moveCombatant(selectedCombatant, x, y);
  }

  function demoAttack() {
    if (!selectedCombatant) return;
    if (!canControlCombatant(selectedCombatant)) {
      setCombatLog((current) => [`No puedes atacar con ${selectedCombatant.name}.`, ...current]);
      return;
    }
    if (!canActWithCombatant(selectedCombatant)) {
      setCombatLog((current) => [
        `Solo puedes actuar con ${selectedCombatant.name} durante su turno.`,
        ...current,
      ]);
      return;
    }
    setCombatLog((current) => [`${selectedCombatant.name} realiza un ataque de prueba.`, ...current]);
  }

  function demoSpell() {
    if (!selectedCombatant) return;
    if (!canControlCombatant(selectedCombatant)) {
      setCombatLog((current) => [`No puedes lanzar hechizos con ${selectedCombatant.name}.`, ...current]);
      return;
    }
    if (!canActWithCombatant(selectedCombatant)) {
      setCombatLog((current) => [
        `Solo puedes actuar con ${selectedCombatant.name} durante su turno.`,
        ...current,
      ]);
      return;
    }
    setCombatLog((current) => [`${selectedCombatant.name} lanza un hechizo de prueba.`, ...current]);
  }

  function zoomIn() { setMapZoom((c) => Math.min(c + 0.05, 2)); }
  function zoomOut() { setMapZoom((c) => Math.max(c - 0.05, 0.5)); }
  function resetZoom() { setMapZoom(1); }

  // ─── Render ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        Cargando combate...
      </main>
    );
  }

  if (error && !game) {
    return (
      <main className="min-h-screen bg-zinc-950 p-6 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-500/40 bg-red-500/10 p-6 text-red-200">
          {error}
          <div className="mt-6">
            <a href={`/games/${gameId}`} className="inline-block rounded-xl border border-zinc-700 px-4 py-3 font-semibold text-zinc-200 transition hover:bg-zinc-800">
              Volver a la partida
            </a>
          </div>
        </div>
      </main>
    );
  }

  if (!game) return null;

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-yellow-400">Initiative Forge</p>
            <h1 className="mt-2 text-3xl font-black">Combate</h1>
            <p className="mt-2 text-zinc-400">
              {game.name} · {map ? `Mapa visible: ${map.name}` : "Sin mapa visible"}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {encounter ? `Ronda ${encounter.round} · ${combatants.length} combatiente(s)` : "No hay combate activo"}
            </p>
            {currentUser && (
              <p className="mt-1 text-xs text-zinc-500">
                Sesión: {currentUser.email} · {isDm ? "Dungeon Master" : "Jugador"}
              </p>
            )}
            {isPreviewingHiddenMap && (
              <p className="mt-1 text-xs font-bold text-yellow-300">
                Vista previa secreta del DM: {previewMap?.name}. Los jugadores todavía no ven este mapa.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            {isDm && !isPlacementMode && (
              <>
                <button type="button" onClick={prepareCombat} disabled={isStartingCombat}
                  className="rounded-xl bg-green-500 px-4 py-3 font-bold text-zinc-950 transition hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-60">
                  {isStartingCombat ? "Preparando..." : "Iniciar/Reiniciar"}
                </button>
                <button type="button" onClick={nextTurn} disabled={!encounter?.isActive}
                  className="rounded-xl bg-yellow-500 px-4 py-3 font-bold text-zinc-950 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60">
                  Siguiente turno
                </button>
              </>
            )}
            {isDm && isPlacementMode && (
              <>
                <button
                  type="button"
                  onClick={confirmCombatStart}
                  disabled={placementQueue.length > 0}
                  className="rounded-xl bg-green-500 px-4 py-3 font-bold text-zinc-950 transition hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {placementQueue.length > 0
                    ? `Faltan ${placementQueue.length} ficha(s)`
                    : "¡Iniciar combate!"}
                </button>
                <button
                  type="button"
                  onClick={() => { setIsPlacementMode(false); setPlacementQueue([]); }}
                  className="rounded-xl border border-zinc-700 px-4 py-3 font-bold text-zinc-200 transition hover:bg-zinc-800"
                >
                  Cancelar
                </button>
              </>
            )}
            <a href={`/games/${game.id}`}
              className="rounded-xl border border-zinc-700 px-4 py-3 text-center font-semibold text-zinc-200 transition hover:bg-zinc-800">
              Volver
            </a>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">{error}</div>
        )}

        <section className="grid gap-6 xl:grid-cols-[300px_1fr_340px]">
          <aside className="space-y-6">
            {isDm && (
              <section className="overflow-hidden rounded-3xl border border-yellow-500/30 bg-yellow-500/10 shadow-2xl">
                <button type="button" onClick={() => setIsMapPanelOpen((c) => !c)}
                  className="flex w-full items-center justify-between gap-3 p-5 text-left transition hover:bg-yellow-500/10">
                  <div>
                    <h2 className="text-xl font-black">Panel secreto del DM</h2>
                    <p className="mt-1 text-sm text-zinc-300">
                      {previewMap ? `Vista previa: ${previewMap.name}` : "Mapas preparados ocultos para jugadores."}
                    </p>
                  </div>
                  <span className="rounded-full border border-yellow-500/40 bg-zinc-950 px-3 py-1 text-xs font-bold text-yellow-300">
                    {isMapPanelOpen ? "Cerrar" : "Abrir"}
                  </span>
                </button>
                {isMapPanelOpen && (
                  <div className="border-t border-yellow-500/20 p-5 pt-4">
                    <p className="text-sm text-zinc-300">
                      Selecciona un mapa para previsualizarlo. Los jugadores no lo verán hasta que lo reveles.
                    </p>
                    <div className="mt-4">
                      <label htmlFor="map-preview-select" className="mb-2 block text-sm font-bold text-zinc-200">
                        Mapas preparados
                      </label>
                      <select id="map-preview-select" value={previewMap?.id ?? ""}
                        disabled={isChangingMap || maps.length === 0}
                        onChange={(e) => { if (e.target.value) previewMapById(e.target.value); }}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 font-semibold text-white outline-none transition focus:border-yellow-400 disabled:cursor-not-allowed disabled:opacity-60">
                        <option value="">{maps.length === 0 ? "No tienes mapas preparados" : "Selecciona un mapa"}</option>
                        {maps.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} · {m.rows} × {m.cols}{m.isActive ? " · Visible" : " · Oculto"}
                          </option>
                        ))}
                      </select>
                    </div>
                    {previewMap ? (
                      <div className="mt-4 rounded-2xl border border-yellow-500/30 bg-zinc-950 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-yellow-400">Vista previa</p>
                            <h3 className="mt-1 text-lg font-black text-white">{previewMap.name}</h3>
                            <p className="mt-1 text-sm text-zinc-400">
                              {previewMap.rows} × {previewMap.cols} · {previewMap.isActive ? "Visible para jugadores" : "Oculto"}
                            </p>
                          </div>
                          <span className={["rounded-full border px-3 py-1 text-xs font-bold",
                            previewMap.isActive
                              ? "border-green-500/40 bg-green-500/10 text-green-300"
                              : "border-yellow-500/40 bg-yellow-500/10 text-yellow-300",
                          ].join(" ")}>
                            {previewMap.isActive ? "Visible" : "Previsualizando"}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-4 text-sm text-zinc-400">
                        Selecciona un mapa para verlo en secreto.
                      </div>
                    )}
                    <div className="mt-4 grid gap-3">
                      <button type="button" disabled={isChangingMap || !previewMap} onClick={activatePreviewMap}
                        className="w-full rounded-xl bg-yellow-500 px-4 py-3 font-bold text-zinc-950 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60">
                        Mostrar este mapa a jugadores
                      </button>
                      <button type="button" disabled={isChangingMap || maps.length === 0} onClick={hideAllMaps}
                        className="w-full rounded-xl border border-red-500 px-4 py-3 font-bold text-red-300 transition hover:bg-red-500/10 disabled:opacity-60">
                        Ocultar todos
                      </button>
                      <a href={`/games/${game.id}/maps/new`}
                        className="block w-full rounded-xl border border-zinc-700 px-4 py-3 text-center font-bold text-zinc-200 transition hover:bg-zinc-800">
                        Crear nuevo tablero
                      </a>
                    </div>
                  </div>
                )}
              </section>
            )}

            {isDm && (
              <section className="rounded-3xl border border-red-500/30 bg-red-500/10 p-5 shadow-2xl">
                <h2 className="text-xl font-black text-red-100">Enemigos</h2>
                <p className="mt-2 text-sm text-red-100/70">Los enemigos se guardan en el combate activo.</p>
                <form onSubmit={addEnemy} className="mt-4 space-y-3">
                  <div>
                    <label className="mb-1 block text-sm font-bold text-zinc-200">Nombre</label>
                    <input value={enemyName} onChange={(e) => setEnemyName(e.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none transition focus:border-red-400"
                      placeholder="Goblin, Orco, Bandido..." />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-bold text-zinc-300">HP</label>
                      <input type="number" min={1} value={enemyHp} onChange={(e) => setEnemyHp(Number(e.target.value))}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none transition focus:border-red-400" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-zinc-300">CA</label>
                      <input type="number" min={1} value={enemyAc} onChange={(e) => setEnemyAc(Number(e.target.value))}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none transition focus:border-red-400" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-zinc-300">Ini</label>
                      <input type="number" value={enemyInitiative} onChange={(e) => setEnemyInitiative(Number(e.target.value))}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none transition focus:border-red-400" />
                    </div>
                  </div>
                  <button type="submit" disabled={!encounter}
                    className="w-full rounded-xl bg-red-600 px-4 py-3 font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60">
                    Agregar enemigo
                  </button>
                </form>
                {!encounter && <p className="mt-3 text-xs text-red-100/70">Primero inicia el combate.</p>}
              </section>
            )}

            <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
              <h2 className="text-xl font-black">Orden de turno</h2>
              <div className="mt-4 space-y-3">
                {combatants.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-4 text-sm text-zinc-400">
                    No hay combatientes. El DM debe iniciar el combate.
                  </div>
                ) : combatants.map((combatant, index) => {
                  const canControl = canControlCombatant(combatant);
                  return (
                    <button key={combatant.id} type="button" onClick={() => setSelectedCombatantId(combatant.id)}
                      className={["w-full rounded-2xl border p-3 text-left transition",
                        combatant.id === activeCombatant?.id
                          ? "border-green-400 bg-green-500/10"
                          : "border-zinc-800 bg-zinc-950 hover:border-yellow-400",
                      ].join(" ")}>
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-white">{combatant.name}</p>
                        <span className="text-xs font-bold text-yellow-300">{combatant.initiative}</span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-400">
                        {index === encounter?.currentTurnIndex ? "Turno actual" : "En espera"}
                      </p>
                      {!isDm && (
                        <p className={["mt-1 text-xs", canControl ? "text-sky-300" : "text-zinc-500"].join(" ")}>
                          {canControl ? "Tu token" : "Solo vista"}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          </aside>

          <div className="space-y-6">
            {isPlacementMode && isDm && (
              <div className="rounded-2xl border border-yellow-500/40 bg-yellow-500/10 p-4">
                <p className="font-bold text-yellow-300">
                  Modo colocación activo
                </p>
                {placementQueue.length > 0 ? (
                  <p className="mt-1 text-sm text-yellow-200/80">
                    Haz click en una casilla para colocar a{" "}
                    <span className="font-black">{placementQueue[0].name}</span>.
                    {placementQueue.length > 1 && ` Luego: ${placementQueue.slice(1).map((c) => c.name).join(", ")}.`}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-green-300">
                    ¡Todas las fichas colocadas! Haz click en "¡Iniciar combate!" para comenzar.
                  </p>
                )}
              </div>
            )}

            <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4 shadow-2xl">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-black">{displayedMap ? displayedMap.name : "Área de combate"}</h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    {displayedMap ? `${displayedMap.rows} × ${displayedMap.cols} · Zoom ${Math.round(mapZoom * 100)}%` : "Sin mapa cargado"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={zoomOut} className="rounded-xl border border-zinc-700 px-3 py-2 font-bold text-zinc-200 transition hover:bg-zinc-800">-</button>
                  <button type="button" onClick={resetZoom} className="rounded-xl border border-zinc-700 px-3 py-2 text-sm font-bold text-zinc-200 transition hover:bg-zinc-800">{Math.round(mapZoom * 100)}%</button>
                  <button type="button" onClick={zoomIn} className="rounded-xl border border-zinc-700 px-3 py-2 font-bold text-zinc-200 transition hover:bg-zinc-800">+</button>
                </div>
              </div>
              <div className="grid h-[500px] place-items-center overflow-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
                {displayedMap ? (
                  <div className="inline-block" style={{ transform: `scale(${mapZoom})`, transformOrigin: "center center" }}>
                    <div className={["grid min-w-max gap-0 rounded-2xl border bg-zinc-950 p-2",
                      isPreviewingHiddenMap ? "border-yellow-500" : "border-zinc-800"].join(" ")}
                      style={{ gridTemplateColumns: `repeat(${displayedMap.cols}, minmax(38px, 52px))` }}>
                      {displayedMap.gridData.tiles.map((row, y) =>
                        row.map((tile, x) => {
                          const combatant = getCombatantAt(x, y);
                          const isSelected = combatant?.id === selectedCombatantId;
                          const isActive = combatant?.id === activeCombatant?.id;
                          const canControl = combatant ? canControlCombatant(combatant) : false;
                          const isHighlighted = highlightedTiles.some((t) => t.x === x && t.y === y);
                          const isSpellArea = spellAreaTiles.some((t) => t.x === x && t.y === y);
                          return (
                            <button key={`${y}-${x}`} type="button" onClick={() => handleCellClick(x, y)}
                              className={getTileClass(tile, isHighlighted, isSpellArea)} title={`${x},${y} · ${tile}`}>
                              {combatant && (
                                <span className={getTokenClass(combatant, isSelected, isActive, canControl, !!combatant.character?.tokenImagePath)}>
                                  {combatant.character?.tokenImagePath ? (
                                    <img
                                      src={`${API_URL}${combatant.character.tokenImagePath}`}
                                      alt={combatant.name}
                                      className="h-full w-full object-cover"
                                      draggable={false}
                                    />
                                  ) : (
                                    combatant.name.slice(0, 1)
                                  )}
                                </span>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-full w-full items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-8 text-center">
                    <div>
                      <p className="text-2xl font-black text-zinc-300">Sin mapa visible</p>
                      <p className="mt-2 max-w-md text-zinc-500">
                        {isDm
                          ? "Usa el panel secreto del DM para previsualizar un mapa. Cuando esté listo, podrás revelarlo a los jugadores."
                          : "Esperando a que el DM revele el mapa de combate."}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <CombatActionPanel
              gameId={game.id}
              selectedCombatant={selectedCombatant ?? null}
              activeCombatant={activeCombatant}
              allCombatants={combatants}
              isDm={isDm}
              currentUserId={currentUser?.id ?? ""}
              highlightedTiles={highlightedTiles}
              onHighlightTiles={setHighlightedTiles}
              onSpellAreaPreview={setSpellAreaTiles}
              onCombatUpdated={() => loadCombat(true)}
              onLogEntry={(text) => setCombatLog((c) => [text, ...c])}
            />
          </div>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
              <h2 className="text-xl font-black">Combatiente activo</h2>
              {selectedCombatant ? (
                <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-black">{selectedCombatant.name}</p>
                    <span className={["rounded-full px-3 py-1 text-xs font-bold",
                      selectedCombatant.type === "PLAYER" ? "bg-sky-500/20 text-sky-300" : "bg-red-500/20 text-red-300",
                    ].join(" ")}>
                      {selectedCombatant.type === "PLAYER" ? "Jugador" : "Enemigo"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-zinc-400">
                    {selectedCombatant.type === "ENEMY"
                      ? "Controlado por el DM"
                      : selectedCombatant.character?.owner?.email
                        ? `Dueño: ${selectedCombatant.character.owner.email}`
                        : "Dueño sin correo registrado"}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-zinc-900 p-3">
                      <p className="text-zinc-500">HP</p>
                      <p className="font-bold">{selectedCombatant.hp}/{selectedCombatant.maxHp}</p>
                    </div>
                    <div className="rounded-xl bg-zinc-900 p-3">
                      <p className="text-zinc-500">CA</p>
                      <p className="font-bold">{selectedCombatant.ac}</p>
                    </div>
                    <div className="rounded-xl bg-zinc-900 p-3">
                      <p className="text-zinc-500">Posición</p>
                      <p className="font-bold">{selectedCombatant.x}, {selectedCombatant.y}</p>
                    </div>
                    <div className="rounded-xl bg-zinc-900 p-3">
                      <p className="text-zinc-500">Iniciativa</p>
                      <p className="font-bold">{selectedCombatant.initiative}</p>
                    </div>
                  </div>
                  {isDm && selectedCombatant.type === "ENEMY" && (
                    <button type="button" onClick={removeSelectedEnemy}
                      className="mt-4 w-full rounded-xl border border-red-500 px-4 py-3 font-bold text-red-300 transition hover:bg-red-500/10">
                      Eliminar enemigo
                    </button>
                  )}
                  {isDm && encounter && (
                    <button type="button" onClick={endCombat}
                      className="mt-3 w-full rounded-xl border border-zinc-700 px-4 py-3 font-bold text-zinc-300 transition hover:bg-zinc-800">
                      Terminar combate
                    </button>
                  )}
                </div>
              ) : (
                <p className="mt-4 text-sm text-zinc-500">No hay combatiente seleccionado.</p>
              )}
            </section>

            <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
              <h2 className="text-xl font-black">Registro</h2>
              <div className="mt-4 max-h-64 space-y-2 overflow-auto text-sm text-zinc-400">
                {combatLog.map((entry, index) => (
                  <p key={`${entry}-${index}`} className="rounded-xl bg-zinc-950 px-3 py-2">{entry}</p>
                ))}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}