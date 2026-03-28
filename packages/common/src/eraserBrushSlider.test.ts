import { describe, expect, it } from "vitest";

import {
  ERASER_BRUSH_MAX_PX,
  ERASER_BRUSH_MIN_PX,
  eraserBrushToSliderPercent,
  sliderPercentToEraserBrush,
} from "./eraserBrushSlider";

describe("eraserBrushSlider", () => {
  it("maps endpoints", () => {
    expect(eraserBrushToSliderPercent(ERASER_BRUSH_MIN_PX)).toBe(1);
    expect(eraserBrushToSliderPercent(ERASER_BRUSH_MAX_PX)).toBe(100);
    expect(sliderPercentToEraserBrush(1)).toBe(ERASER_BRUSH_MIN_PX);
    expect(sliderPercentToEraserBrush(100)).toBe(ERASER_BRUSH_MAX_PX);
  });

  it("round-trips default-ish size", () => {
    const w = 14;
    expect(sliderPercentToEraserBrush(eraserBrushToSliderPercent(w))).toBe(w);
  });
});
