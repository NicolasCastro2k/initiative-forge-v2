// backend/prisma/seed-weapon-presets.ts
//
// Ejecutar con: npx tsx prisma/seed-weapon-presets.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type WeaponSeed = {
  id: string;
  name: string;
  category: "simple" | "martial";
  attackType: "melee" | "ranged";
  damageDice: string;
  versatileDice?: string;
  damageType: string;
  properties: string[];
  rangeNormal?: number;
  rangeLong?: number;
  isFinesse?: boolean;
  isTwoHanded?: boolean;
  isLight?: boolean;
  isHeavy?: boolean;
  isReach?: boolean;
  isThrown?: boolean;
  requiresAmmo?: boolean;
  requiresLoading?: boolean;
  isSpecial?: boolean;
};

const WEAPONS: WeaponSeed[] = [
  // ─── Armas Simples — Cuerpo a cuerpo ────────────────────────────────────────
  { id: "club", name: "Garrote", category: "simple", attackType: "melee",
    damageDice: "1d4", damageType: "contundente", properties: ["Ligera"], isLight: true },
  { id: "dagger", name: "Daga", category: "simple", attackType: "melee",
    damageDice: "1d4", damageType: "perforante", properties: ["Finesse", "Ligera", "Arrojadiza (20/60)"],
    isFinesse: true, isLight: true, isThrown: true, rangeNormal: 20, rangeLong: 60 },
  { id: "greatclub", name: "Gran Garrote", category: "simple", attackType: "melee",
    damageDice: "1d8", damageType: "contundente", properties: ["Dos manos"], isTwoHanded: true },
  { id: "handaxe", name: "Hacha de mano", category: "simple", attackType: "melee",
    damageDice: "1d6", damageType: "cortante", properties: ["Ligera", "Arrojadiza (20/60)"],
    isLight: true, isThrown: true, rangeNormal: 20, rangeLong: 60 },
  { id: "javelin", name: "Jabalina", category: "simple", attackType: "melee",
    damageDice: "1d6", damageType: "perforante", properties: ["Arrojadiza (30/120)"],
    isThrown: true, rangeNormal: 30, rangeLong: 120 },
  { id: "light-hammer", name: "Martillo ligero", category: "simple", attackType: "melee",
    damageDice: "1d4", damageType: "contundente", properties: ["Ligera", "Arrojadiza (20/60)"],
    isLight: true, isThrown: true, rangeNormal: 20, rangeLong: 60 },
  { id: "mace", name: "Maza", category: "simple", attackType: "melee",
    damageDice: "1d6", damageType: "contundente", properties: [] },
  { id: "quarterstaff", name: "Bastón", category: "simple", attackType: "melee",
    damageDice: "1d6", versatileDice: "1d8", damageType: "contundente", properties: ["Versátil (1d8)"] },
  { id: "sickle", name: "Hoz", category: "simple", attackType: "melee",
    damageDice: "1d4", damageType: "cortante", properties: ["Ligera"], isLight: true },
  { id: "spear", name: "Lanza", category: "simple", attackType: "melee",
    damageDice: "1d6", versatileDice: "1d8", damageType: "perforante", properties: ["Arrojadiza (20/60)", "Versátil (1d8)"],
    isThrown: true, rangeNormal: 20, rangeLong: 60 },

  // ─── Armas Simples — Distancia ───────────────────────────────────────────────
  { id: "light-crossbow", name: "Ballesta ligera", category: "simple", attackType: "ranged",
    damageDice: "1d8", damageType: "perforante", properties: ["Munición (80/320)", "Carga", "Dos manos"],
    requiresAmmo: true, requiresLoading: true, isTwoHanded: true, rangeNormal: 80, rangeLong: 320 },
  { id: "dart", name: "Dardo", category: "simple", attackType: "ranged",
    damageDice: "1d4", damageType: "perforante", properties: ["Finesse", "Arrojadiza (20/60)"],
    isFinesse: true, isThrown: true, rangeNormal: 20, rangeLong: 60 },
  { id: "shortbow", name: "Arco corto", category: "simple", attackType: "ranged",
    damageDice: "1d6", damageType: "perforante", properties: ["Munición (80/320)", "Dos manos"],
    requiresAmmo: true, isTwoHanded: true, rangeNormal: 80, rangeLong: 320 },
  { id: "sling", name: "Honda", category: "simple", attackType: "ranged",
    damageDice: "1d4", damageType: "contundente", properties: ["Munición (30/120)"],
    requiresAmmo: true, rangeNormal: 30, rangeLong: 120 },

  // ─── Armas Marciales — Cuerpo a cuerpo ───────────────────────────────────────
  { id: "battleaxe", name: "Hacha de batalla", category: "martial", attackType: "melee",
    damageDice: "1d8", versatileDice: "1d10", damageType: "cortante", properties: ["Versátil (1d10)"] },
  { id: "flail", name: "Mangual", category: "martial", attackType: "melee",
    damageDice: "1d8", damageType: "contundente", properties: [] },
  { id: "glaive", name: "Guja", category: "martial", attackType: "melee",
    damageDice: "1d10", damageType: "cortante", properties: ["Pesada", "Alcance", "Dos manos"],
    isHeavy: true, isReach: true, isTwoHanded: true },
  { id: "greataxe", name: "Gran hacha", category: "martial", attackType: "melee",
    damageDice: "1d12", damageType: "cortante", properties: ["Pesada", "Dos manos"],
    isHeavy: true, isTwoHanded: true },
  { id: "greatsword", name: "Espadón", category: "martial", attackType: "melee",
    damageDice: "2d6", damageType: "cortante", properties: ["Pesada", "Dos manos"],
    isHeavy: true, isTwoHanded: true },
  { id: "halberd", name: "Alabarda", category: "martial", attackType: "melee",
    damageDice: "1d10", damageType: "cortante", properties: ["Pesada", "Alcance", "Dos manos"],
    isHeavy: true, isReach: true, isTwoHanded: true },
  { id: "lance", name: "Lanza de caballería", category: "martial", attackType: "melee",
    damageDice: "1d12", damageType: "perforante", properties: ["Alcance", "Especial"],
    isReach: true, isSpecial: true },
  { id: "longsword", name: "Espada larga", category: "martial", attackType: "melee",
    damageDice: "1d8", versatileDice: "1d10", damageType: "cortante", properties: ["Versátil (1d10)"] },
  { id: "maul", name: "Gran maza", category: "martial", attackType: "melee",
    damageDice: "2d6", damageType: "contundente", properties: ["Pesada", "Dos manos"],
    isHeavy: true, isTwoHanded: true },
  { id: "morningstar", name: "Lucero del alba", category: "martial", attackType: "melee",
    damageDice: "1d8", damageType: "perforante", properties: [] },
  { id: "pike", name: "Pica", category: "martial", attackType: "melee",
    damageDice: "1d10", damageType: "perforante", properties: ["Pesada", "Alcance", "Dos manos"],
    isHeavy: true, isReach: true, isTwoHanded: true },
  { id: "rapier", name: "Estoque", category: "martial", attackType: "melee",
    damageDice: "1d8", damageType: "perforante", properties: ["Finesse"], isFinesse: true },
  { id: "scimitar", name: "Cimitarra", category: "martial", attackType: "melee",
    damageDice: "1d6", damageType: "cortante", properties: ["Finesse", "Ligera"], isFinesse: true, isLight: true },
  { id: "shortsword", name: "Espada corta", category: "martial", attackType: "melee",
    damageDice: "1d6", damageType: "perforante", properties: ["Finesse", "Ligera"], isFinesse: true, isLight: true },
  { id: "trident", name: "Tridente", category: "martial", attackType: "melee",
    damageDice: "1d6", versatileDice: "1d8", damageType: "perforante", properties: ["Arrojadiza (20/60)", "Versátil (1d8)"],
    isThrown: true, rangeNormal: 20, rangeLong: 60 },
  { id: "war-pick", name: "Pico de guerra", category: "martial", attackType: "melee",
    damageDice: "1d8", damageType: "perforante", properties: [] },
  { id: "warhammer", name: "Martillo de guerra", category: "martial", attackType: "melee",
    damageDice: "1d8", versatileDice: "1d10", damageType: "contundente", properties: ["Versátil (1d10)"] },
  { id: "whip", name: "Látigo", category: "martial", attackType: "melee",
    damageDice: "1d4", damageType: "cortante", properties: ["Finesse", "Alcance"], isFinesse: true, isReach: true },

  // ─── Armas Marciales — Distancia ─────────────────────────────────────────────
  { id: "blowgun", name: "Cerbatana", category: "martial", attackType: "ranged",
    damageDice: "1", damageType: "perforante", properties: ["Munición (25/100)", "Carga"],
    requiresAmmo: true, requiresLoading: true, rangeNormal: 25, rangeLong: 100 },
  { id: "hand-crossbow", name: "Ballesta de mano", category: "martial", attackType: "ranged",
    damageDice: "1d6", damageType: "perforante", properties: ["Munición (30/120)", "Ligera", "Carga"],
    requiresAmmo: true, requiresLoading: true, isLight: true, rangeNormal: 30, rangeLong: 120 },
  { id: "heavy-crossbow", name: "Ballesta pesada", category: "martial", attackType: "ranged",
    damageDice: "1d10", damageType: "perforante", properties: ["Munición (100/400)", "Pesada", "Carga", "Dos manos"],
    requiresAmmo: true, requiresLoading: true, isHeavy: true, isTwoHanded: true, rangeNormal: 100, rangeLong: 400 },
  { id: "longbow", name: "Arco largo", category: "martial", attackType: "ranged",
    damageDice: "1d8", damageType: "perforante", properties: ["Munición (150/600)", "Pesada", "Dos manos"],
    requiresAmmo: true, isHeavy: true, isTwoHanded: true, rangeNormal: 150, rangeLong: 600 },
  { id: "net", name: "Red", category: "martial", attackType: "ranged",
    damageDice: "0", damageType: "especial", properties: ["Arrojadiza (5/15)", "Especial"],
    isThrown: true, isSpecial: true, rangeNormal: 5, rangeLong: 15 },
];

async function main() {
  console.log("Sembrando armas...");
  for (const weapon of WEAPONS) {
    await prisma.weaponPreset.upsert({
      where: { id: weapon.id },
      update: weapon,
      create: weapon,
    });
  }
  console.log(`${WEAPONS.length} armas sembradas.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });