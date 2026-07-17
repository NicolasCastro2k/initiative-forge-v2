"use client";

import { useCombatStore } from "@/store/combatStore";

export function TurnOrder() {
  const round = useCombatStore((state) => state.round);
  const participants = useCombatStore((state) => state.participants);
  const currentTurnIndex = useCombatStore((state) => state.currentTurnIndex);
  const selectCharacter = useCombatStore((state) => state.selectCharacter);

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-xl">
      <h2 className="text-lg font-bold text-white">Iniciativa</h2>
      <p className="mb-4 text-sm text-zinc-400">Ronda {round}</p>

      <div className="space-y-2">
        {participants.map((participant, index) => {
          const isActive = index === currentTurnIndex;

          return (
            <button
              key={participant.id}
              onClick={() => selectCharacter(participant.id)}
              className={[
                "w-full rounded-xl border p-3 text-left transition",
                isActive
                  ? "border-yellow-400 bg-yellow-400/10"
                  : "border-zinc-800 bg-zinc-900 hover:bg-zinc-800",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">
                  {isActive ? "▶ " : ""}
                  {participant.name}
                </span>
                <span className="text-sm text-zinc-400">
                  {participant.initiative}
                </span>
              </div>

              <div className="mt-1 text-xs text-zinc-500">
                HP {participant.hp}/{participant.maxHp} · AC {participant.ac}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}