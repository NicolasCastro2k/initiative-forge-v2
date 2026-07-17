"use client";

import { FormEvent, useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("forge1234");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  async function loadUsers() {
    setIsLoadingUsers(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/admin/users`, {
        credentials: "include",
      });

      const data = await response.json().catch(() => null);

      if (response.status === 401) {
        window.location.href = `/login?redirect=${encodeURIComponent(
          "/admin/users"
        )}`;
        return;
      }

      if (!response.ok) {
        setError(data?.message ?? "No se pudieron cargar los usuarios.");
        return;
      }

      setUsers(data.users ?? []);
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setIsLoadingUsers(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    setError("");
    setSuccess("");
    setIsCreating(true);

    try {
      const response = await fetch(`${API_URL}/admin/users`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
          password,
        }),
      });

      const data = await response.json().catch(() => null);

      if (response.status === 401) {
        window.location.href = `/login?redirect=${encodeURIComponent(
          "/admin/users"
        )}`;
        return;
      }

      if (!response.ok) {
        setError(data?.message ?? "No se pudo crear el usuario.");
        return;
      }

      setSuccess(`Usuario creado: ${data.user.email}`);
      setName("");
      setEmail("");
      setPassword("forge1234");
      await loadUsers();
    } catch {
      setError("No se pudo conectar con el backend.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-4 rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-yellow-400">
              Initiative Forge
            </p>
            <h1 className="mt-2 text-3xl font-black">
              Administración de usuarios
            </h1>
            <p className="mt-1 text-zinc-400">
              Crea cuentas cerradas para tus amigos.
            </p>
          </div>

          <a
            href="/dashboard"
            className="rounded-xl border border-zinc-700 px-4 py-3 font-semibold text-zinc-200 transition hover:bg-zinc-800"
          >
            Volver al dashboard
          </a>
        </header>

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <h2 className="text-xl font-black">Crear usuario</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Dale a tu amigo un correo y una contraseña temporal.
            </p>

            <form onSubmit={handleCreateUser} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="name"
                  className="mb-2 block text-sm font-semibold text-zinc-300"
                >
                  Nombre
                </label>
                <input
                  id="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
                  placeholder="Nombre del jugador"
                />
              </div>

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
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
                  placeholder="amigo@email.com"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-semibold text-zinc-300"
                >
                  Contraseña temporal
                </label>
                <input
                  id="password"
                  type="text"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-yellow-400"
                  placeholder="Mínimo 8 caracteres"
                />
              </div>

              {error ? (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              ) : null}

              {success ? (
                <div className="rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-200">
                  {success}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isCreating}
                className="w-full rounded-xl bg-yellow-500 px-4 py-3 font-bold text-zinc-950 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreating ? "Creando..." : "Crear usuario"}
              </button>
            </form>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <h2 className="text-xl font-black">Usuarios existentes</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Cuentas con acceso a Initiative Forge.
            </p>

            <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-800">
              {isLoadingUsers ? (
                <div className="bg-zinc-950 p-4 text-sm text-zinc-400">
                  Cargando usuarios...
                </div>
              ) : users.length === 0 ? (
                <div className="bg-zinc-950 p-4 text-sm text-zinc-400">
                  No hay usuarios todavía.
                </div>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="flex flex-col gap-1 bg-zinc-950 p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="font-bold text-white">{user.name}</p>
                        <p className="text-sm text-zinc-400">{user.email}</p>
                      </div>

                      <p className="text-xs text-zinc-500">
                        Creado:{" "}
                        {new Date(user.createdAt).toLocaleDateString("es-ES")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}