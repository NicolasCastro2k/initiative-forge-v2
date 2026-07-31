// frontend/src/utils/wildshape.ts
//
// Utilidades compartidas para la habilidad "Forma Salvaje" del druida, usadas
// tanto en la ficha de personaje como en la Pantalla de Jugador. El catálogo
// de bestias viene de la tabla BeastPreset (GET /presets/beasts); cada bestia
// ya trae precalculado el nivel mínimo al que se desbloquea para un druida
// estándar (minDruidLevel) y para Círculo de la Luna (minMoonDruidLevel).

export type BeastAttack = { name: string; attackBonus: string; damage: string };

export type BeastPreset = {
  id: string;
  name: string;
  nameEn: string | null;
  cr: number;
  crLabel: string;
  ac: number;
  hp: number;
  hitDice: string;
  speedWalk: number;
  speedFly: number;
  speedSwim: number;
  speedClimb: number;
  speedBurrow: number;
  size: string;
  strength: number;
  dexterity: number;
  constitution: number;
  attacks: BeastAttack[];
  traits: string;
  vulnerabilities: string | null;
  resistances: string | null;
  immunities: string | null;
  conditionImmunities: string | null;
  multiattack: boolean;
  minDruidLevel: number | null;
  minMoonDruidLevel: number | null;
  tokenImagePath: string | null;
  source: string;
};

// IDs estables de los presets (backend/prisma/seed-class-presets.ts y
// seed-subclass-presets.ts) — no cambian aunque se traduzca el nombre.
export const DRUID_CLASS_ID = "druid";
export const MOON_DRUID_SUBCLASS_ID = "druid-circle-of-the-moon";

// Todo druida (de cualquier círculo) tiene 2 usos de Forma Salvaje, que se
// restauran con un descanso corto o largo (regla fija de 5e, no escala con nivel).
export const WILD_SHAPE_USES_MAX = 2;

export function isBeastEligible(beast: BeastPreset, druidLevel: number, isMoonDruid: boolean): boolean {
  const minLevel = isMoonDruid ? beast.minMoonDruidLevel : beast.minDruidLevel;
  return minLevel !== null && druidLevel >= minLevel;
}

export function describeBeastSpeed(beast: BeastPreset): string {
  const parts: string[] = [];
  if (beast.speedWalk) parts.push(`${beast.speedWalk} ft`);
  if (beast.speedFly) parts.push(`volar ${beast.speedFly} ft`);
  if (beast.speedSwim) parts.push(`nadar ${beast.speedSwim} ft`);
  if (beast.speedClimb) parts.push(`trepar ${beast.speedClimb} ft`);
  if (beast.speedBurrow) parts.push(`excavar ${beast.speedBurrow} ft`);
  return parts.length ? parts.join(", ") : "0 ft";
}

// Velocidad "principal" a guardar en el único campo combat.speed de la
// ficha (que no distingue modos de movimiento): la de caminar si tiene, si
// no la mayor disponible entre volar/nadar/trepar/excavar.
export function primaryBeastSpeed(beast: BeastPreset): number {
  if (beast.speedWalk) return beast.speedWalk;
  return Math.max(beast.speedFly, beast.speedSwim, beast.speedClimb, beast.speedBurrow, 0);
}