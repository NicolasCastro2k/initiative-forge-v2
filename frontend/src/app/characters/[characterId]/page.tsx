"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type AbilityKey = "strength" | "dexterity" | "constitution" | "intelligence" | "wisdom" | "charisma";

type Attack = { name: string; attackBonus: string; damage: string };
type EquipmentItem = { quantity: number; name: string };
type FeatureItem = { name: string; description: string };

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
    deathSavesSuccesses: number;
    deathSavesFailures: number;
  };
  attacks: Attack[];
  equipment: EquipmentItem[];
  currency: { cp: number; sp: number; ep: number; gp: number; pp: number };
  personality: { traits: string; ideals: string; bonds: string; flaws: string };
  proficiencies: {
    proficiencyBonus: number;
    savingThrows: Record<AbilityKey, boolean>;
    skills: Record<string, boolean>;
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
    slots: Record<string, { total: number; expended: number }>;
    spellsByLevel: Record<string, string[]>;
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
};

// ─── Presets ─────────────────────────────────────────────────────────────────

type ClassPreset = {
  id: string;
  name: string;
  hitDie: number;
  savingThrows: string[];
  spellcastingAbility: string | null;
  subclasses: { id: string; name: string }[];
  features: { level: number; name: string; summary: string }[];
};

type RacePreset = {
  id: string;
  name: string;
  speed: number;
  abilityBonuses: Partial<Record<AbilityKey, number>>;
  traits: string[];
};

type BackgroundPreset = {
  id: string;
  name: string;
  skillProficiencies: string[];
  feature: string;
};

// ─── Defaults ────────────────────────────────────────────────────────────────

function getDefaultSheetData(characterName: string): SheetData {
  return {
    identity: {
      playerName: "", characterName, className: "", subclassName: "",
      level: 1, background: "", race: "", alignment: "", experience: 0,
    },
    abilities: {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    },
    combat: {
      armorClass: 10, initiative: 0, speed: 30, maxHp: 10,
      currentHp: 10, temporaryHp: 0, hitDiceTotal: "1d8",
      hitDiceCurrent: "1d8", deathSavesSuccesses: 0, deathSavesFailures: 0,
    },
    attacks: [],
    equipment: [],
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    personality: { traits: "", ideals: "", bonds: "", flaws: "" },
    proficiencies: {
      proficiencyBonus: 2,
      savingThrows: { strength: false, dexterity: false, constitution: false, intelligence: false, wisdom: false, charisma: false },
      skills: {
        acrobatics: false, animalHandling: false, arcana: false, athletics: false,
        deception: false, history: false, insight: false, intimidation: false,
        investigation: false, medicine: false, nature: false, perception: false,
        performance: false, persuasion: false, religion: false, sleightOfHand: false,
        stealth: false, survival: false,
      },
      languages: [], tools: [], armor: [], weapons: [],
    },
    features: [],
    spells: {
      spellcastingClass: "", spellcastingAbility: "", spellSaveDc: 0, spellAttackBonus: 0,
      slots: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [String(i + 1), { total: 0, expended: 0 }])),
      spellsByLevel: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [String(i), []])),
    },
  };
}

function normalizeSheetData(value: unknown, characterName: string): SheetData {
  const defaults = getDefaultSheetData(characterName);
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
  const raw = value as Record<string, unknown>;

  // Compatibilidad: si viene con cantrips/level1..9 (formato viejo), convertir
  const rawSpells = (raw.spells ?? {}) as Record<string, unknown>;
  let spellsByLevel = (rawSpells.spellsByLevel as Record<string, string[]>) ?? {};
  if (!Object.keys(spellsByLevel).length) {
    // Convertir formato viejo
    spellsByLevel = {
      "0": Array.isArray(rawSpells.cantrips) ? rawSpells.cantrips as string[] : [],
      "1": Array.isArray(rawSpells.level1) ? rawSpells.level1 as string[] : [],
      "2": Array.isArray(rawSpells.level2) ? rawSpells.level2 as string[] : [],
      "3": Array.isArray(rawSpells.level3) ? rawSpells.level3 as string[] : [],
      "4": Array.isArray(rawSpells.level4) ? rawSpells.level4 as string[] : [],
      "5": Array.isArray(rawSpells.level5) ? rawSpells.level5 as string[] : [],
      "6": Array.isArray(rawSpells.level6) ? rawSpells.level6 as string[] : [],
      "7": Array.isArray(rawSpells.level7) ? rawSpells.level7 as string[] : [],
      "8": Array.isArray(rawSpells.level8) ? rawSpells.level8 as string[] : [],
      "9": Array.isArray(rawSpells.level9) ? rawSpells.level9 as string[] : [],
    };
  }

  const rawProf = (raw.proficiencies ?? {}) as Record<string, unknown>;

  return {
    identity: { ...defaults.identity, ...((raw.identity ?? {}) as object) },
    abilities: { ...defaults.abilities, ...((raw.abilities ?? {}) as object) },
    combat: { ...defaults.combat, ...((raw.combat ?? {}) as object) },
    attacks: Array.isArray(raw.attacks) ? raw.attacks as Attack[] : [],
    equipment: Array.isArray(raw.equipment) ? raw.equipment as EquipmentItem[] : [],
    currency: { ...defaults.currency, ...((raw.currency ?? {}) as object) },
    personality: { ...defaults.personality, ...((raw.personality ?? {}) as object) },
    proficiencies: {
      ...defaults.proficiencies,
      ...rawProf,
      savingThrows: { ...defaults.proficiencies.savingThrows, ...((rawProf.savingThrows ?? {}) as object) },
      skills: { ...defaults.proficiencies.skills, ...((rawProf.skills ?? {}) as object) },
      languages: Array.isArray(rawProf.languages) ? rawProf.languages as string[] : [],
      tools: Array.isArray(rawProf.tools) ? rawProf.tools as string[] : [],
      armor: Array.isArray(rawProf.armor) ? rawProf.armor as string[] : [],
      weapons: Array.isArray(rawProf.weapons) ? rawProf.weapons as string[] : [],
    },
    features: Array.isArray(raw.features) ? raw.features as FeatureItem[] : [],
    spells: {
      ...defaults.spells,
      ...rawSpells,
      slots: (rawSpells.slots as Record<string, { total: number; expended: number }>) ?? defaults.spells.slots,
      spellsByLevel,
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const abilityLabels: { key: AbilityKey; label: string; short: string }[] = [
  { key: "strength", label: "Fuerza", short: "FUE" },
  { key: "dexterity", label: "Destreza", short: "DES" },
  { key: "constitution", label: "Constitución", short: "CON" },
  { key: "intelligence", label: "Inteligencia", short: "INT" },
  { key: "wisdom", label: "Sabiduría", short: "SAB" },
  { key: "charisma", label: "Carisma", short: "CAR" },
];

const skillLabels: { key: string; label: string; ability: AbilityKey }[] = [
  { key: "acrobatics", label: "Acrobacias", ability: "dexterity" },
  { key: "animalHandling", label: "Trato con animales", ability: "wisdom" },
  { key: "arcana", label: "Arcanos", ability: "intelligence" },
  { key: "athletics", label: "Atletismo", ability: "strength" },
  { key: "deception", label: "Engaño", ability: "charisma" },
  { key: "history", label: "Historia", ability: "intelligence" },
  { key: "insight", label: "Perspicacia", ability: "wisdom" },
  { key: "intimidation", label: "Intimidación", ability: "charisma" },
  { key: "investigation", label: "Investigación", ability: "intelligence" },
  { key: "medicine", label: "Medicina", ability: "wisdom" },
  { key: "nature", label: "Naturaleza", ability: "intelligence" },
  { key: "perception", label: "Percepción", ability: "wisdom" },
  { key: "performance", label: "Actuación", ability: "charisma" },
  { key: "persuasion", label: "Persuasión", ability: "charisma" },
  { key: "religion", label: "Religión", ability: "intelligence" },
  { key: "sleightOfHand", label: "Juego de manos", ability: "dexterity" },
  { key: "stealth", label: "Sigilo", ability: "dexterity" },
  { key: "survival", label: "Supervivencia", ability: "wisdom" },
];

function getImageUrl(path: string | null) {
  if (!path) return "";
  return path.startsWith("http") ? path : `${API_URL}${path}`;
}

function getModifier(score: number) { return Math.floor((score - 10) / 2); }
function signed(value: number) { return value >= 0 ? `+${value}` : String(value); }
function splitLines(value: string) { return value.split("\n").map((l) => l.trim()).filter(Boolean); }
function joinLines(value: string[]) { return value.join("\n"); }

// ─── Componente principal ─────────────────────────────────────────────────────

export default function CharacterSheetPage() {
  const params = useParams<{ characterId: string }>();
  const characterId = params.characterId;

  const [character, setCharacter] = useState<Character | null>(null);
  const [sheetData, setSheetData] = useState<SheetData>(getDefaultSheetData(""));
  const [classes, setClasses] = useState<ClassPreset[]>([]);
  const [races, setRaces] = useState<RacePreset[]>([]);
  const [backgrounds, setBackgrounds] = useState<BackgroundPreset[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedSubclassId, setSelectedSubclassId] = useState<string>("");
  const [selectedRaceId, setSelectedRaceId] = useState<string>("");
  const [selectedBackgroundId, setSelectedBackgroundId] = useState<string>("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const passivePerception = useMemo(
    () => 10 + getModifier(sheetData.abilities.wisdom) + (sheetData.proficiencies.skills.perception ? sheetData.proficiencies.proficiencyBonus : 0),
    [sheetData.abilities.wisdom, sheetData.proficiencies.skills.perception, sheetData.proficiencies.proficiencyBonus]
  );

  const selectedClass = classes.find((c) => c.id === selectedClassId) ?? null;
  const availableSubclasses = selectedClass?.subclasses ?? [];

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId]);

  async function loadAll() {
    if (!characterId) return;
    setIsLoading(true);
    setError("");

    try {
      const [charRes, classesRes, racesRes, backgroundsRes] = await Promise.all([
        fetch(`${API_URL}/characters/${characterId}`, { credentials: "include" }),
        fetch(`${API_URL}/presets/classes`, { credentials: "include" }),
        fetch(`${API_URL}/presets/races`, { credentials: "include" }),
        fetch(`${API_URL}/presets/backgrounds`, { credentials: "include" }),
      ]);

      if (charRes.status === 401) {
        window.location.href = `/login?redirect=${encodeURIComponent(`/characters/${characterId}`)}`;
        return;
      }

      const [charData, classesData, racesData, backgroundsData] = await Promise.all([
        charRes.json().catch(() => null),
        classesRes.json().catch(() => null),
        racesRes.json().catch(() => null),
        backgroundsRes.json().catch(() => null),
      ]);

      if (!charRes.ok || !charData?.character) {
        setError(charData?.message ?? "No se pudo cargar el personaje.");
        return;
      }

      const loadedChar = charData.character as Character;
      setCharacter(loadedChar);
      setSheetData(normalizeSheetData(loadedChar.sheetData, loadedChar.name));
      setSelectedClassId(loadedChar.classId ?? "");
      setSelectedSubclassId(loadedChar.subclassId ?? "");
      setSelectedRaceId(loadedChar.raceId ?? "");
      setSelectedBackgroundId(loadedChar.backgroundId ?? "");

      setClasses((classesData?.classes ?? []) as ClassPreset[]);
      setRaces((racesData?.races ?? []) as RacePreset[]);
      setBackgrounds((backgroundsData?.backgrounds ?? []) as BackgroundPreset[]);
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setIsLoading(false);
    }
  }

  // Cuando el jugador cambia de clase, auto-rellenar dados golpe, competencias de salvación y clase lanzadora
  function handleClassChange(classId: string) {
    setSelectedClassId(classId);
    setSelectedSubclassId("");

    const cls = classes.find((c) => c.id === classId);
    if (!cls) return;

    const level = sheetData.identity.level;
    const maxHp = cls.hitDie + getModifier(sheetData.abilities.constitution);

    // Auto-rellenar competencias de salvación
    const newSavingThrows = { ...sheetData.proficiencies.savingThrows };
    (Object.keys(newSavingThrows) as AbilityKey[]).forEach((k) => { newSavingThrows[k] = false; });
    cls.savingThrows.forEach((s) => {
      const key = s.toLowerCase() as AbilityKey;
      if (key in newSavingThrows) newSavingThrows[key] = true;
    });

    setSheetData((prev) => ({
      ...prev,
      identity: { ...prev.identity, className: cls.name, subclassName: "" },
      combat: {
        ...prev.combat,
        hitDiceTotal: `${level}d${cls.hitDie}`,
        hitDiceCurrent: `${level}d${cls.hitDie}`,
        maxHp: maxHp,
        currentHp: maxHp,
      },
      proficiencies: { ...prev.proficiencies, savingThrows: newSavingThrows },
      spells: {
        ...prev.spells,
        spellcastingAbility: cls.spellcastingAbility ?? prev.spells.spellcastingAbility,
        spellcastingClass: cls.name,
      },
    }));
  }

  // Cuando cambia la raza, auto-rellenar velocidad y bonificadores de atributo
  function handleRaceChange(raceId: string) {
    setSelectedRaceId(raceId);
    const race = races.find((r) => r.id === raceId);
    if (!race) return;

    const newAbilities = { ...sheetData.abilities };
    (Object.entries(race.abilityBonuses) as [AbilityKey, number][]).forEach(([key, bonus]) => {
      newAbilities[key] = (newAbilities[key] ?? 10) + bonus;
    });

    setSheetData((prev) => ({
      ...prev,
      identity: { ...prev.identity, race: race.name },
      combat: { ...prev.combat, speed: race.speed },
      abilities: newAbilities,
    }));
  }

  // Cuando cambia el trasfondo, agregar las competencias en habilidades
  function handleBackgroundChange(backgroundId: string) {
    setSelectedBackgroundId(backgroundId);
    const bg = backgrounds.find((b) => b.id === backgroundId);
    if (!bg) return;

    setSheetData((prev) => ({
      ...prev,
      identity: { ...prev.identity, background: bg.name },
    }));
  }

  function handleSubclassChange(subclassId: string) {
    setSelectedSubclassId(subclassId);
    const sub = availableSubclasses.find((s) => s.id === subclassId);
    setSheetData((prev) => ({
      ...prev,
      identity: { ...prev.identity, subclassName: sub?.name ?? "" },
    }));
  }

  function update(nextSheetData: SheetData) { setSheetData(nextSheetData); }

  async function saveCharacter() {
    if (!character || !characterId) return;
    setIsSaving(true);
    setError("");
    setMessage("");

    const characterName = sheetData.identity.characterName.trim() || character.name;

    try {
      const response = await fetch(`${API_URL}/characters/${characterId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: characterName,
          raceId: selectedRaceId || null,
          classId: selectedClassId || null,
          subclassId: selectedSubclassId || null,
          backgroundId: selectedBackgroundId || null,
          level: sheetData.identity.level,
          sheetData: { ...sheetData, identity: { ...sheetData.identity, characterName } },
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.character) {
        setError(data?.message ?? "No se pudo guardar la ficha.");
        return;
      }

      setCharacter(data.character as Character);
      setSheetData(normalizeSheetData(data.character.sheetData, data.character.name));
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
      const response = await fetch(`${API_URL}/characters/${characterId}/image`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.character) {
        setError(data?.message ?? "No se pudo subir la imagen.");
        return;
      }
      setCharacter(data.character as Character);
      setMessage("Imagen actualizada.");
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setIsUploadingImage(false);
    }
  }

  function addAttack() { update({ ...sheetData, attacks: [...sheetData.attacks, { name: "", attackBonus: "", damage: "" }] }); }
  function removeAttack(i: number) { update({ ...sheetData, attacks: sheetData.attacks.filter((_, idx) => idx !== i) }); }
  function addEquipment() { update({ ...sheetData, equipment: [...sheetData.equipment, { quantity: 1, name: "" }] }); }
  function removeEquipment(i: number) { update({ ...sheetData, equipment: sheetData.equipment.filter((_, idx) => idx !== i) }); }
  function addFeature() { update({ ...sheetData, features: [...sheetData.features, { name: "", description: "" }] }); }
  function removeFeature(i: number) { update({ ...sheetData, features: sheetData.features.filter((_, idx) => idx !== i) }); }

  if (isLoading) {
    return <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">Cargando ficha...</main>;
  }

  if (error && !character) {
    return (
      <main className="min-h-screen bg-zinc-950 p-6 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-500/40 bg-red-500/10 p-6 text-red-200">{error}</div>
      </main>
    );
  }

  if (!character) return null;

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-white">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-yellow-400">Ficha editable</p>
            <h1 className="mt-2 text-3xl font-black">{sheetData.identity.characterName || character.name}</h1>
            <p className="mt-2 text-zinc-400">
              Nivel {sheetData.identity.level} · {sheetData.identity.race || "Sin raza"} · {sheetData.identity.className || "Sin clase"}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={() => void saveCharacter()} disabled={isSaving}
              className="rounded-xl bg-yellow-500 px-5 py-3 font-bold text-zinc-950 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60">
              {isSaving ? "Guardando..." : "Guardar ficha"}
            </button>
            <a href="/characters" className="rounded-xl border border-zinc-700 px-5 py-3 text-center font-semibold text-zinc-200 transition hover:bg-zinc-800">
              Volver a personajes
            </a>
          </div>
        </header>

        {error && <div className="mb-6 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">{error}</div>}
        {message && <div className="mb-6 rounded-2xl border border-green-500/40 bg-green-500/10 p-4 text-green-200">{message}</div>}

        <section className="grid gap-6 xl:grid-cols-[300px_1fr]">

          {/* Columna izquierda */}
          <aside className="space-y-6">

            <Card title="Foto / Token">
              <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950">
                {character.portraitImagePath ? (
                  <img src={getImageUrl(character.portraitImagePath)} alt={character.name} className="h-72 w-full object-cover" />
                ) : (
                  <div className="grid h-72 place-items-center text-6xl font-black text-zinc-700">
                    {character.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-bold text-zinc-300">Subir imagen</span>
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={isUploadingImage}
                  onChange={(e) => { void uploadImage(e.target.files?.[0] ?? null); e.currentTarget.value = ""; }}
                  className="block w-full cursor-pointer rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-yellow-500 file:px-3 file:py-2 file:font-bold file:text-zinc-950" />
              </label>
              <p className="mt-3 text-xs text-zinc-500">Esta imagen se usará como token en combate.</p>
            </Card>

            <Card title="Atributos">
              <div className="space-y-3">
                {abilityLabels.map((ability) => {
                  const score = sheetData.abilities[ability.key];
                  const hasSaveProf = sheetData.proficiencies.savingThrows[ability.key];
                  const saveMod = getModifier(score) + (hasSaveProf ? sheetData.proficiencies.proficiencyBonus : 0);
                  return (
                    <div key={ability.key} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">{ability.short}</p>
                          <p className="font-bold">{ability.label}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black text-yellow-300">{signed(getModifier(score))}</p>
                          <p className="text-xs text-zinc-500">Sal. {signed(saveMod)}{hasSaveProf ? " ✓" : ""}</p>
                        </div>
                      </div>
                      <input type="number" value={score}
                        onChange={(e) => update({ ...sheetData, abilities: { ...sheetData.abilities, [ability.key]: Number(e.target.value) } })}
                        className="mt-3 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-center font-bold outline-none transition focus:border-yellow-400" />
                      <label className="mt-2 flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                        <input type="checkbox" checked={hasSaveProf}
                          onChange={(e) => update({ ...sheetData, proficiencies: { ...sheetData.proficiencies, savingThrows: { ...sheetData.proficiencies.savingThrows, [ability.key]: e.target.checked } } })}
                          className="accent-yellow-400" />
                        Competencia en salvación
                      </label>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Habilidades */}
            <Card title="Habilidades">
              <div className="space-y-1">
                {skillLabels.map((skill) => {
                  const hasProficiency = sheetData.proficiencies.skills[skill.key] ?? false;
                  const abilityMod = getModifier(sheetData.abilities[skill.ability]);
                  const total = abilityMod + (hasProficiency ? sheetData.proficiencies.proficiencyBonus : 0);
                  return (
                    <label key={skill.key} className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-zinc-800">
                      <input type="checkbox" checked={hasProficiency}
                        onChange={(e) => update({ ...sheetData, proficiencies: { ...sheetData.proficiencies, skills: { ...sheetData.proficiencies.skills, [skill.key]: e.target.checked } } })}
                        className="accent-yellow-400" />
                      <span className="flex-1 text-sm text-zinc-300">{skill.label}</span>
                      <span className="text-xs text-zinc-500">{abilityLabels.find((a) => a.key === skill.ability)?.short}</span>
                      <span className="w-8 text-right text-sm font-bold text-yellow-300">{signed(total)}</span>
                    </label>
                  );
                })}
              </div>
            </Card>

          </aside>

          {/* Columna derecha */}
          <div className="space-y-6">

            {/* Identidad con selectores de DB */}
            <Card title="Identidad">
              <div className="grid gap-4 md:grid-cols-3">
                <TextField label="Nombre" value={sheetData.identity.characterName}
                  onChange={(v) => update({ ...sheetData, identity: { ...sheetData.identity, characterName: v } })} />
                <TextField label="Jugador" value={sheetData.identity.playerName}
                  onChange={(v) => update({ ...sheetData, identity: { ...sheetData.identity, playerName: v } })} />
                <NumberField label="Nivel" value={sheetData.identity.level}
                  onChange={(v) => update({ ...sheetData, identity: { ...sheetData.identity, level: v } })} />

                {/* Clase — selector de DB */}
                <div>
                  <label className="mb-1 block text-sm font-bold text-zinc-300">Clase</label>
                  <select value={selectedClassId} onChange={(e) => handleClassChange(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none transition focus:border-yellow-400">
                    <option value="">— Seleccionar —</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name} (d{c.hitDie})</option>)}
                  </select>
                  {selectedClass && (
                    <p className="mt-1 text-xs text-zinc-500">
                      Salvaciones: {selectedClass.savingThrows.join(", ")}
                    </p>
                  )}
                </div>

                {/* Subclase — depende de clase seleccionada */}
                <div>
                  <label className="mb-1 block text-sm font-bold text-zinc-300">Subclase</label>
                  <select value={selectedSubclassId} onChange={(e) => handleSubclassChange(e.target.value)}
                    disabled={availableSubclasses.length === 0}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none transition focus:border-yellow-400 disabled:opacity-50">
                    <option value="">— Seleccionar —</option>
                    {availableSubclasses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                {/* Raza — selector de DB */}
                <div>
                  <label className="mb-1 block text-sm font-bold text-zinc-300">Raza</label>
                  <select value={selectedRaceId} onChange={(e) => handleRaceChange(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none transition focus:border-yellow-400">
                    <option value="">— Seleccionar —</option>
                    {races.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.speed}ft)</option>)}
                  </select>
                </div>

                {/* Trasfondo — selector de DB */}
                <div>
                  <label className="mb-1 block text-sm font-bold text-zinc-300">Trasfondo</label>
                  <select value={selectedBackgroundId} onChange={(e) => handleBackgroundChange(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none transition focus:border-yellow-400">
                    <option value="">— Seleccionar —</option>
                    {backgrounds.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  {selectedBackgroundId && (
                    <p className="mt-1 text-xs text-zinc-500">
                      {backgrounds.find((b) => b.id === selectedBackgroundId)?.skillProficiencies.join(", ")}
                    </p>
                  )}
                </div>

                <TextField label="Alineamiento" value={sheetData.identity.alignment}
                  onChange={(v) => update({ ...sheetData, identity: { ...sheetData.identity, alignment: v } })} />
                <NumberField label="Experiencia" value={sheetData.identity.experience}
                  onChange={(v) => update({ ...sheetData, identity: { ...sheetData.identity, experience: v } })} />
              </div>

              {/* Rasgos de clase */}
              {selectedClass && (
                <div className="mt-4 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4">
                  <p className="text-sm font-bold text-yellow-300">Rasgos de {selectedClass.name} hasta nivel {sheetData.identity.level}</p>
                  <div className="mt-2 space-y-1">
                    {selectedClass.features
                      .filter((f) => f.level <= sheetData.identity.level)
                      .map((f, i) => (
                        <p key={i} className="text-xs text-zinc-300">
                          <span className="font-bold text-yellow-200">Nv.{f.level} {f.name}:</span> {f.summary}
                        </p>
                      ))}
                  </div>
                </div>
              )}
            </Card>

            {/* Combate */}
            <Card title="Combate">
              <div className="grid gap-4 md:grid-cols-4">
                <NumberField label="CA" value={sheetData.combat.armorClass}
                  onChange={(v) => update({ ...sheetData, combat: { ...sheetData.combat, armorClass: v } })} />
                <NumberField label="Iniciativa" value={sheetData.combat.initiative}
                  onChange={(v) => update({ ...sheetData, combat: { ...sheetData.combat, initiative: v } })} />
                <NumberField label="Velocidad (ft)" value={sheetData.combat.speed}
                  onChange={(v) => update({ ...sheetData, combat: { ...sheetData.combat, speed: v } })} />
                <NumberField label="PG máximos" value={sheetData.combat.maxHp}
                  onChange={(v) => update({ ...sheetData, combat: { ...sheetData.combat, maxHp: v } })} />
                <NumberField label="PG actuales" value={sheetData.combat.currentHp}
                  onChange={(v) => update({ ...sheetData, combat: { ...sheetData.combat, currentHp: v } })} />
                <NumberField label="PG temporales" value={sheetData.combat.temporaryHp}
                  onChange={(v) => update({ ...sheetData, combat: { ...sheetData.combat, temporaryHp: v } })} />
                <TextField label="Dados golpe total" value={sheetData.combat.hitDiceTotal}
                  onChange={(v) => update({ ...sheetData, combat: { ...sheetData.combat, hitDiceTotal: v } })} />
                <TextField label="Dados golpe actual" value={sheetData.combat.hitDiceCurrent}
                  onChange={(v) => update({ ...sheetData, combat: { ...sheetData.combat, hitDiceCurrent: v } })} />
                <NumberField label="Bonif. competencia" value={sheetData.proficiencies.proficiencyBonus}
                  onChange={(v) => update({ ...sheetData, proficiencies: { ...sheetData.proficiencies, proficiencyBonus: v } })} />
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                  <p className="text-sm font-bold text-zinc-400">Percepción pasiva</p>
                  <p className="mt-2 text-3xl font-black">{passivePerception}</p>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                  <p className="text-sm font-bold text-zinc-400">Tiros muerte</p>
                  <p className="mt-1 text-xs text-zinc-500">Éxitos: {sheetData.combat.deathSavesSuccesses} / Fallos: {sheetData.combat.deathSavesFailures}</p>
                </div>
              </div>
            </Card>

            {/* Ataques */}
            <Card title="Ataques" action={
              <button type="button" onClick={addAttack}
                className="rounded-xl bg-yellow-500 px-3 py-2 text-sm font-bold text-zinc-950 transition hover:bg-yellow-400">+ Ataque</button>
            }>
              <div className="space-y-3">
                {sheetData.attacks.length === 0 ? <EmptyBox text="Sin ataques registrados." /> :
                  sheetData.attacks.map((attack, i) => (
                    <div key={i} className="grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 md:grid-cols-[1fr_120px_1fr_auto]">
                      <TextField label="Nombre" value={attack.name}
                        onChange={(v) => update({ ...sheetData, attacks: sheetData.attacks.map((a, idx) => idx === i ? { ...a, name: v } : a) })} />
                      <TextField label="Bonif. ataque" value={attack.attackBonus}
                        onChange={(v) => update({ ...sheetData, attacks: sheetData.attacks.map((a, idx) => idx === i ? { ...a, attackBonus: v } : a) })} />
                      <TextField label="Daño / Tipo" value={attack.damage}
                        onChange={(v) => update({ ...sheetData, attacks: sheetData.attacks.map((a, idx) => idx === i ? { ...a, damage: v } : a) })} />
                      <button type="button" onClick={() => removeAttack(i)}
                        className="self-end rounded-xl border border-red-500 px-3 py-3 text-sm font-bold text-red-300 transition hover:bg-red-500/10">Borrar</button>
                    </div>
                  ))
                }
              </div>
            </Card>

            {/* Equipo */}
            <Card title="Equipo" action={
              <button type="button" onClick={addEquipment}
                className="rounded-xl bg-yellow-500 px-3 py-2 text-sm font-bold text-zinc-950 transition hover:bg-yellow-400">+ Objeto</button>
            }>
              <div className="grid gap-4 md:grid-cols-5">
                {(["cp", "sp", "ep", "gp", "pp"] as const).map((coin) => (
                  <NumberField key={coin} label={coin.toUpperCase()} value={sheetData.currency[coin]}
                    onChange={(v) => update({ ...sheetData, currency: { ...sheetData.currency, [coin]: v } })} />
                ))}
              </div>
              <div className="mt-4 space-y-3">
                {sheetData.equipment.length === 0 ? <EmptyBox text="Sin equipo registrado." /> :
                  sheetData.equipment.map((item, i) => (
                    <div key={i} className="grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 md:grid-cols-[120px_1fr_auto]">
                      <NumberField label="Cantidad" value={item.quantity}
                        onChange={(v) => update({ ...sheetData, equipment: sheetData.equipment.map((e, idx) => idx === i ? { ...e, quantity: v } : e) })} />
                      <TextField label="Objeto" value={item.name}
                        onChange={(v) => update({ ...sheetData, equipment: sheetData.equipment.map((e, idx) => idx === i ? { ...e, name: v } : e) })} />
                      <button type="button" onClick={() => removeEquipment(i)}
                        className="self-end rounded-xl border border-red-500 px-3 py-3 text-sm font-bold text-red-300 transition hover:bg-red-500/10">Borrar</button>
                    </div>
                  ))
                }
              </div>
            </Card>

            {/* Personalidad */}
            <section className="grid gap-6 lg:grid-cols-2">
              <Card title="Personalidad">
                <div className="space-y-4">
                  <TextAreaField label="Rasgos de personalidad" value={sheetData.personality.traits} rows={3}
                    onChange={(v) => update({ ...sheetData, personality: { ...sheetData.personality, traits: v } })} />
                  <TextAreaField label="Ideales" value={sheetData.personality.ideals} rows={3}
                    onChange={(v) => update({ ...sheetData, personality: { ...sheetData.personality, ideals: v } })} />
                  <TextAreaField label="Vínculos" value={sheetData.personality.bonds} rows={3}
                    onChange={(v) => update({ ...sheetData, personality: { ...sheetData.personality, bonds: v } })} />
                  <TextAreaField label="Defectos" value={sheetData.personality.flaws} rows={3}
                    onChange={(v) => update({ ...sheetData, personality: { ...sheetData.personality, flaws: v } })} />
                </div>
              </Card>

              <Card title="Competencias e idiomas">
                <div className="space-y-4">
                  <TextAreaField label="Idiomas" value={joinLines(sheetData.proficiencies.languages)} rows={3}
                    onChange={(v) => update({ ...sheetData, proficiencies: { ...sheetData.proficiencies, languages: splitLines(v) } })} />
                  <TextAreaField label="Herramientas" value={joinLines(sheetData.proficiencies.tools)} rows={3}
                    onChange={(v) => update({ ...sheetData, proficiencies: { ...sheetData.proficiencies, tools: splitLines(v) } })} />
                  <TextAreaField label="Armaduras" value={joinLines(sheetData.proficiencies.armor)} rows={3}
                    onChange={(v) => update({ ...sheetData, proficiencies: { ...sheetData.proficiencies, armor: splitLines(v) } })} />
                  <TextAreaField label="Armas" value={joinLines(sheetData.proficiencies.weapons)} rows={3}
                    onChange={(v) => update({ ...sheetData, proficiencies: { ...sheetData.proficiencies, weapons: splitLines(v) } })} />
                </div>
              </Card>
            </section>

            {/* Rasgos */}
            <Card title="Rasgos y habilidades" action={
              <button type="button" onClick={addFeature}
                className="rounded-xl bg-yellow-500 px-3 py-2 text-sm font-bold text-zinc-950 transition hover:bg-yellow-400">+ Rasgo</button>
            }>
              <div className="space-y-3">
                {sheetData.features.length === 0 ? <EmptyBox text="Sin rasgos registrados." /> :
                  sheetData.features.map((feature, i) => (
                    <div key={i} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
                      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                        <TextField label="Nombre" value={feature.name}
                          onChange={(v) => update({ ...sheetData, features: sheetData.features.map((f, idx) => idx === i ? { ...f, name: v } : f) })} />
                        <button type="button" onClick={() => removeFeature(i)}
                          className="self-end rounded-xl border border-red-500 px-3 py-3 text-sm font-bold text-red-300 transition hover:bg-red-500/10">Borrar</button>
                      </div>
                      <div className="mt-3">
                        <TextAreaField label="Descripción" value={feature.description} rows={4}
                          onChange={(v) => update({ ...sheetData, features: sheetData.features.map((f, idx) => idx === i ? { ...f, description: v } : f) })} />
                      </div>
                    </div>
                  ))
                }
              </div>
            </Card>

            {/* Conjuros */}
            <Card title="Conjuros">
              <div className="grid gap-4 md:grid-cols-4">
                <TextField label="Clase lanzadora" value={sheetData.spells.spellcastingClass}
                  onChange={(v) => update({ ...sheetData, spells: { ...sheetData.spells, spellcastingClass: v } })} />
                <TextField label="Característica" value={sheetData.spells.spellcastingAbility}
                  onChange={(v) => update({ ...sheetData, spells: { ...sheetData.spells, spellcastingAbility: v } })} />
                <NumberField label="CD salvación" value={sheetData.spells.spellSaveDc}
                  onChange={(v) => update({ ...sheetData, spells: { ...sheetData.spells, spellSaveDc: v } })} />
                <NumberField label="Bonif. ataque" value={sheetData.spells.spellAttackBonus}
                  onChange={(v) => update({ ...sheetData, spells: { ...sheetData.spells, spellAttackBonus: v } })} />
              </div>

              {/* Espacios de conjuro */}
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {Array.from({ length: 9 }, (_, i) => String(i + 1)).map((lvl) => {
                  const slot = sheetData.spells.slots[lvl] ?? { total: 0, expended: 0 };
                  return (
                    <div key={lvl} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                      <p className="text-xs font-bold text-zinc-400">Nivel {lvl}</p>
                      <div className="mt-1 flex gap-2">
                        <NumberField label="Total" value={slot.total}
                          onChange={(v) => update({ ...sheetData, spells: { ...sheetData.spells, slots: { ...sheetData.spells.slots, [lvl]: { ...slot, total: v } } } })} />
                        <NumberField label="Gastados" value={slot.expended}
                          onChange={(v) => update({ ...sheetData, spells: { ...sheetData.spells, slots: { ...sheetData.spells.slots, [lvl]: { ...slot, expended: v } } } })} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Lista de conjuros por nivel */}
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {[["0", "Trucos"], ["1", "Nivel 1"], ["2", "Nivel 2"], ["3", "Nivel 3"],
                  ["4", "Nivel 4"], ["5", "Nivel 5"], ["6", "Nivel 6"], ["7", "Nivel 7"],
                  ["8", "Nivel 8"], ["9", "Nivel 9"]].map(([lvl, label]) => (
                  <TextAreaField key={lvl} label={`Conjuros — ${label}`}
                    value={joinLines(sheetData.spells.spellsByLevel[lvl] ?? [])} rows={4}
                    onChange={(v) => update({ ...sheetData, spells: { ...sheetData.spells, spellsByLevel: { ...sheetData.spells.spellsByLevel, [lvl]: splitLines(v) } } })} />
                ))}
              </div>
            </Card>

          </div>
        </section>
      </div>
    </main>
  );
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
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

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-zinc-300">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none transition focus:border-yellow-400" />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-zinc-300">{label}</span>
      <input type="number" value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none transition focus:border-yellow-400" />
    </label>
  );
}

function TextAreaField({ label, value, onChange, rows }: { label: string; value: string; onChange: (v: string) => void; rows: number }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-zinc-300">{label}</span>
      <textarea value={value} rows={rows} onChange={(e) => onChange(e.target.value)}
        className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none transition focus:border-yellow-400" />
    </label>
  );
}

function EmptyBox({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-4 text-sm text-zinc-500">{text}</div>;
}
