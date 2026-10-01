import { memo, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { ImageTask } from "../types";
import { groupTasks } from "../lib/taskGroups";
import { TaskCard } from "./TaskCard";
import { TaskGroupCard } from "./TaskGroupCard";

const MAX_RENDERED_TASKS = 200;

interface TaskQueueProps {
  tasks: ImageTask[];
  onPreview: (imageUrl: string, gallery: string[]) => void;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
  onClearTaskImage: (id: string) => void;
  onReuseParams: (task: ImageTask) => void;
  onEditImage: (imageUrl: string) => void;
}

export const TaskQueue = memo(function TaskQueue({
  tasks,
  onPreview,
  onRetry,
  onCancel,
  onRemove,
  onClearTaskImage,
  onReuseParams,
  onEditImage,
}: TaskQueueProps) {
  const { t } = useTranslation();

  const { stats, groups, visibleCount, hiddenCount } = useMemo(() => {
    const counts = { pending: 0, running: 0, success: 0, error: 0 };

    for (const task of tasks) {
      if (task.status in counts) {
        counts[task.status as keyof typeof counts] += 1;
      }
    }

    const { groups, hiddenCount } = groupTasks(tasks, MAX_RENDERED_TASKS);

    return { stats: counts, groups, visibleCount: tasks.length - hiddenCount, hiddenCount };
  }, [tasks]);

  const handlePreview = useCallback(
    (imageUrl: string) =>
      onPreview(
        imageUrl,
        groups.flat().flatMap((task) => (task.mode !== "vision" && task.imageUrl ? [task.imageUrl] : [])),
      ),
    [onPreview, groups],
  );

  return (
    <section className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-soft backdrop-blur">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{t("tasks.title")}</h2>
          <p className="mt-1 text-sm text-slate-500">{t("tasks.stats", stats)}</p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
          {t("tasks.total", { count: tasks.length })}
        </div>
      </div>

      {hiddenCount > 0 ? (
        <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          {t("tasks.showingRecent", { shown: visibleCount, hidden: hiddenCount })}
        </div>
      ) : null}

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center text-sm text-slate-500">
          {t("tasks.empty")}
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) =>
            group.length > 1 ? (
              <TaskGroupCard
                key={group[0].id}
                tasks={group}
                onPreview={handlePreview}
                onRetry={onRetry}
                onCancel={onCancel}
                onRemove={onRemove}
                onReuseParams={onReuseParams}
                onEditImage={onEditImage}
              />
            ) : (
              <TaskCard
                key={group[0].id}
                task={group[0]}
                onPreview={handlePreview}
                onRetry={onRetry}
                onCancel={onCancel}
                onRemove={onRemove}
                onClearImage={onClearTaskImage}
                onReuseParams={onReuseParams}
                onEditImage={onEditImage}
              />
            ),
          )}
        </div>
      )}
    </section>
  );
});
