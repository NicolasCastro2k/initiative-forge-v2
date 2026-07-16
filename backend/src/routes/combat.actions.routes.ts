// backend/src/routes/combat.actions.routes.ts
//
// Rutas de acciones de combate D&D 5e:
//   POST /games/:gameId/combat/action/attack
//   POST /games/:gameId/combat/action/spell
//   POST /games/:gameId/combat/action/saving-throw
//   POST /games/:gameId/combat/action/dash
//   POST /games/:gameId/combat/action/condition
//   GET  /games/:gameId/combat/reachable/:combatantId

import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { getAuthUser } from "../lib/getAuthUser.js";
import { emitToGame } from "../lib/socket.js";
import {
  resolveAttack,
  resolveSpell,
  resolveSavingThrow,
  reachableTiles,
  spellAreaTiles,
  parseSheetData,
  getAbilitiesFromSheet,
  getWeaponsFromSheet,
  getSpellsFromSheet,
  WEAPONS_SRD,
  SPELLS_SRD,
  remainingMovement,
  distanceFeet,
  type Condition,
  type AbilityName,
} from "../lib/dnd5e.js";

export const combatActionsRouter = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getEncounterWithCombatants(gameId: string) {
  return prisma.combatEncounter.findUnique({
    where: { gameId },
    include: {
      combatants: {
        orderBy: [{ initiative: "desc" }, { createdAt: "asc" }],
        include: {
          character: {
            include: {
              owner: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
    },
  });
}

async function requireMembership(gameId: string, userId: string) {
  return prisma.gameMember.findUnique({
    where: { gameId_userId: { gameId, userId } },
  });
}

async function logAction(
  encounterId: string,
  round: number,
  actorName: string,
  action: string,
  detail: string,
  rolls: unknown[] = []
) {
  await prisma.combatLog.create({
    data: { encounterId, round, actorName, action, detail, rolls },
  });
}

function getCombatantAbilities(combatant: {
  str: number; dex: number; con: number;
  int: number; wis: number; cha: number;
  character?: { sheetData: unknown; level: number } | null;
}) {
  // Preferir datos de la hoja si existen
  if (combatant.character?.sheetData) {
    const sheet = parseSheetData(combatant.character.sheetData);
    const fromSheet = getAbilitiesFromSheet(sheet);
    // Si la hoja tiene datos reales (no todos 10), usarlos
    const hasRealData = Object.values(fromSheet).some((v) => v !== 10);
    if (hasRealData) return fromSheet;
  }
  return {
    str: combatant.str,
    dex: combatant.dex,
    con: combatant.con,
    int: combatant.int,
    wis: combatant.wis,
    cha: combatant.cha,
  };
}

// ─── GET /games/:gameId/combat/reachable/:combatantId ────────────────────────
// Devuelve las casillas alcanzables para el combatiente en su turno actual.

combatActionsRouter.get(
  "/games/:gameId/combat/reachable/:combatantId",
  async (req, res) => {
    try {
      const user = getAuthUser(req);
      if (!user) return res.status(401).json({ message: "No autenticado." });

      const { gameId, combatantId } = req.params;
      const membership = await requireMembership(gameId, user.id);
      if (!membership) return res.status(403).json({ message: "Sin acceso." });

      const encounter = await getEncounterWithCombatants(gameId);
      if (!encounter) return res.status(404).json({ message: "Sin combate activo." });

      const combatant = encounter.combatants.find((c) => c.id === combatantId);
      if (!combatant) return res.status(404).json({ message: "Combatiente no encontrado." });

      // Mapa activo
      const activeMap = await prisma.battleMap.findFirst({
        where: { gameId, isActive: true },
      });
      if (!activeMap) return res.json({ reachable: [], remainingFeet: 0 });

      const gridData = activeMap.gridData as { tiles: string[][] };
      const remaining = remainingMovement(
        combatant.speed,
        combatant.movementUsed,
        combatant.isDashing
      );

      const occupied = encounter.combatants
        .filter((c) => c.id !== combatantId)
        .map((c) => ({ x: c.x, y: c.y }));

      const reachable = reachableTiles(
        combatant.x,
        combatant.y,
        remaining,
        activeMap.rows,
        activeMap.cols,
        gridData.tiles,
        occupied
      );

      return res.json({ reachable, remainingFeet: remaining });
    } catch (error) {
      console.error("Error en reachable:", error);
      return res.status(500).json({ message: "Error interno." });
    }
  }
);

// ─── Tipos que coinciden con el sheetData real ───────────────────────────────

type RealSheetData = {
  abilities?: {
    strength?: number;
    dexterity?: number;
    constitution?: number;
    intelligence?: number;
    wisdom?: number;
    charisma?: number;
  };
  combat?: {
    armorClass?: number;
    initiative?: number;
    speed?: number;
    maxHp?: number;
    currentHp?: number;
  };
  attacks?: {
    name: string;
    attackBonus: string; // "+5", "-1", "3", etc.
    damage: string;      // "1d8+3 cortante", "2d6 fuego", etc.
  }[];
  proficiencies?: {
    proficiencyBonus?: number;
  };
  spells?: {
    spellcastingAbility?: string; // "intelligence", "wisdom", etc.
    spellSaveDc?: number;
    spellAttackBonus?: number;
    cantrips?: string[];
    level1?: string[];
    level2?: string[];
    level3?: string[];
    level4?: string[];
    level5?: string[];
    level6?: string[];
    level7?: string[];
    level8?: string[];
    level9?: string[];
  };
};

function parseRealSheet(raw: unknown): RealSheetData {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as RealSheetData;
}

function getAbilitiesFromRealSheet(sheet: RealSheetData) {
  return {
    str: sheet.abilities?.strength ?? 10,
    dex: sheet.abilities?.dexterity ?? 10,
    con: sheet.abilities?.constitution ?? 10,
    int: sheet.abilities?.intelligence ?? 10,
    wis: sheet.abilities?.wisdom ?? 10,
    cha: sheet.abilities?.charisma ?? 10,
  };
}

// Convierte "1d8+3 cortante" → { count: 1, sides: 8, modifier: 3, damageType: "cortante" }
function parseDamageString(damage: string) {
  const match = damage.match(/(\d+)d(\d+)([+-]\d+)?\s*(.*)?/i);
  if (!match) return { count: 1, sides: 6, modifier: 0, damageType: damage };
  return {
    count: parseInt(match[1], 10),
    sides: parseInt(match[2], 10),
    modifier: match[3] ? parseInt(match[3], 10) : 0,
    damageType: (match[4] ?? "").trim() || "sin tipo",
  };
}

// Convierte "+5" o "3" → número
function parseAttackBonus(bonus: string): number {
  return parseInt(bonus.replace(/^\+/, ""), 10) || 0;
}

// ─── GET /games/:gameId/combat/weapons/:combatantId ──────────────────────────

combatActionsRouter.get(
  "/games/:gameId/combat/weapons/:combatantId",
  async (req, res) => {
    try {
      const user = getAuthUser(req);
      if (!user) return res.status(401).json({ message: "No autenticado." });

      const { gameId, combatantId } = req.params;
      const membership = await requireMembership(gameId, user.id);
      if (!membership) return res.status(403).json({ message: "Sin acceso." });

      const encounter = await getEncounterWithCombatants(gameId);
      if (!encounter) return res.status(404).json({ message: "Sin combate activo." });

      const combatant = encounter.combatants.find((c) => c.id === combatantId);
      if (!combatant) return res.status(404).json({ message: "Combatiente no encontrado." });

      const sheet = parseRealSheet(combatant.character?.sheetData);
      const attacks = sheet.attacks ?? [];

      // Para enemigos o personajes sin ataques, devolver lista vacía
      const weapons = attacks.map((a) => ({
        name: a.name,
        attackBonus: parseAttackBonus(a.attackBonus),
        damage: a.damage,
        ...parseDamageString(a.damage),
      }));

      return res.json({ weapons });
    } catch (error) {
      console.error("Error en weapons:", error);
      return res.status(500).json({ message: "Error interno." });
    }
  }
);

// ─── GET /games/:gameId/combat/spells/:combatantId ───────────────────────────

combatActionsRouter.get(
  "/games/:gameId/combat/spells/:combatantId",
  async (req, res) => {
    try {
      const user = getAuthUser(req);
      if (!user) return res.status(401).json({ message: "No autenticado." });

      const { gameId, combatantId } = req.params;
      const membership = await requireMembership(gameId, user.id);
      if (!membership) return res.status(403).json({ message: "Sin acceso." });

      const encounter = await getEncounterWithCombatants(gameId);
      if (!encounter) return res.status(404).json({ message: "Sin combate activo." });

      const combatant = encounter.combatants.find((c) => c.id === combatantId);
      if (!combatant) return res.status(404).json({ message: "Combatiente no encontrado." });

      const sheet = parseRealSheet(combatant.character?.sheetData);
      const spellSheet = sheet.spells ?? {};

      // Recopilar todos los hechizos con su nivel
      const spells: { name: string; level: number }[] = [
        ...(spellSheet.cantrips ?? []).map((n) => ({ name: n, level: 0 })),
        ...(spellSheet.level1 ?? []).map((n) => ({ name: n, level: 1 })),
        ...(spellSheet.level2 ?? []).map((n) => ({ name: n, level: 2 })),
        ...(spellSheet.level3 ?? []).map((n) => ({ name: n, level: 3 })),
        ...(spellSheet.level4 ?? []).map((n) => ({ name: n, level: 4 })),
        ...(spellSheet.level5 ?? []).map((n) => ({ name: n, level: 5 })),
        ...(spellSheet.level6 ?? []).map((n) => ({ name: n, level: 6 })),
        ...(spellSheet.level7 ?? []).map((n) => ({ name: n, level: 7 })),
        ...(spellSheet.level8 ?? []).map((n) => ({ name: n, level: 8 })),
        ...(spellSheet.level9 ?? []).map((n) => ({ name: n, level: 9 })),
      ].filter((s) => s.name.trim() !== "");

      return res.json({
        spells,
        spellSaveDc: spellSheet.spellSaveDc ?? 0,
        spellAttackBonus: spellSheet.spellAttackBonus ?? 0,
        spellcastingAbility: spellSheet.spellcastingAbility ?? "",
      });
    } catch (error) {
      console.error("Error en spells:", error);
      return res.status(500).json({ message: "Error interno." });
    }
  }
);

// ─── POST /games/:gameId/combat/action/attack ─────────────────────────────────
// Body: { attackerId, targetId, weaponName, advantage?, disadvantage? }

combatActionsRouter.post(
  "/games/:gameId/combat/action/attack",
  async (req, res) => {
    try {
      const user = getAuthUser(req);
      if (!user) return res.status(401).json({ message: "No autenticado." });

      const { gameId } = req.params;
      const membership = await requireMembership(gameId, user.id);
      if (!membership) return res.status(403).json({ message: "Sin acceso." });

      const { attackerId, targetId, weaponName, advantage = false, disadvantage = false } = req.body;

      const encounter = await getEncounterWithCombatants(gameId);
      if (!encounter) return res.status(404).json({ message: "Sin combate activo." });

      const attacker = encounter.combatants.find((c) => c.id === attackerId);
      const target = encounter.combatants.find((c) => c.id === targetId);

      if (!attacker) return res.status(404).json({ message: "Atacante no encontrado." });
      if (!target) return res.status(404).json({ message: "Objetivo no encontrado." });

      const isDm = membership.role === "DM";
      const isOwner = attacker.ownerUserId === user.id;
      if (!isDm && !isOwner) {
        return res.status(403).json({ message: "No puedes controlar este combatiente." });
      }

      if (!attacker.hasAction) {
        return res.status(400).json({ message: "Ya usaste tu acción este turno." });
      }

      // Buscar el ataque en la ficha real del personaje
      const sheet = parseRealSheet(attacker.character?.sheetData);
      const attacks = sheet.attacks ?? [];
      const attack = attacks.find((a) => a.name === weaponName) ?? attacks[0];

      if (!attack) {
        return res.status(400).json({ message: "Ataque no encontrado en la ficha." });
      }

      // Parsear daño: "1d8+3 cortante" → { count, sides, modifier, damageType }
      const parsed = parseDamageString(attack.damage);
      const attackBonus = parseAttackBonus(attack.attackBonus);

      // Tirada de ataque: d20 + attackBonus de la ficha
      const d20 = Math.floor(Math.random() * 20) + 1;
      const d20b = (advantage || disadvantage) ? Math.floor(Math.random() * 20) + 1 : null;

      let finalD20 = d20;
      if (d20b !== null) {
        finalD20 = advantage ? Math.max(d20, d20b) : Math.min(d20, d20b);
      }

      const isCrit = finalD20 === 20;
      const attackTotal = finalD20 + attackBonus;
      const isHit = isCrit || attackTotal >= target.ac;

      // Tirada de daño
      let totalDamage = 0;
      const damageRolls: number[] = [];

      if (isHit) {
        const diceCount = isCrit ? parsed.count * 2 : parsed.count;
        for (let i = 0; i < diceCount; i++) {
          const roll = Math.floor(Math.random() * parsed.sides) + 1;
          damageRolls.push(roll);
        }
        totalDamage = Math.max(0, damageRolls.reduce((s, r) => s + r, 0) + parsed.modifier);
      }

      const detail = isHit
        ? isCrit
          ? `¡Crítico! ${totalDamage} daño ${parsed.damageType} (${damageRolls.join("+")}${parsed.modifier !== 0 ? (parsed.modifier > 0 ? `+${parsed.modifier}` : parsed.modifier) : ""})`
          : `Impacta (${finalD20}+${attackBonus}=${attackTotal} vs CA ${target.ac}) → ${totalDamage} daño ${parsed.damageType}`
        : `Falla (${finalD20}+${attackBonus}=${attackTotal} vs CA ${target.ac})`;

      if (isHit) {
        await prisma.combatant.update({
          where: { id: target.id },
          data: { hp: Math.max(0, target.hp - totalDamage) },
        });
      }

      await prisma.combatant.update({
        where: { id: attacker.id },
        data: { hasAction: false },
      });

      await logAction(
        encounter.id,
        encounter.round,
        attacker.name,
        `Ataque: ${attack.name}`,
        detail,
        [{ d20: finalD20, bonus: attackBonus, total: attackTotal }, { rolls: damageRolls, modifier: parsed.modifier, total: totalDamage }]
      );

      const updatedEncounter = await getEncounterWithCombatants(gameId);
      emitToGame(gameId, "combat:updated", { encounter: updatedEncounter });

      return res.json({
        result: {
          weapon: attack.name,
          attackTotal,
          isHit,
          isCrit,
          totalDamage,
          damageType: parsed.damageType,
          detail,
        },
        encounter: updatedEncounter,
        targetHp: Math.max(0, target.hp - totalDamage),
      });
    } catch (error) {
      console.error("Error en attack:", error);
      return res.status(500).json({ message: "Error interno." });
    }
  }
);

// ─── POST /games/:gameId/combat/action/spell ──────────────────────────────────
// Body: { casterId, spellName, targetIds, damageDice? }
// Los hechizos en la ficha son solo nombres — el DM/jugador especifica el daño

combatActionsRouter.post(
  "/games/:gameId/combat/action/spell",
  async (req, res) => {
    try {
      const user = getAuthUser(req);
      if (!user) return res.status(401).json({ message: "No autenticado." });

      const { gameId } = req.params;
      const membership = await requireMembership(gameId, user.id);
      if (!membership) return res.status(403).json({ message: "Sin acceso." });

      const {
        casterId,
        spellName,
        targetIds = [],
        damageDice = "1d6",    // El frontend envía los dados de daño
        damageType = "mágico",
        savingThrow = null,    // null = tirada de ataque, "dexterity" etc = salvación
        halfOnSave = true,
      } = req.body;

      const encounter = await getEncounterWithCombatants(gameId);
      if (!encounter) return res.status(404).json({ message: "Sin combate activo." });

      const caster = encounter.combatants.find((c) => c.id === casterId);
      if (!caster) return res.status(404).json({ message: "Lanzador no encontrado." });

      const isDm = membership.role === "DM";
      const isOwner = caster.ownerUserId === user.id;
      if (!isDm && !isOwner) {
        return res.status(403).json({ message: "No puedes controlar este combatiente." });
      }

      if (!caster.hasAction) {
        return res.status(400).json({ message: "Ya usaste tu acción este turno." });
      }

      // Leer spellSaveDc y spellAttackBonus directo de la ficha
      const sheet = parseRealSheet(caster.character?.sheetData);
      const spellSaveDc = sheet.spells?.spellSaveDc ?? 10;

      // Parsear dados de daño
      const parsed = parseDamageString(damageDice);

      // Targets
      const targets = encounter.combatants.filter((c) => targetIds.includes(c.id));
      if (targets.length === 0) {
        return res.status(400).json({ message: "No hay objetivos seleccionados." });
      }

      // Resolver daño por objetivo
      const resolvedTargets = targets.map((t) => {
        // Tirar dados de daño
        const rolls: number[] = [];
        for (let i = 0; i < parsed.count; i++) {
          rolls.push(Math.floor(Math.random() * parsed.sides) + 1);
        }
        const rawDamage = rolls.reduce((s, r) => s + r, 0) + parsed.modifier;

        let totalDamage = rawDamage;
        let saveRoll: number | null = null;
        let savedSuccessfully = false;

        if (savingThrow) {
          // Tirada de salvación del objetivo
          const abilityMap: Record<string, string> = {
            strength: "str", dexterity: "dex", constitution: "con",
            intelligence: "int", wisdom: "wis", charisma: "cha",
          };
          const tSheet = parseRealSheet(t.character?.sheetData);
          const tAbilities = getAbilitiesFromRealSheet(tSheet);
          const shortKey = abilityMap[savingThrow] ?? savingThrow;
          const abilityScore = tAbilities[shortKey as keyof typeof tAbilities] ?? 10;
          const saveMod = Math.floor((abilityScore - 10) / 2);
          saveRoll = Math.floor(Math.random() * 20) + 1 + saveMod;
          savedSuccessfully = saveRoll >= spellSaveDc;

          if (savedSuccessfully) {
            totalDamage = halfOnSave ? Math.floor(rawDamage / 2) : 0;
          }
        }

        return {
          id: t.id,
          name: t.name,
          rolls,
          rawDamage,
          totalDamage: Math.max(0, totalDamage),
          saveRoll,
          savedSuccessfully,
          saveDc: spellSaveDc,
        };
      });

      // Aplicar daño
      for (const resolved of resolvedTargets) {
        const combatant = targets.find((t) => t.id === resolved.id);
        if (!combatant) continue;
        await prisma.combatant.update({
          where: { id: combatant.id },
          data: { hp: Math.max(0, combatant.hp - resolved.totalDamage) },
        });
      }

      // Gastar acción
      await prisma.combatant.update({
        where: { id: caster.id },
        data: { hasAction: false },
      });

      const detail = resolvedTargets.map((t) => {
        if (t.saveRoll !== null) {
          const saveText = t.savedSuccessfully
            ? `salvación exitosa (${t.saveRoll} vs CD ${t.saveDc})`
            : `salvación fallida (${t.saveRoll} vs CD ${t.saveDc})`;
          return `${t.name}: ${saveText} → ${t.totalDamage} daño ${damageType}`;
        }
        return `${t.name}: ${t.totalDamage} daño ${damageType}`;
      }).join(" | ");

      await logAction(
        encounter.id,
        encounter.round,
        caster.name,
        `Hechizo: ${spellName}`,
        detail,
        resolvedTargets.map((t) => ({ rolls: t.rolls, total: t.totalDamage }))
      );

      const updatedEncounter = await getEncounterWithCombatants(gameId);

      emitToGame(gameId, "spell:cast", {
        spellName,
        areaTiles: [],
        encounter: updatedEncounter,
      });

      return res.json({ result: { spell: spellName, targets: resolvedTargets, detail }, encounter: updatedEncounter });
    } catch (error) {
      console.error("Error en spell:", error);
      return res.status(500).json({ message: "Error interno." });
    }
  }
);

// ─── POST /games/:gameId/combat/action/saving-throw ──────────────────────────
// Tirada de salvación libre (el DM pide una tirada fuera de hechizo).
// Body: { combatantId, ability, dc, hasProficiency? }

combatActionsRouter.post(
  "/games/:gameId/combat/action/saving-throw",
  async (req, res) => {
    try {
      const user = getAuthUser(req);
      if (!user) return res.status(401).json({ message: "No autenticado." });

      const { gameId } = req.params;
      const membership = await requireMembership(gameId, user.id);
      if (!membership) return res.status(403).json({ message: "Sin acceso." });

      const { combatantId, ability, dc, hasProficiency = false } = req.body;

      if (!ability || !dc) {
        return res.status(400).json({ message: "Falta ability o dc." });
      }

      const encounter = await getEncounterWithCombatants(gameId);
      if (!encounter) return res.status(404).json({ message: "Sin combate activo." });

      const combatant = encounter.combatants.find((c) => c.id === combatantId);
      if (!combatant) return res.status(404).json({ message: "Combatiente no encontrado." });

      const abilities = getCombatantAbilities(combatant as Parameters<typeof getCombatantAbilities>[0]);
      const abilityScore = abilities[ability as AbilityName] ?? 10;
      const level = combatant.character?.level ?? 1;

      const saveResult = resolveSavingThrow(
        ability as AbilityName,
        Number(dc),
        abilityScore,
        hasProficiency,
        level
      );

      await logAction(
        encounter.id,
        encounter.round,
        combatant.name,
        `Tirada de salvación: ${ability.toUpperCase()}`,
        saveResult.detail,
        [saveResult.roll]
      );

      emitToGame(gameId, "combat:log", {
        actorName: combatant.name,
        action: `Salvación ${ability.toUpperCase()} CD ${dc}`,
        detail: saveResult.detail,
      });

      return res.json({ result: saveResult });
    } catch (error) {
      console.error("Error en saving-throw:", error);
      return res.status(500).json({ message: "Error interno." });
    }
  }
);

// ─── POST /games/:gameId/combat/action/dash ───────────────────────────────────
// Usar la acción de Dash para duplicar el movimiento.
// Body: { combatantId }

combatActionsRouter.post(
  "/games/:gameId/combat/action/dash",
  async (req, res) => {
    try {
      const user = getAuthUser(req);
      if (!user) return res.status(401).json({ message: "No autenticado." });

      const { gameId } = req.params;
      const membership = await requireMembership(gameId, user.id);
      if (!membership) return res.status(403).json({ message: "Sin acceso." });

      const { combatantId } = req.body;
      const encounter = await getEncounterWithCombatants(gameId);
      if (!encounter) return res.status(404).json({ message: "Sin combate activo." });

      const combatant = encounter.combatants.find((c) => c.id === combatantId);
      if (!combatant) return res.status(404).json({ message: "Combatiente no encontrado." });

      const isDm = membership.role === "DM";
      const isOwner = combatant.ownerUserId === user.id;
      if (!isDm && !isOwner) {
        return res.status(403).json({ message: "Sin permiso." });
      }

      if (!combatant.hasAction) {
        return res.status(400).json({ message: "Ya usaste tu acción este turno." });
      }

      await prisma.combatant.update({
        where: { id: combatant.id },
        data: { isDashing: true, hasAction: false },
      });

      const updatedEncounter = await getEncounterWithCombatants(gameId);
      emitToGame(gameId, "combat:updated", { encounter: updatedEncounter });

      await logAction(
        encounter.id,
        encounter.round,
        combatant.name,
        "Acción: Carrera",
        `${combatant.name} usa Carrera y duplica su velocidad este turno.`
      );

      return res.json({
        message: `${combatant.name} usa Carrera. Velocidad duplicada.`,
        encounter: updatedEncounter,
      });
    } catch (error) {
      console.error("Error en dash:", error);
      return res.status(500).json({ message: "Error interno." });
    }
  }
);

// ─── POST /games/:gameId/combat/action/condition ──────────────────────────────
// DM aplica o remueve una condición a un combatiente.
// Body: { combatantId, condition, remove? }

combatActionsRouter.post(
  "/games/:gameId/combat/action/condition",
  async (req, res) => {
    try {
      const user = getAuthUser(req);
      if (!user) return res.status(401).json({ message: "No autenticado." });

      const { gameId } = req.params;
      const membership = await requireMembership(gameId, user.id);

      if (!membership || membership.role !== "DM") {
        return res.status(403).json({ message: "Solo el DM puede aplicar condiciones." });
      }

      const { combatantId, condition, remove = false } = req.body;

      const encounter = await getEncounterWithCombatants(gameId);
      if (!encounter) return res.status(404).json({ message: "Sin combate activo." });

      const combatant = encounter.combatants.find((c) => c.id === combatantId);
      if (!combatant) return res.status(404).json({ message: "Combatiente no encontrado." });

      const current = (combatant.conditions as Condition[]) ?? [];

      const updated = remove
        ? current.filter((c) => c !== condition)
        : current.includes(condition)
          ? current
          : [...current, condition];

      await prisma.combatant.update({
        where: { id: combatant.id },
        data: { conditions: updated },
      });

      const action = remove ? "Condición removida" : "Condición aplicada";
      await logAction(
        encounter.id,
        encounter.round,
        "DM",
        action,
        `${combatant.name}: ${condition} ${remove ? "removida" : "aplicada"}`
      );

      const updatedEncounter = await getEncounterWithCombatants(gameId);
      emitToGame(gameId, "combat:updated", { encounter: updatedEncounter });

      return res.json({
        conditions: updated,
        encounter: updatedEncounter,
      });
    } catch (error) {
      console.error("Error en condition:", error);
      return res.status(500).json({ message: "Error interno." });
    }
  }
);

// ─── GET /games/:gameId/combat/logs ──────────────────────────────────────────

combatActionsRouter.get(
  "/games/:gameId/combat/logs",
  async (req, res) => {
    try {
      const user = getAuthUser(req);
      if (!user) return res.status(401).json({ message: "No autenticado." });

      const { gameId } = req.params;
      const membership = await requireMembership(gameId, user.id);
      if (!membership) return res.status(403).json({ message: "Sin acceso." });

      const encounter = await prisma.combatEncounter.findUnique({
        where: { gameId },
      });
      if (!encounter) return res.json({ logs: [] });

      const logs = await prisma.combatLog.findMany({
        where: { encounterId: encounter.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      return res.json({ logs });
    } catch (error) {
      console.error("Error en logs:", error);
      return res.status(500).json({ message: "Error interno." });
    }
  }
);