-- Agrega attacks (lista estructurada de ataques) a MonsterPreset y Combatant
ALTER TABLE "MonsterPreset" ADD COLUMN "attacks" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Combatant" ADD COLUMN "attacks" JSONB NOT NULL DEFAULT '[]';
