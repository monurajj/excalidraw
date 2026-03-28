import {
  getUpdatedTimestamp,
  randomId,
  randomInteger,
} from "@excalidraw/common";

import {
  elementCenterPoint,
  isFreeDrawElement,
  newElementWith,
} from "@excalidraw/element";
import {
  distanceToLineSegment,
  lineSegment,
  lineSegmentsDistance,
  pointFrom,
  pointRotateRads,
} from "@excalidraw/math";

import { elementHitByEraserPath } from "./eraserHitTest";

import type { GlobalPoint, LineSegment, LocalPoint } from "@excalidraw/math/types";
import type {
  ElementsMap,
  ExcalidrawElement,
  ExcalidrawFreeDrawElement,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";

const buildEraserSegments = (
  path: readonly GlobalPoint[],
): LineSegment<GlobalPoint>[] => {
  if (path.length >= 2) {
    const segs: LineSegment<GlobalPoint>[] = [];
    for (let i = 1; i < path.length; i++) {
      segs.push(lineSegment(path[i - 1], path[i]));
    }
    return segs;
  }
  if (path.length === 1) {
    const p = path[0];
    const eps = 0.5;
    return [lineSegment(p, pointFrom(p[0] + eps, p[1] + eps))];
  }
  return [];
};

const splitFreeDrawByEraser = (
  element: ExcalidrawFreeDrawElement,
  elementsMap: ElementsMap,
  eraserSegments: LineSegment<GlobalPoint>[],
  brushRadius: number,
): ExcalidrawFreeDrawElement[] | "delete" | null => {
  const pts = element.points;
  if (pts.length < 2) {
    return "delete";
  }

  const center = elementCenterPoint(element, elementsMap);
  const tol = brushRadius + element.strokeWidth / 2;

  const toGlobal = (lx: number, ly: number) =>
    pointRotateRads(
      pointFrom<GlobalPoint>(element.x + lx, element.y + ly),
      center,
      element.angle,
    );

  const nearEraser = (gp: GlobalPoint) => {
    for (const es of eraserSegments) {
      if (distanceToLineSegment(gp, es) <= tol) {
        return true;
      }
    }
    return false;
  };

  const n = pts.length;
  const bad = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    if (nearEraser(toGlobal(pts[i][0], pts[i][1]))) {
      bad[i] = true;
    }
  }
  for (let i = 0; i < n - 1; i++) {
    const edge = lineSegment(
      toGlobal(pts[i][0], pts[i][1]),
      toGlobal(pts[i + 1][0], pts[i + 1][1]),
    );
    for (const es of eraserSegments) {
      if (lineSegmentsDistance(edge, es) <= tol) {
        bad[i] = true;
        bad[i + 1] = true;
        break;
      }
    }
  }

  const runs: [number, number][] = [];
  let s: number | null = null;
  for (let i = 0; i < n; i++) {
    if (!bad[i]) {
      if (s === null) {
        s = i;
      }
    } else {
      if (s !== null && i - 1 >= s && i - 1 - s >= 1) {
        runs.push([s, i - 1]);
      }
      s = null;
    }
  }
  if (s !== null && n - 1 >= s && n - 1 - s >= 1) {
    runs.push([s, n - 1]);
  }

  if (runs.length === 0) {
    return "delete";
  }

  const allKept =
    runs.length === 1 && runs[0][0] === 0 && runs[0][1] === n - 1;
  if (allKept) {
    return null;
  }

  return runs.map(([a, b]) => {
    const sliceP = pts.slice(a, b + 1);
    const pressures = element.pressures;
    const slicePr =
      pressures.length >= b + 1 ? pressures.slice(a, b + 1) : pressures;
    const bx = sliceP[0][0];
    const by = sliceP[0][1];
    const rebased = sliceP.map((p) =>
      pointFrom<LocalPoint>(p[0] - bx, p[1] - by),
    );
    const pr =
      slicePr.length === rebased.length
        ? slicePr
        : rebased.map(() => 0.5);

    return {
      ...element,
      id: randomId(),
      seed: randomInteger(),
      x: element.x + bx,
      y: element.y + by,
      points: rebased,
      pressures: pr,
      boundElements: null,
      version: element.version + 1,
      versionNonce: randomInteger(),
      updated: getUpdatedTimestamp(),
    };
  });
};

/**
 * Stroke eraser: carve pencil (freedraw) strokes; remove other shapes entirely when touched.
 */
export const applyStrokeEraserToElements = (
  elements: readonly OrderedExcalidrawElement[],
  elementsMap: ElementsMap,
  eraserPath: readonly GlobalPoint[],
  brushRadius: number,
  zoom: number,
): OrderedExcalidrawElement[] | null => {
  const segs = buildEraserSegments(eraserPath);
  if (segs.length === 0) {
    return null;
  }

  let changed = false;
  const next: OrderedExcalidrawElement[] = [];
  const appended: ExcalidrawElement[] = [];

  for (const el of elements) {
    if (el.isDeleted) {
      next.push(el);
      continue;
    }
    if (el.locked) {
      next.push(el);
      continue;
    }

    if (isFreeDrawElement(el)) {
      const split = splitFreeDrawByEraser(el, elementsMap, segs, brushRadius);
      if (split === "delete") {
        changed = true;
        next.push(newElementWith(el, { isDeleted: true }));
      } else if (split === null) {
        next.push(el);
      } else {
        changed = true;
        next.push(newElementWith(el, { isDeleted: true }));
        appended.push(...split);
      }
      continue;
    }

    if (elementHitByEraserPath(el, eraserPath, elementsMap, zoom, brushRadius)) {
      changed = true;
      next.push(newElementWith(el, { isDeleted: true }));
    } else {
      next.push(el);
    }
  }

  if (!changed) {
    return null;
  }

  return [...next, ...appended] as OrderedExcalidrawElement[];
};
