const FRONTEND_URL = (process.env.FRONTEND_URL ?? "http://localhost:3000").replace(/\/$/, "");
const ALLOW_VERCEL_PREVIEWS = process.env.ALLOW_VERCEL_PREVIEWS === "true";

function extractVercelProjectName(): string | null {
  if (process.env.VERCEL_PROJECT_NAME) return process.env.VERCEL_PROJECT_NAME;

  try {
    const host = new URL(FRONTEND_URL).hostname; // ej: initiative-forge.vercel.app
    if (!host.endsWith(".vercel.app")) return null;
    // El nombre de proyecto es el subdominio completo cuando es el dominio
    // de producción (initiative-forge.vercel.app -> "initiative-forge").
    return host.replace(".vercel.app", "");
  } catch {
    return null;
  }
}

const previewProjectName = ALLOW_VERCEL_PREVIEWS ? extractVercelProjectName() : null;

// Coincide con:
//   https://<project>.vercel.app                         (producción)
//   https://<project>-<hash>.vercel.app                   (preview por commit)
//   https://<project>-git-<branch>-<team>.vercel.app       (preview por branch)
const previewRegex = previewProjectName
  ? new RegExp(`^https://${previewProjectName}(-[a-z0-9-]+)?\\.vercel\\.app$`, "i")
  : null;

export function isAllowedOrigin(origin: string): boolean {
  if (origin === FRONTEND_URL) return true;
  if (previewRegex && previewRegex.test(origin)) return true;
  return false;
}


export function corsOriginCallback(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
) {
  // Sin header Origin (curl, health checks del propio servidor, etc.)
  if (!origin) return callback(null, true);

  if (isAllowedOrigin(origin)) return callback(null, true);

  callback(new Error(`Origen no permitido por CORS: ${origin}`));
}
