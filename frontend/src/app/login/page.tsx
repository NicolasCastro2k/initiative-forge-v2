"use client";

import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type LoginResponse = {
  user: {
    id: string;
    name: string;
    email: string;
  };
};

export default function LoginPage() {
  const searchParams = useSearchParams();

  const redirectTo = useMemo(() => {
    const redirect = searchParams.get("redirect");

    if (!redirect || !redirect.startsWith("/")) {
      return "/dashboard";
    }

    return redirect;
  }, [searchParams]);

  const [email, setEmail] = useState("dm@forge.local");
  const [password, setPassword] = useState("forge1234");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  const cleanEmail = email.trim().toLowerCase();

  setError("");
  setIsLoading(true);

  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: cleanEmail,
        password,
      }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorData = data as { message?: string } | null;

      setError(errorData?.message ?? "No se pudo iniciar sesión.");
      return;
    }

    window.location.href = redirectTo;
  } catch {
    setError("No se pudo conectar con el backend.");
  } finally {
    setIsLoading(false);
  }
}

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 text-white">
      <section className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.3em] text-yellow-400">
          Initiative Forge
        </p>

        <h1 className="text-3xl font-black">Iniciar sesión</h1>

        <p className="mt-2 text-sm text-zinc-400">
          Entra con tu correo y contraseña para acceder a tus partidas,
          personajes y tableros.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-semibold text-zinc-300"
            >
              Correo
            </label>

            <input
              id="email"
              type="email"
              value={email}
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-yellow-400"
              placeholder="tu-correo@ejemplo.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-semibold text-zinc-300"
            >
              Contraseña
            </label>

            <input
              id="password"
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-yellow-400"
              placeholder="••••••••"
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-yellow-500 px-4 py-3 font-bold text-zinc-950 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
          <p className="font-semibold text-zinc-200">Usuario demo:</p>
          <p>dm@forge.local</p>
          <p>forge1234</p>
        </div>

        <p className="mt-4 text-center text-sm text-zinc-500">
      Las cuentas son creadas por el administrador de la mesa.
      </p>
      </section>
    </main>
  );
}