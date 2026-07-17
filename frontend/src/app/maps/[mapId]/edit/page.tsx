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
  const base =
    "flex aspect-square items-center justify-center transition hover:brightness-125";

  const styles: Record<TileType, string> = {
    floor:
      "m-1 rounded-md border border-zinc-700 bg-zinc-800 hover:bg-zinc-700",
    wall:
      "m-0 rounded-none border border-stone-600 bg-stone-500 hover:bg-stone-400",
    pit:
      "m-0 rounded-none border border-zinc-950 bg-zinc-950 hover:bg-zinc-900",
  };

  return `${base} ${styles[tile]}`;
}

export default function MapEditorPage() {
  const params = useParams<{ mapId: string }>();
  const mapId = params.mapId;

  const [map, setMap] = useState<BattleMap | null>(null);
  const [selectedTile, setSelectedTile] = useState<TileType>("floor");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    async function loadMap() {
      try {
        const response = await fetch(`${API_URL}/maps/${mapId}`, {
          credentials: "include",
        });

        const data = await response.json().catch(() => null);

        if (response.status === 401) {
          window.location.href = `/login?redirect=${encodeURIComponent(
            `/maps/${mapId}/edit`
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

  function paintTile(rowIndex: number, colIndex: number) {
    if (!map || map.role !== "DM") return;

    setSuccess("");

    setMap({
      ...map,
      gridData: {
        tiles: map.gridData.tiles.map((row, currentRow) =>
          row.map((tile, currentCol) =>
            currentRow === rowIndex && currentCol === colIndex
              ? selectedTile
              : tile
          )
        ),
      },
    });
  }

  async function saveMap() {
    if (!map) return;

    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const response = await fetch(`${API_URL}/maps/${map.id}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: map.name,
          gridData: map.gridData,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.message ?? "No se pudo guardar el mapa.");
        return;
      }

      setMap({
        ...map,
        name: data.map.name,
        gridData: data.map.gridData,
        isPublished: data.map.isPublished,
        isActive: data.map.isActive,
      });

      setSuccess("Mapa guardado. Sigue oculto hasta que lo reveles en combate.");
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteMap() {
    if (!map) return;

    const confirmed = window.confirm(
      `¿Eliminar el mapa "${map.name}"? Esta acción no se puede deshacer.`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");
    setIsDeleting(true);

    try {
      const response = await fetch(`${API_URL}/maps/${map.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.message ?? "No se pudo eliminar el mapa.");
        return;
      }

      window.location.href = `/games/${map.gameId}`;
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setIsDeleting(false);
    }
  }

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
              Editor de mapa
            </p>

            <input
              value={map.name}
              disabled={!isDm}
              onChange={(event) =>
                setMap({
                  ...map,
                  name: event.target.value,
                })
              }
              className="mt-2 w-full max-w-xl bg-transparent text-3xl font-black text-white outline-none disabled:cursor-not-allowed"
            />

            <p className="mt-2 text-zinc-400">
              {map.rows} filas × {map.cols} columnas ·{" "}
              {map.isActive
                ? "Activo en combate"
                : "Secreto hasta revelarlo en combate"}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href={`/games/${map.gameId}`}
              className="rounded-xl border border-zinc-700 px-4 py-3 text-center font-semibold text-zinc-200 transition hover:bg-zinc-800"
            >
              Volver
            </a>

            {isDm ? (
              <>
                <button
                  type="button"
                  onClick={saveMap}
                  disabled={isSaving || isDeleting}
                  className="rounded-xl bg-yellow-500 px-4 py-3 font-bold text-zinc-950 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Guardando..." : "Guardar"}
                </button>

                <button
                  type="button"
                  onClick={deleteMap}
                  disabled={isDeleting || isSaving}
                  className="rounded-xl border border-red-500 px-4 py-3 font-bold text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDeleting ? "Eliminando..." : "Eliminar mapa"}
                </button>
              </>
            ) : null}
          </div>
        </header>

        <section className="mb-6 rounded-3xl border border-zinc-800 bg-zinc-900 p-4 shadow-2xl">
          <div className="flex flex-wrap gap-3">
            {(["floor", "wall", "pit"] as TileType[]).map((tile) => (
              <button
                key={tile}
                type="button"
                disabled={!isDm}
                onClick={() => setSelectedTile(tile)}
                className={[
                  "rounded-xl border px-4 py-3 font-bold transition disabled:cursor-not-allowed disabled:opacity-50",
                  selectedTile === tile
                    ? "border-yellow-400 bg-yellow-500/20 text-yellow-300"
                    : "border-zinc-700 bg-zinc-950 text-zinc-300 hover:bg-zinc-800",
                ].join(" ")}
              >
                {tileLabels[tile]}
              </button>
            ))}
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="mt-4 rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-200">
              {success}
            </div>
          ) : null}
        </section>

        <section className="overflow-auto rounded-3xl border border-zinc-800 bg-zinc-900 p-4 shadow-2xl">
          <div
            className="grid min-w-max gap-0 rounded-2xl border border-zinc-800 bg-zinc-950 p-2"
            style={{
              gridTemplateColumns: `repeat(${map.cols}, minmax(32px, 44px))`,
            }}
          >
            {map.gridData.tiles.map((row, rowIndex) =>
              row.map((tile, colIndex) => (
                <button
                  key={`${rowIndex}-${colIndex}`}
                  type="button"
                  disabled={!isDm}
                  onClick={() => paintTile(rowIndex, colIndex)}
                  className={[
                    getTileClass(tile),
                    !isDm ? "cursor-default" : "",
                  ].join(" ")}
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