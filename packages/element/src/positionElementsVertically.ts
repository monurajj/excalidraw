import { getCommonBounds } from "./bounds";
import { type ElementUpdate, newElementWith } from "./mutateElement";

import type { ExcalidrawElement } from "./types";

/**
 * Stack elements in a single column, horizontally centered on {@link centerX},
 * with the block vertically centered around {@link centerY}.
 */
export const positionElementsVertically = <TElement extends ExcalidrawElement>(
  elements: readonly TElement[],
  centerX: number,
  centerY: number,
  padding = 50,
): TElement[] => {
  if (!elements.length) {
    return [];
  }

  const boundsList = elements.map((el) => {
    const [minX, minY, maxX, maxY] = getCommonBounds([el]);
    return {
      minX,
      minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  });

  const totalHeight =
    boundsList.reduce((sum, b) => sum + b.height, 0) +
    Math.max(0, elements.length - 1) * padding;

  let currentTopY = centerY - totalHeight / 2;
  const res: TElement[] = [];

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i]!;
    const { minX, minY, width, height } = boundsList[i]!;
    const offsetX = centerX - width / 2 - minX;
    const offsetY = currentTopY - minY;

    res.push(
      newElementWith(el, {
        x: el.x + offsetX,
        y: el.y + offsetY,
      } as ElementUpdate<TElement>),
    );

    currentTopY += height + padding;
  }

  return res;
};
