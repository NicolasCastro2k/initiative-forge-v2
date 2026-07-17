"use client";

import { useCombatStore } from "@/store/combatStore";

export function ActionMenu() {
  const participants = useCombatStore((state) => state.participants);
  const selectedCharacterId = useCombatStore((state) => state.selectedCharacterId);
  const currentTurnIndex = useCombatStore((state) => state.currentTurnIndex);
  const pendingAction = useCombatStore((state) => state.pendingAction);

  const startTargeting = useCombatStore((state) => state.startTargeting);
  const cancelTargeting = useCombatStore((state) => state.cancelTargeting);
  const nextTurn = useCombatStore((state) => state.nextTurn);

  const activeCharacter = participants[currentTurnIndex];
  const character =
    participants.find((item) => item.id === selectedCharacterId) ?? activeCharacter;

  if (!character) {
    return (
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-xl">
        <h2 className="text-lg font-bold text-white">Acciones</h2>
        <p className="text-sm text-zinc-400">No hay personaje seleccionado.</p>
      </section>
    );
  }

  const isPreparingAction = Boolean(pendingAction);

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-xl">
      <h2 className="text-lg font-bold text-white">Acciones</h2>

      <p className="mb-4 text-sm text-zinc-400">
        Seleccionado: <span className="text-white">{character.name}</span>
      </p>

      {pendingAction ? (
        <div className="mb-4 rounded-xl border border-yellow-500/50 bg-yellow-500/10 p-3">
          <p className="text-sm font-bold text-yellow-300">
            Seleccionando objetivo
          </p>
          <p className="mt-1 text-sm text-zinc-300">
            Acción: {pendingAction.action.name}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Haz click sobre un token objetivo en el tablero.
          </p>

          <button
            type="button"
            onClick={cancelTargeting}
            className="mt-3 w-full rounded-lg border border-zinc-700 px-3 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-800"
          >
            Cancelar acción
          </button>
        </div>
      ) : null}

      <div className="space-y-3">
        {character.actions.map((action) => (
          <button
            key={action.id}
            type="button"
            disabled={isPreparingAction}
            onClick={() => startTargeting(character.id, action)}
            className={[
              "w-full rounded-xl border p-3 text-left transition",
              isPreparingAction
                ? "cursor-not-allowed border-zinc-800 bg-zinc-900 opacity-50"
                : "border-zinc-800 bg-zinc-900 hover:border-blue-500 hover:bg-blue-500/10",
            ].join(" ")}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">{action.name}</span>
              <span className="rounded-full bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
                {action.cost}
              </span>
            </div>

            {action.description ? (
              <p className="mt-1 text-xs text-zinc-500">{action.description}</p>
            ) : null}

            <div className="mt-2 flex gap-2 text-xs text-zinc-400">
              {action.attackBonus !== undefined ? (
                <span>ATK +{action.attackBonus}</span>
              ) : null}

              {action.damageFormula ? (
                <span>Daño {action.damageFormula}</span>
              ) : null}
            </div>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={nextTurn}
        className="mt-4 w-full rounded-xl bg-yellow-500 px-4 py-3 font-bold text-zinc-950 transition hover:bg-yellow-400"
      >
        Terminar turno
      </button>
    </section>
  );
}