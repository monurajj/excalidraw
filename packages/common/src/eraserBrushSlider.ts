/** Scene-space brush diameter at slider 1%. */
export const ERASER_BRUSH_MIN_PX = 4;
/** Scene-space brush diameter at slider 100%. */
export const ERASER_BRUSH_MAX_PX = 48;

export const eraserBrushToSliderPercent = (brushPx: number): number => {
  const b = Math.max(
    ERASER_BRUSH_MIN_PX,
    Math.min(ERASER_BRUSH_MAX_PX, brushPx),
  );
  const span = ERASER_BRUSH_MAX_PX - ERASER_BRUSH_MIN_PX;
  const t = (b - ERASER_BRUSH_MIN_PX) / span;
  return Math.round(1 + t * 99);
};

export const sliderPercentToEraserBrush = (percent: number): number => {
  const p = Math.max(1, Math.min(100, percent));
  const t = (p - 1) / 99;
  const span = ERASER_BRUSH_MAX_PX - ERASER_BRUSH_MIN_PX;
  return Math.round(ERASER_BRUSH_MIN_PX + t * span);
};
