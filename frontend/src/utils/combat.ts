import { Character } from "@/types/character";

export function sortByInitiative(participants: Character[]) {
  return [...participants].sort((a, b) => b.initiative - a.initiative);
}

export function getHpStatus(character: Character) {
  const percentage = character.hp / character.maxHp;

  if (character.hp <= 0) return "Derrotado";
  if (percentage <= 0.25) return "Crítico";
  if (percentage <= 0.5) return "Herido";
  return "Estable";
}