import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { createAuthToken, verifyAuthToken } from "../lib/auth.js";

export const authRouter = Router();

const COOKIE_NAME = "initiative_forge_session";

// En local, frontend y backend viven en localhost (mismo "site" a fines de
// cookies) y por lo general sin HTTPS, así que sirve `sameSite: "lax"` +
// `secure: false`. En producción, Vercel y Render son dominios DISTINTOS
// (cross-site) y ambos usan HTTPS — ahí la cookie necesita
// `sameSite: "none"` + `secure: true`, si no el navegador la descarta y el
// login "funciona" (200 OK) pero la sesión nunca queda guardada.
const isProduction = process.env.NODE_ENV === "production";
const sessionCookieOptions = {
  httpOnly: true,
  sameSite: (isProduction ? "none" : "lax") as "none" | "lax",
  secure: isProduction,
};

function getIsAdmin(email: string) {
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((adminEmail) => adminEmail.trim().toLowerCase())
    .filter(Boolean);

  return adminEmails.includes(email.toLowerCase());
}

authRouter.post("/login", async (req, res) => {
  const email = String(req.body.email ?? "").trim().toLowerCase();
  const password = String(req.body.password ?? "");

  if (!email || !password) {
    return res.status(400).json({
      message: "Correo y contraseña son obligatorios.",
    });
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return res.status(401).json({
      message: "Credenciales inválidas.",
    });
  }

  const passwordIsValid = await bcrypt.compare(password, user.passwordHash);

  if (!passwordIsValid) {
    return res.status(401).json({
      message: "Credenciales inválidas.",
    });
  }

  const publicUser = {
    id: user.id,
    name: user.name,
    email: user.email,
  };

  const token = createAuthToken(publicUser);

  res.cookie(COOKIE_NAME, token, {
    ...sessionCookieOptions,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });

  return res.json({
    user: {
      ...publicUser,
      isAdmin: getIsAdmin(publicUser.email),
    },
  });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, {
    ...sessionCookieOptions,
    path: "/",
  });

  return res.json({
    ok: true,
  });
});

authRouter.get("/me", (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];

  if (!token) {
    return res.status(401).json({
      user: null,
    });
  }

  const user = verifyAuthToken(token);

  if (!user) {
    return res.status(401).json({
      user: null,
    });
  }

  return res.json({
    user: {
      ...user,
      isAdmin: getIsAdmin(user.email),
    },
  });
});