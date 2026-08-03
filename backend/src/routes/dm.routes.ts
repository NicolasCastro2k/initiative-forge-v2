// backend/src/routes/dm.routes.ts
//
// Rutas exclusivas del DM para la Pantalla de DM:
//   GET/PUT  /games/:gameId/dm/notes
//   GET/POST/PUT/DELETE /games/:gameId/npcs
//   GET/POST/PUT/DELETE /games/:gameId/monsters
//   POST /games/:gameId/party/level-up   { level }
//   POST /games/:gameId/party/rest       { type: "short" | "long" }
//
// NOTA sobre descansos: por simplicidad, tanto el descanso corto como el
// largo restauran PG completos y todos los espacios de conjuro gastados de
// todos los jugadores activos de la partida. Esto es una simplificación
// respecto a la regla real de 5e (donde el descanso corto normalmente no
// restaura PG automáticamente y solo ciertas clases recuperan espacios en
// descanso corto) — se implementó así porque fue lo pedido explícitamente.

import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { getAuthUser } from "../lib/getAuthUser.js";
import { emitToGame } from "../lib/socket.js";

export const dmRouter = Router();

async function requireDm(gameId: string, userId: string) {
  const membership = await prisma.gameMember.findUnique({
    where: { gameId_userId: { gameId, userId } },
  });
  if (!membership || membership.role !== "DM") return null;
  return membership;
}

// ─── Notas del DM ───────────────────────────────────────────────────────────

dmRouter.get("/games/:gameId/dm/notes", async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ message: "Debes iniciar sesión." });

    const gameId = String(req.params.gameId);
    const membership = await requireDm(gameId, user.id);
    if (!membership) return res.status(403).json({ message: "Solo el DM puede ver estas notas." });

    const game = await prisma.game.findUnique({ where: { id: gameId } });
    if (!game) return res.status(404).json({ message: "Partida no encontrada." });

    return res.json({ notes: game.dmNotes });
  } catch (error) {
    console.error("Error en GET /games/:gameId/dm/notes:", error);
    return res.status(500).json({ message: "Error interno al cargar las notas." });
  }
});

dmRouter.put("/games/:gameId/dm/notes", async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ message: "Debes iniciar sesión." });

    const gameId = String(req.params.gameId);
    const membership = await requireDm(gameId, user.id);
    if (!membership) return res.status(403).json({ message: "Solo el DM puede editar estas notas." });

    const notes = String(req.body.notes ?? "");
    const game = await prisma.game.update({ where: { id: gameId }, data: { dmNotes: notes } });

    return res.json({ notes: game.dmNotes });
  } catch (error) {
    console.error("Error en PUT /games/:gameId/dm/notes:", error);
    return res.status(500).json({ message: "Error interno al guardar las notas." });
  }
});

// ─── Biblioteca de NPCs ─────────────────────────────────────────────────────

dmRouter.get("/games/:gameId/npcs", async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ message: "Debes iniciar sesión." });

    const gameId = String(req.params.gameId);
    const membership = await requireDm(gameId, user.id);
    if (!membership) return res.status(403).json({ message: "Solo el DM puede ver esta lista." });

    const npcs = await prisma.npcPreset.findMany({ where: { gameId }, orderBy: { name: "asc" } });
    return res.json({ npcs });
  } catch (error) {
    console.error("Error en GET /games/:gameId/npcs:", error);
    return res.status(500).json({ message: "Error interno al cargar los NPCs." });
  }
});

dmRouter.post("/games/:gameId/npcs", async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ message: "Debes iniciar sesión." });

    const gameId = String(req.params.gameId);
    const membership = await requireDm(gameId, user.id);
    if (!membership) return res.status(403).json({ message: "Solo el DM puede crear NPCs." });

    const name = String(req.body.name ?? "").trim();
    if (!name) return res.status(400).json({ message: "El nombre es obligatorio." });

    const npc = await prisma.npcPreset.create({
      data: {
        gameId,
        name,
        description: String(req.body.description ?? ""),
        notes: String(req.body.notes ?? ""),
        hp: req.body.hp !== undefined && req.body.hp !== "" ? Number(req.body.hp) : null,
        maxHp: req.body.maxHp !== undefined && req.body.maxHp !== "" ? Number(req.body.maxHp) : null,
        ac: req.body.ac !== undefined && req.body.ac !== "" ? Number(req.body.ac) : null,
      },
    });

    return res.status(201).json({ npc });
  } catch (error) {
    console.error("Error en POST /games/:gameId/npcs:", error);
    return res.status(500).json({ message: "Error interno al crear el NPC." });
  }
});

dmRouter.put("/games/:gameId/npcs/:npcId", async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ message: "Debes iniciar sesión." });

    const gameId = String(req.params.gameId);
    const membership = await requireDm(gameId, user.id);
    if (!membership) return res.status(403).json({ message: "Solo el DM puede editar NPCs." });

    const npcId = String(req.params.npcId);
    const existing = await prisma.npcPreset.findFirst({ where: { id: npcId, gameId } });
    if (!existing) return res.status(404).json({ message: "NPC no encontrado." });

    const npc = await prisma.npcPreset.update({
      where: { id: npcId },
      data: {
        name: req.body.name !== undefined ? String(req.body.name).trim() : existing.name,
        description: req.body.description !== undefined ? String(req.body.description) : existing.description,
        notes: req.body.notes !== undefined ? String(req.body.notes) : existing.notes,
        hp: req.body.hp !== undefined ? (req.body.hp === "" ? null : Number(req.body.hp)) : existing.hp,
        maxHp: req.body.maxHp !== undefined ? (req.body.maxHp === "" ? null : Number(req.body.maxHp)) : existing.maxHp,
        ac: req.body.ac !== undefined ? (req.body.ac === "" ? null : Number(req.body.ac)) : existing.ac,
      },
    });

    return res.json({ npc });
  } catch (error) {
    console.error("Error en PUT /games/:gameId/npcs/:npcId:", error);
    return res.status(500).json({ message: "Error interno al actualizar el NPC." });
  }
});

dmRouter.delete("/games/:gameId/npcs/:npcId", async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ message: "Debes iniciar sesión." });

    const gameId = String(req.params.gameId);
    const membership = await requireDm(gameId, user.id);
    if (!membership) return res.status(403).json({ message: "Solo el DM puede eliminar NPCs." });

    const npcId = String(req.params.npcId);
    const existing = await prisma.npcPreset.findFirst({ where: { id: npcId, gameId } });
    if (!existing) return res.status(404).json({ message: "NPC no encontrado." });

    await prisma.npcPreset.delete({ where: { id: npcId } });
    return res.json({ ok: true, message: "NPC eliminado." });
  } catch (error) {
    console.error("Error en DELETE /games/:gameId/npcs/:npcId:", error);
    return res.status(500).json({ message: "Error interno al eliminar el NPC." });
  }
});

// ─── Biblioteca de monstruos ─────────────────────────────────────────────────

dmRouter.get("/games/:gameId/monsters", async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ message: "Debes iniciar sesión." });

    const gameId = String(req.params.gameId);
    const membership = await requireDm(gameId, user.id);
    if (!membership) return res.status(403).json({ message: "Solo el DM puede ver esta lista." });

    const monsters = await prisma.monsterPreset.findMany({ where: { gameId }, orderBy: { name: "asc" } });
    return res.json({ monsters });
  } catch (error) {
    console.error("Error en GET /games/:gameId/monsters:", error);
    return res.status(500).json({ message: "Error interno al cargar los monstruos." });
  }
});

dmRouter.post("/games/:gameId/monsters", async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ message: "Debes iniciar sesión." });

    const gameId = String(req.params.gameId);
    const membership = await requireDm(gameId, user.id);
    if (!membership) return res.status(403).json({ message: "Solo el DM puede crear monstruos." });

    const name = String(req.body.name ?? "").trim();
    if (!name) return res.status(400).json({ message: "El nombre es obligatorio." });

    const monster = await prisma.monsterPreset.create({
      data: {
        gameId,
        name,
        description: String(req.body.description ?? ""),
        notes: String(req.body.notes ?? ""),
        hp: req.body.hp !== undefined && req.body.hp !== "" ? Number(req.body.hp) : null,
        maxHp: req.body.maxHp !== undefined && req.body.maxHp !== "" ? Number(req.body.maxHp) : null,
        ac: req.body.ac !== undefined && req.body.ac !== "" ? Number(req.body.ac) : null,
        speed: req.body.speed !== undefined && req.body.speed !== "" ? Number(req.body.speed) : null,
        damageDice: req.body.damageDice ? String(req.body.damageDice) : null,
        damageType: req.body.damageType ? String(req.body.damageType) : null,
        tokenImagePath: req.body.tokenImagePath ? String(req.body.tokenImagePath) : null,
        source: req.body.source ? String(req.body.source) : "Personalizado",
      },
    });

    return res.status(201).json({ monster });
  } catch (error) {
    console.error("Error en POST /games/:gameId/monsters:", error);
    return res.status(500).json({ message: "Error interno al crear el monstruo." });
  }
});

dmRouter.put("/games/:gameId/monsters/:monsterId", async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ message: "Debes iniciar sesión." });

    const gameId = String(req.params.gameId);
    const membership = await requireDm(gameId, user.id);
    if (!membership) return res.status(403).json({ message: "Solo el DM puede editar monstruos." });

    const monsterId = String(req.params.monsterId);
    const existing = await prisma.monsterPreset.findFirst({ where: { id: monsterId, gameId } });
    if (!existing) return res.status(404).json({ message: "Monstruo no encontrado." });

    const monster = await prisma.monsterPreset.update({
      where: { id: monsterId },
      data: {
        name: req.body.name !== undefined ? String(req.body.name).trim() : existing.name,
        description: req.body.description !== undefined ? String(req.body.description) : existing.description,
        notes: req.body.notes !== undefined ? String(req.body.notes) : existing.notes,
        hp: req.body.hp !== undefined ? (req.body.hp === "" ? null : Number(req.body.hp)) : existing.hp,
        maxHp: req.body.maxHp !== undefined ? (req.body.maxHp === "" ? null : Number(req.body.maxHp)) : existing.maxHp,
        ac: req.body.ac !== undefined ? (req.body.ac === "" ? null : Number(req.body.ac)) : existing.ac,
        speed: req.body.speed !== undefined ? (req.body.speed === "" ? null : Number(req.body.speed)) : existing.speed,
        damageDice: req.body.damageDice !== undefined ? (req.body.damageDice || null) : existing.damageDice,
        damageType: req.body.damageType !== undefined ? (req.body.damageType || null) : existing.damageType,
        tokenImagePath: req.body.tokenImagePath !== undefined ? (req.body.tokenImagePath || null) : existing.tokenImagePath,
        source: req.body.source !== undefined ? String(req.body.source) : existing.source,
      },
    });

    return res.json({ monster });
  } catch (error) {
    console.error("Error en PUT /games/:gameId/monsters/:monsterId:", error);
    return res.status(500).json({ message: "Error interno al actualizar el monstruo." });
  }
});

dmRouter.delete("/games/:gameId/monsters/:monsterId", async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ message: "Debes iniciar sesión." });

    const gameId = String(req.params.gameId);
    const membership = await requireDm(gameId, user.id);
    if (!membership) return res.status(403).json({ message: "Solo el DM puede eliminar monstruos." });

    const monsterId = String(req.params.monsterId);
    const existing = await prisma.monsterPreset.findFirst({ where: { id: monsterId, gameId } });
    if (!existing) return res.status(404).json({ message: "Monstruo no encontrado." });

    await prisma.monsterPreset.delete({ where: { id: monsterId } });
    return res.json({ ok: true, message: "Monstruo eliminado." });
  } catch (error) {
    console.error("Error en DELETE /games/:gameId/monsters/:monsterId:", error);
    return res.status(500).json({ message: "Error interno al eliminar el monstruo." });
  }
});

// ─── Subir de nivel a todo el grupo ─────────────────────────────────────────
// Body: { level: number }

dmRouter.post("/games/:gameId/party/level-up", async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ message: "Debes iniciar sesión." });

    const gameId = String(req.params.gameId);
    const membership = await requireDm(gameId, user.id);
    if (!membership) return res.status(403).json({ message: "Solo el DM puede subir de nivel al grupo." });

    const newLevel = Math.max(1, Math.min(20, Number(req.body.level) || 1));

    const selections = await prisma.gameCharacter.findMany({
      where: { gameId, isActive: true },
      include: { character: true },
    });

    const updatedNames: string[] = [];

    for (const selection of selections) {
      const character = selection.character;
      const sheet = (character.sheetData ?? {}) as Record<string, unknown>;
      const identity = (sheet.identity ?? {}) as Record<string, unknown>;
      const combat = (sheet.combat ?? {}) as Record<string, unknown>;
      const abilities = (sheet.abilities ?? {}) as Record<string, unknown>;
      const proficiencies = (sheet.proficiencies ?? {}) as Record<string, unknown>;

      // Buscar dado de golpe real desde el ClassPreset si hay clase asignada
      let hitDie = 8;
      if (character.classId) {
        const classPreset = await prisma.classPreset.findUnique({ where: { id: character.classId } });
        if (classPreset) hitDie = classPreset.hitDie;
      }

      const conScore = Number(abilities.constitution ?? 10);
      const conMod = Math.floor((conScore - 10) / 2);
      const averagePerLevel = Math.floor(hitDie / 2) + 1;
      const maxHp = Math.max(1, hitDie + conMod + (newLevel - 1) * (averagePerLevel + conMod));
      const proficiencyBonus = Math.ceil(newLevel / 4) + 1;

      const newSheetData = {
        ...sheet,
        identity: { ...identity, level: newLevel },
        combat: {
          ...combat,
          maxHp,
          currentHp: maxHp,
          hitDiceTotal: `${newLevel}d${hitDie}`,
          hitDiceCurrent: `${newLevel}d${hitDie}`,
        },
        proficiencies: { ...proficiencies, proficiencyBonus },
      };

      await prisma.character.update({
        where: { id: character.id },
        data: { level: newLevel, sheetData: newSheetData },
      });

      updatedNames.push(character.name);
    }

    emitToGame(gameId, "party:leveledUp", { level: newLevel, characterNames: updatedNames });

    return res.json({
      ok: true,
      level: newLevel,
      updated: updatedNames.length,
      message: `Grupo subido a nivel ${newLevel} (${updatedNames.length} personaje(s)).`,
    });
  } catch (error) {
    console.error("Error en POST /games/:gameId/party/level-up:", error);
    return res.status(500).json({ message: "Error interno al subir de nivel." });
  }
});

// ─── Descanso corto / largo ─────────────────────────────────────────────────
// Body: { type: "short" | "long" }
//
// Descanso largo: restaura PG completos y todos los espacios de conjuro.
// Descanso corto: recupera la mitad de los PG máximos (redondeado hacia
// abajo, sin superar el máximo) y restaura la mitad (redondeado hacia abajo)
// de los espacios de conjuro gastados en cada nivel.

dmRouter.post("/games/:gameId/party/rest", async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ message: "Debes iniciar sesión." });

    const gameId = String(req.params.gameId);
    const membership = await requireDm(gameId, user.id);
    if (!membership) return res.status(403).json({ message: "Solo el DM puede ordenar un descanso." });

    const restType = req.body.type === "long" ? "long" : "short";

    const selections = await prisma.gameCharacter.findMany({
      where: { gameId, isActive: true },
      include: { character: true },
    });

    const updatedNames: string[] = [];

    for (const selection of selections) {
      const character = selection.character;
      const sheet = (character.sheetData ?? {}) as Record<string, unknown>;
      const combat = (sheet.combat ?? {}) as Record<string, unknown>;
      const spells = (sheet.spells ?? {}) as Record<string, unknown>;
      const slots = (spells.slots ?? {}) as Record<string, { total: number; expended: number }>;

      const maxHp = Number(combat.maxHp ?? 0);
      const currentHp = Number(combat.currentHp ?? 0);

      let newHp: number;
      const restoredSlots: Record<string, { total: number; expended: number }> = {};

      if (restType === "long") {
        // Descanso largo: restaura PG completos y todos los espacios de conjuro.
        newHp = maxHp;
        Object.entries(slots).forEach(([level, slot]) => {
          restoredSlots[level] = { total: slot.total, expended: 0 };
        });
      } else {
        // Descanso corto: recupera la mitad de los PG máximos (sin superar el
        // máximo), y restaura la mitad (redondeado hacia abajo) de los
        // espacios de conjuro gastados en cada nivel.
        const halfMaxHp = Math.floor(maxHp / 2);
        newHp = Math.min(maxHp, currentHp + halfMaxHp);

        Object.entries(slots).forEach(([level, slot]) => {
          const recovered = Math.floor(slot.expended / 2);
          const newExpended = Math.max(0, slot.expended - recovered);
          restoredSlots[level] = { total: slot.total, expended: newExpended };
        });
      }

      const newSheetData = {
        ...sheet,
        combat: { ...combat, currentHp: newHp },
        spells: { ...spells, slots: restoredSlots },
      };

      await prisma.character.update({
        where: { id: character.id },
        data: { sheetData: newSheetData },
      });

      updatedNames.push(character.name);
    }

    emitToGame(gameId, "party:rested", { restType, characterNames: updatedNames });

    return res.json({
      ok: true,
      restType,
      updated: updatedNames.length,
      message: `Descanso ${restType === "long" ? "largo" : "corto"} aplicado a ${updatedNames.length} personaje(s).`,
    });
  } catch (error) {
    console.error("Error en POST /games/:gameId/party/rest:", error);
    return res.status(500).json({ message: "Error interno al aplicar el descanso." });
  }
});