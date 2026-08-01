// Va en: backend/src/routes/combat.routes.ts
import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { getAuthUser } from "../lib/getAuthUser.js";
import { emitToGame } from "../lib/socket.js";

export const combatRouter = Router();

const GAME_ROLE_DM = "DM";
const COMBATANT_TYPE_PLAYER = "PLAYER";
const COMBATANT_TYPE_ENEMY = "ENEMY";

type CharacterSheetData = {
  combat?: {
    armorClass?: number;
    initiative?: number;
    maxHp?: number;
    currentHp?: number;
    speed?: number;
  };
};

function asSheetData(value: unknown): CharacterSheetData {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as CharacterSheetData;
}

function toInt(value: unknown, fallback: number) {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue)) {
    return fallback;
  }
  return numberValue;
}

function numberOrFallback(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return value;
}

async function getMembership(gameId: string, userId: string) {
  return prisma.gameMember.findUnique({
    where: {
      gameId_userId: {
        gameId,
        userId,
      },
    },
  });
}

async function requireMembership(gameId: string, userId: string) {
  const membership = await getMembership(gameId, userId);
  if (!membership) {
    return null;
  }
  return membership;
}

async function requireDm(gameId: string, userId: string) {
  const membership = await getMembership(gameId, userId);
  if (!membership || membership.role !== GAME_ROLE_DM) {
    return null;
  }
  return membership;
}

async function findOrCreateEncounter(gameId: string) {
  const existingEncounter = await prisma.combatEncounter.findUnique({
    where: { gameId },
  });

  if (existingEncounter) {
    return existingEncounter;
  }

  return prisma.combatEncounter.create({
    data: {
      gameId,
      currentTurnIndex: 0,
      round: 1,
      isActive: true,
    },
  });
}

async function getEncounterPayload(gameId: string) {
  return prisma.combatEncounter.findUnique({
    where: { gameId },
    include: {
      combatants: {
        orderBy: [
          { initiative: "desc" },
          { createdAt: "asc" },
        ],
        include: {
          character: {
            include: {
              owner: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

function normalizeTurnIndex(currentTurnIndex: number, combatantCount: number) {
  if (combatantCount <= 0) return 0;
  if (currentTurnIndex < 0) return 0;
  if (currentTurnIndex >= combatantCount) return 0;
  return currentTurnIndex;
}

// ─── GET /games/:gameId/combat ────────────────────────────────────────────────
combatRouter.get("/games/:gameId/combat", async (req, res) => {
  try {
    const user = getAuthUser(req);

    if (!user) {
      return res.status(401).json({ message: "Debes iniciar sesión." });
    }

    const gameId = String(req.params.gameId);
    const membership = await requireMembership(gameId, user.id);

    if (!membership) {
      return res.status(404).json({
        message: "Partida no encontrada o no tienes acceso.",
      });
    }

    const encounter = await getEncounterPayload(gameId);

    return res.json({ encounter, role: membership.role });
  } catch (error) {
    console.error("Error en GET /games/:gameId/combat:", error);
    return res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : "Error interno al cargar combate.",
    });
  }
});

// ─── POST /games/:gameId/combat/prepare ──────────────────────────────────────
// Crea los combatientes sin posición (x:-1, y:-1) para que el DM los coloque.
combatRouter.post("/games/:gameId/combat/prepare", async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ message: "Debes iniciar sesión." });

    const gameId = String(req.params.gameId);
    const membership = await requireDm(gameId, user.id);
    if (!membership) return res.status(403).json({ message: "Solo el DM puede iniciar el combate." });

    const game = await prisma.game.findUnique({ where: { id: gameId } });
    if (!game) return res.status(404).json({ message: "Partida no encontrada." });

    const selections = await prisma.gameCharacter.findMany({
      where: { gameId, isActive: true },
      orderBy: { selectedAt: "asc" },
      include: { character: true },
    });

    // Crear o resetear el encuentro — aún no activo (isActive: false = modo colocación)
    const encounter = await prisma.combatEncounter.upsert({
      where: { gameId },
      update: { currentTurnIndex: 0, round: 1, isActive: false },
      create: { gameId, currentTurnIndex: 0, round: 1, isActive: false },
    });

    await prisma.combatant.deleteMany({ where: { encounterId: encounter.id } });

    for (const [index, selection] of selections.entries()) {
      const character = selection.character;
      const sheetData = asSheetData(character.sheetData);
      const combat = sheetData.combat ?? {};

      const maxHp = numberOrFallback(combat.maxHp, 10 + character.level);
      const currentHp = numberOrFallback(combat.currentHp, maxHp);
      const armorClass = numberOrFallback(combat.armorClass, 10);
      const initiative = numberOrFallback(combat.initiative, 10 + index);
      const speed = numberOrFallback(combat.speed ?? (sheetData as { speed?: number }).speed, 30);

      await prisma.combatant.create({
        data: {
          encounterId: encounter.id,
          type: COMBATANT_TYPE_PLAYER,
          characterId: character.id,
          ownerUserId: selection.userId,
          name: character.name,
          hp: currentHp,
          maxHp,
          ac: armorClass,
          x: -1,   // Sin colocar todavía
          y: -1,
          initiative,
          speed,
        },
      });
    }

    const updatedEncounter = await getEncounterPayload(gameId);

    // Notificar a todos que el DM está colocando fichas
    emitToGame(gameId, "combat:placement", { encounter: updatedEncounter });

    return res.status(201).json({
      encounter: updatedEncounter,
      message: "Modo colocación activo. Coloca las fichas en el tablero.",
    });
  } catch (error) {
    console.error("Error en POST /games/:gameId/combat/prepare:", error);
    return res.status(500).json({
      message: error instanceof Error ? error.message : "Error interno.",
    });
  }
});

// ─── POST /games/:gameId/combat/start ────────────────────────────────────────
// Confirma el inicio del combate una vez todas las fichas están colocadas.
combatRouter.post("/games/:gameId/combat/start", async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ message: "Debes iniciar sesión." });

    const gameId = String(req.params.gameId);
    const membership = await requireDm(gameId, user.id);
    if (!membership) return res.status(403).json({ message: "Solo el DM puede iniciar el combate." });

    const encounter = await getEncounterPayload(gameId);
    if (!encounter) return res.status(404).json({ message: "No hay encuentro preparado." });

    // Verificar que todos los jugadores están colocados
    const unplaced = encounter.combatants.filter((c) => c.x === -1 || c.y === -1);
    if (unplaced.length > 0) {
      return res.status(400).json({
        message: `Faltan por colocar: ${unplaced.map((c) => c.name).join(", ")}.`,
        unplaced: unplaced.map((c) => ({ id: c.id, name: c.name })),
      });
    }

    // Activar el encuentro
    await prisma.combatEncounter.update({
      where: { id: encounter.id },
      data: { isActive: true, currentTurnIndex: 0, round: 1 },
    });

    // Resetear recursos del primer combatiente
    const first = encounter.combatants[0];
    if (first) {
      await prisma.combatant.update({
        where: { id: first.id },
        data: { hasAction: true, hasBonusAction: true, hasReaction: true, isDashing: false, movementUsed: 0 },
      });
    }

    const updatedEncounter = await getEncounterPayload(gameId);
    emitToGame(gameId, "combat:started", { encounter: updatedEncounter });

    return res.status(201).json({
      encounter: updatedEncounter,
      message: "¡Combate iniciado!",
    });
  } catch (error) {
    console.error("Error en POST /games/:gameId/combat/start:", error);
    return res.status(500).json({
      message: error instanceof Error ? error.message : "Error interno al iniciar combate.",
    });
  }
});

// ─── POST /games/:gameId/combat/enemies ──────────────────────────────────────
combatRouter.post("/games/:gameId/combat/enemies", async (req, res) => {
  try {
    const user = getAuthUser(req);

    if (!user) {
      return res.status(401).json({ message: "Debes iniciar sesión." });
    }

    const gameId = String(req.params.gameId);
    const membership = await requireDm(gameId, user.id);

    if (!membership) {
      return res.status(403).json({
        message: "Solo el DM puede agregar enemigos.",
      });
    }

    const encounter = await findOrCreateEncounter(gameId);

    const name = String(req.body.name ?? "").trim();
    const hp = toInt(req.body.hp, 7);
    const maxHp = toInt(req.body.maxHp, hp);
    const ac = toInt(req.body.ac, 13);
    const initiative = toInt(req.body.initiative, 10);
    const x = toInt(req.body.x, 0);
    const y = toInt(req.body.y, 0);

    if (!name) {
      return res.status(400).json({ message: "El enemigo necesita un nombre." });
    }

    if (hp < 1 || maxHp < 1 || ac < 1) {
      return res.status(400).json({
        message: "HP, HP máximo y CA deben ser mayores a 0.",
      });
    }

    const combatant = await prisma.combatant.create({
      data: {
        encounterId: encounter.id,
        type: COMBATANT_TYPE_ENEMY,
        characterId: null,
        ownerUserId: null,
        name,
        hp,
        maxHp,
        ac,
        x,
        y,
        initiative,
      },
      include: {
        character: {
          include: {
            owner: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    const updatedEncounter = await getEncounterPayload(gameId);

    // Notificar a todos en la sala
    emitToGame(gameId, "combat:updated", { encounter: updatedEncounter });

    return res.status(201).json({
      combatant,
      encounter: updatedEncounter,
      message: "Enemigo agregado.",
    });
  } catch (error) {
    console.error("Error en POST /games/:gameId/combat/enemies:", error);
    return res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : "Error interno al agregar enemigo.",
    });
  }
});

// ─── PATCH /games/:gameId/combat/combatants/:combatantId ─────────────────────
combatRouter.patch(
  "/games/:gameId/combat/combatants/:combatantId",
  async (req, res) => {
    try {
      const user = getAuthUser(req);

      if (!user) {
        return res.status(401).json({ message: "Debes iniciar sesión." });
      }

      const gameId = String(req.params.gameId);
      const combatantId = String(req.params.combatantId);

      // Validar membership, encounter y combatant en paralelo
      const [membership, encounter, combatant] = await Promise.all([
        requireMembership(gameId, user.id),
        prisma.combatEncounter.findUnique({ where: { gameId } }),
        prisma.combatant.findUnique({ where: { id: combatantId } }),
      ]);

      if (!membership) {
        return res.status(404).json({
          message: "Partida no encontrada o no tienes acceso.",
        });
      }
      if (!encounter) {
        return res.status(404).json({ message: "No hay combate activo." });
      }
      if (!combatant || combatant.encounterId !== encounter.id) {
        return res.status(404).json({ message: "Combatiente no encontrado." });
      }

      const isDm = membership.role === GAME_ROLE_DM;
      const isOwner =
        combatant.type === COMBATANT_TYPE_PLAYER &&
        combatant.ownerUserId === user.id;

      if (!isDm && !isOwner) {
        return res.status(403).json({
          message: "No puedes controlar este combatiente.",
        });
      }

      const data: {
        name?: string;
        hp?: number;
        maxHp?: number;
        ac?: number;
        speed?: number;
        x?: number;
        y?: number;
        initiative?: number;
        movementUsed?: number;
      } = {};

      if (isDm && req.body.name !== undefined) {
        const name = String(req.body.name ?? "").trim();
        if (!name) {
          return res.status(400).json({
            message: "El nombre no puede quedar vacío.",
          });
        }
        data.name = name;
      }

      if (req.body.hp !== undefined) data.hp = toInt(req.body.hp, combatant.hp);
      if (isDm && req.body.maxHp !== undefined) data.maxHp = toInt(req.body.maxHp, combatant.maxHp);
      if (isDm && req.body.ac !== undefined) data.ac = toInt(req.body.ac, combatant.ac);

      // Si el PG llega a 0 (o menos) mientras el personaje está en Forma
      // Salvaje, revertir automáticamente en vez de dejar las estadísticas
      // de la bestia colgadas con 0 PG. El daño sobrante pasa al personaje.
      if (data.hp !== undefined && data.hp <= 0 && combatant.characterId) {
        const character = await prisma.character.findUnique({ where: { id: combatant.characterId } });
        const sheet = (character?.sheetData ?? {}) as {
          combat?: Record<string, unknown>;
          wildShape?: {
            active: boolean;
            saved: {
              armorClass: number; speed: number; maxHp: number; currentHp: number;
              temporaryHp: number; hitDiceTotal?: string; hitDiceCurrent?: string;
              attacks: unknown[]; tokenImagePath: string | null;
            } | null;
          };
        };

        if (character && sheet.wildShape?.active && sheet.wildShape.saved) {
          const saved = sheet.wildShape.saved;
          const excessDamage = Math.max(0, -data.hp);
          const combatBlock = sheet.combat ?? {};

          const nextCombat = {
            ...combatBlock,
            armorClass: saved.armorClass,
            speed: saved.speed,
            maxHp: saved.maxHp,
            currentHp: Math.max(0, saved.currentHp - excessDamage),
            temporaryHp: saved.temporaryHp,
            ...(saved.hitDiceTotal !== undefined ? { hitDiceTotal: saved.hitDiceTotal, hitDiceCurrent: saved.hitDiceCurrent } : {}),
          };

          await prisma.character.update({
            where: { id: character.id },
            data: {
              tokenImagePath: saved.tokenImagePath,
              sheetData: {
                ...(character.sheetData as object),
                combat: nextCombat,
                attacks: saved.attacks,
                wildShape: { ...sheet.wildShape, active: false, beastId: null, beastName: "", saved: null },
              } as unknown as Prisma.InputJsonValue,
            },
          });

          data.ac = Number(nextCombat.armorClass);
          data.maxHp = Number(nextCombat.maxHp);
          data.hp = Number(nextCombat.currentHp);
          data.speed = Number(nextCombat.speed);
        }
      }

      if (req.body.x !== undefined || req.body.y !== undefined) {
        const newX = toInt(req.body.x, combatant.x);
        const newY = toInt(req.body.y, combatant.y);

        // Calcular costo del movimiento solo si no es modo colocación (x/y desde -1)
        const isPlacement = combatant.x === -1 || combatant.y === -1;

        if (!isPlacement && encounter.isActive) {
          const dx = Math.abs(newX - combatant.x);
          const dy = Math.abs(newY - combatant.y);
          const costFeet = Math.max(dx, dy) * 5;
          const totalSpeed = combatant.isDashing ? combatant.speed * 2 : combatant.speed;
          const remaining = totalSpeed - combatant.movementUsed;

          if (costFeet > remaining) {
            return res.status(400).json({
              message: `Movimiento insuficiente. Necesitas ${costFeet} pies pero solo tienes ${remaining} pies restantes.`,
            });
          }
        }

        data.x = newX;
        data.y = newY;
      }

      if (isDm && req.body.initiative !== undefined) data.initiative = toInt(req.body.initiative, combatant.initiative);

      // Solo movimiento (x/y): emitir al instante sin esperar el payload completo
      const isMoveOnly = Object.keys(data).every((k) => k === "x" || k === "y" || k === "movementUsed");

      if (isMoveOnly && (data.x !== undefined || data.y !== undefined)) {
        // Calcular movimiento usado (Chebyshev × 5 pies)
        const dx = Math.abs((data.x ?? combatant.x) - combatant.x);
        const dy = Math.abs((data.y ?? combatant.y) - combatant.y);
        const costFeet = Math.max(dx, dy) * 5;
        data.movementUsed = combatant.movementUsed + costFeet;

        emitToGame(gameId, "combatant:moved", {
          combatantId,
          x: data.x ?? combatant.x,
          y: data.y ?? combatant.y,
          movementUsed: data.movementUsed,
        });
      }

      // Actualizar en DB (sin include pesado — no necesitamos el payload completo aquí)
      await prisma.combatant.update({ where: { id: combatant.id }, data });

      // Obtener payload completo para la respuesta HTTP y emit de sincronización
      const updatedEncounter = await getEncounterPayload(gameId);

      // Si no fue solo movimiento, emitir estado completo
      if (!isMoveOnly) {
        emitToGame(gameId, "combat:updated", { encounter: updatedEncounter });
      }

      return res.json({ encounter: updatedEncounter });
    } catch (error) {
      console.error(
        "Error en PATCH /games/:gameId/combat/combatants/:combatantId:",
        error
      );
      return res.status(500).json({
        message:
          error instanceof Error
            ? error.message
            : "Error interno al actualizar combatiente.",
      });
    }
  }
);

// ─── DELETE /games/:gameId/combat/combatants/:combatantId ────────────────────
combatRouter.delete(
  "/games/:gameId/combat/combatants/:combatantId",
  async (req, res) => {
    try {
      const user = getAuthUser(req);

      if (!user) {
        return res.status(401).json({ message: "Debes iniciar sesión." });
      }

      const gameId = String(req.params.gameId);
      const combatantId = String(req.params.combatantId);

      const membership = await requireDm(gameId, user.id);

      if (!membership) {
        return res.status(403).json({
          message: "Solo el DM puede eliminar combatientes.",
        });
      }

      const encounter = await prisma.combatEncounter.findUnique({
        where: { gameId },
      });

      if (!encounter) {
        return res.status(404).json({ message: "No hay combate activo." });
      }

      const combatant = await prisma.combatant.findUnique({
        where: { id: combatantId },
      });

      if (!combatant || combatant.encounterId !== encounter.id) {
        return res.status(404).json({ message: "Combatiente no encontrado." });
      }

      await prisma.combatant.delete({ where: { id: combatant.id } });

      const updatedEncounter = await getEncounterPayload(gameId);

      if (updatedEncounter) {
        const normalizedTurnIndex = normalizeTurnIndex(
          updatedEncounter.currentTurnIndex,
          updatedEncounter.combatants.length
        );

        if (normalizedTurnIndex !== updatedEncounter.currentTurnIndex) {
          await prisma.combatEncounter.update({
            where: { id: updatedEncounter.id },
            data: { currentTurnIndex: normalizedTurnIndex },
          });
        }
      }

      const finalEncounter = await getEncounterPayload(gameId);

      // Notificar a todos en la sala
      emitToGame(gameId, "combat:updated", { encounter: finalEncounter });

      return res.json({
        ok: true,
        encounter: finalEncounter,
        message: "Combatiente eliminado.",
      });
    } catch (error) {
      console.error(
        "Error en DELETE /games/:gameId/combat/combatants/:combatantId:",
        error
      );
      return res.status(500).json({
        message:
          error instanceof Error
            ? error.message
            : "Error interno al eliminar combatiente.",
      });
    }
  }
);

// ─── POST /games/:gameId/combat/next-turn ────────────────────────────────────
combatRouter.post("/games/:gameId/combat/next-turn", async (req, res) => {
  try {
    const user = getAuthUser(req);

    if (!user) {
      return res.status(401).json({ message: "Debes iniciar sesión." });
    }

    const gameId = String(req.params.gameId);
    const membership = await requireDm(gameId, user.id);

    if (!membership) {
      return res.status(403).json({
        message: "Solo el DM puede avanzar el turno.",
      });
    }

    const encounter = await getEncounterPayload(gameId);

    if (!encounter) {
      return res.status(404).json({ message: "No hay combate activo." });
    }

    const combatantCount = encounter.combatants.length;

    if (combatantCount === 0) {
      await prisma.combatEncounter.update({
        where: { id: encounter.id },
        data: { currentTurnIndex: 0, round: encounter.round },
      });

      const updatedEncounter = await getEncounterPayload(gameId);
      emitToGame(gameId, "combat:updated", { encounter: updatedEncounter });
      return res.json({ encounter: updatedEncounter });
    }

    const nextIndex = (encounter.currentTurnIndex + 1) % combatantCount;
    const nextRound = nextIndex === 0 ? encounter.round + 1 : encounter.round;

    await prisma.combatEncounter.update({
      where: { id: encounter.id },
      data: { currentTurnIndex: nextIndex, round: nextRound },
    });

    // Resetear recursos del combatiente que empieza su turno
    const nextCombatant = encounter.combatants[nextIndex];
    if (nextCombatant) {
      await prisma.combatant.update({
        where: { id: nextCombatant.id },
        data: {
          hasAction: true,
          hasBonusAction: true,
          hasReaction: true,
          isDashing: false,
          movementUsed: 0,
        },
      });
    }

    const updatedEncounter = await getEncounterPayload(gameId);

    // Notificar a todos en la sala
    emitToGame(gameId, "combat:updated", { encounter: updatedEncounter });

    return res.json({ encounter: updatedEncounter });
  } catch (error) {
    console.error("Error en POST /games/:gameId/combat/next-turn:", error);
    return res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : "Error interno al avanzar turno.",
    });
  }
});

// ─── POST /games/:gameId/combat/end ──────────────────────────────────────────
combatRouter.post("/games/:gameId/combat/end", async (req, res) => {
  try {
    const user = getAuthUser(req);

    if (!user) {
      return res.status(401).json({ message: "Debes iniciar sesión." });
    }

    const gameId = String(req.params.gameId);
    const membership = await requireDm(gameId, user.id);

    if (!membership) {
      return res.status(403).json({
        message: "Solo el DM puede terminar el combate.",
      });
    }

    const encounter = await prisma.combatEncounter.findUnique({
      where: { gameId },
    });

    if (!encounter) {
      return res.json({ ok: true, message: "No había combate activo." });
    }

    await prisma.combatEncounter.delete({ where: { id: encounter.id } });

    // Notificar a todos en la sala
    emitToGame(gameId, "combat:ended", { encounter: null });

    return res.json({ ok: true, message: "Combate terminado." });
  } catch (error) {
    console.error("Error en POST /games/:gameId/combat/end:", error);
    return res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : "Error interno al terminar combate.",
    });
  }
});