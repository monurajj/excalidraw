/** Pixel stroke at slider position 1%. */
export const STROKE_WIDTH_SLIDER_MIN_PX = 1;
/** Pixel stroke at slider position 100%. */
export const STROKE_WIDTH_SLIDER_MAX_PX = 20;

export const strokeWidthToSliderPercent = (strokeWidth: number): number => {
  if (strokeWidth <= STROKE_WIDTH_SLIDER_MIN_PX) {
    return 1;
  }
  if (strokeWidth >= STROKE_WIDTH_SLIDER_MAX_PX) {
    return 100;
  }
  const span = STROKE_WIDTH_SLIDER_MAX_PX - STROKE_WIDTH_SLIDER_MIN_PX;
  const t = (strokeWidth - STROKE_WIDTH_SLIDER_MIN_PX) / span;
  return Math.round(1 + t * 99);
};

export const sliderPercentToStrokeWidth = (percent: number): number => {
  const p = Math.max(1, Math.min(100, percent));
  const t = (p - 1) / 99;
  const span = STROKE_WIDTH_SLIDER_MAX_PX - STROKE_WIDTH_SLIDER_MIN_PX;
  const width = STROKE_WIDTH_SLIDER_MIN_PX + t * span;
  return Math.max(
    STROKE_WIDTH_SLIDER_MIN_PX,
    Math.min(STROKE_WIDTH_SLIDER_MAX_PX, Math.round(width)),
  );
};
