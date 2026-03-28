import { describe, expect, it } from "vitest";

import {
  sliderPercentToStrokeWidth,
  strokeWidthToSliderPercent,
} from "./strokeWidthSlider";

describe("strokeWidthSlider", () => {
  it("maps endpoints", () => {
    expect(strokeWidthToSliderPercent(1)).toBe(1);
    expect(strokeWidthToSliderPercent(20)).toBe(100);
    expect(sliderPercentToStrokeWidth(1)).toBe(1);
    expect(sliderPercentToStrokeWidth(100)).toBe(20);
  });

  it("round-trips common default stroke", () => {
    const w = 2;
    expect(sliderPercentToStrokeWidth(strokeWidthToSliderPercent(w))).toBe(w);
  });
});
