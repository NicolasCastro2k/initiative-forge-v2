import { PrismaClient, type Prisma } from "@prisma/client";

const prisma = new PrismaClient();

// { name, attackBonus, reach, rangeShort, rangeLong, damage, damageType }
type AttackSeed = {
  name: string;
  attackBonus: string;
  reach: string | null;
  rangeShort: number | null;
  rangeLong: number | null;
  damage: string;
  damageType: string;
};

type MonsterSeed = {
  id: string; name: string; nameEn: string; cr: number; crLabel: string;
  ac: number; hp: number; hitDice: string;
  speedWalk: number; speedFly: number; speedSwim: number; speedClimb: number; speedBurrow: number;
  size: string; strength: number; dexterity: number; constitution: number;
  attacks: AttackSeed[]; traits: string;
  vulnerabilities: string | null; resistances: string | null; immunities: string | null; conditionImmunities: string | null;
  multiattack: boolean; source: string;
};

// Compendio de monstruos provisto por el usuario. Velocidades y alcances
// convertidos de metros a pies (1,5 m ≈ 5 ft, 9 m = 30 ft, etc.) para que
// queden consistentes con el resto del catálogo (armas, bestias), que ya usa
// pies. Los valores en sí (CA, PV, bonificadores, daño) son los que envió.
const MONSTERS: MonsterSeed[] = [
  {
    id: "monster-goblin", name: "Goblin", nameEn: "Goblin", cr: 0.25, crLabel: "1/4",
    ac: 15, hp: 7, hitDice: "2d6",
    speedWalk: 30, speedFly: 0, speedSwim: 0, speedClimb: 0, speedBurrow: 0,
    size: "Pequeño", strength: 8, dexterity: 14, constitution: 10,
    attacks: [
      { name: "Cimitarra", attackBonus: "+4", reach: "5 ft", rangeShort: null, rangeLong: null, damage: "1d6 + 2", damageType: "cortante" },
      { name: "Arco corto", attackBonus: "+4", reach: null, rangeShort: 80, rangeLong: 320, damage: "1d6 + 2", damageType: "perforante" },
    ],
    traits: "Armadura de cuero y escudo.",
    vulnerabilities: null, resistances: null, immunities: null, conditionImmunities: null,
    multiattack: false, source: "Compendio de monstruos D&D 5e",
  },
  {
    id: "monster-orc", name: "Orco", nameEn: "Orc", cr: 0.5, crLabel: "1/2",
    ac: 13, hp: 15, hitDice: "2d8+6",
    speedWalk: 30, speedFly: 0, speedSwim: 0, speedClimb: 0, speedBurrow: 0,
    size: "Mediano", strength: 16, dexterity: 12, constitution: 16,
    attacks: [
      { name: "Gran hacha", attackBonus: "+5", reach: "5 ft", rangeShort: null, rangeLong: null, damage: "1d12 + 3", damageType: "cortante" },
      { name: "Jabalina", attackBonus: "+5", reach: null, rangeShort: 30, rangeLong: 120, damage: "1d6 + 3", damageType: "perforante" },
    ],
    traits: "",
    vulnerabilities: null, resistances: null, immunities: null, conditionImmunities: null,
    multiattack: false, source: "Compendio de monstruos D&D 5e",
  },
  {
    id: "monster-skeleton", name: "Esqueleto", nameEn: "Skeleton", cr: 0.25, crLabel: "1/4",
    ac: 13, hp: 13, hitDice: "2d8+4",
    speedWalk: 30, speedFly: 0, speedSwim: 0, speedClimb: 0, speedBurrow: 0,
    size: "Mediano", strength: 10, dexterity: 14, constitution: 15,
    attacks: [
      { name: "Espada corta", attackBonus: "+4", reach: "5 ft", rangeShort: null, rangeLong: null, damage: "1d6 + 2", damageType: "perforante" },
      { name: "Arco corto", attackBonus: "+4", reach: null, rangeShort: 80, rangeLong: 320, damage: "1d6 + 2", damageType: "perforante" },
    ],
    traits: "",
    vulnerabilities: "contundente", resistances: null, immunities: "veneno", conditionImmunities: "envenenado, exhausto",
    multiattack: false, source: "Compendio de monstruos D&D 5e",
  },
  {
    id: "monster-zombie", name: "Zombie", nameEn: "Zombie", cr: 0.25, crLabel: "1/4",
    ac: 8, hp: 22, hitDice: "3d8+9",
    speedWalk: 20, speedFly: 0, speedSwim: 0, speedClimb: 0, speedBurrow: 0,
    size: "Mediano", strength: 13, dexterity: 6, constitution: 16,
    attacks: [
      { name: "Golpe", attackBonus: "+3", reach: "5 ft", rangeShort: null, rangeLong: null, damage: "1d6 + 1", damageType: "contundente" },
    ],
    traits: "",
    vulnerabilities: null, resistances: null, immunities: "veneno", conditionImmunities: "envenenado",
    multiattack: false, source: "Compendio de monstruos D&D 5e",
  },
  {
    id: "monster-wolf", name: "Lobo", nameEn: "Wolf", cr: 0.25, crLabel: "1/4",
    ac: 13, hp: 11, hitDice: "2d8+2",
    speedWalk: 40, speedFly: 0, speedSwim: 0, speedClimb: 0, speedBurrow: 0,
    size: "Mediano", strength: 12, dexterity: 15, constitution: 12,
    attacks: [
      { name: "Mordida", attackBonus: "+4", reach: "5 ft", rangeShort: null, rangeLong: null, damage: "2d4 + 2", damageType: "perforante" },
    ],
    traits: "",
    vulnerabilities: null, resistances: null, immunities: null, conditionImmunities: null,
    multiattack: false, source: "Compendio de monstruos D&D 5e",
  },
  {
    id: "monster-brown-bear", name: "Oso pardo", nameEn: "Brown Bear", cr: 1, crLabel: "1",
    ac: 11, hp: 34, hitDice: "4d10+12",
    speedWalk: 40, speedFly: 0, speedSwim: 0, speedClimb: 30, speedBurrow: 0,
    size: "Grande", strength: 19, dexterity: 10, constitution: 16,
    attacks: [
      { name: "Mordida", attackBonus: "+5", reach: "5 ft", rangeShort: null, rangeLong: null, damage: "1d8 + 4", damageType: "perforante" },
      { name: "Garras", attackBonus: "+5", reach: "5 ft", rangeShort: null, rangeLong: null, damage: "2d6 + 4", damageType: "cortante" },
    ],
    traits: "Multiataque: el oso hace dos ataques, uno de mordida y uno de garras.",
    vulnerabilities: null, resistances: null, immunities: null, conditionImmunities: null,
    multiattack: true, source: "Compendio de monstruos D&D 5e",
  },
  {
    id: "monster-troll", name: "Troll", nameEn: "Troll", cr: 5, crLabel: "5",
    ac: 15, hp: 84, hitDice: "8d10+40",
    speedWalk: 30, speedFly: 0, speedSwim: 0, speedClimb: 0, speedBurrow: 0,
    size: "Grande", strength: 18, dexterity: 13, constitution: 20,
    attacks: [
      { name: "Mordida", attackBonus: "+7", reach: "5 ft", rangeShort: null, rangeLong: null, damage: "1d6 + 4", damageType: "perforante" },
      { name: "Garra (x2)", attackBonus: "+7", reach: "5 ft", rangeShort: null, rangeLong: null, damage: "2d6 + 4", damageType: "cortante" },
    ],
    traits: "Multiataque: mordida + dos garras. Regeneración: recupera 10 PV al inicio de su turno, excepto si recibió daño de fuego o ácido desde su último turno.",
    vulnerabilities: null, resistances: null, immunities: null, conditionImmunities: null,
    multiattack: true, source: "Compendio de monstruos D&D 5e",
  },
  {
    id: "monster-ogre", name: "Ogro", nameEn: "Ogre", cr: 2, crLabel: "2",
    ac: 11, hp: 59, hitDice: "7d10+21",
    speedWalk: 40, speedFly: 0, speedSwim: 0, speedClimb: 0, speedBurrow: 0,
    size: "Grande", strength: 19, dexterity: 8, constitution: 16,
    attacks: [
      { name: "Gran garrote", attackBonus: "+6", reach: "5 ft", rangeShort: null, rangeLong: null, damage: "2d8 + 4", damageType: "contundente" },
      { name: "Jabalina", attackBonus: "+6", reach: null, rangeShort: 30, rangeLong: 120, damage: "2d6 + 4", damageType: "perforante" },
    ],
    traits: "",
    vulnerabilities: null, resistances: null, immunities: null, conditionImmunities: null,
    multiattack: false, source: "Compendio de monstruos D&D 5e",
  },
  {
    id: "monster-young-red-dragon", name: "Dragón rojo joven", nameEn: "Young Red Dragon", cr: 10, crLabel: "10",
    ac: 18, hp: 178, hitDice: "17d10+85",
    speedWalk: 40, speedFly: 80, speedSwim: 0, speedClimb: 40, speedBurrow: 0,
    size: "Enorme", strength: 23, dexterity: 10, constitution: 21,
    attacks: [
      { name: "Mordida", attackBonus: "+10", reach: "10 ft", rangeShort: null, rangeLong: null, damage: "2d10 + 6 perforante + 2d6", damageType: "perforante y fuego" },
      { name: "Garra (x2)", attackBonus: "+10", reach: "5 ft", rangeShort: null, rangeLong: null, damage: "2d6 + 6", damageType: "cortante" },
      { name: "Aliento de fuego (recarga 5-6)", attackBonus: "—", reach: "Cono de 30 ft", rangeShort: null, rangeLong: null, damage: "16d6", damageType: "fuego (mitad de daño con salvación exitosa)" },
    ],
    traits: "Multiataque: mordida + dos garras. Aliento de fuego (recarga 5-6): cono de 30 pies, tirada de salvación de Destreza CD 17, 16d6 de daño de fuego (mitad con éxito).",
    vulnerabilities: null, resistances: null, immunities: "fuego", conditionImmunities: null,
    multiattack: true, source: "Compendio de monstruos D&D 5e",
  },
];

async function main() {
  console.log("Sembrando monstruos del tablero de combate...");
  for (const monster of MONSTERS) {
    // `attacks` es un array de objetos tipados (AttackSeed[]); Prisma espera
    // `InputJsonValue` para los campos Json y TypeScript no puede verificar
    // automáticamente que un array de objetos "encaja" en esa unión — mismo
    // caso que ya vimos en combat.routes.ts. Cast explícito para resolverlo.
    const data = monster as unknown as Prisma.MonsterCatalogPresetCreateInput;

    await prisma.monsterCatalogPreset.upsert({
      where: { id: monster.id },
      update: data,
      create: data,
    });
  }
  console.log(`${MONSTERS.length} monstruos sembrados.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });