"use client";

import { Token } from "./Token";
import { useCombatStore } from "@/store/combatStore";

const BOARD_SIZE = 8;

export function CombatBoard() {
  const participants = useCombatStore((state) => state.participants);
  const selectedCharacterId = useCombatStore((state) => state.selectedCharacterId);
  const currentTurnIndex = useCombatStore((state) => state.currentTurnIndex);
  const pendingAction = useCombatStore((state) => state.pendingAction);

  const selectCharacter = useCombatStore((state) => state.selectCharacter);
  const moveCharacter = useCombatStore((state) => state.moveCharacter);
  const resolveActionAgainstTarget = useCombatStore(
    (state) => state.resolveActionAgainstTarget
  );

  const activeCharacter = participants[currentTurnIndex];

  function getCharacterAt(x: number, y: number) {
    return participants.find(
      (character) => character.position.x === x && character.position.y === y
    );
  }

  function isValidTarget(characterId: string) {
    if (!pendingAction) return false;
    return characterId !== pendingAction.actorId;
  }

  function handleCellClick(x: number, y: number) {
    const occupied = getCharacterAt(x, y);

    if (pendingAction) {
      if (occupied && isValidTarget(occupied.id)) {
        resolveActionAgainstTarget(occupied.id);
      }

      return;
    }

    if (!selectedCharacterId) return;

    if (occupied) {
      selectCharacter(occupied.id);
      return;
    }

    moveCharacter(selectedCharacterId, x, y);
  }

  return (
    <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-white">Tablero táctico</h2>

          {pendingAction ? (
            <p className="text-sm text-yellow-300">
              Selecciona un objetivo para {pendingAction.action.name}.
            </p>
          ) : (
            <p className="text-sm text-zinc-400">
              Selecciona un token y luego una casilla libre para moverlo.
            </p>
          )}
        </div>

        <div className="rounded-full border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-300">
          Grid {BOARD_SIZE}x{BOARD_SIZE}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
        <div
          className="grid min-w-[720px] gap-2"
          style={{
            gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: BOARD_SIZE * BOARD_SIZE }).map((_, index) => {
            const x = index % BOARD_SIZE;
            const y = Math.floor(index / BOARD_SIZE);
            const character = getCharacterAt(x, y);

            const isActiveCell =
              activeCharacter?.position.x === x && activeCharacter.position.y === y;

            const isSelectedCell =
              selectedCharacterId && character?.id === selectedCharacterId;

            const canBeTarget =
              pendingAction && character && isValidTarget(character.id);

            const isActor =
              pendingAction && character?.id === pendingAction.actorId;

            const checker = (x + y) % 2 === 0;

            return (
              <div
                key={`${x}-${y}`}
                onClick={() => handleCellClick(x, y)}
                className={[
                  "relative flex aspect-square min-h-24 cursor-pointer items-center justify-center rounded-2xl border transition",
                  checker
                    ? "border-zinc-800 bg-zinc-900"
                    : "border-zinc-800 bg-zinc-950",
                  pendingAction
                    ? "hover:border-yellow-500/60 hover:bg-yellow-500/10"
                    : "hover:border-yellow-500/60 hover:bg-yellow-500/10",
                  isActiveCell
                    ? "border-yellow-300 bg-yellow-400/10 shadow-lg shadow-yellow-500/10"
                    : "",
                  isSelectedCell ? "outline outline-4 outline-blue-400/60" : "",
                  canBeTarget
                    ? "border-red-400 bg-red-500/10 shadow-lg shadow-red-500/20"
                    : "",
                  isActor ? "border-blue-400 bg-blue-500/10" : "",
                ].join(" ")}
              >
                <div className="absolute left-2 top-2 text-[10px] font-semibold text-zinc-600">
                  {x},{y}
                </div>

                {canBeTarget ? (
                  <div className="absolute right-2 top-2 rounded-full bg-red-500 px-2 py-1 text-[10px] font-black text-white">
                    TARGET
                  </div>
                ) : null}

                {isActor ? (
                  <div className="absolute right-2 top-2 rounded-full bg-blue-500 px-2 py-1 text-[10px] font-black text-white">
                    ACTOR
                  </div>
                ) : null}

                {character ? (
                  <Token
                    character={character}
                    isActive={activeCharacter?.id === character.id}
                    isSelected={selectedCharacterId === character.id}
                    isTargetable={Boolean(canBeTarget)}
                    isActor={Boolean(isActor)}
                    onClick={() => {
                      if (pendingAction && isValidTarget(character.id)) {
                        resolveActionAgainstTarget(character.id);
                        return;
                      }

                      selectCharacter(character.id);
                    }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}