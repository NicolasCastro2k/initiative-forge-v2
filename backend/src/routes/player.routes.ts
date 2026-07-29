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
// Body: { sides, count, modifier?, characterName?, label?, mode? }
// `label` es opcional y viene de la Pantalla de Jugador cuando la tirada se
// origina en una característica/habilidad/salvación/ataque de la ficha
// (p.ej. "Percepción", "Salvación de Destreza", "Ataque: Espada larga").
// Solo se usa para mostrar de dónde salió el modificador; no afecta el cálculo.
//
// `mode` puede ser "normal" | "advantage" | "disadvantage". Solo tiene efecto
// sobre d20 (regla de D&D 5e): se tiran dos juegos de dados completos y se
// conserva el de mayor suma (ventaja) o menor suma (desventaja); el modificador
// se aplica una sola vez, después de elegir. Como se compara antes de sumar el
// modificador, el resultado natural (1 o 20) del dado elegido nunca se ve
// alterado por él.

const ALLOWED_SIDES = [4, 6, 8, 10, 12, 20, 100];
const ALLOWED_MODES = ["normal", "advantage", "disadvantage"] as const;
type RollMode = (typeof ALLOWED_MODES)[number];

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
    const modeRaw = String(req.body.mode ?? "normal");
    const mode: RollMode = (ALLOWED_MODES as readonly string[]).includes(modeRaw) ? (modeRaw as RollMode) : "normal";

    if (!ALLOWED_SIDES.includes(sides)) {
      return res.status(400).json({ message: "Tipo de dado inválido." });
    }

    function rollSet(): number[] {
      const set: number[] = [];
      for (let i = 0; i < count; i++) set.push(Math.floor(Math.random() * sides) + 1);
      return set;
    }

    let rolls: number[];
    let discarded: number[] | null = null;

    if (mode !== "normal" && sides === 20) {
      const setA = rollSet();
      const setB = rollSet();
      const sumA = setA.reduce((s, r) => s + r, 0);
      const sumB = setB.reduce((s, r) => s + r, 0);
      const keepA = mode === "advantage" ? sumA >= sumB : sumA <= sumB;
      rolls = keepA ? setA : setB;
      discarded = keepA ? setB : setA;
    } else {
      rolls = rollSet();
    }

    const total = rolls.reduce((sum, r) => sum + r, 0) + modifier;
    const modText = modifier !== 0 ? (modifier > 0 ? `+${modifier}` : `${modifier}`) : "";
    const label = req.body.label ? String(req.body.label).slice(0, 60) : "";
    const modeText = mode === "advantage" ? " (ventaja)" : mode === "disadvantage" ? " (desventaja)" : "";
    const discardedText = discarded ? ` · descartado [${discarded.join(", ")}]` : "";
    const expression = `${label ? `${label} · ` : ""}${count}d${sides}${modText}${modeText}${discardedText}`;

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