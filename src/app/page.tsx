import Link from "next/link";

const quickPoints = ["Batch work", "Recipe system", "Local-first", "ZIP export"];

export default function Home() {
  return (
    <div className="shell">
      <main className="container py-5 md:py-6 pb-10">
        <div className="glass flex items-center justify-between rounded-[24px] px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-300 via-teal-300 to-violet-400 text-slate-950">
              <span className="text-base font-black">IO</span>
            </div>
            <div>
              <h1 className="hero-title text-lg font-semibold tracking-tight md:text-xl">ImageOS</h1>
              <p className="text-sm text-slate-400">A calm image workspace for fast batch work.</p>
            </div>
          </div>
          <div className="hidden gap-2 md:flex">
            <Link href="/workspace" className="btn secondary">Workspace</Link>
            <Link href="/studio" className="btn secondary">Studio</Link>
            <Link href="/pricing" className="btn ghost">Pricing</Link>
          </div>
        </div>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="card p-6 md:p-8">
            <div className="badge pro">Minimal, batch-first, welcoming</div>
            <h2 className="hero-title mt-5 max-w-2xl text-4xl font-semibold tracking-tight md:text-6xl">
              Image tools, but calmer.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
              One place for uploads, recipes, and clean exports — without the clutter.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/workspace" className="btn primary">Open workspace</Link>
              <Link href="/library" className="btn secondary">Recipes</Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-2">
              {quickPoints.map((item) => (
                <span key={item} className="pill">{item}</span>
              ))}
            </div>
          </div>

          <div className="card p-6 md:p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Flow</p>
            <div className="mt-4 space-y-3">
              {[["1", "Studio"], ["2", "Workspace"], ["3", "Export"]].map(([n, t]) => (
                <div key={t} className="flex items-center gap-4 rounded-[20px] border border-white/5 bg-slate-950/45 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-sm font-semibold text-slate-200">{n}</div>
                  <div>
                    <p className="font-semibold text-slate-100">{t}</p>
                    <p className="text-sm text-slate-400">Simple and quick.</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-3">
          {[["Workspace", "Batch edits"], ["Studio", "Brand taste"], ["Library", "Saved recipes"]].map(([title, body]) => (
            <div key={title} className="card p-5">
              <p className="text-sm font-semibold text-slate-100">{title}</p>
              <p className="mt-1 text-sm text-slate-400">{body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}

