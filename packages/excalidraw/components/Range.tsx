import React, { useEffect } from "react";

import "./Range.scss";

export type RangeProps = {
  /** Omit when the control is labeled by a parent (e.g. fieldset legend). */
  label?: React.ReactNode;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Set to `false` to hide the fixed label under the track start (e.g. stroke width). */
  minLabel?: React.ReactNode | false;
  hasCommonValue?: boolean;
  testId?: string;
  /** When set, used for the value bubble instead of the raw number (e.g. append "%"). */
  formatBubble?: (value: number) => React.ReactNode;
};

export const Range = ({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 10,
  minLabel,
  hasCommonValue = true,
  testId,
  formatBubble,
}: RangeProps) => {
  const rangeRef = React.useRef<HTMLInputElement>(null);
  const valueRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (rangeRef.current && valueRef.current) {
      const rangeElement = rangeRef.current;
      const valueElement = valueRef.current;
      const inputWidth = rangeElement.offsetWidth;
      const thumbWidth =
        parseFloat(
          getComputedStyle(rangeElement).getPropertyValue(
            "--slider-thumb-size",
          ),
        ) || 16;
      const progress = ((value - min) / (max - min || 1)) * 100;
      const position =
        (progress / 100) * (inputWidth - thumbWidth) + thumbWidth / 2;
      valueElement.style.left = `${position}px`;
      rangeElement.style.background = `linear-gradient(to right, var(--color-slider-track) 0%, var(--color-slider-track) ${progress}%, var(--button-bg) ${progress}%, var(--button-bg) 100%)`;
    }
  }, [max, min, value]);

  const resolvedMinLabel =
    minLabel === false
      ? null
      : minLabel !== undefined
        ? minLabel
        : min;

  const ControlTag = label != null ? "label" : "div";

  return (
    <ControlTag className="control-label">
      {label}
      <div className="range-wrapper">
        <input
          style={{
            ["--color-slider-track" as string]: hasCommonValue
              ? undefined
              : "var(--button-bg)",
          }}
          ref={rangeRef}
          type="range"
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            onChange(+event.target.value);
          }}
          value={value}
          className="range-input"
          data-testid={testId}
          data-has-common-value={hasCommonValue ? "true" : "false"}
        />
        <div className="value-bubble" ref={valueRef}>
          {formatBubble
            ? formatBubble(value)
            : value !== min
              ? value
              : null}
        </div>
        {resolvedMinLabel !== null && (
          <div className="zero-label">{resolvedMinLabel}</div>
        )}
      </div>
    </ControlTag>
  );
};
