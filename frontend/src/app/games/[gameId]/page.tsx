"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type CurrentUser = {
  id: string;
  name: string;
  email: string;
  isAdmin?: boolean;
};

type GameMember = {
  id: string;
  userId: string;
  role: "DM" | "PLAYER";
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

type GameDetail = {
  id: string;
  name: string;
  description: string | null;
  inviteCode: string;
  dmUserId: string;
  createdAt: string;
  dm: {
    id: string;
    name: string;
    email: string;
  };
  members: GameMember[];
};

type BattleMap = {
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

type Character = {
  id: string;
  name: string;
  level: number;
  classId: string | null;
  raceId: string | null;
};

type GameCharacterSelection = {
  id: string;
  userId: string;
  characterId: string;
  isActive: boolean;
  selectedAt: string;
  character: Character;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

export default function GameDetailPage() {
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId;

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [game, setGame] = useState<GameDetail | null>(null);
  const [maps, setMaps] = useState<BattleMap[]>([]);
  const [selections, setSelections] = useState<GameCharacterSelection[]>([]);
  const [role, setRole] = useState<"DM" | "PLAYER">("PLAYER");
  const [codeCopied, setCodeCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isDeletingGame, setIsDeletingGame] = useState(false);

  useEffect(() => {
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  async function loadPage() {
    if (!gameId) {
      setError("No se encontró el ID de la partida.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const meRes = await fetch(`${API_URL}/auth/me`, { credentials: "include" });
      const meData = await meRes.json().catch(() => null);

      if (meRes.status === 401) {
        window.location.href = `/login?redirect=${encodeURIComponent(`/games/${gameId}`)}`;
        return;
      }

      if (!meRes.ok || !meData?.user) {
        setError("No se pudo cargar tu sesión.");
        setIsLoading(false);
        return;
      }

      setCurrentUser(meData.user as CurrentUser);

      const gameRes = await fetch(`${API_URL}/games/${gameId}`, { credentials: "include" });
      const gameData = await gameRes.json().catch(() => null);

      if (gameRes.status === 401) {
        window.location.href = `/login?redirect=${encodeURIComponent(`/games/${gameId}`)}`;
        return;
      }

      if (!gameRes.ok) {
        setError(gameData?.message ?? "No se pudo cargar la partida.");
        setIsLoading(false);
        return;
      }

      setGame(gameData.game as GameDetail);
      setRole(gameData.role as "DM" | "PLAYER");

      const mapsRes = await fetch(`${API_URL}/games/${gameId}/maps`, { credentials: "include" });
      const mapsData = await mapsRes.json().catch(() => null);
      if (mapsRes.ok) {
        setMaps((mapsData.maps ?? []) as BattleMap[]);
      }

      const charsRes = await fetch(`${API_URL}/games/${gameId}/characters`, { credentials: "include" });
      const charsData = await charsRes.json().catch(() => null);
      if (charsRes.ok) {
        setSelections((charsData.selections ?? []) as GameCharacterSelection[]);
      }
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setIsLoading(false);
    }
  }

  async function deleteGame() {
    if (!game) return;

    const confirmed = window.confirm(
      `¿Eliminar la partida "${game.name}"? Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    setIsDeletingGame(true);

    try {
      const res = await fetch(`${API_URL}/games/${gameId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (res.ok) {
        window.location.href = "/dashboard";
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.message ?? "No se pudo eliminar la partida.");
      }
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setIsDeletingGame(false);
    }
  }

  function copyInviteCode() {
    if (!game) return;
    navigator.clipboard.writeText(game.inviteCode).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  }

  const isDm = role === "DM";

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        Cargando partida...
      </main>
    );
  }

  if (error && !game) {
    return (
      <main className="min-h-screen bg-zinc-950 p-6 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-500/40 bg-red-500/10 p-6 text-red-200">
          {error}
          <div className="mt-6">
            <a
              href="/dashboard"
              className="inline-block rounded-xl border border-zinc-700 px-4 py-3 font-semibold text-zinc-200 transition hover:bg-zinc-800"
            >
              Volver al dashboard
            </a>
          </div>
        </div>
      </main>
    );
  }

  if (!game) return null;

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-white">
      <div className="mx-auto max-w-6xl space-y-6">

        <header className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-yellow-400">
            Initiative Forge
          </p>

          <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-3xl font-black">{game.name}</h1>

              {game.description && (
                <p className="mt-2 text-zinc-400">{game.description}</p>
              )}

              <p className="mt-2 text-sm text-zinc-500">
                DM: {game.dm.name} · {game.members.length} miembro(s)
              </p>

              {currentUser && (
                <p className="mt-1 text-xs text-zinc-500">
                  Sesión: {currentUser.email} · {isDm ? "Dungeon Master" : "Jugador"}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href={`/games/${game.id}/characters`}
                className="rounded-xl border border-zinc-700 px-4 py-3 text-center font-semibold text-zinc-200 transition hover:bg-zinc-800"
              >
                Personajes
              </a>

              <a
                href={`/games/${game.id}/combat`}
                className="rounded-xl bg-yellow-500 px-4 py-3 text-center font-bold text-zinc-950 transition hover:bg-yellow-400"
              >
                Ir al combate
              </a>

              <a
                href="/dashboard"
                className="rounded-xl border border-zinc-700 px-4 py-3 text-center font-semibold text-zinc-200 transition hover:bg-zinc-800"
              >
                Dashboard
              </a>
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">

            <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black">Personajes en la partida</h2>
                <a
                  href={`/games/${game.id}/characters`}
                  className="rounded-xl border border-zinc-700 px-3 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800"
                >
                  Gestionar
                </a>
              </div>

              <div className="mt-5">
                {selections.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-6 text-center">
                    <p className="font-bold text-zinc-300">Sin personajes aún.</p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {isDm
                        ? "Los jugadores todavía no han seleccionado sus personajes."
                        : "Selecciona tu personaje para esta partida."}
                    </p>
                    <a
                      href={`/games/${game.id}/characters`}
                      className="mt-4 inline-block rounded-xl bg-yellow-500 px-4 py-2 text-sm font-bold text-zinc-950 transition hover:bg-yellow-400"
                    >
                      {isDm ? "Ver personajes" : "Seleccionar personaje"}
                    </a>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {selections.map((sel) => (
                      <article
                        key={sel.id}
                        className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-black text-white">{sel.character.name}</p>
                            <p className="mt-0.5 text-sm text-zinc-400">
                              Nivel {sel.character.level}
                              {sel.character.classId ? ` · ${sel.character.classId}` : ""}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-xs font-bold text-yellow-300">
                            Activo
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-zinc-500">
                          Jugador: {sel.user?.name ?? "Desconocido"}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black">Mapas de batalla</h2>
                {isDm && (
                  <a
                    href={`/games/${game.id}/maps/new`}
                    className="rounded-xl bg-yellow-500 px-3 py-2 text-sm font-bold text-zinc-950 transition hover:bg-yellow-400"
                  >
                    + Crear mapa
                  </a>
                )}
              </div>

              <div className="mt-5">
                {maps.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-6 text-center">
                    <p className="font-bold text-zinc-300">
                      {isDm ? "No has creado mapas todavía." : "No hay mapas disponibles aún."}
                    </p>
                    {isDm && (
                      <a
                        href={`/games/${game.id}/maps/new`}
                        className="mt-4 inline-block rounded-xl bg-yellow-500 px-4 py-2 text-sm font-bold text-zinc-950 transition hover:bg-yellow-400"
                      >
                        Crear primer mapa
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {maps.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
                      >
                        <div>
                          <p className="font-bold text-white">{m.name}</p>
                          <p className="mt-0.5 text-sm text-zinc-500">
                            {m.rows} × {m.cols} · {m.isActive ? "Visible para jugadores" : "Oculto"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={[
                              "rounded-full px-2 py-0.5 text-xs font-bold",
                              m.isActive
                                ? "bg-green-500/20 text-green-300"
                                : "bg-zinc-800 text-zinc-400",
                            ].join(" ")}
                          >
                            {m.isActive ? "Activo" : "Oculto"}
                          </span>
                          {isDm && (
                            <a
                              href={`/maps/${m.id}/edit`}
                              className="rounded-xl border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-800"
                            >
                              Editar
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="space-y-6">

            <section className="rounded-3xl border border-yellow-500/30 bg-yellow-500/10 p-6 shadow-2xl">
              <h2 className="text-xl font-black text-yellow-100">Código de invitación</h2>
              <p className="mt-1 text-sm text-yellow-200/70">
                Comparte este código para que tus amigos puedan unirse.
              </p>

              <div className="mt-4 flex items-center gap-3">
                <span className="flex-1 rounded-2xl border border-yellow-500/30 bg-zinc-950 px-4 py-3 text-center text-2xl font-black tracking-[0.4em] text-yellow-300">
                  {game.inviteCode}
                </span>
                <button
                  type="button"
                  onClick={copyInviteCode}
                  className="rounded-2xl border border-yellow-500/40 bg-zinc-950 px-4 py-3 text-sm font-bold text-yellow-300 transition hover:bg-yellow-500/10"
                >
                  {codeCopied ? "¡Copiado!" : "Copiar"}
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
              <h2 className="text-xl font-black">Miembros</h2>

              <div className="mt-4 space-y-2">
                {game.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3"
                  >
                    <div>
                      <p className="font-bold text-white">{member.user.name}</p>
                      <p className="text-xs text-zinc-500">{member.user.email}</p>
                    </div>
                    <span
                      className={[
                        "rounded-full px-2 py-0.5 text-xs font-bold",
                        member.role === "DM"
                          ? "border border-yellow-500/40 bg-yellow-500/10 text-yellow-300"
                          : "border border-zinc-700 bg-zinc-800 text-zinc-400",
                      ].join(" ")}
                    >
                      {member.role === "DM" ? "DM" : "Jugador"}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {isDm && (
              <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
                <h2 className="text-xl font-black">Administrar partida</h2>

                <div className="mt-4 space-y-3">
                  <a
                    href={`/games/${game.id}/maps/new`}
                    className="block w-full rounded-xl border border-zinc-700 px-4 py-3 text-center font-semibold text-zinc-200 transition hover:bg-zinc-800"
                  >
                    Crear mapa de batalla
                  </a>

                  <a
                    href={`/games/${game.id}/combat`}
                    className="block w-full rounded-xl bg-yellow-500 px-4 py-3 text-center font-bold text-zinc-950 transition hover:bg-yellow-400"
                  >
                    Gestionar combate
                  </a>

                  <button
                    type="button"
                    onClick={deleteGame}
                    disabled={isDeletingGame}
                    className="w-full rounded-xl border border-red-500/50 px-4 py-3 font-bold text-red-400 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isDeletingGame ? "Eliminando..." : "Eliminar partida"}
                  </button>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
