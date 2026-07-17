export type ActionCost = "action" | "bonus_action" | "reaction" | "free";

export type CombatActionType = "attack" | "spell" | "ability" | "item";

export type CombatAction = {
  id: string;
  name: string;
  cost: ActionCost;
  type: CombatActionType;
  attackBonus?: number;
  damageFormula?: string;
  description?: string;
};