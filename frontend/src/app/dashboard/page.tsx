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

  useEffect(() => {
    async function loadDashboard() {
      try {
        const meResponse = await fetch(`${API_URL}/auth/me`, {
          credentials: "include",
        });

        if (!meResponse.ok) {
          window.location.href = "/login";
          return;
        }

        const meData = await meResponse.json();
        setUser(meData.user);

        const gamesResponse = await fetch(`${API_URL}/games`, {
          credentials: "include",
        });

        if (gamesResponse.ok) {
          const gamesData = await gamesResponse.json();
          setGames(gamesData.games ?? []);
        }
      } catch {
        window.location.href = "/login";
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

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        Cargando...
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-4 rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-yellow-400">
              Initiative Forge
            </p>

            <h1 className="mt-2 text-3xl font-black">
              Bienvenido, {user.name}
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
        </section>
      </div>
    </main>
  );
}