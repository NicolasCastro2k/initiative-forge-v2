import { CombatAction } from "./action";

export type CharacterType = "player" | "enemy";

export type Position = {
  x: number;
  y: number;
};

export type Character = {
  id: string;
  name: string;
  type: CharacterType;
  className?: string;
  level?: number;
  hp: number;
  maxHp: number;
  ac: number;
  speed: number;
  initiative: number;
  position: Position;
  actions: CombatAction[];
  conditions: string[];
};