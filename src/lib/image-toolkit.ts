export type OutputFormat = "image/png" | "image/jpeg" | "image/webp" | "image/avif";
export type ToolName = "resize" | "compress" | "convert" | "crop" | "adjust";

export interface ResizeSettings {
  width: number;
  height: number;
  lockAspect: boolean;
  scale: number;
  method: "smooth" | "pixelated";
}

export interface CompressSettings {
  quality: number;
  autoFormat: boolean;
}

export interface ConvertSettings {
  format: OutputFormat;
  jpegQuality: number;
  webpQuality: number;
  avifQuality: number;
  pngCompression: number;
  progressive: boolean;
  lossless: boolean;
}

export interface CropSettings {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  ratio: string;
}

export interface AdjustSettings {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  blur: number;
  sharpen: number;
  exposure: number;
  highlights: number;
  shadows: number;
  grayscale: boolean;
  sepia: boolean;
  invert: boolean;
  vintage: boolean;
  watermark: string;
}

export interface WorkspaceSettings {
  resize: ResizeSettings;
  compress: CompressSettings;
  convert: ConvertSettings;
  crop: CropSettings;
  adjust: AdjustSettings;
}

export interface QueueItem {
  id: string;
  file: File;
  url: string;
  width: number;
  height: number;
  size: number;
  selected: boolean;
  processedUrl?: string;
  processedBlob?: Blob;
  processedSize?: number;
  error?: string;
}

export interface Recipe {
  id: string;
  name: string;
  tool: ToolName;
  settings: WorkspaceSettings;
  createdAt: string;
}

export const DEFAULT_SETTINGS: WorkspaceSettings = {
  resize: {
    width: 1600,
    height: 1000,
    lockAspect: true,
    scale: 100,
    method: "smooth",
  },
  compress: {
    quality: 82,
    autoFormat: true,
  },
  convert: {
    format: "image/png",
    jpegQuality: 88,
    webpQuality: 82,
    avifQuality: 62,
    pngCompression: 6,
    progressive: true,
    lossless: false,
  },
  crop: {
    x: 0,
    y: 0,
    width: 1600,
    height: 1000,
    rotation: 0,
    ratio: "free",
  },
  adjust: {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    hue: 0,
    blur: 0,
    sharpen: 0,
    exposure: 0,
    highlights: 0,
    shadows: 0,
    grayscale: false,
    sepia: false,
    invert: false,
    vintage: false,
    watermark: "",
  },
};

export const PRESETS = {
  instagramSquare: { width: 1080, height: 1080 },
  instagramPortrait: { width: 1080, height: 1350 },
  instagramLandscape: { width: 1080, height: 566 },
  twitterHeader: { width: 1500, height: 500 },
  twitterCard: { width: 1200, height: 675 },
  ogImage: { width: 1200, height: 630 },
  youtubeThumb: { width: 1280, height: 720 },
  linkedinBanner: { width: 1584, height: 396 },
  favicon: { width: 512, height: 512 },
};

export const RATIO_PRESETS: Record<string, number | null> = {
  free: null,
  "1:1": 1,
  "4:3": 4 / 3,
  "3:2": 3 / 2,
  "16:9": 16 / 9,
  "9:16": 9 / 16,
  "2:1": 2,
};

export function uid(prefix = "img") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function deepCloneSettings(settings: WorkspaceSettings): WorkspaceSettings {
  return JSON.parse(JSON.stringify(settings)) as WorkspaceSettings;
}

export function safeFormatName(format: OutputFormat) {
  switch (format) {
    case "image/png":
      return "PNG";
    case "image/jpeg":
      return "JPEG";
    case "image/webp":
      return "WebP";
    case "image/avif":
      return "AVIF";
  }
}

export function getMimeForTool(item: WorkspaceSettings, preferBest = false): OutputFormat {
  if (preferBest) {
    if (item.convert.format === "image/avif") return "image/avif";
    if (item.convert.format === "image/webp") return "image/webp";
  }
  return item.convert.format;
}

export async function fileToImage(file: File) {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  const loaded = new Promise<HTMLImageElement>((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load ${file.name}`));
  });
  image.src = url;
  const result = await loaded;
  return { image: result, url };
}

function applyCropRatio(
  crop: CropSettings,
  imageWidth: number,
  imageHeight: number,
) {
  const ratio = RATIO_PRESETS[crop.ratio];
  if (!ratio) {
    return {
      x: clamp(crop.x, 0, imageWidth - 1),
      y: clamp(crop.y, 0, imageHeight - 1),
      width: clamp(crop.width || imageWidth, 1, imageWidth),
      height: clamp(crop.height || imageHeight, 1, imageHeight),
    };
  }

  const target = crop.width / crop.height || ratio;
  const actualRatio = target || ratio;
  let width = clamp(crop.width || imageWidth, 1, imageWidth);
  let height = clamp(crop.height || imageHeight, 1, imageHeight);
  const current = width / height;

  if (Math.abs(current - actualRatio) > 0.001) {
    if (current > actualRatio) width = Math.round(height * actualRatio);
    else height = Math.round(width / actualRatio);
  }

  const x = clamp(crop.x, 0, Math.max(0, imageWidth - width));
  const y = clamp(crop.y, 0, Math.max(0, imageHeight - height));
  return { x, y, width, height };
}

function applyColorAdjustment(ctx: CanvasRenderingContext2D, settings: AdjustSettings) {
  const filters = [];
  if (settings.brightness) filters.push(`brightness(${100 + settings.brightness}%)`);
  if (settings.contrast) filters.push(`contrast(${100 + settings.contrast}%)`);
  if (settings.saturation) filters.push(`saturate(${100 + settings.saturation}%)`);
  if (settings.hue) filters.push(`hue-rotate(${settings.hue}deg)`);
  if (settings.blur) filters.push(`blur(${settings.blur}px)`);
  if (settings.grayscale) filters.push(`grayscale(100%)`);
  if (settings.sepia) filters.push(`sepia(100%)`);
  if (settings.invert) filters.push(`invert(100%)`);
  if (settings.vintage) filters.push(`contrast(110%) saturate(85%) sepia(22%)`);
  ctx.filter = filters.join(" ") || "none";
}

function applyAdvancedPixelEffects(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  settings: AdjustSettings,
) {
  if (!settings.sharpen && !settings.exposure && !settings.highlights && !settings.shadows) return;

  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const copy = new Uint8ClampedArray(data);

  const sharpenAmount = clamp(settings.sharpen / 10, 0, 1);
  const exposure = settings.exposure;
  const highlightFactor = settings.highlights / 100;
  const shadowFactor = settings.shadows / 100;

  const idx = (x: number, y: number) => (y * width + x) * 4;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = idx(x, y);
      const r = copy[i];
      const g = copy[i + 1];
      const b = copy[i + 2];

      const lum = (r + g + b) / 765;
      let nr = r;
      let ng = g;
      let nb = b;

      if (settings.sharpen) {
        const tl = idx(x - 1, y - 1), tc = idx(x, y - 1), tr = idx(x + 1, y - 1);
        const ml = idx(x - 1, y), mc = idx(x, y), mr = idx(x + 1, y);
        const bl = idx(x - 1, y + 1), bc = idx(x, y + 1), br = idx(x + 1, y + 1);

        const sr = -copy[tl] - copy[tc] - copy[tr] - copy[ml] + 9 * copy[mc] - copy[mr] - copy[bl] - copy[bc] - copy[br];
        const sg = -copy[tl + 1] - copy[tc + 1] - copy[tr + 1] - copy[ml + 1] + 9 * copy[mc + 1] - copy[mr + 1] - copy[bl + 1] - copy[bc + 1] - copy[br + 1];
        const sb = -copy[tl + 2] - copy[tc + 2] - copy[tr + 2] - copy[ml + 2] + 9 * copy[mc + 2] - copy[mr + 2] - copy[bl + 2] - copy[bc + 2] - copy[br + 2];
        nr = nr * (1 - sharpenAmount) + clamp(sr, 0, 255) * sharpenAmount;
        ng = ng * (1 - sharpenAmount) + clamp(sg, 0, 255) * sharpenAmount;
        nb = nb * (1 - sharpenAmount) + clamp(sb, 0, 255) * sharpenAmount;
      }

      const exposureMul = Math.pow(2, exposure);
      nr *= exposureMul;
      ng *= exposureMul;
      nb *= exposureMul;

      if (highlightFactor) {
        const highlightBoost = Math.max(0, (lum - 0.5) * 2);
        nr += 255 * highlightBoost * highlightFactor * 0.08;
        ng += 255 * highlightBoost * highlightFactor * 0.08;
        nb += 255 * highlightBoost * highlightFactor * 0.08;
      }

      if (shadowFactor) {
        const shadowBoost = Math.max(0, (0.5 - lum) * 2);
        nr += 255 * shadowBoost * shadowFactor * 0.08;
        ng += 255 * shadowBoost * shadowFactor * 0.08;
        nb += 255 * shadowBoost * shadowFactor * 0.08;
      }

      data[i] = clamp(Math.round(nr), 0, 255);
      data[i + 1] = clamp(Math.round(ng), 0, 255);
      data[i + 2] = clamp(Math.round(nb), 0, 255);
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

export async function processImage(
  file: File,
  settings: WorkspaceSettings,
  opts?: { baseImage?: HTMLImageElement; cropPreviewScale?: number },
) {
  const { image: baseImage, url } = opts?.baseImage
    ? { image: opts.baseImage, url: "" }
    : await fileToImage(file);

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = baseImage.naturalWidth || baseImage.width;
  sourceCanvas.height = baseImage.naturalHeight || baseImage.height;
  const sctx = sourceCanvas.getContext("2d");
  if (!sctx) throw new Error("Canvas unavailable");
  sctx.drawImage(baseImage, 0, 0);

  const cropRect = applyCropRatio(settings.crop, sourceCanvas.width, sourceCanvas.height);
  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = cropRect.width;
  cropCanvas.height = cropRect.height;
  const cctx = cropCanvas.getContext("2d");
  if (!cctx) throw new Error("Canvas unavailable");
  cctx.drawImage(
    sourceCanvas,
    cropRect.x,
    cropRect.y,
    cropRect.width,
    cropRect.height,
    0,
    0,
    cropRect.width,
    cropRect.height,
  );

  const targetWidth = Math.max(1, Math.round(settings.resize.scale !== 100 ? cropRect.width * (settings.resize.scale / 100) : settings.resize.width || cropRect.width));
  const targetHeight = Math.max(1, Math.round(settings.resize.scale !== 100 ? cropRect.height * (settings.resize.scale / 100) : settings.resize.height || cropRect.height));
  const outCanvas = document.createElement("canvas");
  outCanvas.width = targetWidth;
  outCanvas.height = targetHeight;
  const octx = outCanvas.getContext("2d");
  if (!octx) throw new Error("Canvas unavailable");
  octx.imageSmoothingEnabled = settings.resize.method === "smooth";
  octx.imageSmoothingQuality = settings.resize.method === "smooth" ? "high" : "low";

  applyColorAdjustment(octx, settings.adjust);
  octx.drawImage(cropCanvas, 0, 0, targetWidth, targetHeight);
  octx.filter = "none";
  applyAdvancedPixelEffects(octx, outCanvas, settings.adjust);

  if (settings.adjust.watermark.trim()) {
    octx.save();
    octx.font = "600 16px var(--font-inter), sans-serif";
    octx.fillStyle = "rgba(255,255,255,0.82)";
    octx.strokeStyle = "rgba(5,7,12,0.55)";
    octx.lineWidth = 4;
    const label = settings.adjust.watermark.trim();
    const padding = 18;
    const metrics = octx.measureText(label);
    const x = outCanvas.width - metrics.width - padding;
    const y = outCanvas.height - padding;
    octx.strokeText(label, x, y);
    octx.fillText(label, x, y);
    octx.restore();
  }

  const mime = settings.convert.format;
  const quality =
    mime === "image/jpeg"
      ? settings.convert.jpegQuality / 100
      : mime === "image/webp"
        ? settings.convert.webpQuality / 100
        : mime === "image/avif"
          ? settings.convert.avifQuality / 100
          : 1;

  const blob = await new Promise<Blob>((resolve, reject) => {
    outCanvas.toBlob(
      (b) => {
        if (!b) reject(new Error(`Browser couldn't export ${mime}`));
        else resolve(b);
      },
      mime,
      quality,
    );
  });

  if (url) URL.revokeObjectURL(url);
  return {
    blob,
    url: URL.createObjectURL(blob),
    width: outCanvas.width,
    height: outCanvas.height,
    size: blob.size,
    cropRect,
  };
}

export function fitsImageFormat(file: File) {
  return file.type.startsWith("image/");
}

export function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function cloneRecipe(settings: WorkspaceSettings, tool: ToolName, name: string): Recipe {
  return {
    id: uid("recipe"),
    name,
    tool,
    settings: deepCloneSettings(settings),
    createdAt: new Date().toISOString(),
  };
}
