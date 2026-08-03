import { Router } from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import { prisma } from "../lib/prisma.js";
import { requireAdmin, requireAuth } from "../lib/requireAuth.js";
import { uploadImageToSupabase } from "../lib/supabaseStorage.js";

export const adminRouter = Router();

adminRouter.use(requireAuth);
adminRouter.use(requireAdmin);

// ─── Subida de token para bestias (Forma Salvaje) ──────────────────────────────
// Antes se guardaba en disco local (multer.diskStorage) — en Render (plan
// gratis) ese disco se borra en cada redeploy/reinicio, así que ahora se
// guarda en memoria y se sube a Supabase Storage (ver lib/supabaseStorage.ts).
const uploadBeastImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.mimetype)) {
      callback(new Error("Solo se permiten imágenes JPG, PNG, WEBP o GIF."));
      return;
    }
    callback(null, true);
  },
});

adminRouter.post("/users", async (req, res) => {
  const name = String(req.body.name ?? "").trim();
  const email = String(req.body.email ?? "").trim().toLowerCase();
  const password = String(req.body.password ?? "");

  if (!name || !email || !password) {
    return res.status(400).json({
      message: "Nombre, correo y contraseña son obligatorios.",
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      message: "La contraseña debe tener al menos 8 caracteres.",
    });
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return res.status(409).json({
      message: "Ya existe un usuario con ese correo.",
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
    },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
    },
  });

  return res.status(201).json({
    user,
  });
});

adminRouter.get("/users", async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
    },
  });

  return res.json({
    users,
  });
});

// ─── Administración de armas (WeaponPreset) ────────────────────────────────────

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

adminRouter.get("/weapons", async (_req, res) => {
  try {
    const weapons = await prisma.weaponPreset.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    return res.json({ weapons });
  } catch (error) {
    console.error("Error en GET /admin/weapons:", error);
    return res.status(500).json({ message: "Error interno al cargar armas." });
  }
});

adminRouter.post("/weapons", async (req, res) => {
  try {
    const name = String(req.body.name ?? "").trim();
    const category = String(req.body.category ?? "simple");
    const attackType = String(req.body.attackType ?? "melee");
    const damageDice = String(req.body.damageDice ?? "").trim();
    const damageType = String(req.body.damageType ?? "").trim();

    if (!name || !damageDice || !damageType) {
      return res.status(400).json({
        message: "Nombre, dado de daño y tipo de daño son obligatorios.",
      });
    }

    let id = slugify(name);

    const existing = await prisma.weaponPreset.findUnique({ where: { id } });
    if (existing) {
      id = `${id}-${Date.now()}`;
    }

    const weapon = await prisma.weaponPreset.create({
      data: {
        id,
        name,
        category,
        attackType,
        damageDice,
        versatileDice: req.body.versatileDice ? String(req.body.versatileDice).trim() : null,
        damageType,
        properties: Array.isArray(req.body.properties) ? req.body.properties : [],
        rangeNormal: req.body.rangeNormal !== undefined && req.body.rangeNormal !== "" ? Number(req.body.rangeNormal) : null,
        rangeLong: req.body.rangeLong !== undefined && req.body.rangeLong !== "" ? Number(req.body.rangeLong) : null,
        isFinesse: Boolean(req.body.isFinesse),
        isTwoHanded: Boolean(req.body.isTwoHanded),
        isLight: Boolean(req.body.isLight),
        isHeavy: Boolean(req.body.isHeavy),
        isReach: Boolean(req.body.isReach),
        isThrown: Boolean(req.body.isThrown),
        requiresAmmo: Boolean(req.body.requiresAmmo),
        requiresLoading: Boolean(req.body.requiresLoading),
        isSpecial: Boolean(req.body.isSpecial),
        source: req.body.source ? String(req.body.source) : "Personalizada",
      },
    });

    return res.status(201).json({ weapon });
  } catch (error) {
    console.error("Error en POST /admin/weapons:", error);
    return res.status(500).json({ message: "Error interno al crear el arma." });
  }
});

adminRouter.put("/weapons/:weaponId", async (req, res) => {
  try {
    const weaponId = String(req.params.weaponId);

    const existing = await prisma.weaponPreset.findUnique({ where: { id: weaponId } });
    if (!existing) {
      return res.status(404).json({ message: "Arma no encontrada." });
    }

    const weapon = await prisma.weaponPreset.update({
      where: { id: weaponId },
      data: {
        name: req.body.name !== undefined ? String(req.body.name).trim() : existing.name,
        category: req.body.category !== undefined ? String(req.body.category) : existing.category,
        attackType: req.body.attackType !== undefined ? String(req.body.attackType) : existing.attackType,
        damageDice: req.body.damageDice !== undefined ? String(req.body.damageDice).trim() : existing.damageDice,
        versatileDice: req.body.versatileDice !== undefined ? (req.body.versatileDice ? String(req.body.versatileDice).trim() : null) : existing.versatileDice,
        damageType: req.body.damageType !== undefined ? String(req.body.damageType).trim() : existing.damageType,
        properties: req.body.properties !== undefined ? req.body.properties : existing.properties,
        rangeNormal: req.body.rangeNormal !== undefined ? (req.body.rangeNormal === "" ? null : Number(req.body.rangeNormal)) : existing.rangeNormal,
        rangeLong: req.body.rangeLong !== undefined ? (req.body.rangeLong === "" ? null : Number(req.body.rangeLong)) : existing.rangeLong,
        isFinesse: req.body.isFinesse !== undefined ? Boolean(req.body.isFinesse) : existing.isFinesse,
        isTwoHanded: req.body.isTwoHanded !== undefined ? Boolean(req.body.isTwoHanded) : existing.isTwoHanded,
        isLight: req.body.isLight !== undefined ? Boolean(req.body.isLight) : existing.isLight,
        isHeavy: req.body.isHeavy !== undefined ? Boolean(req.body.isHeavy) : existing.isHeavy,
        isReach: req.body.isReach !== undefined ? Boolean(req.body.isReach) : existing.isReach,
        isThrown: req.body.isThrown !== undefined ? Boolean(req.body.isThrown) : existing.isThrown,
        requiresAmmo: req.body.requiresAmmo !== undefined ? Boolean(req.body.requiresAmmo) : existing.requiresAmmo,
        requiresLoading: req.body.requiresLoading !== undefined ? Boolean(req.body.requiresLoading) : existing.requiresLoading,
        isSpecial: req.body.isSpecial !== undefined ? Boolean(req.body.isSpecial) : existing.isSpecial,
        source: req.body.source !== undefined ? String(req.body.source) : existing.source,
      },
    });

    return res.json({ weapon });
  } catch (error) {
    console.error("Error en PUT /admin/weapons/:weaponId:", error);
    return res.status(500).json({ message: "Error interno al actualizar el arma." });
  }
});

adminRouter.delete("/weapons/:weaponId", async (req, res) => {
  try {
    const weaponId = String(req.params.weaponId);

    const existing = await prisma.weaponPreset.findUnique({ where: { id: weaponId } });
    if (!existing) {
      return res.status(404).json({ message: "Arma no encontrada." });
    }

    await prisma.weaponPreset.delete({ where: { id: weaponId } });

    return res.json({ ok: true, message: "Arma eliminada." });
  } catch (error) {
    console.error("Error en DELETE /admin/weapons/:weaponId:", error);
    return res.status(500).json({ message: "Error interno al eliminar el arma." });
  }
});

// ─── Administración de hechizos (SpellPreset) ──────────────────────────────────

adminRouter.get("/spells", async (_req, res) => {
  try {
    const spells = await prisma.spellPreset.findMany({
      orderBy: [{ level: "asc" }, { name: "asc" }],
    });

    return res.json({ spells });
  } catch (error) {
    console.error("Error en GET /admin/spells:", error);
    return res.status(500).json({ message: "Error interno al cargar hechizos." });
  }
});

adminRouter.post("/spells", async (req, res) => {
  try {
    const name = String(req.body.name ?? "").trim();
    const level = Number(req.body.level ?? 0);
    const school = String(req.body.school ?? "").trim();
    const castingTime = String(req.body.castingTime ?? "").trim();
    const range = String(req.body.range ?? "").trim();
    const duration = String(req.body.duration ?? "").trim();
    const description = String(req.body.description ?? "").trim();

    if (!name || !school || !castingTime || !range || !duration || !description) {
      return res.status(400).json({
        message: "Nombre, escuela, tiempo, alcance, duración y descripción son obligatorios.",
      });
    }

    let id = slugify(name);
    const existing = await prisma.spellPreset.findUnique({ where: { id } });
    if (existing) {
      id = `${id}-${Date.now()}`;
    }

    const spell = await prisma.spellPreset.create({
      data: {
        id,
        name,
        level,
        school,
        castingTime,
        range,
        rangeFeet: req.body.rangeFeet !== undefined && req.body.rangeFeet !== "" ? Number(req.body.rangeFeet) : null,
        components: Array.isArray(req.body.components) ? req.body.components : [],
        duration,
        concentration: Boolean(req.body.concentration),
        ritual: Boolean(req.body.ritual),
        classes: Array.isArray(req.body.classes) ? req.body.classes : [],
        description,
        attackType: req.body.attackType || null,
        savingThrow: req.body.savingThrow || null,
        damageDice: req.body.damageDice ? String(req.body.damageDice).trim() : null,
        damageType: req.body.damageType ? String(req.body.damageType).trim() : null,
        healingDice: req.body.healingDice ? String(req.body.healingDice).trim() : null,
        areaShape: req.body.areaShape || null,
        areaSizeFeet: req.body.areaSizeFeet !== undefined && req.body.areaSizeFeet !== "" ? Number(req.body.areaSizeFeet) : null,
        higherLevels: req.body.higherLevels ? String(req.body.higherLevels).trim() : null,
        notes: req.body.notes ? String(req.body.notes).trim() : null,
        source: req.body.source ? String(req.body.source) : "Personalizado",
      },
    });

    return res.status(201).json({ spell });
  } catch (error) {
    console.error("Error en POST /admin/spells:", error);
    return res.status(500).json({ message: "Error interno al crear el hechizo." });
  }
});

adminRouter.put("/spells/:spellId", async (req, res) => {
  try {
    const spellId = String(req.params.spellId);

    const existing = await prisma.spellPreset.findUnique({ where: { id: spellId } });
    if (!existing) {
      return res.status(404).json({ message: "Hechizo no encontrado." });
    }

    const spell = await prisma.spellPreset.update({
      where: { id: spellId },
      data: {
        name: req.body.name !== undefined ? String(req.body.name).trim() : existing.name,
        level: req.body.level !== undefined ? Number(req.body.level) : existing.level,
        school: req.body.school !== undefined ? String(req.body.school).trim() : existing.school,
        castingTime: req.body.castingTime !== undefined ? String(req.body.castingTime).trim() : existing.castingTime,
        range: req.body.range !== undefined ? String(req.body.range).trim() : existing.range,
        rangeFeet: req.body.rangeFeet !== undefined ? (req.body.rangeFeet === "" ? null : Number(req.body.rangeFeet)) : existing.rangeFeet,
        components: req.body.components !== undefined ? req.body.components : existing.components,
        duration: req.body.duration !== undefined ? String(req.body.duration).trim() : existing.duration,
        concentration: req.body.concentration !== undefined ? Boolean(req.body.concentration) : existing.concentration,
        ritual: req.body.ritual !== undefined ? Boolean(req.body.ritual) : existing.ritual,
        classes: req.body.classes !== undefined ? req.body.classes : existing.classes,
        description: req.body.description !== undefined ? String(req.body.description).trim() : existing.description,
        attackType: req.body.attackType !== undefined ? (req.body.attackType || null) : existing.attackType,
        savingThrow: req.body.savingThrow !== undefined ? (req.body.savingThrow || null) : existing.savingThrow,
        damageDice: req.body.damageDice !== undefined ? (req.body.damageDice ? String(req.body.damageDice).trim() : null) : existing.damageDice,
        damageType: req.body.damageType !== undefined ? (req.body.damageType ? String(req.body.damageType).trim() : null) : existing.damageType,
        healingDice: req.body.healingDice !== undefined ? (req.body.healingDice ? String(req.body.healingDice).trim() : null) : existing.healingDice,
        areaShape: req.body.areaShape !== undefined ? (req.body.areaShape || null) : existing.areaShape,
        areaSizeFeet: req.body.areaSizeFeet !== undefined ? (req.body.areaSizeFeet === "" ? null : Number(req.body.areaSizeFeet)) : existing.areaSizeFeet,
        higherLevels: req.body.higherLevels !== undefined ? (req.body.higherLevels ? String(req.body.higherLevels).trim() : null) : existing.higherLevels,
        notes: req.body.notes !== undefined ? (req.body.notes ? String(req.body.notes).trim() : null) : existing.notes,
        source: req.body.source !== undefined ? String(req.body.source) : existing.source,
      },
    });

    return res.json({ spell });
  } catch (error) {
    console.error("Error en PUT /admin/spells/:spellId:", error);
    return res.status(500).json({ message: "Error interno al actualizar el hechizo." });
  }
});

adminRouter.delete("/spells/:spellId", async (req, res) => {
  try {
    const spellId = String(req.params.spellId);

    const existing = await prisma.spellPreset.findUnique({ where: { id: spellId } });
    if (!existing) {
      return res.status(404).json({ message: "Hechizo no encontrado." });
    }

    await prisma.spellPreset.delete({ where: { id: spellId } });

    return res.json({ ok: true, message: "Hechizo eliminado." });
  } catch (error) {
    console.error("Error en DELETE /admin/spells/:spellId:", error);
    return res.status(500).json({ message: "Error interno al eliminar el hechizo." });
  }
});

// ─── Administración de razas (RacePreset) ──────────────────────────────────────

adminRouter.get("/races", async (_req, res) => {
  try {
    const races = await prisma.racePreset.findMany({
      orderBy: { name: "asc" },
    });

    return res.json({ races });
  } catch (error) {
    console.error("Error en GET /admin/races:", error);
    return res.status(500).json({ message: "Error interno al cargar razas." });
  }
});

adminRouter.post("/races", async (req, res) => {
  try {
    const name = String(req.body.name ?? "").trim();
    const appearance = String(req.body.appearance ?? "").trim();

    if (!name) {
      return res.status(400).json({ message: "El nombre de la raza es obligatorio." });
    }

    let id = slugify(name);
    const existing = await prisma.racePreset.findUnique({ where: { id } });
    if (existing) {
      id = `${id}-${Date.now()}`;
    }

    const race = await prisma.racePreset.create({
      data: {
        id,
        name,
        source: req.body.source ? String(req.body.source) : "Personalizada",
        speed: req.body.speed !== undefined ? Number(req.body.speed) : 30,
        size: req.body.size ? String(req.body.size) : "Medium",
        abilityBonuses: req.body.abilityBonuses ?? {},
        traits: Array.isArray(req.body.traits) ? req.body.traits : [],
        languages: Array.isArray(req.body.languages) ? req.body.languages : [],
        appearance,
        commonClasses: Array.isArray(req.body.commonClasses) ? req.body.commonClasses : [],
        isSrd: Boolean(req.body.isSrd),
      },
    });

    return res.status(201).json({ race });
  } catch (error) {
    console.error("Error en POST /admin/races:", error);
    return res.status(500).json({ message: "Error interno al crear la raza." });
  }
});

adminRouter.put("/races/:raceId", async (req, res) => {
  try {
    const raceId = String(req.params.raceId);

    const existing = await prisma.racePreset.findUnique({ where: { id: raceId } });
    if (!existing) {
      return res.status(404).json({ message: "Raza no encontrada." });
    }

    const race = await prisma.racePreset.update({
      where: { id: raceId },
      data: {
        name: req.body.name !== undefined ? String(req.body.name).trim() : existing.name,
        source: req.body.source !== undefined ? String(req.body.source) : existing.source,
        speed: req.body.speed !== undefined ? Number(req.body.speed) : existing.speed,
        size: req.body.size !== undefined ? String(req.body.size) : existing.size,
        abilityBonuses: req.body.abilityBonuses !== undefined ? req.body.abilityBonuses : existing.abilityBonuses,
        traits: req.body.traits !== undefined ? req.body.traits : existing.traits,
        languages: req.body.languages !== undefined ? req.body.languages : existing.languages,
        appearance: req.body.appearance !== undefined ? String(req.body.appearance).trim() : existing.appearance,
        commonClasses: req.body.commonClasses !== undefined ? req.body.commonClasses : existing.commonClasses,
        isSrd: req.body.isSrd !== undefined ? Boolean(req.body.isSrd) : existing.isSrd,
      },
    });

    return res.json({ race });
  } catch (error) {
    console.error("Error en PUT /admin/races/:raceId:", error);
    return res.status(500).json({ message: "Error interno al actualizar la raza." });
  }
});

adminRouter.delete("/races/:raceId", async (req, res) => {
  try {
    const raceId = String(req.params.raceId);

    const existing = await prisma.racePreset.findUnique({ where: { id: raceId } });
    if (!existing) {
      return res.status(404).json({ message: "Raza no encontrada." });
    }

    await prisma.racePreset.delete({ where: { id: raceId } });

    return res.json({ ok: true, message: "Raza eliminada." });
  } catch (error) {
    console.error("Error en DELETE /admin/races/:raceId:", error);
    return res.status(500).json({ message: "Error interno al eliminar la raza." });
  }
});

// ─── Administración de bestias — Forma Salvaje (BeastPreset) ──────────────────

function beastDataFromBody(req: import("express").Request, existing?: { [key: string]: unknown }) {
  const pick = (key: string, fallback: unknown) => (req.body[key] !== undefined ? req.body[key] : (existing ? existing[key] : fallback));

  return {
    name: String(pick("name", "")).trim(),
    nameEn: pick("nameEn", null) ? String(pick("nameEn", "")).trim() : null,
    cr: Number(pick("cr", 0)),
    crLabel: String(pick("crLabel", "0")).trim(),
    ac: Number(pick("ac", 10)),
    hp: Number(pick("hp", 1)),
    hitDice: String(pick("hitDice", "")).trim(),
    speedWalk: Number(pick("speedWalk", 0)),
    speedFly: Number(pick("speedFly", 0)),
    speedSwim: Number(pick("speedSwim", 0)),
    speedClimb: Number(pick("speedClimb", 0)),
    speedBurrow: Number(pick("speedBurrow", 0)),
    size: String(pick("size", "Mediano")).trim(),
    strength: Number(pick("strength", 10)),
    dexterity: Number(pick("dexterity", 10)),
    constitution: Number(pick("constitution", 10)),
    attacks: Array.isArray(pick("attacks", [])) ? pick("attacks", []) : [],
    traits: String(pick("traits", "")).trim(),
    vulnerabilities: pick("vulnerabilities", null) ? String(pick("vulnerabilities", "")).trim() : null,
    resistances: pick("resistances", null) ? String(pick("resistances", "")).trim() : null,
    immunities: pick("immunities", null) ? String(pick("immunities", "")).trim() : null,
    conditionImmunities: pick("conditionImmunities", null) ? String(pick("conditionImmunities", "")).trim() : null,
    multiattack: Boolean(pick("multiattack", false)),
    minDruidLevel: pick("minDruidLevel", null) === null || pick("minDruidLevel", null) === "" ? null : Number(pick("minDruidLevel", null)),
    minMoonDruidLevel: pick("minMoonDruidLevel", null) === null || pick("minMoonDruidLevel", null) === "" ? null : Number(pick("minMoonDruidLevel", null)),
    source: String(pick("source", "Personalizada")).trim(),
  };
}
adminRouter.get("/beasts", async (_req, res) => {
  try {
    const beasts = await prisma.beastPreset.findMany({
      orderBy: [{ cr: "asc" }, { name: "asc" }],
    });

    return res.json({ beasts });
  } catch (error) {
    console.error("Error en GET /admin/beasts:", error);
    return res.status(500).json({ message: "Error interno al cargar bestias." });
  }
});

adminRouter.post("/beasts", async (req, res) => {
  try {
    const data = beastDataFromBody(req);

    if (!data.name || !data.hitDice) {
      return res.status(400).json({ message: "Nombre y dado de golpe son obligatorios." });
    }

    let id = slugify(data.name);
    const existing = await prisma.beastPreset.findUnique({ where: { id } });
    if (existing) id = `${id}-${Date.now()}`;

    const beast = await prisma.beastPreset.create({ data: { id, ...data } });

    return res.status(201).json({ beast });
  } catch (error) {
    console.error("Error en POST /admin/beasts:", error);
    return res.status(500).json({ message: "Error interno al crear la bestia." });
  }
});

adminRouter.put("/beasts/:beastId", async (req, res) => {
  try {
    const beastId = String(req.params.beastId);

    const existing = await prisma.beastPreset.findUnique({ where: { id: beastId } });
    if (!existing) {
      return res.status(404).json({ message: "Bestia no encontrada." });
    }

    const beast = await prisma.beastPreset.update({
      where: { id: beastId },
      data: beastDataFromBody(req, existing as unknown as { [key: string]: unknown }),
    });

    return res.json({ beast });
  } catch (error) {
    console.error("Error en PUT /admin/beasts/:beastId:", error);
    return res.status(500).json({ message: "Error interno al actualizar la bestia." });
  }
});

adminRouter.delete("/beasts/:beastId", async (req, res) => {
  try {
    const beastId = String(req.params.beastId);

    const existing = await prisma.beastPreset.findUnique({ where: { id: beastId } });
    if (!existing) {
      return res.status(404).json({ message: "Bestia no encontrada." });
    }

    await prisma.beastPreset.delete({ where: { id: beastId } });

    return res.json({ ok: true, message: "Bestia eliminada." });
  } catch (error) {
    console.error("Error en DELETE /admin/beasts/:beastId:", error);
    return res.status(500).json({ message: "Error interno al eliminar la bestia." });
  }
});

adminRouter.post("/beasts/:beastId/image", uploadBeastImage.single("image"), async (req, res) => {
  try {
    const beastId = String(req.params.beastId);

    const existing = await prisma.beastPreset.findUnique({ where: { id: beastId } });
    if (!existing) {
      return res.status(404).json({ message: "Bestia no encontrada." });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Debes subir una imagen." });
    }

    let imagePath: string;
    try {
      imagePath = await uploadImageToSupabase("beasts", req.file);
    } catch (uploadError) {
      console.error("Error subiendo token a Supabase:", uploadError);
      return res.status(500).json({
        message: uploadError instanceof Error ? uploadError.message : "No se pudo subir el token.",
      });
    }

    const beast = await prisma.beastPreset.update({
      where: { id: beastId },
      data: { tokenImagePath: imagePath },
    });

    return res.json({ beast, imagePath, message: "Token actualizado." });
  } catch (error) {
    console.error("Error en POST /admin/beasts/:beastId/image:", error);
    return res.status(500).json({
      message: error instanceof Error ? error.message : "Error interno al subir el token.",
    });
  }
});

// ─── Administración de monstruos — catálogo global de combate (MonsterCatalogPreset) ──
// Reutiliza el mismo multer de bestias (memoria + límite 5MB + tipos de imagen permitidos).

function monsterDataFromBody(req: import("express").Request, existing?: { [key: string]: unknown }) {
  const pick = (key: string, fallback: unknown) => (req.body[key] !== undefined ? req.body[key] : (existing ? existing[key] : fallback));

  return {
    name: String(pick("name", "")).trim(),
    nameEn: pick("nameEn", null) ? String(pick("nameEn", "")).trim() : null,
    cr: Number(pick("cr", 0)),
    crLabel: String(pick("crLabel", "0")).trim(),
    ac: Number(pick("ac", 10)),
    hp: Number(pick("hp", 1)),
    hitDice: String(pick("hitDice", "")).trim(),
    speedWalk: Number(pick("speedWalk", 0)),
    speedFly: Number(pick("speedFly", 0)),
    speedSwim: Number(pick("speedSwim", 0)),
    speedClimb: Number(pick("speedClimb", 0)),
    speedBurrow: Number(pick("speedBurrow", 0)),
    size: String(pick("size", "Mediano")).trim(),
    strength: Number(pick("strength", 10)),
    dexterity: Number(pick("dexterity", 10)),
    constitution: Number(pick("constitution", 10)),
    attacks: Array.isArray(pick("attacks", [])) ? pick("attacks", []) : [],
    traits: String(pick("traits", "")).trim(),
    vulnerabilities: pick("vulnerabilities", null) ? String(pick("vulnerabilities", "")).trim() : null,
    resistances: pick("resistances", null) ? String(pick("resistances", "")).trim() : null,
    immunities: pick("immunities", null) ? String(pick("immunities", "")).trim() : null,
    conditionImmunities: pick("conditionImmunities", null) ? String(pick("conditionImmunities", "")).trim() : null,
    multiattack: Boolean(pick("multiattack", false)),
    source: String(pick("source", "Personalizada")).trim(),
  };
}

adminRouter.get("/monsters", async (_req, res) => {
  try {
    const monsters = await prisma.monsterCatalogPreset.findMany({
      orderBy: [{ cr: "asc" }, { name: "asc" }],
    });

    return res.json({ monsters });
  } catch (error) {
    console.error("Error en GET /admin/monsters:", error);
    return res.status(500).json({ message: "Error interno al cargar monstruos." });
  }
});

adminRouter.post("/monsters", async (req, res) => {
  try {
    const data = monsterDataFromBody(req);

    if (!data.name || !data.hitDice) {
      return res.status(400).json({ message: "Nombre y dado de golpe son obligatorios." });
    }

    let id = slugify(data.name);
    const existing = await prisma.monsterCatalogPreset.findUnique({ where: { id } });
    if (existing) id = `${id}-${Date.now()}`;

    const monster = await prisma.monsterCatalogPreset.create({ data: { id, ...data } });

    return res.status(201).json({ monster });
  } catch (error) {
    console.error("Error en POST /admin/monsters:", error);
    return res.status(500).json({ message: "Error interno al crear el monstruo." });
  }
});

adminRouter.put("/monsters/:monsterId", async (req, res) => {
  try {
    const monsterId = String(req.params.monsterId);

    const existing = await prisma.monsterCatalogPreset.findUnique({ where: { id: monsterId } });
    if (!existing) {
      return res.status(404).json({ message: "Monstruo no encontrado." });
    }

    const monster = await prisma.monsterCatalogPreset.update({
      where: { id: monsterId },
      data: monsterDataFromBody(req, existing as unknown as { [key: string]: unknown }),
    });

    return res.json({ monster });
  } catch (error) {
    console.error("Error en PUT /admin/monsters/:monsterId:", error);
    return res.status(500).json({ message: "Error interno al actualizar el monstruo." });
  }
});

adminRouter.delete("/monsters/:monsterId", async (req, res) => {
  try {
    const monsterId = String(req.params.monsterId);

    const existing = await prisma.monsterCatalogPreset.findUnique({ where: { id: monsterId } });
    if (!existing) {
      return res.status(404).json({ message: "Monstruo no encontrado." });
    }

    await prisma.monsterCatalogPreset.delete({ where: { id: monsterId } });

    return res.json({ ok: true, message: "Monstruo eliminado." });
  } catch (error) {
    console.error("Error en DELETE /admin/monsters/:monsterId:", error);
    return res.status(500).json({ message: "Error interno al eliminar el monstruo." });
  }
});

adminRouter.post("/monsters/:monsterId/image", uploadBeastImage.single("image"), async (req, res) => {
  try {
    const monsterId = String(req.params.monsterId);

    const existing = await prisma.monsterCatalogPreset.findUnique({ where: { id: monsterId } });
    if (!existing) {
      return res.status(404).json({ message: "Monstruo no encontrado." });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Debes subir una imagen." });
    }

    let imagePath: string;
    try {
      imagePath = await uploadImageToSupabase("monsters", req.file);
    } catch (uploadError) {
      console.error("Error subiendo token a Supabase:", uploadError);
      return res.status(500).json({
        message: uploadError instanceof Error ? uploadError.message : "No se pudo subir el token.",
      });
    }

    const monster = await prisma.monsterCatalogPreset.update({
      where: { id: monsterId },
      data: { tokenImagePath: imagePath },
    });

    return res.json({ monster, imagePath, message: "Token actualizado." });
  } catch (error) {
    console.error("Error en POST /admin/monsters/:monsterId/image:", error);
    return res.status(500).json({
      message: error instanceof Error ? error.message : "Error interno al subir el token.",
    });
  }
});