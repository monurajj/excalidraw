const shouldSetCrossOriginAnonymous = (imageSrc: string): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    const resolved = new URL(imageSrc, window.location.href);
    return resolved.origin !== window.location.origin;
  } catch {
    return false;
  }
};

/**
 * Draws a semi-transparent logo on the bottom-right of an export canvas.
 * Used for PNG / PDF / clipboard raster exports when branding watermark is on.
 */
export const drawBrandingWatermarkOnCanvas = (
  canvas: HTMLCanvasElement,
  imageSrc: string,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (shouldSetCrossOriginAnonymous(imageSrc)) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve();
        return;
      }
      const padding = 24;
      const maxW = Math.min(220, canvas.width * 0.28);
      const scale = Math.min(maxW / img.width, (canvas.height * 0.22) / img.height);
      const w = Math.max(1, img.width * scale);
      const h = Math.max(1, img.height * scale);
      const x = canvas.width - w - padding;
      const y = canvas.height - h - padding;
      ctx.save();
      ctx.globalAlpha = 0.42;
      ctx.drawImage(img, x, y, w, h);
      ctx.restore();
      resolve();
    };
    img.onerror = () => {
      reject(new Error("Could not load watermark image"));
    };
    img.src = imageSrc;
  });
};
