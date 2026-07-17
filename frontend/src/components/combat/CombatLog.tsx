"use client";

import { useCombatStore } from "@/store/combatStore";

export function CombatLog() {
  const log = useCombatStore((state) => state.log);

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-xl">
      <h2 className="mb-3 text-lg font-bold text-white">Log de combate</h2>

      <div className="max-h-56 space-y-2 overflow-y-auto pr-2">
        {log.map((entry, index) => (
          <div
            key={`${entry}-${index}`}
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300"
          >
            {entry}
          </div>
        ))}
      </div>
    </section>
  );
}