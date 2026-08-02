"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type GameDetail = {
  id: string;
  name: string;
  description: string | null;
  inviteCode: string;
  role: "DM" | "PLAYER";
  createdAt: string;
  dm: {
    id: string;
    name: string;
    email: string;
  };
  members: {
    id: string;
    role: "DM" | "PLAYER";
    joinedAt: string;
    user: {
      id: string;
      name: string;
      email: string;
    };
  }[];
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
};

function getImageUrl(path: string | null) {
  if (!path) return "";
  return path.startsWith("http") ? path : `${API_URL}${path}`;
}

export default function GamePage() {
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId;

  const [game, setGame] = useState<GameDetail | null>(null);
  const [maps, setMaps] = useState<BattleMapSummary[]>([]);
  const [selections, setSelections] = useState<GameCharacterSelection[]>([]);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    async function loadGamePage() {
      if (!gameId) return;

      try {
        const gameResponse = await fetch(`${API_URL}/games/${gameId}`, {
          credentials: "include",
        });

        const gameData = await gameResponse.json().catch(() => null);

        if (gameResponse.status === 401) {
          window.location.href = `/login?redirect=${encodeURIComponent(
            `/games/${gameId}`
          )}`;
          return;
        }

        if (!gameResponse.ok) {
          setError(gameData?.message ?? "No se pudo cargar la partida.");
          return;
        }

        setGame({ ...gameData.game, role: gameData.role });

        const mapsResponse = await fetch(`${API_URL}/games/${gameId}/maps`, {
          credentials: "include",
        });

        const mapsData = await mapsResponse.json().catch(() => null);

        if (mapsResponse.ok) {
          setMaps(mapsData.maps ?? []);
        }

        const charsResponse = await fetch(
          `${API_URL}/games/${gameId}/characters`,
          { credentials: "include" }
        );

        const charsData = await charsResponse.json().catch(() => null);

        if (charsResponse.ok) {
          setSelections(
            ((charsData.selections ?? []) as GameCharacterSelection[]).filter(
              (s) => s.isActive
            )
          );
        }
      } catch {
        setError("No se pudo conectar con el backend.");
      } finally {
        setIsLoading(false);
      }
    }

    loadGamePage();
  }, [gameId]);

  async function copyInviteCode() {
    if (!game) return;

    await navigator.clipboard.writeText(game.inviteCode);
    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 2000);
  }

  async function deleteGame() {
    if (!game) return;

    const confirmed = window.confirm(
      `¿Eliminar la partida "${game.name}"? Esta acción no se puede deshacer y se perderán mapas, combates y personajes seleccionados.`
    );

    if (!confirmed) return;

    setDeleteError("");
    setIsDeleting(true);

    try {
      const response = await fetch(`${API_URL}/games/${game.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setDeleteError(data?.message ?? "No se pudo eliminar la partida.");
        return;
      }

      window.location.href = "/dashboard";
    } catch {
      setDeleteError("No se pudo conectar con el backend.");
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        Cargando partida...
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-zinc-950 p-6 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-500/40 bg-red-500/10 p-6 text-red-200">
          {error}
        </div>
      </main>
    );
  }

  if (!game) return null;

  const isDm = String(game.role).toUpperCase() === "DM";

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-yellow-400">
            Initiative Forge
          </p>

          <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-3xl font-black">{game.name}</h1>

              <p className="mt-2 text-zinc-400">
                DM: {game.dm.name} · Tu rol:{" "}
                {isDm ? "Dungeon Master" : "Jugador"}
              </p>

              {game.description ? (
                <p className="mt-4 max-w-3xl text-zinc-300">
                  {game.description}
                </p>
              ) : null}
            </div>

            <a
              href="/dashboard"
              className="rounded-xl border border-zinc-700 px-4 py-3 text-center font-semibold text-zinc-200 transition hover:bg-zinc-800"
            >
              Volver
            </a>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-black">
                    {isDm ? "Mapas preparados" : "Mapa activo"}
                  </h2>

                  <p className="mt-1 text-sm text-zinc-400">
                    {isDm
                      ? "Gestiona tus mapas secretos. Los jugadores solo verán el mapa activo."
                      : "El mapa aparecerá aquí cuando el DM lo active para el combate."}
                  </p>
                </div>

                {isDm ? (
                  <a
                    href={`/games/${game.id}/maps/new`}
                    className="rounded-xl bg-yellow-500 px-4 py-3 text-center font-bold text-zinc-950 transition hover:bg-yellow-400"
                  >
                    Crear mapa
                  </a>
                ) : null}
              </div>

              <div className="mt-5">
                {maps.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-6 text-center">
                    <p className="font-bold text-zinc-300">
                      {isDm
                        ? "Todavía no has creado mapas."
                        : "No hay un mapa activo en este momento."}
                    </p>

                    <p className="mt-2 text-sm text-zinc-500">
                      {isDm
                        ? "Crea mapas y activa uno cuando empiece el combate."
                        : "El DM mostrará el mapa cuando sea el momento."}
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {maps.map((battleMap) => (
                      <a
                        key={battleMap.id}
                        href={
                          isDm
                            ? `/maps/${battleMap.id}/edit`
                            : `/maps/${battleMap.id}`
                        }
                        className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 transition hover:border-yellow-400 hover:bg-yellow-500/10"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-black text-white">
                              {battleMap.name}
                            </h3>

                            <p className="mt-1 text-sm text-zinc-400">
                              {battleMap.rows} × {battleMap.cols}
                            </p>
                          </div>

                          <span
                            className={[
                              "rounded-full border px-3 py-1 text-xs font-bold",
                              battleMap.isActive
                                ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-300"
                                : "border-zinc-600 bg-zinc-800 text-zinc-300",
                            ].join(" ")}
                          >
                            {battleMap.isActive ? "Activo" : "Secreto"}
                          </span>
                        </div>

                        <p className="mt-4 text-xs text-zinc-500">
                          Actualizado:{" "}
                          {new Date(battleMap.updatedAt).toLocaleDateString(
                            "es-ES"
                          )}
                        </p>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
              <h2 className="text-2xl font-black">Miembros</h2>

              <div className="mt-5 divide-y divide-zinc-800 overflow-hidden rounded-2xl border border-zinc-800">
                {game.members.map((member) => {
                  const selection = selections.find(
                    (s) => s.userId === member.user.id
                  );
                  const character = selection?.character;
                  const tokenUrl = getImageUrl(character?.tokenImagePath ?? null);

                  return (
                    <div
                      key={member.id}
                      className="flex flex-col gap-3 bg-zinc-950 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-zinc-700 bg-zinc-800 text-xs font-black text-zinc-400">
                          {tokenUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={tokenUrl}
                              alt={character?.name ?? member.user.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            member.user.name.slice(0, 1).toUpperCase()
                          )}
                        </div>

                        <div>
                          <p className="font-bold text-white">
                            {member.user.name}
                          </p>
                          <p className="text-sm text-zinc-400">
                            {member.user.email}
                          </p>
                          {character ? (
                            <p className="mt-1 text-sm text-yellow-300">
                              {character.name} · Nivel {character.level}
                            </p>
                          ) : member.role !== "DM" ? (
                            <p className="mt-1 text-sm text-zinc-500">
                              Sin personaje seleccionado
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <span className="w-fit rounded-full border border-yellow-500/40 bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-300">
                        {member.role === "DM" ? "DM" : "Jugador"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
              <h2 className="text-xl font-black">Invitación</h2>

              <p className="mt-2 text-sm text-zinc-400">
                Comparte este código con tus amigos para que se unan.
              </p>

              <div className="mt-4 rounded-2xl border border-zinc-700 bg-zinc-950 p-4 text-center">
                <p className="text-3xl font-black tracking-[0.25em] text-yellow-400">
                  {game.inviteCode}
                </p>
              </div>

              <button
                type="button"
                onClick={copyInviteCode}
                className="mt-4 w-full rounded-xl bg-yellow-500 px-4 py-3 font-bold text-zinc-950 transition hover:bg-yellow-400"
              >
                {copied ? "Copiado" : "Copiar código"}
              </button>
            </section>

            <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
              <h2 className="text-xl font-black">Ir a...</h2>

              <div className="mt-4 flex flex-col gap-3">
                <a
                  href={`/games/${game.id}/combat`}
                  className="w-full rounded-xl bg-yellow-500 px-4 py-3 text-center font-bold text-zinc-950 transition hover:bg-yellow-400"
                >
                  Tablero de combate
                </a>

                {isDm ? (
                  <a
                    href={`/games/${game.id}/dm`}
                    className="w-full rounded-xl border border-zinc-700 px-4 py-3 text-center font-semibold text-zinc-200 transition hover:bg-zinc-800"
                  >
                    Pantalla del DM
                  </a>
                ) : (
                  <a
                    href={`/games/${game.id}/player`}
                    className="w-full rounded-xl border border-zinc-700 px-4 py-3 text-center font-semibold text-zinc-200 transition hover:bg-zinc-800"
                  >
                    Mi personaje
                  </a>
                )}

                <a
                  href={`/games/${game.id}/characters`}
                  className="w-full rounded-xl border border-zinc-700 px-4 py-3 text-center font-semibold text-zinc-200 transition hover:bg-zinc-800"
                >
                  Personajes
                </a>
              </div>
            </section>

            {isDm ? (
              <section className="rounded-3xl border border-red-500/30 bg-zinc-900 p-6 shadow-2xl">
                <h2 className="text-xl font-black text-red-300">Zona de peligro</h2>

                <p className="mt-2 text-sm text-zinc-400">
                  Eliminar la partida es permanente: se pierden mapas, combates y personajes seleccionados.
                </p>

                <button
                  type="button"
                  onClick={deleteGame}
                  disabled={isDeleting}
                  className="mt-4 w-full rounded-xl border border-red-500 px-4 py-3 font-bold text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDeleting ? "Eliminando..." : "Eliminar partida"}
                </button>

                {deleteError ? (
                  <p className="mt-3 text-sm text-red-300">{deleteError}</p>
                ) : null}
              </section>
            ) : null}
          </aside>
        </section>
      </div>
    </main>
  );
}