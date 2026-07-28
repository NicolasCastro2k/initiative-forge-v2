// backend/src/routes/player.routes.ts
//
// Rutas de apoyo para la Pantalla de Jugador:
//   GET  /games/:gameId/journal        — leer el diario de viaje del jugador actual
//   PUT  /games/:gameId/journal        — guardar el diario de viaje
//   GET  /games/:gameId/dice/log       — últimas tiradas de dados de la partida
//   POST /games/:gameId/dice/roll      — tirar dados (se comparte con todos por socket)

import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { getAuthUser } from "../lib/getAuthUser.js";
import { emitToGame } from "../lib/socket.js";

export const playerRouter = Router();

async function requireMembership(gameId: string, userId: string) {
  return prisma.gameMember.findUnique({
    where: { gameId_userId: { gameId, userId } },
  });
}

// ─── GET /games/:gameId/journal ────────────────────────────────────────────────

playerRouter.get("/games/:gameId/journal", async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ message: "Debes iniciar sesión." });

    const gameId = String(req.params.gameId);
    const membership = await requireMembership(gameId, user.id);
    if (!membership) return res.status(404).json({ message: "Partida no encontrada o no tienes acceso." });

    const selection = await prisma.gameCharacter.findFirst({
      where: { gameId, userId: user.id, isActive: true },
    });

    if (!selection) {
      return res.json({ journal: "", hasCharacter: false });
    }

    return res.json({ journal: selection.journal, hasCharacter: true });
  } catch (error) {
    console.error("Error en GET /games/:gameId/journal:", error);
    return res.status(500).json({ message: "Error interno al cargar el diario." });
  }
});

// ─── PUT /games/:gameId/journal ────────────────────────────────────────────────

playerRouter.put("/games/:gameId/journal", async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ message: "Debes iniciar sesión." });

    const gameId = String(req.params.gameId);
    const membership = await requireMembership(gameId, user.id);
    if (!membership) return res.status(404).json({ message: "Partida no encontrada o no tienes acceso." });

    const selection = await prisma.gameCharacter.findFirst({
      where: { gameId, userId: user.id, isActive: true },
    });

    if (!selection) {
      return res.status(400).json({ message: "No tienes un personaje activo en esta partida." });
    }

    const journal = String(req.body.journal ?? "");

    const updated = await prisma.gameCharacter.update({
      where: { id: selection.id },
      data: { journal },
    });

    return res.json({ journal: updated.journal });
  } catch (error) {
    console.error("Error en PUT /games/:gameId/journal:", error);
    return res.status(500).json({ message: "Error interno al guardar el diario." });
  }
});

// ─── GET /games/:gameId/dice/log ───────────────────────────────────────────────

playerRouter.get("/games/:gameId/dice/log", async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ message: "Debes iniciar sesión." });

    const gameId = String(req.params.gameId);
    const membership = await requireMembership(gameId, user.id);
    if (!membership) return res.status(404).json({ message: "Partida no encontrada o no tienes acceso." });

    const rolls = await prisma.diceRoll.findMany({
      where: { gameId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return res.json({ rolls });
  } catch (error) {
    console.error("Error en GET /games/:gameId/dice/log:", error);
    return res.status(500).json({ message: "Error interno al cargar el registro de dados." });
  }
});

// ─── POST /games/:gameId/dice/roll ─────────────────────────────────────────────
// Body: { sides: 4|6|8|10|12|20|100, count: number, modifier?: number, characterName?: string, label?: string }
// `label` es opcional y viene de la Pantalla de Jugador cuando la tirada se
// origina en una característica/habilidad/salvación/ataque de la ficha
// (p.ej. "Percepción", "Salvación de Destreza", "Ataque: Espada larga").
// Solo se usa para mostrar de dónde salió el modificador; no afecta el cálculo.

const ALLOWED_SIDES = [4, 6, 8, 10, 12, 20, 100];

playerRouter.post("/games/:gameId/dice/roll", async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ message: "Debes iniciar sesión." });

    const gameId = String(req.params.gameId);
    const membership = await requireMembership(gameId, user.id);
    if (!membership) return res.status(404).json({ message: "Partida no encontrada o no tienes acceso." });

    const sides = Number(req.body.sides);
    const count = Math.min(Math.max(Number(req.body.count) || 1, 1), 20);
    const modifier = Number(req.body.modifier) || 0;

    if (!ALLOWED_SIDES.includes(sides)) {
      return res.status(400).json({ message: "Tipo de dado inválido." });
    }

    const rolls: number[] = [];
    for (let i = 0; i < count; i++) {
      rolls.push(Math.floor(Math.random() * sides) + 1);
    }

    const total = rolls.reduce((sum, r) => sum + r, 0) + modifier;
    const modText = modifier !== 0 ? (modifier > 0 ? `+${modifier}` : `${modifier}`) : "";
    const label = req.body.label ? String(req.body.label).slice(0, 60) : "";
    const expression = `${label ? `${label} · ` : ""}${count}d${sides}${modText}`;

    const characterName = req.body.characterName ? String(req.body.characterName) : user.name;

    const diceRoll = await prisma.diceRoll.create({
      data: {
        gameId,
        userId: user.id,
        characterName,
        expression,
        rolls,
        modifier,
        total,
      },
    });

    // Notificar a todos en la sala (jugadores y DM) en tiempo real
    emitToGame(gameId, "dice:rolled", { roll: diceRoll });

    return res.status(201).json({ roll: diceRoll });
  } catch (error) {
    console.error("Error en POST /games/:gameId/dice/roll:", error);
    return res.status(500).json({ message: "Error interno al tirar los dados." });
  }
});