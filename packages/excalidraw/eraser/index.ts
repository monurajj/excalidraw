import { arrayToMap, easeOut, THEME } from "@excalidraw/common";

import {
  getBoundTextElementId,
  getElementsInGroup,
  hasBoundTextElement,
  isBoundToContainer,
} from "@excalidraw/element";
import { lineSegment, pointFrom } from "@excalidraw/math";
import { LaserPointer } from "@excalidraw/laser-pointer";

import { AnimatedTrail } from "../animated-trail";

import { eraserTest } from "./eraserHitTest";

import type { GlobalPoint } from "@excalidraw/math/types";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { AnimationFrameHandler } from "../animation-frame-handler";
import type App from "../components/App";

export { eraserTest, elementHitByEraserPath } from "./eraserHitTest";
export { applyStrokeEraserToElements } from "./partialErase";

export class EraserTrail extends AnimatedTrail {
  private elementsToErase: Set<ExcalidrawElement["id"]> = new Set();
  private groupsToErase: Set<ExcalidrawElement["id"]> = new Set();

  constructor(animationFrameHandler: AnimationFrameHandler, app: App) {
    super(animationFrameHandler, app, {
      streamline: 0.2,
      size: 14,
      keepHead: true,
      sizeMapping: (c) => {
        const DECAY_TIME = 200;
        const DECAY_LENGTH = 10;
        const t = Math.max(
          0,
          1 - (performance.now() - c.pressure) / DECAY_TIME,
        );
        const l =
          (DECAY_LENGTH -
            Math.min(DECAY_LENGTH, c.totalLength - c.currentIndex)) /
          DECAY_LENGTH;

        return Math.min(easeOut(l), easeOut(t));
      },
      fill: () =>
        app.state.theme === THEME.LIGHT
          ? "rgba(0, 0, 0, 0.2)"
          : "rgba(255, 255, 255, 0.2)",
    });
  }

  protected createLaserPointer(): LaserPointer {
    const size = Math.max(2, Math.min(56, this.app.state.eraserBrushSize ?? 14));
    return new LaserPointer({
      ...this.options,
      size,
    });
  }

  startPath(x: number, y: number): void {
    this.endPath();
    super.startPath(x, y);
    this.elementsToErase.clear();
  }

  addPointToPath(x: number, y: number, restore = false) {
    super.addPointToPath(x, y);

    const elementsToEraser = this.updateElementsToBeErased(restore);

    return elementsToEraser;
  }

  /** Scene-space points along the current eraser stroke (before endPath). */
  peekCurrentPath(): GlobalPoint[] {
    const t = this.getCurrentTrail();
    if (!t?.originalPoints?.length) {
      return [];
    }
    return t.originalPoints.map((p) => pointFrom<GlobalPoint>(p[0], p[1]));
  }

  private updateElementsToBeErased(restoreToErase?: boolean) {
    if (this.app.state.eraserMode === "stroke") {
      return [];
    }

    const brushRadius = this.app.state.eraserBrushSize / 2;

    const eraserPath: GlobalPoint[] =
      super
        .getCurrentTrail()
        ?.originalPoints?.map((p) => pointFrom<GlobalPoint>(p[0], p[1])) || [];

    if (eraserPath.length < 2) {
      return [];
    }

    const pathSegment = lineSegment<GlobalPoint>(
      eraserPath[eraserPath.length - 1],
      eraserPath[eraserPath.length - 2],
    );

    const candidateElements = this.app.visibleElements.filter(
      (el) => !el.locked && el.type !== "image",
    );

    const candidateElementsMap = arrayToMap(candidateElements);

    for (const element of candidateElements) {
      if (restoreToErase && this.elementsToErase.has(element.id)) {
        const intersects = eraserTest(
          pathSegment,
          element,
          candidateElementsMap,
          this.app.state.zoom.value,
          brushRadius,
        );

        if (intersects) {
          const shallowestGroupId = element.groupIds.at(-1)!;

          if (this.groupsToErase.has(shallowestGroupId)) {
            const elementsInGroup = getElementsInGroup(
              this.app.scene.getNonDeletedElementsMap(),
              shallowestGroupId,
            );
            for (const elementInGroup of elementsInGroup) {
              this.elementsToErase.delete(elementInGroup.id);
            }
            this.groupsToErase.delete(shallowestGroupId);
          }

          if (isBoundToContainer(element)) {
            this.elementsToErase.delete(element.containerId);
          }

          if (hasBoundTextElement(element)) {
            const boundText = getBoundTextElementId(element);

            if (boundText) {
              this.elementsToErase.delete(boundText);
            }
          }

          this.elementsToErase.delete(element.id);
        }
      } else if (!restoreToErase && !this.elementsToErase.has(element.id)) {
        const intersects = eraserTest(
          pathSegment,
          element,
          candidateElementsMap,
          this.app.state.zoom.value,
          brushRadius,
        );

        if (intersects) {
          const shallowestGroupId = element.groupIds.at(-1)!;

          if (!this.groupsToErase.has(shallowestGroupId)) {
            const elementsInGroup = getElementsInGroup(
              this.app.scene.getNonDeletedElementsMap(),
              shallowestGroupId,
            );

            for (const elementInGroup of elementsInGroup) {
              this.elementsToErase.add(elementInGroup.id);
            }
            this.groupsToErase.add(shallowestGroupId);
          }

          if (hasBoundTextElement(element)) {
            const boundText = getBoundTextElementId(element);

            if (boundText) {
              this.elementsToErase.add(boundText);
            }
          }

          if (isBoundToContainer(element)) {
            this.elementsToErase.add(element.containerId);
          }

          this.elementsToErase.add(element.id);
        }
      }
    }

    return Array.from(this.elementsToErase);
  }

  endPath(): void {
    super.endPath();
    super.clearTrails();
    this.elementsToErase.clear();
    this.groupsToErase.clear();
  }
}
