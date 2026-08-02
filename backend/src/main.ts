import express from "express";
import cors from "cors";
import compression from "compression";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { createServer } from "node:http";
import { combatActionsRouter } from "./routes/combat.actions.routes.js";
import { playerRouter } from "./routes/player.routes.js";
import { dmRouter } from "./routes/dm.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { adminRouter } from "./routes/admin.routes.js";
import { gamesRouter } from "./routes/games.routes.js";
import { mapsRouter } from "./routes/maps.routes.js";
import { charactersRouter } from "./routes/characters.routes.js";
import { combatRouter } from "./routes/combat.routes.js";
import path from "node:path";
import { presetsRouter } from "./routes/presets.routes.js";
import { initSocket } from "./lib/socket.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Express genera un ETag automático en cada respuesta JSON. En navegadores
// con bugs de revalidación condicional (notablemente Safari/WebKit en
// peticiones con credentials: "include") esto puede hacer que fetch() reciba
// un 304 "crudo" en vez del body cacheado con 200, y como response.ok es
// false para 304, el frontend interpreta que la sesión no es válida y manda
// al usuario de vuelta al login aunque la cookie sea correcta. Como esta API
// no sirve contenido estático cacheable (eso ya lo maneja /uploads aparte),
// desactivamos el ETag globalmente.
app.set("etag", false);

// Comprime todas las respuestas (JSON y estáticos) con gzip/brotli. Los
// payloads de la ficha, el catálogo de bestias/hechizos y el encuentro de
// combate son bastante grandes en JSON sin comprimir — esto reduce el
// tamaño transferido en la mayoría de los endpoints sin tocar nada más.
app.use(compression());

// Cache-Control largo para /uploads: los nombres de archivo son únicos por
// subida (timestamp + uuid), así que el mismo nombre siempre apunta al mismo
// contenido — el navegador puede quedarse con la copia local en vez de
// pedirla de nuevo (o revalidarla) en cada carga de página.
app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "uploads"), {
    maxAge: "7d",
    immutable: true,
  })
);

const PORT = Number(process.env.PORT ?? 4000);
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// Inicializar socket.io
initSocket(httpServer, FRONTEND_URL);

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "Initiative Forge Backend",
    routes: {
      health: "GET /health",
      login: "POST /auth/login",
      logout: "POST /auth/logout",
      me: "GET /auth/me",
      adminUsers: "GET /admin/users",
      createUser: "POST /admin/users",
      games: "GET /games",
      createGame: "POST /games",
      gameDetail: "GET /games/:gameId",
      joinGame: "POST /games/join",
    },
  });
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "Initiative Forge Backend",
  });
});

app.use("/auth", authRouter);
app.use("/admin", adminRouter);
app.use("/games", gamesRouter);
app.use("/", mapsRouter);
app.use("/", charactersRouter);
app.use("/", combatRouter);
app.use("/", combatActionsRouter);
app.use("/", playerRouter);
app.use("/", dmRouter);
app.use("/", presetsRouter);

// Usar httpServer en vez de app.listen para que socket.io funcione
httpServer.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});