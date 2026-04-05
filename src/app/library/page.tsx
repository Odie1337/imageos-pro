"use client";

import Link from "next/link";
import { useState } from "react";
import type { Recipe } from "@/lib/image-toolkit";

export default function LibraryPage() {
  const [recipes] = useState<Recipe[]>(() => {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem("imageos.recipes.v1");
    if (!raw) return [];
    try {
      return JSON.parse(raw) as Recipe[];
    } catch {
      return [];
    }
  });

  return (
    <div className="shell">
      <div className="container py-5 md:py-6">
        <div className="glass flex items-center justify-between rounded-[28px] px-4 py-4 md:px-6">
          <div>
            <h1 className="hero-title text-xl font-semibold md:text-2xl">Recipe Library</h1>
            <p className="mt-1 text-sm text-slate-400">Saved locally, applied instantly, designed for repeat use.</p>
          </div>
          <Link href="/workspace" className="btn secondary">Back to workspace</Link>
        </div>
      </div>

      <main className="container pb-10">
        <div className="card p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {recipes.length === 0 ? (
              <div className="rounded-[22px] border border-white/5 bg-slate-950/45 p-5 text-sm text-slate-400 md:col-span-2 xl:col-span-3">
                No recipes yet. Save one in the workspace and it will appear here.
              </div>
            ) : (
              recipes.map((recipe) => (
                <div key={recipe.id} className="rounded-[22px] border border-white/5 bg-slate-950/45 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-slate-100">{recipe.name}</h3>
                    <span className="badge">{recipe.tool}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">{new Date(recipe.createdAt).toLocaleString()}</p>
                  <p className="mt-4 text-xs text-slate-500">Stored in local browser storage.</p>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
