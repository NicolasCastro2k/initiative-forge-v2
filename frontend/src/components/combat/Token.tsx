import { Character } from "@/types/character";

type TokenProps = {
  character: Character;
  isActive: boolean;
  isSelected: boolean;
  isTargetable?: boolean;
  isActor?: boolean;
  onClick: () => void;
};

export function Token({
  character,
  isActive,
  isSelected,
  isTargetable = false,
  isActor = false,
  onClick,
}: TokenProps) {
  const initials = character.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const hpPercentage = Math.max(
    0,
    Math.min(100, (character.hp / character.maxHp) * 100)
  );

  const isEnemy = character.type === "enemy";

  const tokenColor = isEnemy
    ? "from-red-700 to-red-950 border-red-300"
    : "from-blue-600 to-blue-950 border-blue-300";

  const nameColor = isEnemy ? "text-red-100" : "text-blue-100";

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={[
        "group relative flex h-full w-full flex-col items-center justify-center rounded-xl transition",
        isSelected ? "scale-105" : "",
        isTargetable ? "animate-pulse" : "",
      ].join(" ")}
      title={character.name}
    >
      <div
        className={[
          "relative flex h-14 w-14 items-center justify-center rounded-full border-2 bg-gradient-to-br text-base font-black text-white shadow-xl transition",
          tokenColor,
          isActive ? "ring-4 ring-yellow-300 ring-offset-2 ring-offset-zinc-950" : "",
          isSelected ? "outline outline-4 outline-white/80" : "",
          isTargetable ? "ring-4 ring-red-400 ring-offset-2 ring-offset-zinc-950" : "",
          isActor ? "ring-4 ring-blue-400 ring-offset-2 ring-offset-zinc-950" : "",
        ].join(" ")}
      >
        {initials}

        {character.hp <= 0 ? (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/70 text-xl">
            ✕
          </div>
        ) : null}
      </div>

      <div className="mt-2 w-full max-w-24">
        <div className="h-2 overflow-hidden rounded-full bg-zinc-800 shadow-inner">
          <div
            className={[
              "h-full rounded-full transition-all",
              hpPercentage > 50
                ? "bg-green-500"
                : hpPercentage > 25
                  ? "bg-yellow-500"
                  : "bg-red-500",
            ].join(" ")}
            style={{ width: `${hpPercentage}%` }}
          />
        </div>

        <p
          className={[
            "mt-1 truncate text-center text-xs font-bold drop-shadow",
            nameColor,
          ].join(" ")}
        >
          {character.name}
        </p>

        <p className="text-center text-[10px] text-zinc-400">
          {character.hp}/{character.maxHp}
        </p>
      </div>
    </button>
  );
}