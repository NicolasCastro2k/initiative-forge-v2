"use client";

import { FormEvent, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function JoinGamePage() {
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanCode = inviteCode.trim().toUpperCase();

    setError("");
    setIsJoining(true);

    try {
      const response = await fetch(`${API_URL}/games/join`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inviteCode: cleanCode,
        }),
      });

      const data = await response.json().catch(() => null);

      if (response.status === 401) {
        window.location.href = `/login?redirect=${encodeURIComponent("/join")}`;
        return;
      }

      if (!response.ok) {
        setError(data?.message ?? "No se pudo unir a la partida.");
        return;
      }

      window.location.href = `/games/${data.game.id}`;
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setIsJoining(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-white">
      <div className="mx-auto max-w-3xl rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-yellow-400">
          Initiative Forge
        </p>

        <h1 className="mt-2 text-3xl font-black">Unirme a partida</h1>

        <p className="mt-2 text-zinc-400">
          Introduce el código de invitación que te compartió el Dungeon Master.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="inviteCode"
              className="mb-2 block text-sm font-semibold text-zinc-300"
            >
              Código de invitación
            </label>

            <input
              id="inviteCode"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-center text-2xl font-black uppercase tracking-[0.25em] text-yellow-400 outline-none transition placeholder:text-zinc-700 focus:border-yellow-400"
              placeholder="ABC123"
              maxLength={12}
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={isJoining}
              className="rounded-xl bg-yellow-500 px-5 py-3 font-bold text-zinc-950 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isJoining ? "Uniéndote..." : "Unirme"}
            </button>

            <a
              href="/dashboard"
              className="rounded-xl border border-zinc-700 px-5 py-3 text-center font-semibold text-zinc-200 transition hover:bg-zinc-800"
            >
              Cancelar
            </a>
          </div>
        </form>
      </div>
    </main>
  );
}