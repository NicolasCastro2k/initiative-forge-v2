"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

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

type Character = {
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
  owner?: {
    id: string;
    name: string;
    email: string;
  };
};

type GameCharacterSelection = {
  id: string;
  gameId: string;
  userId: string;
  characterId: string;
  isActive: boolean;
  selectedAt: string;
  character: Character;
};

export default function GameCharactersPage() {
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId;

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [game, setGame] = useState<GameDetail | null>(null);
  const [myCharacters, setMyCharacters] = useState<Character[]>([]);
  const [selectedCharacters, setSelectedCharacters] = useState<
    GameCharacterSelection[]
  >([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSelecting, setIsSelecting] = useState(false);
  const [removingSelectionId, setRemovingSelectionId] = useState<string | null>(
    null
  );

  useEffect(() => {
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  async function loadPage() {
    setError("");
    setSuccess("");

    if (!gameId) {
      setError("No se encontró el ID de la partida.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      // Las 4 llamadas son independientes entre sí, así que se piden todas
      // en paralelo en vez de esperar una detrás de otra.
      const [meResponse, gameResponse, myCharactersResponse, selectedResponse] = await Promise.all([
        fetch(`${API_URL}/auth/me`, { credentials: "include", cache: "no-store" }),
        fetch(`${API_URL}/games/${gameId}`, { credentials: "include" }),
        fetch(`${API_URL}/characters`, { credentials: "include" }),
        fetch(`${API_URL}/games/${gameId}/characters`, { credentials: "include" }),
      ]);

      const [meData, gameData, myCharactersData, selectedData] = await Promise.all([
        meResponse.json().catch(() => null),
        gameResponse.json().catch(() => null),
        myCharactersResponse.json().catch(() => null),
        selectedResponse.json().catch(() => null),
      ]);

      if (meResponse.status === 401 || gameResponse.status === 401) {
        window.location.href = `/login?redirect=${encodeURIComponent(
          `/games/${gameId}/characters`
        )}`;
        return;
      }

      if (!meResponse.ok || !meData?.user) {
        setError("No se pudo cargar tu sesión.");
        return;
      }

      const loadedUser = meData.user as CurrentUser;
      setCurrentUser(loadedUser);

      if (!gameResponse.ok) {
        setError(gameData?.message ?? "No se pudo cargar la partida.");
        return;
      }

      const loadedGame: GameDetail = {
        id: gameData.game.id,
        name: gameData.game.name,
        role: gameData.role,
      };

      setGame(loadedGame);

      if (!myCharactersResponse.ok) {
        setError(
          myCharactersData?.message ?? "No se pudieron cargar tus personajes."
        );
        return;
      }

      const loadedMyCharacters = (myCharactersData.characters ??
        []) as Character[];

      setMyCharacters(loadedMyCharacters);

      if (!selectedResponse.ok) {
        setError(
          selectedData?.message ??
            "No se pudieron cargar los personajes de la partida."
        );
        return;
      }

      const selections = (selectedData.selections ??
        []) as GameCharacterSelection[];

      setSelectedCharacters(selections);

      const ownSelection = selections.find(
        (selection) => selection.userId === loadedUser.id
      );

      if (ownSelection) {
        setSelectedCharacterId(ownSelection.characterId);
      } else {
        setSelectedCharacterId("");
      }
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setIsLoading(false);
    }
  }

  async function selectCharacter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!gameId) {
      setError("No se encontró el ID de la partida.");
      return;
    }

    if (!selectedCharacterId) {
      setError("Debes seleccionar un personaje.");
      return;
    }

    setError("");
    setSuccess("");
    setIsSelecting(true);

    try {
      const response = await fetch(
        `${API_URL}/games/${gameId}/characters/select`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            characterId: selectedCharacterId,
          }),
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(
          data?.message ??
            `No se pudo seleccionar el personaje. Código: ${response.status}`
        );
        return;
      }

      setSuccess("Personaje seleccionado para esta partida.");
      await loadPage();
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setIsSelecting(false);
    }
  }

  async function removeCharacterFromGame(selection: GameCharacterSelection) {
    if (!gameId) return;

    const confirmed = window.confirm(
      `¿Quitar a ${selection.character.name} de esta partida? El personaje no se eliminará de la cuenta del jugador.`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");
    setRemovingSelectionId(selection.id);

    try {
      const response = await fetch(
        `${API_URL}/games/${gameId}/characters/${selection.id}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.message ?? "No se pudo quitar el personaje.");
        return;
      }

      setSuccess("Personaje quitado de la partida.");
      await loadPage();
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setRemovingSelectionId(null);
    }
  }

  function canRemoveSelection(selection: GameCharacterSelection) {
    if (!game || !currentUser) return false;

    const isDm = game.role === "DM";
    const isOwner = selection.userId === currentUser.id;

    return isDm || isOwner;
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        Cargando personajes de la partida...
      </main>
    );
  }

  if (!game) {
    return (
      <main className="min-h-screen bg-zinc-950 p-6 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-500/40 bg-red-500/10 p-6 text-red-200">
          {error || "No se pudo cargar la partida."}
        </div>
      </main>
    );
  }

  const isDm = game.role === "DM";

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-yellow-400">
            Initiative Forge
          </p>

          <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-black">
                Personajes de la partida
              </h1>

              <p className="mt-2 text-zinc-400">
                {game.name} · {isDm ? "Vista del DM" : "Selecciona tu personaje"}
              </p>

              {currentUser ? (
                <p className="mt-1 text-xs text-zinc-500">
                  Sesión: {currentUser.email}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href="/characters"
                className="rounded-xl border border-zinc-700 px-4 py-3 text-center font-semibold text-zinc-200 transition hover:bg-zinc-800"
              >
                Mis personajes
              </a>

              <a
                href={`/games/${game.id}`}
                className="rounded-xl border border-zinc-700 px-4 py-3 text-center font-semibold text-zinc-200 transition hover:bg-zinc-800"
              >
                Volver a partida
              </a>
            </div>
          </div>
        </header>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mb-6 rounded-2xl border border-green-500/40 bg-green-500/10 p-4 text-green-200">
            {success}
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <h2 className="text-2xl font-black">Tu personaje</h2>

            <p className="mt-2 text-sm text-zinc-400">
              Elige qué personaje usarás en esta partida.
            </p>

            {myCharacters.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-6 text-center">
                <p className="font-bold text-zinc-300">
                  No tienes personajes creados.
                </p>

                <p className="mt-2 text-sm text-zinc-500">
                  Crea un personaje primero para poder seleccionarlo.
                </p>

                <a
                  href="/characters"
                  className="mt-4 inline-block rounded-xl bg-yellow-500 px-4 py-3 font-bold text-zinc-950 transition hover:bg-yellow-400"
                >
                  Crear personaje
                </a>
              </div>
            ) : (
              <form onSubmit={selectCharacter} className="mt-6 space-y-4">
                <div>
                  <label
                    htmlFor="character-select"
                    className="mb-2 block text-sm font-bold text-zinc-200"
                  >
                    Personaje
                  </label>

                  <select
                    id="character-select"
                    value={selectedCharacterId}
                    onChange={(event) =>
                      setSelectedCharacterId(event.target.value)
                    }
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 font-semibold text-white outline-none transition focus:border-yellow-400"
                  >
                    <option value="">Selecciona un personaje</option>

                    {myCharacters.map((character) => (
                      <option key={character.id} value={character.id}>
                        {character.name} · Nivel {character.level}
                        {character.classId ? ` · ${character.classId}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isSelecting}
                  className="w-full rounded-xl bg-yellow-500 px-4 py-3 font-bold text-zinc-950 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSelecting
                    ? "Seleccionando..."
                    : "Usar este personaje en la partida"}
                </button>
              </form>
            )}
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <h2 className="text-2xl font-black">
              {isDm ? "Personajes seleccionados" : "Personajes de la partida"}
            </h2>

            <p className="mt-2 text-sm text-zinc-400">
              {isDm
                ? "Estos son los personajes que los jugadores han llevado a la partida."
                : "Aquí puedes ver los personajes activos de la partida."}
            </p>

            <div className="mt-6">
              {selectedCharacters.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-6 text-center">
                  <p className="font-bold text-zinc-300">
                    Aún no hay personajes seleccionados.
                  </p>

                  <p className="mt-2 text-sm text-zinc-500">
                    Cuando los jugadores seleccionen sus personajes, aparecerán
                    aquí.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {selectedCharacters.map((selection) => (
                    <article
                      key={selection.id}
                      className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-black text-white">
                            {selection.character.name}
                          </h3>

                          <p className="mt-1 text-sm text-zinc-400">
                            Nivel {selection.character.level}
                          </p>
                        </div>

                        <span className="rounded-full border border-yellow-500/40 bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-300">
                          Activo
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl bg-zinc-900 p-3">
                          <p className="text-zinc-500">Jugador</p>
                          <p className="font-bold text-zinc-200">
                            {selection.character.owner?.name ?? "Sin nombre"}
                          </p>
                        </div>

                        <div className="rounded-xl bg-zinc-900 p-3">
                          <p className="text-zinc-500">Clase</p>
                          <p className="font-bold text-zinc-200">
                            {selection.character.classId || "Sin definir"}
                          </p>
                        </div>

                        <div className="rounded-xl bg-zinc-900 p-3">
                          <p className="text-zinc-500">Raza</p>
                          <p className="font-bold text-zinc-200">
                            {selection.character.raceId || "Sin definir"}
                          </p>
                        </div>

                        <div className="rounded-xl bg-zinc-900 p-3">
                          <p className="text-zinc-500">Trasfondo</p>
                          <p className="font-bold text-zinc-200">
                            {selection.character.backgroundId || "Sin definir"}
                          </p>
                        </div>
                      </div>

                      {canRemoveSelection(selection) ? (
                        <button
                          type="button"
                          onClick={() => removeCharacterFromGame(selection)}
                          disabled={removingSelectionId === selection.id}
                          className="mt-4 w-full rounded-xl border border-red-500 px-4 py-3 font-bold text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {removingSelectionId === selection.id
                            ? "Quitando..."
                            : "Quitar de la partida"}
                        </button>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}