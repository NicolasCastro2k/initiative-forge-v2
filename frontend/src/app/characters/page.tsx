"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type ClassPreset = {
id: string;
name: string;
source: string;
description: string | null;
hitDie: number;
primaryAbilities: string[];
savingThrows: string[];
armorTraining: string[];
weaponTraining: string[];
toolTraining: string[];
skillChoices: string[];
skillChoiceCount: number;
spellcastingType: string;
spellcastingAbility: string | null;
isOfficial: boolean;
isSrd: boolean;
subclasses: SubclassPreset[];
features: ClassFeaturePreset[];
};

type SubclassPreset = {
id: string;
classPresetId: string;
name: string;
source: string;
description: string | null;
role: string | null;
strength: string | null;
isSrd: boolean;
features?: SubclassFeaturePreset[];
};

type ClassFeaturePreset = {
id: string;
classPresetId: string;
level: number;
name: string;
summary: string;
};

type SubclassFeaturePreset = {
id: string;
subclassPresetId: string;
level: number;
name: string;
summary: string;
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
};

function getImageUrl(path: string | null) {
if (!path) return "";
if (path.startsWith("http")) return path;
return `${API_URL}${path}`;
}

function getClassName(classes: ClassPreset[], classId: string | null) {
if (!classId) return "Sin clase";
return classes.find((item) => item.id === classId)?.name ?? classId;
}

function getSubclassName(classes: ClassPreset[], subclassId: string | null) {
if (!subclassId) return null;

for (const classPreset of classes) {
const subclass = classPreset.subclasses.find(
(item) => item.id === subclassId
);


if (subclass) {
  return subclass.name;
}


}

return subclassId;
}

export default function CharactersPage() {
const [characters, setCharacters] = useState<Character[]>([]);
const [classes, setClasses] = useState<ClassPreset[]>([]);

const [name, setName] = useState("");
const [raceId, setRaceId] = useState("");
const [classId, setClassId] = useState("");
const [backgroundId, setBackgroundId] = useState("");
const [level, setLevel] = useState(1);

const [error, setError] = useState("");
const [message, setMessage] = useState("");
const [isLoading, setIsLoading] = useState(true);
const [isCreating, setIsCreating] = useState(false);
const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

const selectedClass = useMemo(() => {
return classes.find((item) => item.id === classId) ?? null;
}, [classes, classId]);

useEffect(() => {
void loadInitialData();
}, []);

async function loadInitialData() {
setIsLoading(true);
setError("");


try {
  const [charactersResponse, classesResponse] = await Promise.all([
    fetch(`${API_URL}/characters`, {
      credentials: "include",
    }),
    fetch(`${API_URL}/presets/classes`, {
      credentials: "include",
    }),
  ]);

  const charactersData = await charactersResponse.json().catch(() => null);
  const classesData = await classesResponse.json().catch(() => null);

  if (charactersResponse.status === 401 || classesResponse.status === 401) {
    window.location.href = `/login?redirect=${encodeURIComponent(
      "/characters"
    )}`;
    return;
  }

  if (!charactersResponse.ok) {
    setError(
      charactersData?.message ?? "No se pudieron cargar los personajes."
    );
    return;
  }

  if (!classesResponse.ok) {
    setError(classesData?.message ?? "No se pudieron cargar las clases.");
    return;
  }

  setCharacters(
    Array.isArray(charactersData?.characters)
      ? charactersData.characters
      : []
  );

  setClasses(Array.isArray(classesData?.classes) ? classesData.classes : []);
} catch {
  setError("No se pudo conectar con el backend.");
} finally {
  setIsLoading(false);
}


}

async function createCharacter(event: FormEvent<HTMLFormElement>) {
event.preventDefault();


const cleanName = name.trim();

if (!cleanName) {
  setError("El nombre del personaje es obligatorio.");
  return;
}

if (!classId) {
  setError("Selecciona una clase para el personaje.");
  return;
}

setIsCreating(true);
setError("");
setMessage("");

const selectedClassPreset =
  classes.find((classPreset) => classPreset.id === classId) ?? null;

const cleanRace = raceId.trim();
const cleanBackground = backgroundId.trim();

const initialMaxHp = selectedClassPreset
  ? selectedClassPreset.hitDie + 2
  : 10;

const sheetData = {
  identity: {
    playerName: "",
    characterName: cleanName,
    className: selectedClassPreset?.name ?? "",
    subclassName: "",
    level,
    background: cleanBackground,
    race: cleanRace,
    alignment: "",
    experience: 0,
  },
  abilities: {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  },
  combat: {
    armorClass: 10,
    initiative: 0,
    speed: 30,
    maxHp: initialMaxHp,
    currentHp: initialMaxHp,
    temporaryHp: 0,
    hitDiceTotal: selectedClassPreset
      ? `1d${selectedClassPreset.hitDie}`
      : "1d8",
    hitDiceCurrent: selectedClassPreset
      ? `1d${selectedClassPreset.hitDie}`
      : "1d8",
  },
  attacks: [],
  equipment: [],
  currency: {
    cp: 0,
    sp: 0,
    ep: 0,
    gp: 0,
    pp: 0,
  },
  personality: {
    traits: "",
    ideals: "",
    bonds: "",
    flaws: "",
  },
  proficiencies: {
    proficiencyBonus: 2,
    languages: [],
    tools: selectedClassPreset?.toolTraining ?? [],
    armor: selectedClassPreset?.armorTraining ?? [],
    weapons: selectedClassPreset?.weaponTraining ?? [],
  },
  features: [
    ...(selectedClassPreset?.features
      ?.filter((feature) => feature.level <= level)
      .map((feature) => ({
        name: `${feature.name} (Nivel ${feature.level})`,
        description: feature.summary,
      })) ?? []),
  ],
  spells: {
    spellcastingClass:
      selectedClassPreset?.spellcastingType !== "NONE"
        ? selectedClassPreset?.name ?? ""
        : "",
    spellcastingAbility: selectedClassPreset?.spellcastingAbility ?? "",
    spellSaveDc: 0,
    spellAttackBonus: 0,
    cantrips: [],
    level1: [],
    level2: [],
    level3: [],
    level4: [],
    level5: [],
    level6: [],
    level7: [],
    level8: [],
    level9: [],
  },
  presets: {
    classPresetId: classId,
    subclassPresetId: null,
  },
};

try {
  const response = await fetch(`${API_URL}/characters`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: cleanName,
      raceId: cleanRace || null,
      classId,
      subclassId: null,
      backgroundId: cleanBackground || null,
      level,
      sheetData,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.character) {
    setError(data?.message ?? "No se pudo crear el personaje.");
    return;
  }

  const createdCharacter = data.character as Character;

  setCharacters((current) => [createdCharacter, ...current]);
  setName("");
  setRaceId("");
  setClassId("");
  setBackgroundId("");
  setLevel(1);
  setMessage("Personaje creado.");

  window.location.href = `/characters/${createdCharacter.id}`;
} catch {
  setError("No se pudo conectar con el backend.");
} finally {
  setIsCreating(false);
}


}

async function deleteCharacter(character: Character) {
const confirmed = window.confirm(
`¿Eliminar a ${character.name}? Esta acción no se puede deshacer.`
);


if (!confirmed) return;

setIsDeletingId(character.id);
setError("");
setMessage("");

try {
  const response = await fetch(`${API_URL}/characters/${character.id}`, {
    method: "DELETE",
    credentials: "include",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    setError(data?.message ?? "No se pudo eliminar el personaje.");
    return;
  }

  setCharacters((current) =>
    current.filter((item) => item.id !== character.id)
  );

  setMessage("Personaje eliminado.");
} catch {
  setError("No se pudo conectar con el backend.");
} finally {
  setIsDeletingId(null);
}


}

if (isLoading) {
return ( <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
Cargando personajes... </main>
);
}

return ( <main className="min-h-screen bg-zinc-950 p-6 text-white"> <div className="mx-auto max-w-6xl"> <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl lg:flex-row lg:items-center lg:justify-between"> <div> <p className="text-sm font-semibold uppercase tracking-[0.3em] text-yellow-400">
Initiative Forge </p>


        <h1 className="mt-2 text-3xl font-black">Mis personajes</h1>

        <p className="mt-2 text-zinc-400">
          Crea personajes usando presets de clases. La subclase se elige
          después, cuando el personaje alcanza el nivel correspondiente.
        </p>
      </div>

      <a
        href="/dashboard"
        className="rounded-xl border border-zinc-700 px-5 py-3 text-center font-semibold text-zinc-200 transition hover:bg-zinc-800"
      >
        Volver al dashboard
      </a>
    </header>

    {error ? (
      <div className="mb-6 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">
        {error}
      </div>
    ) : null}

    {message ? (
      <div className="mb-6 rounded-2xl border border-green-500/40 bg-green-500/10 p-4 text-green-200">
        {message}
      </div>
    ) : null}

    <section className="mb-6 rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
      <h2 className="text-xl font-black">Crear personaje</h2>

      <p className="mt-2 text-sm text-zinc-400">
        Al crear el personaje solo eliges la clase base. Las subclases se
        desbloquean desde la ficha al subir de nivel.
      </p>

      <form onSubmit={createCharacter} className="mt-4 grid gap-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_120px]">
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-zinc-300">
              Nombre
            </span>

            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none transition focus:border-yellow-400"
              placeholder="Ej: Zane"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-bold text-zinc-300">
              Raza / Linaje
            </span>

            <input
              value={raceId}
              onChange={(event) => setRaceId(event.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none transition focus:border-yellow-400"
              placeholder="Ej: Half-Elf"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-bold text-zinc-300">
              Trasfondo
            </span>

            <input
              value={backgroundId}
              onChange={(event) => setBackgroundId(event.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none transition focus:border-yellow-400"
              placeholder="Ej: Criminal"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-bold text-zinc-300">
              Nivel inicial
            </span>

            <input
              type="number"
              min={1}
              max={20}
              value={level}
              onChange={(event) => {
                const value = Number(event.target.value);
                setLevel(Number.isFinite(value) ? value : 1);
              }}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none transition focus:border-yellow-400"
            />
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-zinc-300">
              Clase inicial
            </span>

            <select
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none transition focus:border-yellow-400"
            >
              <option value="">Selecciona una clase</option>

              {classes.map((classPreset) => (
                <option key={classPreset.id} value={classPreset.id}>
                  {classPreset.name}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            disabled={isCreating}
            className="self-end rounded-xl bg-yellow-500 px-5 py-3 font-bold text-zinc-950 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCreating ? "Creando..." : "Crear"}
          </button>
        </div>

        {selectedClass ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Clase
                </p>
                <p className="mt-1 font-black text-yellow-300">
                  {selectedClass.name}
                </p>
                <p className="mt-1 text-sm text-zinc-400">
                  Dado de golpe: d{selectedClass.hitDie}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Características
                </p>
                <p className="mt-1 text-sm text-zinc-300">
                  {selectedClass.primaryAbilities.join(", ") || "N/A"}
                </p>

                <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Salvaciones
                </p>
                <p className="mt-1 text-sm text-zinc-300">
                  {selectedClass.savingThrows.join(", ") || "N/A"}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Magia
                </p>
                <p className="mt-1 text-sm text-zinc-300">
                  {selectedClass.spellcastingType}
                </p>

                <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Atributo mágico
                </p>
                <p className="mt-1 text-sm text-zinc-300">
                  {selectedClass.spellcastingAbility ?? "N/A"}
                </p>
              </div>
            </div>

            {selectedClass.description ? (
              <p className="mt-4 text-sm text-zinc-400">
                {selectedClass.description}
              </p>
            ) : null}

            {selectedClass.subclasses.length > 0 ? (
              <p className="mt-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-200">
                Esta clase tiene {selectedClass.subclasses.length}{" "}
                subclase(s) disponibles, pero se elegirán después desde la
                ficha cuando el nivel lo permita.
              </p>
            ) : null}
          </div>
        ) : null}
      </form>
    </section>

    <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
      <h2 className="text-xl font-black">Personajes guardados</h2>

      <p className="mt-2 text-sm text-zinc-400">
        Entra a la ficha para editar atributos, combate, equipo, rasgos,
        conjuros y subir imagen/token.
      </p>

      {characters.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-6 text-center">
          <p className="font-bold text-zinc-200">
            Todavía no tienes personajes.
          </p>

          <p className="mt-2 text-sm text-zinc-500">
            Crea uno para luego seleccionarlo en una partida.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {characters.map((character) => {
            const className = getClassName(classes, character.classId);
            const subclassName = getSubclassName(
              classes,
              character.subclassId
            );

            return (
              <article
                key={character.id}
                className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 shadow-xl"
              >
                <div className="h-48 bg-zinc-900">
                  {character.portraitImagePath ? (
                    <img
                      src={getImageUrl(character.portraitImagePath)}
                      alt={character.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-6xl font-black text-zinc-700">
                      {character.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-black">
                        {character.name}
                      </h3>

                      <p className="mt-1 text-sm text-zinc-400">
                        Nivel {character.level} ·{" "}
                        {character.raceId || "Sin raza"} · {className}
                      </p>

                      {subclassName ? (
                        <p className="mt-1 text-sm text-yellow-300">
                          {subclassName}
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-zinc-500">
                          Sin subclase elegida
                        </p>
                      )}
                    </div>

                    {character.tokenImagePath ? (
                      <span className="rounded-full border border-green-500/40 bg-green-500/10 px-3 py-1 text-xs font-bold text-green-300">
                        Token
                      </span>
                    ) : (
                      <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-bold text-zinc-400">
                        Sin token
                      </span>
                    )}
                  </div>

                  <div className="mt-5 grid gap-3">
                    <a
                      href={`/characters/${character.id}`}
                      className="block rounded-xl bg-yellow-500 px-4 py-3 text-center font-bold text-zinc-950 transition hover:bg-yellow-400"
                    >
                      Editar ficha
                    </a>

                    <button
                      type="button"
                      onClick={() => void deleteCharacter(character)}
                      disabled={isDeletingId === character.id}
                      className="rounded-xl border border-red-500 px-4 py-3 font-bold text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isDeletingId === character.id
                        ? "Eliminando..."
                        : "Eliminar"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  </div>
</main>


);
}
