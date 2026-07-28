// frontend/src/utils/dnd5e.ts
//
// Constantes y helpers de reglas de D&D 5e compartidos entre la ficha de
// personaje y la Pantalla de Jugador (tiradas automáticas de dados).

export type AbilityKey = "strength" | "dexterity" | "constitution" | "intelligence" | "wisdom" | "charisma";

export function getModifier(score: number) {
  return Math.floor((score - 10) / 2);
}

export function signed(value: number) {
  return value >= 0 ? `+${value}` : String(value);
}

export const abilityLabels: { key: AbilityKey; label: string; short: string }[] = [
  { key: "strength", label: "Fuerza", short: "FUE" },
  { key: "dexterity", label: "Destreza", short: "DES" },
  { key: "constitution", label: "Constitución", short: "CON" },
  { key: "intelligence", label: "Inteligencia", short: "INT" },
  { key: "wisdom", label: "Sabiduría", short: "SAB" },
  { key: "charisma", label: "Carisma", short: "CAR" },
];

export const skillLabels: { key: string; label: string; ability: AbilityKey }[] = [
  { key: "acrobatics", label: "Acrobacias", ability: "dexterity" },
  { key: "animalHandling", label: "Trato con animales", ability: "wisdom" },
  { key: "arcana", label: "Arcanos", ability: "intelligence" },
  { key: "athletics", label: "Atletismo", ability: "strength" },
  { key: "deception", label: "Engaño", ability: "charisma" },
  { key: "history", label: "Historia", ability: "intelligence" },
  { key: "insight", label: "Perspicacia", ability: "wisdom" },
  { key: "intimidation", label: "Intimidación", ability: "charisma" },
  { key: "investigation", label: "Investigación", ability: "intelligence" },
  { key: "medicine", label: "Medicina", ability: "wisdom" },
  { key: "nature", label: "Naturaleza", ability: "intelligence" },
  { key: "perception", label: "Percepción", ability: "wisdom" },
  { key: "performance", label: "Actuación", ability: "charisma" },
  { key: "persuasion", label: "Persuasión", ability: "charisma" },
  { key: "religion", label: "Religión", ability: "intelligence" },
  { key: "sleightOfHand", label: "Juego de manos", ability: "dexterity" },
  { key: "stealth", label: "Sigilo", ability: "dexterity" },
  { key: "survival", label: "Supervivencia", ability: "wisdom" },
];