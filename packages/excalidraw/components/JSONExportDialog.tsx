import React from "react";

import { getFrame } from "@excalidraw/common";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { actionSaveFileToDisk } from "../actions/actionExport";

import { trackEvent } from "../analytics";
import { exportCanvas, prepareElementsForExport } from "../data";
import { nativeFileSystemSupported } from "../data/filesystem";
import { t } from "../i18n";

import { Card } from "./Card";
import { Dialog } from "./Dialog";
import { ToolButton } from "./ToolButton";
import { exportToFileIcon, LinkIcon, PdfImportIcon } from "./icons";

import "./ExportDialog.scss";

import type { ActionManager } from "../actions/manager";

import type { AppState, ExportOpts, BinaryFiles, UIAppState } from "../types";

export type ExportCB = (
  elements: readonly NonDeletedExcalidrawElement[],
  scale?: number,
) => void;

const JSONExportModal = ({
  elements,
  appState,
  setAppState,
  files,
  actionManager,
  exportOpts,
  canvas,
  onCloseRequest,
  watermarkImageSrc,
}: {
  appState: UIAppState;
  setAppState: React.Component<any, UIAppState>["setState"];
  files: BinaryFiles;
  elements: readonly NonDeletedExcalidrawElement[];
  actionManager: ActionManager;
  onCloseRequest: () => void;
  exportOpts: ExportOpts;
  canvas: HTMLCanvasElement;
  watermarkImageSrc?: string;
}) => {
  const { onExportToBackend } = exportOpts;
  const [isPdfExporting, setIsPdfExporting] = React.useState(false);

  return (
    <div className="ExportDialog ExportDialog--json">
      <div className="ExportDialog-cards">
        {exportOpts.saveFileToDisk && (
          <Card color="lime">
            <div className="Card-icon">{exportToFileIcon}</div>
            <h2>{t("exportDialog.disk_title")}</h2>
            <div className="Card-details">
              {t("exportDialog.disk_details")}
              {!nativeFileSystemSupported &&
                actionManager.renderAction("changeProjectName")}
            </div>
            <ToolButton
              className="Card-button"
              type="button"
              title={t("exportDialog.disk_button")}
              aria-label={t("exportDialog.disk_button")}
              showAriaLabel={true}
              onClick={() => {
                actionManager.executeAction(actionSaveFileToDisk, "ui");
              }}
            />
          </Card>
        )}
        {(exportOpts.saveFileToDisk ||
          onExportToBackend ||
          exportOpts.renderCustomUI) && (
          <Card color="indigo">
            <div className="Card-icon">{PdfImportIcon}</div>
            <h2>{t("exportDialog.pdf_title")}</h2>
            <div className="Card-details">{t("exportDialog.pdf_details")}</div>
            <ToolButton
              className="Card-button"
              type="button"
              title={t("exportDialog.pdf_button")}
              aria-label={t("exportDialog.pdf_button")}
              showAriaLabel={true}
              isLoading={isPdfExporting}
              disabled={isPdfExporting}
              onClick={async () => {
                setIsPdfExporting(true);
                try {
                  trackEvent("export", "pdf", `ui (${getFrame()})`);
                  const { exportedElements, exportingFrame } =
                    prepareElementsForExport(elements, appState, false);
                  await exportCanvas(
                    "pdf",
                    exportedElements,
                    appState as AppState,
                    files,
                    {
                      exportBackground: appState.exportBackground,
                      viewBackgroundColor: appState.viewBackgroundColor,
                      exportingFrame,
                      watermark:
                        watermarkImageSrc && appState.brandingWatermarkEnabled
                          ? {
                              imageSrc: watermarkImageSrc,
                              enabled: true,
                            }
                          : undefined,
                      hostBrandingImageSrc: watermarkImageSrc,
                    },
                  );
                  setAppState({
                    openDialog: null,
                    toast: { message: t("toast.pdfSaved"), duration: 3000 },
                  });
                } catch (error: any) {
                  if (error?.name === "AbortError") {
                    console.warn(error);
                    return;
                  }
                  setAppState({ errorMessage: error.message });
                } finally {
                  setIsPdfExporting(false);
                }
              }}
            />
          </Card>
        )}
        {onExportToBackend && (
          <Card color="pink">
            <div className="Card-icon">{LinkIcon}</div>
            <h2>{t("exportDialog.link_title")}</h2>
            <div className="Card-details">{t("exportDialog.link_details")}</div>
            <ToolButton
              className="Card-button"
              type="button"
              title={t("exportDialog.link_button")}
              aria-label={t("exportDialog.link_button")}
              showAriaLabel={true}
              onClick={async () => {
                try {
                  trackEvent("export", "link", `ui (${getFrame()})`);
                  await onExportToBackend(elements, appState, files);
                  onCloseRequest();
                } catch (error: any) {
                  setAppState({ errorMessage: error.message });
                }
              }}
            />
          </Card>
        )}
        {exportOpts.renderCustomUI &&
          exportOpts.renderCustomUI(elements, appState, files, canvas)}
      </div>
    </div>
  );
};

export const JSONExportDialog = ({
  elements,
  appState,
  files,
  actionManager,
  exportOpts,
  canvas,
  setAppState,
  watermarkImageSrc,
}: {
  elements: readonly NonDeletedExcalidrawElement[];
  appState: UIAppState;
  files: BinaryFiles;
  actionManager: ActionManager;
  exportOpts: ExportOpts;
  canvas: HTMLCanvasElement;
  setAppState: React.Component<any, UIAppState>["setState"];
  watermarkImageSrc?: string;
}) => {
  const handleClose = React.useCallback(() => {
    setAppState({ openDialog: null });
  }, [setAppState]);

  return (
    <>
      {appState.openDialog?.name === "jsonExport" && (
        <Dialog onCloseRequest={handleClose} title={t("buttons.export")}>
          <JSONExportModal
            elements={elements}
            appState={appState}
            setAppState={setAppState}
            files={files}
            actionManager={actionManager}
            onCloseRequest={handleClose}
            exportOpts={exportOpts}
            canvas={canvas}
            watermarkImageSrc={watermarkImageSrc}
          />
        </Dialog>
      )}
    </>
  );
};
