export function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

export function rollD20(modifier = 0) {
  const roll = rollDie(20);
  const total = roll + modifier;

  return {
    roll,
    modifier,
    total,
  };
}

export function rollDiceFormula(formula: string): {
  total: number;
  rolls: number[];
  modifier: number;
  label: string;
} {
  const cleanFormula = formula.replace(/\s/g, "");
  const match = cleanFormula.match(/^(\d+)d(\d+)([+-]\d+)?$/);

  if (!match) {
    throw new Error(`Fórmula inválida: ${formula}`);
  }

  const amount = Number(match[1]);
  const sides = Number(match[2]);
  const modifier = match[3] ? Number(match[3]) : 0;

  const rolls = Array.from({ length: amount }, () => rollDie(sides));
  const total = rolls.reduce((sum, roll) => sum + roll, 0) + modifier;

  return {
    total,
    rolls,
    modifier,
    label: formula,
  };
}