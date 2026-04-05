"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const palettes = [
  { name: "Obsidian Mint", bg: "#05070c", surface: "#0f172a", accent: "#34d399", accent2: "#8b5cf6", text: "#f8fafc", font: "Space Grotesk" },
  { name: "Editorial Gold", bg: "#0f1115", surface: "#191d24", accent: "#fbbf24", accent2: "#fb7185", text: "#fff7ed", font: "Inter" },
  { name: "Clinical Blue", bg: "#07111f", surface: "#10233d", accent: "#38bdf8", accent2: "#c084fc", text: "#eff6ff", font: "IBM Plex Sans" },
  { name: "Monochrome Luxe", bg: "#070707", surface: "#141414", accent: "#f5f5f5", accent2: "#a3a3a3", text: "#ffffff", font: "Space Grotesk" },
];

const moodCards = [
  ["Premium", "tight typography, high contrast, restrained accents"],
  ["Creator", "friendly gradients, energetic contrast, social-first"],
  ["Minimal", "quiet surfaces, disciplined spacing, low noise"],
  ["Builder", "technical clarity, fast workflows, product feel"],
];

export default function StudioPage() {
  const [brandName, setBrandName] = useState("Northwind Labs");
  const [campaign, setCampaign] = useState("Spring launch pack");
  const [fontStyle, setFontStyle] = useState("Space Grotesk");
  const [selectedPalette, setSelectedPalette] = useState(palettes[0]);
  const [tagline, setTagline] = useState("Polished image workflows for modern teams");
  const [campaignAngle, setCampaignAngle] = useState("Product launch assets, social crops, and compressed delivery.");

  const preview = useMemo(
    () => ({
      bg: selectedPalette.bg,
      surface: selectedPalette.surface,
      accent: selectedPalette.accent,
      accent2: selectedPalette.accent2,
      text: selectedPalette.text,
    }),
    [selectedPalette],
  );

  function handoff() {
    const payload = {
      brandName,
      campaign,
      fontStyle,
      palette: selectedPalette.name,
      tagline,
      campaignAngle,
    };
    window.localStorage.setItem("imageos.workspace.handback.v1", JSON.stringify(payload));
    window.location.href = "/workspace";
  }

  return (
    <div className="shell">
      <div className="container py-5 md:py-6">
        <div className="glass flex flex-col gap-4 rounded-[28px] px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/80">Campaign Studio</p>
            <h1 className="hero-title mt-1 text-2xl font-semibold md:text-3xl">Set the taste before the batch begins.</h1>
            <p className="mt-1 text-sm text-slate-400">This is where ImageOS gets personality: palette, type, mood, and project framing.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/workspace" className="btn secondary">Workspace</Link>
            <button onClick={handoff} className="btn primary">Send to workspace</button>
          </div>
        </div>
      </div>

      <main className="container pb-10">
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="card p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Brand kit</p>
                <h2 className="section-title text-2xl font-semibold">Build a recognizable visual identity.</h2>
              </div>
              <span className="badge pro">Workflow personality</span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs text-slate-400">Brand name</span>
                <input className="text-input px-4 py-3 text-sm" value={brandName} onChange={(e) => setBrandName(e.target.value)} />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs text-slate-400">Campaign</span>
                <input className="text-input px-4 py-3 text-sm" value={campaign} onChange={(e) => setCampaign(e.target.value)} />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-xs text-slate-400">Tagline</span>
                <input className="text-input px-4 py-3 text-sm" value={tagline} onChange={(e) => setTagline(e.target.value)} />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-xs text-slate-400">Campaign angle</span>
                <textarea className="text-input min-h-[110px] px-4 py-3 text-sm" value={campaignAngle} onChange={(e) => setCampaignAngle(e.target.value)} />
              </label>
            </div>

            <div className="mt-8">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-100">Palette presets</p>
                  <p className="text-xs text-slate-400">Pick a visual tone that feels intentional, not generic.</p>
                </div>
                <span className="badge">{selectedPalette.name}</span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {palettes.map((palette) => (
                  <button
                    key={palette.name}
                    onClick={() => setSelectedPalette(palette)}
                    className={`rounded-[24px] border p-3 text-left transition ${selectedPalette.name === palette.name ? "border-emerald-400/30 bg-emerald-400/8" : "border-white/5 bg-slate-950/45 hover:border-white/10"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-100">{palette.name}</p>
                      <span className="h-4 w-4 rounded-full border border-white/10" style={{ background: palette.accent }} />
                    </div>
                    <div className="mt-3 flex gap-2">
                      <span className="h-8 flex-1 rounded-lg" style={{ background: palette.bg }} />
                      <span className="h-8 flex-1 rounded-lg" style={{ background: palette.surface }} />
                      <span className="h-8 flex-1 rounded-lg" style={{ background: palette.accent }} />
                      <span className="h-8 flex-1 rounded-lg" style={{ background: palette.accent2 }} />
                    </div>
                    <p className="mt-3 text-xs text-slate-400">{palette.font} · {palette.text}</p>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="card p-6 md:p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Live preview</p>
            <div
              className="mt-4 overflow-hidden rounded-[28px] border border-white/5"
              style={{ background: preview.bg, color: preview.text }}
            >
              <div className="p-6" style={{ background: `linear-gradient(135deg, ${preview.surface}, ${preview.bg})` }}>
                <div className="flex items-center justify-between gap-3 text-sm opacity-90">
                  <span>{brandName}</span>
                  <span style={{ color: preview.accent }}>Pro system</span>
                </div>
                <h3 className="mt-8 text-4xl font-semibold tracking-tight" style={{ fontFamily: `var(--font-display), ${fontStyle}, sans-serif` }}>
                  {campaign}
                </h3>
                <p className="mt-4 max-w-md text-sm leading-6 opacity-80">{tagline}</p>
                <div className="mt-6 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border px-3 py-1" style={{ borderColor: preview.accent, color: preview.accent }}>Batch-ready</span>
                  <span className="rounded-full border px-3 py-1" style={{ borderColor: preview.accent2, color: preview.accent2 }}>Recipe system</span>
                  <span className="rounded-full border px-3 py-1" style={{ borderColor: "rgba(255,255,255,0.18)", color: preview.text }}>Workspace handoff</span>
                </div>
              </div>
              <div className="border-t border-white/10 p-6" style={{ background: "rgba(255,255,255,0.02)" }}>
                <p className="text-sm opacity-85">{campaignAngle}</p>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <p className="text-xs opacity-70">Palette</p>
                    <p className="mt-1 text-sm font-semibold">{selectedPalette.name}</p>
                  </div>
                  <div className="rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <p className="text-xs opacity-70">Type</p>
                    <p className="mt-1 text-sm font-semibold">{fontStyle}</p>
                  </div>
                  <div className="rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <p className="text-xs opacity-70">Mode</p>
                    <p className="mt-1 text-sm font-semibold">Batch export</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {moodCards.map(([title, body]) => (
                <button
                  key={title}
                  onClick={() => {
                    const chosen = palettes[(title.length + body.length) % palettes.length];
                    setSelectedPalette(chosen);
                    setFontStyle(chosen.font);
                  }}
                  className="rounded-[22px] border border-white/5 bg-slate-950/45 p-4 text-left transition hover:border-emerald-400/20"
                >
                  <p className="text-sm font-semibold text-slate-100">{title}</p>
                  <p className="mt-1 text-xs text-slate-400">{body}</p>
                </button>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                className="btn primary"
                onClick={() => {
                  window.localStorage.setItem(
                    "imageos.workspace.handback.v1",
                    JSON.stringify({
                      brandName,
                      campaign,
                      fontStyle,
                      palette: selectedPalette.name,
                      tagline,
                      campaignAngle,
                    }),
                  );
                  window.location.href = "/workspace";
                }}
              >
                Send to workspace
              </button>
              <Link href="/pricing" className="btn secondary">Pro pricing</Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
