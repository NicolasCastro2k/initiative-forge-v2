// backend/prisma/complete-class-progressions.ts
//
// Completa ClassFeaturePreset y SubclassPreset/SubclassFeaturePreset para
// las 13 clases del compendio (Fighter, Barbarian, Bard, Cleric, Druid,
// Monk, Paladin, Ranger, Rogue, Sorcerer, Warlock, Artificer, Wizard),
// SIN DUPLICAR nada que ya exista en tu base de datos.
//
// Requiere el archivo class-progression-data.json en la misma carpeta (prisma/).
//
// Para las 12 primeras clases, el script espera que ya existan en tu tabla
// ClassPreset (las busca por nombre) y solo completa lo que falte.
//
// Para Wizard (Mago), si no existe todavía en tu base de datos, el script
// la CREA primero con sus datos base (dado de golpe d6, atributo principal
// Inteligencia, salvaciones Inteligencia/Sabiduría, etc.) antes de agregar
// su progresión y subclases.
//
// Ejecutar con: npx tsx prisma/complete-class-progressions.ts

import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

type LevelEntry = { level: number; name: string; summary: string };
type SubclassFeature = { level: number; name: string; summary: string };
type SubclassEntry = {
  name: string;
  summary: string;
  level: number;
  features?: SubclassFeature[]; // opcional — solo Wizard trae rasgos desglosados por nivel
};
type ClassData = {
  name_en: string;
  name_es: string;
  levels: LevelEntry[];
  subclasses: SubclassEntry[];
  subclass_choice_level: number | null;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Datos base para crear la clase Wizard si todavía no existe en la DB.
// El resto de las 12 clases se asume que ya existen (se buscan por nombre).
const WIZARD_BASE_DATA = {
  id: "wizard",
  name: "Wizard",
  source: "SRD 2014",
  description:
    "Lanzador de conjuros arcanos con la mayor cantidad de magia disponible del juego. Destaca por su versatilidad, preparación diaria de conjuros y especialización en una Escuela de Magia.",
  hitDie: 6,
  primaryAbilities: ["Intelligence"],
  savingThrows: ["Intelligence", "Wisdom"],
  armorTraining: [] as string[],
  weaponTraining: ["Daggers", "Darts", "Slings", "Quarterstaffs", "Light Crossbows"],
  toolTraining: [] as string[],
  skillChoices: ["Arcana", "History", "Insight", "Investigation", "Medicine", "Religion"],
  skillChoiceCount: 2,
  spellcastingType: "PREPARED",
  spellcastingAbility: "Intelligence",
  isOfficial: true,
  isSrd: true,
};

async function main() {
  const dataPath = path.join(process.cwd(), "prisma", "class-progression-data.json");
  const raw = fs.readFileSync(dataPath, "utf-8");
  const compendium: Record<string, ClassData> = JSON.parse(raw);

  const existingClasses = await prisma.classPreset.findMany();
  const classByName = new Map(existingClasses.map((c) => [c.name.trim().toLowerCase(), c]));

  let totalFeaturesAdded = 0;
  let totalFeaturesSkipped = 0;
  let totalSubclassesCreated = 0;
  let totalSubFeaturesAdded = 0;
  let totalSubFeaturesSkipped = 0;
  let classesCreated = 0;
  const unmatchedClasses: string[] = [];

  for (const [classKey, classData] of Object.entries(compendium)) {
    let dbClass = classByName.get(classData.name_en.trim().toLowerCase());

    // Si la clase no existe y es Wizard, la creamos. Para cualquier otra
    // clase sin coincidencia, la reportamos y la saltamos (no inventamos
    // datos base que no tenemos confirmados para esa clase).
    if (!dbClass) {
      if (classKey === "wizard") {
        dbClass = await prisma.classPreset.create({ data: WIZARD_BASE_DATA });
        classesCreated++;
        console.log(`\n=== ${dbClass.name} (creada) ===`);
      } else {
        unmatchedClasses.push(`${classData.name_en} (${classKey})`);
        continue;
      }
    } else {
      console.log(`\n=== ${dbClass.name} ===`);
    }

    // ─── Rasgos de clase por nivel ────────────────────────────────────────
    const existingFeatures = await prisma.classFeaturePreset.findMany({
      where: { classPresetId: dbClass.id },
    });
    const existingKey = (level: number, name: string) => `${level}::${name.trim().toLowerCase()}`;
    const existingSet = new Set(existingFeatures.map((f) => existingKey(f.level, f.name)));

    for (const lvl of classData.levels) {
      const key = existingKey(lvl.level, lvl.name);
      if (existingSet.has(key)) {
        totalFeaturesSkipped++;
        continue;
      }
      await prisma.classFeaturePreset.create({
        data: {
          classPresetId: dbClass.id,
          level: lvl.level,
          name: lvl.name.slice(0, 190),
          summary: lvl.summary,
        },
      });
      totalFeaturesAdded++;
      console.log(`  + Rasgo agregado: Nv.${lvl.level} "${lvl.name}"`);
    }

    // ─── Subclases ──────────────────────────────────────────────────────────
    const existingSubclasses = await prisma.subclassPreset.findMany({
      where: { classPresetId: dbClass.id },
    });
    const subclassByName = new Map(
      existingSubclasses.map((s) => [s.name.trim().toLowerCase(), s])
    );

    for (const sub of classData.subclasses) {
      let dbSubclass = subclassByName.get(sub.name.trim().toLowerCase());

      if (!dbSubclass) {
        let subId = `${dbClass.id}-${slugify(sub.name)}`;
        const idExists = await prisma.subclassPreset.findUnique({ where: { id: subId } });
        if (idExists) subId = `${subId}-${Date.now()}`;

        dbSubclass = await prisma.subclassPreset.create({
          data: {
            id: subId,
            classPresetId: dbClass.id,
            name: sub.name,
            source: "Compendio SRD",
            description: sub.summary.slice(0, 500),
          },
        });
        totalSubclassesCreated++;
        console.log(`  + Subclase creada: "${sub.name}"`);
      }

      const existingSubFeatures = await prisma.subclassFeaturePreset.findMany({
        where: { subclassPresetId: dbSubclass.id },
      });
      const existingSubKey = new Set(
        existingSubFeatures.map((f) => `${f.level}::${f.name.trim().toLowerCase()}`)
      );

      // Si la subclase trae rasgos desglosados por nivel (caso Wizard), los usamos.
      // Si no (las otras 12 clases), guardamos un único rasgo base al nivel de elección.
      const featuresToAdd: { level: number; name: string; summary: string }[] =
        sub.features && sub.features.length > 0
          ? sub.features
          : [{ level: sub.level, name: sub.name, summary: sub.summary }];

      for (const feat of featuresToAdd) {
        const key = `${feat.level}::${feat.name.trim().toLowerCase()}`;
        if (existingSubKey.has(key)) {
          totalSubFeaturesSkipped++;
          continue;
        }
        await prisma.subclassFeaturePreset.create({
          data: {
            subclassPresetId: dbSubclass.id,
            level: feat.level,
            name: feat.name,
            summary: feat.summary,
          },
        });
        totalSubFeaturesAdded++;
        console.log(`    + Rasgo de subclase agregado: "${feat.name}" (Nv.${feat.level}) — ${sub.name}`);
      }
    }
  }

  console.log("\n========================================");
  console.log("RESUMEN FINAL — 13 CLASES");
  console.log("========================================");
  console.log(`Clases creadas (solo si faltaban): ${classesCreated}`);
  console.log(`Rasgos de clase agregados: ${totalFeaturesAdded}`);
  console.log(`Rasgos de clase ya existentes (omitidos): ${totalFeaturesSkipped}`);
  console.log(`Subclases nuevas creadas: ${totalSubclassesCreated}`);
  console.log(`Rasgos de subclase agregados: ${totalSubFeaturesAdded}`);
  console.log(`Rasgos de subclase ya existentes (omitidos): ${totalSubFeaturesSkipped}`);
  if (unmatchedClasses.length > 0) {
    console.log(`\nAVISO — clases del compendio sin coincidencia en tu DB (no se tocaron):`);
    unmatchedClasses.forEach((c) => console.log(`  - ${c}`));
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });