/*
 * Intent: Result card for generated/edited images (2026-10-06 R1 fix)
 * Redesigned: deep theme, image as hero, Download primary, metadata compact, Debug in menu
 */

import { memo, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, Maximize2, MoreVertical } from "lucide-react";
import { copyText, downloadImage, downloadText } from "../lib/download";
import { formatCostUsd } from "../lib/pricing";

import type { ImageTask } from "../types";

interface TaskCardProps {
  task: ImageTask;
  onPreview: (imageUrl: string) => void;
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

function formatElapsed(task: ImageTask) {
  if (!task.startedAt) {
    return "-";
  }

  const end = task.finishedAt ?? Date.now();
  return `${Math.max(0, (end - task.startedAt) / 1000).toFixed(1)}s`;
}

function actionButtonClass(variant: "default" | "primary" = "default", disabled = false) {
  if (variant === "primary") {
    return `rounded border px-3 py-1.5 text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${
      disabled
        ? "cursor-not-allowed border-surface-3 bg-surface-2 text-text-tertiary"
        : "border-accent bg-accent text-surface-0 hover:bg-accent-dim"
    }`;
  }
  return `rounded border px-3 py-1.5 text-xs font-medium transition-colors ${
    disabled
      ? "cursor-not-allowed border-surface-3 bg-surface-2 text-text-tertiary"
      : "border-surface-3 bg-surface-1 text-text-secondary hover:bg-surface-2 hover:text-text-primary"
  }`;
}

function menuItemClass(disabled = false, danger = false) {
  return `block w-full rounded px-3 py-2 text-left text-xs font-medium transition-colors ${
    disabled
      ? "cursor-not-allowed text-text-tertiary"
      : danger
        ? "text-error hover:bg-error/10"
        : "text-text-secondary hover:bg-surface-2"
  }`;
}

function isI18nKey(value: string) {
  return value.startsWith("tasks.messages.") || value.startsWith("errors.");
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

export const TaskCard = memo(function TaskCard({ task, onPreview, onRetry, onCancel, onRemove, onClearImage, onReuseParams }: TaskCardProps) {
  const { t } = useTranslation();
  const [messageKey, setMessageKey] = useState<string>("");
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const isVisionTask = task.mode === "vision";
  const hasImage = Boolean(task.imageUrl);
  const hasStoredImage = hasImage || Boolean(task.imageCached);
  const hasOutputText = Boolean(task.outputText?.trim());
  const hasDebug = Boolean(task.debug);

  const canCancel = task.status === "pending" || task.status === "running";

  useEffect(() => {
    if (!actionsMenuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
        setActionsMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActionsMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [actionsMenuOpen]);

  async function handleCopyImage() {
    if (!task.imageUrl) {
      return;
    }

    await copyText(task.imageUrl);
    setMessageKey("tasks.messages.imageUrlCopied");
  }

  async function handleCopyPrompt() {
    await copyText(task.prompt);
    setMessageKey("tasks.messages.promptCopied");
  }

  async function handleCopyOutputText() {
    if (!task.outputText) {
      return;
    }

    await copyText(task.outputText);
    setMessageKey("tasks.messages.outputCopied");
  }

  function handleDownloadOutputText() {
    if (!task.outputText) {
      return;
    }

    downloadText(task.outputText, `openai-ocr-${task.id.slice(0, 8)}`);
    setMessageKey("tasks.messages.outputDownloadStarted");
  }

  async function handleCopyDebug() {
    if (!hasDebug) {
      return;
    }

    await copyText(formatTaskDebug(task, errorText));
    setMessageKey("tasks.messages.debugCopied");
  }

  async function handleDownload() {
    if (!task.imageUrl) {
      return;
    }

    await downloadImage(task.imageUrl, `openai-image-${task.id.slice(0, 8)}`, task.imageMimeType);

    setMessageKey("tasks.messages.downloadStarted");
  }

  function handleClearImage() {
    if (!hasStoredImage) {
      return;
    }

    onClearImage(task.id);
    setMessageKey("tasks.messages.imageCacheDeleted");
  }

  const errorText = task.error
    ? isI18nKey(task.error)
      ? t(task.error)
      : task.error
    : "";
  const placeholderText = isVisionTask
    ? task.status === "running"
      ? t("tasks.analyzing")
      : t("tasks.noTextYet")
    : task.imageCached
      ? t("tasks.restoringCachedImage")
      : task.status === "running"
        ? t("tasks.generating")
        : t("tasks.noImageYet");

  return (
    <article className="rounded border border-surface-3 bg-surface-1 shadow-soft">
      {/* Image hero (large) */}
      <div className="flex min-h-64 items-center justify-center overflow-hidden bg-surface-2">
        {isVisionTask ? (
          task.inputThumbnail ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4">
              <img
                className="h-20 w-20 rounded object-cover ring-1 ring-surface-3"
                src={task.inputThumbnail}
                alt="input preview"
              />
              <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
                <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold text-text-secondary">OCR</span>
                {placeholderText}
              </div>
            </div>
          ) : (
            <div className="px-6 text-center text-sm text-text-tertiary">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded bg-surface-2 text-lg font-bold text-text-secondary">
                OCR
              </div>
              {placeholderText}
            </div>
          )
        ) : task.imageUrl ? (
          <button
            type="button"
            className="group relative h-full w-full"
            onClick={() => onPreview(task.imageUrl as string)}
            aria-label={t("tasks.previewGeneratedImage")}
          >
            <img
              className="h-full max-h-[60vh] w-full object-contain"
              src={task.imageUrl}
              alt={task.prompt}
              loading="lazy"
            />
            <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded bg-surface-0/80 px-2.5 py-1.5 text-xs font-medium text-text-primary opacity-0 transition-opacity group-hover:opacity-100">
              <Maximize2 className="h-3.5 w-3.5" />
              {t("tasks.previewGeneratedImage")}
            </span>
          </button>
        ) : (
          <div className="px-6 text-center text-sm text-text-tertiary">{placeholderText}</div>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Status + metadata compact row */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-text-tertiary">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusStyles[task.status]}`}
          >
            {t(`tasks.status.${task.status}`)}
          </span>
          <span>
            {task.model} · {isVisionTask ? `${task.inputImageCount ?? 0} img` : task.size}
          </span>
          {task.imageCached && (
            <span className="rounded-full bg-surface-2 px-2.5 py-1 font-medium">
              {t("tasks.cache.cachedBadge")}
            </span>
          )}
        </div>

        {/* Prompt */}
        <p className="line-clamp-2 text-sm leading-6 text-text-primary">{task.prompt}</p>

        {/* Output text (Vision OCR) */}
        {hasOutputText && (
          <div className="rounded border border-surface-3 bg-surface-2 px-3 py-2 text-sm leading-6 text-text-primary">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">
              {t("tasks.outputText")}
            </div>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-sans">{task.outputText}</pre>
          </div>
        )}

        {/* Error */}
        {errorText && (
          <div className="rounded border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
            {errorText}
          </div>
        )}

        {/* Message feedback */}
        {messageKey && <div className="text-xs text-success">{t(messageKey)}</div>}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {!isVisionTask && hasImage && (
            <>
              <button
                type="button"
                className={actionButtonClass("primary")}
                onClick={handleDownload}
              >
                <Download className="h-3.5 w-3.5" />
                {t("tasks.actions.download")}
              </button>
              <button
                type="button"
                className={actionButtonClass()}
                onClick={() => task.imageUrl && onPreview(task.imageUrl)}
              >
                {t("tasks.actions.preview")}
              </button>
            </>
          )}
          {!isVisionTask && (
            <button
              type="button"
              className={actionButtonClass()}
              onClick={() => onReuseParams(task)}
            >
              {t("tasks.actions.reuseParams")}
            </button>
          )}
          {(task.status === "error" || task.status === "cancelled") && (
            <button type="button" className={actionButtonClass()} onClick={() => onRetry(task.id)}>
              {t("tasks.actions.retry")}
            </button>
          )}
          {canCancel && (
            <button type="button" className={actionButtonClass()} onClick={() => onCancel(task.id)}>
              {t("tasks.actions.cancel")}
            </button>
          )}

          {/* More menu (Debug details, elapsed, cost, delete) */}
          <div className="relative" ref={actionsMenuRef}>
            <button
              type="button"
              className={actionButtonClass()}
              aria-label={t("tasks.actions.more")}
              aria-expanded={actionsMenuOpen}
              aria-haspopup="menu"
              onClick={() => setActionsMenuOpen((open) => !open)}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
            {actionsMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-10 mt-1 w-48 rounded border border-surface-3 bg-surface-1 p-1 shadow-soft"
              >
                {isVisionTask ? (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      className={menuItemClass(!hasOutputText)}
                      disabled={!hasOutputText}
                      onClick={() => {
                        setActionsMenuOpen(false);
                        void handleCopyOutputText();
                      }}
                    >
                      {t("tasks.actions.copyOutput")}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={menuItemClass(!hasOutputText)}
                      disabled={!hasOutputText}
                      onClick={() => {
                        setActionsMenuOpen(false);
                        handleDownloadOutputText();
                      }}
                    >
                      {t("tasks.actions.downloadText")}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    className={menuItemClass(!hasImage)}
                    disabled={!hasImage}
                    onClick={() => {
                      setActionsMenuOpen(false);
                      void handleCopyImage();
                    }}
                  >
                    {t("tasks.actions.copyImageUrl")}
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  className={menuItemClass()}
                  onClick={() => {
                    setActionsMenuOpen(false);
                    void handleCopyPrompt();
                  }}
                >
                  {t("tasks.actions.copyPrompt")}
                </button>
                {!isVisionTask && (
                  <button
                    type="button"
                    role="menuitem"
                    className={menuItemClass(!hasStoredImage)}
                    disabled={!hasStoredImage}
                    onClick={() => {
                      setActionsMenuOpen(false);
                      handleClearImage();
                    }}
                  >
                    {t("tasks.actions.deleteImageCache")}
                  </button>
                )}
                <div className="my-1 border-t border-surface-3" role="separator" />
                {/* Developer details in deep space */}
                <div className="px-3 py-2 text-[10px] text-text-tertiary space-y-0.5">
                  <div>{t("tasks.elapsed", { value: formatElapsed(task) })}</div>
                  {task.estimatedCostUsd != null && (
                    <div>
                      {t("tasks.fields.cost")}: {formatCostUsd(task.estimatedCostUsd)}
                    </div>
                  )}
                </div>
                {hasDebug && (
                  <button
                    type="button"
                    role="menuitem"
                    className={menuItemClass()}
                    onClick={() => {
                      setActionsMenuOpen(false);
                      void handleCopyDebug();
                    }}
                  >
                    {t("tasks.actions.copyDebug")}
                  </button>
                )}
                <div className="my-1 border-t border-surface-3" role="separator" />
                <button
                  type="button"
                  role="menuitem"
                  className={menuItemClass(false, true)}
                  onClick={() => {
                    setActionsMenuOpen(false);
                    onRemove(task.id);
                  }}
                >
                  {t("tasks.actions.delete")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
});
