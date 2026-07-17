export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 text-white">
      <section className="max-w-2xl text-center">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-yellow-400">
          Initiative Forge
        </p>

        <h1 className="text-5xl font-black">
          Tus partidas de D&amp;D más claras
        </h1>

        <p className="mt-4 text-lg text-zinc-400">
          Inicia sesión para crear partidas, invitar amigos, seleccionar
          personajes y gestionar combates.
        </p>

        <a
          href="/login"
          className="mt-8 inline-block rounded-xl bg-yellow-500 px-6 py-3 font-bold text-zinc-950 transition hover:bg-yellow-400"
        >
          Iniciar sesión
        </a>
      </section>
    </main>
  );
}