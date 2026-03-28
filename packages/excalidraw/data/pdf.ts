import { MIME_TYPES } from "@excalidraw/common";

/** Must match the `pdfjs-dist` dependency version in this package's package.json */
const PDFJS_DIST_VERSION = "4.10.38";

/** Max width/height in CSS pixels for one rendered PDF page (avoids huge canvases). */
const MAX_PAGE_DIMENSION_PX = 4096;
const DEFAULT_RENDER_SCALE = 2;

/**
 * Raster PDF export uses PNG + jsPDF strings; very large canvases exceed JS max
 * string length (`Array.join` / `toDataURL`). Downscale before embedding.
 */
export const MAX_PDF_EXPORT_DIMENSION_PX = 4096;
export const MAX_PDF_EXPORT_PIXELS = 22_000_000;

export const scaleCanvasForPdfExport = (
  canvas: HTMLCanvasElement,
): HTMLCanvasElement => {
  let w = canvas.width;
  let h = canvas.height;
  if (w <= 0 || h <= 0) {
    return canvas;
  }

  const pixels = w * h;
  let scale = 1;
  const maxDim = Math.max(w, h);
  if (maxDim > MAX_PDF_EXPORT_DIMENSION_PX) {
    scale = Math.min(scale, MAX_PDF_EXPORT_DIMENSION_PX / maxDim);
  }
  if (pixels * scale * scale > MAX_PDF_EXPORT_PIXELS) {
    scale = Math.min(scale, Math.sqrt(MAX_PDF_EXPORT_PIXELS / pixels));
  }

  if (scale >= 0.999) {
    return canvas;
  }

  const nw = Math.max(1, Math.floor(w * scale));
  const nh = Math.max(1, Math.floor(h * scale));
  const out = document.createElement("canvas");
  out.width = nw;
  out.height = nh;
  const ctx = out.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create canvas for PDF export");
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, nw, nh);
  return out;
};

export const isPdfFile = (blob: Blob | File | null | undefined): boolean => {
  if (!blob) {
    return false;
  }
  const type = blob.type?.toLowerCase();
  if (type === MIME_TYPES.pdf.toLowerCase()) {
    return true;
  }
  if (blob instanceof File && blob.name?.toLowerCase().endsWith(".pdf")) {
    return true;
  }
  return false;
};

/**
 * Rasterize each PDF page to a PNG {@link File} for use with the image element pipeline.
 */
export const pdfFileToImageFiles = async (file: File): Promise<File[]> => {
  if (typeof document === "undefined") {
    throw new Error("PDF import is only supported in the browser");
  }

  const pdfjs = await import("pdfjs-dist");

  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_DIST_VERSION}/build/pdf.worker.min.mjs`;

  let pdf: Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>;

  try {
    const data = await file.arrayBuffer();
    pdf = await pdfjs.getDocument({ data }).promise;
  } catch {
    throw new Error("Invalid or corrupted PDF file");
  }

  const baseName = file.name.replace(/\.pdf$/i, "").trim() || "document";
  const out: File[] = [];

  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const unitViewport = page.getViewport({ scale: 1 });
      const maxDim = Math.max(unitViewport.width, unitViewport.height);
      const scale = Math.min(
        DEFAULT_RENDER_SCALE,
        maxDim > 0 ? MAX_PAGE_DIMENSION_PX / maxDim : DEFAULT_RENDER_SCALE,
      );
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Could not get canvas context");
      }

      await page.render({
        canvasContext: ctx,
        viewport,
      }).promise;

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, MIME_TYPES.png),
      );
      if (!blob) {
        throw new Error("Could not rasterize PDF page");
      }

      const pageLabel = pdf.numPages > 1 ? `${baseName}-p${i}` : baseName;
      out.push(new File([blob], `${pageLabel}.png`, { type: MIME_TYPES.png }));
    }
  } finally {
    await pdf.destroy();
  }

  return out;
};
