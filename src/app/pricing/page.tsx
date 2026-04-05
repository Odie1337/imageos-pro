import Link from "next/link";

export default function PricingPage() {
  return (
    <div className="shell">
      <main className="container py-5 md:py-6 pb-10">
        <div className="glass flex items-center justify-between rounded-[24px] px-4 py-4 md:px-6">
          <div>
            <h1 className="hero-title text-lg font-semibold md:text-xl">Pricing</h1>
            <p className="text-sm text-slate-400">Simple plans for a workflow product.</p>
          </div>
          <Link href="/workspace" className="btn secondary">Workspace</Link>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {[
            { name: "Free", price: "$0", points: ["Core tools", "Local edits"] },
            { name: "Pro", price: "$12/mo", points: ["Batch ZIP", "Recipes", "History"], popular: true },
            { name: "Lifetime", price: "$79", points: ["All Pro features", "One-time buy"] },
          ].map((plan) => (
            <div key={plan.name} className="card p-5 md:p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="section-title text-xl font-semibold">{plan.name}</h2>
                {plan.popular && <span className="badge">Popular</span>}
              </div>
              <p className="mt-4 text-3xl font-semibold text-slate-50">{plan.price}</p>
              <ul className="mt-5 space-y-2 text-sm text-slate-400">
                {plan.points.map((point) => (
                  <li key={point}>• {point}</li>
                ))}
              </ul>
              <button className={`btn mt-6 w-full ${plan.name === "Pro" ? "primary" : "secondary"}`}>Choose</button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
