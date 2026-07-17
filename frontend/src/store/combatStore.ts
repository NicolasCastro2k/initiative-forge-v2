"use client";

import { create } from "zustand";
import { CombatState } from "@/types/combat";
import { Character } from "@/types/character";
import { CombatAction } from "@/types/action";
import { mockParticipants } from "@/data/mockCombat";
import { rollD20, rollDiceFormula } from "@/utils/dice";

type PendingAction = {
  actorId: string;
  action: CombatAction;
} | null;

type CombatStore = CombatState & {
  pendingAction: PendingAction;

  selectCharacter: (id: string | null) => void;
  moveCharacter: (id: string, x: number, y: number) => void;
  damageCharacter: (id: string, amount: number) => void;
  healCharacter: (id: string, amount: number) => void;

  startTargeting: (actorId: string, action: CombatAction) => void;
  cancelTargeting: () => void;
  resolveActionAgainstTarget: (targetId: string) => void;

  nextTurn: () => void;
  addLog: (message: string) => void;
};

export const useCombatStore = create<CombatStore>()((set, get) => ({
  round: 1,
  currentTurnIndex: 0,
  participants: mockParticipants,
  selectedCharacterId: mockParticipants[0]?.id ?? null,
  pendingAction: null,
  log: ["Combate iniciado."],

  selectCharacter: (id: string | null) => {
    set({ selectedCharacterId: id });
  },

  moveCharacter: (id: string, x: number, y: number) => {
    const character = get().participants.find(
      (item: Character) => item.id === id
    );

    set((state: CombatStore) => ({
      participants: state.participants.map((participant: Character) =>
        participant.id === id
          ? { ...participant, position: { x, y } }
          : participant
      ),
      log: character
        ? [`${character.name} se movió a (${x}, ${y}).`, ...state.log]
        : state.log,
    }));
  },

  damageCharacter: (id: string, amount: number) => {
    const character = get().participants.find(
      (item: Character) => item.id === id
    );

    set((state: CombatStore) => ({
      participants: state.participants.map((participant: Character) =>
        participant.id === id
          ? {
              ...participant,
              hp: Math.max(0, participant.hp - amount),
            }
          : participant
      ),
      log: character
        ? [`${character.name} recibió ${amount} de daño.`, ...state.log]
        : state.log,
    }));
  },

  healCharacter: (id: string, amount: number) => {
    const character = get().participants.find(
      (item: Character) => item.id === id
    );

    set((state: CombatStore) => ({
      participants: state.participants.map((participant: Character) =>
        participant.id === id
          ? {
              ...participant,
              hp: Math.min(participant.maxHp, participant.hp + amount),
            }
          : participant
      ),
      log: character
        ? [`${character.name} recuperó ${amount} HP.`, ...state.log]
        : state.log,
    }));
  },

  startTargeting: (actorId: string, action: CombatAction) => {
    const actor = get().participants.find((item) => item.id === actorId);

    set((state) => ({
      pendingAction: { actorId, action },
      selectedCharacterId: actorId,
      log: actor
        ? [
            `${actor.name} prepara ${action.name}. Selecciona un objetivo.`,
            ...state.log,
          ]
        : state.log,
    }));
  },

  cancelTargeting: () => {
    set((state) => ({
      pendingAction: null,
      log: ["Acción cancelada.", ...state.log],
    }));
  },

  resolveActionAgainstTarget: (targetId: string) => {
    const { pendingAction, participants } = get();

    if (!pendingAction) return;

    const actor = participants.find((item) => item.id === pendingAction.actorId);
    const target = participants.find((item) => item.id === targetId);
    const action = pendingAction.action;

    if (!actor || !target) return;

    if (actor.id === target.id) {
      set((state) => ({
        log: ["No puedes elegirte a ti mismo como objetivo.", ...state.log],
      }));
      return;
    }

    const newLog: string[] = [];

    newLog.push(`${actor.name} usa ${action.name} contra ${target.name}.`);

    let shouldApplyDamage = true;

    if (action.attackBonus !== undefined) {
      const attackRoll = rollD20(action.attackBonus);
      const hit = attackRoll.total >= target.ac;

      newLog.push(
        `Ataque: ${attackRoll.roll} + ${attackRoll.modifier} = ${attackRoll.total} contra AC ${target.ac}.`
      );

      if (hit) {
        newLog.push(`Impacto contra ${target.name}.`);
      } else {
        newLog.push(`${actor.name} falla el ataque.`);
        shouldApplyDamage = false;
      }
    }

    let damageTotal = 0;

    if (shouldApplyDamage && action.damageFormula) {
      const damageRoll = rollDiceFormula(action.damageFormula);
      damageTotal = damageRoll.total;

      newLog.push(
        `Daño: ${damageRoll.rolls.join(" + ")}${
          damageRoll.modifier ? ` + ${damageRoll.modifier}` : ""
        } = ${damageRoll.total}.`
      );
    }

    set((state) => ({
      pendingAction: null,
      selectedCharacterId: target.id,
      participants: state.participants.map((participant) =>
        participant.id === target.id
          ? {
              ...participant,
              hp: Math.max(0, participant.hp - damageTotal),
            }
          : participant
      ),
      log: [...newLog.reverse(), ...state.log],
    }));
  },

  nextTurn: () => {
    const { currentTurnIndex, participants, round } = get();

    const nextIndex = currentTurnIndex + 1;

    if (nextIndex >= participants.length) {
      const nextCharacter = participants[0];

      set((state: CombatStore) => ({
        currentTurnIndex: 0,
        round: round + 1,
        selectedCharacterId: nextCharacter.id,
        pendingAction: null,
        log: [
          `Ronda ${round + 1}. Turno de ${nextCharacter.name}.`,
          ...state.log,
        ],
      }));

      return;
    }

    const nextCharacter = participants[nextIndex];

    set((state: CombatStore) => ({
      currentTurnIndex: nextIndex,
      selectedCharacterId: nextCharacter.id,
      pendingAction: null,
      log: [`Turno de ${nextCharacter.name}.`, ...state.log],
    }));
  },

  addLog: (message: string) => {
    set((state: CombatStore) => ({
      log: [message, ...state.log],
    }));
  },
}));