/*
 * Intent: Batch image renaming panel with AI-powered naming
 * Deep theme applied in R1 redesign (2026-10-06)
 */

import { useCallback, useRef, useState, memo } from "react";
import { useTranslation } from "react-i18next";
import type { AppSettings } from "../types";
import type { RenameItem } from "../lib/batchRename";
import type { NamingMode } from "../lib/batchRename";
import {
  buildFinalName,
  callAIForName,
  compressImageForAI,
  downloadRenamedZip,
  downloadScriptZip,
  generateThumbnailUrl,
} from "../lib/batchRename";

interface BatchRenamePanelProps {
  settings: AppSettings;
}

const ACCEPTED_FORMATS = ".jpg,.jpeg,.png,.webp,.tga,.bmp";

export const BatchRenamePanel = memo(function BatchRenamePanel({ settings }: BatchRenamePanelProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<RenameItem[]>([]);
  const [namingMode, setNamingMode] = useState<NamingMode>("compact");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) =>
      /\.(jpe?g|png|webp|tga|bmp)$/i.test(f.name),
    );
    if (fileArray.length === 0) return;

    const newItems: RenameItem[] = await Promise.all(
      fileArray.map(async (file) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        let thumbnailUrl = "";
        try {
          thumbnailUrl = await generateThumbnailUrl(file);
        } catch { /* ignore */ }
        return {
          id,
          originalName: file.name,
          newName: "",
          status: "pending" as const,
          thumbnailUrl,
          file,
        };
      }),
    );

    setItems((prev) => [...prev, ...newItems]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
        e.target.value = "";
      }
    },
    [handleFiles],
  );

  const startRename = useCallback(async () => {
    if (!settings.apiKey.trim() || !settings.baseUrl.trim() || !settings.visionModel.trim()) return;

    const pendingItems = items.filter((i) => i.status === "pending" || i.status === "error");
    if (pendingItems.length === 0) return;

    setIsProcessing(true);
    const controller = new AbortController();
    abortRef.current = controller;

    for (const [index, item] of pendingItems.entries()) {
      if (controller.signal.aborted) break;

      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: "processing" } : i)),
      );

      try {
        const compressed = await compressImageForAI(item.file);
        const aiName = await callAIForName({
          apiKey: settings.apiKey,
          baseUrl: settings.baseUrl,
          model: settings.visionModel,
          imageBlob: compressed,
          namingMode,
          signal: controller.signal,
        });
        const finalName = buildFinalName(aiName, item.originalName, index + 1);

        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, status: "done", newName: finalName } : i,
          ),
        );
      } catch (err) {
        if (controller.signal.aborted) break;
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, status: "error", error: err instanceof Error ? err.message : "Unknown error" }
              : i,
          ),
        );
      }
    }

    setIsProcessing(false);
    abortRef.current = null;
  }, [items, settings, namingMode]);

  const stopProcessing = useCallback(() => {
    abortRef.current?.abort();
    setIsProcessing(false);
  }, []);

  const clearAll = useCallback(() => {
    abortRef.current?.abort();
    setItems([]);
    setIsProcessing(false);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const doneCount = items.filter((i) => i.status === "done").length;
  const canDownload = doneCount > 0;

  const settingsOk = settings.apiKey.trim() && settings.baseUrl.trim() && settings.visionModel.trim();

  return (
    <section className="rounded border border-surface-3 bg-surface-1 p-5">
      <div className="mb-5">
        <p className="text-sm text-text-secondary">{t("batchRename.subtitle")}</p>
      </div>

      <div className="space-y-4">

      {/* Drop zone */}
      <div
        className={`flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded border-2 border-dashed transition-colors ${
          isDragging
            ? "border-accent bg-accent/10"
            : "border-surface-3 bg-surface-2 hover:border-surface-4"
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <p className="text-sm text-text-secondary">{t("batchRename.dropHint")}</p>
        <p className="mt-1 text-xs text-text-tertiary">{t("batchRename.formatHint")}</p>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept={ACCEPTED_FORMATS}
          onChange={handleFileInput}
        />
      </div>

      {/* Naming mode toggle */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-text-primary">{t("batchRename.namingMode")}</span>
        <div className="inline-flex rounded border border-surface-3 bg-surface-2 p-0.5">
          <button
            type="button"
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              namingMode === "compact"
                ? "bg-accent text-surface-0"
                : "text-text-secondary hover:text-text-primary"
            }`}
            onClick={() => setNamingMode("compact")}
          >
            {t("batchRename.modeCompact")}
          </button>
          <button
            type="button"
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              namingMode === "descriptive"
                ? "bg-accent text-surface-0"
                : "text-text-secondary hover:text-text-primary"
            }`}
            onClick={() => setNamingMode("descriptive")}
          >
            {t("batchRename.modeDescriptive")}
          </button>
        </div>
        <span className="text-xs text-text-tertiary">
          {namingMode === "compact"
            ? t("batchRename.modeCompactHint")
            : t("batchRename.modeDescriptiveHint")}
        </span>
      </div>

      {/* Item list */}
      {items.length > 0 && (
        <div className="max-h-[400px] space-y-1 overflow-y-auto rounded border border-surface-3 bg-surface-2 p-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded px-2 py-1.5 text-sm hover:bg-surface-3"
            >
              {/* Thumbnail */}
              {item.thumbnailUrl ? (
                <img
                  src={item.thumbnailUrl}
                  alt=""
                  className="h-10 w-10 flex-shrink-0 rounded object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-surface-3 text-xs text-text-tertiary">
                  IMG
                </div>
              )}

              {/* Names */}
              <div className="min-w-0 flex-1">
                <div className="truncate text-text-secondary">{item.originalName}</div>
                {item.newName && (
                  <div className="flex items-center gap-1 truncate">
                    <span className="text-text-tertiary">→</span>
                    <span className="font-medium text-success">{item.newName}</span>
                  </div>
                )}
                {item.error && (
                  <div className="truncate text-xs text-error">{item.error}</div>
                )}
              </div>

              {/* Status badge */}
              <div className="flex-shrink-0">
                {item.status === "pending" && (
                  <span className="rounded bg-surface-3 px-2 py-0.5 text-xs text-text-secondary">
                    {t("batchRename.statusPending")}
                  </span>
                )}
                {item.status === "processing" && (
                  <span className="rounded bg-accent/20 px-2 py-0.5 text-xs text-accent">
                    {t("batchRename.statusProcessing")}
                  </span>
                )}
                {item.status === "done" && (
                  <span className="rounded bg-success/20 px-2 py-0.5 text-xs text-success">✓</span>
                )}
                {item.status === "error" && (
                  <span className="rounded bg-error/20 px-2 py-0.5 text-xs text-error">✗</span>
                )}
              </div>

              {/* Remove button */}
              {!isProcessing && (
                <button
                  type="button"
                  className="flex-shrink-0 text-text-tertiary hover:text-error"
                  onClick={() => removeItem(item.id)}
                  title={t("batchRename.remove")}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      {items.length > 0 && (
        <div className="text-xs text-text-secondary">
          {t("batchRename.stats", { total: items.length, done: doneCount })}
        </div>
      )}

      {/* Validation hint */}
      {!settingsOk && items.length > 0 && (
        <div className="rounded border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          {t("batchRename.settingsRequired")}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {!isProcessing ? (
          <button
            type="button"
            disabled={items.length === 0 || !settingsOk}
            className="rounded border border-accent bg-accent px-5 py-3 text-sm font-semibold text-surface-0 transition-colors hover:bg-accent-dim disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-text-tertiary"
            onClick={startRename}
          >
            {t("batchRename.start")}
          </button>
        ) : (
          <button
            type="button"
            className="rounded border border-error bg-error px-5 py-3 text-sm font-semibold text-surface-0 transition-colors hover:bg-error/80"
            onClick={stopProcessing}
          >
            {t("batchRename.stop")}
          </button>
        )}

        <button
          type="button"
          disabled={!canDownload}
          className="rounded border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => downloadScriptZip(items)}
        >
          {t("batchRename.downloadScript")}
        </button>

        <button
          type="button"
          disabled={!canDownload}
          className="rounded border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => downloadRenamedZip(items)}
        >
          {t("batchRename.downloadZip")}
        </button>

        {items.length > 0 && !isProcessing && (
          <button
            type="button"
            className="rounded border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-error/10 hover:text-error"
            onClick={clearAll}
          >
            {t("batchRename.clear")}
          </button>
        )}
      </div>
      </div>
    </section>
  );
});
