/*
 * Intent: canvas grid for the webapp shell (2026-10-06 R11 redesign)
 * Images are the protagonist: success tiles are pure imagery with hover
 * actions; running tiles show progress; failures show a compact error tile.
 * Clicking any tile opens the TaskLightbox for metadata + full actions.
 */

import { motion, AnimatePresence } from "motion/react";
import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, Download, FileText } from "lucide-react";
import { downloadImage } from "../lib/download";

import type { ImageTask } from "../types";

interface CanvasGridProps {
  tasks: ImageTask[];
  onOpenTask: (task: ImageTask) => void;
  onRetry: (id: string) => void;
}

export const CanvasGrid = memo(function CanvasGrid({ tasks, onOpenTask, onRetry }: CanvasGridProps) {
  const { t } = useTranslation();

  const visibleTasks = useMemo(
    () => [...tasks].sort((a, b) => b.createdAt - a.createdAt),
    [tasks],
  );

  if (visibleTasks.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
      <AnimatePresence mode="popLayout">
        {visibleTasks.map((task) => (
          <motion.div
            key={task.id}
            layout
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
          >
            <CanvasTile task={task} onOpenTask={onOpenTask} onRetry={onRetry} t={t} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
});

type TFunc = ReturnType<typeof useTranslation>["t"];

const CanvasTile = memo(function CanvasTile({
  task,
  onOpenTask,
  onRetry,
  t,
}: {
  task: ImageTask;
  onOpenTask: (task: ImageTask) => void;
  onRetry: (id: string) => void;
  t: TFunc;
}) {
  const isVisionTask = task.mode === "vision";
  const running = task.status === "pending" || task.status === "running";
  const failed = task.status === "error" || task.status === "cancelled";
  const errorText = task.error ? (task.error.startsWith("tasks.") || task.error.startsWith("errors.") ? t(task.error) : task.error) : "";

  async function handleDownload(event: React.MouseEvent) {
    event.stopPropagation();
    if (!task.imageUrl) {
      return;
    }
    await downloadImage(task.imageUrl, `openai-image-${task.id.slice(0, 8)}`, task.imageMimeType);
  }

  function handleRetry(event: React.MouseEvent) {
    event.stopPropagation();
    onRetry(task.id);
  }

  const base =
    "group relative block w-full overflow-hidden rounded border bg-surface-2 text-left transition-colors";

  /* Success with image: pure imagery, hover reveals download + open */
  if (!isVisionTask && task.imageUrl) {
    return (
      <button
        type="button"
        className={`${base} border-surface-3 hover:border-accent/40`}
        onClick={() => onOpenTask(task)}
        aria-label={t("tasks.previewGeneratedImage")}
      >
        <img
          className="aspect-square h-auto w-full object-cover"
          src={task.imageUrl}
          alt={task.prompt}
          loading="lazy"
        />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-end gap-1.5 bg-gradient-to-t from-slate-950/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
          <span
            role="button"
            tabIndex={-1}
            onClick={handleDownload}
            className="inline-flex items-center gap-1 rounded bg-surface-0/85 px-2 py-1 text-[11px] font-medium text-text-primary hover:bg-surface-0"
          >
            <Download className="h-3 w-3" />
            {t("tasks.actions.download")}
          </span>
        </span>
      </button>
    );
  }

  /* Running / pending: progress placeholder */
  if (running) {
    return (
      <button
        type="button"
        className={`${base} flex aspect-square flex-col items-center justify-center gap-2 border-surface-3`}
        onClick={() => onOpenTask(task)}
      >
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-hidden />
        <span className="px-3 text-center text-[11px] text-text-tertiary">{t("tasks.generating")}</span>
      </button>
    );
  }

  /* Failed / cancelled: compact error tile with inline retry */
  if (failed) {
    return (
      <div
        className={`${base} flex aspect-square cursor-pointer flex-col items-start justify-between border-error/25 p-3 hover:border-error/50`}
        onClick={() => onOpenTask(task)}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            onOpenTask(task);
          }
        }}
        title={task.prompt}
      >
        <div className="flex w-full items-center gap-1.5 text-[11px] font-semibold text-error">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {t(`tasks.status.${task.status}`)}
        </div>
        <p className="line-clamp-2 w-full text-[11px] leading-4 text-text-secondary">{task.prompt}</p>
        <p className="line-clamp-2 w-full text-[10px] leading-4 text-error/90">{errorText}</p>
        <div className="flex w-full gap-1.5">
          <button
            type="button"
            className="inline-flex flex-1 items-center justify-center rounded border border-surface-3 bg-surface-1 px-2 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
            onClick={handleRetry}
          >
            {t("tasks.actions.retry")}
          </button>
          <button
            type="button"
            className="inline-flex flex-1 items-center justify-center rounded border border-surface-3 bg-surface-1 px-2 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
            onClick={(event) => {
              event.stopPropagation();
              onOpenTask(task);
            }}
          >
            {t("tasks.actions.preview")}
          </button>
        </div>
      </div>
    );
  }

  /* Vision (OCR) tile: text result or input thumbnail */
  if (isVisionTask) {
    return (
      <button
        type="button"
        className={`${base} flex aspect-square flex-col items-start justify-between border-surface-3 p-3 hover:border-accent/40`}
        onClick={() => onOpenTask(task)}
        title={task.prompt}
      >
        {task.inputThumbnail ? (
          <img className="h-12 w-12 rounded object-cover ring-1 ring-surface-3" src={task.inputThumbnail} alt="input" />
        ) : (
          <FileText className="h-5 w-5 text-text-tertiary" aria-hidden />
        )}
        <p className="line-clamp-4 w-full text-left text-[11px] leading-4 text-text-secondary">
          {task.outputText?.trim() || (running ? t("tasks.analyzing") : t("tasks.noTextYet"))}
        </p>
        <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-bold text-text-secondary">OCR</span>
      </button>
    );
  }

  /* Generic fallback: non-image task states that have no tile of their own */
  return (
    <button
      type="button"
      className={`${base} flex aspect-square flex-col items-start justify-between border-surface-3 p-3 hover:border-accent/40`}
      onClick={() => onOpenTask(task)}
      title={task.prompt}
    >
      <FileText className="h-5 w-5 text-text-tertiary" aria-hidden />
      <p className="line-clamp-4 w-full text-left text-[11px] leading-4 text-text-secondary">{task.prompt}</p>
      <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-semibold text-text-secondary">
        {t(`tasks.status.${task.status}`)}
      </span>
    </button>
  );
});
