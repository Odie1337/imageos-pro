"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Recipe, ToolName, WorkspaceSettings } from "@/lib/image-toolkit";

type CampaignMode = "social-launch" | "ecommerce-drop" | "product-docs" | "app-launch";

type CampaignPreset = {
  id: CampaignMode;
  title: string;
  subtitle: string;
  tone: string;
  outputs: Array<{ name: string; size: string; use: string }>;
  accent: string;
  background: string;
};

type StudioPlan = {
  brandName: string;
  tagline: string;
  campaign: CampaignMode;
  accent: string;
  background: string;
  fontStyle: string;
  notes: string;
  outputs: Array<{ name: string; size: string; use: string }>;
};

const CAMPAIGNS: CampaignPreset[] = [
  {
    id: "social-launch",
    title: "Social Launch",
    subtitle: "Launch posts, story cards, and a clean image system for marketing teams.",
    tone: "Sharp, energetic, high-contrast",
    accent: "#34d399",
    background: "#08111c",
    outputs: [
      { name: "Instagram Square", size: "1080×1080", use: "feed post" },
      { name: "Instagram Story", size: "1080×1920", use: "story / reel cover" },
      { name: "X Card", size: "1600×900", use: "tweet preview" },
      { name: "LinkedIn Hero", size: "1584×396", use: "company banner" },
    ],
  },
  {
    id: "ecommerce-drop",
    title: "E-commerce Drop",
    subtitle: "Launch a product line with marketplace-ready crops and compressed assets.",
    tone: "Clean, conversion-focused, premium retail",
    accent: "#f59e0b",
    background: "#120f0a",
    outputs: [
      { name: "Marketplace Square", size: "1024×1024", use: "product listing" },
      { name: "Hero Banner", size: "1600×900", use: "storefront hero" },
      { name: "Detail Crop", size: "1400×1400", use: "close-up feature" },
      { name: "Promo Story", size: "1080×1920", use: "limited offer" },
    ],
  },
  {
    id: "product-docs",
    title: "Product Docs",
    subtitle: "Docs art, changelog visuals, feature diagrams, and UI story cards.",
    tone: "Technical, precise, trustworthy",
    accent: "#8b5cf6",
    background: "#0d1020",
    outputs: [
      { name: "Docs Banner", size: "1440×720", use: "tutorial header" },
      { name: "Feature Card", size: "1200×630", use: "release notes" },
      { name: "Diagram", size: "1600×1200", use: "product explainer" },
      { name: "Favicon Pack", size: "512→16", use: "asset family" },
    ],
  },
  {
    id: "app-launch",
    title: "App Launch",
    subtitle: "Screenshots, app store assets, and launch day social imagery.",
    tone: "Sleek, minimal, product-led",
    accent: "#22c55e",
    background: "#071313",
    outputs: [
      { name: "App Store", size: "1242×2688", use: "screenshot full-bleed" },
      { name: "Promo Card", size: "1200×1200", use: "announcement" },
      { name: "X Banner", size: "1500×500", use: "social header" },
      { name: "Feature Grid", size: "2000×1600", use: "launch collage" },
    ],
  },
];

const FONT_STYLES = [
  { label: "Editorial", value: "Inter + Space Grotesk" },
  { label: "Technical", value: "Inter + IBM Plex Mono" },
  { label: "Luxury", value: "Manrope + Cormorant" },
  { label: "Bold Product", value: "Inter + Syne" },
];

function storageKey() {
  return "imageos.studio.plan.v1";
}

function recipeStorageKey() {
  return "imageos.recipes.v1";
}

function plannedCopy(plan: StudioPlan) {
  return `${plan.brandName}\n${plan.tagline}\n${plan.campaign}\n${plan.outputs.map((o) => `${o.name} — ${o.size} (${o.use})`).join("\n")}`;
}

export default function StudioApp() {
  const [brandName, setBrandName] = useState("Northstar Studio");
  const [tagline, setTagline] = useState("Beautiful image systems for teams that ship.");
  const [campaign, setCampaign] = useState<CampaignMode>("social-launch");
  const [accent, setAccent] = useState("#34d399");
  const [background, setBackground] = useState("#08111c");
  const [fontStyle, setFontStyle] = useState(FONT_STYLES[0].value);
  const [notes, setNotes] = useState("Plan the outputs first, then push the recipe into the workspace.");
  const [savedPlan, setSavedPlan] = useState<StudioPlan | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey());
    if (raw) {
      try {
        const plan = JSON.parse(raw) as StudioPlan;
        setSavedPlan(plan);
        setBrandName(plan.brandName);
        setTagline(plan.tagline);
        setCampaign(plan.campaign);
        setAccent(plan.accent);
        setBackground(plan.background);
        setFontStyle(plan.fontStyle);
        setNotes(plan.notes);
      } catch {
        // ignore
      }
    }
    const recipeRaw = window.localStorage.getItem(recipeStorageKey());
    if (recipeRaw) {
      try {
        setRecipes(JSON.parse(recipeRaw) as Recipe[]);
      } catch {
        // ignore
      }
    }
  }, []);

  const activePreset = useMemo(() => CAMPAIGNS.find((item) => item.id === campaign) ?? CAMPAIGNS[0], [campaign]);

  const plan: StudioPlan = useMemo(
    () => ({
      brandName,
      tagline,
      campaign,
      accent,
      background,
      fontStyle,
      notes,
      outputs: activePreset.outputs,
    }),
    [brandName, tagline, campaign, accent, background, fontStyle, notes, activePreset.outputs],
  );

  function savePlan() {
    window.localStorage.setItem(storageKey(), JSON.stringify(plan));
    setSavedPlan(plan);
  }

  async function copyPlan() {
    await navigator.clipboard.writeText(plannedCopy(plan));
  }

  function sendToWorkspace() {
    window.localStorage.setItem(storageKey(), JSON.stringify(plan));
    window.localStorage.setItem("imageos.workspace.handback.v1", JSON.stringify(plan));
    window.location.href = "/workspace";
  }

  return (
    <div className="shell">
      <div className="container py-5 md:py-6">
        <div className="glass flex flex-col gap-4 rounded-[28px] px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-400 via-emerald-300 to-cyan-300 text-slate-950">
                <span className="text-lg font-black">CS</span>
              </div>
              <div>
                <h1 className="hero-title text-xl font-semibold tracking-tight md:text-2xl">Campaign Studio</h1>
                <p className="mt-1 text-sm text-slate-400">Build the output plan before the edit. This is where ImageOS becomes a system.</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/workspace" className="btn secondary">Workspace</Link>
            <Link href="/library" className="btn secondary">Library</Link>
            <button className="btn primary" onClick={sendToWorkspace}>Send to workspace</button>
          </div>
        </div>
      </div>

      <main className="container pb-10">
        <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
          <section className="card p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="badge pro">Unique workflow layer</div>
                <h2 className="hero-title mt-4 text-3xl font-semibold tracking-tight md:text-5xl">Brand kit + output matrix + campaign recipe.</h2>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400 md:text-base">
                  Instead of editing one image at a time, define the brand once, choose a campaign shape, and generate a clear output plan for the workspace.
                </p>
              </div>
              <div className="rounded-[24px] border border-white/5 bg-slate-950/45 p-4 text-sm text-slate-300">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Active workflow</p>
                <p className="mt-2 font-semibold text-slate-100">{activePreset.title}</p>
                <p className="mt-1 text-sm text-slate-400">{activePreset.tone}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-500">Brand name</span>
                <input className="text-input px-4 py-3 text-sm" value={brandName} onChange={(e) => setBrandName(e.target.value)} />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-500">Tone line</span>
                <input className="text-input px-4 py-3 text-sm" value={tagline} onChange={(e) => setTagline(e.target.value)} />
              </label>
              <label className="block lg:col-span-2">
                <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-500">Campaign type</span>
                <div className="grid gap-3 md:grid-cols-2">
                  {CAMPAIGNS.map((item) => (
                    <button
                      key={item.id}
                      className={`rounded-[22px] border p-4 text-left transition ${campaign === item.id ? "border-emerald-400/30 bg-emerald-400/10" : "border-white/5 bg-slate-950/45 hover:border-white/10"}`}
                      onClick={() => {
                        setCampaign(item.id);
                        setAccent(item.accent);
                        setBackground(item.background);
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-slate-100">{item.title}</p>
                        <span className="badge">{item.outputs.length} outputs</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-400">{item.subtitle}</p>
                    </button>
                  ))}
                </div>
              </label>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
              <div className="rounded-[24px] border border-white/5 bg-slate-950/45 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">Output matrix</p>
                    <p className="text-xs text-slate-400">The exact sizes you need before editing even starts.</p>
                  </div>
                  <span className="badge">Auto-generated</span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {plan.outputs.map((output) => (
                    <div key={output.name} className="rounded-[20px] border border-white/5 bg-slate-900/55 p-4">
                      <p className="font-semibold text-slate-100">{output.name}</p>
                      <p className="mt-1 text-sm text-slate-400">{output.size}</p>
                      <p className="mt-2 text-xs text-emerald-200">{output.use}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-white/5 bg-slate-950/45 p-4">
                <p className="text-sm font-semibold text-slate-100">Style DNA</p>
                <p className="mt-1 text-xs text-slate-400">A visual system that feels deliberate, not templated.</p>
                <div className="mt-4 rounded-[24px] border border-white/5 p-4" style={{ background: `linear-gradient(135deg, ${background}, rgba(15, 23, 42, 0.92))` }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-300/70">Preview</p>
                      <h3 className="hero-title mt-2 text-2xl font-semibold text-white">{brandName}</h3>
                    </div>
                    <div className="h-14 w-14 rounded-2xl border border-white/10" style={{ background: accent }} />
                  </div>
                  <p className="mt-4 max-w-xs text-sm text-slate-200/80">{tagline}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="badge">{activePreset.tone}</span>
                    <span className="badge">{fontStyle}</span>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-500">Accent color</span>
                    <input className="text-input h-12 px-2 py-1" type="color" value={accent} onChange={(e) => setAccent(e.target.value)} />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-500">Background</span>
                    <input className="text-input h-12 px-2 py-1" type="color" value={background} onChange={(e) => setBackground(e.target.value)} />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-500">Typography vibe</span>
                    <select className="select-input px-4 py-3 text-sm" value={fontStyle} onChange={(e) => setFontStyle(e.target.value)}>
                      {FONT_STYLES.map((font) => (
                        <option key={font.value} value={font.value}>{font.label} — {font.value}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            </div>
          </section>

          <aside className="card p-6 md:p-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="section-title text-2xl font-semibold">Campaign controls</h3>
                <p className="mt-2 text-sm text-slate-400">Save the plan, hand it off to the workspace, or use it as a repeatable recipe starting point.</p>
              </div>
              <span className="badge pro">Studio</span>
            </div>

            <div className="mt-5 space-y-4 rounded-[24px] border border-white/5 bg-slate-950/45 p-4">
              <label className="block">
                <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-500">Notes</span>
                <textarea className="text-input min-h-[110px] px-4 py-3 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button className="btn primary" onClick={savePlan}>Save plan</button>
                <button className="btn secondary" onClick={copyPlan}>Copy brief</button>
              </div>
              <button className="btn secondary w-full" onClick={sendToWorkspace}>Send to workspace</button>
            </div>

            <div className="mt-5 rounded-[24px] border border-white/5 bg-slate-950/45 p-4">
              <p className="text-sm font-semibold text-slate-100">Saved plan</p>
              {savedPlan ? (
                <div className="mt-3 space-y-2 text-sm text-slate-400">
                  <p><span className="text-slate-200">Brand:</span> {savedPlan.brandName}</p>
                  <p><span className="text-slate-200">Campaign:</span> {savedPlan.campaign}</p>
                  <p><span className="text-slate-200">Font:</span> {savedPlan.fontStyle}</p>
                  <p><span className="text-slate-200">Accent:</span> {savedPlan.accent}</p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">Nothing saved yet. Save the current plan to reuse it later.</p>
              )}
            </div>

            <div className="mt-5 rounded-[24px] border border-white/5 bg-slate-950/45 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-100">Recipe bridge</p>
                <span className="badge">{recipes.length} local recipes</span>
              </div>
              <div className="mt-3 space-y-2">
                {recipes.length === 0 ? (
                  <p className="text-sm text-slate-500">No saved recipes yet. The library will fill as you work.</p>
                ) : (
                  recipes.slice(0, 4).map((recipe) => (
                    <div key={recipe.id} className="rounded-[18px] border border-white/5 bg-slate-900/45 px-4 py-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-slate-100">{recipe.name}</span>
                        <span className="text-xs text-slate-500">{recipe.tool}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{new Date(recipe.createdAt).toLocaleDateString()}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
