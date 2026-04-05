import Link from "next/link";

export default function PricingPage() {
  return (
    <div className="shell">
      <div className="container py-5 md:py-6">
        <div className="glass flex items-center justify-between rounded-[28px] px-4 py-4 md:px-6">
          <div>
            <h1 className="hero-title text-xl font-semibold md:text-2xl">ImageOS Pricing</h1>
            <p className="mt-1 text-sm text-slate-400">Built to turn a free editor into a paid workflow product.</p>
          </div>
          <Link href="/workspace" className="btn secondary">Back to workspace</Link>
        </div>
      </div>

      <main className="container pb-10">
        <div className="grid gap-6 lg:grid-cols-3">
          {[
            {
              name: "Free",
              price: "$0",
              points: ["Single image editing", "Core resize/compress/convert", "Local processing"],
            },
            {
              name: "Pro",
              price: "$12/mo",
              points: ["Batch ZIP export", "Saved recipes", "Export history", "Watermark control"],
              popular: true,
            },
            {
              name: "Lifetime",
              price: "$79",
              points: ["Everything in Pro", "One-time purchase", "Best for power users"],
            },
          ].map((plan) => (
            <div key={plan.name} className="card p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="section-title text-2xl font-semibold">{plan.name}</h2>
                {plan.popular && <span className="badge">Most popular</span>}
              </div>
              <p className="mt-4 text-4xl font-semibold text-slate-50">{plan.price}</p>
              <ul className="mt-5 space-y-3 text-sm text-slate-400">
                {plan.points.map((point) => (
                  <li key={point}>• {point}</li>
                ))}
              </ul>
              <button className={`btn mt-6 w-full ${plan.name === "Pro" ? "primary" : "secondary"}`}>Choose {plan.name}</button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
