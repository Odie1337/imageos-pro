import Link from "next/link";

const highlights = [
  {
    title: "Batch-first by design",
    body: "Drop folders, select what matters, and export the whole job in one shot.",
  },
  {
    title: "Recipes that stick",
    body: "Save repeatable edits as recipes so the next batch is one click away.",
  },
  {
    title: "Local-first processing",
    body: "Images are processed in the browser for speed, privacy, and lower backend cost.",
  },
  {
    title: "Built to monetize",
    body: "Free entry point with Pro unlocks for batch ZIP, export history, and branded workspaces.",
  },
];

const proof = [
  "Resize, compress, convert, crop, and adjust",
  "Before/after compare in compress mode",
  "Saved recipe library",
  "Workspace + export history",
  "ZIP batch export",
  "Pro upgrade surface",
];

export default function Home() {
  return (
    <div className="shell">
      <div className="container py-5 md:py-6">
        <div className="glass flex flex-col gap-4 rounded-[28px] px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-300 via-teal-300 to-violet-400 text-slate-950">
                <span className="text-lg font-black">IO</span>
              </div>
              <div>
                <h1 className="hero-title text-xl font-semibold tracking-tight md:text-2xl">ImageOS</h1>
                <p className="mt-1 text-sm text-slate-400">A premium image workspace for people who work in batches, not one upload at a time.</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Link href="/workspace" className="btn primary">
              Open workspace
            </Link>
            <Link href="/pricing" className="btn secondary">
              Pricing
            </Link>
          </div>
        </div>
      </div>

      <main className="container pb-10">
        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="card overflow-hidden p-6 md:p-8">
            <div className="badge pro">Pro workflow platform</div>
            <h2 className="hero-title mt-5 max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
              The image tool people keep open all day.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
              ImageOS turns one-off edits into reusable workflows. It feels like a product, not a canvas toy — with batch processing, recipes, history, and a workspace built for repeat use.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/workspace" className="btn primary">
                Start editing
              </Link>
              <Link href="/library" className="btn secondary">
                View recipe library
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-2">
              {proof.map((item) => (
                <span key={item} className="pill">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="card p-6 md:p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Why it converts</p>
            <div className="mt-4 space-y-4">
              {highlights.map((item) => (
                <div key={item.title} className="rounded-[22px] border border-white/5 bg-slate-950/45 p-4">
                  <h3 className="font-semibold text-slate-100">{item.title}</h3>
                  <p className="mt-1 text-sm text-slate-400">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="card p-6 lg:col-span-2">
            <h3 className="section-title text-2xl font-semibold">What makes it different</h3>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
              The niche is crowded with single-purpose tools. This one is built around a workflow system: queue files, save recipes, export bundles, and return tomorrow with the same setup ready to go.
            </p>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {[
                ["Workspace", "A real home screen for active jobs, not just a blank editor."],
                ["Library", "Store reusable image recipes and reuse them across projects."],
                ["Batch ZIP", "One export for many images and many formats."],
                ["Upgrade surface", "Pro upsells placed naturally inside the workflow."],
              ].map(([title, body]) => (
                <div key={title} className="rounded-[22px] border border-white/5 bg-slate-950/45 p-4">
                  <p className="font-semibold text-slate-100">{title}</p>
                  <p className="mt-1 text-sm text-slate-400">{body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <h3 className="section-title text-2xl font-semibold">Ready to use</h3>
            <p className="mt-3 text-sm text-slate-400">Open the editor and start building your batch workflow.</p>
            <div className="mt-5 space-y-3">
              <Link href="/workspace" className="btn primary w-full">
                Open editor
              </Link>
              <Link href="/pricing" className="btn secondary w-full">
                See plans
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
