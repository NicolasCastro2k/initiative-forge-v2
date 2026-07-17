import { Character } from "./character";

export type CombatState = {
  round: number;
  currentTurnIndex: number;
  participants: Character[];
  selectedCharacterId: string | null;
  log: string[];
};