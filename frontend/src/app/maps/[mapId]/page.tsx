"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type TileType = "floor" | "wall" | "pit";

type BattleMap = {
  id: string;
  gameId: string;
  name: string;
  rows: number;
  cols: number;
  gridData: {
    tiles: TileType[][];
  };
  isPublished: boolean;
  isActive: boolean;
  role: "DM" | "PLAYER";
};

const tileLabels: Record<TileType, string> = {
  floor: "Suelo",
  wall: "Pared",
  pit: "Agujero",
};

function getTileClass(tile: TileType) {
  const base = "flex aspect-square items-center justify-center transition";

  const styles: Record<TileType, string> = {
    floor: "m-1 rounded-md border border-zinc-700 bg-zinc-800",
    wall: "m-0 rounded-none border border-stone-600 bg-stone-500",
    pit: "m-0 rounded-none border border-zinc-950 bg-zinc-950",
  };

  return `${base} ${styles[tile]}`;
}

export default function MapViewPage() {
  const params = useParams<{ mapId: string }>();
  const mapId = params.mapId;

  const [map, setMap] = useState<BattleMap | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadMap() {
      if (!mapId) return;

      try {
        const response = await fetch(`${API_URL}/maps/${mapId}`, {
          credentials: "include",
        });

        const data = await response.json().catch(() => null);

        if (response.status === 401) {
          window.location.href = `/login?redirect=${encodeURIComponent(
            `/maps/${mapId}`
          )}`;
          return;
        }

        if (!response.ok) {
          setError(data?.message ?? "No se pudo cargar el mapa.");
          return;
        }

        setMap(data.map);
      } catch {
        setError("No se pudo conectar con el backend.");
      } finally {
        setIsLoading(false);
      }
    }

    loadMap();
  }, [mapId]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        Cargando mapa...
      </main>
    );
  }

  if (error && !map) {
    return (
      <main className="min-h-screen bg-zinc-950 p-6 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-500/40 bg-red-500/10 p-6 text-red-200">
          {error}
        </div>
      </main>
    );
  }

  if (!map) return null;

  const isDm = map.role === "DM";

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-yellow-400">
              Mapa
            </p>

            <h1 className="mt-2 text-3xl font-black text-white">
              {map.name}
            </h1>

            <p className="mt-2 text-zinc-400">
              {map.rows} filas × {map.cols} columnas ·{" "}
              {map.isActive ? "Activo en combate" : "Secreto"}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href={`/games/${map.gameId}`}
              className="rounded-xl border border-zinc-700 px-4 py-3 text-center font-semibold text-zinc-200 transition hover:bg-zinc-800"
            >
              Volver a la partida
            </a>

            {isDm ? (
              <a
                href={`/maps/${map.id}/edit`}
                className="rounded-xl bg-yellow-500 px-4 py-3 text-center font-bold text-zinc-950 transition hover:bg-yellow-400"
              >
                Editar mapa
              </a>
            ) : null}
          </div>
        </header>

        <section className="overflow-auto rounded-3xl border border-zinc-800 bg-zinc-900 p-4 shadow-2xl">
          <div
            className="grid min-w-max gap-0 rounded-2xl border border-zinc-800 bg-zinc-950 p-2"
            style={{
              gridTemplateColumns: `repeat(${map.cols}, minmax(32px, 44px))`,
            }}
          >
            {map.gridData.tiles.map((row, rowIndex) =>
              row.map((tile, colIndex) => (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className={getTileClass(tile)}
                  title={`${rowIndex},${colIndex} · ${tileLabels[tile]}`}
                  aria-label={`${rowIndex},${colIndex} · ${tileLabels[tile]}`}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
