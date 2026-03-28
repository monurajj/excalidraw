import {
  computeBoundTextPosition,
  doBoundsIntersect,
  getBoundTextElement,
  getElementBounds,
  getElementLineSegments,
  getFreedrawOutlineAsSegments,
  getFreedrawOutlinePoints,
  intersectElementWithLineSegment,
  isArrowElement,
  isFreeDrawElement,
  isLineElement,
  isPointInElement,
  shouldTestInside,
} from "@excalidraw/element";
import {
  lineSegment,
  lineSegmentsDistance,
  pointFrom,
  polygon,
  polygonIncludesPointNonZero,
} from "@excalidraw/math";

import type { Bounds } from "@excalidraw/common";
import type { GlobalPoint, LineSegment } from "@excalidraw/math/types";
import type { ElementsMap, ExcalidrawElement } from "@excalidraw/element/types";

/**
 * @param brushRadius extra hit radius in scene coordinates (from eraser brush).
 */
export const eraserTest = (
  pathSegment: LineSegment<GlobalPoint>,
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
  zoom: number,
  brushRadius: number = 0,
): boolean => {
  const lastPoint = pathSegment[1];

  const baseThreshold = isFreeDrawElement(element) ? 15 : element.strokeWidth / 2;
  const threshold = Math.max(baseThreshold, brushRadius);
  const segmentBounds = [
    Math.min(pathSegment[0][0], pathSegment[1][0]) - threshold,
    Math.min(pathSegment[0][1], pathSegment[1][1]) - threshold,
    Math.max(pathSegment[0][0], pathSegment[1][0]) + threshold,
    Math.max(pathSegment[0][1], pathSegment[1][1]) + threshold,
  ] as Bounds;
  const origElementBounds = getElementBounds(element, elementsMap);
  const elementBounds: Bounds = [
    origElementBounds[0] - threshold,
    origElementBounds[1] - threshold,
    origElementBounds[2] + threshold,
    origElementBounds[3] + threshold,
  ];

  if (!doBoundsIntersect(segmentBounds, elementBounds)) {
    return false;
  }

  if (
    shouldTestInside(element) &&
    isPointInElement(lastPoint, element, elementsMap)
  ) {
    return true;
  }

  if (isFreeDrawElement(element)) {
    const outlinePoints = getFreedrawOutlinePoints(element);
    const strokeSegments = getFreedrawOutlineAsSegments(
      element,
      outlinePoints,
      elementsMap,
    );
    const tolerance = Math.max(2.25, 5 / zoom, brushRadius);

    for (const seg of strokeSegments) {
      if (lineSegmentsDistance(seg, pathSegment) <= tolerance) {
        return true;
      }
    }

    const poly = polygon(
      ...(outlinePoints.map(([x, y]) =>
        pointFrom<GlobalPoint>(element.x + x, element.y + y),
      ) as GlobalPoint[]),
    );

    if (polygonIncludesPointNonZero(pathSegment[0], poly)) {
      return true;
    }

    return false;
  }

  const boundTextElement = getBoundTextElement(element, elementsMap);

  if (isArrowElement(element) || (isLineElement(element) && !element.polygon)) {
    const tolerance = Math.max(
      element.strokeWidth,
      (element.strokeWidth * 2) / zoom,
      brushRadius,
    );

    const segments = getElementLineSegments(element, elementsMap);
    for (const seg of segments) {
      if (lineSegmentsDistance(seg, pathSegment) <= tolerance) {
        return true;
      }
    }

    return false;
  }

  return (
    intersectElementWithLineSegment(element, elementsMap, pathSegment, 0, true)
      .length > 0 ||
    (!!boundTextElement &&
      intersectElementWithLineSegment(
        {
          ...boundTextElement,
          ...computeBoundTextPosition(element, boundTextElement, elementsMap),
        },
        elementsMap,
        pathSegment,
        0,
        true,
      ).length > 0)
  );
};

export const elementHitByEraserPath = (
  element: ExcalidrawElement,
  path: readonly GlobalPoint[],
  elementsMap: ElementsMap,
  zoom: number,
  brushRadius: number,
): boolean => {
  if (path.length < 2) {
    return false;
  }
  for (let i = 1; i < path.length; i++) {
    const seg = lineSegment(path[i - 1], path[i]);
    if (eraserTest(seg, element, elementsMap, zoom, brushRadius)) {
      return true;
    }
  }
  return false;
};
