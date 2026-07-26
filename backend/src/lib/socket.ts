import { Server as HttpServer } from "node:http";
import { Server as SocketServer, Socket } from "socket.io";
import { verifyAuthToken } from "./auth.js";

function parseCookies(cookieHeader: string): Record<string, string> {
  return Object.fromEntries(
    cookieHeader.split(";").map((pair) => {
      const [key, ...rest] = pair.trim().split("=");
      return [key.trim(), decodeURIComponent(rest.join("=").trim())];
    })
  );
}

export type CombatEventName =
  | "combat:updated"
  | "combat:started"
  | "combat:ended"
  | "combat:placement"
  | "map:changed"
  | "combatant:moved"
  | "spell:cast"
  | "combat:log"
  | "dice:rolled"
  | "party:leveledUp"
  | "party:rested";

const COOKIE_NAME = "initiative_forge_session";

let io: SocketServer | null = null;

export function initSocket(httpServer: HttpServer, frontendUrl: string) {
  io = new SocketServer(httpServer, {
    cors: {
      origin: frontendUrl,
      credentials: true,
    },
  });

  // Autenticar usando la misma cookie httpOnly que usa Express
  io.use((socket: Socket, next) => {
    const cookieHeader = socket.handshake.headers.cookie ?? "";
    const cookies = parseCookies(cookieHeader);
    const token = cookies[COOKIE_NAME];

    if (!token) {
      return next(new Error("No autenticado."));
    }

    const user = verifyAuthToken(token);

    if (!user) {
      return next(new Error("Token inválido."));
    }

    (socket.data as { user: typeof user }).user = user;

    return next();
  });

  io.on("connection", (socket: Socket) => {
    socket.on("join:game", (gameId: string) => {
      if (typeof gameId === "string" && gameId) {
        socket.join(`game:${gameId}`);
      }
    });

    socket.on("leave:game", (gameId: string) => {
      if (typeof gameId === "string" && gameId) {
        socket.leave(`game:${gameId}`);
      }
    });
  });

  return io;
}

export function emitToGame(
  gameId: string,
  event: CombatEventName,
  payload: unknown
) {
  if (!io) return;
  io.to(`game:${gameId}`).emit(event, payload);
}