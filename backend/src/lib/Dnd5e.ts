// ─────────────────────────────────────────────────────────────────────────────
// D&D 5e Rules Engine
// Toda la lógica de reglas va aquí — sin estado, funciones puras.
// ─────────────────────────────────────────────────────────────────────────────

export type AbilityName = "str" | "dex" | "con" | "int" | "wis" | "cha";

export type Condition =
  | "blinded"
  | "charmed"
  | "deafened"
  | "exhaustion"
  | "frightened"
  | "grappled"
  | "incapacitated"
  | "invisible"
  | "paralyzed"
  | "petrified"
  | "poisoned"
  | "prone"
  | "restrained"
  | "stunned"
  | "unconscious";

export const CONDITION_LABELS: Record<Condition, string> = {
  blinded:       "Cegado",
  charmed:       "Hechizado",
  deafened:      "Ensordecido",
  exhaustion:    "Agotamiento",
  frightened:    "Asustado",
  grappled:      "Agarrado",
  incapacitated: "Incapacitado",
  invisible:     "Invisible",
  paralyzed:     "Paralizado",
  petrified:     "Petrificado",
  poisoned:      "Envenenado",
  prone:         "Derribado",
  restrained:    "Restringido",
  stunned:       "Aturdido",
  unconscious:   "Inconsciente",
};

// ─── Dados ───────────────────────────────────────────────────────────────────

export type DiceType = 4 | 6 | 8 | 10 | 12 | 20 | 100;

export type RollResult = {
  dice: string;       // "2d6+3"
  rolls: number[];    // [4, 5]
  modifier: number;   // 3
  total: number;      // 12
  isCrit: boolean;
};

export function rollDie(sides: DiceType): number {
  return Math.floor(Math.random() * sides) + 1;
}

export function rollDice(
  count: number,
  sides: DiceType,
  modifier = 0,
  advantage = false,
  disadvantage = false
): RollResult {
  const rolls: number[] = [];

  if (sides === 20 && count === 1 && (advantage || disadvantage)) {
    const a = rollDie(20);
    const b = rollDie(20);
    const chosen = advantage ? Math.max(a, b) : Math.min(a, b);
    rolls.push(chosen);
  } else {
    for (let i = 0; i < count; i++) {
      rolls.push(rollDie(sides));
    }
  }

  const rawTotal = rolls.reduce((sum, r) => sum + r, 0);
  const total = rawTotal + modifier;
  const isCrit = sides === 20 && rolls[0] === 20;

  return {
    dice: `${count}d${sides}${modifier !== 0 ? (modifier > 0 ? `+${modifier}` : modifier) : ""}`,
    rolls,
    modifier,
    total,
    isCrit,
  };
}

// Daño crítico: doblar los dados (no el modificador)
export function rollCritDamage(
  count: number,
  sides: DiceType,
  modifier = 0
): RollResult {
  return rollDice(count * 2, sides, modifier);
}

// ─── Modificadores ───────────────────────────────────────────────────────────

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function proficiencyBonus(level: number): number {
  return Math.ceil(level / 4) + 1;
}

// ─── Movimiento ──────────────────────────────────────────────────────────────

// 1 casilla = 5 pies en D&D
export const FEET_PER_TILE = 5;

export function speedInTiles(speedFeet: number): number {
  return Math.floor(speedFeet / FEET_PER_TILE);
}

export function movementCost(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  isDiagonal: boolean
): number {
  const dx = Math.abs(toX - fromX);
  const dy = Math.abs(toY - fromY);

  if (!isDiagonal) {
    // Distancia Manhattan
    return (dx + dy) * FEET_PER_TILE;
  }

  // Regla opcional D&D: el primer diagonal = 5, el segundo = 10, etc.
  // Simplificado: Chebyshev distance * 5
  return Math.max(dx, dy) * FEET_PER_TILE;
}

export function remainingMovement(
  speedFeet: number,
  movementUsedFeet: number,
  isDashing: boolean
): number {
  const total = isDashing ? speedFeet * 2 : speedFeet;
  return Math.max(0, total - movementUsedFeet);
}

// Casillas alcanzables desde una posición dada
export function reachableTiles(
  x: number,
  y: number,
  remainingFeet: number,
  gridRows: number,
  gridCols: number,
  tiles: string[][],
  occupiedPositions: { x: number; y: number }[]
): { x: number; y: number; costFeet: number }[] {
  const maxTiles = Math.floor(remainingFeet / FEET_PER_TILE);
  const reachable: { x: number; y: number; costFeet: number }[] = [];

  const occupied = new Set(occupiedPositions.map((p) => `${p.x},${p.y}`));

  for (let ty = 0; ty < gridRows; ty++) {
    for (let tx = 0; tx < gridCols; tx++) {
      if (tx === x && ty === y) continue;
      if (tiles[ty]?.[tx] !== "floor") continue;
      if (occupied.has(`${tx},${ty}`)) continue;

      const dx = Math.abs(tx - x);
      const dy = Math.abs(ty - y);
      const dist = Math.max(dx, dy); // Chebyshev — diagonal cuenta como 1

      if (dist <= maxTiles) {
        reachable.push({ x: tx, y: ty, costFeet: dist * FEET_PER_TILE });
      }
    }
  }

  return reachable;
}

// ─── Alcance de ataque ───────────────────────────────────────────────────────

export function distanceFeet(
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = Math.abs(bx - ax);
  const dy = Math.abs(by - ay);
  return Math.max(dx, dy) * FEET_PER_TILE; // Chebyshev
}

export function isInMeleeRange(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  reachFeet = 5
): boolean {
  return distanceFeet(ax, ay, bx, by) <= reachFeet;
}

export function isInRange(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  normalRangeFeet: number
): boolean {
  return distanceFeet(ax, ay, bx, by) <= normalRangeFeet;
}

// ─── Ataque ──────────────────────────────────────────────────────────────────

export type AttackType = "melee" | "ranged" | "spell";

export type WeaponData = {
  name: string;
  attackType: AttackType;
  damageDice: string;       // "1d6", "2d6", etc.
  damageType: string;       // "slashing", "piercing", "fire", etc.
  rangeFeet: number;        // 5 para melé, 60/120 para arco, etc.
  longRangeFeet?: number;   // rango largo (con desventaja)
  abilityUsed: AbilityName; // str para melé, dex para ranged, varía para spell
  isFinesse?: boolean;      // puede usar STR o DEX
  isTwoHanded?: boolean;
};

export type AttackResult = {
  weapon: string;
  attackRoll: RollResult;
  hitAc: number;        // CA que se necesitaba superar
  isHit: boolean;
  isCrit: boolean;
  damageRoll: RollResult | null;
  totalDamage: number;
  damageType: string;
  detail: string;
};

export function resolveAttack(
  weapon: WeaponData,
  attackerLevel: number,
  attackerStr: number,
  attackerDex: number,
  targetAc: number,
  hasProficiency = true,
  advantage = false,
  disadvantage = false
): AttackResult {
  const abilityScore =
    weapon.abilityUsed === "str" ? attackerStr :
    weapon.abilityUsed === "dex" ? attackerDex :
    10;

  const abilityMod = abilityModifier(abilityScore);
  const profBonus = hasProficiency ? proficiencyBonus(attackerLevel) : 0;
  const attackMod = abilityMod + profBonus;

  const attackRoll = rollDice(1, 20, attackMod, advantage, disadvantage);

  const isCrit = attackRoll.isCrit;
  const isHit = isCrit || attackRoll.total >= targetAc;

  let damageRoll: RollResult | null = null;
  let totalDamage = 0;

  if (isHit) {
    const [countStr, rest] = weapon.damageDice.split("d");
    const count = parseInt(countStr, 10);
    const sides = parseInt(rest, 10) as DiceType;

    damageRoll = isCrit
      ? rollCritDamage(count, sides, abilityMod)
      : rollDice(count, sides, abilityMod);

    totalDamage = Math.max(0, damageRoll.total);
  }

  const detail = isHit
    ? isCrit
      ? `¡Crítico! ${totalDamage} daño ${weapon.damageType}`
      : `Impacta CA ${attackRoll.total} vs ${targetAc} → ${totalDamage} daño ${weapon.damageType}`
    : `Falla (${attackRoll.total} vs CA ${targetAc})`;

  return {
    weapon: weapon.name,
    attackRoll,
    hitAc: targetAc,
    isHit,
    isCrit,
    damageRoll,
    totalDamage,
    damageType: weapon.damageType,
    detail,
  };
}

// ─── Hechizos ────────────────────────────────────────────────────────────────

export type SpellAreaShape = "point" | "sphere" | "cone" | "line" | "cube";

export type SpellData = {
  name: string;
  level: number;           // 0 = cantrip
  school: string;
  castingTime: string;
  rangeFeet: number;
  areaShape: SpellAreaShape;
  areaSizeFeet: number;    // radio/largo/lado según shape
  damageDice: string;      // "8d6" para bola de fuego
  damageType: string;
  savingThrow: AbilityName | null;  // null = solo tirada de ataque
  halfOnSave: boolean;
  spellcastingAbility: AbilityName;
};

export type SpellResult = {
  spell: string;
  targets: {
    name: string;
    saveRoll: RollResult | null;
    saveDc: number;
    savedSuccessfully: boolean;
    damageRoll: RollResult;
    totalDamage: number;
  }[];
  detail: string;
};

export function spellSaveDc(
  casterLevel: number,
  spellcastingAbility: number
): number {
  return 8 + proficiencyBonus(casterLevel) + abilityModifier(spellcastingAbility);
}

export function spellAttackBonus(
  casterLevel: number,
  spellcastingAbility: number
): number {
  return proficiencyBonus(casterLevel) + abilityModifier(spellcastingAbility);
}

// Casillas dentro del área de un hechizo
export function spellAreaTiles(
  originX: number,
  originY: number,
  shape: SpellAreaShape,
  sizeFeet: number,
  directionX = 0,  // para cono y línea
  directionY = 0
): { x: number; y: number }[] {
  const sizeInTiles = Math.ceil(sizeFeet / FEET_PER_TILE);
  const tiles: { x: number; y: number }[] = [];

  if (shape === "point") {
    return [{ x: originX, y: originY }];
  }

  if (shape === "sphere" || shape === "cube") {
    for (let dy = -sizeInTiles; dy <= sizeInTiles; dy++) {
      for (let dx = -sizeInTiles; dx <= sizeInTiles; dx++) {
        if (shape === "sphere") {
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= sizeInTiles) {
            tiles.push({ x: originX + dx, y: originY + dy });
          }
        } else {
          tiles.push({ x: originX + dx, y: originY + dy });
        }
      }
    }
    return tiles;
  }

  if (shape === "line") {
    const normX = directionX === 0 ? 0 : directionX > 0 ? 1 : -1;
    const normY = directionY === 0 ? 0 : directionY > 0 ? 1 : -1;

    for (let i = 0; i <= sizeInTiles; i++) {
      tiles.push({ x: originX + normX * i, y: originY + normY * i });
    }
    return tiles;
  }

  if (shape === "cone") {
    // Cono de 90° en la dirección dada
    for (let i = 1; i <= sizeInTiles; i++) {
      const perpRange = i;
      for (let p = -perpRange; p <= perpRange; p++) {
        if (Math.abs(directionX) > Math.abs(directionY)) {
          tiles.push({
            x: originX + (directionX > 0 ? i : -i),
            y: originY + p,
          });
        } else {
          tiles.push({
            x: originX + p,
            y: originY + (directionY > 0 ? i : -i),
          });
        }
      }
    }
    return tiles;
  }

  return tiles;
}

// Resolver hechizo con área contra múltiples objetivos
export function resolveSpell(
  spell: SpellData,
  casterLevel: number,
  casterSpellcastingAbility: number,
  targets: { name: string; savingThrowScore: number }[]
): SpellResult {
  const dc = spellSaveDc(casterLevel, casterSpellcastingAbility);

  const [countStr, rest] = spell.damageDice.split("d");
  const count = parseInt(countStr, 10);
  const sides = parseInt(rest, 10) as DiceType;

  const resolvedTargets = targets.map((target) => {
    const damageRoll = rollDice(count, sides);
    let totalDamage = damageRoll.total;
    let saveRoll: RollResult | null = null;
    let savedSuccessfully = false;

    if (spell.savingThrow) {
      const saveMod = abilityModifier(target.savingThrowScore);
      saveRoll = rollDice(1, 20, saveMod);
      savedSuccessfully = saveRoll.total >= dc;

      if (savedSuccessfully && spell.halfOnSave) {
        totalDamage = Math.floor(totalDamage / 2);
      } else if (savedSuccessfully && !spell.halfOnSave) {
        totalDamage = 0;
      }
    }

    return {
      name: target.name,
      saveRoll,
      saveDc: dc,
      savedSuccessfully,
      damageRoll,
      totalDamage: Math.max(0, totalDamage),
    };
  });

  const detail = resolvedTargets
    .map((t) => {
      if (t.saveRoll) {
        const saveText = t.savedSuccessfully
          ? `salvación exitosa (${t.saveRoll.total} vs CD ${t.saveDc})`
          : `salvación fallida (${t.saveRoll.total} vs CD ${t.saveDc})`;
        return `${t.name}: ${saveText} → ${t.totalDamage} daño ${spell.damageType}`;
      }
      return `${t.name}: ${t.totalDamage} daño ${spell.damageType}`;
    })
    .join(" | ");

  return { spell: spell.name, targets: resolvedTargets, detail };
}

// ─── Tirada de salvación libre ────────────────────────────────────────────────

export type SavingThrowResult = {
  ability: AbilityName;
  dc: number;
  roll: RollResult;
  success: boolean;
  detail: string;
};

export function resolveSavingThrow(
  ability: AbilityName,
  dc: number,
  abilityScore: number,
  hasProficiency = false,
  level = 1,
  advantage = false,
  disadvantage = false
): SavingThrowResult {
  const mod = abilityModifier(abilityScore) + (hasProficiency ? proficiencyBonus(level) : 0);
  const roll = rollDice(1, 20, mod, advantage, disadvantage);
  const success = roll.total >= dc;

  return {
    ability,
    dc,
    roll,
    success,
    detail: success
      ? `${roll.total} vs CD ${dc} → Salvación exitosa`
      : `${roll.total} vs CD ${dc} → Salvación fallida`,
  };
}

// ─── Armas predefinidas (D&D 5e SRD) ─────────────────────────────────────────

export const WEAPONS_SRD: WeaponData[] = [
  // Melé simples
  { name: "Garrote",        attackType: "melee",  damageDice: "1d4",  damageType: "contundente",  rangeFeet: 5,  abilityUsed: "str" },
  { name: "Daga",           attackType: "melee",  damageDice: "1d4",  damageType: "perforante",   rangeFeet: 5,  abilityUsed: "str", isFinesse: true },
  { name: "Hacha de mano",  attackType: "melee",  damageDice: "1d6",  damageType: "cortante",     rangeFeet: 5,  abilityUsed: "str" },
  { name: "Espada corta",   attackType: "melee",  damageDice: "1d6",  damageType: "perforante",   rangeFeet: 5,  abilityUsed: "str", isFinesse: true },
  { name: "Espada larga",   attackType: "melee",  damageDice: "1d8",  damageType: "cortante",     rangeFeet: 5,  abilityUsed: "str" },
  { name: "Mandoble",       attackType: "melee",  damageDice: "2d6",  damageType: "cortante",     rangeFeet: 5,  abilityUsed: "str", isTwoHanded: true },
  { name: "Hacha de guerra",attackType: "melee",  damageDice: "1d8",  damageType: "cortante",     rangeFeet: 5,  abilityUsed: "str" },
  { name: "Maza",           attackType: "melee",  damageDice: "1d6",  damageType: "contundente",  rangeFeet: 5,  abilityUsed: "str" },
  { name: "Lanza",          attackType: "melee",  damageDice: "1d6",  damageType: "perforante",   rangeFeet: 5,  abilityUsed: "str" },
  { name: "Bastón",         attackType: "melee",  damageDice: "1d6",  damageType: "contundente",  rangeFeet: 5,  abilityUsed: "str" },
  // Distancia simples
  { name: "Arco corto",     attackType: "ranged", damageDice: "1d6",  damageType: "perforante",   rangeFeet: 80, longRangeFeet: 320, abilityUsed: "dex" },
  { name: "Arco largo",     attackType: "ranged", damageDice: "1d8",  damageType: "perforante",   rangeFeet: 150,longRangeFeet: 600, abilityUsed: "dex", isTwoHanded: true },
  { name: "Ballesta ligera",attackType: "ranged", damageDice: "1d8",  damageType: "perforante",   rangeFeet: 80, longRangeFeet: 320, abilityUsed: "dex" },
  { name: "Ballesta pesada",attackType: "ranged", damageDice: "1d10", damageType: "perforante",   rangeFeet: 100,longRangeFeet: 400, abilityUsed: "dex", isTwoHanded: true },
];

// ─── Hechizos predefinidos (D&D 5e SRD) ──────────────────────────────────────

export const SPELLS_SRD: SpellData[] = [
  // Cantrips (nivel 0)
  {
    name: "Toque de Tormenta",
    level: 0,
    school: "evocación",
    castingTime: "1 acción",
    rangeFeet: 5,
    areaShape: "point",
    areaSizeFeet: 0,
    damageDice: "1d8",
    damageType: "rayo",
    savingThrow: null,
    halfOnSave: false,
    spellcastingAbility: "int",
  },
  {
    name: "Descarga de Fuego",
    level: 0,
    school: "evocación",
    castingTime: "1 acción",
    rangeFeet: 120,
    areaShape: "point",
    areaSizeFeet: 0,
    damageDice: "1d10",
    damageType: "fuego",
    savingThrow: null,
    halfOnSave: false,
    spellcastingAbility: "int",
  },
  {
    name: "Rayo de Escarcha",
    level: 0,
    school: "evocación",
    castingTime: "1 acción",
    rangeFeet: 60,
    areaShape: "point",
    areaSizeFeet: 0,
    damageDice: "1d8",
    damageType: "frío",
    savingThrow: null,
    halfOnSave: false,
    spellcastingAbility: "int",
  },
  // Nivel 1
  {
    name: "Manos Ardientes",
    level: 1,
    school: "evocación",
    castingTime: "1 acción",
    rangeFeet: 15,
    areaShape: "cone",
    areaSizeFeet: 15,
    damageDice: "3d6",
    damageType: "fuego",
    savingThrow: "dex",
    halfOnSave: true,
    spellcastingAbility: "int",
  },
  {
    name: "Ola de Truenos",
    level: 1,
    school: "evocación",
    castingTime: "1 acción",
    rangeFeet: 5,
    areaShape: "cube",
    areaSizeFeet: 15,
    damageDice: "2d8",
    damageType: "trueno",
    savingThrow: "con",
    halfOnSave: false,
    spellcastingAbility: "wis",
  },
  // Nivel 2
  {
    name: "Llamarada de Magia",
    level: 2,
    school: "evocación",
    castingTime: "1 acción",
    rangeFeet: 60,
    areaShape: "point",
    areaSizeFeet: 0,
    damageDice: "3d10",
    damageType: "fuerza",
    savingThrow: null,
    halfOnSave: false,
    spellcastingAbility: "int",
  },
  // Nivel 3
  {
    name: "Bola de Fuego",
    level: 3,
    school: "evocación",
    castingTime: "1 acción",
    rangeFeet: 150,
    areaShape: "sphere",
    areaSizeFeet: 20,
    damageDice: "8d6",
    damageType: "fuego",
    savingThrow: "dex",
    halfOnSave: true,
    spellcastingAbility: "int",
  },
  {
    name: "Rayo",
    level: 3,
    school: "evocación",
    castingTime: "1 acción",
    rangeFeet: 100,
    areaShape: "line",
    areaSizeFeet: 100,
    damageDice: "8d6",
    damageType: "rayo",
    savingThrow: "dex",
    halfOnSave: true,
    spellcastingAbility: "int",
  },
  // Nivel 4
  {
    name: "Tormenta de Hielo",
    level: 4,
    school: "evocación",
    castingTime: "1 acción",
    rangeFeet: 300,
    areaShape: "sphere",
    areaSizeFeet: 20,
    damageDice: "2d8",
    damageType: "contundente y frío",
    savingThrow: "dex",
    halfOnSave: false,
    spellcastingAbility: "int",
  },
  // Nivel 5
  {
    name: "Cono de Frío",
    level: 5,
    school: "evocación",
    castingTime: "1 acción",
    rangeFeet: 60,
    areaShape: "cone",
    areaSizeFeet: 60,
    damageDice: "8d8",
    damageType: "frío",
    savingThrow: "con",
    halfOnSave: true,
    spellcastingAbility: "int",
  },
];

// ─── Condiciones: efectos en combate ─────────────────────────────────────────

export function getConditionEffects(conditions: Condition[]): {
  hasDisadvantageOnAttacks: boolean;
  attacksAgainHaveAdvantage: boolean;
  cannotMove: boolean;
  cannotAct: boolean;
  speedHalved: boolean;
} {
  const has = (c: Condition) => conditions.includes(c);

  return {
    hasDisadvantageOnAttacks:
      has("blinded") || has("poisoned") || has("frightened") || has("prone"),
    attacksAgainHaveAdvantage:
      has("blinded") || has("paralyzed") || has("stunned") || has("unconscious") || has("prone"),
    cannotMove:
      has("grappled") || has("paralyzed") || has("petrified") ||
      has("restrained") || has("stunned") || has("unconscious"),
    cannotAct:
      has("incapacitated") || has("paralyzed") || has("petrified") ||
      has("stunned") || has("unconscious"),
    speedHalved: has("exhaustion"),
  };
}

// ─── Helpers para leer sheetData ──────────────────────────────────────────────
// sheetData puede variar — estas funciones son defensivas

type SheetData = {
  combat?: {
    speed?: number;
    armorClass?: number;
    initiative?: number;
    maxHp?: number;
    currentHp?: number;
    proficiencyBonus?: number;
  };
  abilities?: {
    str?: number;
    dex?: number;
    con?: number;
    int?: number;
    wis?: number;
    cha?: number;
  };
  weapons?: {
    name: string;
    attackType?: AttackType;
    damageDice?: string;
    damageType?: string;
    rangeFeet?: number;
    abilityUsed?: AbilityName;
  }[];
  spells?: {
    name: string;
    level?: number;
    damageDice?: string;
    damageType?: string;
    rangeFeet?: number;
    areaShape?: SpellAreaShape;
    areaSizeFeet?: number;
    savingThrow?: AbilityName | null;
    halfOnSave?: boolean;
  }[];
  spellcastingAbility?: AbilityName;
  spellSlots?: Record<string, number>; // { "1": 4, "2": 3, ... }
};

export function parseSheetData(raw: unknown): SheetData {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as SheetData;
}

export function getSpeedFromSheet(sheet: SheetData): number {
  return sheet?.combat?.speed ?? 30;
}

export function getAbilitiesFromSheet(sheet: SheetData) {
  return {
    str: sheet?.abilities?.str ?? 10,
    dex: sheet?.abilities?.dex ?? 10,
    con: sheet?.abilities?.con ?? 10,
    int: sheet?.abilities?.int ?? 10,
    wis: sheet?.abilities?.wis ?? 10,
    cha: sheet?.abilities?.cha ?? 10,
  };
}

export function getWeaponsFromSheet(sheet: SheetData): WeaponData[] {
  if (!sheet?.weapons?.length) return [];

  return sheet.weapons.map((w) => ({
    name: w.name,
    attackType: w.attackType ?? "melee",
    damageDice: w.damageDice ?? "1d4",
    damageType: w.damageType ?? "contundente",
    rangeFeet: w.rangeFeet ?? 5,
    abilityUsed: w.abilityUsed ?? "str",
  }));
}

export function getSpellsFromSheet(sheet: SheetData): SpellData[] {
  if (!sheet?.spells?.length) return [];
  const ability = sheet.spellcastingAbility ?? "int";

  return sheet.spells.map((s) => ({
    name: s.name,
    level: s.level ?? 0,
    school: "evocación",
    castingTime: "1 acción",
    rangeFeet: s.rangeFeet ?? 60,
    areaShape: s.areaShape ?? "point",
    areaSizeFeet: s.areaSizeFeet ?? 0,
    damageDice: s.damageDice ?? "1d6",
    damageType: s.damageType ?? "fuerza",
    savingThrow: s.savingThrow ?? null,
    halfOnSave: s.halfOnSave ?? false,
    spellcastingAbility: ability,
  }));
}