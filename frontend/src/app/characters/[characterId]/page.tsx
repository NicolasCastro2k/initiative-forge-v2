// Va en: frontend/src/app/characters/[characterId]/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  BeastPreset, DRUID_CLASS_ID, MOON_DRUID_SUBCLASS_ID, WILD_SHAPE_USES_MAX,
  isBeastEligible, describeBeastSpeed, primaryBeastSpeed,
} from "@/utils/wildshape";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type AbilityKey = "strength" | "dexterity" | "constitution" | "intelligence" | "wisdom" | "charisma";

type Attack = { name: string; attackBonus: string; damage: string };

type WeaponPreset = {
  id: string;
  name: string;
  category: "simple" | "martial";
  attackType: "melee" | "ranged";
  damageDice: string;
  versatileDice: string | null;
  damageType: string;
  properties: string[];
  rangeNormal: number | null;
  rangeLong: number | null;
  isFinesse: boolean;
  isTwoHanded: boolean;
};

type SpellPreset = {
  id: string;
  name: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  classes: string[];
  description: string;
  attackType: string | null;
  savingThrow: string | null;
  damageDice: string | null;
  damageType: string | null;
  healingDice: string | null;
  higherLevels: string | null;
};
type EquipmentItem = { quantity: number; name: string };
type FeatureItem = { name: string; description: string };
type PendingLevelChoice = {
  type: "ABILITY_SCORE_IMPROVEMENT" | "SUBCLASS" | string;
  level: number;
  message: string;
  classId?: string | null;
  createdAt: string;
};

type SheetData = {
  meta: { locked: boolean };
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
    // Subconjunto de `skills` elegido específicamente desde la lista de la
    // clase (independiente de lo que ya otorgue el trasfondo), para que
    // cambiar de clase o de trasfondo no se pisen entre sí.
    classSkillChoices: string[];
    languages: string[];
    tools: string[];
    armor: string[];
    weapons: string[];
  };
  features: FeatureItem[];
  pendingLevelChoices: PendingLevelChoice[];
  spells: {
    spellcastingClass: string;
    spellcastingAbility: string;
    spellSaveDc: number;
    spellAttackBonus: number;
    slots: Record<string, { total: number; expended: number }>;
    spellsByLevel: Record<string, string[]>;
  };
  wildShape: {
    active: boolean;
    beastId: string | null;
    beastName: string;
    usesRemaining: number;
    usesMax: number;
    // Estadísticas del personaje ANTES de transformarse, para poder
    // restaurarlas al revertir. Solo se guardan la primera vez (si ya hay
    // algo guardado y cambias de bestia sin revertir, no se pisa).
    saved: {
      armorClass: number;
      speed: number;
      maxHp: number;
      currentHp: number;
      temporaryHp: number;
      hitDiceTotal: string;
      hitDiceCurrent: string;
      attacks: Attack[];
      tokenImagePath: string | null;
    } | null;
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
  armorTraining: string[];
  weaponTraining: string[];
  toolTraining: string[];
  skillChoices: string[];
  skillChoiceCount: number;
  spellcastingAbility: string | null;
  subclasses: { id: string; name: string; features?: { level: number; name: string; summary: string }[] }[];
  features: { level: number; name: string; summary: string }[];
};

type RacePreset = {
  id: string;
  name: string;
  speed: number;
  abilityBonuses: Partial<Record<AbilityKey, number>>;
  traits: string[];
  appearance: string;
  commonClasses: string[];
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
    meta: { locked: false },
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
      classSkillChoices: [],
    },
    features: [],
    pendingLevelChoices: [],
    spells: {
      spellcastingClass: "", spellcastingAbility: "", spellSaveDc: 0, spellAttackBonus: 0,
      slots: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [String(i + 1), { total: 0, expended: 0 }])),
      spellsByLevel: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [String(i), []])),
    },
    wildShape: { active: false, beastId: null, beastName: "", usesRemaining: 2, usesMax: 2, saved: null },
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
  const rawWildShape = (raw.wildShape ?? {}) as Record<string, unknown>;

  return {
    meta: { ...defaults.meta, ...((raw.meta ?? {}) as object) },
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
      classSkillChoices: Array.isArray(rawProf.classSkillChoices) ? rawProf.classSkillChoices as string[] : [],
    },
    features: Array.isArray(raw.features) ? raw.features as FeatureItem[] : [],
    pendingLevelChoices: Array.isArray(raw.pendingLevelChoices) ? raw.pendingLevelChoices as PendingLevelChoice[] : [],
    spells: {
      ...defaults.spells,
      ...rawSpells,
      slots: (rawSpells.slots as Record<string, { total: number; expended: number }>) ?? defaults.spells.slots,
      spellsByLevel,
    },
    wildShape: {
      ...defaults.wildShape,
      ...rawWildShape,
      saved: (rawWildShape.saved as SheetData["wildShape"]["saved"]) ?? null,
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

// Nombres alternativos en inglés, para hacer match con ClassPreset.skillChoices
// (que puede venir en inglés o español según cómo se haya sembrado la clase).
const SKILL_EN_NAMES: Record<string, string> = {
  acrobatics: "acrobatics",
  animalHandling: "animal handling",
  arcana: "arcana",
  athletics: "athletics",
  deception: "deception",
  history: "history",
  insight: "insight",
  intimidation: "intimidation",
  investigation: "investigation",
  medicine: "medicine",
  nature: "nature",
  perception: "perception",
  performance: "performance",
  persuasion: "persuasion",
  religion: "religion",
  sleightOfHand: "sleight of hand",
  stealth: "stealth",
  survival: "survival",
};

function normalizeSkillText(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// Convierte un nombre de habilidad tal como viene de ClassPreset.skillChoices
// (inglés o español) a la key interna usada en sheetData.proficiencies.skills.
function matchSkillKey(rawName: string): string | null {
  const normalized = normalizeSkillText(rawName);
  const found = skillLabels.find((s) => {
    if (normalizeSkillText(s.label) === normalized) return true;
    if (normalizeSkillText(SKILL_EN_NAMES[s.key]) === normalized) return true;
    return false;
  });
  return found?.key ?? null;
}

// Nombres de característica en inglés y español, para hacer match robusto
// con ClassPreset.savingThrows sin importar en qué idioma se sembró la clase.
const ABILITY_NAMES: Record<AbilityKey, { en: string; es: string; abbr: string }> = {
  strength: { en: "strength", es: "fuerza", abbr: "str" },
  dexterity: { en: "dexterity", es: "destreza", abbr: "dex" },
  constitution: { en: "constitution", es: "constitucion", abbr: "con" },
  intelligence: { en: "intelligence", es: "inteligencia", abbr: "int" },
  wisdom: { en: "wisdom", es: "sabiduria", abbr: "wis" },
  charisma: { en: "charisma", es: "carisma", abbr: "cha" },
};

function matchAbilityKey(rawName: string): AbilityKey | null {
  const normalized = normalizeSkillText(rawName);
  const found = (Object.keys(ABILITY_NAMES) as AbilityKey[]).find((key) => {
    const names = ABILITY_NAMES[key];
    return normalized === names.en || normalized === names.es || normalized === names.abbr;
  });
  return found ?? null;
}

// Determina si un arma del catálogo es compatible con las competencias de
// armas del personaje (categoría general "Simple/Marcial" o nombre específico
// de arma). Las entradas de proficiencies.weapons vienen del ClassPreset
// (texto libre, ej. "Simple Weapons", "Hand Crossbows") o pueden haber sido
// agregadas manualmente por el jugador.
function isWeaponProficient(weapon: { name: string; category: "simple" | "martial" }, entries: string[]): boolean {
  if (entries.length === 0) return true; // sin datos de competencia registrados: no restringir
  return entries.some((entry) => {
    const normalized = normalizeSkillText(entry);
    if (normalized.includes("simple") && weapon.category === "simple") return true;
    if ((normalized.includes("marcial") || normalized.includes("martial")) && weapon.category === "martial") return true;
    const weaponName = normalizeSkillText(weapon.name);
    // Comparación laxa por nombre específico (ej. "Rapiers" contiene "Rapier")
    return normalized.includes(weaponName) || weaponName.includes(normalized);
  });
}

function getImageUrl(path: string | null) {
  if (!path) return "";
  return path.startsWith("http") ? path : `${API_URL}${path}`;
}

function getModifier(score: number) { return Math.floor((score - 10) / 2); }
function signed(value: number) { return value >= 0 ? `+${value}` : String(value); }
function splitLines(value: string) { return value.split("\n").map((l) => l.trim()).filter(Boolean); }
function joinLines(value: string[]) { return value.join("\n"); }

// ─── Progresión de hechizos preparados/conocidos por clase ────────────────────
// "prepared-full"  → nivel + mod. de característica            (Mago, Clérigo, Druida)
// "prepared-half"  → ½ nivel (redondeo abajo) + mod., mín. 1    (Paladín)
// "prepared-halfUp"→ ½ nivel (redondeo arriba) + mod., mín. 1   (Artífice)
// "known"          → tabla fija por nivel, NO suma el mod.      (Bardo, Hechicero, Brujo, Explorador)
// Los nombres de clase vienen en inglés desde el catálogo (seed-class-presets.ts).
type SpellcastingProgressionType = "prepared-full" | "prepared-half" | "prepared-halfUp" | "known";

const SPELLCASTING_PROGRESSION: Record<string, SpellcastingProgressionType> = {
  wizard: "prepared-full",
  cleric: "prepared-full",
  druid: "prepared-full",
  paladin: "prepared-half",
  artificer: "prepared-halfUp",
  bard: "known",
  sorcerer: "known",
  warlock: "known",
  ranger: "known",
};

// Tablas SRD 5.1 de hechizos "conocidos" totales por nivel de personaje
// (no incluyen trucos, que se manejan aparte y no están limitados en la ficha).
const KNOWN_SPELLS_TABLE: Record<string, number[]> = {
  //                 nivel:1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20
  bard:     [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22],
  sorcerer: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15],
  warlock:  [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
  // El Explorador (SRD 5.1) no obtiene conjuros hasta nivel 2.
  ranger:   [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11],
};

// Tablas oficiales de TRUCOS (cantrips) conocidos por nivel de personaje.
// A diferencia de los hechizos de nivel 1+, los trucos siempre son una tabla
// fija por clase — ninguna clase suma el modificador de característica acá.
// Paladín y Explorador no obtienen trucos, por eso no están en la tabla.
const CANTRIPS_KNOWN_TABLE: Record<string, number[]> = {
  //                  nivel:1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20
  bard:      [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  cleric:    [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  druid:     [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  sorcerer:  [4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
  warlock:   [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  wizard:    [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  artificer: [2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4],
};

// ─── Componente principal ─────────────────────────────────────────────────────

export default function CharacterSheetPage() {
  const params = useParams<{ characterId: string }>();
  const characterId = params.characterId;

  const [character, setCharacter] = useState<Character | null>(null);
  const [sheetData, setSheetData] = useState<SheetData>(getDefaultSheetData(""));
  const isLocked = sheetData.meta.locked;
  const [classes, setClasses] = useState<ClassPreset[]>([]);
  const [races, setRaces] = useState<RacePreset[]>([]);
  const [backgrounds, setBackgrounds] = useState<BackgroundPreset[]>([]);
  const [weapons, setWeapons] = useState<WeaponPreset[]>([]);
  const [beasts, setBeasts] = useState<BeastPreset[]>([]);
  const [spellCatalog, setSpellCatalog] = useState<SpellPreset[]>([]);
  const [spellLevelFilter, setSpellLevelFilter] = useState<string>("all");
  const [selectedWeaponCatalogId, setSelectedWeaponCatalogId] = useState("");
  const [weaponAbilityChoice, setWeaponAbilityChoice] = useState<"strength" | "dexterity">("strength");
  const [weaponIsProficient, setWeaponIsProficient] = useState(true);
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

  // Habilidades que otorga el trasfondo activo — se usa para no "robarle" un
  // cupo de elección de clase a una habilidad que ya viene por trasfondo, y
  // para no desmarcar por error una habilidad elegida por clase al cambiar
  // de trasfondo.
  const activeBackground = backgrounds.find((b) => b.id === selectedBackgroundId) ?? null;
  const backgroundGrantedKeys = new Set(
    (activeBackground?.skillProficiencies ?? []).map((s) => matchSkillKey(s)).filter((k): k is string => Boolean(k))
  );

  // Nivel mínimo para elegir subclase — usamos el nivel más bajo de sus rasgos, o 3 por defecto
  const subclassUnlockLevel = useMemo(() => {
    if (!selectedClass || availableSubclasses.length === 0) return null;
    const levels = availableSubclasses
      .flatMap((s) => s.features?.map((f) => f.level) ?? [])
      .filter((l) => l > 0);
    return levels.length > 0 ? Math.min(...levels) : 3;
  }, [selectedClass, availableSubclasses]);

  const canPickSubclass = subclassUnlockLevel !== null && sheetData.identity.level >= subclassUnlockLevel;

  // Mismos niveles de Mejora de Puntuación de Característica (ASI) que usa
  // el backend al subir de nivel (backend/src/routes/games.routes.ts,
  // getAsiLevels) — se duplica acá porque este campo "Nivel" se puede editar
  // directamente desde la ficha, sin pasar por ese endpoint.
  function getAsiLevels(classId: string | null) {
    if (classId === "fighter") return [4, 6, 8, 12, 14, 16, 19];
    if (classId === "rogue") return [4, 8, 10, 12, 16, 19];
    return [4, 8, 12, 16, 19];
  }

  // Al editar el nivel a mano, detecta si se cruzó un umbral de mejora de
  // característica o de elección de subclase que todavía no esté pendiente
  // ni ya resuelto, y lo agrega a pendingLevelChoices — si no, esos umbrales
  // solo se generaban desde el botón de "Subir de nivel" del DM, que nadie
  // usa cuando se edita el nivel directo en la ficha.
  function handleLevelChange(rawNewLevel: number) {
    const oldLevel = sheetData.identity.level;
    // El nivel de personaje nunca debe poder bajar (subir de nivel es
    // permanente en D&D) — sea cual sea el origen del cambio, se limita
    // acá también, no solo con el `min` del campo del formulario.
    const newLevel = Math.max(oldLevel, Math.min(20, rawNewLevel));
    const nextPending = [...sheetData.pendingLevelChoices];

    if (newLevel > oldLevel) {
      if (
        subclassUnlockLevel !== null &&
        newLevel >= subclassUnlockLevel &&
        !selectedSubclassId &&
        !nextPending.some((c) => c.type === "SUBCLASS")
      ) {
        nextPending.push({
          type: "SUBCLASS",
          level: newLevel,
          classId: selectedClassId || null,
          message: "Elegir subclase.",
          createdAt: new Date().toISOString(),
        });
      }

      getAsiLevels(selectedClassId || null).forEach((asiLevel) => {
        if (
          asiLevel > oldLevel &&
          asiLevel <= newLevel &&
          !nextPending.some((c) => c.type === "ABILITY_SCORE_IMPROVEMENT" && c.level === asiLevel)
        ) {
          nextPending.push({
            type: "ABILITY_SCORE_IMPROVEMENT",
            level: asiLevel,
            message: `Pendiente mejora de característica o dote (nivel ${asiLevel}).`,
            createdAt: new Date().toISOString(),
          });
        }
      });
    }

    void persistSheetData({
      ...sheetData,
      identity: { ...sheetData.identity, level: newLevel },
      pendingLevelChoices: nextPending,
    });
  }

  // ─── Auto-cálculo: Bonif. competencia según nivel ──────────────────────────
  const computedProficiencyBonus = useMemo(
    () => Math.ceil(sheetData.identity.level / 4) + 1,
    [sheetData.identity.level]
  );

  useEffect(() => {
    if (sheetData.proficiencies.proficiencyBonus === computedProficiencyBonus) return;
    setSheetData((prev) => ({
      ...prev,
      proficiencies: { ...prev.proficiencies, proficiencyBonus: computedProficiencyBonus },
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedProficiencyBonus]);

  // ─── Auto-cálculo: Iniciativa = modificador de Destreza ────────────────────
  const computedInitiative = useMemo(
    () => getModifier(sheetData.abilities.dexterity),
    [sheetData.abilities.dexterity]
  );

  useEffect(() => {
    if (sheetData.combat.initiative === computedInitiative) return;
    setSheetData((prev) => ({ ...prev, combat: { ...prev.combat, initiative: computedInitiative } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedInitiative]);

  // ─── Auto-cálculo: Clase de Armadura ────────────────────────────────────────
  // Base: 10 + Destreza. Si la clase tiene "Defensa sin Armadura" (Bárbaro,
  // Monje), se detecta desde los rasgos de la clase y se suma la característica
  // correspondiente (Constitución o Sabiduría) además de Destreza.
  const unarmoredDefenseAbility = useMemo((): AbilityKey | null => {
    const feature = selectedClass?.features.find((f) => {
      const name = f.name.toLowerCase();
      return name.includes("unarmored defense") || name.includes("defensa sin armadura");
    });
    if (!feature) return null;
    const summary = feature.summary.toLowerCase();
    if (summary.includes("constituc")) return "constitution";
    if (summary.includes("sabidur")) return "wisdom";
    return null;
  }, [selectedClass]);

  const computedBaseAc = useMemo(() => {
    const dexMod = getModifier(sheetData.abilities.dexterity);
    const bonusMod = unarmoredDefenseAbility ? getModifier(sheetData.abilities[unarmoredDefenseAbility]) : 0;
    return 10 + dexMod + bonusMod;
  }, [sheetData.abilities, unarmoredDefenseAbility]);

  useEffect(() => {
    setSheetData((prev) => ({ ...prev, combat: { ...prev.combat, armorClass: computedBaseAc } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedBaseAc]);

  // ─── PG máximos: sigue siendo editable (depende de la tirada del dado), ────
  // pero se sugiere un valor que ya incluye el modificador de Constitución.
  const suggestedMaxHp = useMemo(() => {
    if (!selectedClass) return null;
    const level = Math.max(1, sheetData.identity.level);
    const conMod = getModifier(sheetData.abilities.constitution);
    const hitDie = selectedClass.hitDie;
    const averagePerLevel = Math.floor(hitDie / 2) + 1;
    const hp = hitDie + conMod + (level - 1) * (averagePerLevel + conMod);
    return Math.max(1, hp);
  }, [selectedClass, sheetData.identity.level, sheetData.abilities.constitution]);

  // Solo actualiza el texto informativo de dados de golpe (no toca los PG)
  useEffect(() => {
    if (!selectedClass) return;
    const dice = `${sheetData.identity.level}d${selectedClass.hitDie}`;
    setSheetData((prev) => ({
      ...prev,
      combat: { ...prev.combat, hitDiceTotal: dice, hitDiceCurrent: dice },
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetData.identity.level, selectedClass?.hitDie]);

  // ─── Auto-cálculo: CD salvación y Bonif. ataque de hechizos ─────────────────
  const spellAbilityKey = sheetData.spells.spellcastingAbility as AbilityKey | "";
  const computedSpellSaveDc = useMemo(() => {
    if (!spellAbilityKey || !(spellAbilityKey in sheetData.abilities)) return 0;
    return 8 + computedProficiencyBonus + getModifier(sheetData.abilities[spellAbilityKey]);
  }, [spellAbilityKey, computedProficiencyBonus, sheetData.abilities]);

  const computedSpellAttackBonus = useMemo(() => {
    if (!spellAbilityKey || !(spellAbilityKey in sheetData.abilities)) return 0;
    return computedProficiencyBonus + getModifier(sheetData.abilities[spellAbilityKey]);
  }, [spellAbilityKey, computedProficiencyBonus, sheetData.abilities]);

  useEffect(() => {
    if (
      sheetData.spells.spellSaveDc === computedSpellSaveDc &&
      sheetData.spells.spellAttackBonus === computedSpellAttackBonus
    ) return;
    setSheetData((prev) => ({
      ...prev,
      spells: { ...prev.spells, spellSaveDc: computedSpellSaveDc, spellAttackBonus: computedSpellAttackBonus },
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedSpellSaveDc, computedSpellAttackBonus]);

  useEffect(() => {
    if (!canPickSubclass && selectedSubclassId) {
      setSelectedSubclassId("");
      setSheetData((prev) => ({ ...prev, identity: { ...prev.identity, subclassName: "" } }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canPickSubclass]);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId]);

  async function loadAll() {
    if (!characterId) return;
    setIsLoading(true);
    setError("");

    try {
      const [charRes, classesRes, racesRes, backgroundsRes, weaponsRes, spellsRes, beastsRes] = await Promise.all([
        fetch(`${API_URL}/characters/${characterId}`, { credentials: "include" }),
        fetch(`${API_URL}/presets/classes`, { credentials: "include" }),
        fetch(`${API_URL}/presets/races`, { credentials: "include" }),
        fetch(`${API_URL}/presets/backgrounds`, { credentials: "include" }),
        fetch(`${API_URL}/presets/weapons`, { credentials: "include" }),
        fetch(`${API_URL}/presets/spells`, { credentials: "include" }),
        fetch(`${API_URL}/presets/beasts`, { credentials: "include" }),
      ]);

      if (charRes.status === 401) {
        window.location.href = `/login?redirect=${encodeURIComponent(`/characters/${characterId}`)}`;
        return;
      }

      const [charData, classesData, racesData, backgroundsData, weaponsData, spellsData, beastsData] = await Promise.all([
        charRes.json().catch(() => null),
        classesRes.json().catch(() => null),
        racesRes.json().catch(() => null),
        backgroundsRes.json().catch(() => null),
        weaponsRes.json().catch(() => null),
        spellsRes.json().catch(() => null),
        beastsRes.json().catch(() => null),
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

      // La ficha ya trae guardadas las competencias de clase elegidas
      // (sheetData.proficiencies.classSkillChoices). Si no marcamos acá que
      // la clase actual ya fue "aplicada", el useEffect de más abajo (pensado
      // para cuando el jugador CAMBIA de clase en el selector) va a creer que
      // se acaba de asignar una clase nueva y va a resetear esas elecciones
      // a cero apenas se abre la ficha para editarla.
      appliedClassIdRef.current = loadedChar.classId ?? "";

      setClasses((classesData?.classes ?? []) as ClassPreset[]);
      setRaces((racesData?.races ?? []) as RacePreset[]);
      setBackgrounds((backgroundsData?.backgrounds ?? []) as BackgroundPreset[]);
      setWeapons((weaponsData?.weapons ?? []) as WeaponPreset[]);
      setSpellCatalog((spellsData?.spells ?? []) as SpellPreset[]);
      setBeasts((beastsData?.beasts ?? []) as BeastPreset[]);
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setIsLoading(false);
    }
  }

  // Cuando el jugador cambia de clase, auto-rellenar dados golpe, competencias de salvación y clase lanzadora
  // Ref que recuerda qué clase fue la última cuyas competencias se aplicaron.
  // null = todavía no se ha aplicado ninguna (incluye la carga inicial de un
  // personaje ya existente, para que sus competencias se autocompleten sin
  // que el jugador tenga que volver a tocar el selector de clase).
  const appliedClassIdRef = useRef<string | null>(null);

  function handleClassChange(classId: string) {
    setSelectedClassId(classId);
    setSelectedSubclassId("");
  }

  useEffect(() => {
    if (!selectedClass) return;
    if (appliedClassIdRef.current === selectedClassId) return;

    const previousClass = classes.find((c) => c.id === appliedClassIdRef.current) ?? null;
    const cls = selectedClass;

    setSheetData((prev) => {
      const level = prev.identity.level;
      const maxHp = cls.hitDie + getModifier(prev.abilities.constitution);

      // Salvaciones: siempre se recalculan desde cero, son fijas por clase.
      const newSavingThrows = { ...prev.proficiencies.savingThrows };
      (Object.keys(newSavingThrows) as AbilityKey[]).forEach((k) => { newSavingThrows[k] = false; });
      cls.savingThrows.forEach((s) => {
        const key = matchAbilityKey(s);
        if (key) newSavingThrows[key] = true;
      });

      // Armadura/armas/herramientas: quitar lo que otorgaba la clase anterior
      // (si había) y agregar lo de la nueva, sin duplicar ni perder entradas manuales.
      function replaceClassEntries(current: string[], removeList: string[], addList: string[]) {
        const removeSet = new Set(removeList.map((s) => s.trim().toLowerCase()));
        const kept = current.filter((entry) => !removeSet.has(entry.trim().toLowerCase()));
        const addSet = new Set(kept.map((s) => s.trim().toLowerCase()));
        const toAdd = addList.filter((entry) => !addSet.has(entry.trim().toLowerCase()));
        return [...kept, ...toAdd];
      }

      const newArmor = replaceClassEntries(
        prev.proficiencies.armor,
        previousClass?.armorTraining ?? [],
        cls.armorTraining ?? []
      );
      const newWeapons = replaceClassEntries(
        prev.proficiencies.weapons,
        previousClass?.weaponTraining ?? [],
        cls.weaponTraining ?? []
      );
      const newTools = replaceClassEntries(
        prev.proficiencies.tools,
        previousClass?.toolTraining ?? [],
        cls.toolTraining ?? []
      );

      // Las habilidades de clase son una ELECCIÓN del jugador, no se autocompletan.
      // Al cambiar de clase, se reinician las elecciones de clase (empiezas de
      // cero con la nueva lista) — pero si una de esas habilidades también la
      // otorga el trasfondo activo, no se apaga (sigue siendo tuya por esa vía).
      const activeBg = backgrounds.find((b) => b.id === selectedBackgroundId) ?? null;
      const bgKeys = new Set(
        (activeBg?.skillProficiencies ?? []).map((s) => matchSkillKey(s)).filter((k): k is string => Boolean(k))
      );
      const newSkills = { ...prev.proficiencies.skills };
      prev.proficiencies.classSkillChoices.forEach((key) => {
        if (!bgKeys.has(key)) newSkills[key] = false;
      });

      return {
        ...prev,
        identity: { ...prev.identity, className: cls.name, subclassName: previousClass ? "" : prev.identity.subclassName },
        combat: {
          ...prev.combat,
          hitDiceTotal: `${level}d${cls.hitDie}`,
          hitDiceCurrent: `${level}d${cls.hitDie}`,
          maxHp,
          currentHp: previousClass ? maxHp : prev.combat.currentHp,
        },
        proficiencies: {
          ...prev.proficiencies,
          savingThrows: newSavingThrows,
          armor: newArmor,
          weapons: newWeapons,
          tools: newTools,
          skills: newSkills,
          classSkillChoices: [],
        },
        spells: {
          ...prev.spells,
          spellcastingAbility: cls.spellcastingAbility ?? prev.spells.spellcastingAbility,
          spellcastingClass: cls.name,
        },
      };
    });

    appliedClassIdRef.current = selectedClassId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassId, classes]);

  // Cuando cambia la raza, auto-rellenar velocidad y bonificadores de atributo
  function handleRaceChange(raceId: string) {
    // Capturamos la raza anterior ANTES de actualizar el estado, para poder
    // revertir sus bonificadores y que no se acumulen con la nueva raza.
    const previousRace = races.find((r) => r.id === selectedRaceId) ?? null;
    const newRace = races.find((r) => r.id === raceId) ?? null;

    setSelectedRaceId(raceId);

    setSheetData((prev) => {
      const newAbilities = { ...prev.abilities };

      // 1. Revertir los bonificadores de la raza anterior (si había una)
      if (previousRace) {
        (Object.entries(previousRace.abilityBonuses) as [AbilityKey, number][]).forEach(([key, bonus]) => {
          newAbilities[key] = (newAbilities[key] ?? 10) - bonus;
        });
      }

      // 2. Si se eligió una raza nueva, aplicar sus bonificadores sobre el valor ya limpio.
      // Si se deseleccionó (raceId === ""), solo queda revertido, sin nada nuevo que sumar.
      if (newRace) {
        (Object.entries(newRace.abilityBonuses) as [AbilityKey, number][]).forEach(([key, bonus]) => {
          newAbilities[key] = (newAbilities[key] ?? 10) + bonus;
        });
      }

      return {
        ...prev,
        identity: { ...prev.identity, race: newRace?.name ?? "" },
        combat: { ...prev.combat, speed: newRace?.speed ?? prev.combat.speed },
        abilities: newAbilities,
      };
    });
  }

  // Cuando cambia el trasfondo, agregar las competencias en habilidades
  function handleBackgroundChange(backgroundId: string) {
    // Capturamos el trasfondo anterior ANTES de actualizar el estado, para
    // poder destildar sus habilidades y que no queden "colgadas" si se
    // cambia a otro trasfondo (o se deselecciona).
    const previousBg = backgrounds.find((b) => b.id === selectedBackgroundId) ?? null;
    const bg = backgrounds.find((b) => b.id === backgroundId) ?? null;

    setSelectedBackgroundId(backgroundId);

    setSheetData((prev) => {
      const newSkills = { ...prev.proficiencies.skills };

      // 1. Destildar las habilidades que otorgaba el trasfondo anterior
      //    (si había uno), a menos que el trasfondo nuevo también las otorgue
      //    O que el jugador las haya elegido explícitamente por clase.
      const newKeys = new Set(
        (bg?.skillProficiencies ?? []).map((s) => matchSkillKey(s)).filter((k): k is string => Boolean(k))
      );
      if (previousBg) {
        previousBg.skillProficiencies.forEach((s) => {
          const key = matchSkillKey(s);
          if (key && !newKeys.has(key) && !prev.proficiencies.classSkillChoices.includes(key)) {
            newSkills[key] = false;
          }
        });
      }

      // 2. Tildar las habilidades del trasfondo nuevo. A diferencia de las
      //    habilidades de clase (que el jugador elige), las de trasfondo son
      //    fijas en D&D 5e, así que se marcan automáticamente.
      newKeys.forEach((key) => { newSkills[key] = true; });

      return {
        ...prev,
        identity: { ...prev.identity, background: bg?.name ?? "" },
        proficiencies: { ...prev.proficiencies, skills: newSkills },
      };
    });
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

  // ─── Forma Salvaje ──────────────────────────────────────────────────────────
  const isDruid = selectedClassId === DRUID_CLASS_ID;
  const isMoonDruid = selectedSubclassId === MOON_DRUID_SUBCLASS_ID;
  const eligibleBeasts = useMemo(() => {
    if (!isDruid) return [];
    return beasts
      .filter((b) => isBeastEligible(b, sheetData.identity.level, isMoonDruid))
      .sort((a, b) => a.cr - b.cr || a.name.localeCompare(b.name));
  }, [beasts, isDruid, isMoonDruid, sheetData.identity.level]);

  // Guarda sheetData + (opcionalmente) el token del personaje con una
  // petición liviana — NO usa saveCharacter() porque esa función bloquea
  // clase/raza/atributos/habilidades en el primer guardado. La usan Forma
  // Salvaje y la resolución de mejoras de nivel pendientes (ninguna de las
  // dos debería disparar ese bloqueo).
  async function persistSheetData(nextSheetData: SheetData, tokenImagePath?: string | null, extra?: Record<string, unknown>) {
    if (!characterId) return;
    setSheetData(nextSheetData);
    try {
      const response = await fetch(`${API_URL}/characters/${characterId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetData: nextSheetData,
          syncCombatant: true,
          ...(tokenImagePath !== undefined ? { tokenImagePath } : {}),
          ...(extra ?? {}),
        }),
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.character) {
        setCharacter(data.character as Character);
      }
    } catch {
      setError("No se pudo conectar con el backend.");
    }
  }

  function transformInto(beast: BeastPreset) {
    if (sheetData.wildShape.usesRemaining <= 0 && !sheetData.wildShape.active) return;

    // Si ya estaba transformado, no se gasta un uso extra por cambiar de
    // bestia (regla de 5e); solo se gasta al pasar de forma normal a bestia.
    const spendUse = !sheetData.wildShape.active;
    const saved = sheetData.wildShape.saved ?? {
      armorClass: sheetData.combat.armorClass,
      speed: sheetData.combat.speed,
      maxHp: sheetData.combat.maxHp,
      currentHp: sheetData.combat.currentHp,
      temporaryHp: sheetData.combat.temporaryHp,
      hitDiceTotal: sheetData.combat.hitDiceTotal,
      hitDiceCurrent: sheetData.combat.hitDiceCurrent,
      attacks: sheetData.attacks,
      tokenImagePath: character?.tokenImagePath ?? null,
    };

    const next: SheetData = {
      ...sheetData,
      combat: {
        ...sheetData.combat,
        armorClass: beast.ac,
        speed: primaryBeastSpeed(beast),
        maxHp: beast.hp,
        currentHp: beast.hp,
        temporaryHp: 0,
        hitDiceTotal: beast.hitDice,
        hitDiceCurrent: beast.hitDice,
      },
      attacks: beast.attacks,
      wildShape: {
        ...sheetData.wildShape,
        active: true,
        beastId: beast.id,
        beastName: beast.name,
        usesRemaining: spendUse ? Math.max(0, sheetData.wildShape.usesRemaining - 1) : sheetData.wildShape.usesRemaining,
        saved,
      },
    };

    void persistSheetData(next, beast.tokenImagePath ?? null);
  }

  // excessDamage: si la reversión ocurre porque los PG de la bestia llegaron
  // a 0, el daño sobrante pasa al personaje (regla de 5e).
  function revertWildShape(excessDamage = 0) {
    const saved = sheetData.wildShape.saved;
    if (!saved) {
      void persistSheetData({ ...sheetData, wildShape: { ...sheetData.wildShape, active: false, beastId: null, beastName: "" } });
      return;
    }
    const next: SheetData = {
      ...sheetData,
      combat: {
        ...sheetData.combat,
        armorClass: saved.armorClass,
        speed: saved.speed,
        maxHp: saved.maxHp,
        currentHp: Math.max(0, saved.currentHp - excessDamage),
        temporaryHp: saved.temporaryHp,
        hitDiceTotal: saved.hitDiceTotal,
        hitDiceCurrent: saved.hitDiceCurrent,
      },
      attacks: saved.attacks,
      wildShape: { ...sheetData.wildShape, active: false, beastId: null, beastName: "", saved: null },
    };
    void persistSheetData(next, saved.tokenImagePath);
  }

  function restoreWildShapeUses() {
    void persistSheetData({ ...sheetData, wildShape: { ...sheetData.wildShape, usesRemaining: sheetData.wildShape.usesMax } });
  }

  // ─── Mejoras de nivel pendientes (ABILITY_SCORE_IMPROVEMENT / SUBCLASS) ────
  // El backend marca estas mejoras como pendientes al subir de nivel
  // (POST .../level-up), pero no hay otro lugar en la ficha donde resolverlas
  // — y los inputs de atributos/subclase quedan bloqueados tras el primer
  // guardado. Este flujo es la única vía autorizada para tocarlos después.
  const pendingAsi = sheetData.pendingLevelChoices.find((c) => c.type === "ABILITY_SCORE_IMPROVEMENT") ?? null;
  const pendingSubclassChoice = sheetData.pendingLevelChoices.find((c) => c.type === "SUBCLASS") ?? null;

  const [asiAllocation, setAsiAllocation] = useState<Record<AbilityKey, number>>({
    strength: 0, dexterity: 0, constitution: 0, intelligence: 0, wisdom: 0, charisma: 0,
  });
  const asiPointsUsed = (Object.values(asiAllocation) as number[]).reduce((sum, v) => sum + v, 0);

  useEffect(() => {
    setAsiAllocation({ strength: 0, dexterity: 0, constitution: 0, intelligence: 0, wisdom: 0, charisma: 0 });
  }, [pendingAsi?.createdAt]);

  function adjustAsiPoint(key: AbilityKey, delta: 1 | -1) {
    setAsiAllocation((prev) => {
      const nextValue = prev[key] + delta;
      if (nextValue < 0 || nextValue > 2) return prev;
      if (delta > 0 && asiPointsUsed >= 2) return prev;
      if (delta > 0 && sheetData.abilities[key] + nextValue > 20) return prev;
      return { ...prev, [key]: nextValue };
    });
  }

  function applyAbilityScoreImprovement() {
    if (!pendingAsi || asiPointsUsed !== 2) return;

    const nextAbilities = { ...sheetData.abilities };
    (Object.keys(asiAllocation) as AbilityKey[]).forEach((key) => {
      nextAbilities[key] = Math.min(20, nextAbilities[key] + asiAllocation[key]);
    });

    const nextPending = sheetData.pendingLevelChoices.filter((c) => c !== pendingAsi);
    void persistSheetData({ ...sheetData, abilities: nextAbilities, pendingLevelChoices: nextPending });
  }

  function resolvePendingSubclass(subclassId: string) {
    if (!pendingSubclassChoice) return;
    const sub = availableSubclasses.find((s) => s.id === subclassId);
    if (!sub) return;

    setSelectedSubclassId(subclassId);
    const nextPending = sheetData.pendingLevelChoices.filter((c) => c !== pendingSubclassChoice);
    void persistSheetData(
      { ...sheetData, identity: { ...sheetData.identity, subclassName: sub.name }, pendingLevelChoices: nextPending },
      undefined,
      { subclassId },
    );
  }

  // Enganchado desde el input de "PG actuales": si estás transformado y los
  // PG bajan a 0, revierte automáticamente y pasa el daño sobrante al personaje.
  function handleCurrentHpChange(value: number) {
    if (sheetData.wildShape.active && value <= 0) {
      revertWildShape(Math.abs(value));
      return;
    }
    update({ ...sheetData, combat: { ...sheetData.combat, currentHp: value } });
  }

  async function saveCharacter() {
    if (!character || !characterId) return;
    setIsSaving(true);
    setError("");
    setMessage("");

    const characterName = sheetData.identity.characterName.trim() || character.name;

    // Regla de mesa: una vez que se guarda la ficha, clase, raza, atributos
    // y habilidades quedan fijos. Si todavía no estaba bloqueada, este
    // guardado es el que la bloquea (a partir de aquí esos campos no se
    // pueden volver a editar desde la ficha).
    const nextSheetData = {
      ...sheetData,
      meta: { ...sheetData.meta, locked: true },
      identity: { ...sheetData.identity, characterName },
    };

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
          sheetData: nextSheetData,
          syncCombatant: true,
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

  // Agrega un ataque desde el catálogo de armas, calculando bono y daño automáticamente
  function addAttackFromCatalog() {
    const weapon = weapons.find((w) => w.id === selectedWeaponCatalogId);
    if (!weapon) return;

    const ability = weapon.isFinesse ? weaponAbilityChoice : weapon.attackType === "ranged" ? "dexterity" : "strength";
    const abilityMod = getModifier(sheetData.abilities[ability]);
    const attackBonusValue = abilityMod + (weaponIsProficient ? sheetData.proficiencies.proficiencyBonus : 0);
    const attackBonus = signed(attackBonusValue);

    const damageModText = abilityMod !== 0 ? (abilityMod > 0 ? `+${abilityMod}` : `${abilityMod}`) : "";
    const damage = `${weapon.damageDice}${damageModText} ${weapon.damageType}`;

    update({
      ...sheetData,
      attacks: [...sheetData.attacks, { name: weapon.name, attackBonus, damage }],
    });

    setSelectedWeaponCatalogId("");
  }

  const selectedCatalogWeapon = weapons.find((w) => w.id === selectedWeaponCatalogId) ?? null;

  // Máximo de hechizos (no trucos) que el personaje puede tener marcados como
  // conocidos/preparados. Depende del tipo de lanzador de su clase — ver
  // SPELLCASTING_PROGRESSION / KNOWN_SPELLS_TABLE más arriba. Si la clase no
  // está mapeada (p. ej. una subclase de "tercio de lanzador" como Caballero
  // Arcano) o no hay clase/característica seleccionada, se usa la fórmula
  // genérica de lanzador preparado completo como aproximación razonable.
  const maxPreparedSpells = useMemo(() => {
    if (!spellAbilityKey || !(spellAbilityKey in sheetData.abilities)) return null;

    const level = sheetData.identity.level;
    const mod = getModifier(sheetData.abilities[spellAbilityKey]);
    const className = selectedClass?.name.toLowerCase() ?? "";
    const progressionType = SPELLCASTING_PROGRESSION[className];

    if (progressionType === "known") {
      const table = KNOWN_SPELLS_TABLE[className];
      const clampedLevel = Math.min(Math.max(level, 1), 20);
      return table ? table[clampedLevel - 1] : Math.max(1, level + mod);
    }

    if (progressionType === "prepared-half") {
      return Math.max(1, Math.floor(level / 2) + mod);
    }

    if (progressionType === "prepared-halfUp") {
      return Math.max(1, Math.ceil(level / 2) + mod);
    }

    // "prepared-full" y cualquier clase sin mapear.
    return Math.max(1, level + mod);
  }, [spellAbilityKey, sheetData.abilities, sheetData.identity.level, selectedClass]);

  const preparationLabel = useMemo(() => {
    const className = selectedClass?.name.toLowerCase() ?? "";
    return SPELLCASTING_PROGRESSION[className] === "known" ? "conocidos" : "preparados";
  }, [selectedClass]);

  const knownPreparedSpellsCount = useMemo(() => {
    return Array.from({ length: 9 }, (_, i) => String(i + 1)).reduce(
      (total, lvl) => total + (sheetData.spells.spellsByLevel[lvl]?.length ?? 0),
      0
    );
  }, [sheetData.spells.spellsByLevel]);

  // Máximo de trucos (cantrips) conocidos — tabla fija por clase, no depende
  // de la característica. Clases sin tabla (p. ej. Paladín, Explorador) no
  // obtienen trucos por reglas, así que el máximo queda en 0. Si no hay una
  // clase mapeada, no se aplica límite (null) para no bloquear casos raros.
  const maxCantrips = useMemo(() => {
    const className = selectedClass?.name.toLowerCase() ?? "";
    if (!className) return null;
    if (className in CANTRIPS_KNOWN_TABLE) {
      const level = Math.min(Math.max(sheetData.identity.level, 1), 20);
      return CANTRIPS_KNOWN_TABLE[className][level - 1];
    }
    if (className in SPELLCASTING_PROGRESSION) return 0; // clase lanzadora sin trucos (Paladín, Explorador)
    return null; // clase no lanzadora / no mapeada
  }, [selectedClass, sheetData.identity.level]);

  const knownCantripsCount = sheetData.spells.spellsByLevel["0"]?.length ?? 0;

  function toggleSpell(level: string, spellName: string) {
    const current = sheetData.spells.spellsByLevel[level] ?? [];
    const isKnown = current.includes(spellName);

    // Si es un hechizo (no truco) y ya se llegó al límite, no dejar marcar
    // uno nuevo — pero sí dejar desmarcar los ya elegidos siempre.
    if (!isKnown && level !== "0" && maxPreparedSpells !== null && knownPreparedSpellsCount >= maxPreparedSpells) {
      return;
    }

    // Mismo criterio para trucos, con su propio límite (tabla fija).
    if (!isKnown && level === "0" && maxCantrips !== null && knownCantripsCount >= maxCantrips) {
      return;
    }

    const updated = isKnown ? current.filter((n) => n !== spellName) : [...current, spellName];
    update({
      ...sheetData,
      spells: { ...sheetData.spells, spellsByLevel: { ...sheetData.spells.spellsByLevel, [level]: updated } },
    });
  }

  // Hechizos del catálogo disponibles para la clase del personaje
  const classSpells = selectedClass
    ? spellCatalog.filter((s) => s.classes.some((c) => c.toLowerCase() === selectedClass.name.toLowerCase()))
    : [];

  const filteredClassSpells = spellLevelFilter === "all"
    ? classSpells
    : classSpells.filter((s) => String(s.level) === spellLevelFilter);

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
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-yellow-400">
              {isLocked ? "Ficha bloqueada" : "Ficha editable"}
            </p>
            <h1 className="mt-2 text-3xl font-black">{sheetData.identity.characterName || character.name}</h1>
            <p className="mt-2 text-zinc-400">
              Nivel {sheetData.identity.level} · {sheetData.identity.race || "Sin raza"} · {sheetData.identity.className || "Sin clase"}
            </p>
            {isLocked && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500">
                🔒 Clase, raza, atributos y habilidades quedaron fijos al guardar la ficha.
              </p>
            )}
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

        {(pendingAsi || pendingSubclassChoice) && (
          <section className="mb-6 space-y-4 rounded-3xl border border-yellow-500/40 bg-yellow-500/10 p-6 shadow-2xl">
            <h2 className="text-xl font-black text-yellow-200">⬆ Mejoras de nivel pendientes</h2>

            {pendingSubclassChoice && (
              <div className="rounded-2xl border border-yellow-500/30 bg-zinc-950/60 p-4">
                <p className="text-sm font-bold text-yellow-100">{pendingSubclassChoice.message}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <select
                    value=""
                    onChange={(e) => e.target.value && resolvePendingSubclass(e.target.value)}
                    className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-yellow-400"
                  >
                    <option value="">— Elegir subclase —</option>
                    {availableSubclasses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
            )}

            {pendingAsi && (
              <div className="rounded-2xl border border-yellow-500/30 bg-zinc-950/60 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-yellow-100">{pendingAsi.message}</p>
                  <span className="rounded-full border border-yellow-500/40 px-2.5 py-0.5 text-xs font-bold text-yellow-200">
                    {asiPointsUsed}/2 puntos
                  </span>
                </div>
                <p className="mt-1 text-xs text-yellow-200/70">
                  Reparte 2 puntos entre tus características (máx. +2 a una sola, tope 20).
                </p>

                <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
                  {abilityLabels.map((ability) => (
                    <div key={ability.key} className="flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2">
                      <div>
                        <p className="text-xs font-bold text-zinc-400">{ability.short}</p>
                        <p className="text-sm font-black text-white">
                          {sheetData.abilities[ability.key]}
                          {asiAllocation[ability.key] > 0 && (
                            <span className="text-yellow-300"> +{asiAllocation[ability.key]}</span>
                          )}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button type="button" onClick={() => adjustAsiPoint(ability.key, 1)}
                          disabled={asiPointsUsed >= 2 || asiAllocation[ability.key] >= 2 || sheetData.abilities[ability.key] + asiAllocation[ability.key] >= 20}
                          className="rounded-md border border-zinc-700 px-2 text-xs font-bold text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40">
                          +
                        </button>
                        <button type="button" onClick={() => adjustAsiPoint(ability.key, -1)}
                          disabled={asiAllocation[ability.key] <= 0}
                          className="rounded-md border border-zinc-700 px-2 text-xs font-bold text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40">
                          −
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button type="button" onClick={applyAbilityScoreImprovement} disabled={asiPointsUsed !== 2}
                  className="mt-4 w-full rounded-xl bg-yellow-500 px-4 py-3 font-black text-zinc-950 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50">
                  Confirmar mejora
                </button>
              </div>
            )}
          </section>
        )}

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

            <Card title="Atributos" action={isLocked ? <LockedBadge /> : undefined}>
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
                      <input type="number" value={score} disabled={isLocked}
                        onChange={(e) => update({ ...sheetData, abilities: { ...sheetData.abilities, [ability.key]: Number(e.target.value) } })}
                        className="mt-3 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-center font-bold outline-none transition focus:border-yellow-400 disabled:cursor-not-allowed disabled:opacity-50" />
                      <label className="mt-2 flex items-center gap-2 text-xs text-zinc-400 cursor-pointer has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
                        <input type="checkbox" checked={hasSaveProf} disabled={isLocked}
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
            <Card title="Habilidades" action={isLocked ? <LockedBadge /> : undefined}>
              <div className="space-y-1">
                {skillLabels.map((skill) => {
                  const hasProficiency = sheetData.proficiencies.skills[skill.key] ?? false;
                  const abilityMod = getModifier(sheetData.abilities[skill.ability]);
                  const total = abilityMod + (hasProficiency ? sheetData.proficiencies.proficiencyBonus : 0);
                  return (
                    <label key={skill.key} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-zinc-800 cursor-pointer has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:disabled]:hover:bg-transparent">
                      <input type="checkbox" checked={hasProficiency} disabled={isLocked}
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
                  onChange={handleLevelChange} min={sheetData.identity.level} max={20} />

                {/* Clase — selector de DB */}
                <div>
                  <label className="mb-1 block text-sm font-bold text-zinc-300">Clase</label>
                  <select value={selectedClassId} onChange={(e) => handleClassChange(e.target.value)} disabled={isLocked}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none transition focus:border-yellow-400 disabled:cursor-not-allowed disabled:opacity-50">
                    <option value="">— Seleccionar —</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name} (d{c.hitDie})</option>)}
                  </select>
                  {selectedClass && (
                    <p className="mt-1 text-xs text-zinc-500">
                      Salvaciones: {selectedClass.savingThrows.join(", ")}
                    </p>
                  )}
                </div>

                {/* Subclase — depende de clase seleccionada y nivel */}
                <div>
                  <label className="mb-1 block text-sm font-bold text-zinc-300">Subclase</label>
                  <select value={selectedSubclassId} onChange={(e) => handleSubclassChange(e.target.value)}
                    disabled={isLocked || availableSubclasses.length === 0 || !canPickSubclass}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none transition focus:border-yellow-400 disabled:cursor-not-allowed disabled:opacity-50">
                    <option value="">— Seleccionar —</option>
                    {availableSubclasses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {availableSubclasses.length > 0 && !canPickSubclass && (
                    <p className="mt-1 text-xs text-yellow-400">
                      Se desbloquea en el nivel {subclassUnlockLevel}.
                    </p>
                  )}
                </div>

                {/* Raza — selector de DB */}
                <div>
                  <label className="mb-1 block text-sm font-bold text-zinc-300">Raza</label>
                  <select value={selectedRaceId} onChange={(e) => handleRaceChange(e.target.value)} disabled={isLocked}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none transition focus:border-yellow-400 disabled:cursor-not-allowed disabled:opacity-50">
                    <option value="">— Seleccionar —</option>
                    {races.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.speed}ft)</option>)}
                  </select>
                </div>

                {/* Trasfondo — selector de DB */}
                <div>
                  <label className="mb-1 block text-sm font-bold text-zinc-300">Trasfondo</label>
                  <select value={selectedBackgroundId} onChange={(e) => handleBackgroundChange(e.target.value)} disabled={isLocked}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none transition focus:border-yellow-400 disabled:cursor-not-allowed disabled:opacity-50">
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

              {/* Descripción de la raza elegida */}
              {(() => {
                const race = races.find((r) => r.id === selectedRaceId);
                if (!race) return null;
                return (
                  <div className="mt-4 rounded-2xl border border-green-400/30 bg-green-400/10 p-4">
                    <p className="text-sm font-bold text-green-300">{race.name}</p>
                    {race.appearance && (
                      <p className="mt-1 text-xs text-green-200/90">{race.appearance}</p>
                    )}
                    {race.commonClasses.length > 0 && (
                      <p className="mt-2 text-xs text-green-200/70">
                        <span className="font-bold text-green-200">Clases más comunes:</span> {race.commonClasses.join(", ")}
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Competencias otorgadas por la clase (automáticas) */}
              {selectedClass && (
                <div className="mt-4 rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4">
                  <p className="text-sm font-bold text-sky-300">Competencias de {selectedClass.name} (auto)</p>
                  <div className="mt-2 grid gap-2 text-xs text-zinc-300 md:grid-cols-4">
                    <p><span className="font-bold text-sky-200">Salvaciones:</span> {
                      (Object.keys(sheetData.proficiencies.savingThrows) as AbilityKey[])
                        .filter((k) => sheetData.proficiencies.savingThrows[k])
                        .map((k) => abilityLabels.find((a) => a.key === k)?.label ?? k)
                        .join(", ") || "Ninguna"
                    }</p>
                    <p><span className="font-bold text-sky-200">Armadura:</span> {selectedClass.armorTraining.join(", ") || "Ninguna"}</p>
                    <p><span className="font-bold text-sky-200">Armas:</span> {selectedClass.weaponTraining.join(", ") || "Ninguna"}</p>
                    <p><span className="font-bold text-sky-200">Herramientas:</span> {selectedClass.toolTraining.join(", ") || "Ninguna"}</p>
                  </div>

                  {selectedClass.skillChoices.length > 0 && (() => {
                    const validKeys = selectedClass.skillChoices
                      .map((s) => matchSkillKey(s))
                      .filter((k): k is string => Boolean(k));
                    const chosenCount = sheetData.proficiencies.classSkillChoices.filter((k) => validKeys.includes(k)).length;
                    const limitReached = chosenCount >= selectedClass.skillChoiceCount;

                    return (
                      <div className="mt-3">
                        <p className="text-xs font-bold text-sky-200">
                          Habilidades de clase — elige {selectedClass.skillChoiceCount} ({chosenCount}/{selectedClass.skillChoiceCount})
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-1 md:grid-cols-3">
                          {selectedClass.skillChoices.map((rawName) => {
                            const key = matchSkillKey(rawName);
                            if (!key) return (
                              <p key={rawName} className="text-xs text-zinc-500">{rawName} (sin mapeo)</p>
                            );
                            const isChosenByClass = sheetData.proficiencies.classSkillChoices.includes(key);
                            const isFromBackground = backgroundGrantedKeys.has(key) && !isChosenByClass;
                            const label = skillLabels.find((s) => s.key === key)?.label ?? rawName;
                            return (
                              <label key={key} className={[
                                "flex cursor-pointer items-center gap-2 text-xs",
                                isChosenByClass ? "text-sky-200" : isFromBackground ? "text-zinc-500" : "text-zinc-400",
                              ].join(" ")}>
                                <input
                                  type="checkbox"
                                  checked={isChosenByClass}
                                  disabled={isFromBackground || (!isChosenByClass && limitReached)}
                                  onChange={(e) => {
                                    const nextChoices = e.target.checked
                                      ? [...sheetData.proficiencies.classSkillChoices, key]
                                      : sheetData.proficiencies.classSkillChoices.filter((k) => k !== key);
                                    update({
                                      ...sheetData,
                                      proficiencies: {
                                        ...sheetData.proficiencies,
                                        classSkillChoices: nextChoices,
                                        // Si se destilda y ninguna otra fuente (trasfondo) la
                                        // sigue otorgando, recién ahí se apaga la competencia.
                                        skills: { ...sheetData.proficiencies.skills, [key]: e.target.checked || backgroundGrantedKeys.has(key) },
                                      },
                                    });
                                  }}
                                  className="accent-sky-400"
                                />
                                {label}{isFromBackground ? " (trasfondo)" : ""}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

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

              {/* Rasgos de subclase */}
              {selectedSubclassId && (() => {
                const subclass = availableSubclasses.find((s) => s.id === selectedSubclassId);
                if (!subclass) return null;
                const subFeatures = (subclass.features ?? []).filter((f) => f.level <= sheetData.identity.level);
                return (
                  <div className="mt-4 rounded-2xl border border-purple-500/20 bg-purple-500/10 p-4">
                    <p className="text-sm font-bold text-purple-300">
                      Rasgos de {subclass.name} hasta nivel {sheetData.identity.level}
                    </p>
                    <div className="mt-2 space-y-1">
                      {subFeatures.length === 0 ? (
                        <p className="text-xs text-zinc-500">Aún no tienes rasgos de esta subclase a este nivel.</p>
                      ) : (
                        subFeatures.map((f, i) => (
                          <p key={i} className="text-xs text-zinc-300">
                            <span className="font-bold text-purple-200">Nv.{f.level} {f.name}:</span> {f.summary}
                          </p>
                        ))
                      )}
                    </div>
                  </div>
                );
              })()}
            </Card>

            {/* Combate */}
            <Card title="Combate">
              <div className="grid gap-4 md:grid-cols-4">
                <ReadOnlyField
                  label="CA (auto)"
                  value={sheetData.combat.armorClass}
                  hint={unarmoredDefenseAbility
                    ? `10 + Destreza + ${abilityLabels.find((a) => a.key === unarmoredDefenseAbility)?.label} (sin armadura)`
                    : "10 + mod. Destreza"}
                />
                <ReadOnlyField label="Iniciativa (auto)" value={signed(sheetData.combat.initiative)} hint="Mod. Destreza" />
                <NumberField label="Velocidad (ft)" value={sheetData.combat.speed}
                  onChange={(v) => update({ ...sheetData, combat: { ...sheetData.combat, speed: v } })} />
                <div>
                  <NumberField label="PG máximos" value={sheetData.combat.maxHp}
                    onChange={(v) => update({ ...sheetData, combat: { ...sheetData.combat, maxHp: v } })} />
                  {suggestedMaxHp !== null && (
                    <button
                      type="button"
                      onClick={() => update({ ...sheetData, combat: { ...sheetData.combat, maxHp: suggestedMaxHp, currentHp: suggestedMaxHp } })}
                      className="mt-1 text-xs font-semibold text-yellow-400 underline decoration-dotted hover:text-yellow-300"
                    >
                      Usar sugerido: {suggestedMaxHp} (con Constitución)
                    </button>
                  )}
                </div>
                <NumberField label="PG actuales" value={sheetData.combat.currentHp}
                  onChange={handleCurrentHpChange} />
                <NumberField label="PG temporales" value={sheetData.combat.temporaryHp}
                  onChange={(v) => update({ ...sheetData, combat: { ...sheetData.combat, temporaryHp: v } })} />
                <ReadOnlyField label="Dados golpe total" value={sheetData.combat.hitDiceTotal} />
                <TextField label="Dados golpe actual" value={sheetData.combat.hitDiceCurrent}
                  onChange={(v) => update({ ...sheetData, combat: { ...sheetData.combat, hitDiceCurrent: v } })} />
                <ReadOnlyField label="Bonif. competencia (auto)" value={signed(sheetData.proficiencies.proficiencyBonus)} hint="Según nivel" />
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

            {/* Forma Salvaje — solo druidas */}
            {isDruid && (
              <Card title="Forma Salvaje" action={
                <span className="flex items-center gap-2">
                  <span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs font-bold text-zinc-300">
                    Usos: {sheetData.wildShape.usesRemaining}/{WILD_SHAPE_USES_MAX}
                  </span>
                  <button type="button" onClick={restoreWildShapeUses}
                    className="rounded-xl border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-800">
                    Descanso
                  </button>
                </span>
              }>
                {sheetData.wildShape.active ? (
                  <div className="rounded-2xl border border-yellow-500/40 bg-yellow-500/10 p-4">
                    <p className="text-lg font-black text-yellow-300">🐾 {sheetData.wildShape.beastName}</p>
                    <p className="mt-1 text-sm text-zinc-300">
                      CA {sheetData.combat.armorClass} · PG {sheetData.combat.currentHp}/{sheetData.combat.maxHp} · Velocidad {sheetData.combat.speed} ft
                    </p>
                    <button type="button" onClick={() => revertWildShape(0)}
                      className="mt-3 w-full rounded-xl bg-yellow-500 px-4 py-2 font-black text-zinc-950 transition hover:bg-yellow-400">
                      Revertir forma
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="mb-3 text-sm text-zinc-400">
                      {isMoonDruid ? "Círculo de la Luna" : "Druida"} · Nivel {sheetData.identity.level} · {eligibleBeasts.length} bestia(s) disponibles
                    </p>
                    <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                      {eligibleBeasts.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-zinc-700 px-3 py-4 text-center text-sm text-zinc-500">
                          Todavía no hay bestias disponibles a tu nivel.
                        </p>
                      ) : (
                        eligibleBeasts.map((beast) => (
                          <button key={beast.id} type="button"
                            disabled={sheetData.wildShape.usesRemaining <= 0}
                            onClick={() => transformInto(beast)}
                            className="flex w-full items-center justify-between rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-left transition hover:border-yellow-400 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50">
                            <span>
                              <span className="block text-sm font-bold text-zinc-200">{beast.name}</span>
                              <span className="block text-xs text-zinc-500">
                                CR {beast.crLabel} · CA {beast.ac} · PG {beast.hp} · {describeBeastSpeed(beast)}
                              </span>
                            </span>
                            <span className="text-xs font-bold text-yellow-300">Transformar</span>
                          </button>
                        ))
                      )}
                    </div>
                    {sheetData.wildShape.usesRemaining <= 0 && (
                      <p className="mt-2 text-xs text-yellow-400">Sin usos — descansa para recuperarlos.</p>
                    )}
                  </>
                )}
              </Card>
            )}

            {/* Ataques */}
            <Card title="Ataques" action={
              <button type="button" onClick={addAttack}
                className="rounded-xl bg-yellow-500 px-3 py-2 text-sm font-bold text-zinc-950 transition hover:bg-yellow-400">+ Ataque manual</button>
            }>
              {/* Selector desde el catálogo de armas */}
              <div className="mb-4 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4">
                <p className="text-sm font-bold text-yellow-200">Agregar desde el catálogo de armas</p>
                {sheetData.proficiencies.weapons.length > 0 && (
                  <p className="mt-1 text-xs text-zinc-500">
                    Competencias de arma: {sheetData.proficiencies.weapons.join(", ")}
                  </p>
                )}
                <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
                  <select value={selectedWeaponCatalogId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedWeaponCatalogId(id);
                      const w = weapons.find((weapon) => weapon.id === id);
                      if (w) setWeaponIsProficient(isWeaponProficient(w, sheetData.proficiencies.weapons));
                    }}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition focus:border-yellow-400">
                    <option value="">— Selecciona un arma —</option>
                    <optgroup label="Armas simples">
                      {weapons.filter((w) => w.category === "simple").map((w) => {
                        const compatible = isWeaponProficient(w, sheetData.proficiencies.weapons);
                        return (
                          <option key={w.id} value={w.id}>
                            {compatible ? "✓ " : "— "}{w.name} — {w.damageDice} {w.damageType}
                            {!compatible ? " (sin competencia)" : ""}
                          </option>
                        );
                      })}
                    </optgroup>
                    <optgroup label="Armas marciales">
                      {weapons.filter((w) => w.category === "martial").map((w) => {
                        const compatible = isWeaponProficient(w, sheetData.proficiencies.weapons);
                        return (
                          <option key={w.id} value={w.id}>
                            {compatible ? "✓ " : "— "}{w.name} — {w.damageDice} {w.damageType}
                            {!compatible ? " (sin competencia)" : ""}
                          </option>
                        );
                      })}
                    </optgroup>
                  </select>

                  {selectedCatalogWeapon?.isFinesse && (
                    <select value={weaponAbilityChoice} onChange={(e) => setWeaponAbilityChoice(e.target.value as "strength" | "dexterity")}
                      className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition focus:border-yellow-400">
                      <option value="strength">Fuerza</option>
                      <option value="dexterity">Destreza</option>
                    </select>
                  )}

                  <label className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-300">
                    <input type="checkbox" checked={weaponIsProficient} onChange={(e) => setWeaponIsProficient(e.target.checked)}
                      className="accent-yellow-400" />
                    Competente
                  </label>

                  <button type="button" onClick={addAttackFromCatalog} disabled={!selectedWeaponCatalogId}
                    className="rounded-xl bg-yellow-500 px-4 py-2 text-sm font-bold text-zinc-950 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50">
                    Agregar
                  </button>
                </div>

                {selectedCatalogWeapon && (
                  <p className="mt-2 text-xs text-zinc-400">
                    {selectedCatalogWeapon.properties.join(", ") || "Sin propiedades especiales"}
                    {selectedCatalogWeapon.rangeNormal ? ` · Alcance ${selectedCatalogWeapon.rangeNormal}/${selectedCatalogWeapon.rangeLong} ft` : ""}
                  </p>
                )}
              </div>

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
                <div>
                  <label className="mb-1 block text-sm font-bold text-zinc-300">Característica</label>
                  <select value={sheetData.spells.spellcastingAbility}
                    onChange={(e) => update({ ...sheetData, spells: { ...sheetData.spells, spellcastingAbility: e.target.value } })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none transition focus:border-yellow-400">
                    <option value="">— Ninguna —</option>
                    {abilityLabels.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
                  </select>
                </div>
                <ReadOnlyField label="CD salvación (auto)" value={sheetData.spells.spellSaveDc} hint="8 + competencia + mod." />
                <ReadOnlyField label="Bonif. ataque (auto)" value={signed(sheetData.spells.spellAttackBonus)} hint="Competencia + mod." />
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

              {/* Selector de conjuros filtrado por clase */}
              <div className="mt-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-bold text-yellow-200">
                    {selectedClass
                      ? `Conjuros disponibles para ${selectedClass.name} (${classSpells.length})`
                      : "Selecciona una clase para ver sus conjuros disponibles"}
                  </p>
                  {selectedClass && (
                    <select value={spellLevelFilter} onChange={(e) => setSpellLevelFilter(e.target.value)}
                      className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-yellow-400">
                      <option value="all">Todos los niveles</option>
                      <option value="0">Trucos</option>
                      {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>Nivel {n}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Contador de hechizos preparados/conocidos y de trucos vs.
                    sus límites respectivos (cada uno con su propia tabla). */}
                {selectedClass && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                    {maxPreparedSpells === null ? (
                      <p className="text-xs text-zinc-500">
                        Elegí la característica de conjuros arriba para calcular cuántos hechizos podés preparar.
                      </p>
                    ) : (
                      <p className={[
                        "text-xs font-bold",
                        knownPreparedSpellsCount >= maxPreparedSpells ? "text-red-300" : "text-zinc-400",
                      ].join(" ")}>
                        Hechizos {preparationLabel}: {knownPreparedSpellsCount} / {maxPreparedSpells}
                        {knownPreparedSpellsCount >= maxPreparedSpells ? " — límite alcanzado" : ""}
                        <span className="ml-1 font-normal text-zinc-500">
                          {preparationLabel === "conocidos"
                            ? "(tabla fija según nivel)"
                            : "(nivel + mod. característica)"}
                        </span>
                      </p>
                    )}

                    {maxCantrips !== null && (
                      <p className={[
                        "text-xs font-bold",
                        knownCantripsCount >= maxCantrips ? "text-red-300" : "text-zinc-400",
                      ].join(" ")}>
                        Trucos: {knownCantripsCount} / {maxCantrips}
                        {knownCantripsCount >= maxCantrips ? " — límite alcanzado" : ""}
                        <span className="ml-1 font-normal text-zinc-500">(tabla fija según nivel)</span>
                      </p>
                    )}
                  </div>
                )}

                {selectedClass && classSpells.length === 0 && (
                  <p className="mt-3 text-xs text-zinc-500">
                    No hay conjuros en el catálogo para esta clase todavía. Un admin puede agregarlos en /admin/spells.
                  </p>
                )}

                {selectedClass && filteredClassSpells.length > 0 && (
                  <div className="mt-3 grid max-h-[36rem] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredClassSpells.map((spell) => {
                      const level = String(spell.level);
                      const isKnown = (sheetData.spells.spellsByLevel[level] ?? []).includes(spell.name);
                      const atLimit = level === "0"
                        ? maxCantrips !== null && knownCantripsCount >= maxCantrips
                        : maxPreparedSpells !== null && knownPreparedSpellsCount >= maxPreparedSpells;
                      const isDisabled = !isKnown && atLimit;
                      return (
                        <label key={spell.id} className={[
                          "flex flex-col gap-2 rounded-2xl border p-3 text-sm transition",
                          isKnown
                            ? "border-yellow-400/60 bg-yellow-500/10"
                            : isDisabled
                              ? "cursor-not-allowed border-zinc-800 bg-zinc-950/60 opacity-50"
                              : "cursor-pointer border-zinc-800 bg-zinc-950 hover:border-zinc-700",
                        ].join(" ")}>
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-black leading-tight text-white">{spell.name}</span>
                            <input type="checkbox" checked={isKnown} disabled={isDisabled}
                              onChange={() => toggleSpell(level, spell.name)}
                              className="mt-0.5 accent-yellow-400" />
                          </div>

                          <p className="text-[11px] font-bold uppercase tracking-wide text-yellow-400/80">
                            {spell.level === 0 ? "Truco" : `Nivel ${spell.level}`} · {spell.school}
                            {spell.concentration ? " · Conc." : ""}
                            {spell.ritual ? " · Ritual" : ""}
                          </p>

                          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] text-zinc-500">
                            <span>Lanzamiento: {spell.castingTime || "—"}</span>
                            <span>Alcance: {spell.range || "—"}</span>
                            <span>Duración: {spell.duration || "—"}</span>
                            <span>
                              {spell.damageDice ? `Daño: ${spell.damageDice} ${spell.damageType ?? ""}` : ""}
                              {spell.healingDice ? `Cura: ${spell.healingDice}` : ""}
                            </span>
                          </div>

                          {spell.description && (
                            <p className="mt-1 line-clamp-3 text-xs text-zinc-400">{spell.description}</p>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Conjuros adicionales / caseros — texto libre por nivel */}
              <div className="mt-6">
                <p className="mb-2 text-sm font-bold text-zinc-300">
                  Conjuros adicionales (texto libre, para hechizos caseros o fuera del catálogo)
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  {[["0", "Trucos"], ["1", "Nivel 1"], ["2", "Nivel 2"], ["3", "Nivel 3"],
                    ["4", "Nivel 4"], ["5", "Nivel 5"], ["6", "Nivel 6"], ["7", "Nivel 7"],
                    ["8", "Nivel 8"], ["9", "Nivel 9"]].map(([lvl, label]) => (
                    <TextAreaField key={lvl} label={`Conjuros — ${label}`}
                      value={joinLines(sheetData.spells.spellsByLevel[lvl] ?? [])} rows={3}
                      onChange={(v) => update({ ...sheetData, spells: { ...sheetData.spells, spellsByLevel: { ...sheetData.spells.spellsByLevel, [lvl]: splitLines(v) } } })} />
                  ))}
                </div>
              </div>
            </Card>

          </div>
        </section>
      </div>
    </main>
  );
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function LockedBadge() {
  return (
    <span className="flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs font-bold text-zinc-400">
      🔒 Bloqueado
    </span>
  );
}

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

function NumberField({ label, value, onChange, min, max }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-zinc-300">{label}</span>
      <input type="number" value={Number.isFinite(value) ? value : 0} min={min} max={max}
        onChange={(e) => {
          let next = Number(e.target.value);
          if (min !== undefined && next < min) next = min;
          if (max !== undefined && next > max) next = max;
          onChange(next);
        }}
        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none transition focus:border-yellow-400" />
    </label>
  );
}

function ReadOnlyField({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="block">
      <span className="mb-1 block text-sm font-bold text-zinc-300">{label}</span>
      <div className="w-full rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 font-bold text-yellow-200">
        {value}
      </div>
      {hint && <span className="mt-0.5 block text-xs text-zinc-500">{hint}</span>}
    </div>
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