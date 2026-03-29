import clsx from "clsx";
import React from "react";

import "./BrandingWatermarkOverlay.scss";

type BrandingWatermarkOverlayProps = {
  imageSrc: string;
  theme: "light" | "dark";
};

export const BrandingWatermarkOverlay: React.FC<
  BrandingWatermarkOverlayProps
> = ({ imageSrc, theme }) => {
  return (
    <div
      className={clsx("BrandingWatermarkOverlay", {
        "BrandingWatermarkOverlay--dark": theme === "dark",
      })}
      aria-hidden="true"
    >
      <img
        src={imageSrc}
        alt=""
        className="BrandingWatermarkOverlay__img"
        draggable={false}
      />
    </div>
  );
};
