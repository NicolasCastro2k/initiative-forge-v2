import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { getAuthUser } from "../lib/getAuthUser.js";

export const presetsRouter = Router();

// ─── GET /presets/classes ─────────────────────────────────────────────────────

presetsRouter.get("/presets/classes", async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ message: "Debes iniciar sesión." });

    const classes = await prisma.classPreset.findMany({
      orderBy: { name: "asc" },
      include: {
        features: { orderBy: [{ level: "asc" }, { name: "asc" }] },
        subclasses: {
          orderBy: { name: "asc" },
          include: {
            features: { orderBy: [{ level: "asc" }, { name: "asc" }] },
          },
        },
      },
    });

    return res.json({ classes });
  } catch (error) {
    console.error("Error en GET /presets/classes:", error);
    return res.status(500).json({ message: "Error interno al cargar clases." });
  }
});

// ─── GET /presets/classes/:classId ───────────────────────────────────────────

presetsRouter.get("/presets/classes/:classId", async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ message: "Debes iniciar sesión." });

    const classPreset = await prisma.classPreset.findUnique({
      where: { id: String(req.params.classId) },
      include: {
        features: { orderBy: [{ level: "asc" }, { name: "asc" }] },
        subclasses: {
          orderBy: { name: "asc" },
          include: {
            features: { orderBy: [{ level: "asc" }, { name: "asc" }] },
          },
        },
      },
    });

    if (!classPreset) return res.status(404).json({ message: "Clase no encontrada." });

    return res.json({ classPreset });
  } catch (error) {
    console.error("Error en GET /presets/classes/:classId:", error);
    return res.status(500).json({ message: "Error interno al cargar clase." });
  }
});

// ─── GET /presets/races ───────────────────────────────────────────────────────
// Lee de la tabla RacePreset en la base de datos.

presetsRouter.get("/presets/races", async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ message: "Debes iniciar sesión." });

    const races = await prisma.racePreset.findMany({
      orderBy: { name: "asc" },
    });

    return res.json({ races });
  } catch (error) {
    console.error("Error en GET /presets/races:", error);
    return res.status(500).json({ message: "Error interno al cargar razas." });
  }
});

// ─── GET /presets/races/:raceId ──────────────────────────────────────────────

presetsRouter.get("/presets/races/:raceId", async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ message: "Debes iniciar sesión." });

    const race = await prisma.racePreset.findUnique({
      where: { id: String(req.params.raceId) },
    });

    if (!race) return res.status(404).json({ message: "Raza no encontrada." });

    return res.json({ race });
  } catch (error) {
    console.error("Error en GET /presets/races/:raceId:", error);
    return res.status(500).json({ message: "Error interno al cargar raza." });
  }
});

// ─── GET /presets/backgrounds ────────────────────────────────────────────────
// Lee de la tabla BackgroundPreset en la base de datos.

presetsRouter.get("/presets/backgrounds", async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ message: "Debes iniciar sesión." });

    const backgrounds = await prisma.backgroundPreset.findMany({
      orderBy: { name: "asc" },
    });

    return res.json({ backgrounds });
  } catch (error) {
    console.error("Error en GET /presets/backgrounds:", error);
    return res.status(500).json({ message: "Error interno al cargar trasfondos." });
  }
});

// ─── GET /presets/backgrounds/:backgroundId ──────────────────────────────────

presetsRouter.get("/presets/backgrounds/:backgroundId", async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ message: "Debes iniciar sesión." });

    const background = await prisma.backgroundPreset.findUnique({
      where: { id: String(req.params.backgroundId) },
    });

    if (!background) return res.status(404).json({ message: "Trasfondo no encontrado." });

    return res.json({ background });
  } catch (error) {
    console.error("Error en GET /presets/backgrounds/:backgroundId:", error);
    return res.status(500).json({ message: "Error interno al cargar trasfondo." });
  }
});

// ─── GET /presets/weapons ─────────────────────────────────────────────────────
// Lee de la tabla WeaponPreset en la base de datos.

presetsRouter.get("/presets/weapons", async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ message: "Debes iniciar sesión." });

    const weapons = await prisma.weaponPreset.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    return res.json({ weapons });
  } catch (error) {
    console.error("Error en GET /presets/weapons:", error);
    return res.status(500).json({ message: "Error interno al cargar armas." });
  }
});

// ─── GET /presets/weapons/:weaponId ──────────────────────────────────────────

presetsRouter.get("/presets/weapons/:weaponId", async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ message: "Debes iniciar sesión." });

    const weapon = await prisma.weaponPreset.findUnique({
      where: { id: String(req.params.weaponId) },
    });

    if (!weapon) return res.status(404).json({ message: "Arma no encontrada." });

    return res.json({ weapon });
  } catch (error) {
    console.error("Error en GET /presets/weapons/:weaponId:", error);
    return res.status(500).json({ message: "Error interno al cargar arma." });
  }
});

// ─── GET /presets/spells ──────────────────────────────────────────────────────
// Lee de la tabla SpellPreset en la base de datos.

presetsRouter.get("/presets/spells", async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ message: "Debes iniciar sesión." });

    const spells = await prisma.spellPreset.findMany({
      orderBy: [{ level: "asc" }, { name: "asc" }],
    });

    return res.json({ spells });
  } catch (error) {
    console.error("Error en GET /presets/spells:", error);
    return res.status(500).json({ message: "Error interno al cargar hechizos." });
  }
});

// ─── GET /presets/spells/:spellId ────────────────────────────────────────────

presetsRouter.get("/presets/spells/:spellId", async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ message: "Debes iniciar sesión." });

    const spell = await prisma.spellPreset.findUnique({
      where: { id: String(req.params.spellId) },
    });

    if (!spell) return res.status(404).json({ message: "Hechizo no encontrado." });

    return res.json({ spell });
  } catch (error) {
    console.error("Error en GET /presets/spells/:spellId:", error);
    return res.status(500).json({ message: "Error interno al cargar hechizo." });
  }
});

// ─── GET /presets/beasts ──────────────────────────────────────────────────────
// Lee de la tabla BeastPreset en la base de datos. Catálogo de bestias para
// la habilidad Forma Salvaje del druida. El filtrado por nivel/subclase
// (minDruidLevel / minMoonDruidLevel) se hace en el frontend.

presetsRouter.get("/presets/beasts", async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ message: "Debes iniciar sesión." });

    const beasts = await prisma.beastPreset.findMany({
      orderBy: [{ cr: "asc" }, { name: "asc" }],
    });

    return res.json({ beasts });
  } catch (error) {
    console.error("Error en GET /presets/beasts:", error);
    return res.status(500).json({ message: "Error interno al cargar bestias." });
  }
});

// ─── GET /presets/monster-catalog ──────────────────────────────────────────────
// Lee de la tabla MonsterCatalogPreset. Catálogo global de monstruos, reusable
// entre partidas, que la Pantalla del DM usa para importar una copia (con
// token) al bestiario (MonsterPreset) de una partida puntual.

presetsRouter.get("/presets/monster-catalog", async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ message: "Debes iniciar sesión." });

    const monsters = await prisma.monsterCatalogPreset.findMany({
      orderBy: [{ cr: "asc" }, { name: "asc" }],
    });

    return res.json({ monsters });
  } catch (error) {
    console.error("Error en GET /presets/monster-catalog:", error);
    return res.status(500).json({ message: "Error interno al cargar el catálogo de monstruos." });
  }
});