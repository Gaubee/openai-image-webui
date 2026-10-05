/*
 * Intent: Batch generation panel for multi-prompt workflows
 * Deep theme applied in R1 redesign (2026-10-06)
 */

import { useMemo, useRef, useState, memo, type ChangeEvent, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { BatchFormState, ImageTask, InputImageFile } from "../types";
import {
  InputImageError,
  modelLikelySupportsMultipleImages,
  modelRequiresStrictPng,
  prepareInputImage,
} from "../lib/imageInput";
import { parsePromptList, readPromptListFile } from "../lib/promptList";
import { batchProgress, tasksOfBatch } from "../lib/batchExport";
import { defaultSizeForGroup, getRatioChipGroups, ratioLabel } from "../lib/imageSizing";
import { Notice } from "./Notice";
import { ImageDropzone } from "./ImageDropzone";

interface BatchGenerationPanelProps {
  form: BatchFormState;
  error: string;
  model?: string;
  tasks: ImageTask[];
  currentBatchId: string | null;
  isExporting?: boolean;
  onChange: (next: Partial<BatchFormState>) => void;
  onSubmit: () => void;
  onRetryBatchErrors: () => void;
  onExportBatch: () => void;
}

const PROMPT_FILE_ACCEPT = ".txt,.md,.csv,text/plain,text/markdown,text/csv";

export const BatchGenerationPanel = memo(function BatchGenerationPanel({
  form,
  error,
  model,
  tasks,
  currentBatchId,
  isExporting,
  onChange,
  onSubmit,
  onRetryBatchErrors,
  onExportBatch,
}: BatchGenerationPanelProps) {
  const { t } = useTranslation();
  const ratioChipGroups = useMemo(() => getRatioChipGroups(model ?? ""), [model]);
  const [inputImageError, setInputImageError] = useState("");
  const promptFileInputRef = useRef<HTMLInputElement>(null);

  const strictPng = modelRequiresStrictPng(model ?? "");
  const supportsMultiImage = modelLikelySupportsMultipleImages(model ?? "");
  const isEditMode = form.inputImages.length > 0;

  const parsed = useMemo(() => parsePromptList(form.promptsText), [form.promptsText]);
  const totalTasksToCreate = parsed.prompts.length * Math.max(1, Math.floor(form.countPerPrompt || 1));

  const progress = useMemo(
    () => (currentBatchId ? batchProgress(tasks, currentBatchId) : null),
    [tasks, currentBatchId],
  );
  const batchTasks = useMemo(
    () => (currentBatchId ? tasksOfBatch(tasks, currentBatchId) : []),
    [tasks, currentBatchId],
  );
  const successCount = progress?.success ?? 0;
  const errorCount = progress?.error ?? 0;
  const finishedCount = progress
    ? progress.success + progress.error + progress.cancelled
    : 0;
  const percent =
    progress && progress.total > 0
      ? Math.round((finishedCount / progress.total) * 100)
      : 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  async function handleAddInputImages(files: FileList | File[]) {
    setInputImageError("");
    const list = Array.from(files);
    const prepared: InputImageFile[] = [];
    for (const file of list) {
      try {
        const item = await prepareInputImage(file, { strictPngOnly: strictPng });
        prepared.push(item);
      } catch (err) {
        const reason = err instanceof InputImageError ? err.message : String(err);
        setInputImageError(t("batch.inputImages.title") + ": " + reason);
        prepared.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        return;
      }
    }
    if (prepared.length === 0) return;
    onChange({ inputImages: [...form.inputImages, ...prepared] });
  }

  function removeInputImage(id: string) {
    const next = form.inputImages.filter((item) => {
      if (item.id === id) {
        URL.revokeObjectURL(item.previewUrl);
        return false;
      }
      return true;
    });
    onChange({ inputImages: next });
  }

  async function handlePromptFileImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const text = await readPromptListFile(file);
      onChange({ promptsText: text });
    } catch (err) {
      setInputImageError(
        t("batch.prompts.importFailed", { reason: err instanceof Error ? err.message : String(err) }),
      );
    }
  }

  const acceptMime = strictPng ? "image/png" : "image/png,image/jpeg,image/webp";
  const showMultiImageWarning =
    form.inputImages.length > 1 && !!model && !supportsMultiImage;

  return (
    <section className="rounded border border-surface-3 bg-surface-1 p-5">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-text-primary">{t("batch.title")}</h2>
        <p className="mt-1 text-sm text-text-secondary">{t("batch.subtitle")}</p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {/* Prompt list */}
        <div className="rounded border border-surface-3 bg-surface-2 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-text-primary">{t("batch.prompts.title")}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded border border-surface-3 bg-surface-1 px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
                onClick={() => promptFileInputRef.current?.click()}
              >
                {t("batch.prompts.importButton")}
              </button>
              <input
                ref={promptFileInputRef}
                type="file"
                accept={PROMPT_FILE_ACCEPT}
                hidden
                onChange={handlePromptFileImport}
              />
              <button
                type="button"
                className="rounded border border-surface-3 bg-surface-1 px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-error/10 hover:text-error disabled:cursor-not-allowed disabled:text-text-tertiary"
                onClick={() => onChange({ promptsText: "" })}
                disabled={!form.promptsText}
              >
                {t("batch.prompts.clearButton")}
              </button>
            </div>
          </div>
          <p className="mt-1 text-xs text-text-secondary">{t("batch.prompts.hint")}</p>
          <textarea
            className="mt-2 min-h-40 w-full resize-y rounded border border-surface-3 bg-surface-1 px-3 py-2.5 font-mono text-sm text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-accent focus:ring-2 focus:ring-accent/30"
            placeholder={t("batch.prompts.placeholder")}
            value={form.promptsText}
            onChange={(event) => onChange({ promptsText: event.target.value })}
          />
          <p className="mt-2 text-xs text-text-secondary">
            {t("batch.prompts.parsedSummary", {
              count: parsed.prompts.length,
              comments: parsed.commentLines,
              empty: parsed.emptyLines,
            })}
          </p>
        </div>

        {/* Shared reference images (optional) */}
        <ImageDropzone
          images={form.inputImages}
          onAdd={handleAddInputImages}
          onRemove={removeInputImage}
          title={t("batch.inputImages.title")}
          hint={t("batch.inputImages.hint")}
          addButtonLabel={t("batch.inputImages.addButton")}
          removeLabel={t("batch.inputImages.remove")}
          accept={acceptMime}
          badge={isEditMode ? t("batch.inputImages.editModeBadge") : undefined}
          warning={showMultiImageWarning ? t("batch.inputImages.multipleImagesWarning") : undefined}
          error={inputImageError || undefined}
        />

        {/* Size + count + advanced */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="block">
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-text-primary">{t("batch.size")}</span>
              <span className="text-xs tabular-nums text-text-tertiary">
                {form.size.trim() || "1024x1024"} · {ratioLabel(form.size) || "1:1"}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ratioChipGroups.map((group) => {
                const active = ratioLabel(form.size) === group.ratio;
                return (
                  <button
                    key={group.ratio}
                    type="button"
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-surface-3 bg-surface-1 text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                    }`}
                    onClick={() => onChange({ size: defaultSizeForGroup(group) })}
                    title={group.sizes.join(" · ")}
                  >
                    {group.ratio}
                  </button>
                );
              })}
            </div>
            <details className="group mt-1.5 rounded border border-surface-3 bg-surface-2 p-2.5 outline-none [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer select-none list-none items-center justify-between text-xs font-medium text-text-secondary focus:outline-none">
                <span>{t("generation.customSize")}</span>
                <span className="text-[10px] text-text-tertiary transition-transform group-open:rotate-180">▼</span>
              </summary>
              <input
                className="mt-2 w-full rounded border border-surface-3 bg-surface-1 px-3 py-2 text-xs tabular-nums text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-accent"
                value={form.size}
                placeholder="1024x1024"
                onChange={(event) => onChange({ size: event.target.value })}
              />
            </details>
          </div>
          <div className="block">
            <span className="mb-1.5 block text-sm font-medium text-text-primary">{t("batch.countPerPrompt")}</span>
            <div className="inline-flex items-center rounded border border-surface-3 bg-surface-1">
              <button
                type="button"
                className="px-2.5 py-2 text-text-secondary transition-colors hover:text-text-primary disabled:cursor-not-allowed disabled:text-text-tertiary"
                onClick={() => onChange({ countPerPrompt: Math.max(1, form.countPerPrompt - 1) })}
                disabled={form.countPerPrompt <= 1}
                aria-label="-"
              >
                −
              </button>
              <input
                type="number"
                min={1}
                max={20}
                className="w-12 border-x border-surface-3 bg-transparent py-2 text-center text-sm tabular-nums text-text-primary outline-none"
                value={form.countPerPrompt}
                onChange={(event) => onChange({ countPerPrompt: Math.min(20, Math.max(1, Number(event.target.value) || 1)) })}
                aria-label={t("batch.countPerPrompt")}
              />
              <button
                type="button"
                className="px-2.5 py-2 text-text-secondary transition-colors hover:text-text-primary disabled:cursor-not-allowed disabled:text-text-tertiary"
                onClick={() => onChange({ countPerPrompt: Math.min(20, form.countPerPrompt + 1) })}
                disabled={form.countPerPrompt >= 20}
                aria-label="+"
              >
                +
              </button>
            </div>
            <p className="mt-1 text-xs text-text-secondary">{t("batch.countPerPromptHint")}</p>
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-text-primary">{t("batch.advancedJsonParams")}</span>
          <textarea
            className="min-h-24 w-full resize-y rounded border border-surface-3 bg-surface-1 px-3 py-2.5 font-mono text-sm text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-accent focus:ring-2 focus:ring-accent/30"
            placeholder={'{\n  "quality": "high"\n}'}
            value={form.advancedJson}
            onChange={(event) => onChange({ advancedJson: event.target.value })}
          />
        </label>

        {error ? <Notice variant="error">{error}</Notice> : null}

        {/* Submit */}
        <div className="rounded border border-surface-3 bg-surface-2 p-3">
          <p className="text-xs text-text-secondary">
            {t("batch.submitSummary", {
              prompts: parsed.prompts.length,
              count: Math.max(1, Math.floor(form.countPerPrompt || 1)),
              total: totalTasksToCreate,
            })}
          </p>
          <button
            type="submit"
            className="mt-2 inline-flex w-full items-center justify-center rounded border border-accent bg-accent px-5 py-3 text-sm font-semibold text-surface-0 transition-colors hover:bg-accent-dim disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-text-tertiary"
            disabled={parsed.prompts.length === 0}
          >
            {isEditMode ? t("batch.startEdit") : t("batch.startGenerate")}
          </button>
        </div>
      </form>

      {/* Current batch progress */}
      {currentBatchId && progress ? (
        <div className="mt-5 rounded border border-accent/30 bg-accent/10 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-text-primary">{t("batch.progress.title")}</p>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-mono text-text-tertiary">
              {currentBatchId}
            </span>
          </div>
          <p className="mt-1 text-xs text-text-secondary">
            {t("batch.progress.summary", {
              done: finishedCount,
              total: progress.total,
              running: progress.running,
              error: progress.error,
            })}
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-3">
            <div className="h-full bg-accent transition-all" style={{ width: `${percent}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded border border-warning/30 bg-surface-1 px-3 py-1.5 text-xs font-medium text-warning transition-colors hover:bg-warning/10 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onRetryBatchErrors}
              disabled={errorCount === 0}
            >
              {t("batch.actions.retryErrors", { count: errorCount })}
            </button>
            <button
              type="button"
              className="rounded border border-accent bg-accent px-3 py-1.5 text-xs font-medium text-surface-0 transition-colors hover:bg-accent-dim disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onExportBatch}
              disabled={successCount === 0 || Boolean(isExporting)}
            >
              {isExporting
                ? t("batch.actions.exporting")
                : t("batch.actions.exportZip", { count: successCount })}
            </button>
          </div>
          {batchTasks.length > 0 ? (
            <p className="mt-2 text-[11px] text-text-tertiary">
              {t("batch.progress.tasksHint")}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
});
