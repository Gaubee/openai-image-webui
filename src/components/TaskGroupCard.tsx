import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { copyText, downloadImage } from "../lib/download";
import { formatCostUsd } from "../lib/pricing";
import type { ImageTask } from "../types";
import { formatTaskDebug, isI18nKey, statusStyles } from "./TaskCard";

interface TaskGroupCardProps {
  tasks: ImageTask[];
  onPreview: (imageUrl: string) => void;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
  onReuseParams: (task: ImageTask) => void;
  onEditImage: (imageUrl: string) => void;
}

const buttonClass =
  "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50";
const tileButtonClass =
  "rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50";

function aspectRatioOf(size: string) {
  const match = /^(\d+)x(\d+)$/.exec(size);
  return match ? `${match[1]} / ${match[2]}` : "1 / 1";
}

export const TaskGroupCard = memo(function TaskGroupCard({
  tasks,
  onPreview,
  onRetry,
  onCancel,
  onRemove,
  onReuseParams,
  onEditImage,
}: TaskGroupCardProps) {
  const { t } = useTranslation();
  const [messageKey, setMessageKey] = useState("");
  const first = tasks[0];
  const done = tasks.filter((task) => task.status === "success").length;
  const failed = tasks.filter((task) => task.status === "error" || task.status === "cancelled");
  const active = tasks.filter((task) => task.status === "pending" || task.status === "running");
  const costs = tasks.flatMap((task) => (task.estimatedCostUsd != null ? [task.estimatedCostUsd] : []));
  const errorTextOf = (task: ImageTask) => (task.error ? (isI18nKey(task.error) ? t(task.error) : task.error) : "");

  async function handleCopyPrompt() {
    await copyText(first.prompt);
    setMessageKey("tasks.messages.promptCopied");
  }

  async function handleCopyDebug(task: ImageTask) {
    await copyText(formatTaskDebug(task, errorTextOf(task)));
    setMessageKey("tasks.messages.debugCopied");
  }

  async function handleDownload(task: ImageTask) {
    if (!task.imageUrl) return;
    await downloadImage(task.imageUrl, `openai-image-${task.id.slice(0, 8)}`, task.imageMimeType);
    setMessageKey("tasks.messages.downloadStarted");
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span
          className={`rounded-full px-2.5 py-1 font-semibold ring-1 ${
            statusStyles[active.length ? "running" : failed.length ? "error" : "success"]
          }`}
        >
          {t("tasks.group.progress", { done, total: tasks.length })}
        </span>
        <span>{first.model}</span>
        <span>{first.size}</span>
        {first.mode === "edit" ? (
          <span className="rounded-full bg-violet-50 px-2 py-0.5 font-medium text-violet-600">{t("tasks.group.edit")}</span>
        ) : null}
        <span>{new Date(first.createdAt).toLocaleString()}</span>
        {costs.length ? (
          <span className="font-semibold text-amber-700">{formatCostUsd(costs.reduce((sum, cost) => sum + cost, 0))}</span>
        ) : null}
      </div>

      <p className="mb-3 line-clamp-3 text-sm leading-6 text-slate-700">{first.prompt}</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {tasks.map((task) => {
          const errorText = errorTextOf(task);
          return (
            <div key={task.id} className="flex flex-col gap-1.5">
              <div
                className="relative overflow-hidden rounded-xl bg-slate-100"
                style={{ aspectRatio: aspectRatioOf(task.size) }}
              >
                {task.imageUrl ? (
                  <button
                    type="button"
                    className="h-full w-full"
                    onClick={() => onPreview(task.imageUrl as string)}
                    aria-label={t("tasks.previewGeneratedImage")}
                  >
                    <img className="h-full w-full object-contain" src={task.imageUrl} alt={task.prompt} loading="lazy" />
                  </button>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-center text-xs text-slate-400">
                    <span className={`rounded-full px-2 py-0.5 font-semibold ring-1 ${statusStyles[task.status]}`}>
                      {t(`tasks.status.${task.status}`)}
                    </span>
                    {errorText ? (
                      <span className="line-clamp-4 break-words text-rose-600" title={errorText}>
                        {errorText}
                      </span>
                    ) : (
                      <span>
                        {task.status === "running"
                          ? t("tasks.generating")
                          : task.imageCached
                            ? t("tasks.restoringCachedImage")
                            : task.status === "success"
                              ? t("tasks.noImageYet")
                              : null}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {task.imageUrl ? (
                  <>
                    <button type="button" className={tileButtonClass} onClick={() => void handleDownload(task)}>
                      {t("tasks.actions.download")}
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-medium text-violet-700 transition hover:border-violet-300 hover:bg-violet-100"
                      onClick={() => onEditImage(task.imageUrl as string)}
                    >
                      {t("tasks.actions.editImage")}
                    </button>
                  </>
                ) : null}
                {task.status === "error" || task.status === "cancelled" ? (
                  <button type="button" className={tileButtonClass} onClick={() => onRetry(task.id)}>
                    {t("tasks.actions.retry")}
                  </button>
                ) : null}
                {task.status === "error" && task.debug ? (
                  <button type="button" className={tileButtonClass} onClick={() => void handleCopyDebug(task)}>
                    {t("tasks.group.copyDebug")}
                  </button>
                ) : null}
                {task.status === "pending" || task.status === "running" ? (
                  <button type="button" className={tileButtonClass} onClick={() => onCancel(task.id)}>
                    {t("tasks.actions.cancel")}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="ml-auto rounded-md px-2 py-1 text-[11px] font-medium text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                  onClick={() => onRemove(task.id)}
                  aria-label={t("tasks.actions.delete")}
                  title={t("tasks.actions.delete")}
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {messageKey ? <div className="mt-3 text-xs text-emerald-600">{t(messageKey)}</div> : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 transition hover:border-sky-300 hover:bg-sky-100"
          onClick={() => onReuseParams(tasks.find((task) => task.status === "success") ?? first)}
        >
          {t("tasks.actions.reuseParams")}
        </button>
        <button type="button" className={buttonClass} onClick={() => void handleCopyPrompt()}>
          {t("tasks.actions.copyPrompt")}
        </button>
        {failed.length ? (
          <button type="button" className={buttonClass} onClick={() => failed.forEach((task) => onRetry(task.id))}>
            {t("tasks.group.retryFailed", { count: failed.length })}
          </button>
        ) : null}
        {active.length ? (
          <button type="button" className={buttonClass} onClick={() => active.forEach((task) => onCancel(task.id))}>
            {t("tasks.group.cancelAll")}
          </button>
        ) : null}
        <button
          type="button"
          className="ml-auto rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
          onClick={() => tasks.forEach((task) => onRemove(task.id))}
        >
          {t("tasks.group.deleteAll")}
        </button>
      </div>
    </article>
  );
});
