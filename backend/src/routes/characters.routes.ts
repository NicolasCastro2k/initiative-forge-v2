import { Router } from "express";
import multer from "multer";
import { prisma } from "../lib/prisma.js";
import { getAuthUser } from "../lib/getAuthUser.js";
import { emitToGame } from "../lib/socket.js";
import { uploadImageToSupabase } from "../lib/supabaseStorage.js";

export const charactersRouter = Router();

// Antes esto guardaba en disco local (multer.diskStorage) — en Render (plan
// gratis) ese disco se borra en cada redeploy/reinicio, así que ahora se
// guarda el archivo en memoria y se sube a Supabase Storage.
const uploadCharacterImage = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    const allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      callback(new Error("Solo se permiten imágenes JPG, PNG, WEBP o GIF."));
      return;
    }

    callback(null, true);
  },
});

function toStringOrNull(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }

  const stringValue = String(value).trim();

  return stringValue.length > 0 ? stringValue : null;
}

function toIntOrFallback(value: unknown, fallback: number) {
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

// Payload con la misma forma que usa el tablero de combate (combat.routes.ts),
// duplicado aquí para no crear un import cruzado entre routers.
async function getEncounterPayloadForGame(gameId: string) {
  return prisma.combatEncounter.findUnique({
    where: { gameId },
    include: {
      combatants: {
        orderBy: [{ initiative: "desc" }, { createdAt: "asc" }],
        include: {
          character: {
            include: { owner: { select: { id: true, name: true, email: true } } },
          },
        },
      },
    },
  });
}

// Forma Salvaje cambia CA/PG/velocidad en la ficha (sheetData.combat), pero el
// tablero de combate guarda su propia copia en Combatant (tomada una sola vez
// al empezar el combate). Si el personaje tiene un Combatant en un encuentro
// activo, hay que empujarle los mismos valores y avisar por socket.
async function syncActiveCombatants(characterId: string, sheetData: unknown) {
  const sheet = (sheetData ?? {}) as { combat?: { armorClass?: number; maxHp?: number; currentHp?: number; speed?: number } };
  const combat = sheet.combat;
  if (!combat) return;

  const linked = await prisma.combatant.findMany({
    where: { characterId, encounter: { isActive: true } },
  });

  const affectedGameIds = new Set<string>();

  for (const combatant of linked) {
    await prisma.combatant.update({
      where: { id: combatant.id },
      data: {
        ac: numberOrFallback(combat.armorClass, combatant.ac),
        maxHp: numberOrFallback(combat.maxHp, combatant.maxHp),
        hp: numberOrFallback(combat.currentHp, combatant.hp),
        speed: numberOrFallback(combat.speed, combatant.speed),
      },
    });

    const encounter = await prisma.combatEncounter.findUnique({ where: { id: combatant.encounterId } });
    if (encounter) affectedGameIds.add(encounter.gameId);
  }

  for (const gameId of affectedGameIds) {
    const payload = await getEncounterPayloadForGame(gameId);
    emitToGame(gameId, "combat:updated", { encounter: payload });
  }
}

function getDefaultSheetData(characterName: string) {
  return {
    identity: {
      playerName: "",
      characterName,
      className: "",
      subclassName: "",
      level: 1,
      background: "",
      race: "",
      alignment: "",
      experience: 0,
    },
    abilities: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    combat: {
      armorClass: 10,
      initiative: 0,
      speed: 30,
      maxHp: 10,
      currentHp: 10,
      temporaryHp: 0,
      hitDiceTotal: "1d8",
      hitDiceCurrent: "1d8",
      deathSavesSuccesses: 0,
      deathSavesFailures: 0,
    },
    proficiencies: {
      proficiencyBonus: 2,
      savingThrows: {
        strength: false,
        dexterity: false,
        constitution: false,
        intelligence: false,
        wisdom: false,
        charisma: false,
      },
      skills: {
        acrobatics: false,
        animalHandling: false,
        arcana: false,
        athletics: false,
        deception: false,
        history: false,
        insight: false,
        intimidation: false,
        investigation: false,
        medicine: false,
        nature: false,
        perception: false,
        performance: false,
        persuasion: false,
        religion: false,
        sleightOfHand: false,
        stealth: false,
        survival: false,
      },
      languages: [],
      tools: [],
      armor: [],
      weapons: [],
    },
    attacks: [],
    equipment: [],
    currency: {
      cp: 0,
      sp: 0,
      ep: 0,
      gp: 0,
      pp: 0,
    },
    personality: {
      traits: "",
      ideals: "",
      bonds: "",
      flaws: "",
    },
    features: [],
    spells: {
      spellcastingClass: "",
      spellcastingAbility: "",
      spellSaveDc: 0,
      spellAttackBonus: 0,
      slots: {
        "1": {
          total: 0,
          expended: 0,
        },
        "2": {
          total: 0,
          expended: 0,
        },
        "3": {
          total: 0,
          expended: 0,
        },
        "4": {
          total: 0,
          expended: 0,
        },
        "5": {
          total: 0,
          expended: 0,
        },
        "6": {
          total: 0,
          expended: 0,
        },
        "7": {
          total: 0,
          expended: 0,
        },
        "8": {
          total: 0,
          expended: 0,
        },
        "9": {
          total: 0,
          expended: 0,
        },
      },
      spellsByLevel: {
        "0": [],
        "1": [],
        "2": [],
        "3": [],
        "4": [],
        "5": [],
        "6": [],
        "7": [],
        "8": [],
        "9": [],
      },
    },
  };
}

charactersRouter.get("/characters", async (req, res) => {
  try {
    const user = getAuthUser(req);

    if (!user) {
      return res.status(401).json({
        message: "Debes iniciar sesión.",
      });
    }

    const characters = await prisma.character.findMany({
      where: {
        ownerUserId: user.id,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return res.json({
      characters,
    });
  } catch (error) {
    console.error("Error en GET /characters:", error);

    return res.status(500).json({
      message: "Error interno al cargar personajes.",
    });
  }
});

charactersRouter.post("/characters", async (req, res) => {
  try {
    const user = getAuthUser(req);

    if (!user) {
      return res.status(401).json({
        message: "Debes iniciar sesión.",
      });
    }

    const name = String(req.body.name ?? "").trim();

    if (!name) {
      return res.status(400).json({
        message: "El nombre del personaje es obligatorio.",
      });
    }

    const level = toIntOrFallback(req.body.level, 1);

    const character = await prisma.character.create({
      data: {
        ownerUserId: user.id,
        name,
        raceId: toStringOrNull(req.body.raceId),
        classId: toStringOrNull(req.body.classId),
        subclassId: toStringOrNull(req.body.subclassId),
        backgroundId: toStringOrNull(req.body.backgroundId),
        level,
        sheetData: req.body.sheetData ?? getDefaultSheetData(name),
      },
    });

    return res.status(201).json({
      character,
    });
  } catch (error) {
    console.error("Error en POST /characters:", error);

    return res.status(500).json({
      message: "Error interno al crear personaje.",
    });
  }
});

charactersRouter.get("/characters/:characterId", async (req, res) => {
  try {
    const user = getAuthUser(req);

    if (!user) {
      return res.status(401).json({
        message: "Debes iniciar sesión.",
      });
    }

    const characterId = String(req.params.characterId);

    const character = await prisma.character.findUnique({
      where: {
        id: characterId,
      },
    });

    if (!character || character.ownerUserId !== user.id) {
      return res.status(404).json({
        message: "Personaje no encontrado.",
      });
    }

    return res.json({
      character,
    });
  } catch (error) {
    console.error("Error en GET /characters/:characterId:", error);

    return res.status(500).json({
      message: "Error interno al cargar personaje.",
    });
  }
});

charactersRouter.put("/characters/:characterId", async (req, res) => {
  try {
    const user = getAuthUser(req);

    if (!user) {
      return res.status(401).json({
        message: "Debes iniciar sesión.",
      });
    }

    const characterId = String(req.params.characterId);

    const existingCharacter = await prisma.character.findUnique({
      where: {
        id: characterId,
      },
    });

    if (!existingCharacter || existingCharacter.ownerUserId !== user.id) {
      return res.status(404).json({
        message: "Personaje no encontrado.",
      });
    }

    const name = String(req.body.name ?? existingCharacter.name).trim();

    if (!name) {
      return res.status(400).json({
        message: "El nombre del personaje es obligatorio.",
      });
    }

    const character = await prisma.character.update({
      where: {
        id: characterId,
      },
      data: {
        name,
        raceId:
          req.body.raceId !== undefined
            ? toStringOrNull(req.body.raceId)
            : existingCharacter.raceId,
        classId:
          req.body.classId !== undefined
            ? toStringOrNull(req.body.classId)
            : existingCharacter.classId,
        subclassId:
          req.body.subclassId !== undefined
            ? toStringOrNull(req.body.subclassId)
            : existingCharacter.subclassId,
        backgroundId:
          req.body.backgroundId !== undefined
            ? toStringOrNull(req.body.backgroundId)
            : existingCharacter.backgroundId,
        level:
          req.body.level !== undefined
            ? toIntOrFallback(req.body.level, existingCharacter.level)
            : existingCharacter.level,
        // Forma Salvaje usa esto para cambiar el token en el mapa de combate
        // mientras el personaje está transformado, y restaurarlo al revertir.
        tokenImagePath:
          req.body.tokenImagePath !== undefined
            ? toStringOrNull(req.body.tokenImagePath)
            : existingCharacter.tokenImagePath,
        sheetData:
          req.body.sheetData !== undefined
            ? req.body.sheetData
            : existingCharacter.sheetData,
      },
    });

    if (req.body.syncCombatant === true) {
      await syncActiveCombatants(character.id, character.sheetData);
    }

    return res.json({
      character,
    });
  } catch (error) {
    console.error("Error en PUT /characters/:characterId:", error);

    return res.status(500).json({
      message: "Error interno al actualizar personaje.",
    });
  }
});

charactersRouter.post(
  "/characters/:characterId/image",
  uploadCharacterImage.single("image"),
  async (req, res) => {
    try {
      const user = getAuthUser(req);

      if (!user) {
        return res.status(401).json({
          message: "Debes iniciar sesión.",
        });
      }

      const characterId = String(req.params.characterId);

      const existingCharacter = await prisma.character.findUnique({
        where: {
          id: characterId,
        },
      });

      if (!existingCharacter || existingCharacter.ownerUserId !== user.id) {
        return res.status(404).json({
          message: "Personaje no encontrado.",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          message: "Debes subir una imagen.",
        });
      }

      let imagePath: string;
      try {
        imagePath = await uploadImageToSupabase("characters", req.file);
      } catch (uploadError) {
        console.error("Error subiendo imagen a Supabase:", uploadError);
        return res.status(500).json({
          message: uploadError instanceof Error ? uploadError.message : "No se pudo subir la imagen.",
        });
      }

      const character = await prisma.character.update({
        where: {
          id: characterId,
        },
        data: {
          portraitImagePath: imagePath,
          tokenImagePath: imagePath,
        },
      });

      return res.json({
        character,
        imagePath,
        message: "Imagen actualizada.",
      });
    } catch (error) {
      console.error("Error en POST /characters/:characterId/image:", error);

      return res.status(500).json({
        message:
          error instanceof Error
            ? error.message
            : "Error interno al subir imagen.",
      });
    }
  }
);

charactersRouter.delete("/characters/:characterId", async (req, res) => {
  try {
    const user = getAuthUser(req);

    if (!user) {
      return res.status(401).json({
        message: "Debes iniciar sesión.",
      });
    }

    const characterId = String(req.params.characterId);

    const existingCharacter = await prisma.character.findUnique({
      where: {
        id: characterId,
      },
    });

    if (!existingCharacter || existingCharacter.ownerUserId !== user.id) {
      return res.status(404).json({
        message: "Personaje no encontrado.",
      });
    }

    await prisma.character.delete({
      where: {
        id: characterId,
      },
    });

    return res.json({
      ok: true,
      message: "Personaje eliminado.",
    });
  } catch (error) {
    console.error("Error en DELETE /characters/:characterId:", error);

    return res.status(500).json({
      message: "Error interno al eliminar personaje.",
    });
  }
});