"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type AbilityKey =
  | "strength"
  | "dexterity"
  | "constitution"
  | "intelligence"
  | "wisdom"
  | "charisma";

type Attack = {
  name: string;
  attackBonus: string;
  damage: string;
};

type EquipmentItem = {
  quantity: number;
  name: string;
};

type FeatureItem = {
  name: string;
  description: string;
};

type SheetData = {
  identity: {
    playerName: string;
    characterName: string;
    className: string;
    subclassName: string;
    level: number;
    background: string;
    race: string;
    alignment: string;
    experience: number;
  };
  abilities: Record<AbilityKey, number>;
  combat: {
    armorClass: number;
    initiative: number;
    speed: number;
    maxHp: number;
    currentHp: number;
    temporaryHp: number;
    hitDiceTotal: string;
    hitDiceCurrent: string;
  };
  attacks: Attack[];
  equipment: EquipmentItem[];
  currency: {
    cp: number;
    sp: number;
    ep: number;
    gp: number;
    pp: number;
  };
  personality: {
    traits: string;
    ideals: string;
    bonds: string;
    flaws: string;
  };
  proficiencies: {
    proficiencyBonus: number;
    languages: string[];
    tools: string[];
    armor: string[];
    weapons: string[];
  };
  features: FeatureItem[];
  spells: {
    spellcastingClass: string;
    spellcastingAbility: string;
    spellSaveDc: number;
    spellAttackBonus: number;
    cantrips: string[];
    level1: string[];
    level2: string[];
    level3: string[];
    level4: string[];
    level5: string[];
    level6: string[];
    level7: string[];
    level8: string[];
    level9: string[];
  };
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

const abilityLabels: Array<{
  key: AbilityKey;
  label: string;
  short: string;
}> = [
  { key: "strength", label: "Fuerza", short: "FUE" },
  { key: "dexterity", label: "Destreza", short: "DES" },
  { key: "constitution", label: "Constitución", short: "CON" },
  { key: "intelligence", label: "Inteligencia", short: "INT" },
  { key: "wisdom", label: "Sabiduría", short: "SAB" },
  { key: "charisma", label: "Carisma", short: "CAR" },
];

function getDefaultSheetData(characterName: string): SheetData {
  return {
    identity: {
      playerName: "",
      characterName,
      className: "",
      subclassName: "",
      level: 1,
      background: "",
      race: "",
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
      maxHp: 10,
      currentHp: 10,
      temporaryHp: 0,
      hitDiceTotal: "1d8",
      hitDiceCurrent: "1d8",
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
      tools: [],
      armor: [],
      weapons: [],
    },
    features: [],
    spells: {
      spellcastingClass: "",
      spellcastingAbility: "",
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
  };
}

function normalizeSheetData(value: unknown, characterName: string): SheetData {
  const defaults = getDefaultSheetData(characterName);

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaults;
  }

  const raw = value as Partial<SheetData>;

  return {
    identity: {
      ...defaults.identity,
      ...(raw.identity ?? {}),
      characterName: raw.identity?.characterName || characterName,
    },
    abilities: {
      ...defaults.abilities,
      ...(raw.abilities ?? {}),
    },
    combat: {
      ...defaults.combat,
      ...(raw.combat ?? {}),
    },
    attacks: Array.isArray(raw.attacks) ? raw.attacks : [],
    equipment: Array.isArray(raw.equipment) ? raw.equipment : [],
    currency: {
      ...defaults.currency,
      ...(raw.currency ?? {}),
    },
    personality: {
      ...defaults.personality,
      ...(raw.personality ?? {}),
    },
    proficiencies: {
      ...defaults.proficiencies,
      ...(raw.proficiencies ?? {}),
      languages: Array.isArray(raw.proficiencies?.languages)
        ? raw.proficiencies.languages
        : [],
      tools: Array.isArray(raw.proficiencies?.tools)
        ? raw.proficiencies.tools
        : [],
      armor: Array.isArray(raw.proficiencies?.armor)
        ? raw.proficiencies.armor
        : [],
      weapons: Array.isArray(raw.proficiencies?.weapons)
        ? raw.proficiencies.weapons
        : [],
    },
    features: Array.isArray(raw.features) ? raw.features : [],
    spells: {
      ...defaults.spells,
      ...(raw.spells ?? {}),
      cantrips: Array.isArray(raw.spells?.cantrips) ? raw.spells.cantrips : [],
      level1: Array.isArray(raw.spells?.level1) ? raw.spells.level1 : [],
      level2: Array.isArray(raw.spells?.level2) ? raw.spells.level2 : [],
      level3: Array.isArray(raw.spells?.level3) ? raw.spells.level3 : [],
      level4: Array.isArray(raw.spells?.level4) ? raw.spells.level4 : [],
      level5: Array.isArray(raw.spells?.level5) ? raw.spells.level5 : [],
      level6: Array.isArray(raw.spells?.level6) ? raw.spells.level6 : [],
      level7: Array.isArray(raw.spells?.level7) ? raw.spells.level7 : [],
      level8: Array.isArray(raw.spells?.level8) ? raw.spells.level8 : [],
      level9: Array.isArray(raw.spells?.level9) ? raw.spells.level9 : [],
    },
  };
}

function getImageUrl(path: string | null) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_URL}${path}`;
}

function getModifier(score: number) {
  return Math.floor((score - 10) / 2);
}

function signed(value: number) {
  return value >= 0 ? `+${value}` : String(value);
}

function splitLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function joinLines(value: string[]) {
  return value.join("\n");
}

export default function CharacterSheetPage() {
  const params = useParams<{ characterId: string }>();
  const characterId = params.characterId;

  const [character, setCharacter] = useState<Character | null>(null);
  const [sheetData, setSheetData] = useState<SheetData>(
    getDefaultSheetData("")
  );

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const passivePerception = useMemo(() => {
    return 10 + getModifier(sheetData.abilities.wisdom);
  }, [sheetData.abilities.wisdom]);

  useEffect(() => {
    void loadCharacter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId]);

  async function loadCharacter() {
    if (!characterId) return;

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/characters/${characterId}`, {
        credentials: "include",
      });

      const data = await response.json().catch(() => null);

      if (response.status === 401) {
        window.location.href = `/login?redirect=${encodeURIComponent(
          `/characters/${characterId}`
        )}`;
        return;
      }

      if (!response.ok || !data?.character) {
        setError(data?.message ?? "No se pudo cargar el personaje.");
        return;
      }

      const loadedCharacter = data.character as Character;

      setCharacter(loadedCharacter);
      setSheetData(
        normalizeSheetData(loadedCharacter.sheetData, loadedCharacter.name)
      );
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setIsLoading(false);
    }
  }

  function updateSheetData(nextSheetData: SheetData) {
    setSheetData(nextSheetData);
  }

  async function saveCharacter() {
    if (!character || !characterId) return;

    setIsSaving(true);
    setError("");
    setMessage("");

    const characterName =
      sheetData.identity.characterName.trim() || character.name;

    const nextSheetData: SheetData = {
      ...sheetData,
      identity: {
        ...sheetData.identity,
        characterName,
      },
    };

    try {
      const response = await fetch(`${API_URL}/characters/${characterId}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: characterName,
          raceId: nextSheetData.identity.race || null,
          classId: nextSheetData.identity.className || null,
          subclassId: nextSheetData.identity.subclassName || null,
          backgroundId: nextSheetData.identity.background || null,
          level: nextSheetData.identity.level,
          sheetData: nextSheetData,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.character) {
        setError(data?.message ?? "No se pudo guardar la ficha.");
        return;
      }

      const updatedCharacter = data.character as Character;

      setCharacter(updatedCharacter);
      setSheetData(
        normalizeSheetData(updatedCharacter.sheetData, updatedCharacter.name)
      );
      setMessage("Ficha guardada correctamente.");
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setIsSaving(false);
    }
  }

  async function uploadImage(file: File | null) {
    if (!file || !characterId) return;

    setIsUploadingImage(true);
    setError("");
    setMessage("");

    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await fetch(
        `${API_URL}/characters/${characterId}/image`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.character) {
        setError(data?.message ?? "No se pudo subir la imagen.");
        return;
      }

      setCharacter(data.character as Character);
      setMessage("Imagen actualizada. Esta imagen será usada como token.");
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setIsUploadingImage(false);
    }
  }

  function addAttack() {
    updateSheetData({
      ...sheetData,
      attacks: [
        ...sheetData.attacks,
        {
          name: "",
          attackBonus: "",
          damage: "",
        },
      ],
    });
  }

  function removeAttack(index: number) {
    updateSheetData({
      ...sheetData,
      attacks: sheetData.attacks.filter((_, attackIndex) => attackIndex !== index),
    });
  }

  function addEquipment() {
    updateSheetData({
      ...sheetData,
      equipment: [
        ...sheetData.equipment,
        {
          quantity: 1,
          name: "",
        },
      ],
    });
  }

  function removeEquipment(index: number) {
    updateSheetData({
      ...sheetData,
      equipment: sheetData.equipment.filter(
        (_, itemIndex) => itemIndex !== index
      ),
    });
  }

  function addFeature() {
    updateSheetData({
      ...sheetData,
      features: [
        ...sheetData.features,
        {
          name: "",
          description: "",
        },
      ],
    });
  }

  function removeFeature(index: number) {
    updateSheetData({
      ...sheetData,
      features: sheetData.features.filter(
        (_, featureIndex) => featureIndex !== index
      ),
    });
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        Cargando ficha...
      </main>
    );
  }

  if (error && !character) {
    return (
      <main className="min-h-screen bg-zinc-950 p-6 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-500/40 bg-red-500/10 p-6 text-red-200">
          {error}
        </div>
      </main>
    );
  }

  if (!character) return null;

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-yellow-400">
              Ficha editable
            </p>

            <h1 className="mt-2 text-3xl font-black">
              {sheetData.identity.characterName || character.name}
            </h1>

            <p className="mt-2 text-zinc-400">
              Nivel {sheetData.identity.level} ·{" "}
              {sheetData.identity.race || "Sin raza"} ·{" "}
              {sheetData.identity.className || "Sin clase"}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => void saveCharacter()}
              disabled={isSaving}
              className="rounded-xl bg-yellow-500 px-5 py-3 font-bold text-zinc-950 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Guardando..." : "Guardar ficha"}
            </button>

            <a
              href="/characters"
              className="rounded-xl border border-zinc-700 px-5 py-3 text-center font-semibold text-zinc-200 transition hover:bg-zinc-800"
            >
              Volver a personajes
            </a>
          </div>
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

        <section className="grid gap-6 xl:grid-cols-[300px_1fr]">
          <aside className="space-y-6">
            <Card title="Foto / Token">
              <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950">
                {character.portraitImagePath ? (
                  <img
                    src={getImageUrl(character.portraitImagePath)}
                    alt={character.name}
                    className="h-72 w-full object-cover"
                  />
                ) : (
                  <div className="grid h-72 place-items-center text-6xl font-black text-zinc-700">
                    {character.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>

              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-bold text-zinc-300">
                  Subir imagen
                </span>

                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  disabled={isUploadingImage}
                  onChange={(event) => {
                    void uploadImage(event.target.files?.[0] ?? null);
                    event.currentTarget.value = "";
                  }}
                  className="block w-full cursor-pointer rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-yellow-500 file:px-3 file:py-2 file:font-bold file:text-zinc-950"
                />
              </label>

              <p className="mt-3 text-xs text-zinc-500">
                Esta imagen se guarda como retrato y también como token de
                combate.
              </p>
            </Card>

            <Card title="Atributos">
              <div className="space-y-3">
                {abilityLabels.map((ability) => {
                  const score = sheetData.abilities[ability.key];

                  return (
                    <div
                      key={ability.key}
                      className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                            {ability.short}
                          </p>
                          <p className="font-bold">{ability.label}</p>
                        </div>

                        <p className="text-2xl font-black text-yellow-300">
                          {signed(getModifier(score))}
                        </p>
                      </div>

                      <input
                        type="number"
                        value={score}
                        onChange={(event) =>
                          updateSheetData({
                            ...sheetData,
                            abilities: {
                              ...sheetData.abilities,
                              [ability.key]: Number(event.target.value),
                            },
                          })
                        }
                        className="mt-3 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-center font-bold outline-none transition focus:border-yellow-400"
                      />
                    </div>
                  );
                })}
              </div>
            </Card>
          </aside>

          <div className="space-y-6">
            <Card title="Identidad">
              <div className="grid gap-4 md:grid-cols-3">
                <TextField
                  label="Nombre"
                  value={sheetData.identity.characterName}
                  onChange={(value) =>
                    updateSheetData({
                      ...sheetData,
                      identity: {
                        ...sheetData.identity,
                        characterName: value,
                      },
                    })
                  }
                />

                <TextField
                  label="Jugador"
                  value={sheetData.identity.playerName}
                  onChange={(value) =>
                    updateSheetData({
                      ...sheetData,
                      identity: {
                        ...sheetData.identity,
                        playerName: value,
                      },
                    })
                  }
                />

                <NumberField
                  label="Nivel"
                  value={sheetData.identity.level}
                  onChange={(value) =>
                    updateSheetData({
                      ...sheetData,
                      identity: {
                        ...sheetData.identity,
                        level: value,
                      },
                    })
                  }
                />

                <TextField
                  label="Clase"
                  value={sheetData.identity.className}
                  onChange={(value) =>
                    updateSheetData({
                      ...sheetData,
                      identity: {
                        ...sheetData.identity,
                        className: value,
                      },
                    })
                  }
                />

                <TextField
                  label="Subclase"
                  value={sheetData.identity.subclassName}
                  onChange={(value) =>
                    updateSheetData({
                      ...sheetData,
                      identity: {
                        ...sheetData.identity,
                        subclassName: value,
                      },
                    })
                  }
                />

                <TextField
                  label="Trasfondo"
                  value={sheetData.identity.background}
                  onChange={(value) =>
                    updateSheetData({
                      ...sheetData,
                      identity: {
                        ...sheetData.identity,
                        background: value,
                      },
                    })
                  }
                />

                <TextField
                  label="Raza"
                  value={sheetData.identity.race}
                  onChange={(value) =>
                    updateSheetData({
                      ...sheetData,
                      identity: {
                        ...sheetData.identity,
                        race: value,
                      },
                    })
                  }
                />

                <TextField
                  label="Alineamiento"
                  value={sheetData.identity.alignment}
                  onChange={(value) =>
                    updateSheetData({
                      ...sheetData,
                      identity: {
                        ...sheetData.identity,
                        alignment: value,
                      },
                    })
                  }
                />

                <NumberField
                  label="Experiencia"
                  value={sheetData.identity.experience}
                  onChange={(value) =>
                    updateSheetData({
                      ...sheetData,
                      identity: {
                        ...sheetData.identity,
                        experience: value,
                      },
                    })
                  }
                />
              </div>
            </Card>

            <Card title="Combate">
              <div className="grid gap-4 md:grid-cols-4">
                <NumberField
                  label="CA"
                  value={sheetData.combat.armorClass}
                  onChange={(value) =>
                    updateSheetData({
                      ...sheetData,
                      combat: {
                        ...sheetData.combat,
                        armorClass: value,
                      },
                    })
                  }
                />

                <NumberField
                  label="Iniciativa"
                  value={sheetData.combat.initiative}
                  onChange={(value) =>
                    updateSheetData({
                      ...sheetData,
                      combat: {
                        ...sheetData.combat,
                        initiative: value,
                      },
                    })
                  }
                />

                <NumberField
                  label="Velocidad"
                  value={sheetData.combat.speed}
                  onChange={(value) =>
                    updateSheetData({
                      ...sheetData,
                      combat: {
                        ...sheetData.combat,
                        speed: value,
                      },
                    })
                  }
                />

                <NumberField
                  label="PG máximos"
                  value={sheetData.combat.maxHp}
                  onChange={(value) =>
                    updateSheetData({
                      ...sheetData,
                      combat: {
                        ...sheetData.combat,
                        maxHp: value,
                      },
                    })
                  }
                />

                <NumberField
                  label="PG actuales"
                  value={sheetData.combat.currentHp}
                  onChange={(value) =>
                    updateSheetData({
                      ...sheetData,
                      combat: {
                        ...sheetData.combat,
                        currentHp: value,
                      },
                    })
                  }
                />

                <NumberField
                  label="PG temporales"
                  value={sheetData.combat.temporaryHp}
                  onChange={(value) =>
                    updateSheetData({
                      ...sheetData,
                      combat: {
                        ...sheetData.combat,
                        temporaryHp: value,
                      },
                    })
                  }
                />

                <TextField
                  label="Dados golpe total"
                  value={sheetData.combat.hitDiceTotal}
                  onChange={(value) =>
                    updateSheetData({
                      ...sheetData,
                      combat: {
                        ...sheetData.combat,
                        hitDiceTotal: value,
                      },
                    })
                  }
                />

                <TextField
                  label="Dados golpe actual"
                  value={sheetData.combat.hitDiceCurrent}
                  onChange={(value) =>
                    updateSheetData({
                      ...sheetData,
                      combat: {
                        ...sheetData.combat,
                        hitDiceCurrent: value,
                      },
                    })
                  }
                />

                <NumberField
                  label="Bonif. competencia"
                  value={sheetData.proficiencies.proficiencyBonus}
                  onChange={(value) =>
                    updateSheetData({
                      ...sheetData,
                      proficiencies: {
                        ...sheetData.proficiencies,
                        proficiencyBonus: value,
                      },
                    })
                  }
                />

                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                  <p className="text-sm font-bold text-zinc-400">
                    Sabiduría pasiva
                  </p>
                  <p className="mt-2 text-3xl font-black">
                    {passivePerception}
                  </p>
                </div>
              </div>
            </Card>

            <Card
              title="Ataques"
              action={
                <button
                  type="button"
                  onClick={addAttack}
                  className="rounded-xl bg-yellow-500 px-3 py-2 text-sm font-bold text-zinc-950 transition hover:bg-yellow-400"
                >
                  + Ataque
                </button>
              }
            >
              <div className="space-y-3">
                {sheetData.attacks.length === 0 ? (
                  <EmptyBox text="Sin ataques registrados." />
                ) : (
                  sheetData.attacks.map((attack, index) => (
                    <div
                      key={index}
                      className="grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 md:grid-cols-[1fr_120px_1fr_auto]"
                    >
                      <TextField
                        label="Nombre"
                        value={attack.name}
                        onChange={(value) =>
                          updateSheetData({
                            ...sheetData,
                            attacks: sheetData.attacks.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    name: value,
                                  }
                                : item
                            ),
                          })
                        }
                      />

                      <TextField
                        label="Ataque"
                        value={attack.attackBonus}
                        onChange={(value) =>
                          updateSheetData({
                            ...sheetData,
                            attacks: sheetData.attacks.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    attackBonus: value,
                                  }
                                : item
                            ),
                          })
                        }
                      />

                      <TextField
                        label="Daño / Tipo"
                        value={attack.damage}
                        onChange={(value) =>
                          updateSheetData({
                            ...sheetData,
                            attacks: sheetData.attacks.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    damage: value,
                                  }
                                : item
                            ),
                          })
                        }
                      />

                      <button
                        type="button"
                        onClick={() => removeAttack(index)}
                        className="self-end rounded-xl border border-red-500 px-3 py-3 text-sm font-bold text-red-300 transition hover:bg-red-500/10"
                      >
                        Borrar
                      </button>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card
              title="Equipo"
              action={
                <button
                  type="button"
                  onClick={addEquipment}
                  className="rounded-xl bg-yellow-500 px-3 py-2 text-sm font-bold text-zinc-950 transition hover:bg-yellow-400"
                >
                  + Objeto
                </button>
              }
            >
              <div className="grid gap-4 md:grid-cols-5">
                {(["cp", "sp", "ep", "gp", "pp"] as const).map((coin) => (
                  <NumberField
                    key={coin}
                    label={coin.toUpperCase()}
                    value={sheetData.currency[coin]}
                    onChange={(value) =>
                      updateSheetData({
                        ...sheetData,
                        currency: {
                          ...sheetData.currency,
                          [coin]: value,
                        },
                      })
                    }
                  />
                ))}
              </div>

              <div className="mt-4 space-y-3">
                {sheetData.equipment.length === 0 ? (
                  <EmptyBox text="Sin equipo registrado." />
                ) : (
                  sheetData.equipment.map((item, index) => (
                    <div
                      key={index}
                      className="grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 md:grid-cols-[120px_1fr_auto]"
                    >
                      <NumberField
                        label="Cantidad"
                        value={item.quantity}
                        onChange={(value) =>
                          updateSheetData({
                            ...sheetData,
                            equipment: sheetData.equipment.map(
                              (equipmentItem, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...equipmentItem,
                                      quantity: value,
                                    }
                                  : equipmentItem
                            ),
                          })
                        }
                      />

                      <TextField
                        label="Objeto"
                        value={item.name}
                        onChange={(value) =>
                          updateSheetData({
                            ...sheetData,
                            equipment: sheetData.equipment.map(
                              (equipmentItem, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...equipmentItem,
                                      name: value,
                                    }
                                  : equipmentItem
                            ),
                          })
                        }
                      />

                      <button
                        type="button"
                        onClick={() => removeEquipment(index)}
                        className="self-end rounded-xl border border-red-500 px-3 py-3 text-sm font-bold text-red-300 transition hover:bg-red-500/10"
                      >
                        Borrar
                      </button>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <section className="grid gap-6 lg:grid-cols-2">
              <Card title="Personalidad">
                <div className="space-y-4">
                  <TextAreaField
                    label="Rasgos de personalidad"
                    value={sheetData.personality.traits}
                    onChange={(value) =>
                      updateSheetData({
                        ...sheetData,
                        personality: {
                          ...sheetData.personality,
                          traits: value,
                        },
                      })
                    }
                    rows={3}
                  />

                  <TextAreaField
                    label="Ideales"
                    value={sheetData.personality.ideals}
                    onChange={(value) =>
                      updateSheetData({
                        ...sheetData,
                        personality: {
                          ...sheetData.personality,
                          ideals: value,
                        },
                      })
                    }
                    rows={3}
                  />

                  <TextAreaField
                    label="Vínculos"
                    value={sheetData.personality.bonds}
                    onChange={(value) =>
                      updateSheetData({
                        ...sheetData,
                        personality: {
                          ...sheetData.personality,
                          bonds: value,
                        },
                      })
                    }
                    rows={3}
                  />

                  <TextAreaField
                    label="Defectos"
                    value={sheetData.personality.flaws}
                    onChange={(value) =>
                      updateSheetData({
                        ...sheetData,
                        personality: {
                          ...sheetData.personality,
                          flaws: value,
                        },
                      })
                    }
                    rows={3}
                  />
                </div>
              </Card>

              <Card title="Competencias e idiomas">
                <div className="space-y-4">
                  <TextAreaField
                    label="Idiomas"
                    value={joinLines(sheetData.proficiencies.languages)}
                    onChange={(value) =>
                      updateSheetData({
                        ...sheetData,
                        proficiencies: {
                          ...sheetData.proficiencies,
                          languages: splitLines(value),
                        },
                      })
                    }
                    rows={3}
                  />

                  <TextAreaField
                    label="Herramientas"
                    value={joinLines(sheetData.proficiencies.tools)}
                    onChange={(value) =>
                      updateSheetData({
                        ...sheetData,
                        proficiencies: {
                          ...sheetData.proficiencies,
                          tools: splitLines(value),
                        },
                      })
                    }
                    rows={3}
                  />

                  <TextAreaField
                    label="Armaduras"
                    value={joinLines(sheetData.proficiencies.armor)}
                    onChange={(value) =>
                      updateSheetData({
                        ...sheetData,
                        proficiencies: {
                          ...sheetData.proficiencies,
                          armor: splitLines(value),
                        },
                      })
                    }
                    rows={3}
                  />

                  <TextAreaField
                    label="Armas"
                    value={joinLines(sheetData.proficiencies.weapons)}
                    onChange={(value) =>
                      updateSheetData({
                        ...sheetData,
                        proficiencies: {
                          ...sheetData.proficiencies,
                          weapons: splitLines(value),
                        },
                      })
                    }
                    rows={3}
                  />
                </div>
              </Card>
            </section>

            <Card
              title="Rasgos y atributos"
              action={
                <button
                  type="button"
                  onClick={addFeature}
                  className="rounded-xl bg-yellow-500 px-3 py-2 text-sm font-bold text-zinc-950 transition hover:bg-yellow-400"
                >
                  + Rasgo
                </button>
              }
            >
              <div className="space-y-3">
                {sheetData.features.length === 0 ? (
                  <EmptyBox text="Sin rasgos registrados." />
                ) : (
                  sheetData.features.map((feature, index) => (
                    <div
                      key={index}
                      className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3"
                    >
                      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                        <TextField
                          label="Nombre"
                          value={feature.name}
                          onChange={(value) =>
                            updateSheetData({
                              ...sheetData,
                              features: sheetData.features.map(
                                (item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        name: value,
                                      }
                                    : item
                              ),
                            })
                          }
                        />

                        <button
                          type="button"
                          onClick={() => removeFeature(index)}
                          className="self-end rounded-xl border border-red-500 px-3 py-3 text-sm font-bold text-red-300 transition hover:bg-red-500/10"
                        >
                          Borrar
                        </button>
                      </div>

                      <div className="mt-3">
                        <TextAreaField
                          label="Descripción"
                          value={feature.description}
                          onChange={(value) =>
                            updateSheetData({
                              ...sheetData,
                              features: sheetData.features.map(
                                (item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        description: value,
                                      }
                                    : item
                              ),
                            })
                          }
                          rows={4}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card title="Conjuros">
              <div className="grid gap-4 md:grid-cols-4">
                <TextField
                  label="Clase lanzadora"
                  value={sheetData.spells.spellcastingClass}
                  onChange={(value) =>
                    updateSheetData({
                      ...sheetData,
                      spells: {
                        ...sheetData.spells,
                        spellcastingClass: value,
                      },
                    })
                  }
                />

                <TextField
                  label="Característica"
                  value={sheetData.spells.spellcastingAbility}
                  onChange={(value) =>
                    updateSheetData({
                      ...sheetData,
                      spells: {
                        ...sheetData.spells,
                        spellcastingAbility: value,
                      },
                    })
                  }
                />

                <NumberField
                  label="CD salvación"
                  value={sheetData.spells.spellSaveDc}
                  onChange={(value) =>
                    updateSheetData({
                      ...sheetData,
                      spells: {
                        ...sheetData.spells,
                        spellSaveDc: value,
                      },
                    })
                  }
                />

                <NumberField
                  label="Bonif. ataque"
                  value={sheetData.spells.spellAttackBonus}
                  onChange={(value) =>
                    updateSheetData({
                      ...sheetData,
                      spells: {
                        ...sheetData.spells,
                        spellAttackBonus: value,
                      },
                    })
                  }
                />
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {[
                  ["cantrips", "Trucos"],
                  ["level1", "Conjuros nivel 1"],
                  ["level2", "Conjuros nivel 2"],
                  ["level3", "Conjuros nivel 3"],
                  ["level4", "Conjuros nivel 4"],
                  ["level5", "Conjuros nivel 5"],
                  ["level6", "Conjuros nivel 6"],
                  ["level7", "Conjuros nivel 7"],
                  ["level8", "Conjuros nivel 8"],
                  ["level9", "Conjuros nivel 9"],
                ].map(([key, label]) => {
                  const spellKey = key as keyof SheetData["spells"];
                  const spellList = sheetData.spells[spellKey];

                  return (
                    <TextAreaField
                      key={key}
                      label={label}
                      value={Array.isArray(spellList) ? joinLines(spellList) : ""}
                      onChange={(value) =>
                        updateSheetData({
                          ...sheetData,
                          spells: {
                            ...sheetData.spells,
                            [spellKey]: splitLines(value),
                          },
                        })
                      }
                      rows={4}
                    />
                  );
                })}
              </div>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-black">{title}</h2>
        {action}
      </div>

      {children}
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-zinc-300">
        {label}
      </span>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none transition focus:border-yellow-400"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-zinc-300">
        {label}
      </span>

      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none transition focus:border-yellow-400"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-zinc-300">
        {label}
      </span>

      <textarea
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none transition focus:border-yellow-400"
      />
    </label>
  );
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-4 text-sm text-zinc-500">
      {text}
    </div>
  );
}