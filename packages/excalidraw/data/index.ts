import {
  DEFAULT_EXPORT_PADDING,
  DEFAULT_FILENAME,
  IMAGE_MIME_TYPES,
  isFirefox,
  MIME_TYPES,
  cloneJSON,
  SVG_DOCUMENT_PREAMBLE,
} from "@excalidraw/common";

import { getNonDeletedElements } from "@excalidraw/element";

import { isFrameLikeElement } from "@excalidraw/element";

import { getElementsOverlappingFrame } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import {
  copyBlobToClipboardAsPng,
  copyTextToSystemClipboard,
} from "../clipboard";

import { t } from "../i18n";
import { getSelectedElements, isSomeElementSelected } from "../scene";
import { exportToCanvas, exportToSvg } from "../scene/export";
import { drawBrandingWatermarkOnCanvas } from "./watermarkCanvas";

import { canvasToBlob } from "./blob";
import { fileSave } from "./filesystem";
import { serializeAsJSON } from "./json";
import {
  PDF_RASTER_SCALE_MAX,
  PDF_RASTER_SCALE_MIN,
  scaleCanvasForPdfExport,
} from "./pdf";

import type { ExportType } from "../scene/types";
import type { AppState, BinaryFiles } from "../types";

/** Host image URL + app toggle; merges with explicit `watermark` from callers. */
const resolveExportWatermark = (
  appState: AppState,
  watermark: { imageSrc: string; enabled: boolean } | undefined,
  hostBrandingImageSrc: string | null | undefined,
): { imageSrc: string; enabled: true } | undefined => {
  if (watermark?.enabled && watermark.imageSrc) {
    return { imageSrc: watermark.imageSrc, enabled: true };
  }
  if (hostBrandingImageSrc && appState.brandingWatermarkEnabled) {
    return { imageSrc: hostBrandingImageSrc, enabled: true };
  }
  return undefined;
};

export { loadFromBlob } from "./blob";
export { loadFromJSON, saveAsJSON, type LoadFromJSONResult } from "./json";
export {
  isPdfFile,
  PDF_RASTER_SCALE_MAX,
  PDF_RASTER_SCALE_MIN,
  pdfFileToImageFiles,
  scaleCanvasForPdfExport,
} from "./pdf";

export type ExportedElements = readonly NonDeletedExcalidrawElement[] & {
  _brand: "exportedElements";
};

export const prepareElementsForExport = (
  elements: readonly ExcalidrawElement[],
  { selectedElementIds }: Pick<AppState, "selectedElementIds">,
  exportSelectionOnly: boolean,
) => {
  elements = getNonDeletedElements(elements);

  const isExportingSelection =
    exportSelectionOnly &&
    isSomeElementSelected(elements, { selectedElementIds });

  let exportingFrame: ExcalidrawFrameLikeElement | null = null;
  let exportedElements = isExportingSelection
    ? getSelectedElements(
        elements,
        { selectedElementIds },
        {
          includeBoundTextElement: true,
        },
      )
    : elements;

  if (isExportingSelection) {
    if (
      exportedElements.length === 1 &&
      isFrameLikeElement(exportedElements[0])
    ) {
      exportingFrame = exportedElements[0];
      exportedElements = getElementsOverlappingFrame(elements, exportingFrame);
    } else if (exportedElements.length > 1) {
      exportedElements = getSelectedElements(
        elements,
        { selectedElementIds },
        {
          includeBoundTextElement: true,
          includeElementsInFrames: true,
        },
      );
    }
  }

  return {
    exportingFrame,
    exportedElements: cloneJSON(exportedElements) as ExportedElements,
  };
};

export const exportCanvas = async (
  type: Omit<ExportType, "backend">,
  elements: ExportedElements,
  appState: AppState,
  files: BinaryFiles,
  {
    exportBackground,
    exportPadding = DEFAULT_EXPORT_PADDING,
    viewBackgroundColor,
    name = appState.name || DEFAULT_FILENAME,
    fileHandle = null,
    exportingFrame = null,
    watermark,
    hostBrandingImageSrc,
  }: {
    exportBackground: boolean;
    exportPadding?: number;
    viewBackgroundColor: string;
    /** filename, if applicable */
    name?: string;
    fileHandle?: FileSystemFileHandle | null;
    exportingFrame: ExcalidrawFrameLikeElement | null;
    watermark?: { imageSrc: string; enabled: boolean };
    /** Same as Excalidraw `watermarkImageSrc`; used if `watermark` is omitted. */
    hostBrandingImageSrc?: string | null;
  },
) => {
  if (elements.length === 0) {
    throw new Error(t("alerts.cannotExportEmptyCanvas"));
  }

  const exportWatermark = resolveExportWatermark(
    appState,
    watermark,
    hostBrandingImageSrc,
  );
  if (type === "svg" || type === "clipboard-svg") {
    const svgPromise = exportToSvg(
      elements,
      {
        exportBackground,
        exportWithDarkMode: appState.exportWithDarkMode,
        viewBackgroundColor,
        exportPadding,
        exportScale: appState.exportScale,
        exportEmbedScene: appState.exportEmbedScene && type === "svg",
      },
      files,
      { exportingFrame },
    );

    if (type === "svg") {
      return fileSave(
        svgPromise.then((svg) => {
          // adding SVG preamble so that older software parse the SVG file
          // properly
          return new Blob([SVG_DOCUMENT_PREAMBLE + svg.outerHTML], {
            type: MIME_TYPES.svg,
          });
        }),
        {
          description: "Export to SVG",
          name,
          extension: appState.exportEmbedScene ? "excalidraw.svg" : "svg",
          mimeTypes: [IMAGE_MIME_TYPES.svg],
          fileHandle,
        },
      );
    } else if (type === "clipboard-svg") {
      const svg = await svgPromise.then((svg) => svg.outerHTML);
      try {
        await copyTextToSystemClipboard(svg);
      } catch (e) {
        throw new Error(t("errors.copyToSystemClipboardFailed"));
      }
      return;
    }
  }

  /**
   * PDF is rasterized. The image-export scale slider only goes up to 5×; we still
   * clamp PDF to PDF_RASTER_SCALE_MIN–MAX so downloads stay sharp (print-like DPI).
   */
  const appStateForCanvas =
    type === "pdf"
      ? {
          ...appState,
          exportScale: Math.min(
            PDF_RASTER_SCALE_MAX,
            Math.max(appState.exportScale, PDF_RASTER_SCALE_MIN),
          ),
        }
      : appState;

  const tempCanvas = exportToCanvas(elements, appStateForCanvas, files, {
    exportBackground,
    viewBackgroundColor,
    exportPadding,
    exportingFrame,
  });

  const rasterCanvasWithWatermark = async () => {
    const canvas = await tempCanvas;
    if (exportWatermark) {
      await drawBrandingWatermarkOnCanvas(canvas, exportWatermark.imageSrc);
    }
    return canvas;
  };

  if (type === "png") {
    let blob = canvasToBlob(rasterCanvasWithWatermark());

    if (appState.exportEmbedScene) {
      blob = blob.then((blob) =>
        import("./image").then(({ encodePngMetadata }) =>
          encodePngMetadata({
            blob,
            metadata: serializeAsJSON(elements, appState, files, "local"),
          }),
        ),
      );
    }

    return fileSave(blob, {
      description: "Export to PNG",
      name,
      extension: appState.exportEmbedScene ? "excalidraw.png" : "png",
      mimeTypes: [IMAGE_MIME_TYPES.png],
      fileHandle,
    });
  } else if (type === "pdf") {
    // Build PDF in a promise but call fileSave immediately (like PNG). Otherwise we await
    // canvas/jsPDF first and the save picker runs without a user gesture (Chrome error).
    const pdfBlobPromise = (async () => {
      const frames = elements.filter(isFrameLikeElement);
      const { jsPDF } = await import("jspdf");
      let pdf: any = null;

      const processCanvas = async (canvasPromise: Promise<HTMLCanvasElement>) => {
        const sourceCanvas = await canvasPromise;
        const canvas = scaleCanvasForPdfExport(sourceCanvas);
        if (exportWatermark) {
          await drawBrandingWatermarkOnCanvas(canvas, exportWatermark.imageSrc);
        }
        const wPx = Math.max(1, canvas.width);
        const hPx = Math.max(1, canvas.height);
        const CSS_PX_TO_PT = 72 / 96;
        const wPt = wPx * CSS_PX_TO_PT;
        const hPt = hPx * CSS_PX_TO_PT;
        return { canvas, wPt, hPt };
      };

      try {
        if (!exportingFrame && frames.length > 0) {
          // Multi-page export Mode
          for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            const pageCanvasPromise = exportToCanvas(elements, appStateForCanvas, files, {
              exportBackground,
              viewBackgroundColor,
              exportPadding,
              exportingFrame: frame,
            });
            const { canvas, wPt, hPt } = await processCanvas(pageCanvasPromise);

            if (!pdf) {
              pdf = new jsPDF({
                orientation: wPt > hPt ? "landscape" : "portrait",
                unit: "pt",
                format: [wPt, hPt],
                hotfixes: ["px_scaling"],
              });
            } else {
              pdf.addPage([wPt, hPt], wPt > hPt ? "landscape" : "portrait");
            }
            pdf.addImage(canvas, "PNG", 0, 0, wPt, hPt, undefined, "SLOW");
          }
        } else {
          // Single-page export Mode
          const { canvas, wPt, hPt } = await processCanvas(tempCanvas);
          pdf = new jsPDF({
            orientation: wPt > hPt ? "landscape" : "portrait",
            unit: "pt",
            format: [wPt, hPt],
            hotfixes: ["px_scaling"],
          });
          pdf.addImage(canvas, "PNG", 0, 0, wPt, hPt, undefined, "SLOW");
        }

        if (!pdf) {
          throw new Error(t("errors.pdfExportEmpty"));
        }
        const ab = pdf.output("arraybuffer");
        if (ab.byteLength === 0) {
          throw new Error(t("errors.pdfExportEmpty"));
        }
        return new Blob([ab], { type: MIME_TYPES.pdf });
      } catch (error: any) {
        const msg = error?.message ?? "";
        if (
          error instanceof RangeError ||
          /invalid string length|Maximum call stack/i.test(msg)
        ) {
          throw new Error(t("errors.pdfExportTooLarge"));
        }
        throw error;
      }
    })();

    // Pass the promise directly to fileSave to preserve the user gesture.
    // browser-fs-access will show the file picker immediately.
    return fileSave(pdfBlobPromise, {
      description: "Export to PDF",
      name,
      extension: "pdf",
      mimeTypes: [MIME_TYPES.pdf],
      fileHandle,
    });
  } else if (type === "clipboard") {
    try {
      const blob = canvasToBlob(rasterCanvasWithWatermark());
      await copyBlobToClipboardAsPng(blob);
    } catch (error: any) {
      console.warn(error);
      if (error.name === "CANVAS_POSSIBLY_TOO_BIG") {
        throw new Error(t("canvasError.canvasTooBig"));
      }
      // TypeError *probably* suggests ClipboardItem not defined, which
      // people on Firefox can enable through a flag, so let's tell them.
      if (isFirefox && error.name === "TypeError") {
        throw new Error(
          `${t("alerts.couldNotCopyToClipboard")}\n\n${t(
            "hints.firefox_clipboard_write",
          )}`,
        );
      } else {
        throw new Error(t("alerts.couldNotCopyToClipboard"));
      }
    }
  } else {
    // shouldn't happen
    throw new Error("Unsupported export type");
  }
};
