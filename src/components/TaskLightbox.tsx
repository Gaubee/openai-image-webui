/*
 * Intent: full-screen task detail lightbox for the canvas grid (2026-10-06 R11)
 * The webapp redesign moves all task metadata and actions out of inline cards
 * into this viewer: grid items stay pure imagery; click opens the full story.
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import { copyText, downloadImage, downloadText } from "../lib/download";
import { formatCostUsd } from "../lib/pricing";
import { loadTaskInputs } from "../lib/storageNew";

import type { ImageTask } from "../types";

interface TaskLightboxProps {
  task: ImageTask | null;
  onClose: () => void;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
  onClearImage: (id: string) => void;
  onReuseParams: (task: ImageTask) => void;
}

const statusStyles: Record<ImageTask["status"], string> = {
  pending: "bg-surface-2 text-text-secondary ring-surface-3",
  running: "bg-accent/10 text-accent ring-accent/30",
  success: "bg-success/10 text-success ring-success/30",
  error: "bg-error/10 text-error ring-error/30",
  cancelled: "bg-surface-2 text-text-tertiary ring-surface-3",
};

function isI18nKey(value: string) {
  return value.startsWith("tasks.messages.") || value.startsWith("errors.");
}

function formatElapsed(task: ImageTask) {
  if (!task.startedAt) {
    return "-";
  }
  const end = task.finishedAt ?? Date.now();
  return `${Math.max(0, (end - task.startedAt) / 1000).toFixed(1)}s`;
}

function formatTaskDebug(task: ImageTask, errorText: string) {
  return JSON.stringify(
    {
      id: task.id,
      status: task.status,
      error: errorText || undefined,
      model: task.model,
      size: task.size,
      responseFormat: task.responseFormat,
      imageCached: task.imageCached,
      imageSize: task.imageSize,
      outputText: task.outputText,
      debug: task.debug,
    },
    null,
    2,
  );
}

export function TaskLightbox({ task, onClose, onRetry, onCancel, onRemove, onClearImage, onReuseParams }: TaskLightboxProps) {
  const { t } = useTranslation();
  const [inputUrls, setInputUrls] = useState<string[]>([]);

  /* Full-resolution inputs live in IndexedDB (taskInputs store); fall back
     to the small preview thumbnail for tasks created before it existed. */
  useEffect(() => {
    if (!task || task.mode !== "vision") {
      setInputUrls([]);
      return;
    }
    let cancelled = false;
    const created: string[] = [];
    setInputUrls([]);
    void loadTaskInputs(task.id)
      .then((blobs) => {
        if (cancelled || blobs.length === 0) return;
        const urls = blobs.map((blob) => URL.createObjectURL(blob));
        created.push(...urls);
        setInputUrls(urls);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [task?.id, task?.mode]);

  useEffect(() => {
    if (!task) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [task, onClose]);

  if (!task) {
    return null;
  }
  const activeTask: ImageTask = task;

  const isVisionTask = activeTask.mode === "vision";
  const hasImage = Boolean(activeTask.imageUrl);
  const hasStoredImage = hasImage || Boolean(activeTask.imageCached);
  const canCancel = activeTask.status === "pending" || activeTask.status === "running";
  const errorText = activeTask.error ? (isI18nKey(activeTask.error) ? t(activeTask.error) : activeTask.error) : "";
  const hasDebug = Boolean(activeTask.debug);

  async function handleDownload() {
    if (!activeTask.imageUrl) {
      return;
    }
    await downloadImage(activeTask.imageUrl, `openai-image-${activeTask.id.slice(0, 8)}`, activeTask.imageMimeType);
  }

  async function handleCopyImage() {
    if (!activeTask.imageUrl) {
      return;
    }
    await copyText(activeTask.imageUrl);
  }

  async function handleCopyPrompt() {
    await copyText(activeTask.prompt);
  }

  async function handleCopyOutput() {
    if (!activeTask.outputText) {
      return;
    }
    await copyText(activeTask.outputText);
  }

  function handleDownloadOutput() {
    if (!activeTask.outputText) {
      return;
    }
    downloadText(activeTask.outputText, `openai-ocr-${activeTask.id.slice(0, 8)}`);
  }

  async function handleCopyDebug() {
    if (!hasDebug) {
      return;
    }
    await copyText(formatTaskDebug(activeTask, errorText));
  }

  const ghostButton =
    "inline-flex items-center justify-center gap-1.5 rounded border border-surface-3 bg-surface-1 px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary disabled:cursor-not-allowed disabled:text-text-tertiary";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm">
      <button
        className="absolute inset-0 h-full w-full cursor-default"
        type="button"
        onClick={onClose}
        aria-label={t("preview.closePreview")}
      />
      <div className="brushed relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded border border-surface-3 bg-surface-1 shadow-2xl md:flex-row">
        {/* Stage: image / vision output / failure state */}
        <div className="flex min-h-40 flex-1 items-center justify-center overflow-hidden bg-surface-0 p-3 md:p-4">
          {isVisionTask ? (
            inputUrls.length > 0 ? (
              <div className="flex max-h-[78vh] w-full flex-col items-center gap-2 overflow-y-auto">
                {inputUrls.map((url, index) => (
                  <img
                    key={url}
                    className="max-h-[70vh] w-auto max-w-full rounded object-contain"
                    src={url}
                    alt={`input ${index + 1}`}
                  />
                ))}
              </div>
            ) : activeTask.inputThumbnail ? (
              <img className="max-h-[70vh] rounded object-contain" src={activeTask.inputThumbnail} alt="input preview" />
            ) : (
              <div className="text-sm text-text-tertiary">{t("tasks.noTextYet")}</div>
            )
          ) : activeTask.imageUrl ? (
            <img className="max-h-[78vh] max-w-full rounded object-contain" src={activeTask.imageUrl} alt={activeTask.prompt} />
          ) : activeTask.status === "running" || activeTask.status === "pending" ? (
            <div className="flex flex-col items-center gap-2 text-sm text-text-secondary">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-hidden />
              {t("tasks.generating")}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-sm text-text-tertiary">
              <span className="text-error" aria-hidden>
                ✕
              </span>
              {t(`tasks.status.${activeTask.status}`)}
            </div>
          )}
        </div>

        {/* Detail rail */}
        <div className="flex w-full shrink-0 flex-col gap-3 overflow-y-auto border-t border-surface-3 p-4 md:w-80 md:border-l md:border-t-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusStyles[activeTask.status]}`}>
              {t(`tasks.status.${activeTask.status}`)}
            </span>
            <span className="truncate text-xs text-text-tertiary">
              {activeTask.model} · {isVisionTask ? `${activeTask.inputImageCount ?? 0} img` : activeTask.size}
            </span>
          </div>

          <p className="line-clamp-4 text-sm leading-6 text-text-primary">{activeTask.prompt}</p>

          {errorText && (
            <div className="rounded border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">{errorText}</div>
          )}

          {isVisionTask && activeTask.outputText && (
            <div className="rounded border border-surface-3 bg-surface-2 px-3 py-2">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                {t("tasks.outputText")}
              </div>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words font-sans text-xs leading-5 text-text-primary">
                {activeTask.outputText}
              </pre>
            </div>
          )}

          {/* Primary actions */}
          <div className="flex flex-wrap gap-2">
            {!isVisionTask && hasImage && (
              <button type="button" className="inline-flex flex-1 items-center justify-center gap-1.5 rounded border border-accent/40 bg-surface-1 px-3 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent/10" onClick={() => void handleDownload()}>
                <Download className="h-3.5 w-3.5" />
                {t("tasks.actions.download")}
              </button>
            )}
            {!isVisionTask && hasStoredImage && (
              <button type="button" className={ghostButton} onClick={() => onClearImage(activeTask.id)}>
                {t("tasks.actions.deleteImageCache")}
              </button>
            )}
            {(activeTask.status === "error" || activeTask.status === "cancelled") && (
              <button type="button" className={`${ghostButton} flex-1`} onClick={() => onRetry(activeTask.id)}>
                {t("tasks.actions.retry")}
              </button>
            )}
            {canCancel && (
              <button type="button" className={`${ghostButton} flex-1`} onClick={() => onCancel(activeTask.id)}>
                {t("tasks.actions.cancel")}
              </button>
            )}
            {!isVisionTask && (
              <button type="button" className={ghostButton} onClick={() => onReuseParams(activeTask)}>
                {t("tasks.actions.reuseParams")}
              </button>
            )}
          </div>

          {/* Secondary / developer zone */}
          <div className="mt-auto space-y-2 border-t border-surface-3 pt-3 text-[11px] text-text-tertiary">
            <div className="flex items-center justify-between">
              <span>{t("tasks.elapsed", { value: formatElapsed(activeTask) })}</span>
              {activeTask.estimatedCostUsd != null && <span>{t("tasks.fields.cost")}: {formatCostUsd(activeTask.estimatedCostUsd)}</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={ghostButton} onClick={() => void handleCopyPrompt()}>
                {t("tasks.actions.copyPrompt")}
              </button>
              {isVisionTask ? (
                <>
                  <button type="button" className={ghostButton} disabled={!activeTask.outputText} onClick={() => void handleCopyOutput()}>
                    {t("tasks.actions.copyOutput")}
                  </button>
                  <button type="button" className={ghostButton} disabled={!activeTask.outputText} onClick={handleDownloadOutput}>
                    {t("tasks.actions.downloadText")}
                  </button>
                </>
              ) : (
                <button type="button" className={ghostButton} disabled={!hasImage} onClick={() => void handleCopyImage()}>
                  {t("tasks.actions.copyImageUrl")}
                </button>
              )}
              {hasDebug && (
                <button type="button" className={ghostButton} onClick={() => void handleCopyDebug()}>
                  {t("tasks.actions.copyDebug")}
                </button>
              )}
              <button
                type="button"
                className="inline-flex items-center justify-center gap-1.5 rounded border border-error/30 bg-surface-1 px-3 py-2 text-xs font-medium text-error transition-colors hover:bg-error/10"
                onClick={() => {
                  onRemove(activeTask.id);
                  onClose();
                }}
              >
                {t("tasks.actions.delete")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
