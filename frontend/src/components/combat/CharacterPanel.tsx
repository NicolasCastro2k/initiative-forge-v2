"use client";

import { useCombatStore } from "@/store/combatStore";
import { getHpStatus } from "@/utils/combat";

export function CharacterPanel() {
  const participants = useCombatStore((state) => state.participants);
  const selectedCharacterId = useCombatStore((state) => state.selectedCharacterId);
  const damageCharacter = useCombatStore((state) => state.damageCharacter);
  const healCharacter = useCombatStore((state) => state.healCharacter);

  const character = participants.find((item) => item.id === selectedCharacterId);

  if (!character) {
    return (
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-xl">
        <h2 className="text-lg font-bold text-white">Personaje</h2>
        <p className="text-sm text-zinc-400">Selecciona un token.</p>
      </section>
    );
  }

  const hpPercentage = Math.max(
    0,
    Math.min(100, (character.hp / character.maxHp) * 100)
  );

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-xl">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-white">{character.name}</h2>
        <p className="text-sm text-zinc-400">
          {character.type === "player" ? "Jugador" : "Enemigo"}
          {character.className ? ` · ${character.className}` : ""}
          {character.level ? ` nivel ${character.level}` : ""}
        </p>
      </div>

      <div className="mb-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">HP</span>
          <span className="font-semibold text-white">
            {character.hp}/{character.maxHp}
          </span>
        </div>

        <div className="h-3 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full bg-green-500"
            style={{ width: `${hpPercentage}%` }}
          />
        </div>

        <p className="text-xs text-zinc-500">{getHpStatus(character)}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-zinc-900 p-3">
          <p className="text-zinc-500">AC</p>
          <p className="text-lg font-bold text-white">{character.ac}</p>
        </div>

        <div className="rounded-xl bg-zinc-900 p-3">
          <p className="text-zinc-500">Velocidad</p>
          <p className="text-lg font-bold text-white">{character.speed} ft</p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => damageCharacter(character.id, 1)}
          className="flex-1 rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500"
        >
          -1 HP
        </button>

        <button
          onClick={() => healCharacter(character.id, 1)}
          className="flex-1 rounded-xl bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-500"
        >
          +1 HP
        </button>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-sm font-semibold text-white">Estados</p>

        {character.conditions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {character.conditions.map((condition) => (
              <span
                key={condition}
                className="rounded-full bg-purple-500/20 px-3 py-1 text-xs text-purple-200"
              >
                {condition}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">Sin estados activos.</p>
        )}
      </div>
    </section>
  );
}