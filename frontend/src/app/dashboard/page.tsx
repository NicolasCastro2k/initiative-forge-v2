"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type User = {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
};

type GameSummary = {
  id: string;
  name: string;
  description: string | null;
  inviteCode: string;
  role: "DM" | "PLAYER";
  memberCount: number;
  createdAt: string;
  dm: {
    id: string;
    name: string;
    email: string;
  };
};

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      try {
        // Antes se esperaba /auth/me y RECIÉN DESPUÉS se pedía /games (dos
        // round-trips en serie). Ambas piden lo mismo (la cookie de sesión),
        // así que no dependen una de la otra: se piden en paralelo.
        const [meResponse, gamesResponse] = await Promise.all([
          fetch(`${API_URL}/auth/me`, { credentials: "include", cache: "no-store" }),
          fetch(`${API_URL}/games`, { credentials: "include" }),
        ]);

        // Solo un 401/403 en /auth/me significa "sesión inválida". Cualquier
        // otro problema (500, timeout, red) NO es un tema de sesión y no debe
        // mandar al usuario de vuelta al login silenciosamente — antes,
        // cualquier excepción en este bloque (incluida una respuesta de
        // /games que no fuera JSON válido) terminaba en el mismo catch de
        // abajo y lo devolvía al login sin dejar rastro del error real.
        if (meResponse.status === 401 || meResponse.status === 403) {
          window.location.href = "/login";
          return;
        }

        if (!meResponse.ok) {
          console.error("Error inesperado en /auth/me:", meResponse.status);
          setError(`No se pudo verificar la sesión (código ${meResponse.status}). Probá recargar la página.`);
          return;
        }

        const meData = await meResponse.json();
        setUser(meData.user);

        if (gamesResponse.ok) {
          const gamesData = await gamesResponse.json();
          setGames(gamesData.games ?? []);
        } else {
          console.error("Error al cargar /games:", gamesResponse.status);
          setError(`No se pudieron cargar tus partidas (código ${gamesResponse.status}). Probá recargar la página.`);
        }
      } catch (err) {
        console.error("Error inesperado cargando el dashboard:", err);
        setError("No se pudo conectar con el backend. Probá recargar la página.");
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboard();
  }, []);

  async function logout() {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });

    window.location.href = "/login";
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-950 text-white">
      {/* Fondo — un único elemento que vive durante todo el ciclo de vida
          de la página, para que no se desmonte/remonte (y "parpadee")
          al pasar de isLoading a con datos. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-100"
        style={{
          backgroundImage: "url('/backgrounds/dashboard-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/10 via-zinc-950/10 to-zinc-950/10" />

      <div className="relative z-10">
        {isLoading ? (
          <div className="flex min-h-screen items-center justify-center">Cargando...</div>
        ) : error ? (
          <div className="flex min-h-screen items-center justify-center p-6">
            <div className="max-w-md rounded-3xl border border-red-500/40 bg-zinc-900 p-6 text-center shadow-2xl">
              <p className="text-lg font-bold text-red-300">Algo salió mal</p>
              <p className="mt-2 text-sm text-zinc-400">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 rounded-xl bg-yellow-500 px-5 py-3 font-bold text-zinc-950 transition hover:bg-yellow-400"
              >
                Recargar
              </button>
            </div>
          </div>
        ) : !user ? null : (
          <div className="mx-auto max-w-6xl p-6">
            <header className="mb-8 flex flex-col gap-4 rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-yellow-400">
                  Initiative Forge
                </p>

                <h1 className="mt-2 text-3xl font-black">
                  Te doy la bienvenida, {user.name}
                </h1>

                <p className="mt-1 text-zinc-400">Cuenta activa: {user.email}</p>

                {user.isAdmin ? (
                  <p className="mt-2 inline-flex rounded-full border border-yellow-500/40 bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-300">
                    Administrador del sistema
                  </p>
                ) : null}
              </div>

              <button
                onClick={logout}
                className="rounded-xl border border-zinc-700 px-4 py-3 font-semibold text-zinc-200 transition hover:bg-zinc-800"
              >
                Cerrar sesión
              </button>
            </header>

            <section className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-black">Mis partidas</h2>
                  <p className="mt-1 text-zinc-400">
                    Crea una mesa o únete a una partida usando un código de
                    invitación.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <a
                    href="/games/new"
                    className="rounded-xl bg-yellow-500 px-5 py-3 text-center font-bold text-zinc-950 transition hover:bg-yellow-400"
                  >
                    Crear partida
                  </a>

                  <a
                    href="/join"
                    className="rounded-xl border border-zinc-700 px-5 py-3 text-center font-bold text-zinc-200 transition hover:bg-zinc-800"
                  >
                    Unirme con código
                  </a>
                </div>
              </div>

              <div className="mt-6">
                {games.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-8 text-center">
                    <p className="text-lg font-bold text-zinc-300">
                      No tienes partidas activas
                    </p>
                    <p className="mt-2 text-sm text-zinc-500">
                      Cuando crees una partida o te unas a una, aparecerá aquí.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {games.map((game) => (
                      <a
                        key={game.id}
                        href={`/games/${game.id}`}
                        className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 transition hover:border-yellow-400 hover:bg-yellow-500/10"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="text-xl font-black text-white">
                              {game.name}
                            </h3>
                            <p className="mt-1 text-sm text-zinc-400">
                              DM: {game.dm.name}
                            </p>
                          </div>

                          <span className="rounded-full border border-yellow-500/40 bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-300">
                            {game.role === "DM" ? "DM" : "Jugador"}
                          </span>
                        </div>

                        {game.description ? (
                          <p className="mt-3 text-sm text-zinc-400">
                            {game.description}
                          </p>
                        ) : null}

                        <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-500">
                          <span>{game.memberCount} miembros</span>
                          <span>·</span>
                          <span>Código: {game.inviteCode}</span>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <a
                href="/games/new"
                className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-yellow-400 hover:bg-yellow-500/10"
              >
                <h2 className="text-xl font-black text-white">Crear partida</h2>
                <p className="mt-2 text-zinc-400">
                  Crea una nueva mesa. Serás el Dungeon Master de esa partida.
                </p>
              </a>

              <a
                href="/join"
                className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-yellow-400 hover:bg-yellow-500/10"
              >
                <h2 className="text-xl font-black text-white">Unirme a partida</h2>
                <p className="mt-2 text-zinc-400">
                  Usa un código de invitación para entrar a una mesa.
                </p>
              </a>

              <a
                href="/characters"
                className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-yellow-400 hover:bg-yellow-500/10"
              >
                <h2 className="text-xl font-black text-white">Mis personajes</h2>
                <p className="mt-2 text-zinc-400">
                  Crea y administra tus fichas de personaje.
                </p>
              </a>

              {user.isAdmin ? (
                <a
                  href="/admin/users"
                  className="rounded-3xl border border-yellow-500/40 bg-yellow-500/10 p-6 transition hover:border-yellow-400 hover:bg-yellow-500/20"
                >
                  <h2 className="text-xl font-black text-white">
                    Administrar usuarios
                  </h2>
                  <p className="mt-2 text-zinc-300">
                    Crear cuentas cerradas para tus amigos.
                  </p>
                </a>
              ) : null}

              {user.isAdmin ? (
                <a
                  href="/admin/weapons"
                  className="rounded-3xl border border-yellow-500/40 bg-yellow-500/10 p-6 transition hover:border-yellow-400 hover:bg-yellow-500/20"
                >
                  <h2 className="text-xl font-black text-white">
                    Administrar armas
                  </h2>
                  <p className="mt-2 text-zinc-300">
                    Agregar, editar o eliminar armas del catálogo.
                  </p>
                </a>
              ) : null}

              {user.isAdmin ? (
                <a
                  href="/admin/spells"
                  className="rounded-3xl border border-yellow-500/40 bg-yellow-500/10 p-6 transition hover:border-yellow-400 hover:bg-yellow-500/20"
                >
                  <h2 className="text-xl font-black text-white">
                    Administrar hechizos
                  </h2>
                  <p className="mt-2 text-zinc-300">
                    Agregar, editar o eliminar hechizos del catálogo.
                  </p>
                </a>
              ) : null}

              {user.isAdmin ? (
                <a
                  href="/admin/races"
                  className="rounded-3xl border border-yellow-500/40 bg-yellow-500/10 p-6 transition hover:border-yellow-400 hover:bg-yellow-500/20"
                >
                  <h2 className="text-xl font-black text-white">
                    Administrar razas
                  </h2>
                  <p className="mt-2 text-zinc-300">
                    Agregar, editar o eliminar razas del catálogo.
                  </p>
                </a>
              ) : null}

              {user.isAdmin ? (
                <a
                  href="/admin/beasts"
                  className="rounded-3xl border border-yellow-500/40 bg-yellow-500/10 p-6 transition hover:border-yellow-400 hover:bg-yellow-500/20"
                >
                  <h2 className="text-xl font-black text-white">
                    Administrar bestias
                  </h2>
                  <p className="mt-2 text-zinc-300">
                    Agregar, editar o eliminar bestias de Forma Salvaje.
                  </p>
                </a>
              ) : null}

              {user.isAdmin ? (
                <a
                  href="/admin/monsters"
                  className="rounded-3xl border border-yellow-500/40 bg-yellow-500/10 p-6 transition hover:border-yellow-400 hover:bg-yellow-500/20"
                >
                  <h2 className="text-xl font-black text-white">
                    Administrar monstruos
                  </h2>
                  <p className="mt-2 text-zinc-300">
                    Catálogo de enemigos con token para el tablero de combate.
                  </p>
                </a>
              ) : null}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

