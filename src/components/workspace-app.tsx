"use client";

import Link from "next/link";
import JSZip from "jszip";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_SETTINGS,
  PRESETS,
  RATIO_PRESETS,
  cloneRecipe,
  clamp,
  deepCloneSettings,
  fileToImage,
  fitsImageFormat,
  formatBytes,
  getMimeForTool,
  getRotatedBounds,
  processImage,
  uid,
  type AdjustSettings,
  type OutputFormat,
  type QueueItem,
  type Recipe,
  type ToolName,
  type WorkspaceSettings,
} from "@/lib/image-toolkit";

interface WorkspaceQueueItem extends QueueItem {
  image?: HTMLImageElement;
}

type Toast = { id: string; title: string; body: string };

type CropDrag =
  | null
  | { mode: "move" }
  | { mode: "resize"; corner: "nw" | "ne" | "sw" | "se" };

const TOOL_INFO: Record<ToolName, { title: string; blurb: string }> = {
  resize: { title: "Resize", blurb: "Precision sizing with ratio lock, presets, and scale-based output." },
  compress: { title: "Compress", blurb: "Shrink files hard while keeping the image looking clean." },
  convert: { title: "Convert", blurb: "PNG, JPEG, WebP, AVIF with useful per-format controls." },
  crop: { title: "Crop", blurb: "Crop with a visible box, ratio presets, and fine positioning." },
  adjust: { title: "Adjust", blurb: "Tone, color, sharpen, shadows, highlights, and watermarking." },
};

const NAV = ["workspace", "library", "pricing"] as const;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function fileBaseName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "");
}

function extForFormat(format: OutputFormat) {
  switch (format) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/avif":
      return "avif";
  }
}

function recipeStorageKey() {
  return "imageos.recipes.v1";
}

function settingsStorageKey() {
  return "imageos.settings.v1";
}

function workspaceStorageKey() {
  return "imageos.workspace.v1";
}

function makeSyntheticDemo() {
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 1000;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create demo context");

  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grad.addColorStop(0, "#09111f");
  grad.addColorStop(0.52, "#14304f");
  grad.addColorStop(1, "#0c1b19");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = `rgba(${40 + i * 18}, ${220 - i * 14}, ${180 + i * 4}, 0.16)`;
    ctx.beginPath();
    ctx.arc(230 + i * 140, 180 + (i % 2) * 60, 90 + i * 5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  for (let i = 0; i < 120; i++) {
    ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 2, 2);
  }

  const gx = ctx.createLinearGradient(0, 0, canvas.width, 0);
  gx.addColorStop(0, "rgba(52,211,153,0.0)");
  gx.addColorStop(0.5, "rgba(52,211,153,0.8)");
  gx.addColorStop(1, "rgba(52,211,153,0.0)");
  ctx.fillStyle = gx;
  ctx.fillRect(0, 640, canvas.width, 8);

  ctx.fillStyle = "#e2e8f0";
  ctx.font = '700 84px var(--font-display), sans-serif';
  ctx.fillText("ImageOS", 92, 156);
  ctx.font = '500 32px var(--font-inter), sans-serif';
  ctx.fillStyle = "rgba(226,232,240,0.82)";
  ctx.fillText("Batch editing for people who ship", 96, 218);

  ctx.fillStyle = "rgba(8, 16, 32, 0.76)";
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1;
  ctx.roundRect(88, 286, 570, 230, 28);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = '600 28px var(--font-inter), sans-serif';
  ctx.fillText("A tool that feels like a product.", 118, 350);
  ctx.font = '400 18px var(--font-inter), sans-serif';
  ctx.fillStyle = "rgba(226,232,240,0.75)";
  ctx.fillText("Resize, compress, convert, crop, and export in one place.", 118, 390);
  ctx.fillText("Made for batch workflows, recipes, and repeatable exports.", 118, 423);

  return canvas.toDataURL("image/png");
}

function getContainRect(containerW: number, containerH: number, imgW: number, imgH: number) {
  const imgRatio = imgW / imgH;
  const containerRatio = containerW / containerH;
  if (imgRatio > containerRatio) {
    const width = containerW;
    const height = containerW / imgRatio;
    return { x: 0, y: (containerH - height) / 2, width, height };
  }
  const height = containerH;
  const width = containerH * imgRatio;
  return { x: (containerW - width) / 2, y: 0, width, height };
}

function imageCropBox(settings: WorkspaceSettings["crop"], imageWidth: number, imageHeight: number) {
  const ratio = RATIO_PRESETS[settings.ratio];
  const width = clamp(settings.width || imageWidth, 1, imageWidth);
  let height = clamp(settings.height || imageHeight, 1, imageHeight);
  let x = clamp(settings.x, 0, Math.max(0, imageWidth - width));
  const y = clamp(settings.y, 0, Math.max(0, imageHeight - height));
  if (ratio) {
    if (width / height > ratio) {
      height = Math.round(width / ratio);
    } else {
      const nextWidth = Math.round(height * ratio);
      x = clamp(x, 0, Math.max(0, imageWidth - nextWidth));
    }
  }
  return { x, y, width, height };
}

function settingSummary(settings: WorkspaceSettings, tool: ToolName) {
  switch (tool) {
    case "resize":
      return `${settings.resize.width}×${settings.resize.height} • ${settings.resize.method}`;
    case "compress":
      return `${settings.compress.quality}% • ${settings.compress.autoFormat ? "auto format" : "fixed"}`;
    case "convert":
      return `${settings.convert.format.replace("image/", "").toUpperCase()} • q${settings.convert.jpegQuality}`;
    case "crop":
      return `${settings.crop.ratio} • rot ${settings.crop.rotation}°`;
    case "adjust":
      return `b${settings.adjust.brightness} c${settings.adjust.contrast} s${settings.adjust.saturation}`;
  }
}

export default function WorkspaceApp() {
  const [activeNav, setActiveNav] = useState<(typeof NAV)[number]>("workspace");
  const [tool, setTool] = useState<ToolName>("resize");
  const [settings, setSettings] = useState<WorkspaceSettings>(() => deepCloneSettings(DEFAULT_SETTINGS));
  const [queue, setQueue] = useState<WorkspaceQueueItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [projectName, setProjectName] = useState("Brand campaign batch");
  const [studioHandoff, setStudioHandoff] = useState<{ brandName?: string; campaign?: string; fontStyle?: string } | null>(null);
  const [recipeName, setRecipeName] = useState("Hero export recipe");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [processing, setProcessing] = useState(false);
  const [compareSplit, setCompareSplit] = useState(50);
  const [history, setHistory] = useState<WorkspaceSettings[]>([deepCloneSettings(DEFAULT_SETTINGS)]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [cropDrag, setCropDrag] = useState<CropDrag>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [activeBlobUrl, setActiveBlobUrl] = useState<string | null>(null);
  const [settingsReady, setSettingsReady] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const previewWrapRef = useRef<HTMLDivElement | null>(null);
  const cropOverlayRef = useRef<HTMLDivElement | null>(null);
  const processTimer = useRef<number | null>(null);
  const skipHistory = useRef(false);
  const activeItem = useMemo(() => queue.find((item) => item.id === activeId) ?? null, [queue, activeId]);
  const selectedCount = useMemo(() => queue.filter((item) => item.selected).length, [queue]);
  const activeToolInfo = TOOL_INFO[tool];

  useEffect(() => {
    const saved = window.localStorage.getItem(recipeStorageKey());
    if (saved) {
      try {
        setRecipes(JSON.parse(saved));
      } catch {
        // ignore
      }
    }

    const savedSettings = window.localStorage.getItem(settingsStorageKey());
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings) as WorkspaceSettings;
        setSettings({ ...deepCloneSettings(DEFAULT_SETTINGS), ...parsed });
      } catch {
        // ignore
      }
    }

    const savedWorkspace = window.localStorage.getItem(workspaceStorageKey());
    if (savedWorkspace) {
      try {
        const parsed = JSON.parse(savedWorkspace) as { projectName?: string; recipeName?: string };
        if (parsed.projectName) setProjectName(parsed.projectName);
        if (parsed.recipeName) setRecipeName(parsed.recipeName);
      } catch {
        // ignore
      }
    }

    const handoff = window.localStorage.getItem("imageos.workspace.handback.v1");
    if (handoff) {
      try {
        const parsed = JSON.parse(handoff) as { brandName?: string; campaign?: string; fontStyle?: string };
        setStudioHandoff(parsed);
        if (parsed.brandName || parsed.campaign) {
          setProjectName(`${parsed.brandName ?? "Studio"} • ${parsed.campaign ?? "campaign"}`);
        }
      } catch {
        // ignore
      }
    }

    setSettingsReady(true);
  }, []);

  useEffect(() => {
    if (!settingsReady) return;
    window.localStorage.setItem(settingsStorageKey(), JSON.stringify(settings));
  }, [settings, settingsReady]);

  useEffect(() => {
    if (!settingsReady) return;
    window.localStorage.setItem(workspaceStorageKey(), JSON.stringify({ projectName, recipeName }));
  }, [projectName, recipeName, settingsReady]);

  useEffect(() => {
    window.localStorage.setItem(recipeStorageKey(), JSON.stringify(recipes));
  }, [recipes]);

  useEffect(() => {
    return () => {
      if (processTimer.current) window.clearTimeout(processTimer.current);
      if (activeBlobUrl) URL.revokeObjectURL(activeBlobUrl);
      queue.forEach((item) => {
        URL.revokeObjectURL(item.url);
        if (item.processedUrl) URL.revokeObjectURL(item.processedUrl);
      });
    };
  }, [activeBlobUrl, queue]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!activeItem) return;
    if (processTimer.current) window.clearTimeout(processTimer.current);
    processTimer.current = window.setTimeout(() => {
      void runProcess();
    }, 120);
  }, [settings, activeItem?.id, tool]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "o") {
        ev.preventDefault();
        fileInputRef.current?.click();
      }
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "s") {
        ev.preventDefault();
        void downloadActive();
      }
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "r") {
        ev.preventDefault();
        resetTool();
      }
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z" && !ev.shiftKey) {
        ev.preventDefault();
        undo();
      }
      if ((ev.ctrlKey || ev.metaKey) && (ev.key.toLowerCase() === "z" && ev.shiftKey)) {
        ev.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [historyIndex, history]);

  useEffect(() => {
    if (!activeItem || !imageRef.current || tool !== "crop") return;
    const img = imageRef.current;
    const cropSize = getRotatedBounds(activeItem.width, activeItem.height, settings.crop.rotation);
    const onPointerMove = (ev: PointerEvent) => {
      if (!cropDrag) return;
      const rect = img.getBoundingClientRect();
      const naturalW = cropSize.width;
      const naturalH = cropSize.height;
      const px = clamp(((ev.clientX - rect.left) / rect.width) * naturalW, 0, naturalW);
      const py = clamp(((ev.clientY - rect.top) / rect.height) * naturalH, 0, naturalH);
      setSettings((prev) => {
        const next = deepCloneSettings(prev);
        const crop = next.crop;
        if (cropDrag.mode === "move") {
          crop.x = clamp(px - crop.width / 2, 0, Math.max(0, naturalW - crop.width));
          crop.y = clamp(py - crop.height / 2, 0, Math.max(0, naturalH - crop.height));
        } else {
          const { corner } = cropDrag;
          const minSize = 120;
          if (corner === "nw") {
            crop.x = clamp(px, 0, crop.x + crop.width - minSize);
            crop.y = clamp(py, 0, crop.y + crop.height - minSize);
            crop.width = Math.max(minSize, crop.width + (crop.x - px));
            crop.height = Math.max(minSize, crop.height + (crop.y - py));
          }
          if (corner === "ne") {
            crop.y = clamp(py, 0, crop.y + crop.height - minSize);
            crop.width = Math.max(minSize, px - crop.x);
            crop.height = Math.max(minSize, crop.height + (crop.y - py));
          }
          if (corner === "sw") {
            crop.x = clamp(px, 0, crop.x + crop.width - minSize);
            crop.width = Math.max(minSize, crop.width + (crop.x - px));
            crop.height = Math.max(minSize, py - crop.y);
          }
          if (corner === "se") {
            crop.width = Math.max(minSize, px - crop.x);
            crop.height = Math.max(minSize, py - crop.y);
          }
          crop.x = clamp(crop.x, 0, Math.max(0, naturalW - crop.width));
          crop.y = clamp(crop.y, 0, Math.max(0, naturalH - crop.height));
        }
        return next;
      });
    };
    const onPointerUp = () => setCropDrag(null);

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [cropDrag, activeItem, tool, settings.crop.rotation]);

  function toast(title: string, body: string) {
    const id = uid("toast");
    setToasts((curr) => [...curr, { id, title, body }]);
    window.setTimeout(() => {
      setToasts((curr) => curr.filter((t) => t.id !== id));
    }, 3200);
  }

  function pushHistory(next: WorkspaceSettings) {
    if (skipHistory.current) {
      skipHistory.current = false;
      return;
    }
    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push(deepCloneSettings(next));
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
  }

  function applySettings(updater: (draft: WorkspaceSettings) => void) {
    setSettings((prev) => {
      const next = deepCloneSettings(prev);
      updater(next);
      pushHistory(next);
      return next;
    });
  }

  function undo() {
    if (historyIndex <= 0) return;
    const nextIndex = historyIndex - 1;
    skipHistory.current = true;
    setHistoryIndex(nextIndex);
    setSettings(deepCloneSettings(history[nextIndex]));
    toast("Undo", "Reverted to the previous settings state.");
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    const nextIndex = historyIndex + 1;
    skipHistory.current = true;
    setHistoryIndex(nextIndex);
    setSettings(deepCloneSettings(history[nextIndex]));
    toast("Redo", "Restored the next settings state.");
  }

  async function loadFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter(fitsImageFormat);
    if (!files.length) {
      toast("No images found", "Drop PNG, JPG, WebP, GIF, AVIF, BMP, or HEIC images.");
      return;
    }

    const next: WorkspaceQueueItem[] = [];
    for (const file of files) {
      const { image, url } = await fileToImage(file);
      next.push({
        id: uid("queue"),
        file,
        url,
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
        size: file.size,
        selected: true,
        image,
      });
    }
    setQueue((curr) => {
      const combined = [...curr, ...next];
      if (!activeId && combined.length) setActiveId(combined[0].id);
      if (!activeId && combined.length) setSettings((prev) => ({ ...prev, resize: { ...prev.resize, width: combined[0].width, height: combined[0].height }, crop: { ...prev.crop, width: combined[0].width, height: combined[0].height } }));
      return combined;
    });
    if (!activeId && next[0]) setActiveId(next[0].id);
    toast("Images loaded", `${next.length} image${next.length === 1 ? "" : "s"} ready in the batch queue.`);
  }

  async function loadDemo() {
    const dataUrl = makeSyntheticDemo();
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], "demo-image.png", { type: "image/png" });
    await loadFiles([file]);
  }

  function removeItem(id: string) {
    setQueue((curr) => {
      const item = curr.find((q) => q.id === id);
      if (item) {
        URL.revokeObjectURL(item.url);
        if (item.processedUrl) URL.revokeObjectURL(item.processedUrl);
      }
      const next = curr.filter((q) => q.id !== id);
      if (activeId === id) {
        setActiveId(next[0]?.id ?? null);
      }
      return next;
    });
  }

  function toggleSelected(id: string) {
    setQueue((curr) => curr.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item)));
    setActiveId(id);
  }

  function selectAll(value: boolean) {
    setQueue((curr) => curr.map((item) => ({ ...item, selected: value })));
  }

  function clearQueue() {
    queue.forEach((item) => {
      URL.revokeObjectURL(item.url);
      if (item.processedUrl) URL.revokeObjectURL(item.processedUrl);
    });
    setQueue([]);
    setActiveId(null);
    toast("Queue cleared", "Your workspace is empty.");
  }

  function applyPreset(width: number, height: number, label: string) {
    applySettings((draft) => {
      draft.resize.width = width;
      draft.resize.height = height;
      draft.crop.width = width;
      draft.crop.height = height;
    });
    toast(label, `Preset applied: ${width}×${height}`);
  }

  function setActiveTool(nextTool: ToolName) {
    setTool(nextTool);
    toast(`${TOOL_INFO[nextTool].title} tool`, TOOL_INFO[nextTool].blurb);
  }

  async function runProcess() {
    if (!activeItem) return;
    setProcessing(true);
    try {
      if (activeBlobUrl) URL.revokeObjectURL(activeBlobUrl);
      const result = await processImage(activeItem.file, settings, { baseImage: activeItem.image });
      setActiveBlobUrl(result.url);
      setQueue((curr) =>
        curr.map((item) =>
          item.id === activeItem.id
            ? {
                ...item,
                processedBlob: result.blob,
                processedUrl: result.url,
                processedSize: result.size,
                error: undefined,
                width: item.width,
                height: item.height,
              }
            : item,
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Processing failed";
      setQueue((curr) => curr.map((item) => (item.id === activeItem.id ? { ...item, error: message } : item)));
      toast("Processing error", message);
    } finally {
      setProcessing(false);
    }
  }

  async function downloadActive() {
    if (!activeItem) return;
    if (!activeItem.processedBlob) {
      await runProcess();
      const refreshed = queue.find((item) => item.id === activeItem.id);
      if (refreshed?.processedBlob) {
        const ext = extForFormat(settings.convert.format);
        downloadBlob(refreshed.processedBlob, `${fileBaseName(activeItem.file.name)}.${ext}`);
        toast("Downloaded", `${activeItem.file.name} exported successfully.`);
      }
      return;
    }
    const ext = extForFormat(settings.convert.format);
    downloadBlob(activeItem.processedBlob, `${fileBaseName(activeItem.file.name)}.${ext}`);
    toast("Downloaded", `${activeItem.file.name} exported successfully.`);
  }

  async function exportSelectedZip() {
    const selected = queue.filter((item) => item.selected);
    if (!selected.length) {
      toast("Nothing selected", "Select one or more images to export.");
      return;
    }
    setBatchBusy(true);
    try {
      const zip = new JSZip();
      for (const item of selected) {
        const result = item.processedBlob
          ? { blob: item.processedBlob, url: item.processedUrl ?? "", size: item.processedSize ?? item.processedBlob.size }
          : await processImage(item.file, settings, { baseImage: item.image });
        const ext = extForFormat(getMimeForTool(settings, tool === "compress" && settings.compress.autoFormat));
        zip.file(`${fileBaseName(item.file.name)}.${ext}`, result.blob);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, `${projectName || "imageos"}.zip`);
      toast("ZIP exported", `${selected.length} files packed into a batch download.`);
    } catch (error) {
      toast("Batch export failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setBatchBusy(false);
    }
  }

  function saveRecipe() {
    const trimmed = recipeName.trim();
    if (!trimmed) {
      toast("Recipe name required", "Give your recipe a name first.");
      return;
    }
    const recipe = cloneRecipe(settings, tool, trimmed);
    setRecipes((curr) => [recipe, ...curr.filter((r) => r.name !== trimmed)].slice(0, 20));
    toast("Recipe saved", `${trimmed} is ready for future batches.`);
  }

  function applyRecipe(recipe: Recipe) {
    skipHistory.current = true;
    setTool(recipe.tool);
    setSettings(deepCloneSettings(recipe.settings));
    setHistory([deepCloneSettings(recipe.settings)]);
    setHistoryIndex(0);
    toast("Recipe applied", recipe.name);
  }

  function resetTool() {
    const next = deepCloneSettings(DEFAULT_SETTINGS);
    if (activeItem) {
      next.resize.width = activeItem.width;
      next.resize.height = activeItem.height;
      next.crop.width = activeItem.width;
      next.crop.height = activeItem.height;
    }
    skipHistory.current = true;
    setSettings(next);
    setHistory([deepCloneSettings(next)]);
    setHistoryIndex(0);
    toast("Reset", "Tool settings restored to defaults.");
  }

  const activeProcessedUrl = activeItem?.processedUrl ?? activeBlobUrl;
  const activeProcessedSize = activeItem?.processedSize ?? activeItem?.processedBlob?.size;
  const activePreviewLabel = activeItem ? `${activeItem.width}×${activeItem.height}` : "No image loaded";
  const cropBounds = useMemo(() => {
    if (!activeItem) return null;
    return getRotatedBounds(activeItem.width, activeItem.height, settings.crop.rotation);
  }, [activeItem, settings.crop.rotation]);

  const cropPreviewBox = useMemo(() => {
    if (!activeItem || !cropBounds) return null;
    return imageCropBox(settings.crop, cropBounds.width, cropBounds.height);
  }, [activeItem, cropBounds, settings.crop]);

  return (
    <div className="shell">
      <header className="container flex flex-col gap-4 py-5 md:py-6">
        <div className="glass flex flex-col gap-4 rounded-[28px] px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-300 via-teal-300 to-violet-400 text-slate-950 shadow-[0_16px_44px_rgba(52,211,153,0.18)]">
              <span className="text-lg font-black">IO</span>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="hero-title text-xl font-semibold tracking-tight md:text-2xl">ImageOS</h1>
                <span className="badge pro">Pro workspace</span>
              </div>
              <p className="mt-1 text-sm text-slate-400">A batch-first image platform with recipe workflows, export history, and local processing.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="pill-nav">
              {NAV.map((entry) => (
                <button
                  key={entry}
                  onClick={() => setActiveNav(entry)}
                  className={`pill transition ${activeNav === entry ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100" : "hover:border-slate-400/40"}`}
                >
                  {entry === "workspace" ? "Workspace" : entry === "library" ? "Library" : "Pricing"}
                </button>
              ))}
              <Link href="/studio" className="pill transition border-white/5 bg-slate-950/45 hover:border-emerald-400/30">
                Studio
              </Link>
            </div>
            <button className="btn secondary" onClick={() => setUpgradeOpen(true)}>
              Upgrade to Pro
            </button>
          </div>
        </div>
      </header>

      <main className="container pb-8">
        {activeNav === "workspace" && (
          <div className="app-grid">
            {/* left rail */}
            <aside className="card flex flex-col overflow-hidden">
              <div className="border-b border-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="section-title text-base font-semibold">Queue</h2>
                    <p className="mt-1 text-xs text-slate-400">Drag in multiple files, edit one, export many.</p>
                  </div>
                  <span className="badge">{queue.length} files</span>
                </div>
              </div>

              <div
                className="grid-bg scrollbar-thin flex min-h-[230px] flex-1 flex-col gap-4 p-4"
                onDragOver={(e) => e.preventDefault()}
                onDrop={async (e) => {
                  e.preventDefault();
                  await loadFiles(e.dataTransfer.files);
                }}
              >
                <div className="rounded-[22px] border border-dashed border-emerald-300/25 bg-slate-950/55 p-4 text-sm text-slate-300">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-100">Drop images here</p>
                      <p className="mt-1 text-xs text-slate-400">Or click to upload PNG, JPG, WebP, GIF, AVIF, BMP, HEIC*.</p>
                    </div>
                    <button className="btn primary shrink-0" onClick={() => fileInputRef.current?.click()}>
                      Open files
                    </button>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-slate-400">
                    <span className="badge">Batch export</span>
                    <span className="badge">Recipes</span>
                    <span className="badge">Undo / redo</span>
                    <span className="badge">ZIP download</span>
                  </div>
                  <button className="btn ghost mt-4 w-full" onClick={loadDemo}>
                    Load demo batch
                  </button>
                  <p className="mt-3 text-[11px] text-slate-500">*HEIC support depends on browser decode support.</p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  multiple
                  onChange={async (e) => {
                    if (e.target.files) await loadFiles(e.target.files);
                  }}
                />

                <div className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-semibold text-slate-100">{selectedCount} selected</p>
                    <p className="text-xs text-slate-400">Use checkboxes for batch export</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn secondary px-3 py-2 text-xs" onClick={() => selectAll(true)}>Select all</button>
                    <button className="btn secondary px-3 py-2 text-xs" onClick={() => selectAll(false)}>Clear</button>
                  </div>
                </div>

                <div className="scrollbar-thin flex max-h-[52vh] flex-1 flex-col gap-2 overflow-auto pr-1">
                  {queue.length === 0 ? (
                    <div className="rounded-[20px] border border-white/5 bg-slate-950/40 p-4 text-sm text-slate-400">
                      No files yet. Open a folder or drop a batch to begin.
                    </div>
                  ) : (
                    queue.map((item, index) => (
                      <button
                        key={item.id}
                        onClick={() => setActiveId(item.id)}
                        className={`group w-full rounded-[20px] border p-3 text-left transition ${activeItem?.id === item.id ? "border-emerald-400/30 bg-emerald-400/8" : "border-white/5 bg-slate-950/45 hover:border-slate-500/30"}`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleSelected(item.id);
                            }}
                            className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-900"
                          />
                          <div className="h-16 w-16 overflow-hidden rounded-2xl border border-white/5 bg-slate-900/60">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={item.url} alt={item.file.name} className="h-full w-full object-cover" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <p className="truncate text-sm font-semibold text-slate-100">{index + 1}. {item.file.name}</p>
                              <span className="text-[11px] text-slate-500">{formatBytes(item.size)}</span>
                            </div>
                            <p className="mt-1 text-xs text-slate-400">{item.width}×{item.height} • {item.file.type.split("/")[1]?.toUpperCase() || "IMAGE"}</p>
                            <p className="mt-1 text-[11px] text-slate-500">{settingSummary(settings, tool)}</p>
                            {item.error && <p className="mt-2 text-xs text-rose-300">{item.error}</p>}
                            {item.processedSize ? (
                              <p className="mt-2 text-[11px] text-emerald-200">Processed: {formatBytes(item.processedSize)}</p>
                            ) : null}
                          </div>
                          <button
                            className="btn ghost px-3 py-2 text-xs opacity-70"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeItem(item.id);
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button className="btn secondary" disabled={!selectedCount || batchBusy} onClick={() => void exportSelectedZip()}>
                    {batchBusy ? "Preparing ZIP…" : "Export ZIP"}
                  </button>
                  <button className="btn secondary" onClick={clearQueue}>
                    Clear queue
                  </button>
                </div>
              </div>
            </aside>

            {/* center */}
            <section className="card flex min-h-[70vh] flex-col overflow-hidden">
              <div className="border-b border-white/5 p-4 md:p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="section-title text-xl font-semibold md:text-2xl">Original vs processed preview</h2>
                      <span className="badge">{activeItem ? activePreviewLabel : "Load an image to start"}</span>
                    </div>
                    <p className="mt-2 max-w-2xl text-sm text-slate-400">{activeToolInfo.blurb}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button className="btn secondary px-4 py-2" onClick={undo} title="Ctrl+Z">
                      ↶
                    </button>
                    <button className="btn secondary px-4 py-2" onClick={redo} title="Ctrl+Shift+Z">
                      ↷
                    </button>
                    <button className="btn secondary" onClick={resetTool} title="Ctrl+R">
                      Reset
                    </button>
                    <button className="btn primary" onClick={() => void downloadActive()} title="Ctrl+S">
                      Download
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid flex-1 gap-4 p-4 md:grid-cols-2 md:p-5">
                <div className="card overflow-hidden border-white/5 bg-slate-950/50">
                  <div className="border-b border-white/5 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-100">Original</span>
                      <span className="text-slate-400">{activeItem ? activeItem.file.name : "Source preview"}</span>
                    </div>
                  </div>
                  <div
                    ref={previewWrapRef}
                    className="relative flex min-h-[320px] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.05),transparent_40%),linear-gradient(180deg,rgba(15,23,42,0.9),rgba(4,7,12,0.96))] p-4"
                  >
                    {activeItem ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          ref={imageRef}
                          src={activeItem.url}
                          alt={activeItem.file.name}
                          className="max-h-[520px] max-w-full object-contain"
                          onLoad={() => {
                            if (tool === "crop" && activeItem) {
                              const bounds = getRotatedBounds(activeItem.width, activeItem.height, settings.crop.rotation);
                              setSettings((prev) => {
                                const next = deepCloneSettings(prev);
                                if (!next.crop.width || !next.crop.height) {
                                  next.crop.width = Math.round(bounds.width * 0.75);
                                  next.crop.height = Math.round(bounds.height * 0.75);
                                }
                                if (!next.crop.x && !next.crop.y) {
                                  next.crop.x = Math.round((bounds.width - next.crop.width) / 2);
                                  next.crop.y = Math.round((bounds.height - next.crop.height) / 2);
                                }
                                return next;
                              });
                            }
                          }}
                        />
                        {tool === "crop" && activeItem && cropPreviewBox && (
                          <div
                            ref={cropOverlayRef}
                            className="pointer-events-none absolute inset-0"
                          >
                            {(() => {
                              const rect = previewWrapRef.current?.getBoundingClientRect();
                              if (!rect || !imageRef.current || !cropBounds) return null;
                              const contain = getContainRect(rect.width - 32, rect.height - 32, cropBounds.width, cropBounds.height);
                              const scaleX = contain.width / cropBounds.width;
                              const scaleY = contain.height / cropBounds.height;
                              const left = contain.x + cropPreviewBox.x * scaleX + 16;
                              const top = contain.y + cropPreviewBox.y * scaleY + 16;
                              const width = cropPreviewBox.width * scaleX;
                              const height = cropPreviewBox.height * scaleY;
                              return (
                                <div
                                  className="absolute"
                                  style={{ left, top, width, height, border: "1px solid rgba(52,211,153,0.9)", boxShadow: "0 0 0 9999px rgba(2,6,23,0.42)" }}
                                >
                                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-70">
                                    <span className="border-r border-b border-white/20" />
                                    <span className="border-r border-b border-white/20" />
                                    <span className="border-b border-white/20" />
                                    <span className="border-r border-b border-white/20" />
                                    <span className="border-r border-b border-white/20" />
                                    <span className="border-b border-white/20" />
                                    <span className="border-r border-white/20" />
                                    <span className="border-r border-white/20" />
                                    <span />
                                  </div>
                                  {(["nw", "ne", "sw", "se"] as const).map((corner) => (
                                    <button
                                      key={corner}
                                      className="pointer-events-auto absolute h-3 w-3 rounded-full border border-white bg-emerald-300 shadow"
                                      style={{
                                        left: corner.includes("w") ? -6 : undefined,
                                        right: corner.includes("e") ? -6 : undefined,
                                        top: corner.includes("n") ? -6 : undefined,
                                        bottom: corner.includes("s") ? -6 : undefined,
                                      }}
                                      onPointerDown={(e) => {
                                        e.preventDefault();
                                        setCropDrag({ mode: "resize", corner });
                                      }}
                                    />
                                  ))}
                                  <button
                                    className="pointer-events-auto absolute inset-0 cursor-move"
                                    onPointerDown={(e) => {
                                      e.preventDefault();
                                      setCropDrag({ mode: "move" });
                                    }}
                                  />
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex max-w-md flex-col items-center text-center">
                        <div className="grid h-24 w-24 place-items-center rounded-[28px] border border-emerald-300/15 bg-emerald-400/5 text-3xl text-emerald-200">
                          ◌
                        </div>
                        <p className="mt-5 text-lg font-semibold text-slate-100">Load an image to start editing</p>
                        <p className="mt-2 text-sm text-slate-400">The processing pipeline is local, fast, and private.</p>
                      </div>
                    )}
                  </div>
                  <div className="border-t border-white/5 p-3 text-xs text-slate-400 md:flex md:items-center md:justify-between">
                    <span>{activeItem ? `${activeItem.width}×${activeItem.height} • ${formatBytes(activeItem.size)} • ${activeItem.file.type.split("/")[1]?.toUpperCase() ?? "IMAGE"}` : "No image loaded"}</span>
                    <span className="mt-1 md:mt-0">Processed: {activeProcessedSize ? formatBytes(activeProcessedSize) : "—"}</span>
                  </div>
                </div>

                <div className="card overflow-hidden border-white/5 bg-slate-950/50">
                  <div className="border-b border-white/5 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-100">Processed</span>
                      <span className="text-slate-400">Live preview</span>
                    </div>
                  </div>
                  <div className="relative flex min-h-[320px] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.06),transparent_36%),linear-gradient(180deg,rgba(15,23,42,0.9),rgba(4,7,12,0.96))] p-4">
                    {activeProcessedUrl && activeItem ? (
                      tool === "compress" ? (
                        <div className="relative w-full">
                          <div className="relative overflow-hidden rounded-[26px] border border-white/5">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={activeItem.url} alt="original compare" className="block h-auto w-full object-contain" />
                            <div className="absolute inset-0 overflow-hidden" style={{ width: `${compareSplit}%` }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={activeProcessedUrl} alt="processed compare" className="block h-auto w-full object-contain" />
                              <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/10 to-transparent" />
                            </div>
                            <div className="absolute inset-y-0 left-0 w-px bg-emerald-300/80" style={{ left: `${compareSplit}%` }} />
                          </div>
                          <div className="mt-4 rounded-[18px] border border-white/5 bg-slate-950/60 p-4">
                            <div className="flex items-center justify-between text-xs text-slate-400">
                              <span>Before ↔ After</span>
                              <span>{compareSplit}%</span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={compareSplit}
                              onChange={(e) => setCompareSplit(Number(e.target.value))}
                              className="range-input mt-3 w-full"
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={activeProcessedUrl} alt="processed" className="max-h-[520px] max-w-full object-contain" />
                        </>
                      )
                    ) : (
                      <div className="flex max-w-sm flex-col items-center text-center">
                        <div className="grid h-24 w-24 place-items-center rounded-[28px] border border-emerald-300/15 bg-emerald-400/5 text-3xl text-emerald-200">
                          ✦
                        </div>
                        <p className="mt-5 text-lg font-semibold text-slate-100">Processed preview will appear here</p>
                        <p className="mt-2 text-sm text-slate-400">Adjust settings on the right and the output updates automatically.</p>
                      </div>
                    )}
                    {processing && (
                      <div className="absolute inset-0 grid place-items-center bg-slate-950/45 backdrop-blur-sm">
                        <div className="rounded-[22px] border border-white/8 bg-slate-950/90 px-5 py-4 text-center shadow-2xl">
                          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-emerald-300/30 border-t-emerald-200" />
                          <p className="text-sm font-semibold text-slate-100">Processing image…</p>
                          <p className="mt-1 text-xs text-slate-400">Keeping everything local in your browser.</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="border-t border-white/5 p-3 text-xs text-slate-400 md:flex md:items-center md:justify-between">
                    <span>{activeItem ? `Export: ${settingSummary(settings, tool)}` : "Ready for a file"}</span>
                    <span>{tool === "compress" ? `Compare mode • ${compareSplit}%` : "Live updates enabled"}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* right rail */}
            <aside className="right-rail card flex flex-col overflow-hidden">
              <div className="border-b border-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="section-title text-base font-semibold">Settings</h2>
                    <p className="mt-1 text-xs text-slate-400">Professional controls with live processing and history.</p>
                  </div>
                  <span className="badge pro">Pro recipes</span>
                </div>
              </div>

              <div className="scrollbar-thin flex-1 overflow-auto p-4">
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(TOOL_INFO) as ToolName[]).map((entry) => (
                    <button
                      key={entry}
                      onClick={() => setActiveTool(entry)}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${tool === entry ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100" : "border-white/5 bg-slate-950/45 text-slate-300 hover:border-white/10"}`}
                    >
                      {TOOL_INFO[entry].title}
                    </button>
                  ))}
                </div>

                {studioHandoff && (
                  <div className="mt-5 rounded-[22px] border border-emerald-400/15 bg-emerald-400/8 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-emerald-200/70">Imported from Studio</p>
                    <div className="mt-2 space-y-1 text-sm text-slate-100">
                      <p className="font-semibold">{studioHandoff.brandName ?? "Studio plan"}</p>
                      <p className="text-slate-300">{studioHandoff.campaign ?? "Campaign"}</p>
                      {studioHandoff.fontStyle && <p className="text-slate-400">Typography: {studioHandoff.fontStyle}</p>}
                    </div>
                  </div>
                )}

                <div className="mt-5 rounded-[22px] border border-white/5 bg-slate-950/45 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Workspace</p>
                  <div className="mt-3 space-y-3">
                    <label className="block">
                      <span className="mb-2 block text-xs text-slate-400">Project name</span>
                      <input className="text-input px-4 py-3 text-sm" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
                    </label>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl border border-white/5 bg-slate-900/45 p-3">
                        <p className="text-slate-400">Files</p>
                        <p className="mt-1 text-lg font-semibold text-slate-100">{queue.length}</p>
                      </div>
                      <div className="rounded-2xl border border-white/5 bg-slate-900/45 p-3">
                        <p className="text-slate-400">Active</p>
                        <p className="mt-1 truncate text-lg font-semibold text-slate-100">{activeItem ? activeItem.file.name : "—"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {tool === "resize" && (
                  <section className="mt-5 space-y-4 rounded-[22px] border border-white/5 bg-slate-950/45 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-100">Dimensions</p>
                      <button className="badge" onClick={() => applySettings((draft) => (draft.resize.lockAspect = !draft.resize.lockAspect))}>
                        {settings.resize.lockAspect ? "Locked" : "Unlocked"}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <label>
                        <span className="mb-2 block text-xs text-slate-400">Width</span>
                        <input
                          className="text-input px-4 py-3 text-sm"
                          type="number"
                          value={settings.resize.width}
                          onChange={(e) =>
                            applySettings((draft) => {
                              draft.resize.width = Number(e.target.value || 0);
                              if (draft.resize.lockAspect && activeItem?.width && activeItem?.height) {
                                draft.resize.height = Math.round((draft.resize.width / activeItem.width) * activeItem.height);
                              }
                            })
                          }
                        />
                      </label>
                      <label>
                        <span className="mb-2 block text-xs text-slate-400">Height</span>
                        <input
                          className="text-input px-4 py-3 text-sm"
                          type="number"
                          value={settings.resize.height}
                          onChange={(e) =>
                            applySettings((draft) => {
                              draft.resize.height = Number(e.target.value || 0);
                              if (draft.resize.lockAspect && activeItem?.width && activeItem?.height) {
                                draft.resize.width = Math.round((draft.resize.height / activeItem.height) * activeItem.width);
                              }
                            })
                          }
                        />
                      </label>
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                        <span>Scale by %</span>
                        <span>{settings.resize.scale}%</span>
                      </div>
                      <input
                        className="range-input"
                        type="range"
                        min={10}
                        max={300}
                        value={settings.resize.scale}
                        onChange={(e) => applySettings((draft) => (draft.resize.scale = Number(e.target.value)))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button className="btn secondary" onClick={() => applyPreset(PRESETS.instagramSquare.width, PRESETS.instagramSquare.height, "Instagram square")}>IG 1:1</button>
                      <button className="btn secondary" onClick={() => applyPreset(PRESETS.youtubeThumb.width, PRESETS.youtubeThumb.height, "YouTube thumbnail")}>YouTube</button>
                      <button className="btn secondary" onClick={() => applyPreset(PRESETS.ogImage.width, PRESETS.ogImage.height, "OG image")}>OG image</button>
                      <button className="btn secondary" onClick={() => applyPreset(PRESETS.linkedinBanner.width, PRESETS.linkedinBanner.height, "LinkedIn banner")}>LinkedIn</button>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs text-slate-400">Resize method</label>
                      <select
                        className="select-input px-4 py-3 text-sm"
                        value={settings.resize.method}
                        onChange={(e) => applySettings((draft) => (draft.resize.method = e.target.value as WorkspaceSettings["resize"]["method"]))}
                      >
                        <option value="smooth">Smooth / bilinear</option>
                        <option value="pixelated">Pixelated / nearest</option>
                      </select>
                    </div>
                  </section>
                )}

                {tool === "compress" && (
                  <section className="mt-5 space-y-4 rounded-[22px] border border-white/5 bg-slate-950/45 p-4">
                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <p className="font-semibold text-slate-100">Compression quality</p>
                        <span className="badge">{settings.compress.quality}%</span>
                      </div>
                      <input
                        className="range-input"
                        type="range"
                        min={1}
                        max={100}
                        value={settings.compress.quality}
                        onChange={(e) => applySettings((draft) => (draft.compress.quality = Number(e.target.value)))}
                      />
                    </div>
                    <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-slate-900/45 p-3 text-sm">
                      <span>
                        <span className="block font-semibold text-slate-100">Auto select best format</span>
                        <span className="block text-xs text-slate-400">Prefer WebP / AVIF if the browser exports smaller</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={settings.compress.autoFormat}
                        onChange={(e) => applySettings((draft) => (draft.compress.autoFormat = e.target.checked))}
                      />
                    </label>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div className="rounded-2xl border border-white/5 bg-slate-900/45 p-3">
                        <p className="text-slate-400">Original</p>
                        <p className="mt-1 font-semibold text-slate-100">{activeItem ? formatBytes(activeItem.size) : "—"}</p>
                      </div>
                      <div className="rounded-2xl border border-white/5 bg-slate-900/45 p-3">
                        <p className="text-slate-400">Output</p>
                        <p className="mt-1 font-semibold text-slate-100">{activeProcessedSize ? formatBytes(activeProcessedSize) : "—"}</p>
                      </div>
                      <div className="rounded-2xl border border-white/5 bg-slate-900/45 p-3">
                        <p className="text-slate-400">Savings</p>
                        <p className="mt-1 font-semibold text-emerald-200">
                          {activeItem && activeProcessedSize ? `${Math.max(0, Math.round((1 - activeProcessedSize / activeItem.size) * 100))}%` : "—"}
                        </p>
                      </div>
                    </div>
                  </section>
                )}

                {tool === "convert" && (
                  <section className="mt-5 space-y-4 rounded-[22px] border border-white/5 bg-slate-950/45 p-4">
                    <div>
                      <label className="mb-2 block text-xs text-slate-400">Output format</label>
                      <select
                        className="select-input px-4 py-3 text-sm"
                        value={settings.convert.format}
                        onChange={(e) => applySettings((draft) => (draft.convert.format = e.target.value as OutputFormat))}
                      >
                        <option value="image/png">PNG</option>
                        <option value="image/jpeg">JPEG</option>
                        <option value="image/webp">WebP</option>
                        <option value="image/avif">AVIF</option>
                      </select>
                    </div>
                    {settings.convert.format === "image/jpeg" && (
                      <label className="block">
                        <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                          <span>JPEG quality</span>
                          <span>{settings.convert.jpegQuality}%</span>
                        </div>
                        <input className="range-input" type="range" min={1} max={100} value={settings.convert.jpegQuality} onChange={(e) => applySettings((draft) => (draft.convert.jpegQuality = Number(e.target.value)))} />
                      </label>
                    )}
                    {settings.convert.format === "image/webp" && (
                      <label className="block">
                        <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                          <span>WebP quality</span>
                          <span>{settings.convert.webpQuality}%</span>
                        </div>
                        <input className="range-input" type="range" min={1} max={100} value={settings.convert.webpQuality} onChange={(e) => applySettings((draft) => (draft.convert.webpQuality = Number(e.target.value)))} />
                      </label>
                    )}
                    {settings.convert.format === "image/avif" && (
                      <label className="block">
                        <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                          <span>AVIF quality</span>
                          <span>{settings.convert.avifQuality}%</span>
                        </div>
                        <input className="range-input" type="range" min={1} max={100} value={settings.convert.avifQuality} onChange={(e) => applySettings((draft) => (draft.convert.avifQuality = Number(e.target.value)))} />
                      </label>
                    )}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-slate-900/45 p-3 text-sm">
                        <span className="text-slate-100">Progressive JPEG</span>
                        <input type="checkbox" checked={settings.convert.progressive} onChange={(e) => applySettings((draft) => (draft.convert.progressive = e.target.checked))} />
                      </label>
                      <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-slate-900/45 p-3 text-sm">
                        <span className="text-slate-100">Lossless WebP</span>
                        <input type="checkbox" checked={settings.convert.lossless} onChange={(e) => applySettings((draft) => (draft.convert.lossless = e.target.checked))} />
                      </label>
                    </div>
                  </section>
                )}

                {tool === "crop" && (
                  <section className="mt-5 space-y-4 rounded-[22px] border border-white/5 bg-slate-950/45 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">Crop & rotate</p>
                        <p className="text-xs text-slate-400">Crop box first, then rotate the canvas.</p>
                      </div>
                      <span className="badge">{settings.crop.rotation}°</span>
                    </div>

                    <div className="rounded-[20px] border border-white/5 bg-slate-900/40 p-4">
                      <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
                        <span>Crop box</span>
                        <span>{cropBounds ? `${cropBounds.width}×${cropBounds.height}` : "—"}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <label>
                          <span className="mb-2 block text-xs text-slate-400">Aspect ratio</span>
                          <select className="select-input px-4 py-3 text-sm" value={settings.crop.ratio} onChange={(e) => applySettings((draft) => (draft.crop.ratio = e.target.value))}>
                            <option value="free">Free</option>
                            <option value="1:1">1:1</option>
                            <option value="4:3">4:3</option>
                            <option value="3:2">3:2</option>
                            <option value="16:9">16:9</option>
                            <option value="9:16">9:16</option>
                            <option value="2:1">2:1</option>
                          </select>
                        </label>
                        <label>
                          <span className="mb-2 block text-xs text-slate-400">X</span>
                          <input className="text-input px-4 py-3 text-sm" type="number" value={settings.crop.x} onChange={(e) => applySettings((draft) => (draft.crop.x = Number(e.target.value)))} />
                        </label>
                        <label>
                          <span className="mb-2 block text-xs text-slate-400">Y</span>
                          <input className="text-input px-4 py-3 text-sm" type="number" value={settings.crop.y} onChange={(e) => applySettings((draft) => (draft.crop.y = Number(e.target.value)))} />
                        </label>
                        <label>
                          <span className="mb-2 block text-xs text-slate-400">Width</span>
                          <input className="text-input px-4 py-3 text-sm" type="number" value={settings.crop.width} onChange={(e) => applySettings((draft) => (draft.crop.width = Number(e.target.value)))} />
                        </label>
                        <label>
                          <span className="mb-2 block text-xs text-slate-400">Height</span>
                          <input className="text-input px-4 py-3 text-sm" type="number" value={settings.crop.height} onChange={(e) => applySettings((draft) => (draft.crop.height = Number(e.target.value)))} />
                        </label>
                      </div>
                    </div>

                    <div className="rounded-[20px] border border-white/5 bg-slate-900/40 p-4">
                      <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
                        <span>Rotate canvas</span>
                        <span>{settings.crop.rotation}°</span>
                      </div>
                      <input className="range-input" type="range" min={-15} max={15} step={1} value={settings.crop.rotation} onChange={(e) => applySettings((draft) => (draft.crop.rotation = Number(e.target.value)))} />
                      <div className="mt-3 grid grid-cols-4 gap-2">
                        <button className="btn secondary px-3 py-2 text-xs" onClick={() => applySettings((draft) => (draft.crop.rotation = 0))}>Reset</button>
                        <button className="btn secondary px-3 py-2 text-xs" onClick={() => applySettings((draft) => (draft.crop.rotation = -90))}>-90°</button>
                        <button className="btn secondary px-3 py-2 text-xs" onClick={() => applySettings((draft) => (draft.crop.rotation = 90))}>90°</button>
                        <button className="btn secondary px-3 py-2 text-xs" onClick={() => applySettings((draft) => (draft.crop.rotation = 180))}>180°</button>
                      </div>
                    </div>
                  </section>
                )}

                {tool === "adjust" && (
                  <section className="mt-5 space-y-4 rounded-[22px] border border-white/5 bg-slate-950/45 p-4">
                    {([
                      ["brightness", "Brightness", -100, 100],
                      ["contrast", "Contrast", -100, 100],
                      ["saturation", "Saturation", -100, 100],
                      ["hue", "Hue rotate", 0, 360],
                      ["blur", "Blur", 0, 20],
                      ["sharpen", "Sharpen", 0, 10],
                      ["exposure", "Exposure", 0, 2],
                      ["highlights", "Highlights", -100, 100],
                      ["shadows", "Shadows", -100, 100],
                    ] as const).map(([key, label, min, max]) => (
                      <label key={key} className="block">
                        <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                          <span>{label}</span>
                          <span>{String(settings.adjust[key as keyof AdjustSettings])}{key === "blur" ? "px" : key === "hue" ? "°" : ""}</span>
                        </div>
                        <input
                          className="range-input"
                          type="range"
                          min={min}
                          max={max}
                          step={key === "blur" || key === "exposure" ? 0.1 : 1}
                          value={Number(settings.adjust[key as keyof AdjustSettings])}
                          onChange={(e) =>
                            applySettings((draft) => {
                              (draft.adjust[key as keyof AdjustSettings] as number) = Number(e.target.value);
                            })
                          }
                        />
                      </label>
                    ))}

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {(["grayscale", "sepia", "invert", "vintage"] as const).map((key) => (
                        <label key={key} className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-slate-900/45 p-3 text-sm">
                          <span className="text-slate-100 capitalize">{key}</span>
                          <input type="checkbox" checked={settings.adjust[key]} onChange={(e) => applySettings((draft) => (draft.adjust[key] = e.target.checked))} />
                        </label>
                      ))}
                    </div>
                    <label>
                      <span className="mb-2 block text-xs text-slate-400">Watermark</span>
                      <input className="text-input px-4 py-3 text-sm" placeholder="Your brand or studio name" value={settings.adjust.watermark} onChange={(e) => applySettings((draft) => (draft.adjust.watermark = e.target.value))} />
                    </label>
                  </section>
                )}

                <section className="mt-5 rounded-[22px] border border-white/5 bg-slate-950/45 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">Recipes</p>
                      <p className="text-xs text-slate-400">Save your current tool state and reuse it later.</p>
                    </div>
                    <span className="badge pro">Pro save</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input className="text-input flex-1 px-4 py-3 text-sm" placeholder="Preset name" value={recipeName} onChange={(e) => setRecipeName(e.target.value)} />
                    <button className="btn primary shrink-0" onClick={saveRecipe}>Save</button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {recipes.length === 0 ? (
                      <p className="text-xs text-slate-500">No saved recipes yet. Save one for repeat workflows.</p>
                    ) : (
                      recipes.map((recipe) => (
                        <button key={recipe.id} className="badge" onClick={() => applyRecipe(recipe)}>
                          {recipe.name}
                        </button>
                      ))
                    )}
                  </div>
                </section>
              </div>
            </aside>
          </div>
        )}

        {activeNav === "library" && (
          <div className="grid gap-6 lg:grid-cols-3">
            <section className="card p-6 lg:col-span-2">
              <h2 className="section-title text-2xl font-semibold">Recipe library</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">Your saved recipes persist locally. This is the hook that keeps people coming back — reusable workflows instead of one-off edits.</p>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {recipes.length === 0 ? (
                  <div className="rounded-[22px] border border-white/5 bg-slate-950/45 p-5 text-sm text-slate-400">No recipes saved yet. Go back to the workspace and save a recipe.</div>
                ) : (
                  recipes.map((recipe) => (
                    <button key={recipe.id} onClick={() => applyRecipe(recipe)} className="rounded-[22px] border border-white/5 bg-slate-950/45 p-5 text-left transition hover:border-emerald-400/25 hover:bg-slate-950/70">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-semibold text-slate-100">{recipe.name}</h3>
                        <span className="badge">{recipe.tool}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-400">{settingSummary(recipe.settings, recipe.tool)}</p>
                      <p className="mt-3 text-xs text-slate-500">Created {new Date(recipe.createdAt).toLocaleString()}</p>
                    </button>
                  ))
                )}
              </div>
            </section>
            <section className="card p-6">
              <h3 className="section-title text-xl font-semibold">Export history</h3>
              <p className="mt-2 text-sm text-slate-400">Keep project names, recipe names, and settings in local workspace state. This makes the product feel like a system, not a widget.</p>
              <div className="mt-5 space-y-3 text-sm">
                <div className="rounded-2xl border border-white/5 bg-slate-950/50 p-4">
                  <p className="font-semibold text-slate-100">{projectName}</p>
                  <p className="mt-1 text-slate-400">Latest workspace project</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-slate-950/50 p-4">
                  <p className="font-semibold text-slate-100">{recipeName}</p>
                  <p className="mt-1 text-slate-400">Current recipe draft</p>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeNav === "pricing" && (
          <div className="grid gap-6 lg:grid-cols-3">
            <section className="card p-6 lg:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="section-title text-2xl font-semibold">Pricing built for conversions</h2>
                  <p className="mt-2 max-w-2xl text-sm text-slate-400">Use local-first processing for speed and privacy, then gate premium workflows, batch exports, and recipes behind Pro.</p>
                </div>
                <span className="badge pro">Subscription ready</span>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[
                  ["Free", "$0", ["Single file edits", "Basic resize/compress/convert", "Local processing"]],
                  ["Pro", "$12/mo", ["Batch ZIP export", "Saved recipes", "Watermark control", "Export history"]],
                  ["Lifetime", "$79", ["Everything in Pro", "No recurring fees", "Best for power users"]],
                ].map(([name, price, features]) => (
                  <div key={String(name)} className="rounded-[26px] border border-white/5 bg-slate-950/45 p-5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-100">{String(name)}</h3>
                      {name === "Pro" && <span className="badge">Most popular</span>}
                    </div>
                    <p className="mt-3 text-3xl font-semibold text-slate-50">{String(price)}</p>
                    <ul className="mt-4 space-y-2 text-sm text-slate-400">
                      {(features as string[]).map((feature) => (
                        <li key={feature}>• {feature}</li>
                      ))}
                    </ul>
                    <button className={`btn mt-5 w-full ${name === "Pro" ? "primary" : "secondary"}`} onClick={() => setUpgradeOpen(true)}>
                      Choose {String(name)}
                    </button>
                  </div>
                ))}
              </div>
            </section>
            <section className="card p-6">
              <h3 className="section-title text-xl font-semibold">Why it wins</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-400">
                <li>• Batch workflows instead of one-off edits</li>
                <li>• Recipes for repeated jobs</li>
                <li>• Workspace + history instead of a disposable page</li>
                <li>• Premium typography and visual taste</li>
              </ul>
            </section>
          </div>
        )}
      </main>

      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <strong>{t.title}</strong>
            <small>{t.body}</small>
          </div>
        ))}
      </div>

      {upgradeOpen && (
        <div className="fixed inset-0 z-[200] grid place-items-center bg-slate-950/78 p-4 backdrop-blur-sm" onClick={() => setUpgradeOpen(false)}>
          <div className="card w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="section-title text-2xl font-semibold">Upgrade to Pro</h3>
              <button className="btn ghost px-3 py-2" onClick={() => setUpgradeOpen(false)}>✕</button>
            </div>
            <p className="mt-3 text-sm text-slate-400">Batch export, saved recipes, watermark control, export history, and future automation features live here.</p>
            <div className="mt-5 rounded-[22px] border border-white/5 bg-slate-950/55 p-4 text-sm text-slate-300">
              Want to monetize? This is the place for subscription checkout, billing, and account unlocks.
            </div>
            <div className="mt-5 flex gap-3">
              <button className="btn primary flex-1" onClick={() => setUpgradeOpen(false)}>Got it</button>
              <button className="btn secondary flex-1" onClick={() => setUpgradeOpen(false)}>Maybe later</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
