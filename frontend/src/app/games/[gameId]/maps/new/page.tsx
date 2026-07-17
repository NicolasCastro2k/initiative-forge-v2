"use client";

import { FormEvent, useState } from "react";
import { useParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function NewBattleMapPage() {
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId;

  const [name, setName] = useState("Mapa de combate");
  const [rows, setRows] = useState(10);
  const [cols, setCols] = useState(10);
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setIsCreating(true);

    try {
      const response = await fetch(`${API_URL}/games/${gameId}/maps`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          rows,
          cols,
        }),
      });

      const data = await response.json().catch(() => null);

      if (response.status === 401) {
        window.location.href = `/login?redirect=${encodeURIComponent(
          `/games/${gameId}/maps/new`
        )}`;
        return;
      }

      if (!response.ok) {
        setError(data?.message ?? "No se pudo crear el mapa.");
        return;
      }

      window.location.href = `/maps/${data.map.id}/edit`;
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-white">
      <div className="mx-auto max-w-3xl rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-yellow-400">
          Initiative Forge
        </p>

        <h1 className="mt-2 text-3xl font-black">Crear mapa de combate</h1>

        <p className="mt-2 text-zinc-400">
          Define el tamaño del mapa. Luego podrás pintar suelo, paredes y agujeros.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="name"
              className="mb-2 block text-sm font-semibold text-zinc-300"
            >
              Nombre del mapa
            </label>

            <input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="rows"
                className="mb-2 block text-sm font-semibold text-zinc-300"
              >
                Filas
              </label>

              <input
                id="rows"
                type="number"
                min={3}
                max={50}
                value={rows}
                onChange={(event) => setRows(Number(event.target.value))}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
              />
            </div>

            <div>
              <label
                htmlFor="cols"
                className="mb-2 block text-sm font-semibold text-zinc-300"
              >
                Columnas
              </label>

              <input
                id="cols"
                type="number"
                min={3}
                max={50}
                value={cols}
                onChange={(event) => setCols(Number(event.target.value))}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
              />
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={isCreating}
              className="rounded-xl bg-yellow-500 px-5 py-3 font-bold text-zinc-950 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreating ? "Creando..." : "Crear mapa"}
            </button>

            <a
              href={`/games/${gameId}`}
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